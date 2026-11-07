import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'userToken';

const PRODUCTION_FALLBACK_API_URL = 'https://boolok-backend.onrender.com';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getMetroHost(): string | null {
  const hostUri =
    (Constants as any).expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    (Constants as any).manifest?.debuggerHost ??
    (Constants as any).manifest?.hostUri ??
    null;

  if (!hostUri || typeof hostUri !== 'string') return null;

  const withoutProtocol = hostUri.replace(/^https?:\/\//, '');
  const host = withoutProtocol.split(':')[0];
  return host || null;
}

function isRunningUnderMetro(): boolean {
  return getMetroHost() !== null;
}

function resolveApiBaseUrl(): string {
  const webUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL;

  if (Platform.OS === 'web') {
    const isNonLocalWeb =
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    if (isNonLocalWeb) {
      // In remote web environments like Vercel, ensure we don't accidentally try to hit localhost
      if (webUrl && !webUrl.includes('localhost') && !webUrl.includes('127.0.0.1')) {
        return stripTrailingSlash(webUrl);
      }
      return PRODUCTION_FALLBACK_API_URL;
    }

    return stripTrailingSlash(webUrl || 'http://localhost:5000');
  }

  const explicitNative = process.env.EXPO_PUBLIC_API_URL_NATIVE;
  if (explicitNative) return stripTrailingSlash(explicitNative);

  if (isRunningUnderMetro()) {
    const metroHost = getMetroHost();
    if (metroHost) return `http://${metroHost}:5000`;
  }

  if (webUrl) return stripTrailingSlash(webUrl);

  console.error(
    '[api] No EXPO_PUBLIC_API_URL_NATIVE / EXPO_PUBLIC_API_URL set for this native build. ' +
    `Falling back to ${PRODUCTION_FALLBACK_API_URL} — set the real env var in eas.json instead.`
  );
  return PRODUCTION_FALLBACK_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Safely resolves an image path or URL into a fully-qualified URL for <Image source={{ uri }} />.
 * Automatically prepends API_BASE_URL for relative paths like /uploads/posts/...
 */
export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('file:')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${API_BASE_URL}${cleanPath}`;
}

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('[api] Failed to persist auth token:', error);
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (error) {
    console.error('[api] Failed to clear auth token:', error);
  }
}

/**
 * Central API fetch helper that automatically attaches the Authorization JWT token header.
 * Use this for EVERY authenticated request (feed posts, reels, uploads, etc.)
 * so no screen accidentally forgets to attach the token.
 */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${path}`;

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn(`[apiFetch] No auth token found for request to ${path} — this will likely 401.`);
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    (error as any).status = response.status;
    (error as any).data = data;
    throw error;
  }

  return data as T;
}

const WEB_AUTH_CALLBACK_PATH = '/auth-callback';

type GoogleAuthOptions = {
  onSuccess: (idToken: string) => Promise<void>;
  onError?: (message: string) => void;
};

