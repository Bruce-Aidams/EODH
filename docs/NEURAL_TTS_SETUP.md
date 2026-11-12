# Neural TTS Setup Guide

This guide explains how to set up Google Cloud Text-to-Speech for the EODH app, replacing device-based TTS with high-quality neural audio.

## Overview

The neural TTS system uses:
- **Google Cloud Text-to-Speech API** for generating natural-sounding speech
- **Supabase Edge Functions** to handle authentication and API calls server-side
- **Supabase Storage** to cache generated audio for reuse
- **Expo Audio** for playback of pre-generated MP3 files

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. Text-to-Speech API enabled in your GCP project
3. A service account with Text-to-Speech access
4. Supabase CLI installed (`npm install -g supabase`)

## Step 1: Set up Google Cloud TTS

### 1.1 Create a GCP Project (if you don't have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Text-to-Speech API:
   - Navigate to API & Services → Library
   - Search for "Text-to-Speech API" and enable it

### 1.2 Create a Service Account

1. Go to IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. Give it a name (e.g., "eodh-tts-service")
4. Grant the following roles:
   - Text-to-Speech User
   - Storage Object Viewer (for caching)
5. Click "Done"

### 1.3 Create a Service Account Key

1. Click on the service account you just created
2. Go to the "Keys" tab
3. Click "Add Key" → "Create new key"
4. Select JSON format and click "Create"
5. **Save the JSON file securely** — this contains your private key

### 1.4 Note Your Credentials

From the JSON key file, you'll need:
- The entire JSON content for `GOOGLE_CREDENTIALS`

## Step 2: Deploy the Edge Function

### 2.1 Link Your Supabase Project

```bash
cd path/to/EODH
supabase login
supabase link --project-ref your-project-ref
```

### 2.2 Set the Google Credentials Secret

```bash
# Read the JSON key file and set it as a secret
supabase secrets set GOOGLE_CREDENTIALS="$(cat /path/to/your-service-account-key.json)"
```

### 2.3 Deploy the Edge Function

```bash
supabase functions deploy generate-tts
```

### 2.4 Verify the Deployment

```bash
# Test the Edge Function
curl -X POST https://your-project-ref.supabase.co/functions/v1/generate-tts \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test of neural TTS."}'
```

You should receive a response like:
```json
{
  "audioUrl": "https://...supabase.co/storage/v1/object/sign/...",
  "duration": 2.5,
  "cached": false
}
```

## Step 3: Set up Supabase Storage

### 3.1 Run the Migration

```bash
supabase db push
```

This creates the `tts-audio` storage bucket with proper RLS policies.

### 3.2 Or Create Manually

If you prefer to set up the bucket manually:

1. Go to your Supabase Dashboard → Storage
2. Create a new bucket named `tts-audio`
3. Set it to **private** (not public)
4. Add the following RLS policies:
   - Authenticated users can SELECT
   - Service role can INSERT, UPDATE, DELETE

## Step 4: Configure the App

### 4.1 Environment Variables

Add these to your `.env` file (optional — defaults are provided):

```env
# Use 'neural' for Google Cloud TTS, 'device' for device-based TTS
EXPO_PUBLIC_TTS_PROVIDER=neural

# Google Cloud TTS voice name
EXPO_PUBLIC_TTS_VOICE=en-US-Neural2-F
```

### 4.2 Available Voices

The following voices are pre-configured:

| Voice | Language | Gender |
|-------|----------|--------|
| `en-US-Neural2-F` | US English | Female |
| `en-US-Neural2-M` | US English | Male |
| `en-US-Studio-O` | US English | Female |
| `en-US-Studio-Q` | US English | Male |
| `en-GB-Neural2-A` | UK English | Female |
| `en-GB-Neural2-B` | UK English | Male |
| `en-AU-Neural2-A` | Australian English | Female |
| `en-AU-Neural2-B` | Australian English | Male |

For more voices, see: [Google Cloud TTS Voices](https://cloud.google.com/text-to-speech/docs/voices)

## Step 3: Using Neural TTS in Code

### Basic Usage

```typescript
import { ttsEngine } from '@/lib/tts/engine';

// Configure neural TTS provider
ttsEngine.configure({
  provider: 'neural',
  voiceName: 'en-US-Neural2-F',
  language: 'en-US',
  rate: 1.0,
});

// Load text
ttsEngine.loadText('Your book content here...');

// Generate audio for all segments
await ttsEngine.generateAudioForSegments();

// Start playback
await ttsEngine.speak();
```

### With Progress Tracking

```typescript
ttsEngine.setOnProgress((generated, total) => {
  console.log(`Generated ${generated}/${total} segments`);
});

await ttsEngine.generateAudioForSegments();
```

### Switching Between Providers

```typescript
// Use device TTS (no network required)
ttsEngine.configure({ provider: 'device' });

// Use neural TTS (requires network)
ttsEngine.configure({ provider: 'neural' });
```

## Pricing

Google Cloud TTS pricing:
- **Standard voices**: $4 per 1 million characters
- **WaveNet/Neural2 voices**: $16 per 1 million characters
- **Free tier**: 1 million characters/month

For a typical ebook (~100,000 words ≈ 500,000 characters):
- Neural2 voice: ~$8 per book
- Cached audio is reused, so you only pay once per book

## Troubleshooting

### "Google Cloud credentials not configured"

Make sure you've set the `GOOGLE_CREDENTIALS` secret:
```bash
supabase secrets set GOOGLE_CREDENTIALS="$(cat /path/to/key.json)"
```

### "Failed to get Google access token"

Check that your service account has the correct roles and the key is valid.

### "Text exceeds maximum length"

Google TTS has a 5,000 character limit per request. The engine automatically splits text into segments, but if you're passing very long passages, consider splitting them manually.

### Audio playback issues

Make sure the `tts-audio` storage bucket exists and has the correct RLS policies. The Edge Function needs service role access to upload audio.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React     │────>│  Supabase Edge   │────>│  Google Cloud   │
│   Native    │     │  Function        │     │  TTS API        │
│   App       │<────│  (generate-tts)  │<────│  (Neural Audio) │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │  Supabase        │
                    │  Storage         │
                    │  (tts-audio)     │
                    │  (Cache)         │
                    └──────────────────┘
```

1. App sends text to the Edge Function
2. Edge Function checks cache in Supabase Storage
3. If not cached, calls Google Cloud TTS API
4. Generated audio is uploaded to Supabase Storage
5. Signed URL is returned to the app
6. App plays the audio using Expo Audio
