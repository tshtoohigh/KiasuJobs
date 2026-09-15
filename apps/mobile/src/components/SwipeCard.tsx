import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { JobFeedItem, SwipeDirection } from '@kiasujobs/shared';

import { GestureDetector, usePanGesture } from '@/lib/gestures';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';

import { JobCard } from './JobCard';

/** Fraction of screen width a card must cross to count as a decision. */
const DISTANCE_THRESHOLD_RATIO = 0.28;
/** A fast flick commits even if it never crossed the distance threshold. */
const VELOCITY_THRESHOLD = 850;
const MAX_ROTATION_DEG = 9;

const SPRING_BACK = { damping: 18, stiffness: 220, mass: 0.6 } as const;
const FLY_OUT_DURATION = 210;

export interface SwipeCommand {
  direction: SwipeDirection;
  /** Changes on every button press so repeats of the same direction re-fire. */
  nonce: number;
}

interface SwipeCardProps {
  job: JobFeedItem;
  /** Only the top card is interactive; the rest just provide depth. */
  isTop: boolean;
  /** 0 for the top card, 1 for the one behind it, and so on. */
  depth: number;
  onSwiped: (direction: SwipeDirection) => void;
  onPress: () => void;
  command?: SwipeCommand | null;
}

export function SwipeCard({ job, isTop, depth, onSwiped, onPress, command }: SwipeCardProps) {
  const { width } = useWindowDimensions();
  const distanceThreshold = width * DISTANCE_THRESHOLD_RATIO;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  /** Latches so a card can't report two decisions (e.g. flick + button). */
  const settled = useSharedValue(false);

  const flyOut = (direction: SwipeDirection) => {
    'worklet';
    if (settled.value) return;
    settled.value = true;

    const sign = direction === 'right' ? 1 : -1;
    translateY.value = withTiming(translateY.value + 60, { duration: FLY_OUT_DURATION });
    translateX.value = withTiming(
      sign * (width + 140),
      { duration: FLY_OUT_DURATION },
      (finished) => {
        if (finished) runOnJS(onSwiped)(direction);
      },
    );
  };

  const pan = usePanGesture({
    enabled: isTop,
    // Let a tap through to the Pressable underneath: the pan only takes over
    // once the finger has actually travelled sideways.
    activeOffsetX: [-12, 12],
    onUpdate: (event) => {
      'worklet';
      if (settled.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    },
    onDeactivate: (event) => {
      'worklet';
      if (settled.value) return;

      // `canceled` is RNGH 3's replacement for v2's `success` flag — inverted.
      if (event.canceled) {
        translateX.value = withSpring(0, SPRING_BACK);
        translateY.value = withSpring(0, SPRING_BACK);
        return;
      }

      const travelled = Math.abs(translateX.value);
      const flicked = Math.abs(event.velocityX) > VELOCITY_THRESHOLD;

      if (travelled > distanceThreshold || flicked) {
        flyOut(translateX.value > 0 ? 'right' : 'left');
      } else {
        translateX.value = withSpring(0, SPRING_BACK);
        translateY.value = withSpring(0, SPRING_BACK);
      }
    },
  });

  // Button-driven swipes reuse the exact same fly-out and callback path.
  useEffect(() => {
    if (!isTop || !command) return;
    flyOut(command.direction);
    // flyOut is stable for the life of the card; keying on the nonce is what
    // makes a repeated direction fire again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.nonce, isTop]);

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width, 0, width],
      [-MAX_ROTATION_DEG, 0, MAX_ROTATION_DEG],
      Extrapolation.CLAMP,
    );

    // Cards behind the top one sit slightly smaller and lower.
    const restingScale = 1 - depth * 0.04;
    const restingOffset = depth * 12;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + restingOffset },
        { rotateZ: `${rotate}deg` },
        { scale: restingScale },
      ],
    };
  });

  const applyOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, distanceThreshold], [0, 1], Extrapolation.CLAMP),
  }));

  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-distanceThreshold, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const content = (
    <Animated.View style={[styles.card, shadow.card, cardStyle]}>
      <Pressable
        onPress={onPress}
        disabled={!isTop}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={`${job.title} at ${job.company_name}. Tap for full details.`}
      >
        <JobCard job={job} />
      </Pressable>

      {/* Decision affordances, driven straight off the drag position. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.stamp, styles.stampApply, applyOverlayStyle]}
      >
        <Text style={[styles.stampText, styles.stampTextApply]}>APPLY</Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.stamp, styles.stampSkip, skipOverlayStyle]}
      >
        <Text style={[styles.stampText, styles.stampTextSkip]}>SKIP</Text>
      </Animated.View>
    </Animated.View>
  );

  // Only the top card needs a gesture detector attached.
  if (!isTop) {
    return <View style={styles.fill}>{content}</View>;
  }

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={pan}>{content}</GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  card: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  pressable: { flex: 1 },
  stamp: {
    position: 'absolute',
    top: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 3,
  },
  stampApply: {
    left: spacing.xl,
    borderColor: colors.apply,
    backgroundColor: colors.applySoft,
    transform: [{ rotateZ: '-12deg' }],
  },
  stampSkip: {
    right: spacing.xl,
    borderColor: colors.skip,
    backgroundColor: colors.skipSoft,
    transform: [{ rotateZ: '12deg' }],
  },
  stampText: { fontSize: typography.title.fontSize, fontWeight: '800', letterSpacing: 1.5 },
  stampTextApply: { color: colors.apply },
  stampTextSkip: { color: colors.skip },
});
