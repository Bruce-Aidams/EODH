import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS, FONT_SIZE } from '@/constants/theme';
import { Highlight } from '@/types';
import { TextHighlighter } from '@/components/reader/TextHighlighter';

interface ReaderHighlightsModalProps {
  visible: boolean;
  highlights: Highlight[];
  themeColors: { background: string; text: string; secondaryText: string };
  colors: { primary: string; border: string };
  onClose: () => void;
  onRemoveHighlight: (highlightId: string) => void;
  onAddNoteToHighlight: (highlight: Highlight) => void;
}

/**
 * Highlights modal showing all highlights for the current book.
 */
export function ReaderHighlightsModal({
  visible,
  highlights,
  themeColors,
  colors,
  onClose,
  onRemoveHighlight,
  onAddNoteToHighlight,
}: ReaderHighlightsModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              Highlights ({highlights.length})
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close highlights">
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: '70%' }}>
            {highlights.length === 0 ? (
              <View style={{ paddingVertical: SPACING.xl, alignItems: 'center' }}>
                <Ionicons name="pencil-outline" size={48} color={themeColors.secondaryText} />
                <Text style={[{ color: themeColors.secondaryText, marginTop: SPACING.md, fontSize: 16 }]}>
                  No highlights yet
                </Text>
                <Text style={[{ color: themeColors.secondaryText, marginTop: SPACING.xs, fontSize: 14 }]}>
                  Use the Highlight button to mark passages
                </Text>
              </View>
            ) : (
              <TextHighlighter
                highlights={highlights}
                themeColors={themeColors}
                colors={colors}
                onRemoveHighlight={onRemoveHighlight}
                onAddNoteToHighlight={onAddNoteToHighlight}
              />
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
};
