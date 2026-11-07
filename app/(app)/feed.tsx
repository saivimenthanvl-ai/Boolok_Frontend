import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Platform,
  useWindowDimensions,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { savedReelsKey, userStorageId } from '../../lib/savedStorage';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radius } from '../../constants/theme';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import LoadingScreen from '../../components/LoadingScreen';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import BoolokLogo from '../../components/BoolokLogo';
import { API_BASE_URL, resolveImageUrl } from '../../lib/api';
import { formatSmartDateTime } from '../../lib/dateTime';

// ── Real Estate & Buildings For Sale News ───────────────────────────────────
const DEFAULT_REAL_ESTATE_NEWS = [
  {
    id: 'news-1',
    title: 'Commercial Office Towers Surge in London & NYC',
    time: '9h ago',
    readers: '22,392 readers',
    category: 'Commercial Real Estate',
    summary:
      'Institutional investors and private equity funds have deployed more than $14.6B into trophy Grade-A commercial office towers across London’s City core and New York’s Midtown corridor this quarter.',
    content:
      'The global commercial office landscape is undergoing a decisive renaissance driven by institutional capital pivot toward high-efficiency, amenity-rich properties. In Central London and Manhattan, prime yields have stabilized around 5.2% to 5.75%, encouraging institutional REITs to close multi-hundred-million-dollar transactions.',
    sourceName: 'Financial Times Property & Bloomberg Real Estate',
    sourceUrl: 'https://www.bloomberg.com/real-estate',
  },
  {
    id: 'news-2',
    title: 'Top 10 Prime Commercial Buildings For Sale in 2026',
    time: '9h ago',
    readers: '14,976 readers',
    category: 'Property Listings',
    summary:
      'Exclusive institutional showcase reveals high-cap-rate tech parks, corporate headquarters, and mixed-use towers currently listed for acquisition across global financial hubs.',
    content:
      'A curated catalog of premier commercial developments has arrived on the market this quarter, headlined by Outer Ring Road Tech Campus, Margaret River Estate, and Bishopsgate Corporate Tower.',
    sourceName: 'Boolok Institutional Asset Index & RERA Commercial',
    sourceUrl: 'https://www.cbre.com/insights',
  },
  {
    id: 'news-3',
    title: 'Boolok AI Property Valuation Index Hits Record High',
    time: '57m ago',
    readers: '8,709 readers',
    category: 'AI Market Intelligence',
    summary:
      'Boolok’s proprietary neural real estate appraisal algorithm recorded an all-time high valuation confidence score across 45,000 multi-family and commercial properties.',
    content:
      'By synthesizing spatial computer vision, municipal tax records, and live footfall telemetry, the Boolok AI Valuation Index delivers 4x faster institutional underwriting with 99% accuracy on cap rate trends.',
    sourceName: 'Boolok AI Research & MIT Center for Real Estate',
    sourceUrl: 'https://cre.mit.edu',
  },
  {
    id: 'news-4',
    title: 'Waterfront Luxury Estates See Record Institutional Influx',
    time: '6h ago',
    readers: '6,387 readers',
    category: 'Luxury Real Estate',
    summary:
      'Private family offices and sovereign wealth vehicles allocated $4.2B into trophy beachfront residences and private island compounds.',
    content:
      'Ultra-high-net-worth liquidity continues to migrate into resilient coastal real estate assets with deeded deepwater yacht docks and private helipads across Miami Beach, Palm Jumeirah, and coastal Australia.',
    sourceName: 'Knight Frank Global Wealth & Luxury Estates Review',
    sourceUrl: 'https://www.knightfrank.com/research',
  },
  {
    id: 'news-5',
    title: 'Retail-to-Residential Conversions Accelerating in Metros',
    time: '6h ago',
    readers: '3,158 readers',
    category: 'Urban Redevelopment',
    summary:
      'Municipal zoning modernizations across Tier-1 cities are expediting the adaptive reuse of suburban shopping centres into dynamic master-planned residential communities.',
    content:
      'Developers are seizing opportunities to convert underperforming retail and commercial malls into high-density urban residential hubs with expedited RERA permits and tax-increment financing.',
    sourceName: 'Urban Land Institute (ULI) Emerging Trends',
    sourceUrl: 'https://americas.uli.org',
  },
  {
    id: 'news-6',
    title: 'Singapore Grade-A Tech Parks Attract $1.2B Capital Inflow',
    time: '12h ago',
    readers: '5,420 readers',
    category: 'Global Assets',
    summary:
      'Cross-border real estate investment trusts (REITs) acquired three major business park clusters in Singapore’s One-North science district.',
    content:
      'Buoyed by robust biomedical and generative AI enterprise expansions, Singapore’s institutional tech park occupancy sits at 96.2%, solidifying Southeast Asia’s premier position for commercial capital security.',
    sourceName: 'JLL Global Real Estate Intelligence',
    sourceUrl: 'https://www.jll.com/trends-and-insights',
  },
];

// ── Dynamic Avatar Component ────────────────────────────────────────────────
const UserAvatar = ({
  user,
  size = 42,
  style,
}: {
  user: any;
  size?: number;
  style?: any;
}) => {
  let profilePicture = user?.profilePicture || user?.avatar;
  const name = user?.fullName || user?.username || 'User';
  const initial = (name[0] || 'U').toUpperCase();

  const colors = [
    '#ea580c', '#2563eb', '#059669', '#7c3aed', '#db2777', '#ca8a04', '#0891b2',
  ];
  const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(name.length - 1) || 0);
  const bgColor = colors[charCode % colors.length];

  if (profilePicture && typeof profilePicture === 'string' && (profilePicture.startsWith('http') || profilePicture.startsWith('data:') || profilePicture.startsWith('/'))) {
    const fullUri = profilePicture.startsWith('/') ? `${API_BASE_URL}${profilePicture}` : profilePicture;
    return (
      <Image
        source={{ uri: fullUri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: size * 0.44 }}>
        {initial}
      </Text>
    </View>
  );
};

const FRAME_RATIOS = [
  { label: '1:1', name: 'Square', value: 1 / 1 },
  { label: '16:9', name: 'Wide Landscape', value: 16 / 9 },
  { label: '4:3', name: 'Standard', value: 4 / 3 },
  { label: '4:5', name: 'Portrait', value: 4 / 5 },
  { label: '9:16', name: 'Story / Reel', value: 9 / 16 },
];

const cropAndFrameImage = (
  imageUri: string,
  aspectRatio: number,
  zoom: number,
  panX: number,
  panY: number,
  rotation: number
): Promise<string> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      resolve(imageUri);
      return;
    }

    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width || 1200;
        const origH = img.naturalHeight || img.height || 1200;

        let targetW = 1200;
        let targetH = Math.round(targetW / aspectRatio);

        if (targetH > 1600) {
          targetH = 1600;
          targetW = Math.round(targetH * aspectRatio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUri);
          return;
        }

        ctx.fillStyle = '#060b13';
        ctx.fillRect(0, 0, targetW, targetH);

        ctx.save();
        ctx.translate(targetW / 2, targetH / 2);
        ctx.rotate((rotation * Math.PI) / 180);

        const isSwapped = rotation === 90 || rotation === 270;
        const effectiveOrigW = isSwapped ? origH : origW;
        const effectiveOrigH = isSwapped ? origW : origH;

        const scaleToCover = Math.max(targetW / effectiveOrigW, targetH / effectiveOrigH);
        const finalScale = scaleToCover * zoom;

        const drawW = origW * finalScale;
        const drawH = origH * finalScale;

        const maxPanX = Math.max(0, (drawW - targetW) / 2);
        const maxPanY = Math.max(0, (drawH - targetH) / 2);
        const shiftX = panX * maxPanX;
        const shiftY = panY * maxPanY;

        ctx.drawImage(img, -drawW / 2 + shiftX, -drawH / 2 + shiftY, drawW, drawH);
        ctx.restore();

        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(croppedDataUrl);
      } catch (err) {
        console.warn('Canvas crop error:', err);
        resolve(imageUri);
      }
    };
    img.onerror = () => {
      resolve(imageUri);
    };
    img.src = imageUri;
  });
};

const DEFAULT_COMMUNITY_ADVISORS = [
  {
    id: 'shreekutti',
    _id: 'shreekutti',
    fullName: 'Shreekutti',
    username: 'shreekutti',
    headline: 'Tech Park Campus Acquisitions Lead @ Boolok',
    distance: '0.8 km away',
    location: 'Outer Ring Road, Bangalore',
    deals: '18 deals closed',
    followerCount: 4,
    profilePicture: null,
  },
  {
    id: 'logeshwarana',
    _id: 'logeshwarana',
    fullName: 'Logeshwaran A',
    username: 'logeshwarana',
    headline: 'Architectural Consultant & Real Estate Lead',
    distance: '1.4 km away',
    location: 'Whitefield & Commercial Hubs',
    deals: '22 deals closed',
    followerCount: 4,
    profilePicture: 'https://lh3.googleusercontent.com/a/ACg8ocJ_TV7-lpSTfRAQI0wc76yPHoIWaWg_5lgW-i9RxbiPx4tlFk0r=s96-c',
  },
  {
    id: 'ajmal',
    _id: 'ajmal',
    fullName: 'Mohammed Ajmal',
    username: 'ajmal',
    headline: 'Luxury Living & High-End Residential Broker',
    distance: '2.1 km away',
    location: 'Indiranagar & Prime Districts',
    deals: '14 deals closed',
    followerCount: 4,
    profilePicture: null,
  },
  {
    id: 'the_akshtr_estate',
    _id: 'the_akshtr_estate',
    fullName: 'Akshat Commercials',
    username: 'the_akshtr_estate',
    headline: 'Commercial Property & Tech Park Lead @ Boolok',
    distance: '3.2 km away',
    location: 'OMR IT Corridor, Chennai',
    deals: '12 deals closed',
    followerCount: 3,
    profilePicture: null,
  },
];

// ── Feed Posts (loaded live from the backend API) ───────────────────────────
const DEFAULT_FEED_POSTS: any[] = [];

// Last successful feed response, kept across screen remounts so returning to the
// feed renders immediately while fresh data loads in the background.
let feedCache: { userId: string; posts: any[]; news?: any[]; suggested?: any[] } | null = null;

const REACTION_TYPES = [
  { key: 'like', label: 'Like', icon: 'thumb-up', color: '#3b82f6', bg: '#0a66c2' },
  { key: 'celebrate', label: 'Celebrate', icon: 'sign-language', color: '#10b981', bg: '#059669' },
];

