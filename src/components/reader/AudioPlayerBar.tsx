import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioStore } from '@/stores/audioStore';
import { BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AudioProgressSlider } from './AudioProgressSlider';

interface AudioPlayerBarProps {
  bookId: string;
  onChapterPlaylist: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onSpeedChange?: (speed: number) => void;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  playbackSpeed?: number;
  playbackRate?: number;
  segmentsCount?: number;
  themeColors?: {
    background: string;
    text: string;
    secondaryText: string;
  };
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  bookId,
  onChapterPlaylist,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  isPlaying: propIsPlaying,
  currentTime: propTime,
  duration: propDuration,
  playbackSpeed: propSpeed,
  playbackRate: propRate,
  segmentsCount,
  themeColors: propThemeColors,
}) => {
  const { colors } = useTheme();
  const storeIsPlaying = useAudioStore((s) => s.isPlaying);
  const storeTime = useAudioStore((s) => s.currentTime);
  const storeDuration = useAudioStore((s) => s.duration);
  const storeSpeed = useAudioStore((s) => s.playbackSpeed);
  const segments = useAudioStore((s) => s.segments);

  // Use props if provided (from reader screen), otherwise fall back to store
  const isPlaying = propIsPlaying ?? storeIsPlaying;
  const currentTime = propTime ?? storeTime;
  const duration = propDuration ?? storeDuration;
  const playbackSpeed = propRate ?? propSpeed ?? storeSpeed;
  const hasAudio = (segmentsCount ?? segments.length) > 0;

  if (!hasAudio) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  };

  const handleRewind = () => {
    const newTime = Math.max(0, currentTime - 10);
    onSeek?.(newTime);
  };

  const handleForward = () => {
    const newTime = Math.min(duration, currentTime + 10);
    onSeek?.(newTime);
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    onSpeedChange?.(nextSpeed);
  };

  const themeColors = {
    secondaryText: propThemeColors?.secondaryText ?? colors.textMuted,
    background: propThemeColors?.background ?? colors.surface,
    text: propThemeColors?.text ?? colors.text,
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background, borderTopColor: colors.border }]}>
      {/* Progress slider */}
      <AudioProgressSlider
        currentTime={currentTime}
        duration={duration}
        themeColors={themeColors}
        accentColor={colors.primary}
        onSeek={(value) => onSeek?.(value)}
      />

      <View style={styles.controls}>
        {/* Playback speed */}
        <TouchableOpacity onPress={handleSpeedChange} accessibilityLabel="Change playback speed">
          <Text style={[styles.speedText, { color: colors.primary }]}>
            {playbackSpeed}x
          </Text>
        </TouchableOpacity>

        {/* Rewind 10s */}
        <TouchableOpacity onPress={handleRewind} accessibilityLabel="Rewind 10 seconds">
          <Ionicons name="play-skip-back" size={24} color={themeColors.text} />
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: colors.primary }]}
          onPress={handlePlayPause}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {/* Forward 10s */}
        <TouchableOpacity onPress={handleForward} accessibilityLabel="Forward 10 seconds">
          <Ionicons name="play-skip-forward" size={24} color={themeColors.text} />
        </TouchableOpacity>

        {/* Chapter playlist */}
        <TouchableOpacity onPress={onChapterPlaylist} accessibilityLabel="Chapter list">
          <Ionicons name="list" size={22} color={themeColors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});

