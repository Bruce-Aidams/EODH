import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { Link } from 'expo-router';
import { SPACING, BORDER_RADIUS } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme/ThemeContext';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.primary }]}>404</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>This page doesn't exist</Text>
        <Link href="/(tabs)" style={[styles.link, { backgroundColor: colors.primary }]}>
          <Text style={styles.linkText}>Go Home</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  title: {
    fontSize: 72,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    marginTop: SPACING.md,
  },
  link: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
