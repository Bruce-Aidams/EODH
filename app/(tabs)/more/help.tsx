import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

const FAQ_ITEMS = [
  {
    question: 'How do I read a book?',
    answer: 'Open the Library tab, find a book, and tap the "Read" button. You can customize font size, theme, and spacing in Reading Settings.',
  },
  {
    question: 'How do I listen to audiobooks?',
    answer: 'Open a book and tap "Listen" to start the audiobook player. If no pre-recorded audio is available, the app can generate narration using text-to-speech.',
  },
  {
    question: 'What is Read Along?',
    answer: 'Read Along synchronizes audio playback with text highlighting. As the narration plays, the current sentence is highlighted and the reader auto-scrolls to keep it visible.',
  },
  {
    question: 'How do I download books for offline use?',
    answer: 'Open a book detail page and tap the download icon. Downloaded books are available in the Downloads section under the More tab.',
  },
  {
    question: 'How do I add bookmarks and notes?',
    answer: 'While reading, long-press on text to highlight it, then add a note or bookmark. All bookmarks and notes are available in the Notes tab.',
  },
  {
    question: 'Can I adjust playback speed?',
    answer: 'Yes! Open Audio Settings in the More tab to set your default playback speed from 0.5x to 2.0x.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const openEmail = () => {
    Linking.openURL('mailto:support@eodh.app?subject=EODH Support Request');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Support</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl + 20 }}>
        {/* Contact Card */}
        <TouchableOpacity style={styles.contactCard} onPress={openEmail}>
          <View style={styles.contactIcon}>
            <Ionicons name="mail" size={24} color={COLORS.white} />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Contact Support</Text>
            <Text style={styles.contactSubtitle}>
              Send us an email and we'll get back to you
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
        </TouchableOpacity>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
          
          {FAQ_ITEMS.map((item, index) => (
            <View key={index} style={styles.faqCard}>
              <View style={styles.faqQuestion}>
                <Ionicons name="help-circle-outline" size={18} color={COLORS.royalPurple} />
                <Text style={styles.faqQuestionText}>{item.question}</Text>
              </View>
              <Text style={styles.faqAnswer}>{item.answer}</Text>
            </View>
          ))}
        </View>

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Quick Tips</Text>
          
          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="book" size={18} color={COLORS.gold} />
            </View>
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Reading:</Text> Long-press text to highlight and add notes.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="musical-notes" size={18} color={COLORS.gold} />
            </View>
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Listening:</Text> Use the sleep timer to stop playback automatically.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="sync" size={18} color={COLORS.gold} />
            </View>
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Sync:</Text> Read Along highlights text as audio plays.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="cloud-download" size={18} color={COLORS.gold} />
            </View>
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Offline:</Text> Download books for reading without internet.
            </Text>
          </View>
        </View>

        {/* Troubleshooting */}
        <View style={styles.troubleSection}>
          <Text style={styles.troubleTitle}>Troubleshooting</Text>
          
          <TouchableOpacity style={styles.troubleItem}>
            <Ionicons name="wifi-outline" size={18} color={COLORS.gray600} />
            <Text style={styles.troubleText}>App not loading books?</Text>
            <Text style={styles.troubleHint}>Check your internet connection</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.troubleItem}>
            <Ionicons name="volume-mute-outline" size={18} color={COLORS.gray600} />
            <Text style={styles.troubleText}>No audio playing?</Text>
            <Text style={styles.troubleHint}>Check device volume and audio settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.troubleItem}>
            <Ionicons name="refresh-outline" size={18} color={COLORS.gray600} />
            <Text style={styles.troubleText}>Sync not working?</Text>
            <Text style={styles.troubleHint}>Try restarting the reader</Text>
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
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.royalPurple,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  contactSubtitle: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: 2,
  },
  faqSection: {
    marginBottom: SPACING.md,
  },
  faqTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.deepNavy,
    marginBottom: SPACING.md,
  },
  faqCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.deepNavy,
    flex: 1,
  },
  faqAnswer: {
    fontSize: 13,
    color: COLORS.gray600,
    lineHeight: 18,
    paddingLeft: 26,
  },
  tipsSection: {
    marginBottom: SPACING.md,
  },
  tipsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.deepNavy,
    marginBottom: SPACING.md,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray600,
    lineHeight: 18,
  },
  tipBold: {
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  troubleSection: {
    marginBottom: SPACING.xl,
  },
  troubleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.deepNavy,
    marginBottom: SPACING.md,
  },
  troubleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  troubleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.deepNavy,
  },
  troubleHint: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: 2,
    paddingLeft: 22,
  },
});
