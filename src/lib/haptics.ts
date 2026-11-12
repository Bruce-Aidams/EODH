import * as Haptics from 'expo-haptics';

/**
 * Haptic feedback utility that provides tactile feedback for key interactions.
 * Wraps expo-haptics with safe guards for environments where haptics are unavailable.
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection';

/**
 * Trigger a haptic feedback pattern.
 * - light: subtle tap (bookmarks, small interactions)
 * - medium: standard action (page turns, navigation)
 * - heavy: significant action (chapter changes)
 * - success: positive confirmation (bookmark added, highlight saved)
 * - error: negative feedback (action failed)
 * - selection: toggle/switch interaction
 */
export async function triggerHaptic(type: HapticType = 'light') {
  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
    }
  } catch {
    // Haptics not available on this device — silently ignore
  }
}

/**
 * React hook that provides typed haptic feedback functions.
 * Usage:
 *   const { haptic } = useHaptics();
 *   haptic('success');
 */
export function useHaptics() {
  const haptic = triggerHaptic;
  return { haptic };
}
