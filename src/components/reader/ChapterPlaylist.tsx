import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS } from '@/constants/theme';
import { useAudioStore } from '@/stores/audioStore';
import { BookChapter } from '@/types';

interface ChapterPlaylistProps {
  visible: boolean;
  chapters: BookChapter[];
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
  onSelectChapter: (index: number) => void;
}

export const ChapterPlaylist: React.FC<ChapterPlaylistProps> = ({
  visible,
  chapters,
  themeColors,
  colors,
  onClose,
  onSelectChapter,
}) => {
  const currentSegment = useAudioStore((s) => s.currentSegment);
  const segments = useAudioStore((s) => s.segments);

  // Find the current chapter index based on audio segment
  const currentChapterIndex = React.useMemo(() => {
    if (!currentSegment || !currentSegment.chapter_id) return 0;
    const index = chapters.findIndex(ch => ch.id === currentSegment.chapter_id);
    return index >= 0 ? index : 0;
  }, [currentSegment, chapters]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: themeColors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.text }]}>Chapters</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close chapter list">
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.chapterList}>
            {chapters.map((chapter, index) => {
              const isCurrent = index === currentChapterIndex;
              return (
                <TouchableOpacity
                  key={chapter.id}
                  style={[
                    styles.chapterItem,
                    { borderBottomColor: colors.border },
                    isCurrent && { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => {
                    onSelectChapter(index);
                    onClose();
                  }}
                  accessibilityLabel={`Play chapter ${index + 1}: ${chapter.title}`}
                >
                  <View style={styles.chapterLeft}>
                    <Ionicons
                      name={isCurrent ? 'play-circle' : 'play-circle-outline'}
                      size={20}
                      color={isCurrent ? colors.primary : themeColors.secondaryText}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.chapterTitle,
                          { color: isCurrent ? colors.primary : themeColors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {chapter.title}
                      </Text>
                      <Text style={[styles.chapterNumber, { color: themeColors.secondaryText }]}>
                        Chapter {index + 1}
                      </Text>
                    </View>
                  </View>
                  {isCurrent && (
                    <Ionicons name="volume-high" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: 20,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  chapterList: {
    maxHeight: 400,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  chapterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  chapterNumber: {
    fontSize: 12,
    marginTop: 2,
  },
});

