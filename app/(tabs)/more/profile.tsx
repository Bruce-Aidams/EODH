import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
      });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
    }
    setIsEditing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
          <Ionicons name="pencil" size={20} color={COLORS.royalPurple} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl + 20 }}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.display_name || user?.email?.split('@')[0] || 'U').toUpperCase().charAt(0)}
            </Text>
          </View>
          <Text style={styles.userName}>
            {displayName || user?.display_name || user?.email?.split('@')[0] || 'User'}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Profile Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            {isEditing ? (
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.gray400} />
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.gray400}
                />
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {displayName || 'Not set'}
              </Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bio</Text>
            {isEditing ? (
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself"
                  placeholderTextColor={COLORS.gray400}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            ) : (
              <Text style={[styles.fieldValue, styles.bioText]}>
                {bio || 'Not set'}
              </Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{user?.email || 'Not available'}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Member Since</Text>
            <Text style={styles.fieldValue}>
              {user?.created_at 
                ? new Date(user.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })
                : 'N/A'
              }
            </Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reading Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Books Read</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Hours Read</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Bookmarks</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {isEditing ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={COLORS.white} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Ionicons name="close" size={20} color={COLORS.gray600} />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
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
    marginRight: 24,
  },
  editButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.royalPurple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.white,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.deepNavy,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.gray500,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    shadowColor: COLORS.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.deepNavy,
    marginBottom: SPACING.md,
  },
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  fieldValue: {
    fontSize: 15,
    color: COLORS.deepNavy,
  },
  bioText: {
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightBackground,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  textAreaContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: SPACING.sm,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    color: COLORS.deepNavy,
    marginLeft: SPACING.sm,
  },
  textArea: {
    marginLeft: 0,
    paddingTop: SPACING.sm,
    minHeight: 80,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.royalPurple,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.gray200,
  },
  actionButtons: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  saveButton: {
    backgroundColor: COLORS.royalPurple,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
  },
});
