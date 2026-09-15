import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { colors, typography } from '@/lib/theme';

/** Glyph tabs keep the app free of an icon-font dependency. */
function TabGlyph({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
}

export default function SeekerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: typography.caption.fontSize, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <TabGlyph glyph="◆" color={color} />,
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          tabBarIcon: ({ color }) => <TabGlyph glyph="≡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabGlyph glyph="●" color={color} />,
        }}
      />
    </Tabs>
  );
}
