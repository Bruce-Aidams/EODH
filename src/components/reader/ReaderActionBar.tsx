import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '@/constants/theme';
import { Bookmark } from '@/types';
import { BookmarkManager } from '@/components/reader/BookmarkManager';

interface ReaderActionBarProps {
  bookId: string;
  currentPage: number;
  bookmarks: Bookmark[];
  themeColors: { background: string; text: string; secondaryText: string };
  colors: { primary: string };
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onHighlight: () => void;
  onNote: () => void;
  onClose: () => void;
}

/**
 * Action bar at the bottom of the reader with bookmark, highlight, and note buttons.
 */
export function ReaderActionBar({
  bookId,
  currentPage,
  bookmarks,
  themeColors,
  colors,
  isBookmarked,
  onToggleBookmark,
  onHighlight,
  onNote,
  onClose,
}: ReaderActionBarProps) {
  return (
    <View style={[styles.actionBar, { backgroundColor: themeColors.background, borderTopColor: colors.primary + '20' }]}>
      <BookmarkManager
        bookId={bookId}
        currentPage={currentPage}
        bookmarks={bookmarks}
        themeColors={themeColors}
        colors={colors}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
      />
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onHighlight}
        accessibilityLabel="Highlight text"
      >
        <Ionicons name="pencil" size={22} color={colors.primary} />
        <Text style={[styles.actionButtonText, { color: themeColors.text }]}>Highlight</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onNote}
        accessibilityLabel="Add note"
      >
        <Ionicons name="create-outline" size={22} color={colors.primary} />
        <Text style={[styles.actionButtonText, { color: themeColors.text }]}>Note</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onClose}
        accessibilityLabel="Close actions"
      >
        <Ionicons name="close" size={22} color={themeColors.secondaryText} />
        <Text style={[styles.actionButtonText, { color: themeColors.secondaryText }]}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: 1,
  } as const,
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  } as const,
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  } as const,
};
