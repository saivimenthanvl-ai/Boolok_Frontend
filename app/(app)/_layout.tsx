import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Image, Platform, ScrollView, TextInput, Alert, ActivityIndicator, Keyboard, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, usePathname, Redirect, useGlobalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radius, shadows } from '../../constants/theme';
import BoolokLogo from '../../components/BoolokLogo';
import axios from 'axios';
import { API_BASE_URL, resolveImageUrl } from '../../lib/api';
import { SocketProvider, useSocket } from '../../context/SocketContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MD_BREAKPOINT = 768;

const NAV_ITEMS = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', route: '/(app)/dashboard' },
  { id: 'feed', icon: 'forum', label: 'Social Feed', route: '/(app)/feed' },
  { id: 'messages', icon: 'chat', label: 'Messages', route: '/(app)/messages' },
  { id: 'search', icon: 'search', label: 'AI Search', route: '/(app)/search' },
  { id: 'insights', icon: 'dynamic-feed', label: 'Insights Feed', route: '/(app)/insights' },
  { id: 'predictions', icon: 'trending-up', label: 'Price Predictions', route: '/(app)/predictions' },
  { id: 'legal', icon: 'verified-user', label: 'Title & Legal AI', route: '/(app)/legal' },
  { id: 'blueprint', icon: 'home-work', label: 'House Plan', route: '/(app)/blueprint' },
];

