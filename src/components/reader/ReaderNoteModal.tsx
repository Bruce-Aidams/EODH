import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS, FONT_SIZE } from '@/constants/theme';
import { Highlight } from '@/types';

interface ReaderNoteModalProps {
  visible: boolean;
  themeColors: { background: string; text: string; secondaryText: string };
  colors: { primary: string };
  selectedHighlight: Highlight | null;
  noteText: string;
  setNoteText: (text: string) => void;
  highlightNoteText: string;
  setHighlightNoteText: (text: string) => void;
  highlightColor: string;
  setHighlightColor: (color: string) => void;
  onClose: () => void;
  onSaveNote: () => void;
  onSaveHighlight: (text: string) => void;
  onSaveHighlightNote: () => void;
}

/**
 * Note modal for adding notes and highlights with color picker.
 */
export function ReaderNoteModal({
  visible,
  themeColors,
  colors,
  selectedHighlight,
  noteText,
  setNoteText,
  highlightNoteText,
  setHighlightNoteText,
  highlightColor,
  setHighlightColor,
  onClose,
  onSaveNote,
  onSaveHighlight,
  onSaveHighlightNote,
}: ReaderNoteModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {selectedHighlight ? 'Note for Highlight' : 'Add Note'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close note modal"
            >
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {selectedHighlight && (
            <View
              style={[
                styles.highlightPreview,
                {
                  backgroundColor: selectedHighlight.color + '30',
                  borderLeftColor: selectedHighlight.color,
                },
              ]}
            >
              <Text style={[styles.highlightPreviewText, { color: themeColors.text }]} numberOfLines={3}>
                {selectedHighlight.text}
              </Text>
            </View>
          )}

          <TextInput
            style={[styles.noteInput, { color: themeColors.text, backgroundColor: themeColors.background }]}
            placeholder="Write your note..."
            placeholderTextColor={themeColors.secondaryText}
            value={selectedHighlight ? highlightNoteText : noteText}
            onChangeText={(text) => {
              if (selectedHighlight) {
                setHighlightNoteText(text);
              } else {
                setNoteText(text);
              }
            }}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            accessibilityLabel="Note text input"
          />

          {!selectedHighlight && (
            <>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: themeColors.text }]}>Highlight Color</Text>
                <View style={styles.colorRow}>
                  {['#FFC928', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'].map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        highlightColor === color && styles.colorCircleActive,
                      ]}
                      onPress={() => setHighlightColor(color)}
                      accessibilityLabel={`Select highlight color ${color}`}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.noteActions}>
                <TouchableOpacity
                  style={[styles.noteActionButton, { backgroundColor: colors.primary }]}
                  onPress={onSaveNote}
                  accessibilityLabel="Save note"
                >
                  <Text style={styles.noteActionText}>Save Note</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.noteActionButton, { backgroundColor: colors.primary }]}
                  onPress={() => onSaveHighlight(noteText)}
                  accessibilityLabel="Save highlight"
                >
                  <Text style={styles.noteActionText}>Save Highlight</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {selectedHighlight && (
            <View style={styles.noteActions}>
              <TouchableOpacity
                style={[styles.noteActionButton, { backgroundColor: colors.primary }]}
                onPress={onSaveHighlightNote}
                accessibilityLabel="Save note to highlight"
              >
                <Text style={styles.noteActionText}>Save Note to Highlight</Text>
              </TouchableOpacity>
            </View>
          )}
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
  settingRow: {
    marginBottom: SPACING.lg,
  } as const,
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  } as const,
  noteInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    minHeight: 120,
    marginBottom: SPACING.md,
  } as const,
  colorRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  } as const,
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  } as const,
  colorCircleActive: {
    borderWidth: 3,
  } as const,
  noteActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  } as const,
  noteActionButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  } as const,
  noteActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  } as const,
  highlightPreview: {
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md,
  } as const,
  highlightPreviewText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  } as const,
};
