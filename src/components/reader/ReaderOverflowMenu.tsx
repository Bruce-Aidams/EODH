import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS } from '@/constants/theme';
import { Book } from '@/types';

interface ReaderOverflowMenuProps {
  visible: boolean;
  book: Book | null;
  themeColors: {
    background: string;
    text: string;
    secondaryText: string;
  };
  colors: {
    primary: string;
    border: string;
  };
  onClose: () => void;
  onBookInfo: () => void;
  onTableOfContents: () => void;
  onSearch: () => void;
  onBookmarks: () => void;
  onHighlights: () => void;
  onSettings: () => void;
  onShare: () => void;
  onReport: () => void;
  onAIInsights?: () => void;
}

export const ReaderOverflowMenu: React.FC<ReaderOverflowMenuProps> = ({
  visible,
  book,
  themeColors,
  colors,
  onClose,
  onBookInfo,
  onTableOfContents,
  onSearch,
  onBookmarks,
  onHighlights,
  onSettings,
  onShare,
  onReport,
  onAIInsights,
}) => {
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Reading "${book?.title || 'Unknown Book'}" on EODH App`,
        title: book?.title || 'EODH Book',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
    onClose();
  };

  const handleReport = () => {
    Alert.alert(
      'Report an Issue',
      'Would you like to report a problem with this book?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: () => {
            onReport();
            onClose();
          },
        },
      ]
    );
  };

  const menuItems = [
    { icon: 'sparkles' as const, label: 'AI Insights', action: () => { onAIInsights?.(); onClose(); }, show: !!onAIInsights },
    { icon: 'information-circle-outline' as const, label: 'Book Info', action: onBookInfo },
    { icon: 'list-outline' as const, label: 'Table of Contents', action: onTableOfContents },
    { icon: 'search-outline' as const, label: 'Search in Book', action: onSearch },
    { icon: 'bookmark-outline' as const, label: 'Bookmarks', action: onBookmarks },
    { icon: 'pencil' as const, label: 'Highlights', action: () => { onHighlights(); onClose(); } },
    { icon: 'settings-outline' as const, label: 'Reading Settings', action: onSettings },
    { icon: 'share-outline' as const, label: 'Share', action: handleShare },
    { icon: 'flag-outline' as const, label: 'Report an Issue', action: handleReport },
  ].filter((item: any) => item.show !== false);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.menu, { backgroundColor: themeColors.background, borderColor: colors.border }]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={item.action}
              accessibilityLabel={item.label}
            >
              <Ionicons name={item.icon} size={20} color={themeColors.text} />
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.menuItem, styles.closeItem, { borderTopColor: colors.border }]}
            onPress={onClose}
            accessibilityLabel="Close menu"
          >
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menu: {
    width: 240,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  closeItem: {
    justifyContent: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

