import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedView } from '@/components/AnimatedView';
import { BORDER_RADIUS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ReaderHeaderProps {
  bookTitle: string;
  currentPage: number;
  totalPages: number;
  estimatedReadingTime: string;
  themeColors: {
    background: string;
    text: string;
    secondaryText: string;
  };
  colors: {
    primary: string;
    border: string;
  };
  showHeader: boolean;
  chaptersCount?: number;
  isBookmarked?: boolean;
  onBack: () => void;
  onToggleHeader: () => void;
  onSearch: () => void;
  onTableOfContents: () => void;
  onActions: () => void;
  onOverflowMenu: () => void;
  onSettings: () => void;
  onToggleBookmark?: () => void;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  bookTitle,
  currentPage,
  totalPages,
  estimatedReadingTime,
  themeColors,
  colors,
  showHeader,
  chaptersCount = 0,
  isBookmarked = false,
  onBack,
  onToggleHeader,
  onSearch,
  onTableOfContents,
  onActions,
  onOverflowMenu,
  onSettings,
  onToggleBookmark,
}) => {
  const insets = useSafeAreaInsets();
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerAutoHidden, setHeaderAutoHidden] = useState(false);

  // Auto-hide header after 3 seconds of inactivity
  const resetAutoHideTimer = () => {
    if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
    setHeaderAutoHidden(false);
    headerTimerRef.current = setTimeout(() => {
      setHeaderAutoHidden(true);
      onToggleHeader();
    }, 3000);
  };

  useEffect(() => {
    if (showHeader) {
      resetAutoHideTimer();
    }
    return () => {
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
    };
  }, [showHeader]);

  // Expose timer reset to parent via ref (for scroll events)
  useEffect(() => {
    // Parent will handle scroll-based auto-hide
  }, []);

  // Determine if dark theme for blur tint color
  const isDark = themeColors.background === '#030712' || themeColors.background === '#111827';

  return (
    showHeader && (
      <AnimatedView fadeDelay={50} fadeDuration={300} slideDirection="down" slideDistance={20}>
        <BlurView
          intensity={isDark ? 60 : 80}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: insets.top + 8,
            },
          ]}
        >
          <TouchableOpacity onPress={onBack} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
              {bookTitle || 'Reader'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.secondaryText }]}>
              {currentPage} / {totalPages} · {estimatedReadingTime}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {onToggleBookmark && (
              <TouchableOpacity onPress={onToggleBookmark} accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}>
                <Ionicons
                  name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={isBookmarked ? colors.primary : themeColors.text}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onSearch} accessibilityLabel="Search in book">
              <Ionicons name="search" size={22} color={themeColors.text} />
            </TouchableOpacity>
            {chaptersCount > 1 && (
              <TouchableOpacity onPress={onTableOfContents} accessibilityLabel="Table of contents">
                <Ionicons name="list" size={22} color={themeColors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onOverflowMenu} accessibilityLabel="More options">
              <Ionicons name="ellipsis-vertical" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </AnimatedView>
    )
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});

