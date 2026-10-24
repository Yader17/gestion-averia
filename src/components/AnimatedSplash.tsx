import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';

type Props = {
  // True once preferences/data needed for the first screen are loaded.
  ready: boolean;
  onFinish: () => void;
};

const MIN_VISIBLE_MS = 700;
const ENTER_MS = 450;
const EXIT_MS = 250;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/app-logo.png');

export function AnimatedSplash({ ready, onFinish }: Props) {
  const styles = useThemedStyles(createStyles);
  const { reduceMotion } = useTheme();
  const { t } = useI18n();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.92)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    if (!reduceMotion) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }),
      ]).start();
    }
    const timer = setTimeout(() => setMinElapsed(true), reduceMotion ? 0 : MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [opacity, scale, reduceMotion]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    if (reduceMotion) {
      onFinish();
      return;
    }
    Animated.timing(containerOpacity, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }).start(() =>
      onFinish()
    );
  }, [ready, minElapsed, reduceMotion, containerOpacity, onFinish]);

  return (
    <Animated.View
      style={[styles.container, { opacity: containerOpacity }]}
      accessibilityLabel={t('appName')}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <View style={styles.plate}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Tenax International" />
        </View>
        <Text style={styles.name}>{t('appName')}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: COLORS.background,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    },
    center: { alignItems: 'center', gap: 20, paddingHorizontal: 24 },
    plate: {
      backgroundColor: COLORS.logoPlate,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    logo: { width: 260, height: 70 },
    name: { fontSize: 24, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.3 },
  });
