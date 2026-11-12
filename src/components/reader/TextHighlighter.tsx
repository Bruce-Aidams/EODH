import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS } from '@/constants/theme';
import { Highlight } from '@/types';

interface TextHighlighterProps {
  highlights: Highlight[];
  themeColors: {
    background: string;
    text: string;
    secondaryText: string;
  };
  colors: {
    primary: string;
    border: string;
  };
  onRemoveHighlight: (highlightId: string) => void;
  onAddNoteToHighlight: (highlight: Highlight) => void;
}

export const TextHighlighter: React.FC<TextHighlighterProps> = ({
  highlights,
  themeColors,
  colors,
  onRemoveHighlight,
  onAddNoteToHighlight,
}) => {
  if (highlights.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {highlights.map((highlight) => (
        <View
          key={highlight.id}
          style={[
            styles.highlightItem,
            {
              backgroundColor: highlight.color + '30',
              borderLeftColor: highlight.color,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.highlightText, { color: themeColors.text }]}
            numberOfLines={2}
          >
            {highlight.text}
          </Text>
          <View style={styles.highlightActions}>
            <TouchableOpacity
              onPress={() => onAddNoteToHighlight(highlight)}
              accessibilityLabel="Add note to highlight"
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onRemoveHighlight(highlight.id)}
              accessibilityLabel="Remove highlight"
            >
              <Ionicons name="close-circle" size={16} color={themeColors.secondaryText} />
            </TouchableOpacity>
          </View>
          {highlight.note && (
            <Text style={[styles.highlightNote, { color: themeColors.secondaryText }]}>
              {highlight.note}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  highlightItem: {
    padding: 12,
    borderLeftWidth: 3,
    borderBottomWidth: 1,
    marginBottom: 8,
    borderRadius: BORDER_RADIUS.sm,
  },
  highlightText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  highlightActions: {
    flexDirection: 'row',
    gap: 12,
  },
  highlightNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

