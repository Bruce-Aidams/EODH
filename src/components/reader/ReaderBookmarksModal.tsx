import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS, FONT_SIZE } from '@/constants/theme';
import { Bookmark } from '@/types';

interface ReaderBookmarksModalProps {
  visible: boolean;
  bookmarks: Bookmark[];
  bookId: string;
  themeColors: { background: string; text: string; secondaryText: string };
  colors: { primary: string; border: string };
  onClose: () => void;
  onRemoveBookmark: (bookmarkId: string) => void;
}

/**
 * Bookmarks modal showing all bookmarks for the current book.
 */
export function ReaderBookmarksModal({
  visible,
  bookmarks,
  bookId,
  themeColors,
  colors,
  onClose,
  onRemoveBookmark,
}: ReaderBookmarksModalProps) {
  const bookBookmarks = bookmarks.filter(b => b.book_id === bookId);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              Bookmarks ({bookBookmarks.length})
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close bookmarks">
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: '70%' }}>
            {bookBookmarks.length === 0 ? (
              <View style={{ paddingVertical: SPACING.xl, alignItems: 'center' }}>
                <Ionicons name="bookmark-outline" size={48} color={themeColors.secondaryText} />
                <Text style={[{ color: themeColors.secondaryText, marginTop: SPACING.md, fontSize: 16 }]}>
                  No bookmarks yet
                </Text>
                <Text style={[{ color: themeColors.secondaryText, marginTop: SPACING.xs, fontSize: 14 }]}>
                  Tap the bookmark icon to save your place
                </Text>
              </View>
            ) : (
              bookBookmarks.map((bookmark) => (
                <View
                  key={bookmark.id}
                  style={[
                    styles.bookmarkItem,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookmarkPageText, { color: colors.primary }]}>
                      Page {bookmark.page_number}
                    </Text>
                    {bookmark.text_excerpt && (
                      <Text
                        style={[styles.bookmarkExcerpt, { color: themeColors.text }]}
                        numberOfLines={2}
                      >
                        {bookmark.text_excerpt}
                      </Text>
                    )}
                    {bookmark.note && (
                      <Text
                        style={[styles.bookmarkNote, { color: themeColors.secondaryText }]}
                        numberOfLines={2}
                      >
                        📝 {bookmark.note}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => onRemoveBookmark(bookmark.id)}
                    accessibilityLabel="Remove bookmark"
                    style={{ padding: SPACING.sm }}
                  >
                    <Ionicons name="trash-outline" size={20} color={themeColors.secondaryText} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = {
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  } as const,
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '80%',
  } as const,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  } as const,
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  } as const,
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  } as const,
  bookmarkPageText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  } as const,
  bookmarkExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  } as const,
  bookmarkNote: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  } as const,
};