// ── Native (Android / iOS) ──────────────────────────────────────────────
function useNativeGoogleAuth({ onSuccess, onError }: GoogleAuthOptions) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;

  useEffect(() => {
    try {
      if (!webClientId) {
        throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing in your .env or EAS environment variables.');
      }
      if (Platform.OS === 'ios' && !iosClientId) {
        throw new Error('EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS is missing in your .env or EAS environment variables.');
      }

      const { GoogleSignin } = require('@react-native-google-signin/google-signin');

      GoogleSignin.configure({
        webClientId,
        iosClientId: Platform.OS === 'ios' ? iosClientId : undefined,
        offlineAccess: false,
      });
      setConfigurationError(null);
    } catch (error: any) {
      const message = error?.message || 'Google Sign-In configuration failed.';
      console.error('[GoogleSignin Config Error]:', message);
      setConfigurationError(message);
    }
  }, [webClientId, iosClientId]);

  const promptGoogleSignIn = useCallback(async () => {
    if (configurationError) {
      onError?.(configurationError);
      return;
    }

    setIsGoogleLoading(true);

    const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const result = await GoogleSignin.signIn();
      if (result?.type === 'cancelled') return;
      const idToken = result?.data?.idToken ?? result?.idToken;

      if (!idToken) {
        throw new Error('Google did not return an ID token.');
      }

      await onSuccess(idToken);
    } catch (error: any) {
      const code = String(error?.code ?? '');
      if (code === String(statusCodes.SIGN_IN_CANCELLED)) {
        // User cancelled — not an error
      } else if (code === String(statusCodes.IN_PROGRESS)) {
        // Already in progress
      } else if (code === String(statusCodes.PLAY_SERVICES_NOT_AVAILABLE)) {
        onError?.('Play services not available or outdated.');
      } else if (code === '10' || code === 'DEVELOPER_ERROR') {
        onError?.(
          'Google Sign-In is misconfigured for this build (DEVELOPER_ERROR). ' +
          'Check the Android package and signing SHA-1, and the Web OAuth client ID, in Google Cloud Console.'
        );
      } else {
        onError?.(error?.message || 'Google sign-in failed.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }, [configurationError, onError, onSuccess]);

  return { promptGoogleSignIn, isGoogleLoading };
}

// ── Web (browser-based OAuth via expo-auth-session) ─────────────────────
function useWebGoogleAuth({ onSuccess, onError }: GoogleAuthOptions) {
  const WebBrowser = require('expo-web-browser');
  const AuthSession = require('expo-auth-session');
  const Google = require('expo-auth-session/providers/google');

  WebBrowser.maybeCompleteAuthSession();

  const redirectUri = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${WEB_AUTH_CALLBACK_PATH}`;
    }
    return AuthSession.makeRedirectUri({
      preferLocalhost: true,
      path: WEB_AUTH_CALLBACK_PATH,
    });
  }, []);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const [isExchanging, setIsExchanging] = useState(false);
  const handledResponse = useRef<any>(null);
  const [nonce] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId,
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
    extraParams: {
      nonce,
      prompt: 'select_account',
    },
  });

  useEffect(() => {
    async function processResponse() {
      if (!response || handledResponse.current === response) return;
      // Callbacks change when the screen/auth state rerenders. Claim this result
      // before setting state or awaiting the backend so it is exchanged only once.
      handledResponse.current = response;

      if (response.type === 'error') {
        onError?.(response.error?.message || 'Google authentication returned an error.');
        return;
      }

      if (response.type === 'dismiss' || response.type === 'cancel') {
        return;
      }

      if (response.type !== 'success') return;

      const idToken = response.authentication?.idToken || response.params?.id_token;

      if (!idToken) {
        onError?.('Google did not return an ID token.');
        return;
      }

      setIsExchanging(true);

      try {
        await onSuccess(idToken);
      } catch (error: any) {
        onError?.(error?.message || 'Google sign-in failed.');
      } finally {
        setIsExchanging(false);
      }
    }

    processResponse();
  }, [onError, onSuccess, response]);

  const promptGoogleSignIn = useCallback(async () => {
    if (!webClientId) {
      onError?.('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing.');
      return;
    }

    if (!request) {
      onError?.('Google Sign-In is still loading. Try again.');
      return;
    }

    try {
      await promptAsync({
        useProxy: false,
        windowFeatures: { width: 500, height: 650 },
      });
    } catch (error: any) {
      onError?.(error?.message || 'Unable to open Google sign-in. Please allow popups and try again.');
    }
  }, [onError, promptAsync, request, webClientId]);

  return {
    promptGoogleSignIn,
    isGoogleLoading: !request || isExchanging,
  };
}

export function useGoogleAuth(options: GoogleAuthOptions) {
  return Platform.OS === 'web' ? useWebGoogleAuth(options) : useNativeGoogleAuth(options);
}
