import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { SPACING, BORDER_RADIUS, COLORS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AnimatedView } from '@/components/AnimatedView';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MoreScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors, isDark, themeMode, setTheme } = useTheme();
  const offlineMode = useSettingsStore((s) => s.offlineMode);
  const setOfflineMode = useSettingsStore((s) => s.setOfflineMode);
  const insets = useSafeAreaInsets();

  const menuItems = useMemo(() => {
    const items = [
      ...(isAuthenticated ? [
        { icon: 'person' as const, label: 'Profile', route: '/(tabs)/more/profile' },
        { icon: 'time' as const, label: 'Reading History', route: '/(tabs)/more/history' },
        { icon: 'bar-chart' as const, label: 'Reading Analytics', route: '/(tabs)/more/analytics' },
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Clean Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingBottom: 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surfaceVariant }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Sign In option for guests */}
      {!isAuthenticated && (
        <AnimatedView fadeDelay={150} fadeDuration={400} slideDirection="up" slideDistance={15}>
          <View style={styles.profileCardWrapper}>
            <View style={[styles.profileCard, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.card }]}>
                <Ionicons name="lock-closed" size={22} color={colors.textMuted} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>Not Signed In</Text>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>Sign in to sync your progress</Text>
              </View>
              <TouchableOpacity style={styles.editButton} activeOpacity={0.7} onPress={() => router.push('/auth/sign-in')}>
                <Ionicons name="log-in" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedView>
      )}

      {user && (
        <AnimatedView fadeDelay={150} fadeDuration={400} slideDirection="up" slideDistance={15}>
          <View style={styles.profileCardWrapper}>
            <View style={[styles.profileCard, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.card }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(user.display_name || user.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {user.display_name || user.email?.split('@')[0] || 'User'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>{user.email}</Text>
            </View>
            <TouchableOpacity style={styles.editButton} activeOpacity={0.7} onPress={() => router.push('/(tabs)/more/profile')}>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          </View>
        </AnimatedView>
      )}

      <ScrollView style={styles.menu} contentContainerStyle={[styles.menuContent, { paddingBottom: insets.bottom + 24 }]}>
        {/* App Theme Selector */}
        <View style={[styles.themeSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.themeSectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
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
                  { borderColor: colors.border },
                  themeMode === t.key && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
                ]}
                onPress={() => setTheme(t.key)}
              >
                <Ionicons name={t.icon} size={16} color={themeMode === t.key ? colors.primary : colors.textMuted} />
                <Text style={[
                  styles.themeCardLabel,
                  { color: themeMode === t.key ? colors.primary : colors.textMuted },
                  themeMode === t.key && { fontWeight: '600' },
                ]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Menu</Text>
        <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {menuItems.map((item, index) => (
            <AnimatedView
              key={item.label}
              fadeDelay={250 + index * 40}
              fadeDuration={300}
              slideDirection="up"
              slideDistance={10}
              onPress={() => handleNavigate(item.route)}
              pressScale={0.98}
              style={styles.menuItem}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={item.icon} size={18} color={colors.textSecondary} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </AnimatedView>
          ))}
        </View>
      </ScrollView>

      {isAuthenticated && (
        <AnimatedView fadeDelay={400 + menuItems.length * 40} fadeDuration={400} slideDirection="up" slideDistance={10}>
          <TouchableOpacity style={[styles.signOutButton, { borderColor: colors.border }]} onPress={() => signOut()} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCardWrapper: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 14,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 1,
  },
  editButton: {
    padding: 4,
  },
  menu: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  menuContent: {
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  menuGroup: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 12,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '500',
  },
  themeSection: {
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  themeSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  themeCardLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});