function AppLayoutContent() {
  const { width } = useWindowDimensions();
  const isWide = width >= MD_BREAKPOINT;
  const { user, token, signOut, loading: authLoading } = useAuth();
  const { unreadTotal } = useSocket();
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  const viewingOtherProfile = (pathname === '/profile' || pathname === '/(app)/profile')
    && Boolean(params.id)
    && String(params.id) !== 'self'
    && String(params.id) !== String(user?.id)
    && String(params.id) !== String(user?._id);

  const isRouteActive = (route: string) => {
    if (pathname !== route && pathname !== route.replace('/(app)', '')) return false;
    return !(route === '/(app)/profile' && viewingOtherProfile);
  };

  const navigateTo = (route: string) => {
    if (isRouteActive(route)) return;
    if (route === '/(app)/profile' && viewingOtherProfile) {
      router.push(route as any);
      return;
    }
    router.dismissTo(route as any);
  };
  const { theme, isDark, toggleTheme } = useTheme();

  // Track keyboard visibility so BottomNav doesn't obstruct inputs or sit above keyboard
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  // Smooth mobile drawer animation state
  const DRAWER_WIDTH = Math.min(width * 0.82, 320);
  const drawerTranslateX = useSharedValue(-320);
  const backdropOpacity = useSharedValue(0);
  const [drawerMounted, setDrawerMounted] = useState(false);

  const openMobileDrawer = useCallback(() => {
    setDrawerMounted(true);
    drawerTranslateX.value = -DRAWER_WIDTH;
    backdropOpacity.value = 0;
    drawerTranslateX.value = withTiming(0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(1, { duration: 250 });
  }, [DRAWER_WIDTH]);

  const closeMobileDrawer = useCallback(
    (onClosed?: () => void) => {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      drawerTranslateX.value = withTiming(
        -DRAWER_WIDTH,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(setDrawerMounted)(false);
            if (onClosed) {
              runOnJS(onClosed)();
            }
          }
        }
      );
    },
    [DRAWER_WIDTH]
  );

  const animatedDrawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerTranslateX.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const getAuthToken = async () =>
    token || (Platform.OS === 'web' ? localStorage.getItem('userToken') : await SecureStore.getItemAsync('userToken'));

  // Animation for the dark mode icon
  const rotation = useSharedValue(isDark ? 180 : 0);
  useEffect(() => {
    rotation.value = withSpring(isDark ? 180 : 0, { damping: 12 });
  }, [isDark]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  // ── Sidebar hover-expand (overlay — no layout shift) ──────────────────
  const sidebarWidth = useSharedValue(80);
  const expandOpacity = useSharedValue(0);
  const shadowOpacity = useSharedValue(0);

  const handleSidebarEnter = () => {
    sidebarWidth.value = withTiming(264, { duration: 200 });
    expandOpacity.value = withTiming(1, { duration: 160 });
    shadowOpacity.value = withTiming(1, { duration: 200 });
  };

  const handleSidebarLeave = () => {
    sidebarWidth.value = withTiming(80, { duration: 200 });
    expandOpacity.value = withTiming(0, { duration: 110 });
    shadowOpacity.value = withTiming(0, { duration: 150 });
  };

  // The overlay panel expands; the wrapper View stays 80px → zero layout shift
  const animatedSidebarStyle = useAnimatedStyle(() => ({
    width: sidebarWidth.value,
  }));

  // Labels/text fade in after panel starts opening
  const animatedExpandStyle = useAnimatedStyle(() => ({
    opacity: expandOpacity.value,
  }));

  // Fades out the solid background on hover to reveal the glass gradient
  const solidOverlayStyle = useAnimatedStyle(() => ({
    opacity: 1 - expandOpacity.value,
  }));

  // Seamless gradient that fades out perfectly on the right edge
  const glassGradient = isDark
    ? ['rgba(6, 10, 22, 1)', 'rgba(6, 10, 22, 0.98)', 'rgba(6, 10, 22, 0)'] as const
    : ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0)'] as const;

  const Sidebar = () => (
    // Fixed 80px placeholder in layout — absolutely positioned overlay expands over content
    <View style={styles.sidebarWrapper}>
      <Animated.View
        {...(Platform.OS === 'web' ? {
          onMouseEnter: handleSidebarEnter,
          onMouseLeave: handleSidebarLeave,
        } : {})}
        style={[
          styles.sidebarOverlay,
          animatedSidebarStyle,
          { backgroundColor: 'transparent' },
        ]}
      >
        {/* 1. Low-opacity gradient visible during hover (glass effect) */}
        <LinearGradient
          colors={glassGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          locations={[0, 0.8, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: -3 }]}
        />

        {/* 2. Solid dark background that fades OUT on hover */}
        <Animated.View style={[StyleSheet.absoluteFill, solidOverlayStyle, { backgroundColor: theme.surfaceContainerLowest, zIndex: -2 }]} />

        {/* Brand Header */}
        <View style={[styles.brandRow, { width: 260 }]}>
          <View style={{ width: 80, alignItems: 'center', justifyContent: 'center' }}>
            <BoolokLogo size={32} color={theme.primary} />
          </View>
          <Animated.View style={[{ width: 160 }, animatedExpandStyle]}>
            <Text style={[typography.headlineSm, { color: theme.primary, lineHeight: 28 }]} numberOfLines={1}>BOOLOK</Text>
            <Text style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, color: theme.outline, marginTop: -4 }} numberOfLines={1}>Intelligent Precision</Text>
          </Animated.View>
        </View>

        {/* Agent Active Badge */}
        <Animated.View style={[styles.agentBadge, { backgroundColor: 'rgba(218, 165, 32, 0.1)', borderColor: 'rgba(218, 165, 32, 0.2)', width: 228 }, animatedExpandStyle]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <MaterialIcons name="auto-awesome" size={14} color={theme.primary} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 }} numberOfLines={1}>
              Agent Active
            </Text>
          </View>
          <Text style={{ fontSize: 9, color: theme.onSurfaceVariant, fontWeight: '500' }} numberOfLines={1}>Scanning 16K+ Land Opportunities</Text>
        </Animated.View>

        {/* Navigation */}
        <ScrollView
          style={[styles.navContainer, { width: 260 }]}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = isRouteActive(item.route);
            return (
              <Pressable
                key={item.id}
                style={styles.navItem}
                onPress={() => navigateTo(item.route)}
              >
                {({ hovered, pressed }: any) => {
                  const color = isActive || hovered || pressed ? theme.primary : theme.onSurfaceVariant;
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: 260 }}>
                      {/* Strict text-color only state as requested */}
                      <View style={{ width: 80, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <MaterialIcons
                          name={item.icon as any}
                          size={24}
                          color={color}
                        />
                        {item.id === 'messages' && unreadTotal > 0 && (
                          <View style={{ position: 'absolute', top: -2, right: 22, backgroundColor: '#daa520', borderRadius: 7, minWidth: 15, height: 15, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
                            <Text style={{ color: '#000000', fontSize: 9, fontWeight: '900' }}>{unreadTotal > 9 ? '9+' : unreadTotal}</Text>
                          </View>
                        )}
                      </View>
                      <Animated.Text style={[typography.labelMd, { color: color, fontSize: 15, width: 140 }, animatedExpandStyle]} numberOfLines={1}>
                        {item.label}
                      </Animated.Text>
                    </View>
                  );
                }}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={[styles.sidebarBottom, { width: 260 }]}>
          <Pressable
            style={({ pressed, hovered }: any) => [styles.bottomLink, (pressed || hovered) && { opacity: 0.7 }]}
            onPress={() => { }}
          >
            <View style={{ width: 80, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="help" size={24} color={theme.onSurfaceVariant} />
            </View>
            <Animated.Text style={[typography.labelMd, { color: theme.onSurfaceVariant, width: 140 }, animatedExpandStyle]} numberOfLines={1}>Help</Animated.Text>
          </Pressable>

          <Pressable
            style={({ pressed, hovered }: any) => [styles.bottomLink, (pressed || hovered) && { opacity: 0.7 }]}
            onPress={handleLogout}
          >
            <View style={{ width: 80, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="logout" size={24} color={theme.error} />
            </View>
            <Animated.Text style={[typography.labelMd, { color: theme.error, width: 140 }, animatedExpandStyle]} numberOfLines={1}>Logout</Animated.Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );

  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);

  // Live Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      const authToken = await getAuthToken();
      if (!authToken) return;
      const res = await axios.get(`${API_BASE_URL}/api/users/notifications`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, [token, user?.id, user?._id]);

  const handleToggleNotifications = async () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState && unreadCount > 0) {
      try {
        const authToken = await getAuthToken();
        await axios.put(
          `${API_BASE_URL}/api/users/notifications/read-all`,
          {},
          { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} }
        );
        setUnreadCount(0);
      } catch (e) { }
    }
  };

  // Debounced real user search
  useEffect(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }

    const COMMUNITY_ADVISORS: Array<{
      id: string;
      _id: string;
      fullName: string;
      username: string;
      headline: string;
      location: string;
      profilePicture: string | null;
      followerCount: number;
    }> = [
        {
          id: 'shreekutti',
          _id: 'shreekutti',
          fullName: 'Shreekutti',
          username: 'shreekutti',
          headline: 'Commercial Property & Tech Park Portfolio Lead @ Boolok',
          location: 'Bangalore, Karnataka · Tech Parks',
          profilePicture: null,
          followerCount: 4,
        },
        {
          id: '6a8af34812ef34aed25ae8d2',
          _id: '6a8af34812ef34aed25ae8d2',
          fullName: 'Logeshwaran A',
          username: 'logeshwarana',
          headline: 'Architectural Consultant & Real Estate Lead',
          location: 'Western Australia',
          profilePicture: 'https://lh3.googleusercontent.com/a/ACg8ocJ_TV7-lpSTfRAQI0wc76yPHoIWaWg_5lgW-i9RxbiPx4tlFk0r=s96-c',
          followerCount: 2,
        },
        {
          id: 'ajmal',
          _id: 'ajmal',
          fullName: 'Mohammed Ajmal',
          username: 'ajmal',
          headline: 'Luxury Living & High-End Residential Broker',
          location: 'Dubai & Kochi · Luxury Villas',
          profilePicture: null,
          followerCount: 4,
        },
        {
          id: 'bavadharini_rs',
          _id: 'bavadharini_rs',
          fullName: 'Bavadharini RS',
          username: 'bavadharini_rs',
          headline: 'Interior Designer & Modern Living Specialist',
          location: 'Chennai, Tamil Nadu · Modern Living',
          profilePicture: null,
          followerCount: 4,
        },
        {
          id: 'the_akshtr_estate',
          _id: 'the_akshtr_estate',
          fullName: 'Akshat Commercials',
          username: 'the_akshtr_estate',
          headline: 'Commercial Property & Tech Park Portfolio Lead',
          location: 'Chennai, Tamil Nadu · Prime Assets',
          profilePicture: null,
          followerCount: 4,
        },
        {
          id: 'prasanth_properties',
          _id: 'prasanth_properties',
          fullName: 'Prasanth Properties',
          username: 'prasanth_properties',
          headline: 'Luxury Waterfront Specialist · Miami & Coastal Estates',
          location: 'Miami, Florida · Coastal Estates',
          profilePicture: null,
          followerCount: 4,
        },
        {
          id: 'aswin',
          _id: 'aswin',
          fullName: 'Aswin Real Estate',
          username: 'aswin',
          headline: 'Principal Real Estate Broker & Multi-Family Asset Advisor',
          location: 'Chennai, Tamil Nadu · Luxury & Commercial Assets',
          profilePicture: null,
          followerCount: 3,
        },
        {
          id: 'vignesh',
          _id: 'vignesh',
          fullName: 'Vigneshwaran',
          username: 'vignesh',
          headline: 'Prime Architectural Estates & Beverly Hills Luxury Specialist',
          location: 'Beverly Hills, California · Ultra Luxury',
          profilePicture: null,
          followerCount: 3,
        },
        {
          id: 'yashwanth',
          _id: 'yashwanth',
          fullName: 'Yashwanth',
          username: 'yashwanth',
          headline: 'Prime Commercial Hubs & Institutional Realty Lead',
          location: 'Chennai & Bangalore · Commercial Hubs',
          profilePicture: null,
          followerCount: 4,
        },
        {
          id: 'sophia_luxury',
          _id: 'sophia_luxury',
          fullName: 'Sophia Sterling',
          username: 'sophia_luxury',
          headline: 'European Family Office Principal & Luxury Syndication Client',
          location: 'Geneva, Switzerland & London · Private Capital',
          profilePicture: null,
          followerCount: 5,
        },
        {
          id: 'david_sterling',
          _id: 'david_sterling',
          fullName: 'David Sterling',
          username: 'david_sterling',
          headline: 'Managing Director · Sterling Global Capital & Asset Co-Owner',
          location: 'London, UK & Beverly Hills · Private Equity',
          profilePicture: null,
          followerCount: 6,
        },
        {
          id: 'marcus_vance',
          _id: 'marcus_vance',
          fullName: 'Marcus Vance',
          username: 'marcus_vance',
          headline: 'Institutional Real Estate Syndicate Lead & Co-Ownership Client',
          location: 'New York, NY · Real Estate Private Equity',
          profilePicture: null,
          followerCount: 4,
        },
      ];

    const BANNED_HANDLES = new Set(['aswin.realty', 'aswin_realty', 'ig_vicky16', 'ig_vicky.16', 'vicky', 'vicky_luxury', 'yashwanth_realty', 'cinemahub.live', 'cinemahub']);

    const localMatches = COMMUNITY_ADVISORS.filter((a) => {
      const u = (a.username || '').toLowerCase();
      const fn = (a.fullName || '').toLowerCase();
      if (BANNED_HANDLES.has(u) || fn.includes('vicky') || fn.includes('cinemahub')) return false;
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        a.headline.toLowerCase().includes(q) ||
        (a.location && a.location.toLowerCase().includes(q))
      );
    });

    if (user && ((user.fullName && user.fullName.toLowerCase().includes(q)) || (user.username && user.username.toLowerCase().includes(q)))) {
      localMatches.unshift({
        id: user.id || user._id || 'self',
        _id: user.id || user._id || 'self',
        fullName: user.fullName || 'Sai Vimenthan',
        username: user.username || 'saivimenthanvl',
        headline: user.headline || 'Elite Real Estate Broker & Commercial Portfolio Lead',
        location: user.location || 'Chennai, Tamil Nadu · Prime Assets',
        profilePicture: user.profilePicture || null,
        followerCount: user.followerCount || 0,
      });
    }

    setSearchResults(localMatches);

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = Platform.OS === 'web' ? localStorage.getItem('userToken') : null;
        const res = await axios.get(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(q)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.data && Array.isArray(res.data.results) && res.data.results.length > 0) {
          const sanitizedApiResults = res.data.results.filter((r: any) => {
            const u = (r.username || '').toLowerCase();
            const fn = (r.fullName || '').toLowerCase();
            return !BANNED_HANDLES.has(u) && !fn.includes('vicky') && !fn.includes('cinemahub');
          });
          const seen = new Set(sanitizedApiResults.map((r: any) => (r.username || r.id || r._id).toLowerCase()));
          const combined = [
            ...sanitizedApiResults,
            ...localMatches.filter((m) => !seen.has((m.username || m.id).toLowerCase())),
          ];
          setSearchResults(combined);
        }
      } catch (e) {
        // keep localMatches
      } finally {
        setIsSearching(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [headerSearchQuery, user]);

  const handleSelectUser = (targetUser: any) => {
    setHeaderSearchQuery('');
    setSearchResults([]);
    router.push({ pathname: '/(app)/profile', params: { id: targetUser.id || targetUser._id } } as any);
  };

  const handleGlobalSearch = () => {
    if (searchResults.length > 0) {
      handleSelectUser(searchResults[0]);
    }
  };

  const MOBILE_NAV_ITEMS = [
    { id: 'dashboard', icon: 'dashboard', label: 'Home', route: '/(app)/dashboard' },
    { id: 'feed', icon: 'forum', label: 'Social', route: '/(app)/feed' },
    { id: 'messages', icon: 'chat', label: 'Chat', route: '/(app)/messages' },
    { id: 'search', icon: 'search', label: 'Search', route: '/(app)/search' },
    { id: 'insights', icon: 'dynamic-feed', label: 'Reels', route: '/(app)/insights' },
    { id: 'profile', icon: 'person', label: 'Profile', route: '/(app)/profile' },
  ];

  const BottomNav = () => {
    const insets = useSafeAreaInsets();
    const activeNavItems = MOBILE_NAV_ITEMS;

    return (
      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 10), borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', ...(!isDark ? shadows.md : {}) }]}>
        <BlurView
          intensity={isDark ? 50 : 80}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(10, 15, 35, 0.85)' : 'rgba(255, 255, 255, 0.92)' }]}
        />
        <View style={styles.bottomNavInner}>
          {activeNavItems.map(item => {
            const isActive = isRouteActive(item.route);

            return (
              <Pressable
                key={item.id}
                style={styles.bottomNavItem}
                onPress={() => navigateTo(item.route)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={{ position: 'relative' }}>
                  <MaterialIcons name={item.icon as any} size={24} color={isActive ? theme.primary : theme.onSurfaceVariant} />
                  {item.id === 'messages' && unreadTotal > 0 && (
                    <View style={{ position: 'absolute', top: -3, right: -6, backgroundColor: '#daa520', borderRadius: 6, minWidth: 14, height: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
                      <Text style={{ color: '#000000', fontSize: 8, fontWeight: '900' }}>{unreadTotal > 9 ? '9+' : unreadTotal}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 10, marginTop: 4, color: isActive ? theme.primary : theme.onSurfaceVariant, fontWeight: isActive ? '800' : '500' }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const ALL_FEATURES_NAV = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', route: '/(app)/dashboard', category: 'Main' },
    { id: 'feed', icon: 'forum', label: 'Social Feed', route: '/(app)/feed', category: 'Main' },
    { id: 'messages', icon: 'chat', label: 'Direct Messages', route: '/(app)/messages', category: 'Main', badge: unreadTotal },
    { id: 'search', icon: 'search', label: 'AI Search', route: '/(app)/search', category: 'Main' },
    { id: 'insights', icon: 'dynamic-feed', label: 'Video Reels & Insights', route: '/(app)/insights', category: 'Main' },
    { id: 'predictions', icon: 'trending-up', label: 'Price Predictions', route: '/(app)/predictions', category: 'AI Intelligence', tag: 'AI' },
    { id: 'legal', icon: 'verified-user', label: 'Title & Legal Verification', route: '/(app)/legal', category: 'AI Intelligence', tag: 'AI' },
    { id: 'blueprint', icon: 'home-work', label: 'House Plan & Blueprint', route: '/(app)/blueprint', category: 'AI Intelligence', tag: 'PRO' },
    { id: 'profile', icon: 'person', label: 'My Portfolio', route: '/(app)/profile', category: 'Account' },
    { id: 'settings', icon: 'settings', label: 'Settings', route: '/(app)/settings', category: 'Account' },
  ];

  const MobileSideDrawer = () => {
    if (!drawerMounted || isWide) return null;

    const drawerBg = isDark ? '#080e1a' : '#FFFFFF';
    const cardBg = isDark ? '#0f1a2e' : '#F1F5F9';
    const borderColor = isDark ? '#1a273c' : '#E2E8F0';

    const handleNavigate = (route: string) => {
      closeMobileDrawer(() => navigateTo(route));
    };

    return (
      <Modal
        visible={drawerMounted && !isWide}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
        onRequestClose={() => closeMobileDrawer()}
      >
        <View style={mobileDrawerStyles.modalOverlay}>
          {/* Backdrop with animated opacity */}
          <AnimatedPressable
            style={[mobileDrawerStyles.backdrop, animatedBackdropStyle]}
            onPress={() => closeMobileDrawer()}
          />

          {/* Drawer Body (Sliding Container driven by UI-thread Reanimated) */}
          <Animated.View
            style={[
              mobileDrawerStyles.drawerContainer,
              animatedDrawerStyle,
              {
                backgroundColor: drawerBg,
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: Math.max(insets.bottom, 16),
                borderRightColor: borderColor,
              }
            ]}
          >
            {/* Header: Brand & Close Button */}
            <View style={[mobileDrawerStyles.drawerHeader, { borderBottomColor: borderColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BoolokLogo size={28} color={theme.primary} />
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: theme.primary, letterSpacing: 1 }}>BOOLOK</Text>
                  <Text style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 1.5, color: theme.onSurfaceVariant, marginTop: -2 }}>
                    Intelligent Precision
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => closeMobileDrawer()}
                style={({ pressed }: any) => [
                  mobileDrawerStyles.closeBtn,
                  { backgroundColor: cardBg, borderColor },
                  pressed && { opacity: 0.7 }
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={20} color={theme.onSurface} />
              </Pressable>
            </View>

            {/* User Mini Card */}
            <Pressable
              onPress={() => handleNavigate('/(app)/profile')}
              style={[mobileDrawerStyles.userCard, { backgroundColor: cardBg, borderColor }]}
            >
              {(() => {
                const navAvatar = resolveImageUrl(user?.profilePicture);
                if (navAvatar) {
                  return <Image source={{ uri: navAvatar }} style={mobileDrawerStyles.userAvatar} />;
                }
                return (
                  <View style={[mobileDrawerStyles.userAvatar, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: theme.onPrimary, fontSize: 16, fontWeight: 'bold' }}>
                      {(user?.fullName || 'Agent').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                );
              })()}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: theme.onSurface }} numberOfLines={1}>
                  {user?.fullName || 'Real Estate Advisor'}
                </Text>
                <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600', marginTop: 1 }}>
                  @{user?.username || 'member'} · Elite Advisor
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.onSurfaceVariant} />
            </Pressable>

            {/* Feature Navigation List */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
              {/* Category: Main Features */}
              <Text style={[mobileDrawerStyles.sectionHeader, { color: theme.onSurfaceVariant }]}>FEATURES</Text>
              {ALL_FEATURES_NAV.filter(item => item.category === 'Main').map(item => {
                const isActive = isRouteActive(item.route);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleNavigate(item.route)}
                    style={({ pressed }: any) => [
                      mobileDrawerStyles.drawerNavItem,
                      isActive && { backgroundColor: isDark ? 'rgba(218, 165, 32, 0.12)' : 'rgba(218, 165, 32, 0.1)', borderLeftColor: theme.primary, borderLeftWidth: 4 },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={{ position: 'relative', width: 28, alignItems: 'center' }}>
                      <MaterialIcons name={item.icon as any} size={22} color={isActive ? theme.primary : theme.onSurfaceVariant} />
                      {item.id === 'messages' && unreadTotal > 0 && (
                        <View style={mobileDrawerStyles.unreadBadge}>
                          <Text style={{ color: '#000000', fontSize: 8, fontWeight: '900' }}>{unreadTotal > 9 ? '9+' : unreadTotal}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[
                      mobileDrawerStyles.navItemText,
                      { color: isActive ? theme.primary : theme.onSurface, fontWeight: isActive ? '800' : '600' }
                    ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Category: AI Intelligence Tools */}
              <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 10, marginHorizontal: 16 }} />
              <Text style={[mobileDrawerStyles.sectionHeader, { color: theme.primary }]}>AI INTELLIGENCE & SUITE</Text>
              {ALL_FEATURES_NAV.filter(item => item.category === 'AI Intelligence').map(item => {
                const isActive = isRouteActive(item.route);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleNavigate(item.route)}
                    style={({ pressed }: any) => [
                      mobileDrawerStyles.drawerNavItem,
                      isActive && { backgroundColor: isDark ? 'rgba(218, 165, 32, 0.12)' : 'rgba(218, 165, 32, 0.1)', borderLeftColor: theme.primary, borderLeftWidth: 4 },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={{ width: 28, alignItems: 'center' }}>
                      <MaterialIcons name={item.icon as any} size={22} color={theme.primary} />
                    </View>
                    <Text style={[
                      mobileDrawerStyles.navItemText,
                      { color: isActive ? theme.primary : theme.onSurface, fontWeight: isActive ? '800' : '600' }
                    ]}>
                      {item.label}
                    </Text>
                    {item.tag && (
                      <View style={[mobileDrawerStyles.tagBadge, { backgroundColor: item.tag === 'PRO' ? '#8b5cf6' : theme.primary }]}>
                        <Text style={{ color: item.tag === 'PRO' ? '#ffffff' : '#000000', fontSize: 9, fontWeight: '900' }}>{item.tag}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {/* Category: Account */}
              <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 10, marginHorizontal: 16 }} />
              <Text style={[mobileDrawerStyles.sectionHeader, { color: theme.onSurfaceVariant }]}>PREFERENCES</Text>
              {ALL_FEATURES_NAV.filter(item => item.category === 'Account').map(item => {
                const isActive = isRouteActive(item.route);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleNavigate(item.route)}
                    style={({ pressed }: any) => [
                      mobileDrawerStyles.drawerNavItem,
                      isActive && { backgroundColor: isDark ? 'rgba(218, 165, 32, 0.12)' : 'rgba(218, 165, 32, 0.1)', borderLeftColor: theme.primary, borderLeftWidth: 4 },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={{ width: 28, alignItems: 'center' }}>
                      <MaterialIcons name={item.icon as any} size={22} color={isActive ? theme.primary : theme.onSurfaceVariant} />
                    </View>
                    <Text style={[
                      mobileDrawerStyles.navItemText,
                      { color: isActive ? theme.primary : theme.onSurface, fontWeight: isActive ? '800' : '600' }
                    ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Bottom Actions: Theme Toggle & Logout */}
            <View style={[mobileDrawerStyles.drawerFooter, { borderTopColor: borderColor }]}>
              <Pressable
                onPress={toggleTheme}
                style={[mobileDrawerStyles.footerActionBtn, { backgroundColor: cardBg, borderColor }]}
              >
                <MaterialIcons name={isDark ? "dark-mode" : "light-mode"} size={18} color={theme.primary} />
                <Text style={{ color: theme.onSurface, fontSize: 12, fontWeight: '700', marginLeft: 6 }}>
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  closeMobileDrawer(() => {
                    handleLogout();
                  });
                }}
                style={[mobileDrawerStyles.footerActionBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
              >
                <MaterialIcons name="logout" size={18} color={theme.error} />
                <Text style={{ color: theme.error, fontSize: 12, fontWeight: '700', marginLeft: 6 }}>
                  Logout
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  const insets = useSafeAreaInsets();

  // ── Auth Guard (Placed after all hooks to comply with React Rules of Hooks) ──
  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#060b13', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#daa520" />
      </View>
    );
  }

  // If auth has resolved and user is NOT authenticated, redirect to login
  if (!user || !token) {
    return <Redirect href="/(auth)/login" />;
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: theme.surface }]}>
      {isWide && <Sidebar />}
      {/* mainContent fills all remaining space; sidebar overlay floats above it */}
      <View style={styles.mainContent}>
        <View style={[styles.header, {
          paddingHorizontal: isWide ? spacing.lg : 12,
          borderBottomColor: isDark ? theme.outlineVariant : '#E2E8F0',
          backgroundColor: isDark ? 'rgba(10, 15, 35, 0.85)' : '#FFFFFF',
          paddingTop: insets.top,
          height: (isWide ? 80 : 64) + insets.top,
          zIndex: 100,
          ...(!isDark ? shadows.xs : {}),
        }]}>
          {/* Header Left: Brand logo & Greeting OR Mobile Search Bar */}
          {isWide ? (
            <View style={{ flexShrink: 0, minWidth: 160, marginRight: spacing.md }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.onSurface }} numberOfLines={1}>
                Welcome back, {user?.fullName?.split(' ')[0] || 'Sai'}
              </Text>
              <Text style={{ fontSize: 12, color: theme.onSurfaceVariant, fontWeight: '500' }}>Real Estate Intelligence</Text>
            </View>
          ) : !isMobileSearchActive ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 }}>
              <Pressable
                onPress={openMobileDrawer}
                style={({ pressed }: any) => [
                  { padding: 6, marginRight: 4, borderRadius: 8 },
                  pressed && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="menu" size={24} color={theme.onSurface} />
              </Pressable>
              <Pressable onPress={() => router.dismissTo('/(app)/dashboard')} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                <BoolokLogo size={24} color={theme.primary} />
                <Text style={{ fontSize: 15, fontWeight: '900', color: theme.primary, letterSpacing: 1, marginLeft: 5 }}>
                  BOOLOK
                </Text>
              </Pressable>
              <View style={{ flexShrink: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.onSurface }} numberOfLines={1}>
                  Hi, {user?.fullName?.split(' ')[0] || 'Sai'}
                </Text>
                <Text style={{ fontSize: 9.5, color: theme.onSurfaceVariant, fontWeight: '500' }} numberOfLines={1}>
                  Elite Advisor
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6, position: 'relative', zIndex: 999 }}>
              <Pressable
                onPress={() => {
                  setIsMobileSearchActive(false);
                  setHeaderSearchQuery('');
                  setSearchResults([]);
                }}
                style={{ padding: 6, marginRight: 4, borderRadius: 8 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="arrow-back" size={24} color={theme.onSurface} />
              </Pressable>
              <View style={[styles.searchBar, { flex: 1, height: 42, backgroundColor: theme.surfaceContainerLowest, borderColor: '#daa520' }]}>
                <MaterialIcons name="search" size={20} color="#daa520" />
                <TextInput
                  style={{ color: theme.onSurface, marginLeft: 8, fontSize: 14, flex: 1, height: '100%', outlineStyle: 'none' } as any}
                  placeholder="Search agents, brokers, or profiles..."
                  placeholderTextColor={theme.outline}
                  value={headerSearchQuery}
                  onChangeText={setHeaderSearchQuery}
                  autoFocus={true}
                  onSubmitEditing={() => {
                    if (searchResults.length > 0) {
                      setIsMobileSearchActive(false);
                      handleSelectUser(searchResults[0]);
                    } else if (headerSearchQuery.trim()) {
                      setIsMobileSearchActive(false);
                      const q = headerSearchQuery.trim();
                      setHeaderSearchQuery('');
                      router.push({ pathname: '/(app)/search', params: { q, filter: 'Profiles' } } as any);
                    }
                  }}
                />
                {isSearching && <ActivityIndicator size="small" color="#daa520" style={{ marginRight: 4 }} />}
                {headerSearchQuery.length > 0 && (
                  <Pressable onPress={() => setHeaderSearchQuery('')} style={{ padding: 4 }}>
                    <MaterialIcons name="close" size={18} color={theme.onSurfaceVariant} />
                  </Pressable>
                )}
              </View>

              {/* Mobile Real-time Autocomplete Dropdown */}
              {headerSearchQuery.trim().length > 0 && (
                <View style={[
                  styles.autocompleteDropdown,
                  {
                    position: 'absolute',
                    top: 48,
                    left: 0,
                    right: 0,
                    backgroundColor: isDark ? '#0c1626' : '#ffffff',
                    borderColor: theme.outlineVariant,
                    maxHeight: 380,
                    zIndex: 9999,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                  }
                ]}>
                  {searchResults.length > 0 ? (
                    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
                      {searchResults.map((u: any, idx: number) => {
                        const initial = (u.fullName || u.username || 'U')[0]?.toUpperCase();
                        return (
                          <Pressable
                            key={u.id || u._id || idx}
                            style={({ pressed, hovered }: any) => [
                              styles.dropdownItem,
                              { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: idx < searchResults.length - 1 ? 1 : 0, borderBottomColor: isDark ? '#1a273c' : '#f0f0f0' },
                              (pressed || hovered) && { backgroundColor: isDark ? '#162338' : '#f8f9fa' }
                            ]}
                            onPress={() => {
                              setIsMobileSearchActive(false);
                              handleSelectUser(u);
                            }}
                          >
                            {resolveImageUrl(u.profilePicture) ? (
                              <Image source={{ uri: resolveImageUrl(u.profilePicture)! }} style={{ width: 34, height: 34, borderRadius: 17, marginRight: 10 }} />
                            ) : (
                              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#daa520' }}>
                                <Text style={{ color: '#daa520', fontWeight: '700', fontSize: 14 }}>{initial}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ color: theme.onSurface, fontSize: 14, fontWeight: '700' }}>{u.fullName}</Text>
                                <MaterialIcons name="verified" size={14} color="#daa520" style={{ marginLeft: 4 }} />
                              </View>
                              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11 }}>@{u.username} · {u.followerCount || 0} followers</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={18} color={theme.outline} />
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : !isSearching ? (
                    <View style={[styles.dropdownItem, { padding: 14 }]}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 13 }}>No profiles found matching "{headerSearchQuery}"</Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      setIsMobileSearchActive(false);
                      const q = headerSearchQuery.trim();
                      setHeaderSearchQuery('');
                      router.push({ pathname: '/(app)/search', params: { q, filter: 'Profiles' } } as any);
                    }}
                    style={{ padding: 12, borderTopWidth: 1, borderTopColor: isDark ? '#1a273c' : '#f0f0f0', alignItems: 'center', backgroundColor: isDark ? '#0f1a2e' : '#f8fafc', borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}
                  >
                    <Text style={{ color: '#daa520', fontSize: 12, fontWeight: '700' }}>
                      Search all in AI Search Hub →
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {isWide && (
            <View style={{ position: 'relative', flex: 1, maxWidth: 600, marginHorizontal: spacing.xl, zIndex: 100 }}>
              <View style={[styles.searchBar, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
                <MaterialIcons name="search" size={20} color={theme.outline} />
                <TextInput
                  style={{ color: theme.onSurface, marginLeft: 8, fontSize: 14, flex: 1, height: '100%', outlineStyle: 'none' } as any}
                  placeholder="Search agents, brokers, or clients..."
                  placeholderTextColor={theme.outline}
                  value={headerSearchQuery}
                  onChangeText={setHeaderSearchQuery}
                  onSubmitEditing={handleGlobalSearch}
                />
                {isSearching && <Text style={{ fontSize: 11, color: theme.primary, marginRight: 8 }}>Searching...</Text>}
              </View>

              {/* Real-time Autocomplete Dropdown */}
              {headerSearchQuery.trim().length > 0 && (
                <View style={[styles.autocompleteDropdown, { backgroundColor: isDark ? '#0c1626' : '#ffffff', borderColor: theme.outlineVariant, maxHeight: 360, zIndex: 999 }]}>
                  {searchResults.length > 0 ? (
                    searchResults.map((u: any, idx: number) => {
                      const initial = (u.fullName || u.username || 'U')[0]?.toUpperCase();
                      return (
                        <Pressable
                          key={u.id || u._id || idx}
                          style={({ pressed, hovered }: any) => [
                            styles.dropdownItem,
                            { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: idx < searchResults.length - 1 ? 1 : 0, borderBottomColor: isDark ? '#1a273c' : '#f0f0f0' },
                            (pressed || hovered) && { backgroundColor: isDark ? '#162338' : '#f8f9fa' }
                          ]}
                          onPress={() => handleSelectUser(u)}
                        >
                          {resolveImageUrl(u.profilePicture) ? (
                            <Image source={{ uri: resolveImageUrl(u.profilePicture)! }} style={{ width: 34, height: 34, borderRadius: 17, marginRight: 10 }} />
                          ) : (
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#daa520' }}>
                              <Text style={{ color: '#daa520', fontWeight: '700', fontSize: 14 }}>{initial}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ color: theme.onSurface, fontSize: 14, fontWeight: '700' }}>{u.fullName}</Text>
                              <MaterialIcons name="verified" size={14} color="#daa520" style={{ marginLeft: 4 }} />
                            </View>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: 11 }}>@{u.username} · {u.followerCount || 0} followers</Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={18} color={theme.outline} />
                        </Pressable>
                      );
                    })
                  ) : !isSearching ? (
                    <View style={[styles.dropdownItem, { padding: 14 }]}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 13 }}>No users found matching "{headerSearchQuery}"</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {(!isMobileSearchActive || isWide) && (
            <View style={styles.headerActions}>
              {/* Quick search on mobile */}
              {!isWide && (
                <Pressable onPress={() => setIsMobileSearchActive(true)} style={styles.iconBtn}>
                  <MaterialIcons name="search" size={22} color={theme.onSurfaceVariant} />
                </Pressable>
              )}

            {/* Direct Messages Icon Button */}
            <View style={{ position: 'relative' }}>
              <Pressable onPress={() => router.dismissTo('/(app)/messages')} style={styles.iconBtn}>
                <MaterialIcons name="chat" size={22} color={pathname?.includes('messages') ? theme.primary : theme.onSurfaceVariant} />
                {unreadTotal > 0 && (
                  <View style={[styles.notificationDot, { backgroundColor: '#daa520', borderColor: theme.surface, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#000000', fontSize: 9, fontWeight: '800' }}>{unreadTotal > 9 ? '9+' : unreadTotal}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={{ position: 'relative' }}>
              <Pressable onPress={handleToggleNotifications} style={styles.iconBtn}>
                <MaterialIcons name="notifications" size={22} color={showNotifications ? theme.primary : theme.onSurfaceVariant} />
                {unreadCount > 0 && (
                  <View style={[styles.notificationDot, { backgroundColor: '#ef4444', borderColor: theme.surface, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '800' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </Pressable>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <View style={{
                  position: 'absolute',
                  top: 44,
                  right: isWide ? 0 : -60,
                  width: Math.min(width - 24, 320),
                  maxHeight: 400,
                  backgroundColor: isDark ? '#0c1626' : '#ffffff',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.outlineVariant,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  elevation: 10,
                  zIndex: 9999,
                  overflow: 'hidden',
                }}>
                  <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: isDark ? '#1a273c' : '#f0f0f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: 14 }}>Notifications</Text>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: 11 }}>Real-time updates</Text>
                  </View>
                  <ScrollView style={{ maxHeight: 320 }}>
                    {notifications.length > 0 ? (
                      notifications.map((n: any, idx: number) => {
                        const sender = n.sender || {};
                        const initial = (sender.fullName || sender.username || 'U')[0]?.toUpperCase();
                        return (
                          <Pressable
                            key={n._id || idx}
                            style={({ pressed, hovered }: any) => [
                              { padding: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#142033' : '#f5f5f5', flexDirection: 'row', alignItems: 'center' },
                              !n.read && { backgroundColor: isDark ? 'rgba(218, 165, 32, 0.08)' : 'rgba(218, 165, 32, 0.05)' },
                              (pressed || hovered) && { backgroundColor: isDark ? '#162338' : '#f8f9fa' },
                            ]}
                            onPress={() => {
                              setShowNotifications(false);
                              if (sender._id || sender.id) {
                                router.push({ pathname: '/(app)/profile', params: { id: sender._id || sender.id } } as any);
                              }
                            }}
                          >
                            {resolveImageUrl(sender.profilePicture) ? (
                              <Image source={{ uri: resolveImageUrl(sender.profilePicture)! }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
                            ) : (
                              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#daa520', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                <Text style={{ color: '#000000', fontWeight: '800', fontSize: 13 }}>{initial}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.onSurface, fontSize: 12, lineHeight: 16 }}>{n.message}</Text>
                              <Text style={{ color: theme.outline, fontSize: 10, marginTop: 2 }}>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                          </Pressable>
                        );
                      })
                    ) : (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <MaterialIcons name="notifications-none" size={32} color={theme.outline} style={{ marginBottom: 6 }} />
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: 12 }}>No new notifications</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            <Pressable onPress={toggleTheme} style={styles.iconBtn}>
              <Animated.View style={animatedIconStyle}>
                <MaterialIcons name={isDark ? "dark-mode" : "light-mode"} size={22} color={theme.onSurfaceVariant} />
              </Animated.View>
            </Pressable>

            {isWide && (
              <Pressable
                style={({ pressed, hovered }: any) => [
                  styles.upgradeBtnSmall,
                  (pressed || hovered) ? { backgroundColor: theme.primary } : { backgroundColor: 'rgba(218, 165, 32, 0.1)', borderColor: 'rgba(218, 165, 32, 0.2)' }
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>Upgrade Pro</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => router.push('/(app)/profile')}
              style={({ pressed, hovered }: any) => [
                styles.profileSection,
                isWide ? { borderLeftColor: theme.outlineVariant } : { borderLeftWidth: 0, paddingLeft: 4 },
                (pressed || hovered) && { backgroundColor: theme.surfaceContainerLowest }
              ]}
            >
              {isWide && (
                <View style={{ alignItems: 'flex-end', marginRight: spacing.sm }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.onSurface }}>{user?.fullName?.split(' ')[0] || 'Agent'}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary, textTransform: 'uppercase' }}>Elite Agent</Text>
                </View>
              )}

              {(() => {
                const navAvatar = resolveImageUrl(user?.profilePicture);
                if (navAvatar) {
                  return (
                    <Image
                      source={{ uri: navAvatar }}
                      style={[styles.profileImage, !isWide && { width: 34, height: 34, borderRadius: 17 }]}
                    />
                  );
                }
                return (
                  <View style={[styles.profileImage, !isWide && { width: 34, height: 34, borderRadius: 17 }, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }]}>
                    <Text style={{ color: theme.onPrimary, fontSize: isWide ? 18 : 14, fontWeight: 'bold' }}>
                      {(user?.fullName || 'Agent').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                );
              })()}

              {isWide && (
                <Pressable
                  onPress={() => router.dismissTo('/(app)/settings')}
                  style={({ pressed, hovered }: any) => [
                    { marginLeft: spacing.sm, padding: 4, borderRadius: 20, flexShrink: 0 },
                    (pressed || hovered) && { backgroundColor: theme.surfaceContainer }
                  ]}
                >
                  <MaterialIcons name="settings" size={24} color={theme.onSurfaceVariant} />
                </Pressable>
              )}
            </Pressable>
          </View>
          )}
        </View>

        {(() => {
          const isMessages = pathname?.includes('messages');
          const isChatActive = isMessages && Boolean(params.conv || params.userId || params.username);
          const shouldHideBottomNav = !isWide && (isKeyboardVisible || isChatActive);

          return (
            <>
              <View style={[
                styles.slotContainer,
                {
                  backgroundColor: isDark ? '#060B13' : '#F8FAFC',
                  flex: 1,
                  paddingBottom: (!isWide && !shouldHideBottomNav) ? (56 + Math.max(insets.bottom, 10)) : 0,
                }
              ]}>
                <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: isDark ? '#060B13' : '#F8FAFC', flex: 1, height: '100%' } }} />
              </View>

              {!isWide && !shouldHideBottomNav && <BottomNav />}
              {!isWide && <MobileSideDrawer />}
            </>
          );
        })()}
      </View>
    </View>
  );
}

export default function AppLayout() {
  return (
    <SocketProvider>
      <AppLayoutContent />
    </SocketProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: '100%',
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mainContent: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  slotContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({ web: { transition: 'background-color 0.3s ease' } as any }),
  },
  // Fixed 80px placeholder — keeps the layout slot but never changes size
  sidebarWrapper: {
    width: 80,
    height: '100%',
    position: 'relative',
    zIndex: 200,
  },
  // The actual expanding panel — absolutely positioned, floats over content
  sidebarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    paddingVertical: spacing.md,
    flexDirection: 'column',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
    marginBottom: spacing.xl,
  },
  agentBadge: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  navContainer: {
    flex: 1,
  },
  navItem: {
    paddingVertical: 14,
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({ web: { transition: 'all 0.2s ease' } as any }),
  },
  sidebarBottom: {
    paddingRight: spacing.md,
    paddingTop: spacing.md,
  },
  proPlanCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  upgradeBtn: {
    borderRadius: radius.lg,
    paddingVertical: 8,
    alignItems: 'center',
    ...Platform.select({ web: { transition: 'transform 0.2s ease' } as any }),
  },
  bottomLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    ...Platform.select({ web: { transition: 'opacity 0.2s ease' } as any }),
  },
  header: {
    height: 80,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    zIndex: 10,
    ...Platform.select({ web: { transition: 'all 0.3s ease' } as any }),
  },
  searchBar: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    ...Platform.select({ web: { transition: 'all 0.3s ease' } as any }),
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    zIndex: 100,
  },
  bottomNavInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  autocompleteDropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
    marginRight: 4,
    borderRadius: 20,
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  upgradeBtnSmall: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginRight: spacing.md,
    ...Platform.select({ web: { transition: 'all 0.2s ease' } as any }),
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    paddingLeft: spacing.md,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(218, 165, 32, 0.3)',
  },
});

const mobileDrawerStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 1,
  },
  drawerContainer: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    zIndex: 2,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingHorizontal: 18,
    marginTop: 10,
    marginBottom: 6,
  },
  drawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  navItemText: {
    fontSize: 13.5,
    marginLeft: 12,
    flex: 1,
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: '#daa520',
    borderRadius: 6,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  drawerFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 8,
  },
  footerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});

