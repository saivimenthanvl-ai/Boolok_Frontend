import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../lib/api';
import axios from 'axios';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  unreadTotal: number;
  onlineUserIds: Set<string>;
  isUserOnline: (userId: string) => boolean;
  refreshUnreadTotal: () => Promise<void>;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendTyping: (conversationId: string) => void;
  sendStopTyping: (conversationId: string) => void;
  markConversationRead: (conversationId: string) => Promise<void>;
};

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const isUserOnline = useCallback(
    (key?: string | null) => {
      if (!key) return false;
      const str = String(key).toLowerCase();
      return onlineUserIds.has(str) || onlineUserIds.has(String(key));
    },
    [onlineUserIds]
  );

  const refreshUnreadTotal = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (typeof res.data?.unreadCount === 'number') {
        setUnreadTotal(res.data.unreadCount);
      }
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setUnreadTotal(0);
      return;
    }

    refreshUnreadTotal();

    const socketInstance: Socket = io(API_BASE_URL, {
      auth: { token },
      // Use polling first so Socket.IO works on Render (free tier doesn't
      // support WebSocket upgrades reliably). Once polling is established
      // Socket.IO will automatically attempt an upgrade to WebSocket.
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 15,
      timeout: 20000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('connect_error', (err: any) => {
      console.warn('[socket] Connection error:', err?.message || err);
      setIsConnected(false);
      if (err?.message === 'Invalid token' || err?.message === 'Authentication token required') {
        socketInstance.disconnect();
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('message_notification', () => {
      setUnreadTotal((prev) => prev + 1);
      refreshUnreadTotal();
    });

    socketInstance.on('new_message', () => {
      refreshUnreadTotal();
    });

    socketInstance.on('initial_online_users', (keys: string[]) => {
      if (Array.isArray(keys)) {
        const set = new Set<string>();
        keys.forEach((k) => {
          if (k) {
            set.add(String(k).toLowerCase());
            set.add(String(k));
          }
        });
        setOnlineUserIds(set);
      }
    });

    socketInstance.on('user_status_changed', (payload: any) => {
      if (!payload) return;
      const ids: string[] = [];
      if (payload.userId) {
        ids.push(String(payload.userId).toLowerCase(), String(payload.userId));
      }
      if (payload.username) {
        ids.push(String(payload.username).toLowerCase());
      }

      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (payload.isOnline) {
          ids.forEach((id) => next.add(id));
        } else {
          ids.forEach((id) => next.delete(id));
        }
        return next;
      });
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      setOnlineUserIds(new Set());
    };
  }, [isAuthenticated, token, refreshUnreadTotal]);

  const joinConversation = useCallback((conversationId: string) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('join_conversation', conversationId);
    }
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('leave_conversation', conversationId);
    }
  }, []);

  const sendTyping = useCallback((conversationId: string) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('typing', { conversationId });
    }
  }, []);

  const sendStopTyping = useCallback((conversationId: string) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('stop_typing', { conversationId });
    }
  }, []);

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!token || !conversationId) return;
      try {
        await axios.put(
          `${API_BASE_URL}/api/messages/read/${conversationId}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        refreshUnreadTotal();
      } catch {
        // ignore
      }
    },
    [token, refreshUnreadTotal]
  );

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        unreadTotal,
        onlineUserIds,
        isUserOnline,
        refreshUnreadTotal,
        joinConversation,
        leaveConversation,
        sendTyping,
        sendStopTyping,
        markConversationRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    return {
      socket: null,
      isConnected: false,
      unreadTotal: 0,
      onlineUserIds: new Set<string>(),
      isUserOnline: () => false,
      refreshUnreadTotal: async () => {},
      joinConversation: () => {},
      leaveConversation: () => {},
      sendTyping: () => {},
      sendStopTyping: () => {},
      markConversationRead: async () => {},
    };
  }
  return context;
}
