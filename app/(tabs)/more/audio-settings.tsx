import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSettingsStore } from '@/stores/settingsStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const SLEEP_TIMERS = [
  { label: 'Off', value: null },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

export default function AudioSettingsScreen() {
  const router = useRouter();
  const audioSettings = useSettingsStore((s) => s.audioSettings);
  const setAudioSettings = useSettingsStore((s) => s.setAudioSettings);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [sleepTimerIndex, setSleepTimerIndex] = useState(
    SLEEP_TIMERS.findIndex(t => t.value === audioSettings.sleepTimerMinutes)
  );

  const handleSleepTimerChange = (index: number) => {
    setSleepTimerIndex(index);
    setAudioSettings({ sleepTimerMinutes: SLEEP_TIMERS[index].value });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Audio Settings</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl + 20 }}>
        {/* Default Playback Speed */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Default Playback Speed</Text>
          <Text style={styles.sectionSubtitle}>
            Set the default speed for audiobook playback
          </Text>
          <View style={styles.speedRow}>
            {PLAYBACK_SPEEDS.map((speed) => (
              <TouchableOpacity
                key={speed.toString()}
                style={[
                  styles.speedButton,
                  audioSettings.playbackSpeed === speed && styles.speedButtonActive,
                ]}
                onPress={() => setAudioSettings({ playbackSpeed: speed })}
              >
                <Text style={[
                  styles.speedText,
                  audioSettings.playbackSpeed === speed && styles.speedTextActive,
                ]}>
                  {speed}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Playback Speed Slider */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Speed Preview</Text>
          <View style={styles.sliderContainer}>
            <Ionicons name="play-circle-outline" size={18} color={COLORS.gray400} />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={PLAYBACK_SPEEDS.length - 1}
              step={1}
              value={PLAYBACK_SPEEDS.indexOf(audioSettings.playbackSpeed)}
              onValueChange={(value) => {
                const index = Math.round(value);
                setAudioSettings({ playbackSpeed: PLAYBACK_SPEEDS[index] });
              }}
              minimumTrackTintColor={COLORS.royalPurple}
              maximumTrackTintColor={COLORS.gray300}
              thumbTintColor={COLORS.royalPurple}
            />
            <Ionicons name="speedometer" size={22} color={COLORS.gray600} />
          </View>
          <Text style={styles.sliderValue}>{audioSettings.playbackSpeed}x</Text>
        </View>

        {/* Sleep Timer */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sleep Timer</Text>
          <Text style={styles.sectionSubtitle}>
            Automatically stop playback after a set time
          </Text>
          <View style={styles.sleepTimerGrid}>
            {SLEEP_TIMERS.map((timer, index) => (
              <TouchableOpacity
                key={timer.label}
                style={[
                  styles.sleepTimerButton,
                  sleepTimerIndex === index && styles.sleepTimerButtonActive,
                ]}
                onPress={() => handleSleepTimerChange(index)}
              >
                <Text style={[
                  styles.sleepTimerText,
                  sleepTimerIndex === index && styles.sleepTimerTextActive,
                ]}>
                  {timer.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Background Playback */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="phone-portrait" size={22} color={COLORS.royalPurple} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Background Playback</Text>
              <Text style={styles.settingSubtitle}>
                Continue playing audio when app is in background
              </Text>
            </View>
            <Switch
              value={audioSettings.enableBackgroundPlayback}
              onValueChange={(value) => setAudioSettings({ enableBackgroundPlayback: value })}
              trackColor={{ false: COLORS.gray300, true: COLORS.royalPurple + '40' }}
              thumbColor={audioSettings.enableBackgroundPlayback ? COLORS.royalPurple : COLORS.gray400}
            />
          </View>
        </View>

        {/* Lock Screen Controls */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="lock-closed" size={22} color={COLORS.royalPurple} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Lock Screen Controls</Text>
              <Text style={styles.settingSubtitle}>
                Show playback controls on lock screen
              </Text>
            </View>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: COLORS.gray300, true: COLORS.royalPurple + '40' }}
              thumbColor={COLORS.royalPurple}
            />
          </View>
        </View>

        {/* Headphone Controls */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="headset" size={22} color={COLORS.royalPurple} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Headphone Controls</Text>
              <Text style={styles.settingSubtitle}>
                Use headphone buttons for playback control
              </Text>
            </View>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: COLORS.gray300, true: COLORS.royalPurple + '40' }}
              thumbColor={COLORS.royalPurple}
            />
          </View>
        </View>

        {/* TTS Voice */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>TTS Voice</Text>
          <Text style={styles.sectionSubtitle}>
            Voice used for text-to-speech narration
          </Text>
          <TouchableOpacity 
            style={styles.voiceButton}
            onPress={() => router.push('/(tabs)/more/voice-selection' as any)}
          >
            <Ionicons name="volume-high-outline" size={20} color={COLORS.royalPurple} />
            <Text style={styles.voiceButtonText}>Select Narrator Voice</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.deepNavy,
    textAlign: 'center',
    marginRight: 24,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  section: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: SPACING.md,
  },
  speedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  speedButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.lightBackground,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  speedButtonActive: {
    backgroundColor: COLORS.royalPurple,
    borderColor: COLORS.royalPurple,
  },
  speedText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  speedTextActive: {
    color: COLORS.white,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  sleepTimerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sleepTimerButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.lightBackground,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    minWidth: 70,
    alignItems: 'center',
  },
  sleepTimerButtonActive: {
    backgroundColor: COLORS.royalPurple,
    borderColor: COLORS.royalPurple,
  },
  sleepTimerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  sleepTimerTextActive: {
    color: COLORS.white,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.royalPurple + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  settingSubtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.lightBackground,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.sm,
  },
  voiceButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.deepNavy,
  },
});
