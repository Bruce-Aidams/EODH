import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { COLORS } from '@/constants/theme';

interface AudioProgressSliderProps {
  currentTime: number;
  duration: number;
  themeColors: {
    secondaryText: string;
  };
  accentColor?: string;
  onSeek: (value: number) => void;
}

export const AudioProgressSlider: React.FC<AudioProgressSliderProps> = ({
  currentTime,
  duration,
  themeColors,
  accentColor,
  onSeek,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const trackColor = accentColor ?? COLORS.royalPurple;

  return (
    <View style={styles.container}>
      <Text style={[styles.timeText, { color: themeColors.secondaryText }]}>
        {formatTime(currentTime)}
      </Text>
      <Slider
        value={currentTime}
        minimumValue={0}
        maximumValue={duration || 1}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={trackColor}
        maximumTrackTintColor={themeColors.secondaryText + '30'}
        thumbTintColor={trackColor}
        style={styles.slider}
      />
      <Text style={[styles.timeText, { color: themeColors.secondaryText }]}>
        {formatTime(duration)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  slider: {
    flex: 1,
    height: 3,
  },
  timeText: {
    fontSize: 11,
    minWidth: 35,
  },
});

