import React, { useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TapZonesProps {
  /** Called when the left 30% of the screen is tapped */
  onPrevious: () => void;
  /** Called when the right 30% of the screen is tapped */
  onNext: () => void;
  /** Called when the center 40% of the screen is tapped */
  onToggleUI: () => void;
  /** Disable tap zones (e.g. when a modal is open) */
  disabled?: boolean;
  /** Children content rendered behind the tap zones */
  children: React.ReactNode;
}

/**
 * TapZones overlays three invisible touch areas on the reader content:
 * - Left 30% → previous chapter/page
 * - Center 40% → toggle header/footer visibility
 * - Right 30% → next chapter/page
 *
 * This matches the interaction pattern of Apple Books, Kindle, and other
 * modern reading apps for frictionless navigation.
 */
export const TapZones: React.FC<TapZonesProps> = ({
  onPrevious,
  onNext,
  onToggleUI,
  disabled = false,
  children,
}) => {
  const handlePrevious = useCallback(() => {
    if (!disabled) onPrevious();
  }, [disabled, onPrevious]);

  const handleToggleUI = useCallback(() => {
    if (!disabled) onToggleUI();
  }, [disabled, onToggleUI]);

  const handleNext = useCallback(() => {
    if (!disabled) onNext();
  }, [disabled, onNext]);

  return (
    <View style={styles.container}>
      {/* Content rendered behind tap zones */}
      {children}

      {/* Overlay tap zones */}
      <View style={styles.overlay}>
        <TouchableOpacity
          style={[styles.zone, { width: SCREEN_WIDTH * 0.3 }]}
          onPress={handlePrevious}
          activeOpacity={1}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        />
        <TouchableOpacity
          style={[styles.zone, { width: SCREEN_WIDTH * 0.4 }]}
          onPress={handleToggleUI}
          activeOpacity={1}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        />
        <TouchableOpacity
          style={[styles.zone, { width: SCREEN_WIDTH * 0.3 }]}
          onPress={handleNext}
          activeOpacity={1}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    pointerEvents: 'none',
  },
  zone: {
    height: '100%',
    pointerEvents: 'auto',
  },
});
