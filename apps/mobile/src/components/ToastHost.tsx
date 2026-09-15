import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import { useToastStore } from '@/stores/toast';

const VISIBLE_MS = 2200;

/**
 * The visible half of the optimistic apply: this appears the instant a card
 * leaves the deck, well before the database has confirmed anything.
 */
export function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const dismiss = useToastStore((state) => state.dismiss);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!toast) return;

    progress.value = withTiming(1, { duration: 160 });

    const timer = setTimeout(() => {
      progress.value = withTiming(0, { duration: 180 }, (finished) => {
        if (finished) runOnJS(dismiss)();
      });
    }, VISIBLE_MS);

    return () => clearTimeout(timer);
    // Keyed on the toast id so a replacement re-runs the animation.
  }, [toast?.id, dismiss, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -18 }],
  }));

  if (!toast) return null;

  const palette =
    toast.variant === 'success'
      ? { backgroundColor: colors.apply }
      : toast.variant === 'error'
        ? { backgroundColor: colors.skip }
        : { backgroundColor: colors.text };

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, palette, { top: insets.top + spacing.sm }, shadow.card, animatedStyle]}
    >
      <Text style={styles.message} numberOfLines={2}>
        {toast.variant === 'success' ? '✓  ' : ''}
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    zIndex: 1000,
  },
  message: {
    color: '#FFFFFF',
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});
