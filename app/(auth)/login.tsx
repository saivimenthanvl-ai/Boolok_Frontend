// app/(auth)/login.tsx
// Responsive port of login_boolok_gpt.html.
// Breakpoint mirrors Tailwind's `md` (768px):
//   width >= 768 -> left black brand panel (centered logo/headline/features)
//                   + right light-gray panel with card-style form
//   width < 768  -> small top-left logo + centered form card, no brand panel

import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL, useGoogleAuth } from '../../lib/api';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { router, Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import BoolokLogo from '../../components/BoolokLogo';
import GoogleIcon from '../../components/GoogleIcon';
import { colors, spacing, radius, typography } from '../../constants/theme';

const MD_BREAKPOINT = 768;

type SubmitState = 'idle' | 'loading' | 'success';

const FEATURES = [
  { icon: 'search', title: 'Smart Search', desc: 'Find properties with natural language.' },
  { icon: 'auto-awesome', title: 'AI Advisor', desc: 'Get expert real estate guidance.' },
  { icon: 'trending-up', title: 'Market Insights', desc: 'Real-time data and trends.' },
  { icon: 'public', title: 'Global Reach', desc: 'Connect with international markets.' },
] as const;

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= MD_BREAKPOINT;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [focused, setFocused] = useState(false);

  const { signIn } = useAuth();

  // ── Google Sign-In ──────────────────────────────────────────────
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  const handleGoogleSuccess = useCallback(
    async (idToken: string) => {
      setIsGoogleSigningIn(true);
      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/google`, {
          idToken,
        });
        if (!response.data?.token || !response.data?.user) {
          alert('BOOLOK could not start your session. Please try again.');
          return;
        }
        await signIn(response.data.token, response.data.user);
        router.replace('/(app)/dashboard');
      } catch (error: any) {
        alert(error.response?.data?.message || 'Google sign-in failed. Please try again.');
      } finally {
        setIsGoogleSigningIn(false);
      }
    },
    [router, signIn]
  );

  const { promptGoogleSignIn, isGoogleLoading } = useGoogleAuth({
    onSuccess: handleGoogleSuccess,
    onError: (msg: string) => alert(msg),
  });
  // ────────────────────────────────────────────────────────────────

  const canSubmit = username.trim().length > 0 && password.length > 0 && submitState === 'idle';

  // Mirrors: Authenticating... -> Access Granted -> navigate
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitState('loading');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username: username.trim(),
        identifier: username.trim(),
        password,
      });

      if (response.data.token) {
        await signIn(response.data.token, response.data.user);
        setSubmitState('success');
        setTimeout(() => {
          router.push('/(app)/feed'); // matches main_dashboard_boolok_gpt.html
        }, 1000);
      }
    } catch (error: any) {
      console.error('Login failed:', error.response?.data?.message || error.message);
      setSubmitState('idle');
      alert(error.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  const buttonLabel =
    submitState === 'loading'
      ? 'Authenticating...'
      : submitState === 'success'
        ? 'Access Granted'
        : 'Sign In';

  return (
    <ScrollView
      style={styles.rootScroll}
      contentContainerStyle={styles.rootScrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.mainLayout, isWide && styles.mainLayoutRow]}>
          {/* ---------- LEFT BRAND PANEL (web/wide only) ---------- */}
          {isWide && (
            <Animated.View style={styles.brandPanel} entering={FadeIn.duration(800)}>
              <View style={styles.brandInner}>
                <Pressable style={styles.brandLogoRow} onPress={() => router.push('/brand-vision')}>
                  <BoolokLogo size={56} color="#fff" />
                  <Text style={[typography.headlineMd, { color: '#fff', marginLeft: spacing.base, fontFamily: 'Poppins_700Bold' }]}>
                    BOOLOK <Text style={{ color: colors.primary }}>AI</Text>
                  </Text>
                </Pressable>

                <Text style={[typography.headlineSm, styles.brandTagline]}>
                  AI AGENT FOR REAL ESTATE SERVICES
                </Text>

                <View style={{ width: '100%', gap: spacing.lg }}>
                  {FEATURES.map((f) => (
                    <View key={f.title} style={styles.featureRow}>
                      <View style={styles.featureIconWrap}>
                        <MaterialIcons name={f.icon as any} size={22} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.labelMd, { color: '#fff', marginBottom: 2 }]}>{f.title}</Text>
                        <Text style={[typography.bodySm, styles.brandSubtext]}>{f.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* ---------- RIGHT PANEL: Login form ---------- */}
          <Animated.View
            style={[styles.formPanel, isWide && styles.formPanelWide]}
            entering={FadeInDown.duration(600).delay(100).springify()}
          >
            <View style={[styles.formContent, isWide && styles.formContentWide]}>
              {/* Mobile-only small logo, centered above card */}
              {!isWide && (
                <Pressable style={styles.mobileLogoBlock} onPress={() => router.push('/brand-vision')}>
                  <BoolokLogo size={56} />
                </Pressable>
              )}
              <View style={[styles.formCard, focused && styles.formCardFocused]}>
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={[typography.headlineMd, { color: colors.onSurface, marginBottom: spacing.xs }]}>
                    Welcome Back
                  </Text>
                  <Text style={[typography.bodyMd, { color: colors.onSurfaceVariant }]}>
                    Sign in to your Boolok AI account
                  </Text>
                </View>

                {/* Username or Email */}
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={[typography.labelMd, { color: colors.onSurface, marginBottom: spacing.xs }]}>
                    Email or Username
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email or username"
                    placeholderTextColor={colors.outline}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                </View>

                {/* Password */}
                <View style={{ marginBottom: spacing.md }}>
                  <View style={styles.passwordLabelRow}>
                    <Text style={[typography.labelMd, { color: colors.onSurface }]}>Password</Text>
                    <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
                      <Text style={[typography.labelMd, styles.link]}>Forgot Password?</Text>
                    </Pressable>
                  </View>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.outline}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                    />
                    <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                      <MaterialIcons
                        name={showPassword ? 'visibility-off' : 'visibility'}
                        size={22}
                        color={colors.onSurfaceVariant}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Submit */}
                <Pressable
                  style={[
                    styles.submitButton,
                    submitState === 'success' && { backgroundColor: colors.success },
                    !canSubmit && submitState === 'idle' && { opacity: 0.5 },
                    submitState === 'loading' && { opacity: 0.9 },
                  ]}
                  onPress={handleSubmit}
                  disabled={submitState !== 'idle' || !canSubmit}
                >
                  {submitState === 'loading' ? (
                    <View style={styles.loadingButtonContent}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={[typography.labelMd, { color: '#fff' }]}>{buttonLabel}</Text>
                    </View>
                  ) : (
                    <Text style={[typography.labelMd, { color: '#fff' }]}>{buttonLabel}</Text>
                  )}
                </Pressable>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={[typography.bodySm, { color: colors.onSurfaceVariant }]}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google */}
                <Pressable
                  style={[styles.googleButton, (isGoogleLoading || isGoogleSigningIn) && { opacity: 0.6 }]}
                  onPress={promptGoogleSignIn}
                  disabled={isGoogleLoading || isGoogleSigningIn}
                >
                  <GoogleIcon size={20} />
                  <Text style={[typography.labelMd, { color: colors.onSurface, marginLeft: spacing.base }]}>
                    {isGoogleSigningIn ? 'Signing in...' : 'Google'}
                  </Text>
                </Pressable>

                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={[typography.bodySm, { color: colors.onSurfaceVariant }]}>
                    Don't have an account?{' '}
                  </Text>
                  <Link href="/(auth)/register" style={[typography.labelMd, styles.link]}>
                    Get Started
                  </Link>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rootScroll: { flex: 1, backgroundColor: '#F4F4F6' },
  rootScrollContent: { flexGrow: 1 },
  keyboardAvoid: { flex: 1 },
  mainLayout: { flex: 1 },
  mainLayoutRow: { flexDirection: 'row' },

  // ---- Brand panel (web only) ----
  brandPanel: {
    width: '50%',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  brandInner: { maxWidth: 420, width: '100%', alignItems: 'center' },
  brandLogoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  brandTagline: {
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(218,165,32,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSubtext: { color: colors.outlineVariant },

  // ---- Form panel ----
  formPanel: {
    flex: 1,
    backgroundColor: '#F4F4F6',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  formPanelWide: {
    paddingHorizontal: spacing.xl,
  },
  formContent: {
    width: '100%',
    paddingHorizontal: spacing.gutter,
  },
  formContentWide: {
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  mobileLogoBlock: { width: '100%', alignItems: 'center', marginBottom: spacing.xl },
  formCard: {
    width: '100%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(230,230,230,0.6)',
    padding: spacing.lg,
    shadowColor: '#0A0F23',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  formCardFocused: {
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 10 },
  },
  input: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.background,
    color: colors.onSurface,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeButton: { position: 'absolute', right: spacing.md, height: 48, justifyContent: 'center' },
  link: { color: colors.primary },
  submitButton: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  googleButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(230,230,230,0.5)',
    borderRadius: radius.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
  },
});