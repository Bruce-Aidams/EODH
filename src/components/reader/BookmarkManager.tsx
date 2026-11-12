import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS } from '@/constants/theme';
import { Bookmark } from '@/types';

interface BookmarkManagerProps {
  bookId: string;
  currentPage: number;
  bookmarks: Bookmark[];
  themeColors: {
    background: string;
    text: string;
    secondaryText: string;
  };
  colors: {
    primary: string;
  };
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}

export const BookmarkManager: React.FC<BookmarkManagerProps> = ({
  bookId,
  currentPage,
  bookmarks,
  themeColors,
  colors,
  isBookmarked,
  onToggleBookmark,
}) => {
  const bookBookmarks = bookmarks.filter(b => b.book_id === bookId);

  return (
    <View>
      <TouchableOpacity
        style={[styles.bookmarkButton, isBookmarked && styles.bookmarkButtonActive]}
        onPress={onToggleBookmark}
        accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
      >
        <Ionicons
          name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
          size={22}
          color={isBookmarked ? colors.primary : themeColors.text}
        />
        <Text style={[styles.bookmarkButtonText, { color: isBookmarked ? colors.primary : themeColors.text }]}>
          {isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bookmarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS.md,
  },
  bookmarkButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  bookmarkButtonText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});

