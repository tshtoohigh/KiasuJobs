import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JobFeedItem, SwipeDirection } from '@kiasujobs/shared';

import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import { useJobQueue } from '@/stores/jobQueue';

import { JobDetailsSheet } from './JobDetailsSheet';
import { SwipeCard, type SwipeCommand } from './SwipeCard';
import { EmptyState, ErrorNotice, Loader } from './ui';

/** How many cards are mounted at once. Two are visible; the third pre-renders. */
const VISIBLE_CARDS = 3;

export function SwipeDeck({ seekerId }: { seekerId: string }) {
  const queue = useJobQueue((state) => state.queue);
  const isLoading = useJobQueue((state) => state.isLoading);
  const error = useJobQueue((state) => state.error);
  const exhausted = useJobQueue((state) => state.exhausted);
  const initialise = useJobQueue((state) => state.initialise);
  const commitSwipe = useJobQueue((state) => state.commitSwipe);

  const [command, setCommand] = useState<SwipeCommand | null>(null);
  const [detailsJob, setDetailsJob] = useState<JobFeedItem | null>(null);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  /**
   * Runs when a card finishes flying off screen. Clearing the command in the
   * same batch as the queue update matters: the card promoted to the top would
   * otherwise inherit the previous command and fly straight off.
   */
  const handleSwiped = useCallback(
    (direction: SwipeDirection) => {
      setCommand(null);
      commitSwipe(direction, seekerId);
    },
    [commitSwipe, seekerId],
  );

  const triggerSwipe = useCallback((direction: SwipeDirection) => {
    setCommand({ direction, nonce: Date.now() });
  }, []);

  const applyFromSheet = useCallback(() => {
    setDetailsJob(null);
    triggerSwipe('right');
  }, [triggerSwipe]);

  const skipFromSheet = useCallback(() => {
    setDetailsJob(null);
    triggerSwipe('left');
  }, [triggerSwipe]);

  if (isLoading && queue.length === 0) {
    return <Loader label="Finding jobs for you…" />;
  }

  if (error && queue.length === 0) {
    return <ErrorNotice message={error} onRetry={() => void initialise(true)} />;
  }

  if (queue.length === 0) {
    return (
      <EmptyState
        title={exhausted ? "That's every job for now" : 'No jobs yet'}
        message={
          exhausted
            ? 'You have been through every posting that matches your preferences. Widen them in your profile, or check back later — new roles land daily.'
            : 'Nothing matches your preferences right now. Try widening them in your profile.'
        }
        actionLabel="Refresh"
        onAction={() => void initialise(true)}
      />
    );
  }

  // Reversed so the first item in the queue paints last, i.e. on top.
  const visible = queue.slice(0, VISIBLE_CARDS);

  return (
    <View style={styles.container}>
      <View style={styles.deck}>
        {visible
          .map((job, index) => (
            <SwipeCard
              key={job.id}
              job={job}
              isTop={index === 0}
              depth={index}
              command={index === 0 ? command : null}
              onSwiped={handleSwiped}
              onPress={() => setDetailsJob(job)}
            />
          ))
          .reverse()}
      </View>

      <View style={styles.controls}>
        <ControlButton
          label="Skip"
          glyph="✕"
          tone="skip"
          onPress={() => triggerSwipe('left')}
          accessibilityLabel="Skip this job"
        />
        <ControlButton
          label="Details"
          glyph="⌄"
          tone="neutral"
          onPress={() => setDetailsJob(queue[0] ?? null)}
          accessibilityLabel="Show full job description"
        />
        <ControlButton
          label="Apply"
          glyph="✓"
          tone="apply"
          onPress={() => triggerSwipe('right')}
          accessibilityLabel="Apply to this job"
        />
      </View>

      <JobDetailsSheet
        job={detailsJob}
        onClose={() => setDetailsJob(null)}
        onApply={applyFromSheet}
        onSkip={skipFromSheet}
      />
    </View>
  );
}

function ControlButton({
  label,
  glyph,
  tone,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  glyph: string;
  tone: 'skip' | 'apply' | 'neutral';
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.control}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.controlButton,
          tone === 'skip' && styles.controlSkip,
          tone === 'apply' && styles.controlApply,
          tone === 'neutral' && styles.controlNeutral,
          pressed && styles.controlPressed,
        ]}
      >
        <Text
          style={[
            styles.controlGlyph,
            tone === 'skip' && styles.controlGlyphSkip,
            tone === 'apply' && styles.controlGlyphApply,
          ]}
        >
          {glyph}
        </Text>
      </Pressable>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deck: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  control: { alignItems: 'center', gap: spacing.xs },
  controlButton: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  controlSkip: { borderWidth: 2, borderColor: colors.skip },
  controlApply: { borderWidth: 2, borderColor: colors.apply },
  controlNeutral: { width: 50, height: 50, borderWidth: 1, borderColor: colors.border },
  controlPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  controlGlyph: { fontSize: 24, fontWeight: '700', color: colors.textMuted },
  controlGlyphSkip: { color: colors.skip },
  controlGlyphApply: { color: colors.apply },
  controlLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textFaint,
    fontWeight: '600',
  },
});
