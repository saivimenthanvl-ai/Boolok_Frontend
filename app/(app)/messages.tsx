import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Image,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  Keyboard,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { API_BASE_URL, resolveImageUrl } from '../../lib/api';
import { formatSmartDateTime, formatConversationTime, formatLastSeen, getMessageDateSeparator, isSameCalendarDay } from '../../lib/dateTime';
import BoolokLogo from '../../components/BoolokLogo';

const COMMUNITY_MEMBERS_DIRECTORY = [
  { id: 'shreekutti', fullName: 'Shreekutti', username: 'shreekutti', headline: 'Tech Park Portfolio Lead' },
  { id: 'ajmal', fullName: 'Mohammed Ajmal', username: 'ajmal', headline: 'Luxury Living & Villas Lead' },
  { id: 'logeshwarana', fullName: 'Logeshwaran A', username: 'logeshwarana', headline: 'Architectural Consultant' },
  { id: 'saivimenthanvl', fullName: 'Sai Vimenthan', username: 'saivimenthanvl', headline: 'Elite Real Estate Broker' },
  { id: 'vignesh', fullName: 'Vigneshwaran', username: 'vignesh', headline: 'Beverly Hills & OMR Acquisitions' },
  { id: 'aswin', fullName: 'Aswin Real Estate', username: 'aswin', headline: 'Commercial Assets Lead' },
  { id: 'bavadharini_rs', fullName: 'Bavadharini RS', username: 'bavadharini_rs', headline: 'Interior Architecture Lead' },
  { id: 'the_akshtr_estate', fullName: 'Akshat Commercials', username: 'the_akshtr_estate', headline: 'Institutional Syndications' },
];

