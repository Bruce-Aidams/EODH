import React from 'react';
import { View, Text, TextInput, TouchableOpacity, TextInputProps, StyleSheet, ViewStyle } from 'react-native';
import { BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export default function Input({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  placeholder,
  ...rest
}: InputProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
          },
        ]}
      >
        {leftIcon && <Ionicons name={leftIcon} size={18} color={colors.textMuted} />}
        <TextInput
          style={[
            styles.input,
            { color: colors.text },
            style,
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          {...rest}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress}>
            <Ionicons name={rightIcon} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 40,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
});
