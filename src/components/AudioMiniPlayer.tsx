import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useAudioStore } from '@/stores/audioStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { SPACING, BORDER_RADIUS, COLORS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';

interface AudioMiniPlayerProps {
  bookId: string;
}

export const AudioMiniPlayer: React.FC<AudioMiniPlayerProps> = ({ bookId }) => {
  const router = useRouter();
  const { colors } = useTheme();
  const audioSettings = useSettingsStore((s) => s.audioSettings);
  
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const playbackSpeed = useAudioStore((s) => s.playbackSpeed);
  const segments = useAudioStore((s) => s.segments);
  const currentSegment = useAudioStore((s) => s.currentSegment);
  const play = useAudioStore((s) => s.play);
  const pause = useAudioStore((s) => s.pause);
  const seek = useAudioStore((s) => s.seek);
  const setPlaybackSpeed = useAudioStore((s) => s.setPlaybackSpeed);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isPlaying && duration > 0) {
      const interval = setInterval(() => {
        // Update progress from store
        setProgress(currentTime);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, duration, currentTime]);

  const hasAudio = segments.length > 0;

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
      pause();
    } else {
      play();
    }
  };

  const handleRewind = () => {
    seek(Math.max(0, currentTime - 10));
  };

  const handleForward = () => {
    seek(Math.min(duration, currentTime + 10));
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <Slider
          value={currentTime}
          minimumValue={0}
          maximumValue={duration || 1}
          onSlidingComplete={(value) => seek(value)}
          minimumTrackTintColor={COLORS.royalPurple}
          maximumTrackTintColor={colors.border}
          thumbTintColor={COLORS.royalPurple}
          style={{ flex: 1, height: 3 }}
        />
      </View>

      <View style={styles.content}>
        {/* Time info */}
        <View style={styles.timeInfo}>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {formatTime(currentTime)}
          </Text>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {formatTime(duration)}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={handleRewind} accessibilityLabel="Rewind 10 seconds">
            <Ionicons name="play-skip-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: COLORS.royalPurple }]}
            onPress={handlePlayPause}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForward} accessibilityLabel="Forward 10 seconds">
            <Ionicons name="play-skip-forward" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Speed & expand */}
        <View style={styles.rightControls}>
          <TouchableOpacity onPress={handleSpeedChange} accessibilityLabel="Change playback speed">
            <Text style={[styles.speedText, { color: colors.textSecondary }]}>
              {playbackSpeed}x
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push(`/book/${bookId}/audio`)}
            accessibilityLabel="Open full audio player"
          >
            <Ionicons name="expand" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  progressBar: {
    height: 3,
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minWidth: 80,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginLeft: 'auto',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