export default function MessagesScreen() {
  const { width, height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const isWindowAlreadyResized = screenHeight - windowHeight > 150;
  const isWide = width >= 768;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { user: currentUser, token } = useAuth();
  const { theme, isDark } = useTheme();
  const { socket, isConnected, onlineUserIds, isUserOnline, joinConversation, leaveConversation, sendTyping, sendStopTyping, markConversationRead } = useSocket();

  // Color tokens
  const bgDark = isDark ? '#050a14' : '#F1F5F9';
  const cardBg = isDark ? '#0c1626' : '#FFFFFF';
  const innerCardBg = isDark ? '#111d33' : '#F8FAFC';
  const borderColor = isDark ? '#1a273c' : '#E2E8F0';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textMuted = isDark ? '#8b9bb4' : '#64748b';
  const goldPrimary = '#daa520';

  // State
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Dynamic keyboard avoidance padding for Android and Mobile Web
  const keyboardAvoidancePadding = Platform.OS === 'android' && !isWindowAlreadyResized
    ? keyboardHeight
    : (Platform.OS === 'web' && keyboardHeight > 0 ? keyboardHeight : 0);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const activeConversationRef = useRef<any>(null);

  // Keyboard show/hide listener to ensure message place stays visible and scrolls smoothly
  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const h = e?.endCoordinates?.height || 0;
      if (h > 0) {
        if (Platform.OS === 'android') {
          try {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          } catch (_) {}
        }
        setKeyboardHeight(h);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    };

    const handleKeyboardHide = () => {
      if (Platform.OS === 'android') {
        try {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        } catch (_) {}
      }
      setKeyboardHeight(0);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    };

    const subs = [
      Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
      Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
      Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
      Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
    ];

    let viewportResizeHandler: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.visualViewport) {
      viewportResizeHandler = () => {
        if (!window.visualViewport) return;
        const currentHeight = window.visualViewport.height;
        const totalHeight = window.innerHeight;
        const diff = totalHeight - currentHeight;
        if (diff > 120) {
          setKeyboardHeight(diff);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } else {
          setKeyboardHeight(0);
        }
      };
      window.visualViewport.addEventListener('resize', viewportResizeHandler);
    }

    return () => {
      subs.forEach((s) => s.remove());
      if (viewportResizeHandler && typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', viewportResizeHandler);
      }
    };
  }, []);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
    // Reflect active conversation in router params so layout hides bottom bar on mobile
    if (activeConversation?._id || activeConversation?.id) {
      const convId = String(activeConversation._id || activeConversation.id);
      router.setParams({ conv: convId });
    }
  }, [activeConversation]);

  // Clear state and reload on user account switch
  useEffect(() => {
    setActiveConversation(null);
    setMessages([]);
    fetchConversations();
  }, [currentUser?.id, (currentUser as any)?._id]);

  const getToken = async () =>
    token || (Platform.OS === 'web' ? localStorage.getItem('userToken') : await SecureStore.getItemAsync('userToken'));

  // 1. Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const authToken = await getToken();
      if (!authToken) return;
      const res = await axios.get(`${API_BASE_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (Array.isArray(res.data?.conversations)) {
        setConversations(res.data.conversations);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 2. Handle start conversation via URL query param (e.g. from profile or search)
  useEffect(() => {
    const targetUserId = params.userId as string;
    const targetUsername = params.username as string;

    if ((targetUserId || targetUsername) && !isLoadingConversations) {
      startChatWithUser(targetUserId, targetUsername);
    }
  }, [params.userId, params.username, isLoadingConversations]);

  const startChatWithUser = async (targetUserId?: string, targetUsername?: string) => {
    try {
      const authToken = await getToken();
      if (!authToken) return;
      const res = await axios.post(
        `${API_BASE_URL}/api/messages/start`,
        { targetUserId, targetUsername },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.data?.conversation) {
        setActiveConversation(res.data.conversation);
        fetchConversations();
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  // 3. Fetch messages for active conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    setIsLoadingMessages(true);
    try {
      const authToken = await getToken();
      if (!authToken) return;
      const res = await axios.get(`${API_BASE_URL}/api/messages/history/${conversationId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (Array.isArray(res.data?.messages)) {
        setMessages(res.data.messages);
      }
      // Mark as read
      markConversationRead(conversationId);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [markConversationRead]);

  // 4. Handle active conversation change & Socket channel join
  useEffect(() => {
    if (activeConversation?._id) {
      const convId = String(activeConversation._id || activeConversation.id);
      joinConversation(convId);
      fetchMessages(convId);

      return () => {
        leaveConversation(convId);
      };
    }
  }, [activeConversation?._id, activeConversation?.id, isConnected, joinConversation, leaveConversation, fetchMessages]);

  // 4b. Background message sync for open conversation (every 3 seconds fallback)
  useEffect(() => {
    if (!activeConversation?._id) return;
    const currentConvId = String(activeConversation._id || activeConversation.id);

    const interval = setInterval(async () => {
      try {
        const authToken = await getToken();
        if (!authToken) return;
        const res = await axios.get(`${API_BASE_URL}/api/messages/history/${currentConvId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (Array.isArray(res.data?.messages)) {
          setMessages((prev) => {
            if (res.data.messages.length !== prev.length) {
              return res.data.messages;
            }
            const lastPrev = prev[prev.length - 1];
            const lastFetched = res.data.messages[res.data.messages.length - 1];
            if (String(lastPrev?._id || lastPrev?.id) !== String(lastFetched?._id || lastFetched?.id)) {
              return res.data.messages;
            }
            return prev;
          });
        }
        if (res.data?.otherUser) {
          setActiveConversation((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              otherUser: {
                ...prev.otherUser,
                ...res.data.otherUser,
              },
            };
          });
        }
      } catch (_) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [activeConversation?._id, activeConversation?.id]);

  // 5. Socket real-time listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMsg: any) => {
      if (!newMsg) return;
      const incomingConvId = String(newMsg.conversationId?._id || newMsg.conversationId || '');
      const activeConvId = String(activeConversationRef.current?._id || activeConversationRef.current?.id || '');

      if (incomingConvId && activeConvId && incomingConvId === activeConvId) {
        setMessages((prev) => {
          const msgId = String(newMsg._id || newMsg.id || '');
          if (prev.some((m) => String(m._id || m.id || '') === msgId)) return prev;
          return [...prev, newMsg];
        });
        markConversationRead(activeConvId);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      }
      fetchConversations();
    };

    const handleMessageNotification = (data: any) => {
      if (data?.message) {
        handleNewMessage(data.message);
      } else {
        fetchConversations();
      }
    };

    const handleUserTyping = (data: any) => {
      const activeConvId = String(activeConversationRef.current?._id || activeConversationRef.current?.id || '');
      if (activeConvId && String(data?.conversationId) === activeConvId) {
        setIsTyping(true);
      }
    };

    const handleUserStopTyping = (data: any) => {
      const activeConvId = String(activeConversationRef.current?._id || activeConversationRef.current?.id || '');
      if (activeConvId && String(data?.conversationId) === activeConvId) {
        setIsTyping(false);
      }
    };

    const handleUserStatusChanged = (payload: any) => {
      if (!payload?.userId) return;
      const targetId = String(payload.userId);

      setConversations((prev) =>
        prev.map((conv) => {
          const oId = String(conv.otherUser?._id || conv.otherUser?.id || '');
          if (oId === targetId) {
            return {
              ...conv,
              otherUser: {
                ...conv.otherUser,
                isOnline: Boolean(payload.isOnline),
                lastSeen: payload.lastSeen,
              },
            };
          }
          return conv;
        })
      );

      setActiveConversation((prev: any) => {
        if (!prev) return prev;
        const oId = String(prev.otherUser?._id || prev.otherUser?.id || '');
        if (oId === targetId) {
          return {
            ...prev,
            otherUser: {
              ...prev.otherUser,
              isOnline: Boolean(payload.isOnline),
              lastSeen: payload.lastSeen,
            },
          };
        }
        return prev;
      });
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_notification', handleMessageNotification);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('user_status_changed', handleUserStatusChanged);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_notification', handleMessageNotification);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('user_status_changed', handleUserStatusChanged);
    };
  }, [socket, markConversationRead, fetchConversations]);

  // 6. Handle Typing Change with Debounce
  const handleInputChange = (text: string) => {
    setMessageInput(text);
    if (!activeConversation) return;

    sendTyping(activeConversation._id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping(activeConversation._id);
    }, 1500);
  };

  // 7. Send message handler with optimistic UI updates
  const handleSendMessage = async () => {
    const textToSend = messageInput.trim();
    const mediaToSend = attachedImage;
    if ((!textToSend && !mediaToSend) || isSending || !activeConversation) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      conversationId: activeConversation._id,
      sender: {
        _id: currentUser?.id || (currentUser as any)?._id,
        fullName: currentUser?.fullName || 'Me',
        profilePicture: currentUser?.profilePicture,
      },
      recipient: activeConversation.otherUser,
      text: textToSend,
      mediaUrl: mediaToSend,
      createdAt: new Date().toISOString(),
      sending: true,
    };

    setIsSending(true);
    setMessageInput('');
    setAttachedImage(null);
    sendStopTyping(activeConversation._id);

    // Optimistically show message immediately so user sees it right away!
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const authToken = await getToken();
      if (!authToken) return;

      const payload = {
        conversationId: activeConversation._id,
        recipientId: activeConversation.otherUser?._id,
        text: textToSend,
        mediaUrl: mediaToSend,
      };

      // Use socket direct dispatch if connected, or REST fallback
      if (socket && isConnected) {
        socket.emit('send_message', payload, (response: any) => {
          if (response?.message) {
            setMessages((prev) => {
              const withoutTemp = prev.filter((m) => m._id !== tempId);
              if (withoutTemp.some((m) => m._id === response.message._id)) return withoutTemp;
              return [...withoutTemp, response.message];
            });
            fetchConversations();
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
          }
        });
      } else {
        const res = await axios.post(`${API_BASE_URL}/api/messages/send`, payload, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.data?.message) {
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m._id !== tempId);
            return [...withoutTemp, res.data.message];
          });
          fetchConversations();
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to deliver message.');
      // Remove optimistic message if failed
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // 8. Image Picker for Property Attachment
  const handlePickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          setAttachedImage(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setAttachedImage(asset.uri);
        }
      }
    } catch (e) {
      Alert.alert('Attachment', 'Could not open image picker.');
    }
  };

  // Filtered conversation list by search query
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const name = (c.otherUser?.fullName || '').toLowerCase();
    const uname = (c.otherUser?.username || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || uname.includes(query);
  });

  // Filtered broker suggestions if search query is typed and no direct conv exists
  const matchingBrokers = COMMUNITY_MEMBERS_DIRECTORY.filter((b) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase();
    return (
      (b.fullName.toLowerCase().includes(query) || b.username.toLowerCase().includes(query)) &&
      !conversations.some((c) => (c.otherUser?.username || '').toLowerCase() === b.username.toLowerCase())
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: bgDark }]}>
      {/* ── TOP EXECUTIVE BANNER HEADER (Hidden on mobile when inside an active conversation) ── */}
      {(!activeConversation || isWide) && (
        <View style={[styles.headerBanner, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.push('/(app)/feed')} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={20} color={textPrimary} />
            </Pressable>
            <View style={styles.titleWrapper}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BoolokLogo size={18} color={goldPrimary} />
                <Text style={[styles.headerTitle, { color: textPrimary }]}>Boolok Real Estate Messages</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={[styles.onlineDot, { backgroundColor: isConnected ? '#22c55e' : '#eab308' }]} />
                <Text style={[styles.headerSubtitle, { color: textMuted }]}>
                  {isConnected ? 'Real-Time Connected · Encrypted' : 'Connecting to Boolok Live Gateway...'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── MAIN CONTENT (SPLIT PANE OR MOBILE VIEW) ── */}
      <View style={styles.bodyWrapper}>
        {/* LEFT PANE: CONVERSATION LIST (Visible on Wide, or on Mobile when no active conversation) */}
        {(isWide || !activeConversation) && (
          <View
            style={[
              styles.leftPane,
              { backgroundColor: cardBg, borderColor },
              !isWide && { width: '100%' },
            ]}
          >
            {/* Search Bar */}
            <View style={[styles.searchBox, { backgroundColor: innerCardBg, borderColor }]}>
              <MaterialIcons name="search" size={20} color={textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: textPrimary }]}
                placeholder="Search brokers, advisors, or messages..."
                placeholderTextColor={textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {Boolean(searchQuery) && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="clear" size={18} color={textMuted} />
                </Pressable>
              )}
            </View>

            {/* Quick Community Broker Start Row */}
            <View style={{ paddingHorizontal: 14, marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Connect With Boolok Brokers
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {COMMUNITY_MEMBERS_DIRECTORY.slice(0, 6).map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => startChatWithUser(undefined, b.username)}
                    style={({ pressed, hovered }: any) => [
                      {
                        backgroundColor: innerCardBg,
                        borderWidth: 1,
                        borderColor: borderColor,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                      },
                      (pressed || hovered) && { borderColor: goldPrimary },
                    ]}
                  >
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: isDark ? '#1a273c' : '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: goldPrimary }}>{b.fullName[0]}</Text>
                    </View>
                    <Text style={{ color: textPrimary, fontSize: 12, fontWeight: '600' }}>{b.fullName.split(' ')[0]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Matching Broker Search Results */}
            {matchingBrokers.length > 0 && (
              <View style={{ paddingHorizontal: 14, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: goldPrimary, marginBottom: 6 }}>
                  Start new chat with:
                </Text>
                {matchingBrokers.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      setSearchQuery('');
                      startChatWithUser(undefined, b.username);
                    }}
                    style={({ pressed, hovered }: any) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 10,
                        backgroundColor: innerCardBg,
                        borderRadius: 10,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor,
                      },
                      (pressed || hovered) && { borderColor: goldPrimary },
                    ]}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#1a273c' : '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                      <Text style={{ color: goldPrimary, fontWeight: '800' }}>{b.fullName[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 13 }}>{b.fullName}</Text>
                      <Text style={{ color: textMuted, fontSize: 11 }}>@{b.username} · {b.headline}</Text>
                    </View>
                    <MaterialIcons name="chat" size={18} color={goldPrimary} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Active Conversation List */}
            {isLoadingConversations ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <ActivityIndicator size="small" color={goldPrimary} />
                <Text style={{ color: textMuted, fontSize: 12, marginTop: 8 }}>Loading encrypted conversations...</Text>
              </View>
            ) : filteredConversations.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <MaterialCommunityIcons name="chat-processing-outline" size={48} color={textMuted} />
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '700', marginTop: 12 }}>
                  No messages yet
                </Text>
                <Text style={{ color: textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 4 }}>
                  Connect with Boolok real estate brokers above to negotiate acquisitions and review property portfolios.
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredConversations}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = activeConversation?._id === item._id;
                  const other = item.otherUser || {};
                  const otherId = String(other._id || other.id || '');
                  const otherInitial = (other.fullName || other.username || 'U')[0]?.toUpperCase();
                  const photoUrl = resolveImageUrl(other.profilePicture);
                  const isOnline =
                    isUserOnline(other._id) ||
                    isUserOnline(other.id) ||
                    isUserOnline(other.username) ||
                    Boolean(other.isOnline);
                  const statusText = formatLastSeen(isOnline, other.lastSeen);

                  return (
                    <Pressable
                      onPress={() => setActiveConversation(item)}
                      style={({ pressed, hovered }: any) => [
                        styles.conversationItem,
                        { borderBottomColor: borderColor },
                        isSelected && { backgroundColor: isDark ? '#162338' : '#F1F5F9', borderLeftColor: goldPrimary, borderLeftWidth: 4 },
                        (pressed || hovered) && !isSelected && { backgroundColor: innerCardBg },
                      ]}
                    >
                      {/* Avatar */}
                      <View style={{ position: 'relative', marginRight: 12 }}>
                        {photoUrl ? (
                          <Image source={{ uri: photoUrl }} style={styles.convAvatar} />
                        ) : (
                          <View style={[styles.convAvatar, { backgroundColor: isDark ? '#1a273c' : '#FEF3C7', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: goldPrimary }]}>
                            <Text style={{ color: isDark ? '#daa520' : '#B45309', fontWeight: '800', fontSize: 15 }}>{otherInitial}</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.onlineStatusBadge,
                            {
                              backgroundColor: isOnline ? '#22c55e' : '#64748b',
                              borderColor: cardBg,
                            },
                          ]}
                        />
                      </View>

                      {/* Info & Snippet */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.convName, { color: textPrimary }]} numberOfLines={1}>
                            {other.fullName || other.username || 'Boolok Broker'}
                          </Text>
                          <Text style={[styles.convTime, { color: item.unreadCount > 0 ? goldPrimary : textMuted, fontWeight: item.unreadCount > 0 ? '700' : '500' }]}>
                            {formatConversationTime(item.updatedAt || item.lastMessage?.createdAt)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                          {isOnline ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                              <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: '700' }}>Active now</Text>
                            </View>
                          ) : other.lastSeen ? (
                            <Text style={{ fontSize: 11, color: textMuted }} numberOfLines={1}>
                              {statusText}
                            </Text>
                          ) : (
                            <Text style={[styles.convHeadline, { color: textMuted }]} numberOfLines={1}>
                              {other.headline || 'Verified Real Estate Specialist'}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                          <Text style={[styles.convSnippet, { color: item.unreadCount > 0 ? textPrimary : textMuted, fontWeight: item.unreadCount > 0 ? '700' : '400' }]} numberOfLines={1}>
                            {item.lastMessage?.text || 'Started a conversation'}
                          </Text>
                          {item.unreadCount > 0 && (
                            <View style={styles.unreadPill}>
                              <Text style={styles.unreadPillText}>{item.unreadCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        )}

        {/* RIGHT PANE: ACTIVE CHAT VIEW (Visible on Wide, or on Mobile when conversation is selected) */}
        {(isWide || activeConversation) && (
          <View
            style={[
              styles.rightPane,
              { backgroundColor: cardBg, borderColor },
              keyboardAvoidancePadding > 0 && { paddingBottom: keyboardAvoidancePadding },
            ]}
          >
            {activeConversation ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? ((isWide ? 80 : 64) + insets.top) : 0}
                style={{ flex: 1 }}
              >
                {/* Chat Top Header */}
                <View style={[styles.chatHeader, { borderBottomColor: borderColor, backgroundColor: cardBg }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    {!isWide && (
                      <Pressable
                        onPress={() => {
                          setActiveConversation(null);
                          router.setParams({ conv: '', userId: '', username: '' });
                        }}
                        style={{ padding: 4, marginRight: 2 }}
                      >
                        <MaterialIcons name="arrow-back" size={22} color={textPrimary} />
                      </Pressable>
                    )}

                    {/* Participant Avatar with Live Active Indicator */}
                    {(() => {
                      const other = activeConversation.otherUser || {};
                      const otherId = String(other._id || other.id || '');
                      const photoUrl = resolveImageUrl(other.profilePicture);
                      const initial = (other.fullName || other.username || 'U')[0]?.toUpperCase();
                      const isOnline =
                        isUserOnline(other._id) ||
                        isUserOnline(other.id) ||
                        isUserOnline(other.username) ||
                        Boolean(other.isOnline);

                      return (
                        <View style={{ position: 'relative' }}>
                          {photoUrl ? (
                            <Image source={{ uri: photoUrl }} style={styles.chatHeaderAvatar} />
                          ) : (
                            <View style={[styles.chatHeaderAvatar, { backgroundColor: isDark ? '#1a273c' : '#FEF3C7', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: goldPrimary }]}>
                              <Text style={{ color: isDark ? '#daa520' : '#B45309', fontWeight: '800', fontSize: 16 }}>{initial}</Text>
                            </View>
                          )}
                          <View
                            style={[
                              styles.headerOnlineBadge,
                              {
                                backgroundColor: isOnline ? '#22c55e' : '#64748b',
                                borderColor: cardBg,
                              },
                            ]}
                          />
                        </View>
                      );
                    })()}

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.chatHeaderName, { color: textPrimary }]} numberOfLines={1}>
                          {activeConversation.otherUser?.fullName || 'Broker'}
                        </Text>
                        <MaterialIcons name="verified" size={16} color={goldPrimary} />
                      </View>

                      {/* Active Status & Last Seen Subtitle */}
                      {(() => {
                        const other = activeConversation.otherUser || {};
                        const otherId = String(other._id || other.id || '');
                        const isOnline =
                          isUserOnline(other._id) ||
                          isUserOnline(other.id) ||
                          isUserOnline(other.username) ||
                          Boolean(other.isOnline);

                        if (isTyping) {
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ color: goldPrimary, fontSize: 12, fontWeight: '700' }}>
                                typing...
                              </Text>
                            </View>
                          );
                        }

                        if (isOnline) {
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e' }} />
                              <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>
                                Active now
                              </Text>
                            </View>
                          );
                        }

                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <MaterialIcons name="access-time" size={12} color={textMuted} />
                            <Text style={[styles.chatHeaderSubtitle, { color: textMuted }]} numberOfLines={1}>
                              {formatLastSeen(false, other.lastSeen)}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </View>

                  {/* Actions (View Profile, Phone/Meeting) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable
                      onPress={() => {
                        const targetId = activeConversation.otherUser?.id || activeConversation.otherUser?._id || activeConversation.otherUser?.username;
                        router.push({ pathname: '/(app)/profile', params: { id: targetId } });
                      }}
                      style={({ pressed, hovered }: any) => [
                        styles.chatHeaderActionBtn,
                        { borderColor, backgroundColor: innerCardBg },
                        (pressed || hovered) && { borderColor: goldPrimary },
                      ]}
                    >
                      <MaterialIcons name="person" size={18} color={goldPrimary} />
                      {isWide && <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary, marginLeft: 4 }}>Portfolio</Text>}
                    </Pressable>
                  </View>
                </View>

                {/* Messages Bubble Area */}
                <View style={[styles.chatBody, { backgroundColor: innerCardBg }]}>
                  {isLoadingMessages ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={goldPrimary} />
                      <Text style={{ color: textMuted, fontSize: 12, marginTop: 8 }}>Loading encrypted transcript...</Text>
                    </View>
                  ) : messages.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                      <MaterialIcons name="security" size={40} color={goldPrimary} />
                      <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '700', marginTop: 10 }}>
                        Encrypted Real Estate Negotiation
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 12, textAlign: 'center', marginTop: 4, maxWidth: 360 }}>
                        Direct message with {activeConversation.otherUser?.fullName}. Discuss price discovery, cap-rate metrics, deed records, or inspection documents.
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      ref={flatListRef}
                      data={messages}
                      keyExtractor={(item) => item._id}
                      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode="interactive"
                      onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                      renderItem={({ item, index }) => {
                        const currentUserId = String(currentUser?.id || (currentUser as any)?._id || '');
                        const senderId = String(item.sender?._id || item.sender?.id || item.sender || '');
                        const isMe = Boolean(currentUserId && senderId && currentUserId === senderId) || Boolean(item.sending);
                        const timeStr = item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        const smartTimeStr = formatSmartDateTime(item.createdAt);
                        const photoUrl = resolveImageUrl(item.sender?.profilePicture);

                        const prevItem = index > 0 ? messages[index - 1] : null;
                        const showDateSeparator = !prevItem || !isSameCalendarDay(prevItem.createdAt, item.createdAt);
                        const dateSeparatorLabel = getMessageDateSeparator(item.createdAt);

                        return (
                          <View>
                            {showDateSeparator && dateSeparatorLabel ? (
                              <View style={styles.dateSeparatorRow}>
                                <View style={[styles.dateSeparatorPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderColor }]}>
                                  <Text style={[styles.dateSeparatorText, { color: textMuted }]}>
                                    {dateSeparatorLabel}
                                  </Text>
                                </View>
                              </View>
                            ) : null}

                            <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
                              {!isMe && (
                                photoUrl ? (
                                  <Image source={{ uri: photoUrl }} style={styles.bubbleAvatar} />
                                ) : (
                                  <View style={[styles.bubbleAvatar, { backgroundColor: isDark ? '#1a273c' : '#FEF3C7', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: goldPrimary }]}>
                                    <Text style={{ color: goldPrimary, fontSize: 11, fontWeight: '800' }}>
                                      {(item.sender?.fullName || 'B')[0]?.toUpperCase()}
                                    </Text>
                                  </View>
                                )
                              )}

                              <View
                                style={[
                                  styles.messageBubble,
                                  isMe ? [styles.bubbleMe, { backgroundColor: isDark ? '#daa520' : '#d97706' }] : [styles.bubbleOther, { backgroundColor: cardBg, borderColor }],
                                ]}
                              >
                                {/* Attached Media */}
                                {Boolean(item.mediaUrl) && (
                                  <Image
                                    source={{ uri: resolveImageUrl(item.mediaUrl)! }}
                                    style={{ width: 220, height: 140, borderRadius: 8, marginBottom: 6 }}
                                    resizeMode="cover"
                                  />
                                )}

                                {Boolean(item.text) && (
                                  <Text style={[styles.messageText, { color: isMe ? '#000000' : textPrimary }]}>
                                    {item.text}
                                  </Text>
                                )}

                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                                  <Text style={[styles.messageTime, { color: isMe ? 'rgba(0,0,0,0.6)' : textMuted }]}>
                                    {smartTimeStr || timeStr}
                                  </Text>
                                  {isMe && (
                                    <MaterialIcons
                                      name={item.sending ? 'access-time' : item.read ? 'done-all' : 'done'}
                                      size={14}
                                      color={isMe ? 'rgba(0,0,0,0.6)' : goldPrimary}
                                    />
                                  )}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      }}
                    />
                  )}

                  {/* Live Typing Indicator */}
                  {isTyping && (
                    <View style={styles.typingIndicatorRow}>
                      <Text style={{ fontSize: 12, color: goldPrimary, fontStyle: 'italic' }}>
                        {activeConversation.otherUser?.fullName?.split(' ')[0] || 'Agent'} is typing...
                      </Text>
                    </View>
                  )}
                </View>

                {/* Attached Image Preview */}
                {Boolean(attachedImage) && (
                  <View style={[styles.attachedPreviewRow, { backgroundColor: cardBg, borderColor }]}>
                    <Image source={{ uri: attachedImage! }} style={{ width: 44, height: 44, borderRadius: 6 }} />
                    <Text style={{ color: textPrimary, fontSize: 12, flex: 1, marginLeft: 10 }} numberOfLines={1}>
                      Property attachment ready to send
                    </Text>
                    <Pressable onPress={() => setAttachedImage(null)} style={{ padding: 4 }}>
                      <MaterialIcons name="close" size={20} color={textMuted} />
                    </Pressable>
                  </View>
                )}

                {/* Message Input Toolbar */}
                <View style={[
                  styles.inputToolbar,
                  {
                    backgroundColor: cardBg,
                    borderTopColor: borderColor,
                    paddingBottom: (!isWide && keyboardHeight === 0) ? Math.max(insets.bottom, 10) : 10,
                  }
                ]}>
                  <Pressable
                    onPress={handlePickMedia}
                    style={({ pressed, hovered }: any) => [
                      styles.mediaAttachBtn,
                      { borderColor, backgroundColor: innerCardBg },
                      (pressed || hovered) && { borderColor: goldPrimary },
                    ]}
                  >
                    <MaterialIcons name="add-photo-alternate" size={20} color={goldPrimary} />
                  </Pressable>

                  <TextInput
                    style={[
                      styles.chatInput,
                      {
                        backgroundColor: innerCardBg,
                        color: textPrimary,
                        borderColor: messageInput.trim().length > 0 ? goldPrimary : borderColor,
                      }
                    ]}
                    placeholder={`Message ${activeConversation.otherUser?.fullName?.split(' ')[0] || 'broker'}...`}
                    placeholderTextColor={textMuted}
                    value={messageInput}
                    onChangeText={handleInputChange}
                    onSubmitEditing={handleSendMessage}
                    onFocus={() => {
                      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
                    }}
                    multiline={true}
                    blurOnSubmit={false}
                    selectionColor={goldPrimary}
                    cursorColor={goldPrimary}
                    returnKeyType="send"
                    {...(Platform.OS === 'web' ? {
                      onKeyPress: (e: any) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault?.();
                          handleSendMessage();
                        }
                      }
                    } : {})}
                  />

                  <Pressable
                    onPress={handleSendMessage}
                    disabled={(!messageInput.trim() && !attachedImage) || isSending}
                    style={({ pressed, hovered }: any) => [
                      styles.sendBtn,
                      {
                        backgroundColor: (messageInput.trim() || attachedImage) && !isSending ? goldPrimary : (isDark ? '#1a273c' : '#cbd5e1'),
                      },
                      (pressed || hovered) && { opacity: 0.85 },
                    ]}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <MaterialIcons name="send" size={18} color={(messageInput.trim() || attachedImage) ? '#000000' : textMuted} />
                    )}
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                <View style={[styles.emptyChatCircle, { backgroundColor: innerCardBg, borderColor }]}>
                  <MaterialIcons name="forum" size={48} color={goldPrimary} />
                </View>
                <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800', marginTop: 16 }}>
                  Boolok AI Brokerage Desk
                </Text>
                <Text style={{ color: textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, maxWidth: 400, lineHeight: 18 }}>
                  Select a broker or advisor from the left panel to begin live discussions, asset underwriting, or commercial acquisition negotiations.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  titleWrapper: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  bodyWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    width: 360,
    borderRightWidth: 1,
    flexDirection: 'column',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineStatusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#0c1626',
  },
  headerOnlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#0c1626',
  },
  convName: {
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 180,
  },
  convTime: {
    fontSize: 11,
  },
  convHeadline: {
    fontSize: 11,
    marginTop: 1,
  },
  convSnippet: {
    fontSize: 12,
    maxWidth: 210,
  },
  unreadPill: {
    backgroundColor: '#daa520',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadPillText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  rightPane: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  chatHeaderName: {
    fontSize: 15,
    fontWeight: '800',
  },
  chatHeaderSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  chatHeaderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  chatBody: {
    flex: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMe: {
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  messageTime: {
    fontSize: 10,
    fontWeight: '600',
  },
  typingIndicatorRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  attachedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  inputToolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  mediaAttachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 1,
  },
  chatInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14.5,
    borderWidth: 1,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  emptyChatCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dateSeparatorRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
