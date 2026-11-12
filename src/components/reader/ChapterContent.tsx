import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { BORDER_RADIUS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChapterContentProps {
  htmlContent: string;
  rawContent: string;
  themeColors: {
    background: string;
    text: string;
    secondaryText: string;
  };
  colors: {
    primary: string;
  };
  readingSettings: {
    fontFamily: string;
    fontSize: number;
    lineSpacing: number;
    textAlign: 'left' | 'center' | 'justify';
    margins: number;
  };
  contentWidth: number;
  htmlStyles: Readonly<Record<string, any>>;
  loadingChapters: boolean;
  processingDocument: boolean;
  processingMessage: string;
  scrollViewRef: any;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export const ChapterContent: React.FC<ChapterContentProps> = ({
  htmlContent,
  rawContent,
  themeColors,
  colors,
  readingSettings,
  contentWidth,
  htmlStyles,
  loadingChapters,
  processingDocument,
  processingMessage,
  scrollViewRef,
  onScroll,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.content, { backgroundColor: themeColors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingHorizontal: readingSettings.margins,
          paddingBottom: insets.bottom + 48 + 20,
        },
      ]}
      onScroll={onScroll}
      scrollEventThrottle={100}
      showsVerticalScrollIndicator={false}
    >
      {processingDocument ? (
        <View style={styles.loadingChapters}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingChaptersText, { color: themeColors.secondaryText }]}>
            {processingMessage || 'Processing document...'}
          </Text>
          <Text style={[styles.loadingChaptersSubText, { color: themeColors.secondaryText }]}>
            This may take a moment for larger files.
          </Text>
        </View>
      ) : loadingChapters ? (
        <View style={styles.loadingChapters}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingChaptersText, { color: themeColors.secondaryText }]}>
            Loading content...
          </Text>
        </View>
      ) : htmlContent ? (
        <RenderHtml
          source={{ html: htmlContent }}
          contentWidth={contentWidth}
          tagsStyles={htmlStyles}
          systemFonts={[readingSettings.fontFamily, 'systemFont', 'HelveticaNeue', 'Arial']}
        />
      ) : (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
            <Text style={{ fontSize: 28 }}>📖</Text>
          </View>
          <Text
            style={[
              styles.emptyTitle,
              { color: themeColors.text }
            ]}
          >
            No content available
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: themeColors.secondaryText }
            ]}
          >
            The book content could not be loaded.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 24,
    minHeight: '100%',
  },
  text: {
    marginBottom: 16,
  },
  loadingChapters: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingChaptersText: {
    fontSize: 14,
    marginTop: 16,
    fontWeight: '500',
  },
  loadingChaptersSubText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
});

