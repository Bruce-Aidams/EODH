import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { BORDER_RADIUS } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeContext';
import RipplePress from '@/components/RipplePress';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const { colors } = useTheme();

  const variantStyles = {
    primary: {
      bg: colors.primary,
      border: 'transparent',
      text: '#FFFFFF',
    },
    secondary: {
      bg: colors.surfaceVariant,
      border: colors.border,
      text: colors.text,
    },
    outline: {
      bg: 'transparent',
      border: colors.border,
      text: colors.text,
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      text: colors.primary,
    },
    danger: {
      bg: colors.errorBg,
      border: 'transparent',
      text: colors.error,
    },
  };

  const sizeStyles = {
    small: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      fontSize: 12,
    },
    medium: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      fontSize: 14,
    },
    large: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      fontSize: 15,
    },
  };

  const vStyle = variantStyles[variant];
  const sStyle = sizeStyles[size];

  return (
    <RipplePress
      onPress={onPress}
      disabled={disabled || loading}
      rippleColor={vStyle.text}
      rippleOpacity={0.15}
      style={[
        styles.container,
        {
          backgroundColor: vStyle.bg,
          borderColor: vStyle.border,
          paddingVertical: sStyle.paddingVertical,
          paddingHorizontal: sStyle.paddingHorizontal,
          opacity: disabled || loading ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={vStyle.text} size="small" />
        ) : (
          <>
            {icon}
            {title && (
              <Text style={[styles.text, { color: vStyle.text, fontSize: sStyle.fontSize }, textStyle]}>
                {title}
              </Text>
            )}
          </>
        )}
      </View>
    </RipplePress>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
