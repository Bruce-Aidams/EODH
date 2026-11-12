-- =====================================================
-- EODH – Neural TTS Audio Storage
-- Supabase Storage Bucket for cached TTS audio
-- =====================================================

-- Create the tts-audio storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-audio', 'tts-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for tts-audio bucket
-- Allow authenticated users to read cached TTS audio
CREATE POLICY "Authenticated users can read TTS audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'tts-audio');

-- Allow service role to upload TTS audio (Edge Function)
CREATE POLICY "Service role can upload TTS audio"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'tts-audio');

-- Allow service role to update TTS audio (upsert for cache refresh)
CREATE POLICY "Service role can update TTS audio"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'tts-audio');

-- Allow service role to delete TTS audio (cache cleanup)
CREATE POLICY "Service role can delete TTS audio"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'tts-audio');

-- =====================================================
-- Optional: Add TTS-related columns to books table
-- These track whether neural TTS has been generated
-- =====================================================

-- Add neural_tts_generated column to books table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'neural_tts_generated'
  ) THEN
    ALTER TABLE books ADD COLUMN neural_tts_generated BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE books ADD COLUMN neural_tts_voice TEXT DEFAULT 'en-US-Neural2-F';
    ALTER TABLE books ADD COLUMN neural_tts_generated_at TIMESTAMPTZ;
  END IF;
END $$;

-- =====================================================
-- Optional: Index for faster TTS audio lookups
-- =====================================================

-- Index on audio_segments.audio_url for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_audio_segments_audio_url ON audio_segments(audio_url);
