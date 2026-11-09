import { getThemeColors, toGradientCSS, ThemeType } from '@/constants/theme';

describe('Theme utilities', () => {
  describe('getThemeColors', () => {
    it('returns light theme when user preference is light', () => {
      const result = getThemeColors('light', null);
      expect(result.background).toBe('#F6F5FC');
      expect(result.text).toBe('#080B2E');
      expect(result.primary).toBe('#5415E8');
    });

    it('returns dark theme when user preference is dark', () => {
      const result = getThemeColors('dark', null);
      expect(result.background).toBe('#111827');
      expect(result.text).toBe('#FFFFFF');
      expect(result.primary).toBe('#812BFF');
    });

    it('returns dark theme when system is dark and user preference is system', () => {
      const result = getThemeColors('system', 'dark');
      expect(result.background).toBe('#111827');
      expect(result.statusBar).toBe('light-content');
    });

    it('returns light theme when system is light and user preference is system', () => {
      const result = getThemeColors('system', 'light');
      expect(result.background).toBe('#F6F5FC');
      expect(result.statusBar).toBe('dark-content');
    });

    it('returns light theme when system is null and user preference is system', () => {
      const result = getThemeColors('system', null);
      expect(result.background).toBe('#F6F5FC');
    });
  });

  describe('toGradientCSS', () => {
    it('creates a vertical gradient by default', () => {
      const result = toGradientCSS(['#FF0000', '#00FF00']);
      expect(result).toBe('linear-gradient(180deg, #FF0000, #00FF00)');
    });

    it('creates a horizontal gradient', () => {
      const result = toGradientCSS(['#FF0000', '#00FF00'], 'horizontal');
      expect(result).toBe('linear-gradient(90deg, #FF0000, #00FF00)');
    });

    it('creates a diagonal gradient', () => {
      const result = toGradientCSS(['#FF0000', '#00FF00'], 'diagonal');
      expect(result).toBe('linear-gradient(135deg, #FF0000, #00FF00)');
    });

    it('handles more than two colors', () => {
      const result = toGradientCSS(['#FF0000', '#00FF00', '#0000FF'], 'vertical');
      expect(result).toBe('linear-gradient(180deg, #FF0000, #00FF00, #0000FF)');
    });
  });
});
