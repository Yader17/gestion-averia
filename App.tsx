import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { WelcomeOnboarding } from './src/components/WelcomeOnboarding';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';

function Root() {
  const { colors, isDark, preferences, preferencesReady, updatePreferences } = useTheme();
  const { status } = useAuth();
  const [dataReady, setDataReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const handleReady = useCallback(() => setDataReady(true), []);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {preferencesReady && status === 'signedIn' && <HomeScreen onReady={handleReady} />}
      {preferencesReady && status === 'signedOut' && <LoginScreen />}
      {!splashDone && <AnimatedSplash ready={preferencesReady && (status === 'signedOut' || (status === 'signedIn' && dataReady))} onFinish={handleSplashFinish} />}
      <WelcomeOnboarding
        visible={splashDone && !preferences.onboardingDone}
        onStart={() => updatePreferences({ onboardingDone: true })}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
