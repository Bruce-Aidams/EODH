/**
 * Custom Voice Library for EODH
 * 
 * Manages user-uploaded custom voice audio files that can be used
 * as narrator voices for audiobook playback.
 */

import { supabase } from '@/lib/supabase/client';
import { CustomVoice } from '@/types';

const BUCKET_NAME = 'custom-voices';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a', 'audio/mp4'];

/**
 * Upload a custom voice audio file
 */
export async function uploadCustomVoice(
  file: { uri: string; name: string; type: string },
  voiceName: string,
  language: string = 'en',
  description?: string
): Promise<CustomVoice> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Must be authenticated to upload a custom voice');
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Please upload an MP3, WAV, OGG, AAC, or M4A file.');
  }

  // Upload audio file to storage
  const userId = user.id;
  const filePath = `${userId}/${Date.now()}_${file.name}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, {
      uri: file.uri,
      name: file.name,
      type: file.type,
    }, {
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload voice audio: ${uploadError.message}`);
  }

  // Get signed URL for the uploaded file
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(uploadData.path);

  // Create voice record in database
  const { data: voice, error: voiceError } = await supabase
    .from('custom_voices')
    .insert({
      user_id: userId,
      name: voiceName,
      audio_url: publicUrl,
      language,
      description: description || null,
      status: 'ready',
    })
    .select()
    .single();

  if (voiceError) {
    // Clean up uploaded file if database insert fails
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    throw new Error(`Failed to create voice record: ${voiceError.message}`);
  }

  return voice as CustomVoice;
}

/**
 * Fetch all custom voices for the current user
 */
export async function getCustomVoices(): Promise<CustomVoice[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('custom_voices')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch custom voices:', error);
    return [];
  }

  return data as CustomVoice[];
}

/**
 * Set a custom voice as the default narrator voice
 */
export async function setDefaultVoice(voiceId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Must be authenticated to set default voice');
  }

  // Unset all default voices for this user
  await supabase
    .from('custom_voices')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_default', true);

  // Set the selected voice as default
  const { error } = await supabase
    .from('custom_voices')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', voiceId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to set default voice: ${error.message}`);
  }
}

/**
 * Get the default custom voice for the current user
 */
export async function getDefaultVoice(): Promise<CustomVoice | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('custom_voices')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .eq('status', 'ready')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Failed to fetch default voice:', error);
    return null;
  }

  return data as CustomVoice;
}

/**
 * Delete a custom voice
 */
export async function deleteCustomVoice(voiceId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Must be authenticated to delete a voice');
  }

  // Get the voice record
  const { data: voice, error: fetchError } = await supabase
    .from('custom_voices')
    .select('audio_url')
    .eq('id', voiceId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !voice) {
    throw new Error('Voice not found');
  }

  // Extract file path from URL
  const urlParts = voice.audio_url.split('/');
  const filePath = urlParts.slice(urlParts.indexOf('custom-voices') + 2).join('/');

  // Delete from storage
  if (filePath) {
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from('custom_voices')
    .delete()
    .eq('id', voiceId)
    .eq('user_id', user.id);

  if (deleteError) {
    throw new Error(`Failed to delete voice: ${deleteError.message}`);
  }
}

/**
 * Update a custom voice's metadata
 */
export async function updateCustomVoice(
  voiceId: string,
  updates: { name?: string; description?: string }
): Promise<CustomVoice> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Must be authenticated to update a voice');
  }

  const { data: voice, error } = await supabase
    .from('custom_voices')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', voiceId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update voice: ${error.message}`);
  }

  return voice as CustomVoice;
}

/**
 * Get a signed URL for a custom voice audio file
 */
export async function getVoiceAudioUrl(voiceId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: voice } = await supabase
    .from('custom_voices')
    .select('audio_url')
    .eq('id', voiceId)
    .eq('user_id', user.id)
    .single();

  if (!voice || !voice.audio_url) {
    return null;
  }

  // Get signed URL for private bucket
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(voice.audio_url.split('/').slice(1).join('/'), 3600);

  if (error || !data) {
    return voice.audio_url; // Fallback to public URL
  }

  return data.signedUrl;
}
