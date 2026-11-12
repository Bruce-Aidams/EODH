import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS, FONT_SIZE } from '@/constants/theme';
import { SearchResult } from '@/lib/reader/useReaderActions';

interface ReaderSearchModalProps {
  visible: boolean;
  themeColors: { background: string; text: string; secondaryText: string };
  colors: { primary: string; border: string };
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: SearchResult[];
  currentSearchIndex: number;
  isSearching: boolean;
  onClose: () => void;
  onSearch: () => void;
  onNavigateToResult: (index: number) => void;
}

/**
 * Search modal for in-book search with result navigation.
 */
export function ReaderSearchModal({
  visible,
  themeColors,
  colors,
  searchQuery,
  setSearchQuery,
  searchResults,
  currentSearchIndex,
  isSearching,
  onClose,
  onSearch,
  onNavigateToResult,
}: ReaderSearchModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Search in Book</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
            <TextInput
              style={[styles.searchInput, { color: themeColors.text, backgroundColor: themeColors.background, borderColor: colors.border }]}
              placeholder="Search..."
              placeholderTextColor={themeColors.secondaryText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={onSearch}
              autoFocus={true}
              accessibilityLabel="Search text input"
            />
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={onSearch}
              disabled={isSearching || searchQuery.trim().length < 2}
            >
              <Ionicons name="search" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {isSearching ? (
            <View style={styles.loadingChapters}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingChaptersText, { color: themeColors.secondaryText }]}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <>
              <Text style={[styles.searchResultCount, { color: themeColors.secondaryText }]}>
                {searchResults.length} matches found
              </Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {searchResults.map((result, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.searchResultItem,
                      { borderBottomColor: colors.border },
                      index === currentSearchIndex && { backgroundColor: colors.primary + '20' },
                    ]}
                    onPress={() => onNavigateToResult(index)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs }}>
                      <Ionicons name="bookmark" size={16} color={colors.primary} />
                      <Text style={[styles.searchResultChapter, { color: themeColors.text }]}>
                        {result.chapterTitle}
                      </Text>
                    </View>
                    <Text style={[styles.searchResultSnippet, { color: themeColors.secondaryText }]}>
                      {result.snippet.replace(/<[^>]+>/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: SPACING.md, marginTop: SPACING.md }}>
                <TouchableOpacity
                  style={[styles.searchNavButton, { backgroundColor: themeColors.background, borderColor: colors.border }]}
                  onPress={() => onNavigateToResult(currentSearchIndex - 1)}
                  disabled={currentSearchIndex === 0}
                >
                  <Ionicons name="arrow-up" size={20} color={currentSearchIndex === 0 ? themeColors.secondaryText : colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.searchNavText, { color: themeColors.text }]}>
                  {currentSearchIndex + 1} / {searchResults.length}
                </Text>
                <TouchableOpacity
                  style={[styles.searchNavButton, { backgroundColor: themeColors.background, borderColor: colors.border }]}
                  onPress={() => onNavigateToResult(currentSearchIndex + 1)}
                  disabled={currentSearchIndex >= searchResults.length - 1}
                >
                  <Ionicons name="arrow-down" size={20} color={currentSearchIndex >= searchResults.length - 1 ? themeColors.secondaryText : colors.primary} />
                </TouchableOpacity>
              </View>
            </>
          ) : searchQuery.trim().length >= 2 ? (
            <View style={styles.emptySearch}>
              <Ionicons name="search" size={48} color={themeColors.secondaryText} />
              <Text style={[styles.emptySearchText, { color: themeColors.secondaryText }]}>No matches found</Text>
              <Text style={[styles.emptySearchSubText, { color: themeColors.secondaryText }]}>
                Try a different search term
              </Text>
            </View>
          ) : null}
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
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
  } as const,
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  } as const,
  searchResultCount: {
    fontSize: 13,
    marginBottom: SPACING.sm,
  } as const,
  searchResultItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
  } as const,
  searchResultChapter: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  } as const,
  searchResultSnippet: {
    fontSize: 13,
    marginTop: SPACING.xs,
    lineHeight: 18,
  } as const,
  searchNavButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as const,
  searchNavText: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'center',
  } as const,
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  } as const,
  emptySearchText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.md,
  } as const,
  emptySearchSubText: {
    fontSize: 14,
    marginTop: SPACING.xs,
  } as const,
  loadingChapters: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  } as const,
  loadingChaptersText: {
    fontSize: 14,
    marginTop: SPACING.md,
  } as const,
};
