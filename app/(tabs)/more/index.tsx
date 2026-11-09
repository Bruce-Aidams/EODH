import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { SPACING, BORDER_RADIUS, COLORS, FONT_SIZE, GRADIENTS, SHADOWS, toGradientCSS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AnimatedView } from '@/components/AnimatedView';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MoreScreen() {
  const router = useRouter();
  const { user, isAdmin, isAuthenticated, signOut } = useAuthStore();
  const { colors, isDark, themeMode, setTheme } = useTheme();
  const { offlineMode, setOfflineMode } = useSettingsStore();
  const insets = useSafeAreaInsets();

  const menuItems = useMemo(() => {
    const items = [
      ...(isAuthenticated ? [
        { icon: 'person' as const, label: 'Profile', route: '/(tabs)/more/profile' },
        { icon: 'time' as const, label: 'Reading History', route: '/(tabs)/more/history' },
        { icon: 'heart' as const, label: 'Favorites', route: '/(tabs)/more/favorites' },
        { icon: 'download' as const, label: 'Downloads', route: '/(tabs)/more/downloads' },
      ] : []),
      { icon: 'book' as const, label: 'Reading Settings', route: '/(tabs)/more/reading-settings' },
      { icon: 'headset' as const, label: 'Audio Settings', route: '/(tabs)/more/audio-settings' },
      { icon: 'help-circle' as const, label: 'Help & Support', route: '/(tabs)/more/help' },
      ...(isAdmin ? [{ icon: 'shield' as const, label: 'Admin Dashboard', route: '/admin' }] : []),
      { icon: 'information-circle' as const, label: 'About EODH', route: '/(tabs)/more/about' },
    ];
    return items;
  }, [isAuthenticated, isAdmin]);

  const handleNavigate = (route: string) => {
    if (route.startsWith('/(tabs)/more/')) {
      // Navigate within the More tab stack
      const screen = route.replace('/(tabs)/more/', '');
      router.push(`/(tabs)/more/${screen}` as any);
    } else if (route === '/admin') {
      router.push('/admin');
    }
  };

  const gradientColors = isDark ? GRADIENTS.dark : GRADIENTS.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient Header */}
      <AnimatedView fadeDelay={50} fadeDuration={400} slideDirection="down" slideDistance={20}>
        <View style={[styles.gradientHeader, { backgroundImage: toGradientCSS(gradientColors), paddingTop: insets.top + SPACING.md }]}>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
      </AnimatedView>

      {/* Sign In option for guests */}
      {!isAuthenticated && (
        <AnimatedView fadeDelay={150} fadeDuration={400} slideDirection="up" slideDistance={15}>
          <View style={styles.profileCardWrapper}>
            <View style={[styles.profileCard, { backgroundImage: toGradientCSS([colors.primary, colors.accent], 'horizontal') }]}>
              <View style={styles.avatar}>
                <Ionicons name="lock-closed" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Not Signed In</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>Sign in to sync your progress</Text>
              </View>
              <TouchableOpacity style={styles.editButton} activeOpacity={0.7} onPress={() => router.push('/auth/sign-in')}>
                <Ionicons name="log-in" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedView>
      )}

      {user && (
        <AnimatedView fadeDelay={150} fadeDuration={400} slideDirection="up" slideDistance={15}>
          <View style={styles.profileCardWrapper}>
            <View style={[styles.profileCard, { backgroundImage: toGradientCSS([colors.primary, colors.accent], 'horizontal') }]}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user.display_name || user.email?.split('@')[0] || 'User'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
            </View>
            <TouchableOpacity style={styles.editButton} activeOpacity={0.7} onPress={() => router.push('/(tabs)/more/profile')}>
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          </View>
        </AnimatedView>
      )}

      <ScrollView style={styles.menu} contentContainerStyle={[styles.menuContent, { paddingBottom: insets.bottom + SPACING.xl }]}>
        {/* App Theme Selector */}
        <View style={[styles.themeSection, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
          <Text style={[styles.themeSectionTitle, { color: colors.text }]}>App Theme</Text>
          <View style={styles.themeRow}>
            {([
              { key: 'light' as const, label: 'Light', icon: 'sunny-outline' as const },
              { key: 'dark' as const, label: 'Dark', icon: 'moon-outline' as const },
              { key: 'system' as const, label: 'System', icon: 'desktop-outline' as const },
            ]).map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.themeCard,
                  themeMode === t.key && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                ]}
                onPress={() => setTheme(t.key)}
              >
                <Ionicons name={t.icon} size={20} color={themeMode === t.key ? colors.primary : colors.textMuted} />
                <Text style={[
                  styles.themeCardLabel,
                  { color: themeMode === t.key ? colors.primary : colors.textMuted },
                  themeMode === t.key && { fontWeight: '700' },
                ]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {menuItems.map((item, index) => (
          <AnimatedView
            key={item.label}
            fadeDelay={250 + index * 60}
            fadeDuration={350}
            slideDirection="up"
            slideDistance={15}
            onPress={() => handleNavigate(item.route)}
            pressScale={0.97}
            style={[styles.menuItem, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </AnimatedView>
        ))}
      </ScrollView>

      {isAuthenticated && (
        <AnimatedView fadeDelay={400 + menuItems.length * 60} fadeDuration={400} slideDirection="up" slideDistance={15}>
          <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </AnimatedView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientHeader: {
    overflow: 'hidden',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  gradientOverlay: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileCardWrapper: {
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.cardHeavy,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
    color: 'rgba(255,255,255,0.8)',
  },
  editButton: {
    padding: SPACING.sm,
  },
  menu: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  menuContent: {
    // paddingBottom is set dynamically with safe-area inset
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    marginLeft: SPACING.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(220,38,38,0.08)',
    gap: SPACING.sm,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  themeSection: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  themeSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  themeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  themeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  themeCardLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});
