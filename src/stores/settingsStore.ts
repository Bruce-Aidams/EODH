import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReadingSettings } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface AudioSettings {
  playbackSpeed: number;
  sleepTimerMinutes: number | null;
  defaultVoice: string;
  enableBackgroundPlayback: boolean;
}

interface SettingsState {
  readingSettings: ReadingSettings;
  audioSettings: AudioSettings;
  theme: 'light' | 'dark' | 'system';
  offlineMode: boolean;
  isLoadingSettings: boolean;
  setReadingSettings: (settings: Partial<ReadingSettings>) => Promise<void>;
  setAudioSettings: (settings: Partial<AudioSettings>) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  setOfflineMode: (offlineMode: boolean) => void;
  loadSettings: () => Promise<void>;
  resetSettings: () => Promise<void>;
}

const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontFamily: 'System',
  fontSize: 18,
  lineSpacing: 1.5,
  textAlign: 'justify',
  backgroundColor: '#F6F5FC',
  theme: 'light',
  margins: 16,
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  playbackSpeed: 1.0,
  sleepTimerMinutes: null,
  defaultVoice: 'system',
  enableBackgroundPlayback: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      readingSettings: DEFAULT_READING_SETTINGS,
      audioSettings: DEFAULT_AUDIO_SETTINGS,
      theme: 'system',
      offlineMode: false,
      isLoadingSettings: false,

      loadSettings: async () => {
        set({ isLoadingSettings: true });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            set({ isLoadingSettings: false });
            return;
          }

          const { data } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (data) {
            set({
              readingSettings: data.reading_settings || DEFAULT_READING_SETTINGS,
              audioSettings: {
                playbackSpeed: data.playback_speed ?? DEFAULT_AUDIO_SETTINGS.playbackSpeed,
                sleepTimerMinutes: data.sleep_timer_minutes ?? DEFAULT_AUDIO_SETTINGS.sleepTimerMinutes,
                defaultVoice: data.default_voice ?? DEFAULT_AUDIO_SETTINGS.defaultVoice,
                enableBackgroundPlayback: data.enable_background_playback ?? DEFAULT_AUDIO_SETTINGS.enableBackgroundPlayback,
              },
              theme: data.theme || 'system',
              isLoadingSettings: false,
            });
          } else {
            set({ isLoadingSettings: false });
          }
        } catch {
          set({ isLoadingSettings: false });
        }
      },

      setReadingSettings: async (settings: Partial<ReadingSettings>) => {
        const newSettings = { ...get().readingSettings, ...settings };
        set({ readingSettings: newSettings });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: existing } = await supabase
            .from('user_preferences')
            .select('id')
            .eq('user_id', user.id)
            .single();

          const payload = {
            user_id: user.id,
            reading_settings: newSettings,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase.from('user_preferences').update(payload).eq('id', existing.id);
          } else {
            await supabase.from('user_preferences').insert(payload);
          }
        } catch {
          // Silent fail - settings are still updated locally
        }
      },

      setAudioSettings: async (settings: Partial<AudioSettings>) => {
        const newSettings = { ...get().audioSettings, ...settings };
        set({ audioSettings: newSettings });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: existing } = await supabase
            .from('user_preferences')
            .select('id')
            .eq('user_id', user.id)
            .single();

          const payload = {
            user_id: user.id,
            playback_speed: newSettings.playbackSpeed,
            sleep_timer_minutes: newSettings.sleepTimerMinutes,
            default_voice: newSettings.defaultVoice,
            enable_background_playback: newSettings.enableBackgroundPlayback,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase.from('user_preferences').update(payload).eq('id', existing.id);
          } else {
            await supabase.from('user_preferences').insert(payload);
          }
        } catch {
          // Silent fail - settings are still updated locally
        }
      },

      setTheme: async (theme: 'light' | 'dark' | 'system') => {
        set({ theme });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: existing } = await supabase
            .from('user_preferences')
            .select('id')
            .eq('user_id', user.id)
            .single();

          const payload = {
            user_id: user.id,
            theme,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase.from('user_preferences').update(payload).eq('id', existing.id);
          } else {
            await supabase.from('user_preferences').insert(payload);
          }
        } catch {
          // Silent fail - theme is still updated locally
        }
      },

      setOfflineMode: (offlineMode: boolean) => set({ offlineMode }),

      resetSettings: async () => {
        set({
          readingSettings: DEFAULT_READING_SETTINGS,
          audioSettings: DEFAULT_AUDIO_SETTINGS,
          theme: 'system',
          offlineMode: false,
        });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: existing } = await supabase
            .from('user_preferences')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (existing) {
            await supabase.from('user_preferences').delete().eq('id', existing.id);
          }
        } catch {
          // Silent fail
        }
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        readingSettings: state.readingSettings,
        audioSettings: state.audioSettings,
        theme: state.theme,
        offlineMode: state.offlineMode,
      }),
      version: 1,
    }
  )
);
