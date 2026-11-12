// Supabase Edge Function: generate-tts
//
// Generates neural TTS audio using Google Cloud Text-to-Speech API.
// Caches generated audio in Supabase Storage for reuse.
//
// Deployment:
// 1. Install Supabase CLI: https://supabase.com/docs/guides/cli
// 2. Link your project: supabase link --project-ref <your-project-ref>
// 3. Set Google Cloud credentials:
//    supabase secrets set GOOGLE_CREDENTIALS='{"type":"service_account",...}'
// 4. Deploy: supabase functions deploy generate-tts
//
// Request body:
//   {
//     "text": "The text to convert to speech",
//     "voiceName": "en-US-Neural2-F",  // optional, defaults to en-US-Neural2-F
//     "languageCode": "en-US",          // optional, defaults to en-US
//     "ssmlGender": "female",           // optional, for voice selection
//     "cacheKey": "optional-cache-key"  // optional, for custom cache lookup
//   }
//
// Response:
//   {
//     "audioUrl": "https://...supabase.co/storage/v1/object/sign/...",
//     "duration": 3.5,
//     "cached": true
//   }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleCredentials = Deno.env.get('GOOGLE_CREDENTIALS')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TTSRequest {
  text: string;
  voiceName?: string;
  languageCode?: string;
  ssmlGender?: string;
  cacheKey?: string;
}

interface TTSResponse {
  audioUrl: string;
  duration: number;
  cached: boolean;
}

// Google Cloud TTS API endpoint
const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/**
 * Generate an OAuth 2.0 access token from Google service account credentials
 */
async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = 3600; // 1 hour

  // Build JWT header and payload
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: JSON.parse(googleCredentials).client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + expiry,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign the JWT with the private key
  const privateKey = JSON.parse(googleCredentials).private_key;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(privateKey).buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signedToken = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedToken,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get Google access token: ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Call Google Cloud TTS API to synthesize speech
 */
async function synthesizeSpeech(
  accessToken: string,
  text: string,
  voiceName: string,
  languageCode: string
): Promise<ArrayBuffer> {
  const response = await fetch(GOOGLE_TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google TTS API error: ${response.status} ${errorText}`);
  }

  return await response.arrayBuffer();
}

/**
 * Generate a cache key for the TTS audio
 */
function generateCacheKey(text: string, voiceName: string, languageCode: string): string {
  // Simple hash-based cache key
  const content = `${text}|${voiceName}|${languageCode}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if cached audio exists in Supabase Storage
 */
async function getCachedAudio(cacheKey: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from('tts-audio')
    .list('');

  if (!data) return null;

  const fileName = `${cacheKey}.mp3`;
  const exists = data.some(file => file.name === fileName);

  if (exists) {
    // Create a signed URL for the cached audio (valid for 1 hour)
    const { data: signedData } = await supabase.storage
      .from('tts-audio')
      .createSignedUrl(fileName, 3600);

    return signedData?.signedUrl || null;
  }

  return null;
}

/**
 * Upload audio to Supabase Storage
 */
async function uploadAudio(cacheKey: string, audioBuffer: ArrayBuffer): Promise<string> {
  const fileName = `${cacheKey}.mp3`;

  // Convert ArrayBuffer to Uint8Array for upload
  const audioBytes = new Uint8Array(audioBuffer);

  const { error } = await supabase.storage
    .from('tts-audio')
    .upload(fileName, audioBytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload audio: ${error.message}`);
  }

  // Create a signed URL for the uploaded audio (valid for 1 hour)
  const { data: signedData } = await supabase.storage
    .from('tts-audio')
    .createSignedUrl(fileName, 3600);

  if (!signedData?.signedUrl) {
    throw new Error('Failed to create signed URL for uploaded audio');
  }

  return signedData.signedUrl;
}

/**
 * Estimate audio duration from text length (approximate)
 * Average speaking rate: ~150 words per minute
 */
function estimateDuration(text: string): number {
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  return (wordCount / 150) * 60; // Convert to seconds
}

serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    if (!googleCredentials) {
      return new Response(
        JSON.stringify({ error: 'Google Cloud credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TTSRequest = await req.json();
    const { text, voiceName, languageCode, cacheKey: customCacheKey } = body;

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trim and validate text length (Google TTS limit: 5000 chars)
    const trimmedText = text.trim();
    if (trimmedText.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Text exceeds maximum length of 5000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default voice settings
    const resolvedLanguageCode = languageCode || 'en-US';
    const resolvedVoiceName = voiceName || 'en-US-Neural2-F';

    // Generate cache key
    const cacheKey = customCacheKey || generateCacheKey(trimmedText, resolvedVoiceName, resolvedLanguageCode);

    // Check cache first
    const cachedUrl = await getCachedAudio(cacheKey);
    if (cachedUrl) {
      const duration = estimateDuration(trimmedText);
      const result: TTSResponse = {
        audioUrl: cachedUrl,
        duration,
        cached: true,
      };
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google access token
    const accessToken = await getGoogleAccessToken();

    // Synthesize speech
    const audioBuffer = await synthesizeSpeech(
      accessToken,
      trimmedText,
      resolvedVoiceName,
      resolvedLanguageCode
    );

    // Upload to Supabase Storage
    const audioUrl = await uploadAudio(cacheKey, audioBuffer);

    const duration = estimateDuration(trimmedText);
    const result: TTSResponse = {
      audioUrl,
      duration,
      cached: false,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('TTS generation error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate TTS audio',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
