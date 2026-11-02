import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function MoreScreen() {
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuthStore();

  const menuItems = [
    { icon: 'person' as const, label: 'Profile', route: '/(tabs)/more/profile' },
    { icon: 'time' as const, label: 'Reading History', route: '/(tabs)/more/history' },
    { icon: 'heart' as const, label: 'Favorites', route: '/(tabs)/more/favorites' },
    { icon: 'download' as const, label: 'Downloads', route: '/(tabs)/more/downloads' },
    { icon: 'book' as const, label: 'Reading Settings', route: '/(tabs)/more/reading-settings' },
    { icon: 'headset' as const, label: 'Audio Settings', route: '/(tabs)/more/audio-settings' },
    { icon: 'help-circle' as const, label: 'Help & Support', route: '/(tabs)/more/help' },
    { icon: 'information-circle' as const, label: 'About EODH', route: '/(tabs)/more/about' },
  ];

  if (isAdmin) {
    menuItems.splice(7, 0, { icon: 'shield-checkmark' as const, label: 'Admin Dashboard', route: '/admin' });
  }

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      {user && (
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={COLORS.white} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user.display_name || user.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.menu}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuItem}
            onPress={() => handleNavigate(item.route)}
          >
            <Ionicons name={item.icon} size={22} color={COLORS.gray600} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
        <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.deepNavy,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.royalPurple,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: 2,
  },
  menu: {
    paddingHorizontal: SPACING.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.deepNavy,
    marginLeft: SPACING.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
  },
});
