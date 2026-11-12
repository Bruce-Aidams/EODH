import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSearch?: () => void;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  onSearch,
}: SearchBarProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceVariant,
          borderColor: focused ? colors.primary : colors.border,
          shadowColor: focused ? colors.primary : 'transparent',
          shadowOffset: focused ? { width: 0, height: 0 } : undefined,
          shadowOpacity: focused ? 0.2 : 0,
          shadowRadius: focused ? 6 : 0,
          elevation: focused ? 2 : 0,
        },
      ]}
    >
      <Ionicons name="search" size={18} color={focused ? colors.primary : colors.textMuted} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSearch ? () => onSearch() : undefined}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={onClear || (() => onChangeText(''))}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
});
