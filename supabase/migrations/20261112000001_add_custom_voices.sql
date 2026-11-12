-- =====================================================
-- Custom Voices
-- Allows users to upload custom voice audio files for narration
-- =====================================================

CREATE TABLE IF NOT EXISTS custom_voices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  description TEXT,
  duration_seconds INTEGER,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  error_message TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX idx_custom_voices_user ON custom_voices(user_id);
CREATE INDEX idx_custom_voices_status ON custom_voices(status);

-- RLS Policies
ALTER TABLE custom_voices ENABLE ROW LEVEL SECURITY;

-- Users can read their own voices
CREATE POLICY "Users can read own voices"
  ON custom_voices FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own voices
CREATE POLICY "Users can insert own voices"
  ON custom_voices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own voices
CREATE POLICY "Users can update own voices"
  ON custom_voices FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own voices
CREATE POLICY "Users can delete own voices"
  ON custom_voices FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Create storage bucket for custom voice audio files
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-voices', 'custom-voices', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage
CREATE POLICY "Users can read own voice audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'custom-voices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own voice audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'custom-voices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own voice audio"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'custom-voices' AND auth.uid()::text = (storage.foldername(name))[1]);
