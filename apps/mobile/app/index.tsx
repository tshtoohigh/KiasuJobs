import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Loader } from '@/components/ui';
import { colors } from '@/lib/theme';

/**
 * Entry route. Intentionally inert — the guard in `_layout.tsx` redirects to
 * the right section as soon as the auth stage resolves.
 */
export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Loader />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
