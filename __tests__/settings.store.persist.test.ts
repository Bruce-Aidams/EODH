// Mock AsyncStorage before importing anything that uses it
const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null,
          })),
          single: jest.fn(() => ({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => ({ data: null, error: null })),
      update: jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: null })) })),
      delete: jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: null })) })),
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
    },
  },
}));

import { useSettingsStore } from '@/stores/settingsStore';

describe('settingsStore persist middleware', () => {
  beforeEach(() => {
    mockStorage.clear();
    useSettingsStore.persist.clearStorage();
    useSettingsStore.setState({
      readingSettings: {
        fontFamily: 'System',
        fontSize: 18,
        lineSpacing: 1.5,
        textAlign: 'justify',
        backgroundColor: '#F6F5FC',
        theme: 'light',
        margins: 16,
      },
      audioSettings: {
        playbackSpeed: 1.0,
        sleepTimerMinutes: null,
        defaultVoice: 'system',
        enableBackgroundPlayback: true,
      },
      theme: 'system',
      offlineMode: false,
      isLoadingSettings: false,
    });
  });

  describe('persist configuration', () => {
    it('has the correct storage name', () => {
      const opts = useSettingsStore.persist.getOptions();
      expect(opts.name).toBe('settings-storage');
    });

    it('has version 1', () => {
      const opts = useSettingsStore.persist.getOptions();
      expect(opts.version).toBe(1);
    });
  });

  describe('partialize', () => {
    it('persists only settings fields, not functions or loading states', () => {
      const opts = useSettingsStore.persist.getOptions();
      const partialize = opts.partialize as ((state: ReturnType<typeof useSettingsStore.getState>) => Record<string, unknown>) | undefined;
      if (!partialize) {
        throw new Error('partialize is not configured');
      }

      const state = useSettingsStore.getState();
      const partial = partialize(state);

      expect(Object.keys(partial)).toEqual(
        expect.arrayContaining([
          'readingSettings',
          'audioSettings',
          'theme',
          'offlineMode',
        ])
      );

      // Functions and loading states should NOT be persisted
      expect(partial).not.toHaveProperty('setReadingSettings');
      expect(partial).not.toHaveProperty('setAudioSettings');
      expect(partial).not.toHaveProperty('setTheme');
      expect(partial).not.toHaveProperty('setOfflineMode');
      expect(partial).not.toHaveProperty('loadSettings');
      expect(partial).not.toHaveProperty('resetSettings');
      expect(partial).not.toHaveProperty('isLoadingSettings');
    });
  });

  describe('state persistence and restoration', () => {
    it('saves readingSettings to AsyncStorage when state changes', async () => {
      useSettingsStore.setState({
        readingSettings: {
          fontFamily: 'Georgia',
          fontSize: 24,
          lineSpacing: 1.8,
          textAlign: 'left',
          backgroundColor: '#FFFFFF',
          theme: 'dark',
          margins: 20,
        },
      });

      // Wait for the persist middleware to flush
      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('settings-storage');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.readingSettings.fontSize).toBe(24);
      expect(parsed.state.readingSettings.fontFamily).toBe('Georgia');
    });

    it('saves audioSettings to AsyncStorage', async () => {
      useSettingsStore.setState({
        audioSettings: {
          playbackSpeed: 1.5,
          sleepTimerMinutes: 30,
          defaultVoice: 'custom',
          enableBackgroundPlayback: false,
        },
      });

      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('settings-storage');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.audioSettings.playbackSpeed).toBe(1.5);
      expect(parsed.state.audioSettings.sleepTimerMinutes).toBe(30);
    });

    it('saves theme preference', async () => {
      useSettingsStore.setState({ theme: 'dark' });

      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('settings-storage');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.theme).toBe('dark');
    });

    it('saves offlineMode', async () => {
      useSettingsStore.setState({ offlineMode: true });

      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('settings-storage');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.offlineMode).toBe(true);
    });
  });

  describe('setters update persisted state', () => {
    it('setTheme updates the theme in state', async () => {
      await useSettingsStore.getState().setTheme('dark');
      expect(useSettingsStore.getState().theme).toBe('dark');

      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('settings-storage');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.theme).toBe('dark');
    });

    it('setOfflineMode updates offlineMode in state', () => {
      useSettingsStore.getState().setOfflineMode(true);
      expect(useSettingsStore.getState().offlineMode).toBe(true);

      // Sync update — no need to wait for async flush for state check
    });

    it('setReadingSettings updates readingSettings in state', async () => {
      await useSettingsStore.getState().setReadingSettings({ fontSize: 20 });
      expect(useSettingsStore.getState().readingSettings.fontSize).toBe(20);

      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('settings-storage');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.readingSettings.fontSize).toBe(20);
    });

    it('setAudioSettings updates audioSettings in state', async () => {
      await useSettingsStore.getState().setAudioSettings({ playbackSpeed: 1.25 });
      expect(useSettingsStore.getState().audioSettings.playbackSpeed).toBe(1.25);

      await new Promise((r) => setTimeout(r, 0));

      const stored = mockStorage.get('settings-storage');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.audioSettings.playbackSpeed).toBe(1.25);
    });
  });

  describe('resetSettings', () => {
    it('resets settings to defaults', async () => {
      // Set non-default values
      useSettingsStore.setState({
        readingSettings: {
          fontFamily: 'Georgia',
          fontSize: 30,
          lineSpacing: 2.0,
          textAlign: 'center',
          backgroundColor: '#000000',
          theme: 'dark',
          margins: 32,
        },
        audioSettings: {
          playbackSpeed: 2.0,
          sleepTimerMinutes: 60,
          defaultVoice: 'custom',
          enableBackgroundPlayback: false,
        },
        theme: 'dark',
        offlineMode: true,
      });

      await useSettingsStore.getState().resetSettings();

      const state = useSettingsStore.getState();
      expect(state.readingSettings.fontSize).toBe(18);
      expect(state.audioSettings.playbackSpeed).toBe(1.0);
      expect(state.theme).toBe('system');
      expect(state.offlineMode).toBe(false);
    });
  });

  describe('clearStorage', () => {
    it('clears persisted state from AsyncStorage', async () => {
      useSettingsStore.setState({ theme: 'dark' });

      await new Promise((r) => setTimeout(r, 0));
      expect(mockStorage.has('settings-storage')).toBe(true);

      useSettingsStore.persist.clearStorage();
      expect(mockStorage.has('settings-storage')).toBe(false);
    });
  });

  describe('default values', () => {
    it('has correct default reading settings', () => {
      const state = useSettingsStore.getState();
      expect(state.readingSettings.fontFamily).toBe('System');
      expect(state.readingSettings.fontSize).toBe(18);
      expect(state.readingSettings.lineSpacing).toBe(1.5);
      expect(state.readingSettings.textAlign).toBe('justify');
      expect(state.readingSettings.backgroundColor).toBe('#F6F5FC');
      expect(state.readingSettings.theme).toBe('light');
      expect(state.readingSettings.margins).toBe(16);
    });

    it('has correct default audio settings', () => {
      const state = useSettingsStore.getState();
      expect(state.audioSettings.playbackSpeed).toBe(1.0);
      expect(state.audioSettings.sleepTimerMinutes).toBeNull();
      expect(state.audioSettings.defaultVoice).toBe('system');
      expect(state.audioSettings.enableBackgroundPlayback).toBe(true);
    });

    it('has correct default theme', () => {
      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
    });

    it('has correct default offlineMode', () => {
      const state = useSettingsStore.getState();
      expect(state.offlineMode).toBe(false);
    });
  });
});
