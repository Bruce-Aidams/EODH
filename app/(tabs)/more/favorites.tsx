import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryStore } from '@/stores/libraryStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';

interface FavoriteBook {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  description: string | null;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, toggleFavorite, books } = useLibraryStore();
  const [favoriteBooks, setFavoriteBooks] = useState<FavoriteBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, [favorites]);

  const fetchFavorites = async () => {
    if (favorites.length === 0) {
      setFavoriteBooks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch favorite books from database
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_url, description')
        .in('id', favorites)
        .eq('is_published', true);

      setFavoriteBooks(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (bookId: string) => {
    toggleFavorite(bookId);
    
    // Update in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (favorites.includes(bookId)) {
        // Remove from favorites
        await supabase.from('user_favorites').delete().eq('user_id', user.id).eq('book_id', bookId);
      } else {
        // Add to favorites
        await supabase.from('user_favorites').insert({ user_id: user.id, book_id: bookId });
      }
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <Text style={styles.countText}>{favoriteBooks.length}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.royalPurple} />
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
      ) : favoriteBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={64} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>No Favorites Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart icon on any book to add it to your favorites.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {favoriteBooks.map((book) => (
            <TouchableOpacity
              key={book.id}
              style={styles.favoriteCard}
              onPress={() => router.push(`/book/${book.id}`)}
            >
              <View style={styles.coverContainer}>
                <View style={styles.cover}>
                  <Ionicons name="book" size={32} color={COLORS.gray400} />
                </View>
              </View>
              <View style={styles.favoriteInfo}>
                <Text style={styles.favoriteTitle} numberOfLines={1}>{book.title}</Text>
                <Text style={styles.favoriteAuthor} numberOfLines={1}>{book.author}</Text>
                {book.description && (
                  <Text style={styles.favoriteDescription} numberOfLines={2}>
                    {book.description}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.heartButton}
                onPress={() => handleToggleFavorite(book.id)}
              >
                <Ionicons name="heart" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.deepNavy,
    textAlign: 'center',
    marginRight: 20,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.royalPurple,
    backgroundColor: COLORS.royalPurple + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.gray500,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray600,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray400,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  coverContainer: {
    marginRight: SPACING.md,
  },
  cover: {
    width: 50,
    height: 65,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepNavy,
  },
  favoriteAuthor: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: 2,
  },
  favoriteDescription: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: 4,
    lineHeight: 16,
  },
  heartButton: {
    padding: SPACING.sm,
  },
});
