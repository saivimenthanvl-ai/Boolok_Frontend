import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radius, shadows } from '../../constants/theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import LoadingScreen from '../../components/LoadingScreen';

export default function FeedScreen() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const data = await apiFetch('/api/dashboard/stats');

      setStats({
        complianceAlert: '',
        marketPredictions: {
          location: '',
          growthIndex: '',
          value: '',
          volatility: '',
          growthPercent: '',
          peakDate: '',
        },
        ...data,
        recentInquiries: Array.isArray(data?.recentInquiries)
          ? data.recentInquiries
          : [],
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats({
        recentInquiries: [],
        complianceAlert: 'Could not load data. Check your connection.',
        marketPredictions: {
          location: '—',
          growthIndex: '—',
          value: '—',
          volatility: '—',
          growthPercent: '—',
          peakDate: '—',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    if (Platform.OS === 'web') {
      window.alert(`Searching across global databases for: ${searchQuery}`);
    } else {
      Alert.alert(
        'Smart Search',
        `Searching across global databases for: ${searchQuery}`
      );
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(400)}>
      <ScrollView
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
        contentContainerStyle={[
          styles.contentContainer,
          { padding: isWide ? spacing.xl : spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {/* Row 1 */}
          {/* AI Search Hub */}
          <Pressable
            style={({ pressed, hovered }: any) => [
              styles.card,
              { padding: isWide ? spacing.xl : spacing.md },
              {
                backgroundColor: theme.surface,
                borderColor: isDark
                  ? theme.outlineVariant
                  : 'rgba(218, 165, 32, 0.35)',
              },
              isWide ? { width: Platform.OS === 'web' ? 'calc(66.666% - 16px)' : '65%' } : { width: '100%' },
              styles.searchCard,
              (pressed || hovered) && {
                transform: [{ scale: 1.01 }],
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 15,
                borderColor: 'rgba(218, 165, 32, 0.4)',
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={{ flexShrink: 1, marginRight: spacing.md }}>
                <Text
                  style={[typography.headlineMd, { color: theme.onSurface }]}
                >
                  AI Search Hub
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.onSurfaceVariant,
                    marginTop: 4,
                  }}
                >
                  Deep-dive property intelligence across 40+ global databases.
                </Text>
              </View>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: 'rgba(218, 165, 32, 0.1)' },
                ]}
              >
                <MaterialIcons
                  name="search"
                  size={24}
                  color={theme.primary}
                />
              </View>
            </View>

            <View style={styles.searchInputWrap}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.surfaceContainerLowest,
                    borderColor: theme.outlineVariant,
                    color: theme.onSurface,
                  },
                  { paddingRight: isWide ? 150 : 60 },
                ]}
                placeholder="Describe the property you are looking for..."
                placeholderTextColor={theme.outline}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
              />
              <Pressable
                onPress={handleSearch}
                style={({ pressed, hovered }: any) => [
                  styles.searchBtn,
                  { backgroundColor: theme.primary },
                  !isWide && { paddingHorizontal: 12 },
                  (pressed || hovered) && {
                    transform: [{ scale: 0.95 }],
                    opacity: 0.9,
                  },
                ]}
              >
                {isWide ? (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    Smart Search
                  </Text>
                ) : (
                  <MaterialIcons name="search" size={20} color="#fff" />
                )}
              </Pressable>
            </View>

            <View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: theme.outline,
                  marginBottom: spacing.sm,
                  letterSpacing: 1,
                }}
              >
                Recent Inquiries
              </Text>
              <View style={styles.chipRow}>
                {(stats?.recentInquiries ?? []).map(
                  (inquiry: string, index: number) => (
                    <Pressable
                      key={index}
                      style={({ pressed, hovered }: any) => [
                        styles.chip,
                        {
                          backgroundColor: theme.surfaceContainerHigh,
                          borderColor: theme.outlineVariant,
                        },
                        (pressed || hovered) && {
                          borderColor: theme.primary,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name="history"
                        size={14}
                        color={theme.onSurfaceVariant}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          color: theme.onSurfaceVariant,
                        }}
                      >
                        {inquiry}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          </Pressable>

          {/* Legal AI */}
          <Pressable
            onPress={() => router.push('/(app)/legal')}
            style={({ pressed, hovered }: any) => [
              styles.card,
              { padding: isWide ? spacing.xl : spacing.md },
              {
                backgroundColor: theme.surface,
                borderColor: isDark
                  ? theme.outlineVariant
                  : 'rgba(218, 165, 32, 0.35)',
                cursor: 'pointer',
              },
              isWide ? { width: Platform.OS === 'web' ? 'calc(33.333% - 16px)' : '32%' } : { width: '100%' },
              styles.legalCard,
              (pressed || hovered) && {
                transform: [{ scale: 1.02 }],
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 15,
                borderColor: 'rgba(218, 165, 32, 0.4)',
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text
                style={[typography.headlineSm, { color: theme.onSurface }]}
              >
                Title & Legal AI
              </Text>
              <MaterialIcons name="verified-user" size={24} color={theme.primary} />
            </View>

            <View
              style={[
                styles.alertBox,
                {
                  backgroundColor: 'rgba(218, 165, 32, 0.1)',
                  borderColor: 'rgba(218, 165, 32, 0.25)',
                },
              ]}
            >
              <MaterialIcons
                name="shield"
                size={24}
                color={theme.primary}
                style={{ marginRight: spacing.sm, marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: theme.onSurface,
                    marginBottom: 2,
                  }}
                >
                  Deed & EC Verification
                </Text>
                <Text
                  style={{ fontSize: 13, color: theme.onSurfaceVariant }}
                >
                  Autonomous TNREGINET audit, bilingual OCR & lien detection
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.activeReviewsRow,
                { backgroundColor: theme.surfaceContainer },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.onSurface,
                }}
              >
                Registry Status
              </Text>
              <View
                style={[
                  styles.pendingBadge,
                  { backgroundColor: '#10B981' },
                ]}
              >
                <Text
                  style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}
                >
                  ONLINE
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: theme.primary,
                marginTop: 'auto',
              }}
            >
              Verify Title Deed →
            </Text>
          </Pressable>

          {/* Row 2 */}
          {/* Blueprint Architect */}
          <Pressable
            onPress={() => router.push('/(app)/blueprint')}
            style={({ pressed, hovered }: any) => [
              styles.card,
              { padding: isWide ? spacing.xl : spacing.md },
              {
                backgroundColor: theme.surface,
                borderColor: isDark
                  ? theme.outlineVariant
                  : 'rgba(218, 165, 32, 0.35)',
                cursor: 'pointer',
              },
              isWide ? { width: Platform.OS === 'web' ? 'calc(33.333% - 16px)' : '32%' } : { width: '100%' },
              styles.blueprintCard,
              (pressed || hovered) && {
                transform: [{ scale: 1.02 }],
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 15,
                borderColor: 'rgba(218, 165, 32, 0.4)',
              },
            ]}
          >
            <View style={styles.blueprintBg}>
              <Text
                style={{ color: 'rgba(218, 165, 32, 0.1)', fontSize: 12 }}
              >
                LVG_RM: 24' x 18'
              </Text>
            </View>

            <View style={{ marginTop: 'auto' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: spacing.xs,
                }}
              >
                <MaterialIcons
                  name="architecture"
                  size={18}
                  color={theme.primary}
                />
                <Text
                  style={[
                    typography.headlineSm,
                    { color: theme.onSurface, marginLeft: 6 },
                  ]}
                >
                  Blueprint Architect
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  color: theme.onSurfaceVariant,
                  marginBottom: spacing.md,
                }}
              >
                Generate 2D/3D floor plans from simple text descriptions or
                rough sketches.
              </Text>
              <Pressable
                onPress={() => router.push('/(app)/blueprint')}
                style={({ pressed, hovered }: any) => [
                  styles.generateBtn,
                  { backgroundColor: theme.primary, cursor: 'pointer' },
                  (pressed || hovered) && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text
                  style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}
                >
                  Generate New Plan
                </Text>
              </Pressable>
            </View>
          </Pressable>

          {/* Market Predictions */}
          <Pressable
            onPress={() => router.push('/(app)/predictions')}
            style={({ pressed, hovered }: any) => [
              styles.card,
              { padding: isWide ? spacing.xl : spacing.md },
              {
                backgroundColor: theme.surface,
                borderColor: isDark
                  ? theme.outlineVariant
                  : 'rgba(218, 165, 32, 0.35)',
                cursor: 'pointer',
              },
              isWide ? { width: Platform.OS === 'web' ? 'calc(66.666% - 16px)' : '65%' } : { width: '100%' },
              styles.predictionsCard,
              (pressed || hovered) && {
                transform: [{ scale: 1.01 }],
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 15,
                borderColor: 'rgba(218, 165, 32, 0.4)',
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={{ flexShrink: 1, marginRight: spacing.md }}>
                <Text
                  style={[typography.headlineSm, { color: theme.onSurface }]}
                >
                  Market Predictions
                </Text>
                <Text
                  style={{ fontSize: 12, color: theme.onSurfaceVariant }}
                >
                  Global growth index:{' '}
                  {stats?.marketPredictions?.growthIndex}
                </Text>
              </View>
              <View
                style={[
                  styles.locationBadge,
                  { backgroundColor: theme.surfaceContainer },
                ]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: theme.onSurfaceVariant,
                  }}
                >
                  {stats?.marketPredictions?.location}
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={16}
                  color={theme.onSurfaceVariant}
                  style={{ marginLeft: 4 }}
                />
              </View>
            </View>

            {/* Chart Area */}
            <View style={styles.chartArea}>
              <Text style={styles.bullishText}>BULLISH</Text>
              <Text style={[styles.peakDate, { color: theme.primary }]}>
                PREDICTED PEAK: {stats?.marketPredictions?.peakDate}
              </Text>
              {Platform.OS === 'web' ? (
                <svg
                  width="100%"
                  height="150"
                  viewBox="0 0 800 150"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', bottom: 0, left: 0 }}
                >
                  <path
                    d="M0,100 C150,120 250,140 350,100 C450,60 550,20 650,50 C700,65 750,120 800,20"
                    fill="none"
                    stroke="#DAA520"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <Svg
                  height="150"
                  width="100%"
                  viewBox="0 0 800 150"
                  style={{ position: 'absolute', bottom: 0, left: 0 }}
                >
                  <Path
                    d="M0,100 C150,120 250,140 350,100 C450,60 550,20 650,50 C700,65 750,120 800,20"
                    fill="none"
                    stroke="#DAA520"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </Svg>
              )}
            </View>

            <View style={styles.metricsRow}>
              <View>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: theme.outline,
                    textTransform: 'uppercase',
                  }}
                >
                  Value
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: theme.onSurface,
                  }}
                >
                  {stats?.marketPredictions?.value}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: theme.outline,
                    textTransform: 'uppercase',
                  }}
                >
                  Volatility
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: theme.onSurface,
                  }}
                >
                  {stats?.marketPredictions?.volatility}
                </Text>
              </View>
              <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: theme.primary,
                    textTransform: 'uppercase',
                  }}
                >
                  Growth
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: theme.onSurface,
                  }}
                >
                  {stats?.marketPredictions?.growthPercent}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: spacing.xl },
  grid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.gutter,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -1px rgba(15, 23, 42, 0.04)',
      } as any,
    }),
  },

  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  iconBox: {
    padding: 8,
    borderRadius: radius.lg,
  },

  // Search Card
  searchCard: { flexShrink: 0 },
  searchInputWrap: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: spacing.xl,
  },
  searchInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
  },
  searchBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 8,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({ web: { transition: 'transform 0.2s ease' } as any }),
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({ web: { transition: 'all 0.2s ease' } as any }),
  },

  // Legal Card
  legalCard: { flexDirection: 'column' },
  alertBox: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  activeReviewsRow: {
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },

  // Blueprint Card
  blueprintCard: {
    position: 'relative',
    minHeight: 300,
  },
  blueprintBg: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    height: 120,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(218, 165, 32, 0.2)',
    padding: spacing.sm,
    justifyContent: 'flex-end',
  },
  generateBtn: {
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    ...Platform.select({ web: { transition: 'transform 0.2s ease' } as any }),
  },

  // Predictions Card
  predictionsCard: { minHeight: 300 },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    minHeight: 150,
    marginVertical: spacing.lg,
  },
  bullishText: {
    position: 'absolute',
    top: 40,
    left: '20%',
    fontSize: 80,
    fontWeight: '800',
    color: 'rgba(218, 165, 32, 0.05)',
  },
  peakDate: {
    position: 'absolute',
    top: 0,
    right: 20,
    fontSize: 10,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: 'auto',
  },
});