export default function ProfessionalSocialFeedScreen() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;
  const isSmallMobile = width < 450;

  const styles = useMemo(() => getStyles(isDark, width), [isDark, width]);

  const cacheUserId = userStorageId(user);
  const ownFeedCache = feedCache?.userId === cacheUserId ? feedCache : null;
  const [posts, setPosts] = useState<any[]>(() => ownFeedCache?.posts || []);
  const [loading, setLoading] = useState(() => !ownFeedCache);
  const [refreshing, setRefreshing] = useState(false);
  const [newsList, setNewsList] = useState(() => ownFeedCache?.news || DEFAULT_REAL_ESTATE_NEWS);
  const [showAllNews, setShowAllNews] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>(() => ownFeedCache?.suggested || DEFAULT_COMMUNITY_ADVISORS);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() => {
    // Pre-populate from the shared localStorage cache so the feed's + Follow
    // button reflects the same state as Insights and Profile screens.
    if (Platform.OS === 'web') {
      try {
        const raw = localStorage.getItem('boolok_following_users_set');
        if (raw) return JSON.parse(raw) as Record<string, boolean>;
      } catch (_) {}
    }
    return {};
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [rawSelectedImage, setRawSelectedImage] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<number>(1);
  const [cropRatioLabel, setCropRatioLabel] = useState<string>('1:1');
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropPanX, setCropPanX] = useState<number>(0);
  const [cropPanY, setCropPanY] = useState<number>(0);
  const [cropRotation, setCropRotation] = useState<number>(0);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);
  const [likesModalPost, setLikesModalPost] = useState<any>(null);
  const [likesModalUsers, setLikesModalUsers] = useState<any[]>([]);
  const [allReactionUsers, setAllReactionUsers] = useState<any[]>([]);
  const [reactionTab, setReactionTab] = useState<string>('all');
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({ all: 0, like: 0 });
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [activeReactionPickerPostId, setActiveReactionPickerPostId] = useState<string | null>(null);
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>(DEFAULT_COMMUNITY_ADVISORS);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [savedReelsList, setSavedReelsList] = useState<any[]>([]);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [isBrokerNetworkModalOpen, setIsBrokerNetworkModalOpen] = useState(false);
  const [isNewslettersModalOpen, setIsNewslettersModalOpen] = useState(false);
  const [isAuctionsModalOpen, setIsAuctionsModalOpen] = useState(false);
  const [selectedNewsStory, setSelectedNewsStory] = useState<any>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const getToken = async () =>
    Platform.OS === 'web' ? localStorage.getItem('userToken') : await SecureStore.getItemAsync('userToken');

  // ── Shared like-count cache helpers ─────────────────────────────────────────
  // Shape: { [postId]: { count: number, likedByMe: boolean } }
  const _readLikeCache = (): Record<string, { count: number; likedByMe: boolean }> => {
    try {
      if (Platform.OS === 'web') {
        const raw = localStorage.getItem('boolok_post_likes');
        return raw ? JSON.parse(raw) : {};
      }
    } catch (_) {}
    return {};
  };

  const _applyLikeCache = (rawPosts: any[]): any[] => {
    const cache = _readLikeCache();
    return rawPosts.map((p) => {
      const cached = cache[p._id];
      if (!cached) return p;
      const isLiked = cached.likedByMe;
      const count = cached.count;
      return {
        ...p,
        likesCount: count,
        isLiked,
        currentUserReaction: isLiked ? 'like' : null,
        likesSummary:
          count > 0
            ? isLiked
              ? count === 1
                ? 'Liked by you'
                : `Liked by you and ${count - 1} other${count > 2 ? 's' : ''}`
              : `Liked by ${count} member${count > 1 ? 's' : ''}`
            : '0 likes',
      };
    });
  };

  const loadSavedItems = async () => {
    try {
      if (Platform.OS === 'web') {
        const raw = localStorage.getItem(savedReelsKey(user));
        if (raw) {
          const parsed = JSON.parse(raw);
          setSavedReelsList(Array.isArray(parsed) ? parsed : []);
          return;
        }
      } else {
        const raw = await SecureStore.getItemAsync(savedReelsKey(user));
        if (raw) {
          const parsed = JSON.parse(raw);
          setSavedReelsList(Array.isArray(parsed) ? parsed : []);
          return;
        }
      }
    } catch (e) { }
    setSavedReelsList([]);
  };

  const handleOpenSavedModal = () => {
    loadSavedItems();
    setIsSavedModalOpen(true);
  };

  const handleRemoveSavedReel = async (reelId: string) => {
    const updated = savedReelsList.filter((r) => r._id !== reelId && r.id !== reelId);
    setSavedReelsList(updated);
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(savedReelsKey(user), JSON.stringify(updated));
      } catch (e) { }
    } else {
      try {
        await SecureStore.setItemAsync(savedReelsKey(user), JSON.stringify(updated));
      } catch (e) { }
    }
  };

  const handleOpenFollowersModal = async () => {
    setIsFollowersModalOpen(true);
    setIsLoadingFollowers(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${API_BASE_URL}/api/users/self/followers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.data && Array.isArray(res.data.followers)) {
        setFollowersList(res.data.followers);
      } else {
        setFollowersList([]);
      }
    } catch (e) {
      setFollowersList([]);
    } finally {
      setIsLoadingFollowers(false);
    }
  };

  const handleOpenLikesModal = async (post: any) => {
    const currentPost = posts.find((p) => p._id === post._id) || post;
    setLikesModalPost(currentPost);
    setReactionTab('all');
    setIsLikesModalOpen(true);
    setIsLoadingLikes(true);

    // Build a local liked-members list from the post data (used as fallback)
    const buildLocalLikersList = (p: any): any[] => {
      const viewerId = user?.id || user?._id;
      const viewerName = user?.fullName || user?.username || 'You';
      const localList: any[] = [];

      // Add current viewer if they liked
      const isViewerLiked = p.isLiked || (Array.isArray(p.likes) && p.likes.includes(viewerId));
      if (isViewerLiked && viewerId) {
        localList.push({
          id: viewerId,
          _id: viewerId,
          fullName: viewerName,
          username: user?.username || 'you',
          profilePicture: user?.profilePicture || null,
          headline: user?.headline || 'Real Estate Professional',
          reactionType: 'like',
        });
      }

      // Add other likers from the post.likes array (may be usernames or IDs for fallback posts)
      const DEFAULT_ADVISORS: Record<string, { fullName: string; headline: string }> = {
        shreekutti: { fullName: 'Shreekutti', headline: 'Tech Park Campus Acquisitions Lead @ Boolok' },
        logeshwarana: { fullName: 'Logeshwaran A', headline: 'Architectural Consultant & Real Estate Lead' },
        ajmal: { fullName: 'Mohammed Ajmal', headline: 'Luxury Living & High-End Residential Broker' },
        the_akshtr_estate: { fullName: 'Akshat Commercials', headline: 'Commercial Property & Tech Park Lead @ Boolok' },
        saivimenthanvl: { fullName: 'Sai Vimenthan', headline: 'Elite Real Estate Broker & Commercial Portfolio Lead' },
        bavadharini_rs: { fullName: 'Bavadharini RS', headline: 'Interior Designer & Modern Living Specialist' },
        prasanth_properties: { fullName: 'Prasanth Properties', headline: 'Luxury Waterfront Specialist · Miami & Coastal Estates' },
        vignesh: { fullName: 'Vigneshwaran', headline: 'Prime Architectural Estates & Beverly Hills Luxury Specialist' },
        sai: { fullName: 'Sai Vimenthan', headline: 'Elite Real Estate Broker & Commercial Portfolio Lead' },
      };

      if (Array.isArray(p.likes)) {
        p.likes.forEach((likerId: string) => {
          if (!likerId || likerId === viewerId) return; // skip current viewer (already added)
          const info = DEFAULT_ADVISORS[String(likerId)] || null;
          localList.push({
            id: likerId,
            _id: likerId,
            fullName: info?.fullName || String(likerId),
            username: String(likerId),
            profilePicture: null,
            headline: info?.headline || 'Boolok Real Estate Member',
            reactionType: 'like',
          });
        });
      }

      return localList;
    };

    try {
      const token = await getToken();
      // Only hit the API for real DB posts (valid 24-char MongoDB ObjectId)
      const isValidObjectId = /^[a-f\d]{24}$/i.test(post._id);
      if (!isValidObjectId) throw new Error('fallback');

      const res = await axios.get(`${API_BASE_URL}/api/feed/${post._id}/reactions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const list = Array.isArray(res.data?.all) ? res.data.all : [];

      if (list.length > 0) {
        setAllReactionUsers(list);
        setLikesModalUsers(list);
        setReactionCounts({ all: list.length, like: list.length });
      } else {
        // API succeeded but no DB record — use local list
        const local = buildLocalLikersList(currentPost);
        setAllReactionUsers(local);
        setLikesModalUsers(local);
        setReactionCounts({ all: local.length, like: local.length });
      }
    } catch (error) {
      // Fallback post (non-ObjectId ID) or API error — use local list
      const local = buildLocalLikersList(currentPost);
      setAllReactionUsers(local);
      setLikesModalUsers(local);
      setReactionCounts({ all: local.length, like: local.length });
    } finally {
      setIsLoadingLikes(false);
    }
  };


  const isUserFollowed = useCallback(
    (userOrId: any): boolean => {
      if (!userOrId) return false;
      if (typeof userOrId === 'string') {
        const trimmed = userOrId.trim();
        const lower = trimmed.toLowerCase();
        return Boolean(followingMap[trimmed] || followingMap[lower]);
      }
      const id = userOrId.id || userOrId._id;
      const username = userOrId.username;
      const lowerUsername = typeof username === 'string' ? username.toLowerCase() : undefined;
      return Boolean(
        (id && followingMap[id]) ||
        (userOrId._id && followingMap[userOrId._id]) ||
        (userOrId.id && followingMap[userOrId.id]) ||
        (username && followingMap[username]) ||
        (lowerUsername && followingMap[lowerUsername])
      );
    },
    [followingMap]
  );

  const fetchPostsAndNews = useCallback(async () => {
    try {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [feedRes, newsRes, suggestedRes, myFollowingRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/feed`, { headers }),
        axios.get(`${API_BASE_URL}/api/feed/news`),
        axios.get(`${API_BASE_URL}/api/users/suggested`, { headers }),
        token ? axios.get(`${API_BASE_URL}/api/users/self/following`, { headers }) : Promise.reject('No token'),
      ]);

      if (feedRes.status === 'fulfilled') {
        const raw = feedRes.value.data;
        const postsList = Array.isArray(raw) ? raw : (Array.isArray(raw?.posts) ? raw.posts : []);
        // Apply cached like counts so counts survive page reload
        setPosts(_applyLikeCache(postsList));
        feedCache = feedCache?.userId === cacheUserId
          ? { ...feedCache, posts: postsList }
          : { userId: cacheUserId, posts: postsList };
      } else if (feedCache?.userId !== cacheUserId) {
        setPosts([]);
      }

      if (newsRes.status === 'fulfilled' && Array.isArray(newsRes.value.data?.news)) {
        setNewsList(newsRes.value.data.news);
        if (feedCache?.userId === cacheUserId) feedCache.news = newsRes.value.data.news;
      }

      // Sync following truth directly from MongoDB database
      const dbFollowMap: Record<string, boolean> = {};
      if (myFollowingRes.status === 'fulfilled' && Array.isArray(myFollowingRes.value.data?.following)) {
        const followingArray = myFollowingRes.value.data.following;
        followingArray.forEach((f: any) => {
          if (!f) return;
          const fId = f.id || f._id;
          const fUsername = f.username;
          if (fId) dbFollowMap[String(fId)] = true;
          if (f._id) dbFollowMap[String(f._id)] = true;
          if (fUsername) {
            dbFollowMap[String(fUsername)] = true;
            dbFollowMap[String(fUsername).toLowerCase()] = true;
          }
        });
      }

      if (suggestedRes.status === 'fulfilled' && Array.isArray(suggestedRes.value.data?.suggested)) {
        const list = suggestedRes.value.data.suggested;
        setSuggestedUsers(list);
        if (feedCache?.userId === cacheUserId) feedCache.suggested = list;
        list.forEach((u: any) => {
          if (u.isFollowing) {
            if (u.id) dbFollowMap[u.id] = true;
            if (u._id) dbFollowMap[u._id] = true;
            if (u.username) {
              dbFollowMap[u.username] = true;
              dbFollowMap[u.username.toLowerCase()] = true;
            }
          }
        });
      }

      // Sync following map strictly with the authenticated user's actual database following
      setFollowingMap(dbFollowMap);
      try {
        if (Platform.OS === 'web') {
          localStorage.setItem('boolok_following_users_set', JSON.stringify(dbFollowMap));
        } else {
          await SecureStore.setItemAsync('boolok_following_users_set', JSON.stringify(dbFollowMap));
        }
      } catch (_) {}
    } catch (error) {
      console.error('Feed fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheUserId]);

  useEffect(() => {
    fetchPostsAndNews();
  }, [fetchPostsAndNews]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPostsAndNews();
  };

  const toggleFollowAdvisor = async (targetId: string, userObj?: any) => {
    const advisor = userObj || suggestedUsers.find((u) => (u.id || u._id || u.username) === targetId);
    const isCurrentlyFollowing = isUserFollowed(advisor || targetId);
    const nextState = !isCurrentlyFollowing;

    const allKeys = [
      targetId,
      advisor?.id,
      advisor?._id,
      advisor?.username,
      typeof advisor?.username === 'string' ? advisor.username.toLowerCase() : null,
    ].filter(Boolean) as string[];

    // Optimistically update map for all user keys
    setFollowingMap((prev) => {
      const updated = { ...prev };
      allKeys.forEach((k) => {
        if (nextState) updated[k] = true;
        else delete updated[k];
      });
      return updated;
    });

    // Optimistically update followerCount in the suggested users list
    setSuggestedUsers((prev) =>
      prev.map((u) => {
        const matches = allKeys.includes(u.id) || allKeys.includes(u._id) || allKeys.includes(u.username);
        if (matches) {
          const currentCount = typeof u.followerCount === 'number' ? u.followerCount : 0;
          return {
            ...u,
            followerCount: nextState ? currentCount + 1 : Math.max(0, currentCount - 1),
            isFollowing: nextState,
          };
        }
        return u;
      })
    );

    // Sync with shared localStorage follow cache
    try {
      if (Platform.OS === 'web') {
        const raw = localStorage.getItem('boolok_following_users_set');
        const set = raw ? JSON.parse(raw) : {};
        allKeys.forEach((key) => {
          if (nextState) set[key] = true;
          else delete set[key];
        });
        localStorage.setItem('boolok_following_users_set', JSON.stringify(set));
      } else {
        const raw = await SecureStore.getItemAsync('boolok_following_users_set');
        const set = raw ? JSON.parse(raw) : {};
        allKeys.forEach((key) => {
          if (nextState) set[key] = true;
          else delete set[key];
        });
        await SecureStore.setItemAsync('boolok_following_users_set', JSON.stringify(set));
      }
    } catch (_) {}

    // Persist to MongoDB database
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_BASE_URL}/api/users/${targetId}/follow`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.data) {
        const serverFollowing = typeof res.data.isFollowing === 'boolean' ? res.data.isFollowing : nextState;
        const targetUser = res.data.targetUser;
        const confirmedKeys = [
          targetId,
          targetUser?.id,
          targetUser?._id,
          targetUser?.username,
          typeof targetUser?.username === 'string' ? targetUser.username.toLowerCase() : null,
          ...allKeys,
        ].filter(Boolean) as string[];

        setFollowingMap((prev) => {
          const updated = { ...prev };
          confirmedKeys.forEach((k) => {
            if (serverFollowing) updated[k] = true;
            else delete updated[k];
          });
          return updated;
        });

        try {
          if (Platform.OS === 'web') {
            const raw = localStorage.getItem('boolok_following_users_set');
            const set = raw ? JSON.parse(raw) : {};
            confirmedKeys.forEach((k) => {
              if (serverFollowing) set[k] = true;
              else delete set[k];
            });
            localStorage.setItem('boolok_following_users_set', JSON.stringify(set));
          } else {
            const raw = await SecureStore.getItemAsync('boolok_following_users_set');
            const set = raw ? JSON.parse(raw) : {};
            confirmedKeys.forEach((k) => {
              if (serverFollowing) set[k] = true;
              else delete set[k];
            });
            await SecureStore.setItemAsync('boolok_following_users_set', JSON.stringify(set));
          }
        } catch (_) {}

        // Update the accurate followerCount from server
        if (typeof res.data.followerCount === 'number') {
          setSuggestedUsers((prev) =>
            prev.map((u) => {
              const matches = confirmedKeys.includes(u.id) || confirmedKeys.includes(u._id) || confirmedKeys.includes(u.username);
              return matches ? { ...u, followerCount: res.data.followerCount, isFollowing: serverFollowing } : u;
            })
          );
        }
      }
    } catch (error) {
      console.warn('Failed to update follow in database, reverting:', error);
      // Revert optimistic update on failure
      setFollowingMap((prev) => {
        const updated = { ...prev };
        allKeys.forEach((k) => {
          if (isCurrentlyFollowing) updated[k] = true;
          else delete updated[k];
        });
        return updated;
      });
      setSuggestedUsers((prev) =>
        prev.map((u) => {
          const matches = allKeys.includes(u.id) || allKeys.includes(u._id) || allKeys.includes(u.username);
          if (matches) {
            const currentCount = typeof u.followerCount === 'number' ? u.followerCount : 0;
            return {
              ...u,
              followerCount: isCurrentlyFollowing ? currentCount + 1 : Math.max(0, currentCount - 1),
              isFollowing: isCurrentlyFollowing,
            };
          }
          return u;
        })
      );
    }
  };


  const handleReaction = async (postId: string, reactionType: string = 'like') => {
    setActiveReactionPickerPostId(null);
    const viewerId = user?.id || user?._id;

    // ── Step 1: Optimistic UI update ─────────────────────────────────────────
    let optimisticCount = 0;
    let optimisticLiked = false;

    setPosts((prev) =>
      prev.map((p) => {
        if (p._id === postId) {
          const currentlyLiked = Boolean(p.isLiked || (Array.isArray(p.likes) && p.likes.includes(viewerId)));
          const nextLiked = !currentlyLiked;
          const baseCount = typeof p.likesCount === 'number' ? p.likesCount : (Array.isArray(p.likes) ? p.likes.length : 0);
          const count = nextLiked ? baseCount + 1 : Math.max(0, baseCount - 1);
          optimisticCount = count;
          optimisticLiked = nextLiked;
          return {
            ...p,
            isLiked: nextLiked,
            currentUserReaction: nextLiked ? 'like' : null,
            likesCount: count,
            likesSummary:
              count > 0
                ? nextLiked
                  ? count === 1
                    ? 'Liked by you'
                    : `Liked by you and ${count - 1} other${count > 2 ? 's' : ''}`
                  : `Liked by ${count} member${count > 1 ? 's' : ''}`
                : '0 likes',
          };
        }
        return p;
      })
    );

    // ── Step 2: Persist to shared localStorage cache immediately ─────────────
    const _writeLikeCache = (c: Record<string, { count: number; likedByMe: boolean }>) => {
      try { if (Platform.OS === 'web') localStorage.setItem('boolok_post_likes', JSON.stringify(c)); } catch (_) {}
    };
    const cache = _readLikeCache();
    cache[postId] = { count: optimisticCount, likedByMe: optimisticLiked };
    _writeLikeCache(cache);

    // ── Step 3: Sync with backend (real DB posts only) ───────────────────────
    // Skip the API entirely for fallback posts whose IDs are not valid MongoDB ObjectIds
    const isValidObjectId = /^[a-f\d]{24}$/i.test(postId);
    if (!isValidObjectId) return; // localStorage cache already has the correct state

    try {
      const token = await getToken();
      const res = await axios.put(
        `${API_BASE_URL}/api/feed/${postId}/like`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.data && res.data.post) {
        // Use server-confirmed count
        const serverPost = res.data.post;
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? serverPost : p))
        );
        // Update cache with accurate server count
        const freshCache = _readLikeCache();
        freshCache[postId] = {
          count: serverPost.likesCount ?? optimisticCount,
          likedByMe: serverPost.isLiked ?? optimisticLiked,
        };
        _writeLikeCache(freshCache);
      } else if (res.data && typeof res.data.likesCount === 'number') {
        const serverCount = res.data.likesCount;
        const serverLiked = res.data.isLiked ?? optimisticLiked;
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id !== postId) return p;
            return {
              ...p,
              likesCount: serverCount,
              isLiked: serverLiked,
              currentUserReaction: serverLiked ? 'like' : null,
              likesSummary:
                serverCount > 0
                  ? serverLiked
                    ? serverCount === 1
                      ? 'Liked by you'
                      : `Liked by you and ${serverCount - 1} other${serverCount > 2 ? 's' : ''}`
                    : `Liked by ${serverCount} member${serverCount > 1 ? 's' : ''}`
                  : '0 likes',
            };
          })
        );
        const freshCache = _readLikeCache();
        freshCache[postId] = { count: serverCount, likedByMe: serverLiked };
        _writeLikeCache(freshCache);
      }
    } catch (err: any) {
      console.warn('Like API error:', err?.response?.status, err?.message);
    }
  };

  const handleLike = (postId: string) => {
    handleReaction(postId, 'like');
  };


  const handleAddComment = async (postId: string) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));

    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_BASE_URL}/api/feed/${postId}/comment`,
        { text },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.data && res.data.post) {
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? res.data.post : p))
        );
      } else if (res.data && Array.isArray(res.data.comments)) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id === postId) {
              return {
                ...p,
                comments: res.data.comments,
                commentsCount: res.data.commentsCount || res.data.comments.length,
              };
            }
            return p;
          })
        );
      }
    } catch (error) {
      console.error('Comment error:', error);
    }
  };

  const openCropTool = (imageUri: string) => {
    setRawSelectedImage(imageUri);
    setCropAspectRatio(1);
    setCropRatioLabel('1:1');
    setCropZoom(1);
    setCropPanX(0);
    setCropPanY(0);
    setCropRotation(0);
    setIsCropModalOpen(true);
  };

  const handleApplyCrop = async () => {
    const src = rawSelectedImage || newPostImage;
    if (!src) return;
    setIsCropping(true);
    try {
      const croppedUri = await cropAndFrameImage(
        src,
        cropAspectRatio,
        cropZoom,
        cropPanX,
        cropPanY,
        cropRotation
      );
      setNewPostImage(croppedUri);
      setIsCropModalOpen(false);
      setIsCreateModalOpen(true);
    } catch (err) {
      console.error('Crop application error:', err);
      if (rawSelectedImage) setNewPostImage(rawSelectedImage);
      setIsCropModalOpen(false);
      setIsCreateModalOpen(true);
    } finally {
      setIsCropping(false);
    }
  };

  const handlePickImageFromDevice = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setNewPostImage(uri);
        openCropTool(uri);
      }
    } catch (error) {
      console.error('Device image pick error:', error);
      alertMsg('Could not open file picker on your device.');
    }
  };

  const handleTakePhotoFromCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setNewPostImage(uri);
        openCropTool(uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      alertMsg('Could not open camera on your device.');
    }
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() && !newPostImage) {
      alertMsg('Please write some details or attach a property image.');
      return;
    }
    setIsPublishing(true);

    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_BASE_URL}/api/feed`,
        { content: newPostText.trim(), mediaUrl: newPostImage || null },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data && res.data.post) {
        setPosts((prev) => [res.data.post, ...prev]);
      } else {
        await fetchPostsAndNews();
      }

      setNewPostText('');
      setNewPostImage(null);
      setIsCreateModalOpen(false);
      alertMsg('Property post published successfully to Boolok Real Estate Network!');
    } catch (error: any) {
      console.error('Create post error:', error);
      alertMsg(error?.response?.data?.message || 'Failed to publish post.');
    } finally {
      setIsPublishing(false);
    }
  };

  const alertMsg = (msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Boolok Real Estate', msg);
    }
  };

  if (loading) return <LoadingScreen />;

  const displayedNews = showAllNews ? newsList : newsList.slice(0, 5);

  const bgDark = isDark ? '#060b13' : '#ffffff';
  const cardBg = isDark ? '#0c1626' : '#ffffff';
  const borderColor = isDark ? '#1a273c' : '#e2e8f0';
  const goldPrimary = '#e6b800';

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: bgDark }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#e6b800"
          colors={['#e6b800']}
        />
      }
    >
      <View style={styles.mainLayoutContainer}>
        {/* ═══════════════════════════════════════════════════════════════════════
            LEFT COLUMN: User Real Estate Profile Card & Quick Links
        ════════════════════════════════════════════════════════════════════════ */}
        {isDesktop && (
          <View style={styles.leftColumn}>
            {/* User Mini Profile Card */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
              {/* Cover Banner */}
              <LinearGradient
                colors={['#0f223d', '#1a365d', '#0c1626']}
                style={styles.profileCoverBanner}
              >
                <View style={styles.bannerBadge}>
                  <BoolokLogo size={18} color="#ffffff" />
                  <Text style={styles.bannerBadgeText}>BOOLOK ELITE</Text>
                </View>
              </LinearGradient>

              {/* Avatar */}
              <Pressable
                onPress={() => router.push('/(app)/profile')}
                style={styles.profileAvatarWrapper}
              >
                <UserAvatar user={user} size={64} style={styles.profileAvatar} />
                <View style={styles.avatarPlusBadge}>
                  <MaterialIcons name="verified" size={14} color="#000000" />
                </View>
              </Pressable>

              {/* Identity & Professional Title */}
              <View style={styles.profileInfoBox}>
                <Text
                  style={styles.profileNameText}
                  onPress={() => router.push('/(app)/profile')}
                >
                  {user?.fullName || user?.username || 'Boolok Member'}
                </Text>
                <Text style={styles.profileRoleText}>
                  {user?.headline || 'Elite Real Estate Broker & Commercial Portfolio Lead'}
                </Text>
                <Text style={styles.profileLocationText}>
                  {user?.location || 'Prime Commercial Assets'}
                </Text>

                {/* Company Tag */}
                <View style={styles.companyTag}>
                  <BoolokLogo size={14} color="#ffffff" />
                  <Text style={styles.companyTagText}>BOOLOK GPT REAL ESTATE</Text>
                </View>
              </View>

              {/* Stats Block */}
              <View style={[styles.statsDivider, { borderTopColor: borderColor }]}>
                <View style={styles.statRowItem}>
                  <Text style={styles.statRowLabel}>Profile viewers</Text>
                  <Text style={styles.statRowValue}>38</Text>
                </View>
                <View style={styles.statRowItem}>
                  <Text style={styles.statRowLabel}>Properties Listed</Text>
                  <Text style={styles.statRowValue}>12</Text>
                </View>
                <View style={styles.statRowItem}>
                  <Text style={styles.statRowLabel}>Post Impressions</Text>
                  <Text style={styles.statRowValue}>148</Text>
                </View>
              </View>

              {/* Saved Items */}
              <Pressable
                onPress={handleOpenSavedModal}
                style={[styles.savedItemsBtn, { borderTopColor: borderColor }]}
              >
                <MaterialCommunityIcons name="bookmark-outline" size={18} color="#e6b800" />
                <Text style={[styles.savedItemsText, { color: isDark ? '#ffffff' : '#0f172a', fontWeight: '700' }]}>
                  Saved Properties
                </Text>
              </Pressable>
            </View>

            {/* Quick Access Menu Card */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 12 }]}>
              <Text style={styles.quickMenuHeading}>Manage Network</Text>
              <Pressable style={styles.quickMenuItem} onPress={() => setIsBrokerNetworkModalOpen(true)}>
                <MaterialIcons name="people-outline" size={18} color="#e6b800" />
                <Text style={styles.quickMenuText}>Broker Network</Text>
              </Pressable>
              <Pressable style={styles.quickMenuItem} onPress={() => setIsNewslettersModalOpen(true)}>
                <MaterialIcons name="article" size={18} color="#38bdf8" />
                <Text style={styles.quickMenuText}>Market Newsletters</Text>
              </Pressable>
              <Pressable style={styles.quickMenuItem} onPress={() => setIsAuctionsModalOpen(true)}>
                <MaterialIcons name="event" size={18} color="#ec4899" />
                <Text style={styles.quickMenuText}>Property Auctions & Events</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            CENTER COLUMN: "Start a post" Box & Real Estate Feed Stream
        ════════════════════════════════════════════════════════════════════════ */}
        <View style={styles.centerColumn}>
          {/* "Start a post" Composer Card (Matches Screenshot 2) */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.startPostHeader}>
              <UserAvatar user={user} size={42} style={styles.startPostAvatar} />
              <Pressable
                onPress={() => setIsCreateModalOpen(true)}
                style={styles.startPostInputTrigger}
              >
                <Text style={styles.startPostPlaceholder}>
                  Start a post / Share a real estate listing...
                </Text>
              </Pressable>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.startPostActionsRow}>
              <Pressable
                onPress={() => router.push('/(app)/profile')}
                style={styles.composerActionBtn}
              >
                <MaterialIcons name="videocam" size={isSmallMobile ? 18 : 22} color="#60a5fa" />
                <Text style={styles.composerActionText}>{isSmallMobile ? 'Reel' : 'Video Reel'}</Text>
              </Pressable>

              <Pressable
                onPress={handlePickImageFromDevice}
                style={styles.composerActionBtn}
              >
                <MaterialIcons name="photo" size={isSmallMobile ? 18 : 20} color="#38bdf8" />
                <Text style={styles.composerActionText}>Photo</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsCreateModalOpen(true)}
                style={styles.composerActionBtn}
              >
                <MaterialIcons name="apartment" size={isSmallMobile ? 18 : 20} color="#e6b800" />
                <Text style={styles.composerActionText}>{isSmallMobile ? 'Listing' : 'Building For Sale'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Sort Header */}
          <View style={styles.sortHeaderRow}>
            <View style={styles.sortDividerLine} />
            <Text style={styles.sortLabel}>
              Sort by:{' '}
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                Top Real Estate Deals ▾
              </Text>
            </Text>
          </View>

          {/* ── Feed Posts Stream ────────────────────────────────────────────── */}
          {posts.length === 0 ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor,
                  padding: 36,
                  alignItems: 'center',
                  marginBottom: 20,
                },
              ]}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: isDark ? '#1a273c' : '#f1f5f9',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <MaterialCommunityIcons
                  name="newspaper-variant-outline"
                  size={32}
                  color="#e6b800"
                />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: isDark ? '#ffffff' : '#0f172a',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                Your Feed is Clean & Ready
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: '#8b9bb4',
                  textAlign: 'center',
                  lineHeight: 20,
                  maxWidth: 420,
                  marginBottom: 20,
                }}
              >
                No posts published yet. Share your first property listing, commercial requirement, or market analysis with the network!
              </Text>
              <Pressable
                onPress={() => setIsCreateModalOpen(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: goldPrimary,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                }}
              >
                <MaterialIcons name="add" size={18} color="#000000" />
                <Text style={{ color: '#000000', fontWeight: '800', fontSize: 14 }}>
                  Create First Post
                </Text>
              </Pressable>
            </View>
          ) : (
            posts.map((post) => {
              const author = post.author || {};
              const authorName = author.fullName || author.username || 'Boolok Member';
              const authorUsername = author.username || author._id || author.id || '';
              const authorTitle =
                author.headline ||
                author.title ||
                'Commercial Property & Real Estate Advisor @ Boolok Network';
              const isSelfPost = Boolean(
                user &&
                  (author._id === user.id ||
                    author._id === user._id ||
                    author.username === user.username)
              );
              const isLiked = Boolean(
                post.isLiked ||
                  (Array.isArray(post.likes) &&
                    user &&
                    post.likes.includes(user.id || user._id))
              );
              const totalLikes =
                typeof post.likesCount === 'number'
                  ? post.likesCount
                  : Array.isArray(post.likes)
                  ? post.likes.length
                  : 0;
              const commentsList = Array.isArray(post.comments) ? post.comments : [];
              const isCommentOpen = activeCommentPostId === post._id;

              // Resolve Media image URLs safely
              const rawMedia = Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0
                ? post.mediaUrls
                : post.mediaUrl
                ? [post.mediaUrl]
                : [];

              const mediaList = rawMedia
                .map((m: any) => resolveImageUrl(m))
                .filter(Boolean) as string[];

              return (
                <View
                  key={post._id}
                  style={[styles.card, styles.postCard, { backgroundColor: cardBg, borderColor }]}
                >
                  {/* Post Author Header */}
                  <View style={styles.postHeaderRow}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/profile',
                          params: { id: author._id || author.username },
                        })
                      }
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    >
                      <UserAvatar user={author} size={42} style={styles.postAuthorAvatar} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.postAuthorName}>{authorName}</Text>
                          {author.degree && (
                            <Text style={styles.postAuthorDegree}> · {author.degree}</Text>
                          )}
                          <MaterialIcons
                            name="verified"
                            size={14}
                            color="#0095f6"
                            style={{ marginLeft: 4 }}
                          />
                        </View>
                        <Text style={styles.postAuthorTitle} numberOfLines={1}>
                          {authorTitle}
                        </Text>
                        <Text style={styles.postTimeText}>{post.time || 'Recently · 🌐'}</Text>
                      </View>
                    </Pressable>

                    {!isSelfPost && (
                      <Pressable
                        onPress={() => toggleFollowAdvisor(author._id || author.username, author)}
                        style={[
                          styles.feedFollowBtn,
                          isUserFollowed(author) && {
                            backgroundColor: '#1a273c',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.feedFollowBtnText,
                            {
                              color: isUserFollowed(author)
                                ? '#ffffff'
                                : goldPrimary,
                            },
                          ]}
                        >
                          {isUserFollowed(author) ? '✓ Following' : '+ Follow'}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Post Text Description */}
                  {(post.content && post.content.trim()) ? (
                    <Text style={styles.postBodyContent}>{post.content}</Text>
                  ) : mediaList.length > 0 ? (
                    <Text style={[styles.postBodyContent, { fontStyle: 'italic', opacity: 0.9 }]}>
                      Prime Real Estate Asset & Investment Opportunity
                    </Text>
                  ) : null}

                  {/* Multi-Image / Media Grid */}
                  {mediaList.length > 0 && (
                    <View style={styles.postMediaContainer}>
                      {mediaList.length === 1 ? (
                        <Image
                          source={{
                            uri: failedImages[post._id]
                              ? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200'
                              : mediaList[0]
                          }}
                          style={styles.singlePostImage}
                          resizeMode="cover"
                          onError={() => {
                            setFailedImages((prev) => ({ ...prev, [post._id]: true }));
                          }}
                        />
                      ) : (
                        <View style={styles.multiImageRow}>
                          {mediaList.slice(0, 2).map((imgUrl: string, idx: number) => (
                            <Image
                              key={idx}
                              source={{
                                uri: failedImages[`${post._id}-${idx}`]
                                  ? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200'
                                  : imgUrl
                              }}
                              style={styles.multiPostImage}
                              resizeMode="cover"
                              onError={() => {
                                setFailedImages((prev) => ({ ...prev, [`${post._id}-${idx}`]: true }));
                              }}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Social Counter Stats Bar */}
                  <View style={[styles.socialStatsBar, { borderBottomColor: borderColor }]}>
                    <Pressable
                      onPress={() => handleOpenLikesModal(post)}
                      style={({ pressed, hovered }: any) => [
                        { flexDirection: 'row', alignItems: 'center', cursor: 'pointer' },
                        (pressed || hovered) && { opacity: 0.8 },
                      ]}
                    >
                      <View style={styles.reactionIconsGroup}>
                        <View style={[styles.reactionDot, { backgroundColor: '#0a66c2' }]}>
                          <MaterialIcons name="thumb-up" size={10} color="#ffffff" />
                        </View>
                      </View>
                      <Text style={[styles.socialReactionText, { textDecorationLine: 'underline', marginLeft: 6 }]}>
                        {post.likesSummary ||
                          (totalLikes > 0
                            ? isLiked
                              ? (totalLikes === 1 ? 'Liked by you' : `Liked by you and ${totalLikes - 1} other${totalLikes > 2 ? 's' : ''}`)
                              : `Liked by ${totalLikes} member${totalLikes > 1 ? 's' : ''}`
                            : '0 likes')}
                      </Text>
                    </Pressable>

                    <Text
                      style={styles.socialCommentsCountText}
                      onPress={() =>
                        setActiveCommentPostId(isCommentOpen ? null : post._id)
                      }
                    >
                      {post.commentsCount || commentsList.length} comments
                    </Text>
                  </View>

                  {/* Interactive Action Buttons */}
                  <View style={[styles.postActionsBar, { position: 'relative' }]}>
                    <Pressable
                      onPress={() => handleReaction(post._id, 'like')}
                      style={styles.postActionItem}
                    >
                      <MaterialIcons
                        name="thumb-up"
                        size={18}
                        color={isLiked ? '#3b82f6' : '#8b9bb4'}
                      />
                      <Text
                        style={[
                          styles.postActionItemText,
                          isLiked && { color: '#3b82f6', fontWeight: '800' },
                        ]}
                      >
                        {isLiked ? 'Liked' : 'Like'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        setActiveCommentPostId(isCommentOpen ? null : post._id)
                      }
                      style={styles.postActionItem}
                    >
                      <MaterialCommunityIcons
                        name="comment-text-outline"
                        size={18}
                        color="#8b9bb4"
                      />
                      <Text style={styles.postActionItemText}>Comment</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => alertMsg('Property post reposted to your network!')}
                      style={styles.postActionItem}
                    >
                      <MaterialCommunityIcons name="repeat" size={18} color="#8b9bb4" />
                      <Text style={styles.postActionItemText}>Repost</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => alertMsg('Property details link copied to clipboard!')}
                      style={styles.postActionItem}
                    >
                      <MaterialCommunityIcons name="send-outline" size={18} color="#8b9bb4" />
                      <Text style={styles.postActionItemText}>Send</Text>
                    </Pressable>
                  </View>

                  {/* Inline Comment Box & Comments List */}
                  {isCommentOpen && (
                    <View style={[styles.commentSectionDrawer, { borderTopColor: borderColor }]}>
                      {/* Add comment input */}
                      <View style={styles.commentInputRow}>
                        <UserAvatar user={user} size={32} style={styles.commentUserAvatar} />
                        <TextInput
                          placeholder="Add a real estate comment..."
                          placeholderTextColor="#66768f"
                          style={styles.inlineCommentInput}
                          value={commentInputs[post._id] || ''}
                          onChangeText={(t) =>
                            setCommentInputs((prev) => ({ ...prev, [post._id]: t }))
                          }
                          onSubmitEditing={() => handleAddComment(post._id)}
                        />
                        <Pressable
                          onPress={() => handleAddComment(post._id)}
                          style={[styles.commentSubmitBtn, { backgroundColor: goldPrimary }]}
                        >
                          <Text style={styles.commentSubmitBtnText}>Post</Text>
                        </Pressable>
                      </View>

                      {/* Comments List */}
                      {commentsList.length > 0 ? (
                        commentsList.map((c: any, cIdx: number) => {
                          const cAuthor = c.author || c.user || {};
                          const cName = cAuthor.fullName || cAuthor.username || 'Boolok Member';
                          const commentBody = c.text || '';
                          const commentTime = formatSmartDateTime(c.createdAt || c.time);
                          const authorId = cAuthor._id || cAuthor.id || cAuthor.username;

                          return (
                            <View
                              key={c._id || cIdx}
                              style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}
                            >
                              <Pressable
                                onPress={() => {
                                  if (authorId) {
                                    router.push({
                                      pathname: '/(app)/profile',
                                      params: { id: authorId },
                                    });
                                  }
                                }}
                                style={({ pressed, hovered }: any) => [
                                  (pressed || hovered) && { opacity: 0.8 },
                                ]}
                              >
                                <UserAvatar user={cAuthor} size={34} />
                              </Pressable>
                              <View
                                style={{
                                  flex: 1,
                                  backgroundColor: isDark ? '#131e30' : '#f8fafc',
                                  padding: 10,
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: isDark ? '#1b2a40' : '#e2e8f0',
                                }}
                              >
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 2,
                                  }}
                                >
                                  <Pressable
                                    onPress={() => {
                                      if (authorId) {
                                        router.push({
                                          pathname: '/(app)/profile',
                                          params: { id: authorId },
                                        });
                                      }
                                    }}
                                    style={({ pressed, hovered }: any) => [
                                      (pressed || hovered) && { opacity: 0.7 },
                                    ]}
                                  >
                                    <Text
                                      style={{
                                        color: goldPrimary,
                                        fontWeight: '800',
                                        fontSize: 13,
                                        textDecorationLine: 'underline',
                                      }}
                                    >
                                      {cName}
                                    </Text>
                                  </Pressable>
                                  <Text style={{ color: '#64748b', fontSize: 10 }}>
                                    {commentTime}
                                  </Text>
                                </View>
                                <Text
                                  style={{
                                    color: isDark ? '#e2e8f0' : '#1e293b',
                                    fontSize: 12.5,
                                    lineHeight: 17,
                                  }}
                                >
                                  {commentBody}
                                </Text>
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                          <Text style={{ color: '#8b9bb4', fontSize: 12 }}>
                            No comments yet. Start the conversation!
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            RIGHT COLUMN: Boolok GPT News & Suggested Elite Real Estate Advisors
        ════════════════════════════════════════════════════════════════════════ */}
        {(isDesktop || isTablet) && (
          <View style={styles.rightColumn}>
            {/* ── CARD 1: Boolok GPT News (Replaces LinkedIn News) ─────────── */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
              {/* Header with Boolok GPT Mark */}
              <View style={styles.newsHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <BoolokLogo size={20} color="#ffffff" />
                  <Text style={styles.newsHeaderTitle}>Boolok GPT News</Text>
                </View>
                <MaterialIcons name="info-outline" size={16} color="#8b9bb4" />
              </View>

              <Text style={styles.newsSubheader}>Top Real Estate Stories</Text>

              {/* News Items List */}
              <View style={styles.newsListContainer}>
                {displayedNews.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.newsItemRow}
                    onPress={() => setSelectedNewsStory(item)}
                  >
                    <View style={styles.newsDotIndicator} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.newsItemTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.newsItemMeta}>
                        {item.time} · {item.readers}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* Show more toggle */}
              <Pressable
                onPress={() => setShowAllNews(!showAllNews)}
                style={styles.showMoreNewsBtn}
              >
                <Text style={styles.showMoreNewsText}>
                  {showAllNews ? 'Show less news ▴' : 'Show more news ▾'}
                </Text>
              </Pressable>
            </View>

            {/* ── CARD 2: Suggested Real Estate Advisors ──────────────────── */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 12 }]}>
              <Text style={styles.advisorsHeading}>Suggested for you</Text>

              {suggestedUsers.length > 0 ? (
                suggestedUsers.map((adv) => {
                  const advId = adv.id || adv._id;
                  const isF = isUserFollowed(adv);
                  let advFullName = adv.fullName;
                  let advUsername = adv.username;

                  if (advUsername === 'ig_vicky16' || advUsername === 'ig_vicky.16' || advUsername === 'vicky' || advUsername === 'vignesh' || (advFullName && advFullName.includes('Vicky'))) {
                    advFullName = 'Vigneshwaran';
                    advUsername = 'vignesh';
                  }
                  if (advUsername === 'aswin.realty' || advUsername === 'aswin_realty' || advUsername === 'aswin' || (advFullName && advFullName.includes('Aswin'))) {
                    advFullName = 'Aswin Real Estate';
                    advUsername = 'aswin';
                  }
                  if (advUsername === 'yashwanth_realty' || advUsername === 'cinemahub.live' || advUsername === 'cinemahub' || (advFullName && (advFullName.includes('Yashwanth Realty') || advFullName.includes('cinemahub')))) {
                    advFullName = 'Yashwanth';
                    advUsername = 'yashwanth';
                  }

                  const initial = (advFullName || advUsername || 'U')[0]?.toUpperCase();
                  return (
                    <View key={advId} style={styles.advisorRow}>
                      <Pressable
                        onPress={() =>
                          router.push({ pathname: '/(app)/profile', params: { id: advUsername || advId } })
                        }
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      >
                        <UserAvatar user={{ ...adv, fullName: advFullName, username: advUsername }} size={40} style={styles.advisorAvatar} />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={styles.advisorName} numberOfLines={1}>
                            {advFullName}
                          </Text>
                          <Text style={styles.advisorSubtitle} numberOfLines={1}>
                            @{advUsername} · {adv.followerCount || 0} followers
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={() => toggleFollowAdvisor(advId, adv)}
                        style={[
                          styles.advisorFollowBtn,
                          isF && { backgroundColor: '#1a273c' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.advisorFollowBtnText,
                            { color: isF ? '#ffffff' : goldPrimary },
                          ]}
                        >
                          {isF ? '✓ Following' : '+ Follow'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ color: '#8b9bb4', fontSize: 12 }}>Invite real estate colleagues to grow your network.</Text>
                </View>
              )}
            </View>

            {/* Footer legal & branding */}
            <View style={styles.footerLegal}>
              <Text style={styles.footerLegalLinks}>
                About · Help · Press · API · Jobs · Privacy · Terms · Real Estate Insights
              </Text>
              <Text style={styles.footerCopyright}>
                © 2026 BOOLOK GPT REAL ESTATE NETWORK
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Create Post Full Modal ────────────────────────────────────────── */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UserAvatar user={user} size={40} style={styles.modalHeaderAvatar} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.modalAuthorName}>
                    {user?.fullName || user?.username || 'Boolok Member'}
                  </Text>
                  <Text style={styles.modalAuthorPrivacy}>🌐 Post to Anyone</Text>
                </View>
              </View>
              <Pressable onPress={() => setIsCreateModalOpen(false)}>
                <MaterialIcons name="close" size={24} color="#ffffff" />
              </Pressable>
            </View>

            <TextInput
              placeholder="What commercial property or market insight do you want to share?"
              placeholderTextColor="#66768f"
              multiline
              numberOfLines={5}
              style={styles.modalTextInput}
              value={newPostText}
              onChangeText={setNewPostText}
            />

            {/* Image Preview if selected from Device/URL */}
            {newPostImage ? (
              <View style={styles.imagePreviewBox}>
                <Image
                  source={{ uri: newPostImage }}
                  style={styles.imagePreviewImg}
                  resizeMode="cover"
                />
                <View style={styles.imagePreviewInfoBar}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#4ade80" />
                    <Text style={styles.imagePreviewLabel} numberOfLines={1}>
                      Frame: {cropRatioLabel} | Zoom: {cropZoom.toFixed(1)}x
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      onPress={() => openCropTool(rawSelectedImage || newPostImage)}
                      style={[styles.imagePreviewCropBtn, { borderColor: goldPrimary }]}
                    >
                      <MaterialIcons name="crop" size={14} color={goldPrimary} />
                      <Text style={[styles.imagePreviewCropText, { color: goldPrimary }]}>Alter Frame & Crop</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setNewPostImage(null);
                        setRawSelectedImage(null);
                      }}
                      style={styles.imagePreviewRemoveBtn}
                    >
                      <MaterialIcons name="close" size={14} color="#ffffff" />
                      <Text style={styles.imagePreviewRemoveText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ marginBottom: 14 }}>
                <View style={styles.modalUploadOptionsRow}>
                  <Pressable
                    onPress={handlePickImageFromDevice}
                    style={styles.modalUploadDeviceBtn}
                  >
                    <MaterialIcons name="add-photo-alternate" size={20} color="#38bdf8" />
                    <Text style={styles.modalUploadDeviceText}>Choose Photo from Device</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleTakePhotoFromCamera}
                    style={styles.modalUploadCameraBtn}
                  >
                    <MaterialIcons name="photo-camera" size={18} color="#e6b800" />
                    <Text style={styles.modalUploadCameraText}>Camera</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <TextInput
                    placeholder="Or paste property image URL (e.g. https://...)..."
                    placeholderTextColor="#66768f"
                    style={[styles.modalUrlInput, { borderColor, marginBottom: 0, flex: 1 }]}
                    value={newPostImage || ''}
                    onChangeText={setNewPostImage}
                  />
                  {newPostImage ? (
                    <Pressable
                      onPress={() => openCropTool(newPostImage)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: '#1e293b',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: goldPrimary,
                      }}
                    >
                      <MaterialIcons name="crop" size={16} color={goldPrimary} />
                      <Text style={{ color: goldPrimary, fontSize: 12, fontWeight: '700' }}>Alter Frame</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )}

            <View style={styles.modalFooterActions}>
              <Pressable
                onPress={() => router.push('/(app)/profile')}
                style={styles.modalAttachVideoBtn}
              >
                <MaterialIcons name="videocam" size={20} color="#60a5fa" />
                <Text style={styles.modalAttachVideoText}>Upload Video Reel</Text>
              </Pressable>

              <Pressable
                onPress={handleCreatePost}
                disabled={isPublishing}
                style={[styles.modalPublishBtn, { backgroundColor: goldPrimary }]}
              >
                {isPublishing ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.modalPublishBtnText}>Post</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── ALTER FRAME & CROP MODAL ────────────────────────────────────────── */}
      <Modal
        visible={isCropModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCropModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.cropModalContainer, { backgroundColor: cardBg, borderColor }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(230, 184, 0, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="crop" size={18} color={goldPrimary} />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                    Alter Frame & Crop
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#8b9bb4' : '#64748b' }}>
                    Select aspect ratio frame, zoom size & align before posting
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setIsCropModalOpen(false)}
                style={{ padding: 6, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              >
                <MaterialIcons name="close" size={20} color={isDark ? '#cbd5e1' : '#475569'} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 580 }}>
              {/* Aspect Ratio Frame Selector */}
              <View style={{ marginTop: 14, marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: goldPrimary, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  1. Choose Aspect Ratio Frame
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {FRAME_RATIOS.map((ratio) => {
                    const isSelected = cropRatioLabel === ratio.label;
                    return (
                      <Pressable
                        key={ratio.label}
                        onPress={() => {
                          setCropAspectRatio(ratio.value);
                          setCropRatioLabel(ratio.label);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          backgroundColor: isSelected ? 'rgba(230, 184, 0, 0.18)' : (isDark ? '#131e2e' : '#f1f5f9'),
                          borderWidth: 1.5,
                          borderColor: isSelected ? goldPrimary : (isDark ? '#1e2e42' : '#cbd5e1'),
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={ratio.label === '1:1' ? 'crop-square' : ratio.label === '16:9' ? 'crop-landscape' : ratio.label === '9:16' ? 'cellphone' : 'crop-portrait'}
                          size={15}
                          color={isSelected ? goldPrimary : (isDark ? '#8b9bb4' : '#64748b')}
                        />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? goldPrimary : (isDark ? '#cbd5e1' : '#334155') }}>
                          {ratio.label}
                        </Text>
                        <Text style={{ fontSize: 10, color: isSelected ? (isDark ? '#fef08a' : '#854d0e') : (isDark ? '#64748b' : '#94a3b8') }}>
                          ({ratio.name})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Live Framing Preview Viewfinder */}
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: goldPrimary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    2. Viewfinder & Crop Preview
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                    Frame: <Text style={{ color: goldPrimary, fontWeight: '700' }}>{cropRatioLabel}</Text> • Zoom: <Text style={{ color: goldPrimary, fontWeight: '700' }}>{cropZoom.toFixed(1)}x</Text> • Rot: <Text style={{ color: goldPrimary, fontWeight: '700' }}>{cropRotation}°</Text>
                  </Text>
                </View>

                {/* Outer Viewport Canvas */}
                <View
                  style={{
                    width: '100%',
                    height: 280,
                    backgroundColor: '#03070d',
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: '#1e2e42',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Dynamic Aspect Ratio Mask Window */}
                  {(() => {
                    const maxFrameW = Math.min(width - 64, 460);
                    const maxFrameH = 250;
                    let frameW = maxFrameW;
                    let frameH = Math.round(frameW / cropAspectRatio);
                    if (frameH > maxFrameH) {
                      frameH = maxFrameH;
                      frameW = Math.round(frameH * cropAspectRatio);
                    }
                    if (frameW > maxFrameW) {
                      frameW = maxFrameW;
                      frameH = Math.round(frameW / cropAspectRatio);
                    }

                    return (
                      <View
                        style={{
                          width: frameW,
                          height: frameH,
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: 8,
                          borderWidth: 2,
                          borderColor: goldPrimary,
                          backgroundColor: '#060b13',
                          shadowColor: goldPrimary,
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                          elevation: 8,
                        }}
                      >
                        {/* The Actual Transformed Image */}
                        {rawSelectedImage || newPostImage ? (
                          <View
                            style={{
                              width: '100%',
                              height: '100%',
                              transform: [
                                { scale: cropZoom },
                                { rotate: `${cropRotation}deg` },
                                { translateX: cropPanX * 35 },
                                { translateY: cropPanY * 35 },
                              ],
                            }}
                          >
                            <Image
                              source={{ uri: rawSelectedImage || newPostImage || '' }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                          </View>
                        ) : null}

                        {/* Rule of Thirds Golden Grid Lines */}
                        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                          {/* Horizontal Lines */}
                          <View style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(230, 184, 0, 0.4)' }} />
                          <View style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(230, 184, 0, 0.4)' }} />
                          {/* Vertical Lines */}
                          <View style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(230, 184, 0, 0.4)' }} />
                          <View style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(230, 184, 0, 0.4)' }} />

                          {/* Corner Brackets */}
                          <View style={{ position: 'absolute', top: 4, left: 4, width: 12, height: 12, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#ffffff' }} />
                          <View style={{ position: 'absolute', top: 4, right: 4, width: 12, height: 12, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#ffffff' }} />
                          <View style={{ position: 'absolute', bottom: 4, left: 4, width: 12, height: 12, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#ffffff' }} />
                          <View style={{ position: 'absolute', bottom: 4, right: 4, width: 12, height: 12, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#ffffff' }} />
                        </View>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Adjust Controls: Size/Zoom, Position Pan, and Rotation */}
              <View style={{ backgroundColor: isDark ? '#0b1320' : '#f8fafc', borderRadius: 10, padding: 12, borderWidth: 1, borderColor, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: goldPrimary, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  3. Adjust Size & Framing Position
                </Text>

                {/* Size / Zoom Steppers & Presets */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#cbd5e1' : '#334155' }}>
                      Size / Zoom Scale
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: goldPrimary }}>
                      {cropZoom.toFixed(2)}x
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      onPress={() => setCropZoom((prev) => Math.max(1, parseFloat((prev - 0.1).toFixed(2))))}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialIcons name="remove" size={18} color={isDark ? '#ffffff' : '#0f172a'} />
                    </Pressable>

                    {/* Quick Zoom Presets */}
                    {[1.0, 1.25, 1.5, 2.0].map((z) => (
                      <Pressable
                        key={z}
                        onPress={() => setCropZoom(z)}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          borderRadius: 8,
                          backgroundColor: Math.abs(cropZoom - z) < 0.05 ? 'rgba(230, 184, 0, 0.2)' : (isDark ? '#131e2e' : '#f1f5f9'),
                          borderWidth: 1,
                          borderColor: Math.abs(cropZoom - z) < 0.05 ? goldPrimary : (isDark ? '#233248' : '#cbd5e1'),
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: Math.abs(cropZoom - z) < 0.05 ? goldPrimary : (isDark ? '#cbd5e1' : '#334155') }}>
                          {z}x
                        </Text>
                      </Pressable>
                    ))}

                    <Pressable
                      onPress={() => setCropZoom((prev) => Math.min(3, parseFloat((prev + 0.1).toFixed(2))))}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialIcons name="add" size={18} color={isDark ? '#ffffff' : '#0f172a'} />
                    </Pressable>
                  </View>
                </View>

                {/* Pan Positioning & Rotation Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: isDark ? '#182436' : '#e2e8f0' }}>
                  {/* Pan D-pad */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#8b9bb4' : '#64748b', marginBottom: 6 }}>
                      Pan & Align Framing
                    </Text>
                    <View style={{ alignItems: 'center' }}>
                      <Pressable
                        onPress={() => setCropPanY((prev) => Math.max(-1, parseFloat((prev - 0.2).toFixed(2))))}
                        style={{ width: 30, height: 26, borderRadius: 6, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}
                      >
                        <MaterialIcons name="keyboard-arrow-up" size={18} color={isDark ? '#ffffff' : '#0f172a'} />
                      </Pressable>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Pressable
                          onPress={() => setCropPanX((prev) => Math.max(-1, parseFloat((prev - 0.2).toFixed(2))))}
                          style={{ width: 30, height: 26, borderRadius: 6, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MaterialIcons name="keyboard-arrow-left" size={18} color={isDark ? '#ffffff' : '#0f172a'} />
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setCropPanX(0);
                            setCropPanY(0);
                          }}
                          style={{ paddingHorizontal: 8, height: 26, borderRadius: 6, backgroundColor: 'rgba(230, 184, 0, 0.15)', borderWidth: 1, borderColor: goldPrimary, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: goldPrimary }}>Center</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setCropPanX((prev) => Math.min(1, parseFloat((prev + 0.2).toFixed(2))))}
                          style={{ width: 30, height: 26, borderRadius: 6, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MaterialIcons name="keyboard-arrow-right" size={18} color={isDark ? '#ffffff' : '#0f172a'} />
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={() => setCropPanY((prev) => Math.min(1, parseFloat((prev + 0.2).toFixed(2))))}
                        style={{ width: 30, height: 26, borderRadius: 6, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
                      >
                        <MaterialIcons name="keyboard-arrow-down" size={18} color={isDark ? '#ffffff' : '#0f172a'} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Rotate & Reset Column */}
                  <View style={{ width: 130, gap: 8 }}>
                    <Pressable
                      onPress={() => setCropRotation((prev) => (prev + 90) % 360)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: isDark ? '#1a2638' : '#e2e8f0',
                        borderWidth: 1,
                        borderColor: isDark ? '#2b3d56' : '#cbd5e1',
                      }}
                    >
                      <MaterialIcons name="rotate-right" size={18} color={goldPrimary} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#ffffff' : '#0f172a' }}>
                        Rotate 90°
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setCropZoom(1);
                        setCropPanX(0);
                        setCropPanY(0);
                        setCropRotation(0);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: isDark ? '#334155' : '#cbd5e1',
                      }}
                    >
                      <MaterialIcons name="refresh" size={16} color={isDark ? '#8b9bb4' : '#64748b'} />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#8b9bb4' : '#64748b' }}>
                        Reset Framing
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: borderColor }}>
              <Pressable
                onPress={() => setIsCropModalOpen(false)}
                style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#cbd5e1' : '#475569' }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleApplyCrop}
                disabled={isCropping}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  backgroundColor: goldPrimary,
                  opacity: isCropping ? 0.7 : 1,
                }}
              >
                {isCropping ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={18} color="#000000" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#000000' }}>
                      Apply Frame & Crop
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── POST LIKES / REACTIONS MODAL WITH REAL-TIME CATEGORIES (ALL, LIKES, LOVE) ── */}
      <Modal
        visible={isLikesModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLikesModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: cardBg, borderColor, maxWidth: 500, maxHeight: 540 }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.reactionDot, { backgroundColor: '#0a66c2', width: 22, height: 22, borderRadius: 11 }]}>
                  <MaterialIcons name="thumb-up" size={12} color="#ffffff" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a', marginLeft: 4 }}>
                  Likes ({allReactionUsers.length > 0 ? allReactionUsers.length : (likesModalPost?.likesCount || 0)})
                </Text>
              </View>
              <Pressable onPress={() => setIsLikesModalOpen(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color={isDark ? '#8b9bb4' : '#64748b'} />
              </Pressable>
            </View>

            {/* Categorization Tabs */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 10 }}>
              <Pressable
                onPress={() => setReactionTab('all')}
                style={[
                  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: reactionTab === 'all' ? (isDark ? '#1e293b' : '#f1f5f9') : 'transparent', borderWidth: 1, borderColor: reactionTab === 'all' ? (isDark ? '#334155' : '#cbd5e1') : 'transparent' },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: reactionTab === 'all' ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#8b9bb4' : '#64748b') }}>
                  All ({allReactionUsers.length > 0 ? allReactionUsers.length : (likesModalPost?.likesCount || 0)})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setReactionTab('like')}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: reactionTab === 'like' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', borderWidth: 1, borderColor: reactionTab === 'like' ? '#3b82f6' : 'transparent' },
                ]}
              >
                <View style={[styles.reactionDot, { backgroundColor: '#0a66c2', width: 18, height: 18, borderRadius: 9 }]}>
                  <MaterialIcons name="thumb-up" size={10} color="#ffffff" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: reactionTab === 'like' ? '#3b82f6' : (isDark ? '#8b9bb4' : '#64748b') }}>
                  Thumbs Up ({allReactionUsers.length > 0 ? allReactionUsers.length : (likesModalPost?.likesCount || 0)})
                </Text>
              </Pressable>
            </View>

            {/* Users List Filtered by Active Tab */}
            <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
              {isLoadingLikes ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={goldPrimary} />
                  <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 12, marginTop: 8 }}>Loading real-time reactions...</Text>
                </View>
              ) : (reactionTab === 'all' ? allReactionUsers : allReactionUsers.filter((u) => u.reactionType === reactionTab)).length > 0 ? (
                 (reactionTab === 'all' ? allReactionUsers : allReactionUsers.filter((u) => u.reactionType === reactionTab)).map((u: any, idx: number) => {
                  const uId = u.id || u._id || u.username;
                  const uUsername = u.username || '';
                  // Check if this entry is the currently logged-in user
                  const viewerId = user?.id || user?._id;
                  const viewerUsername = user?.username || '';
                  const isMe = Boolean(
                    (uId && viewerId && uId === viewerId) ||
                    (uUsername && viewerUsername && uUsername === viewerUsername)
                  );
                  // Check follow state by all possible identifiers
                  const isF = isUserFollowed(u);
                  const uReaction = u.reactionType || 'like';

                  return (
                    <View
                      key={uId || idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                        paddingHorizontal: 6,
                        borderRadius: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: borderColor,
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          setIsLikesModalOpen(false);
                          router.push({ pathname: '/(app)/profile', params: { id: uId } });
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}
                      >
                        <View style={{ position: 'relative' }}>
                          <UserAvatar user={u} size={40} />
                          <View
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              backgroundColor: '#0a66c2',
                              justifyContent: 'center',
                              alignItems: 'center',
                              borderWidth: 1.5,
                              borderColor: cardBg,
                            }}
                          >
                            <MaterialIcons name="thumb-up" size={8} color="#ffffff" />
                          </View>
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '700', fontSize: 14 }}>
                              {u.fullName || u.username}{isMe ? ' (You)' : ''}
                            </Text>
                            <MaterialIcons name="verified" size={14} color="#0095f6" />
                          </View>
                          <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 12 }}>
                            @{u.username}
                          </Text>
                          {u.headline && (
                            <Text style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                              {u.headline}
                            </Text>
                          )}
                        </View>
                      </Pressable>

                      {/* Connect button — hidden for current user */}
                      {!isMe && (
                        <Pressable
                          onPress={() => toggleFollowAdvisor(uId, u)}
                          style={[
                            styles.advisorFollowBtn,
                            isF && { backgroundColor: isDark ? '#1a273c' : '#f1f5f9' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.advisorFollowBtnText,
                              { color: isF ? (isDark ? '#ffffff' : '#0f172a') : goldPrimary },
                            ]}
                          >
                            {isF ? '✓ Connected' : '+ Connect'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 13 }}>No {reactionTab === 'like' ? 'Likes' : reactionTab === 'love' ? 'Love reactions' : 'reactions'} yet.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Followers Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={isFollowersModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFollowersModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 480, backgroundColor: isDark ? '#09111e' : '#ffffff', borderRadius: 16, borderWidth: 1, borderColor, maxHeight: 540, padding: 18 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(230, 184, 0, 0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialIcons name="people" size={16} color={goldPrimary} />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                    Network Followers ({followersList.length})
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#8b9bb4' : '#64748b', marginTop: 1 }}>
                    Real-time real estate professionals in your network
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setIsFollowersModalOpen(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color={isDark ? '#8b9bb4' : '#64748b'} />
              </Pressable>
            </View>

            {/* List */}
            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {isLoadingFollowers ? (
                <ActivityIndicator size="small" color={goldPrimary} style={{ marginVertical: 24 }} />
              ) : followersList.length > 0 ? (
                followersList.map((fUser: any, idx: number) => {
                  const fId = fUser.id || fUser._id || fUser.username;
                  const fUsername = fUser.username || '';
                  // Check if this follower is the current user
                  const viewerIdF = user?.id || user?._id;
                  const viewerUsernameF = user?.username || '';
                  const isMeF = Boolean(
                    (fId && viewerIdF && fId === viewerIdF) ||
                    (fUsername && viewerUsernameF && fUsername === viewerUsernameF)
                  );
                  // Check follow state by all possible identifiers
                  const isF = isUserFollowed(fUser);
                  return (
                    <View
                      key={fId || idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        borderRadius: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: borderColor,
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          setIsFollowersModalOpen(false);
                          router.push({ pathname: '/(app)/profile', params: { id: fId } });
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}
                      >
                        <UserAvatar user={fUser} size={42} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '700', fontSize: 13.5 }}>
                              {fUser.fullName || fUser.username}{isMeF ? ' (You)' : ''}
                            </Text>
                            <MaterialIcons name="verified" size={14} color="#0095f6" />
                          </View>
                          <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 11.5 }}>
                            @{fUser.username}
                          </Text>
                          {fUser.headline && (
                            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                              {fUser.headline}
                            </Text>
                          )}
                        </View>
                      </Pressable>

                      {/* Connect button — hidden for current user */}
                      {!isMeF && (
                        <Pressable
                          onPress={() => toggleFollowAdvisor(fId, fUser)}
                          style={[
                            styles.advisorFollowBtn,
                            isF && { backgroundColor: '#1a273c', borderColor: '#223854' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.advisorFollowBtnText,
                              { color: isF ? '#ffffff' : goldPrimary },
                            ]}
                          >
                            {isF ? '✓ Connected' : '+ Connect'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#8b9bb4', fontSize: 13 }}>No followers yet.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 1. SAVED PROPERTIES & REELS MODAL (Remains saved until removed) ── */}
      <Modal
        visible={isSavedModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSavedModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: cardBg, borderColor, maxWidth: 580, maxHeight: 640 }]}>
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(230, 184, 0, 0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialIcons name="bookmark" size={18} color={goldPrimary} />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                    Saved Properties & Reels ({savedReelsList.length})
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#8b9bb4' : '#64748b' }}>
                    Persisted portfolio clips and listings · Stays saved until you remove
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setIsSavedModalOpen(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color={isDark ? '#8b9bb4' : '#64748b'} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {savedReelsList.length > 0 ? (
                savedReelsList.map((item: any, idx: number) => (
                  <View
                    key={item._id || item.id || idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDark ? '#08111e' : '#f8fafc',
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: isDark ? '#1a273c' : '#e2e8f0',
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setIsSavedModalOpen(false);
                        router.push('/(app)/insights');
                      }}
                      style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' }}
                    >
                      <Image
                        source={{ uri: item.thumbnail || item.poster || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800' }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                        <MaterialIcons name="play-circle-filled" size={24} color="#e6b800" />
                      </View>
                    </Pressable>

                    <View style={{ flex: 1, marginLeft: 12, paddingRight: 6 }}>
                      <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '700', fontSize: 13.5 }} numberOfLines={1}>
                        {item.title || 'Saved Property Reel'}
                      </Text>
                      <Text style={{ color: goldPrimary, fontSize: 11.5, fontWeight: '600', marginTop: 2 }}>
                        📍 {item.location || 'Bangalore, India'}
                      </Text>
                      {item.insight && (
                        <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 11, marginTop: 3 }} numberOfLines={2}>
                          {item.insight}
                        </Text>
                      )}
                    </View>

                    <Pressable
                      onPress={() => handleRemoveSavedReel(item._id || item.id)}
                      style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
                    >
                      <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="bookmark-off-outline" size={42} color={isDark ? '#334155' : '#cbd5e1'} />
                  <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '700', fontSize: 15, marginTop: 12 }}>
                    No Saved Items Yet
                  </Text>
                  <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 12, textAlign: 'center', marginTop: 4, maxWidth: 300 }}>
                    Click the bookmark button on any reel in Insights or property listing to save it here indefinitely.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 2. REAL-TIME BROKERS NEAR ME MODAL ── */}
      <Modal
        visible={isBrokerNetworkModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBrokerNetworkModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: cardBg, borderColor, maxWidth: 580, maxHeight: 660 }]}>
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(230, 184, 0, 0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialIcons name="location-on" size={18} color={goldPrimary} />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                    Real-Time Brokers Near Me
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#8b9bb4' : '#64748b' }}>
                    Live GPS radar active · Verified certified real estate advisors in your radius
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setIsBrokerNetworkModalOpen(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color={isDark ? '#8b9bb4' : '#64748b'} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {DEFAULT_COMMUNITY_ADVISORS.map((broker: any) => {
                const bId = broker.id || broker._id;
                const isF = isUserFollowed(broker);
                return (
                  <View
                    key={bId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      marginBottom: 10,
                      borderRadius: 12,
                      backgroundColor: isDark ? '#08111e' : '#f8fafc',
                      borderWidth: 1,
                      borderColor: isDark ? '#1a273c' : '#e2e8f0',
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setIsBrokerNetworkModalOpen(false);
                        router.push({ pathname: '/(app)/profile', params: { id: bId } });
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}
                    >
                      <UserAvatar user={broker} size={48} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '700', fontSize: 14 }}>
                            {broker.fullName}
                          </Text>
                          <MaterialIcons name="verified" size={15} color="#0095f6" />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <Text style={{ color: goldPrimary, fontSize: 11.5, fontWeight: '700' }}>
                            📍 {broker.distance || '1.2 km away'}
                          </Text>
                          <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 11 }}>
                            · {broker.deals || '18 deals closed'}
                          </Text>
                        </View>
                        <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                          {broker.headline}
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => toggleFollowAdvisor(bId, broker)}
                      style={[
                        styles.advisorFollowBtn,
                        isF && { backgroundColor: '#1a273c', borderColor: '#223854' },
                      ]}
                    >
                      <Text style={[styles.advisorFollowBtnText, { color: isF ? '#ffffff' : goldPrimary }]}>
                        {isF ? '✓ Connected' : '+ Connect'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 3. MARKET NEWSLETTERS MODAL ── */}
      <Modal
        visible={isNewslettersModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNewslettersModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: cardBg, borderColor, maxWidth: 620, maxHeight: 680 }]}>
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(56, 189, 248, 0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialIcons name="article" size={18} color="#38bdf8" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                    Commercial & Residential Newsletters
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#8b9bb4' : '#64748b' }}>
                    Curated weekly intelligence for institutional real estate decision-makers
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setIsNewslettersModalOpen(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color={isDark ? '#8b9bb4' : '#64748b'} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {[
                {
                  id: 'nl-1',
                  edition: 'Issue #48 · September 2026',
                  title: 'Outer Ring Road Tech Hub Yields & Cap Rate Index',
                  readTime: '4 min read · 8,400 subscribers',
                  excerpt: 'Commercial campus pre-leasing velocity on Bangalore’s Outer Ring Road accelerated by 18% YoY. Tech conglomerates are committing to 9-year WALE leases with institutional 8.4% cap returns.',
                  author: 'Shreekutti · Head of Campus Acquisitions',
                  tags: ['Commercial', 'Tech Parks', 'Bangalore'],
                },
                {
                  id: 'nl-2',
                  edition: 'Issue #47 · September 2026',
                  title: 'Global Trophy Waterfronts & Private Island Compounds',
                  readTime: '6 min read · 12,100 subscribers',
                  excerpt: 'Deepwater dock accessibility and private helipad configurations are driving $4.2B in institutional capital allocation across Miami Beach and Dubai Palm Jumeirah.',
                  author: 'Mohammed Ajmal · Luxury Real Estate Lead',
                  tags: ['Luxury Estates', 'Waterfront', 'Global'],
                },
                {
                  id: 'nl-3',
                  edition: 'Issue #46 · August 2026',
                  title: 'Agricultural & Vineyard Terroir Valuations in Western Australia',
                  readTime: '5 min read · 6,900 subscribers',
                  excerpt: 'Margaret River commercial estate acquisitions yield high-margin hospitality and cellar door revenue, underpinned by 50-year deeded water rights.',
                  author: 'Logeshwaran A · Architectural Consultant',
                  tags: ['Vineyards', 'Hospitality', 'Australia'],
                },
              ].map((nl) => (
                <View
                  key={nl.id}
                  style={{
                    backgroundColor: isDark ? '#08111e' : '#f8fafc',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: isDark ? '#1a273c' : '#e2e8f0',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                      {nl.edition}
                    </Text>
                    <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 11 }}>
                      {nl.readTime}
                    </Text>
                  </View>
                  <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '800', fontSize: 15, marginTop: 6 }}>
                    {nl.title}
                  </Text>
                  <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 12.5, lineHeight: 18, marginTop: 6 }}>
                    {nl.excerpt}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: borderColor }}>
                    <Text style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 11.5, fontWeight: '600' }}>
                      ✍️ {nl.author}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setIsNewslettersModalOpen(false);
                        router.push('/(app)/insights');
                      }}
                      style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                    >
                      <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '700' }}>Read Edition →</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 4. PROPERTY AUCTIONS & UPCOMING EVENTS MODAL ── */}
      <Modal
        visible={isAuctionsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAuctionsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: cardBg, borderColor, maxWidth: 620, maxHeight: 680 }]}>
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(236, 72, 153, 0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialIcons name="gavel" size={18} color="#ec4899" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                    Upcoming Property Auctions & Events
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#8b9bb4' : '#64748b' }}>
                    Live institutional bidding · Turnkey residential & commercial properties for sale
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setIsAuctionsModalOpen(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color={isDark ? '#8b9bb4' : '#64748b'} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {[
                {
                  id: 'auc-1',
                  badge: 'LIVE AUCTION · 3 DAYS LEFT',
                  badgeColor: '#ec4899',
                  title: 'Grade-A Tech Park SEZ Development (Bangalore)',
                  startingBid: '$42,000,000',
                  specs: '92,000 sq ft · 8.4% Cap Rate · Triple Net Lease',
                  date: 'September 12, 2026 · 10:00 AM IST',
                  location: 'Outer Ring Road Tech Corridor, Bangalore',
                  organizer: 'Listed by Shreekutti (Boolok Advisors)',
                },
                {
                  id: 'auc-2',
                  badge: 'UPCOMING BIDDING',
                  badgeColor: '#3b82f6',
                  title: 'Margaret River Commercial Vineyard Estate',
                  startingBid: '$18,500,000',
                  specs: '140 Acres · Boutique Winery & Luxury Cellar Door',
                  date: 'September 18, 2026 · 02:00 PM AWST',
                  location: 'Caves Road, Western Australia',
                  organizer: 'Advised by Logeshwaran A',
                },
                {
                  id: 'auc-3',
                  badge: 'PRIVATE SYNDICATION',
                  badgeColor: '#10b981',
                  title: 'Palm Jumeirah Signature Waterfront Villa',
                  startingBid: '$24,000,000',
                  specs: '7 Beds · 9 Baths · Private Beachfront & Yacht Slip',
                  date: 'September 24, 2026 · 11:30 AM GST',
                  location: 'Palm Jumeirah Frond N, Dubai, UAE',
                  organizer: 'Represented by Mohammed Ajmal',
                },
              ].map((auc) => (
                <View
                  key={auc.id}
                  style={{
                    backgroundColor: isDark ? '#08111e' : '#f8fafc',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: isDark ? '#1a273c' : '#e2e8f0',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ backgroundColor: `${auc.badgeColor}25`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                      <Text style={{ color: auc.badgeColor, fontSize: 10.5, fontWeight: '800' }}>
                        {auc.badge}
                      </Text>
                    </View>
                    <Text style={{ color: goldPrimary, fontSize: 14, fontWeight: '800' }}>
                      {auc.startingBid}
                    </Text>
                  </View>

                  <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '800', fontSize: 15, marginTop: 8 }}>
                    {auc.title}
                  </Text>
                  <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 12, marginTop: 4 }}>
                    📐 {auc.specs}
                  </Text>
                  <Text style={{ color: isDark ? '#8b9bb4' : '#64748b', fontSize: 11.5, marginTop: 3 }}>
                    📅 {auc.date} · 📍 {auc.location}
                  </Text>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: borderColor }}>
                    <Text style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 11.5 }}>
                      {auc.organizer}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setIsAuctionsModalOpen(false);
                        router.push('/(app)/search');
                      }}
                      style={{ backgroundColor: goldPrimary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 }}
                    >
                      <Text style={{ color: '#000000', fontSize: 12, fontWeight: '800' }}>Bid / Register</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 5. BOOLOK GPT NEWS STORY & OFFICIAL REFERENCE MODAL ── */}
      <Modal
        visible={Boolean(selectedNewsStory)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNewsStory(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: cardBg, borderColor, maxWidth: 640, maxHeight: 680 }]}>
            {selectedNewsStory && (
              <>
                <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                    <BoolokLogo size={22} color="#ffffff" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                        Boolok GPT News · {selectedNewsStory.category || 'Real Estate Intelligence'}
                      </Text>
                      <Text style={{ fontSize: 11, color: isDark ? '#8b9bb4' : '#64748b' }}>
                        Updated daily · {selectedNewsStory.time || 'Today'} · {selectedNewsStory.readers || 'Thousands reading'}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setSelectedNewsStory(null)} style={{ padding: 4 }}>
                    <MaterialIcons name="close" size={22} color={isDark ? '#8b9bb4' : '#64748b'} />
                  </Pressable>
                </View>

                <ScrollView style={{ marginTop: 14 }} showsVerticalScrollIndicator={false}>
                  <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '800', fontSize: 18, lineHeight: 24 }}>
                    {selectedNewsStory.title}
                  </Text>

                  {selectedNewsStory.summary && (
                    <View style={{ backgroundColor: isDark ? '#162235' : '#f1f5f9', padding: 12, borderRadius: 8, marginTop: 12, borderLeftWidth: 3, borderLeftColor: goldPrimary }}>
                      <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontSize: 13, lineHeight: 19, fontWeight: '500' }}>
                        {selectedNewsStory.summary}
                      </Text>
                    </View>
                  )}

                  <Text style={{ color: isDark ? '#cbd5e1' : '#334155', fontSize: 13.5, lineHeight: 21, marginTop: 14 }}>
                    {selectedNewsStory.content || selectedNewsStory.snippet || 'Real-time property transactions demonstrate accelerating liquidity into premier commercial and residential assets.'}
                  </Text>

                  {/* Official Reference & Daily Source Link */}
                  <View style={{ marginTop: 20, padding: 14, borderRadius: 10, backgroundColor: isDark ? '#08111e' : '#f8fafc', borderWidth: 1, borderColor: isDark ? '#1a273c' : '#e2e8f0' }}>
                    <Text style={{ color: goldPrimary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                      OFFICIAL SOURCE & REFERENCE LINK
                    </Text>
                    <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                      {selectedNewsStory.sourceName || 'Bloomberg Real Estate & Global Property Index'}
                    </Text>
                    <Pressable
                      onPress={() => {
                        const url = selectedNewsStory.sourceUrl || 'https://www.bloomberg.com/real-estate';
                        if (Platform.OS === 'web') {
                          window.open(url, '_blank');
                        } else {
                          Linking.openURL(url);
                        }
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}
                    >
                      <MaterialIcons name="open-in-new" size={16} color="#38bdf8" />
                      <Text style={{ color: '#38bdf8', fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' }}>
                        {selectedNewsStory.sourceUrl || 'https://www.bloomberg.com/real-estate'}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStyles = (isDark: boolean, width: number = 1024) => {
  const isDesktop = width >= 1024;
  const isMobile = width < 768;
  const isSmallMobile = width < 450;
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#cbd5e1' : '#475569';
  const textMuted = isDark ? '#8b9bb4' : '#64748b';
  const borderCol = isDark ? '#1a273c' : '#E2E8F0';
  const inputBg = isDark ? '#070e1a' : '#F1F5F9';
  const itemBubbleBg = isDark ? '#162235' : '#F1F5F9';
  const cardBackground = isDark ? '#0c1626' : '#FFFFFF';
  const actionBtnBackground = isDark ? '#1a273c' : '#F8FAFC';

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? '#060B13' : '#F8FAFC',
    },
    scrollContent: {
      paddingVertical: isMobile ? 12 : 24,
      paddingHorizontal: isMobile ? 10 : 16,
      alignItems: 'center',
    },
    mainLayoutContainer: {
      width: '100%',
      maxWidth: 1180,
      flexDirection: isDesktop ? 'row' : 'column',
      alignItems: isDesktop ? 'flex-start' : 'stretch',
      gap: isDesktop ? 24 : 12,
    },

    // Left Column
    leftColumn: {
      width: 240,
    },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: borderCol,
      backgroundColor: cardBackground,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 8,
      elevation: 2,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? 'none'
            : '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        } as any,
      }),
    },
    profileCoverBanner: {
      height: 64,
      width: '100%',
      padding: 8,
      alignItems: 'flex-end',
      borderTopLeftRadius: 11,
      borderTopRightRadius: 11,
    },
    bannerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    bannerBadgeText: {
      color: '#e6b800',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    profileAvatarWrapper: {
      marginTop: -32,
      alignSelf: 'center',
      position: 'relative',
    },
    profileAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      borderColor: cardBackground,
    },
    avatarPlusBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#e6b800',
      borderRadius: 10,
      padding: 2,
    },
    profileInfoBox: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 16,
      alignItems: 'center',
    },
    profileNameText: {
      fontSize: 16,
      fontWeight: '800',
      color: textPrimary,
      textAlign: 'center',
    },
    profileRoleText: {
      fontSize: 12,
      color: textSecondary,
      marginTop: 4,
      textAlign: 'center',
      lineHeight: 16,
    },
    profileLocationText: {
      fontSize: 11,
      color: textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    companyTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      backgroundColor: isDark ? '#162235' : '#f1f5f9',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    companyTagText: {
      color: '#e6b800',
      fontSize: 10,
      fontWeight: '700',
    },
    statsDivider: {
      borderTopWidth: 1,
      borderTopColor: borderCol,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    statRowItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 3,
    },
    statRowLabel: {
      color: textMuted,
      fontSize: 12,
    },
    statRowValue: {
      color: '#e6b800',
      fontSize: 12,
      fontWeight: '700',
    },
    savedItemsBtn: {
      borderTopWidth: 1,
      borderTopColor: borderCol,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
    },
    savedItemsText: {
      color: textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    quickMenuHeading: {
      color: textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 4,
    },
    quickMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    quickMenuText: {
      color: textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },

    // Center Column
    centerColumn: {
      flex: 1,
      width: '100%',
      maxWidth: isDesktop ? 580 : '100%',
    },
    startPostHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    startPostAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    startPostInputTrigger: {
      flex: 1,
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: 'center',
    },
    startPostPlaceholder: {
      color: textMuted,
      fontSize: 13,
      fontWeight: '500',
    },
    startPostActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: borderCol,
    },
    composerActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isSmallMobile ? 4 : 6,
      paddingHorizontal: isSmallMobile ? 6 : 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: actionBtnBackground,
    },
    composerActionText: {
      color: textSecondary,
      fontSize: isSmallMobile ? 11 : 12,
      fontWeight: '600',
    },

    // Sort
    sortHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 12,
    },
    sortDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: borderCol,
    },
    sortLabel: {
      color: textMuted,
      fontSize: 11,
      marginLeft: 12,
    },

    // Post Card
    postCard: {
      marginBottom: 16,
    },
    postHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 14,
    },
    postAuthorAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    postAuthorName: {
      color: textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    postAuthorDegree: {
      color: textMuted,
      fontSize: 12,
    },
    postAuthorTitle: {
      color: textMuted,
      fontSize: 11,
      marginTop: 1,
    },
    postTimeText: {
      color: isDark ? '#64748b' : '#94a3b8',
      fontSize: 10,
      marginTop: 2,
    },
    feedFollowBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: actionBtnBackground,
    },
    feedFollowBtnText: {
      fontSize: 12,
      fontWeight: '700',
    },
    postBodyContent: {
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontSize: 13.5,
      lineHeight: 19,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    postMediaContainer: {
      width: '100%',
    },
    singlePostImage: {
      width: '100%',
      height: isMobile ? Math.min(width * 0.72, 280) : 340,
    },
    multiImageRow: {
      flexDirection: 'row',
      gap: 2,
    },
    multiPostImage: {
      flex: 1,
      height: 240,
    },
    socialStatsBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: borderCol,
    },
    reactionIconsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 6,
    },
    reactionDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
    },
    socialReactionText: {
      color: textMuted,
      fontSize: 11,
    },
    socialCommentsCountText: {
      color: textMuted,
      fontSize: 11,
    },
    postActionsBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 6,
    },
    postActionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isSmallMobile ? 4 : 6,
      paddingVertical: 8,
      paddingHorizontal: isSmallMobile ? 6 : 12,
    },
    postActionItemText: {
      color: textMuted,
      fontSize: isSmallMobile ? 11 : 12,
      fontWeight: '600',
    },

    // Comments Drawer
    commentSectionDrawer: {
      borderTopWidth: 1,
      borderTopColor: borderCol,
      padding: 14,
    },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    commentUserAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    inlineCommentInput: {
      flex: 1,
      backgroundColor: inputBg,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      color: textPrimary,
      fontSize: 12.5,
      borderWidth: 1,
      borderColor: borderCol,
    },
    commentSubmitBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
    },
    commentSubmitBtnText: {
      color: '#000000',
      fontSize: 12,
      fontWeight: '700',
    },
    commentItemBlock: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 10,
    },
    commentItemAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    commentItemBubble: {
      flex: 1,
      backgroundColor: itemBubbleBg,
      borderRadius: 8,
      padding: 10,
    },
    commentItemAuthorName: {
      color: '#e6b800',
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 2,
    },
    commentItemText: {
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontSize: 12,
      lineHeight: 16,
    },

    // Right Column
    rightColumn: {
      width: 290,
    },
    newsHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 14,
    },
    newsHeaderTitle: {
      color: textPrimary,
      fontSize: 14,
      fontWeight: '800',
      marginLeft: 8,
    },
    newsSubheader: {
      color: textMuted,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 14,
      marginTop: 6,
      marginBottom: 10,
    },
    newsListContainer: {
      paddingHorizontal: 14,
    },
    newsItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginVertical: 6,
    },
    newsDotIndicator: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: '#e6b800',
      marginTop: 6,
    },
    newsItemTitle: {
      color: textPrimary,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    newsItemMeta: {
      color: textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    showMoreNewsBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: borderCol,
      marginTop: 8,
    },
    showMoreNewsText: {
      color: '#e6b800',
      fontSize: 11,
      fontWeight: '700',
    },

    // Suggested Advisors
    advisorsHeading: {
      color: textPrimary,
      fontSize: 13,
      fontWeight: '800',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 6,
    },
    advisorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    advisorAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    advisorName: {
      color: textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    advisorSubtitle: {
      color: textMuted,
      fontSize: 10,
      marginTop: 1,
    },
    advisorFollowBtn: {
      borderWidth: 1,
      borderColor: '#e6b800',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    advisorFollowBtnText: {
      fontSize: 11,
      fontWeight: '700',
    },

    footerLegal: {
      marginTop: 20,
      paddingHorizontal: 8,
    },
    footerLegalLinks: {
      color: isDark ? '#64748b' : '#94a3b8',
      fontSize: 10,
      lineHeight: 16,
      textAlign: 'center',
    },
    footerCopyright: {
      color: isDark ? '#475569' : '#64748b',
      fontSize: 9,
      marginTop: 6,
      textAlign: 'center',
      fontWeight: '600',
    },

    // Create Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: isMobile ? 10 : 20,
    },
    modalBox: {
      width: '100%',
      maxWidth: isMobile ? '96%' : 540,
      maxHeight: isMobile ? '92%' : '85%',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: borderCol,
      backgroundColor: cardBackground,
      padding: isMobile ? 14 : 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalHeaderAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    modalAuthorName: {
      color: textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    modalAuthorPrivacy: {
      color: textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    modalTextInput: {
      backgroundColor: inputBg,
      borderRadius: 8,
      padding: 14,
      color: textPrimary,
      fontSize: 14,
      minHeight: 120,
      textAlignVertical: 'top',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: borderCol,
    },
    modalUrlInput: {
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: textPrimary,
      fontSize: 13,
      marginBottom: 16,
    },
    modalUploadOptionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    modalUploadDeviceBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: actionBtnBackground,
      borderWidth: 1.5,
      borderColor: '#38bdf8',
      borderRadius: 8,
      paddingVertical: 11,
      paddingHorizontal: 12,
    },
    modalUploadDeviceText: {
      color: '#38bdf8',
      fontSize: 13,
      fontWeight: '700',
    },
    modalUploadCameraBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: actionBtnBackground,
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 8,
      paddingVertical: 11,
      paddingHorizontal: 14,
    },
    modalUploadCameraText: {
      color: textSecondary,
      fontSize: 12.5,
      fontWeight: '600',
    },
    imagePreviewBox: {
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 14,
      borderWidth: 1,
      borderColor: borderCol,
      backgroundColor: inputBg,
    },
    imagePreviewImg: {
      width: '100%',
      height: 190,
    },
    imagePreviewInfoBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: cardBackground,
      borderTopWidth: 1,
      borderTopColor: borderCol,
    },
    imagePreviewLabel: {
      color: textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    imagePreviewRemoveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#ef4444',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    imagePreviewRemoveText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700',
    },
    imagePreviewCropBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(230, 184, 0, 0.12)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
    },
    imagePreviewCropText: {
      fontSize: 11,
      fontWeight: '700',
    },
    cropModalContainer: {
      width: '100%',
      maxWidth: 540,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      maxHeight: '92%',
    },
    modalFooterActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalAttachVideoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    modalAttachVideoText: {
      color: '#60a5fa',
      fontSize: 13,
      fontWeight: '600',
    },
    modalPublishBtn: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 8,
    },
    modalPublishBtnText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '700',
    },
  });
};