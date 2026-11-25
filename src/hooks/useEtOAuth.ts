import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import type { EtOAuthUser } from '../types/models';
import {
  ALLOWED_SONGBOOK_EMAILS,
  ET_OAUTH_CENTRAL_URL,
  ET_OAUTH_REDIRECT_STORAGE_KEY,
  ET_OAUTH_USER_STORAGE_KEY,
  getOAuthDb,
  isAllowedSongbookEmail,
} from '../firebase/firebaseClients';

function sanitizeAvatarUrl(rawUrl?: unknown): string {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return '';
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Ignore invalid URLs
  }
  return '';
}

function readStoredEtOAuthUser(): EtOAuthUser | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ET_OAUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EtOAuthUser> | null;
    if (!parsed || typeof parsed.email !== 'string' || !parsed.email.trim()) {
      return null;
    }
    if (!isAllowedSongbookEmail(parsed.email)) {
      localStorage.removeItem(ET_OAUTH_USER_STORAGE_KEY);
      return null;
    }
    return {
      ...parsed,
      uid: String(parsed.uid || parsed.email),
      email: parsed.email.trim().toLowerCase(),
      displayName: String(parsed.displayName || parsed.email),
      photoURL: sanitizeAvatarUrl(parsed.photoURL),
    };
  } catch {
    return null;
  }
}

export interface UseEtOAuthResult {
  user: EtOAuthUser | null;
  isAuthorized: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithEtOAuth: () => void;
  logoutEtOAuth: () => void;
}

export function useEtOAuth(): UseEtOAuthResult {
  const [user, setUser] = useState<EtOAuthUser | null>(() => readStoredEtOAuthUser());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthorized = useMemo(
    () => Boolean(user && isAllowedSongbookEmail(user.email)),
    [user]
  );

  // Process ET OAuth redirect callback parameters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (!status) return;

    const cleanUrlBar = () => {
      window.history.replaceState({}, '', window.location.pathname);
    };

    if (status === 'error') {
      cleanUrlBar();
      setAuthError('Authentication failed. Please try again.');
      return;
    }

    const token = params.get('token') || '';
    const email = params.get('email') || '';
    const name = params.get('name') || '';
    const picture = params.get('picture') || '';

    if (status === 'success' && token && email) {
      cleanUrlBar();
      const normalizedEmail = email.trim().toLowerCase();

      if (!isAllowedSongbookEmail(normalizedEmail)) {
        try {
          localStorage.removeItem(ET_OAUTH_USER_STORAGE_KEY);
          localStorage.removeItem(ET_OAUTH_REDIRECT_STORAGE_KEY);
        } catch {
          // Ignore storage errors
        }
        setUser(null);
        setAuthError(
          `Access denied for ${normalizedEmail}. Only ${ALLOWED_SONGBOOK_EMAILS.join(' or ')} may sync with Songbook.`
        );
        return;
      }

      let cancelled = false;
      setIsAuthenticating(true);
      setAuthError(null);

      (async () => {
        let userData: EtOAuthUser = {
          uid: normalizedEmail,
          email: normalizedEmail,
          displayName: name.trim() || normalizedEmail,
          photoURL: sanitizeAvatarUrl(picture),
          token,
        };

        try {
          const oauthDb = getOAuthDb();
          const usersRef = collection(oauthDb, 'users');
          const snap = await getDocs(query(usersRef, where('email', '==', normalizedEmail), limit(1)));

          if (!snap.empty) {
            const docSnap = snap.docs[0];
            const profileData = docSnap.data() as Record<string, unknown>;
            userData = {
              ...profileData,
              uid: docSnap.id,
              email: normalizedEmail,
              displayName: String(
                profileData.displayName || profileData.name || name.trim() || normalizedEmail
              ),
              photoURL: sanitizeAvatarUrl(profileData.photoURL || profileData.picture || picture),
              token,
            };
          }
        } catch (err) {
          console.warn('ET OAuth profile lookup fell back to callback profile:', err);
        }

        if (cancelled) return;

        try {
          localStorage.setItem(ET_OAUTH_USER_STORAGE_KEY, JSON.stringify(userData));
          localStorage.removeItem(ET_OAUTH_REDIRECT_STORAGE_KEY);
        } catch {
          // Ignore storage quota issues
        }

        setUser(userData);
        setIsAuthenticating(false);
      })();

      return () => {
        cancelled = true;
      };
    }
  }, []);

  const signInWithEtOAuth = useCallback(() => {
    setAuthError(null);
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(ET_OAUTH_REDIRECT_STORAGE_KEY, window.location.href);
    } catch {
      // Ignore storage errors
    }

    const redirectUrl = new URL(ET_OAUTH_CENTRAL_URL);
    redirectUrl.searchParams.set('redirect_uri', `${window.location.origin}${window.location.pathname}`);
    redirectUrl.searchParams.set('client_name', 'ET BSP');

    window.location.href = redirectUrl.toString();
  }, []);

  const logoutEtOAuth = useCallback(() => {
    try {
      localStorage.removeItem(ET_OAUTH_USER_STORAGE_KEY);
      localStorage.removeItem(ET_OAUTH_REDIRECT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setUser(null);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return {
    user,
    isAuthorized,
    isAuthenticating,
    authError,
    clearAuthError,
    signInWithEtOAuth,
    logoutEtOAuth,
  };
}
