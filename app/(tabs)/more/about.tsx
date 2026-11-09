import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>About EODH</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl + 20 }}>
        {/* App Logo & Name */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Ionicons name="book" size={48} color={COLORS.white} />
            </View>
          </View>
          <Text style={styles.appName}>EODH</Text>
          <Text style={styles.appFullName}>Exposition Of Damnable Heresies</Text>
          <Text style={styles.tagline}>Read. Listen. Learn.</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About This App</Text>
          <Text style={styles.description}>
            EODH is a premium digital ebook reader and audiobook platform designed for reading, 
            listening, studying, and understanding digital books. Experience a unified reading 
            journey where text and audio come together through our synchronized Read Along feature.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Features</Text>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="book" size={18} color={COLORS.royalPurple} />
            </View>
            <Text style={styles.featureText}>Advanced PDF & Markdown Reader</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="musical-notes" size={18} color={COLORS.royalPurple} />
            </View>
            <Text style={styles.featureText}>Audiobook Player with TTS</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="sync" size={18} color={COLORS.royalPurple} />
            </View>
            <Text style={styles.featureText}>Synchronized Read Along</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="bookmark" size={18} color={COLORS.royalPurple} />
            </View>
            <Text style={styles.featureText}>Bookmarks, Highlights & Notes</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="cloud-download" size={18} color={COLORS.royalPurple} />
            </View>
            <Text style={styles.featureText}>Offline Reading & Listening</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="color-palette" size={18} color={COLORS.royalPurple} />
            </View>
            <Text style={styles.featureText}>Customizable Reading Experience</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="moon" size={18} color={COLORS.royalPurple} />
            </View>
            <Text style={styles.featureText}>Dark & Light Themes</Text>
          </View>
        </View>

        {/* Technology */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Built With</Text>
          <View style={styles.techGrid}>
            {[
              'React Native', 'Expo', 'TypeScript', 'Supabase',
              'Zustand', 'expo-audio', 'expo-speech',
            ].map((tech) => (
              <View key={tech} style={styles.techBadge}>
                <Text style={styles.techText}>{tech}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Links */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Links</Text>
          
          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => openLink('mailto:support@eodh.app')}
          >
            <Ionicons name="mail-outline" size={18} color={COLORS.gray600} />
            <Text style={styles.linkText}>support@eodh.app</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.gray400} />
          </TouchableOpacity>
        </View>

        {/* License */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>License</Text>
          <Text style={styles.licenseText}>
            EODH is open source software licensed under the MIT License.
          </Text>
          <Text style={styles.copyright}>
            © {new Date().getFullYear()} EODH. All rights reserved.
          </Text>
        </View>

        {/* Made with love */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Made with <Ionicons name="heart" size={14} color={COLORS.error} /> for readers everywhere
          </Text>
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
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  logoContainer: {
    marginBottom: SPACING.md,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.royalPurple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.royalPurple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.deepNavy,
    letterSpacing: 2,
  },
  appFullName: {
    fontSize: 14,
    color: COLORS.gray500,
    marginTop: 4,
    fontStyle: 'italic',
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.royalPurple,
    marginTop: SPACING.sm,
  },
  version: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.deepNavy,
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: 14,
    color: COLORS.gray600,
    lineHeight: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.royalPurple + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.deepNavy,
    flex: 1,
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  techBadge: {
    backgroundColor: COLORS.lightBackground,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  techText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.royalPurple,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.royalPurple,
  },
  licenseText: {
    fontSize: 13,
    color: COLORS.gray600,
    lineHeight: 18,
  },
  copyright: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  footerText: {
    fontSize: 13,
    color: COLORS.gray400,
  },
});
