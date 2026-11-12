import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import {
  getBookSummaries,
  generateAllBookSummaries,
  isAISummaryAvailable,
} from '@/lib/ai/summaries';
import { AISummary, SummaryType } from '@/lib/ai/summaries';
import { useToast } from '@/lib/notifications/toast';

interface AISummaryPanelProps {
  visible: boolean;
  bookId: string;
  bookTitle: string;
  fullText?: string;
  onClose: () => void;
  onRegenerate?: () => void;
}

type TabType = 'overview' | 'takeaways' | 'questions' | 'flashcards';

const TABS: { key: TabType; label: string; icon: any; summaryType: SummaryType }[] = [
  { key: 'overview', label: 'Overview', icon: 'book-outline', summaryType: 'book_overview' },
  { key: 'takeaways', label: 'Takeaways', icon: 'lightbulb-outline', summaryType: 'key_takeaways' },
  { key: 'questions', label: 'Questions', icon: 'help-circle-outline', summaryType: 'comprehension_questions' },
  { key: 'flashcards', label: 'Flashcards', icon: 'card-outline', summaryType: 'flashcards' },
];

export const AISummaryPanel: React.FC<AISummaryPanelProps> = ({
  visible,
  bookId,
  bookTitle,
  fullText,
  onClose,
  onRegenerate,
}) => {
  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [summaries, setSummaries] = useState<Record<SummaryType, AISummary | null>>({
    book_overview: null,
    chapter_summary: null,
    key_takeaways: null,
    comprehension_questions: null,
    flashcards: null,
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const themeColors = {
    background: isDark ? COLORS.gray800 : COLORS.white,
    text: isDark ? COLORS.white : COLORS.deepNavy,
    secondaryText: isDark ? COLORS.gray400 : COLORS.gray500,
    border: isDark ? COLORS.gray700 : COLORS.gray200,
  };

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    const [fetched, available] = await Promise.all([
      getBookSummaries(bookId),
      isAISummaryAvailable(),
    ]);
    setSummaries(fetched);
    setAiAvailable(available);
    setLoading(false);
  }, [bookId]);

  React.useEffect(() => {
    if (visible) {
      loadSummaries();
    }
  }, [visible, loadSummaries]);

  const handleGenerate = async () => {
    if (!fullText) {
      showError('Book content is not available for generating summaries.');
      return;
    }

    setGenerating(true);
    try {
      const results = await generateAllBookSummaries(bookId, fullText, bookTitle);
      showSuccess(`Generated ${results.length} AI summaries`);
      await loadSummaries();
      onRegenerate?.();
    } catch (error: any) {
      showError(error.message || 'Failed to generate summaries');
    } finally {
      setGenerating(false);
    }
  };

  const currentSummary = summaries[TABS.find(t => t.key === activeTab)?.summaryType || 'book_overview'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
              AI Insights
            </Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.secondaryText }]}>
              {bookTitle}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: themeColors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tab,
                    isActive && { borderBottomColor: colors.primary },
                  ]}
                >
                  <Ionicons
                    name={isActive ? (tab.icon.replace('-outline', '') as any) : (tab.icon as any)}
                    size={16}
                    color={isActive ? colors.primary : themeColors.secondaryText}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isActive ? colors.primary : themeColors.secondaryText },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.secondaryText }]}>
              Loading AI insights...
            </Text>
          </View>
        ) : aiAvailable === false ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color={themeColors.secondaryText} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              AI Not Configured
            </Text>
            <Text style={[styles.emptyText, { color: themeColors.secondaryText }]}>
              The AI summary service is not yet deployed. Ask your admin to deploy the Edge Function and set the OpenAI API key.
            </Text>
          </View>
        ) : !currentSummary ? (
          <View style={styles.emptyContainer}>
            <Ionicons name={TABS.find(t => t.key === activeTab)?.icon || 'book-outline'} size={48} color={themeColors.secondaryText} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              No {TABS.find(t => t.key === activeTab)?.label} Yet
            </Text>
            <Text style={[styles.emptyText, { color: themeColors.secondaryText }]}>
              Generate AI-powered insights for this book.
            </Text>
            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: colors.primary }]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color={COLORS.white} />
                  <Text style={styles.generateButtonText}>
                    Generate {TABS.find(t => t.key === activeTab)?.label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={generating}
                onRefresh={handleGenerate}
                tintColor={colors.primary}
              />
            }
          >
            <SummaryContent
              type={activeTab}
              summary={currentSummary}
              themeColors={themeColors}
              colors={colors}
            />
            <View style={styles.regenerateRow}>
              <TouchableOpacity
                style={[styles.regenerateButton, { backgroundColor: colors.primary }]}
                onPress={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color={COLORS.white} />
                    <Text style={styles.regenerateButtonText}>Regenerate</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

// =====================================================
// Summary Content Renderer
// =====================================================

interface SummaryContentProps {
  type: TabType;
  summary: AISummary;
  themeColors: {
    background: string;
    text: string;
    secondaryText: string;
    border: string;
  };
  colors: {
    primary: string;
  };
}

const SummaryContent: React.FC<SummaryContentProps> = ({ type, summary, themeColors, colors }) => {
  const content = summary.content as any;

  switch (type) {
    case 'overview':
      return (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Overview</Text>
          <Text style={[styles.bodyText, { color: themeColors.text }]}>
            {content.overview || 'No overview available.'}
          </Text>

          {content.themes?.length > 0 && (
            <View style={styles.subsection}>
              <Text style={[styles.subsectionTitle, { color: themeColors.text }]}>Themes</Text>
              {content.themes.map((theme: string, i: number) => (
                <View key={i} style={styles.tagRow}>
                  <View style={[styles.tag, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{theme}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {content.keyPoints?.length > 0 && (
            <View style={styles.subsection}>
              <Text style={[styles.subsectionTitle, { color: themeColors.text }]}>Key Points</Text>
              {content.keyPoints.map((point: string, i: number) => (
                <View key={i} style={styles.listItem}>
                  <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.listText, { color: themeColors.text }]}>{point}</Text>
                </View>
              ))}
            </View>
          )}

          {content.readingLevel && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: themeColors.secondaryText }]}>Reading Level:</Text>
              <Text style={[styles.metaValue, { color: themeColors.text }]}>{content.readingLevel}</Text>
            </View>
          )}

          {content.targetAudience && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: themeColors.secondaryText }]}>For:</Text>
              <Text style={[styles.metaValue, { color: themeColors.text }]}>{content.targetAudience}</Text>
            </View>
          )}
        </View>
      );

    case 'takeaways':
      return (
        <View style={styles.section}>
          {content.bigIdea && (
            <View style={[styles.bigIdeaCard, { borderColor: colors.primary }]}>
              <Ionicons name="bulb" size={20} color={colors.primary} />
              <Text style={[styles.bigIdeaText, { color: themeColors.text }]}>
                {content.bigIdea}
              </Text>
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Key Takeaways</Text>
          {(content.takeaways || []).map((takeaway: any, i: number) => (
            <View key={i} style={[styles.takeawayCard, { borderBottomColor: themeColors.border }]}>
              <View style={styles.takeawayHeader}>
                <Text style={[styles.takeawayTitle, { color: themeColors.text }]}>{takeaway.title}</Text>
                <View style={[
                  styles.importanceBadge,
                  {
                    backgroundColor:
                      takeaway.importance === 'high' ? COLORS.error + '20' :
                      takeaway.importance === 'medium' ? COLORS.warning + '20' :
                      COLORS.success + '20',
                  }
                ]}>
                  <Text style={[
                    styles.importanceText,
                    {
                      color:
                        takeaway.importance === 'high' ? COLORS.error :
                        takeaway.importance === 'medium' ? COLORS.warning :
                        COLORS.success,
                    }
                  ]}>
                    {takeaway.importance}
                  </Text>
                </View>
              </View>
              <Text style={[styles.takeawayDesc, { color: themeColors.secondaryText }]}>
                {takeaway.description}
              </Text>
              {takeaway.quote && (
                <View style={styles.quoteBlock}>
                  <Text style={[styles.quoteText, { color: colors.primary }]}>
                    "{takeaway.quote}"
                  </Text>
                </View>
              )}
            </View>
          ))}

          {content.actionItems?.length > 0 && (
            <View style={styles.subsection}>
              <Text style={[styles.subsectionTitle, { color: themeColors.text }]}>Action Items</Text>
              {content.actionItems.map((item: string, i: number) => (
                <View key={i} style={styles.listItem}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={[styles.listText, { color: themeColors.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );

    case 'questions':
      return (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Comprehension Questions
          </Text>
          {(content.questions || []).map((q: any, i: number) => (
            <View key={i} style={[styles.questionCard, { borderBottomColor: themeColors.border }]}>
              <View style={styles.questionHeader}>
                <Text style={[styles.questionNumber, { color: colors.primary }]}>Q{i + 1}.</Text>
                <Text style={[styles.questionText, { color: themeColors.text }]}>{q.question}</Text>
              </View>
              <View style={styles.questionMeta}>
                <View style={[styles.difficultyBadge, {
                  backgroundColor:
                    q.difficulty === 'hard' ? COLORS.error + '20' :
                    q.difficulty === 'medium' ? COLORS.warning + '20' :
                    COLORS.success + '20',
                }]}>
                  <Text style={[styles.difficultyText, {
                    color:
                      q.difficulty === 'hard' ? COLORS.error :
                      q.difficulty === 'medium' ? COLORS.warning :
                      COLORS.success,
                  }]}>
                    {q.difficulty}
                  </Text>
                </View>
                <Text style={[styles.typeText, { color: themeColors.secondaryText }]}>
                  {q.type.replace('_', ' ')}
                </Text>
              </View>
              {q.type === 'multiple_choice' && q.options?.length > 0 && (
                <View style={styles.optionsContainer}>
                  {q.options.map((option: string, j: number) => (
                    <View key={j} style={[styles.optionRow, { borderColor: themeColors.border }]}>
                      <Text style={[styles.optionLetter, { color: colors.primary }]}>{String.fromCharCode(65 + j)}.</Text>
                      <Text style={[styles.optionText, { color: themeColors.text }]}>{option}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.answerSection}>
                <Text style={[styles.answerLabel, { color: themeColors.secondaryText }]}>Answer:</Text>
                <Text style={[styles.answerText, { color: themeColors.text }]}>{q.correctAnswer}</Text>
                {q.explanation && (
                  <>
                    <Text style={[styles.answerLabel, { color: themeColors.secondaryText }]}>Explanation:</Text>
                    <Text style={[styles.answerText, { color: themeColors.text }]}>{q.explanation}</Text>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      );

    case 'flashcards':
      return (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Study Flashcards</Text>
          {(content.flashcards || []).map((card: any, i: number) => (
            <FlashcardItem key={i} card={card} index={i} themeColors={themeColors} colors={colors} />
          ))}
        </View>
      );

    default:
      return null;
  }
};

// =====================================================
// Flashcard Item with Flip Animation
// =====================================================

interface FlashcardItemProps {
  card: { front: string; back: string; category: string };
  index: number;
  themeColors: {
    background: string;
    text: string;
    secondaryText: string;
    border: string;
  };
  colors: {
    primary: string;
  };
}

const FlashcardItem: React.FC<FlashcardItemProps> = ({ card, index, themeColors, colors }) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <TouchableOpacity
      key={index}
      onPress={() => setFlipped(!flipped)}
      style={[styles.flashcard, { borderColor: themeColors.border, backgroundColor: themeColors.background }]}
    >
      <View style={styles.flashcardHeader}>
        <Text style={[styles.flashcardNumber, { color: colors.primary }]}>Card {index + 1}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.categoryText, { color: colors.primary }]}>{card.category}</Text>
        </View>
      </View>
      <View style={styles.flashcardContent}>
        <Text style={[styles.flashcardLabel, { color: themeColors.secondaryText }]}>
          {flipped ? 'Answer' : 'Question'}
        </Text>
        <Text style={[styles.flashcardText, { color: themeColors.text }]}>
          {flipped ? card.back : card.front}
        </Text>
      </View>
      <Text style={[styles.flashcardHint, { color: themeColors.secondaryText }]}>
        Tap to {flipped ? 'see question' : 'reveal answer'}
      </Text>
    </TouchableOpacity>
  );
};

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  tabBar: {
    borderBottomWidth: 1,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    marginTop: 20,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.1,
  },
  subsection: {
    marginTop: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 13,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  bigIdeaCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  bigIdeaText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  takeawayCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  takeawayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  takeawayTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  importanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  importanceText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  takeawayDesc: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  quoteBlock: {
    marginLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    paddingLeft: 10,
    marginTop: 8,
  },
  quoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actionItems: {
    marginTop: 20,
  },
  questionCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  questionMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  typeText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  optionsContainer: {
    marginTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: 4,
  },
  optionLetter: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 4,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
  },
  answerSection: {
    marginTop: 8,
    paddingLeft: 12,
  },
  answerLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  answerText: {
    fontSize: 15,
    lineHeight: 20,
  },
  flashcard: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    marginBottom: 12,
  },
  flashcardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  flashcardNumber: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  flashcardContent: {
    minHeight: 80,
    justifyContent: 'center',
  },
  flashcardLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  flashcardText: {
    fontSize: 15,
    lineHeight: 22,
  },
  flashcardHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  regenerateRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
  },
  regenerateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
