import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme/ThemeContext';
import { COLORS } from '@/constants/theme';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';

interface TabItem {
  name: string;
  label: string;
  icon: string;
  activeIcon: string;
}

const LEFT_TABS: TabItem[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'library', label: 'Library', icon: 'library-outline', activeIcon: 'library' },
];

const RIGHT_TABS: TabItem[] = [
  { name: 'notes', label: 'Notes', icon: 'bookmark-outline', activeIcon: 'bookmark' },
  { name: 'more', label: 'More', icon: 'ellipsis-horizontal-outline', activeIcon: 'ellipsis-horizontal' },
];

function CustomTabBar() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  const getActiveTab = (): string => {
    if (pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index') return 'index';
    if (pathname.includes('/library')) return 'library';
    if (pathname.includes('/audio')) return 'audio';
    if (pathname.includes('/notes')) return 'notes';
    if (pathname.includes('/more')) return 'more';
    return 'index';
  };
  const activeTab = getActiveTab();

  const tabBarBg = isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const activeColor = COLORS.royalPurple;
  const inactiveColor = isDark ? '#6B7280' : '#9CA3AF';

  const handleTabPress = (name: string) => {
    if (name === 'index') {
      router.navigate('/(tabs)' as any);
    } else {
      router.navigate(`/(tabs)/${name}` as any);
    }
  };

  const renderTabItem = (item: TabItem) => {
    const isActive = activeTab === item.name;
    const icon_name = (isActive ? item.activeIcon : item.icon) as any;

    return (
      <TouchableOpacity
        key={item.name}
        style={styles.tabItem}
        onPress={() => handleTabPress(item.name)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={icon_name}
          size={22}
          color={isActive ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: isActive ? activeColor : inactiveColor },
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.barContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.barContent, { backgroundColor: tabBarBg, borderColor: isDark ? '#374151' : '#E5E7EB' }]}>
        {/* Left tabs */}
        <View style={styles.sideGroup}>
          {LEFT_TABS.map((item) => renderTabItem(item))}
        </View>

        {/* Center FAB */}
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => handleTabPress('audio')}
          activeOpacity={0.85}
        >
          <View style={styles.fabInner}>
            <Ionicons name="add" size={28} color={COLORS.white} />
          </View>
        </TouchableOpacity>

        {/* Right tabs */}
        <View style={styles.sideGroup}>
          {RIGHT_TABS.map((item) => renderTabItem(item))}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: 'none',
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="library" options={{ title: 'Library' }} />
        <Tabs.Screen name="audio" options={{ title: 'Audio' }} />
        <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
        <Tabs.Screen name="more" options={{ title: 'More' }} />
      </Tabs>
      <CustomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  barContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  barContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '92%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  sideGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 18,
    minWidth: 56,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  fabButton: {
    position: 'relative',
    top: -20,
    marginHorizontal: 12,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.royalPurple,
    shadowColor: COLORS.royalPurple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
