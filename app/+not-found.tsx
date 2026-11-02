import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Link } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.subtitle}>This page doesn't exist</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>Go Home</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
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
    color: COLORS.royalPurple,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.gray500,
    marginTop: SPACING.md,
  },
  link: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.royalPurple,
    borderRadius: BORDER_RADIUS.md,
  },
  linkText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
