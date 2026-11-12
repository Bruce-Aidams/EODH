/**
 * Neural TTS Provider for EODH
 * 
 * Calls the Supabase Edge Function to generate neural TTS audio
 * using Google Cloud Text-to-Speech API. The generated audio is
 * cached in Supabase Storage for reuse.
 */

import { supabase } from '@/lib/supabase/client';

export interface NeuralTTSOptions {
  voiceName?: string;
  languageCode?: string;
}

export interface NeuralTTSResult {
  audioUrl: string;
  duration: number;
  cached: boolean;
}

export interface NeuralTTSBatchResult {
  segments: Array<{
    text: string;
    audioUrl: string;
    duration: number;
    cached: boolean;
  }>;
  totalDuration: number;
}

const DEFAULT_VOICE_NAME = 'en-US-Neural2-F';
const DEFAULT_LANGUAGE_CODE = 'en-US';

/**
 * Generate neural TTS audio for a single text segment
 */
export async function generateNeuralTTS(
  text: string,
  options: NeuralTTSOptions = {}
): Promise<NeuralTTSResult> {
  const { voiceName, languageCode } = options;

  // Trim and validate text length (Google TTS limit: 5000 chars)
  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    throw new Error('Text is empty');
  }

  if (trimmedText.length > 5000) {
    throw new Error('Text exceeds maximum length of 5000 characters');
  }

  const { data, error } = await supabase.functions.invoke('generate-tts', {
    body: {
      text: trimmedText,
      voiceName: voiceName || DEFAULT_VOICE_NAME,
      languageCode: languageCode || DEFAULT_LANGUAGE_CODE,
    },
  });

  if (error) {
    throw new Error(`Neural TTS failed: ${error.message}`);
  }

  if (!data || !data.audioUrl) {
    throw new Error('Neural TTS returned invalid response');
  }

  return {
    audioUrl: data.audioUrl,
    duration: data.duration || 0,
    cached: data.cached || false,
  };
}

/**
 * Generate neural TTS audio for multiple text segments in parallel
 * with a concurrency limit to avoid overwhelming the API
 */
export async function generateNeuralTTSBatch(
  texts: string[],
  options: NeuralTTSOptions = {},
  concurrency: number = 3
): Promise<NeuralTTSBatchResult> {
  const segments: Array<{
    text: string;
    audioUrl: string;
    duration: number;
    cached: boolean;
  }> = [];
  let totalDuration = 0;

  // Process in batches with concurrency limit
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const promises = batch.map(async (text) => {
      try {
        const result = await generateNeuralTTS(text, options);
        return { text, ...result };
      } catch (error) {
        console.error(`Failed to generate TTS for segment:`, error);
        // Return a placeholder for failed segments
        return {
          text,
          audioUrl: '',
          duration: 0,
          cached: false,
        };
      }
    });

    const results = await Promise.all(promises);
    for (const result of results) {
      segments.push(result);
      totalDuration += result.duration;
    }
  }

  return { segments, totalDuration };
}

/**
 * Check if neural TTS is available (Edge Function is deployed)
 */
export async function isNeuralTTSAvailable(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('generate-tts', {
      body: {
        text: 'test',
      },
    });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Get available neural TTS voices
 */
export async function getNeuralTTSVoices(): Promise<Array<{
  name: string;
  languageCode: string;
  ssmlGender: string;
}>> {
  // Return a curated list of high-quality Google Cloud TTS voices
  // For a full list, see: https://cloud.google.com/text-to-speech/docs/voices
  return [
    { name: 'en-US-Neural2-F', languageCode: 'en-US', ssmlGender: 'female' },
    { name: 'en-US-Neural2-M', languageCode: 'en-US', ssmlGender: 'male' },
    { name: 'en-US-Studio-O', languageCode: 'en-US', ssmlGender: 'female' },
    { name: 'en-US-Studio-Q', languageCode: 'en-US', ssmlGender: 'male' },
    { name: 'en-GB-Neural2-A', languageCode: 'en-GB', ssmlGender: 'female' },
    { name: 'en-GB-Neural2-B', languageCode: 'en-GB', ssmlGender: 'male' },
    { name: 'en-AU-Neural2-A', languageCode: 'en-AU', ssmlGender: 'female' },
    { name: 'en-AU-Neural2-B', languageCode: 'en-AU', ssmlGender: 'male' },
  ];
}
