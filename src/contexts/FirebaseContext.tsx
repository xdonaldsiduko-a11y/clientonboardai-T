import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  loginWithGoogle,
  loginWithApple,
  authorizeGoogleWorkspacePopup,
  logoutUser,
  syncUserProfileAndSeedWorkspace
} from '../firebase';

export type AuthProviderType = 'google' | 'apple';

interface FirebaseContextValue {
  currentUser: User | null;
  authReady: boolean;
  workspaceReady: boolean;
  authError: string | null;
  isSigningIn: boolean;
  signingInProvider: AuthProviderType | null;
  googleAccessToken: string | null;
  googleWorkspaceConnected: boolean;
  connectGoogleWorkspace: () => Promise<string | null>;
  disconnectGoogleWorkspace: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

function formatAuthErrorMessage(err: unknown, providerLabel: string): string {
  if (!(err instanceof Error)) {
    return `${providerLabel} sign-in failed. Please try again.`;
  }
  const msg = err.message;
  if (msg.includes('popup-closed-by-user')) {
    return `${providerLabel} sign-in popup was closed before completing authentication.`;
  }
  if (msg.includes('operation-not-allowed')) {
    return `${providerLabel} Sign-In is not enabled yet in Firebase Console (Authentication -> Sign-in method -> ${providerLabel}).`;
  }
  if (msg.includes('account-exists-with-different-credential')) {
    return 'An account already exists with this email using a different sign-in provider. Please sign in with your originally linked provider.';
  }
  if (msg.includes('popup-blocked')) {
    return `Pop-up was blocked by your browser. Please allow pop-ups for this site and retry ${providerLabel} sign-in.`;
  }
  return msg;
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingInProvider, setSigningInProvider] = useState<AuthProviderType | null>(null);
  // Strict Security Rule: Keep Google Workspace OAuth token strictly in memory (never localStorage/sessionStorage)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setCurrentUser(user);
      setAuthReady(true);

      if (user) {
        setWorkspaceReady(false);
        try {
          await syncUserProfileAndSeedWorkspace(user);
          if (active) {
            setAuthError(null);
            setWorkspaceReady(true);
          }
        } catch (err) {
          console.error('Failed to initialize Firebase workspace:', err);
          if (active) {
            setAuthError(
              err instanceof Error
                ? err.message
                : 'Unable to initialize your practice database workspace.'
            );
            setWorkspaceReady(true);
          }
        }
      } else {
        setGoogleAccessToken(null);
        setWorkspaceReady(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setSigningInProvider('google');
    setAuthError(null);
    try {
      const { accessToken } = await loginWithGoogle();
      if (accessToken) {
        setGoogleAccessToken(accessToken);
      }
    } catch (err: unknown) {
      setAuthError(formatAuthErrorMessage(err, 'Google'));
    } finally {
      setSigningInProvider(null);
    }
  };

  const connectGoogleWorkspace = async (): Promise<string | null> => {
    setAuthError(null);
    try {
      const token = await authorizeGoogleWorkspacePopup();
      if (token) {
        setGoogleAccessToken(token);
      }
      return token;
    } catch (err: unknown) {
      setAuthError(formatAuthErrorMessage(err, 'Google Workspace'));
      return null;
    }
  };

  const disconnectGoogleWorkspace = () => {
    setGoogleAccessToken(null);
  };

  const signInWithApple = async () => {
    setSigningInProvider('apple');
    setAuthError(null);
    try {
      await loginWithApple();
    } catch (err: unknown) {
      setAuthError(formatAuthErrorMessage(err, 'Apple'));
    } finally {
      setSigningInProvider(null);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      await logoutUser();
      setGoogleAccessToken(null);
      setCurrentUser(null);
      setWorkspaceReady(false);
    } catch (err) {
      console.error('Logout error:', err);
      setAuthError(err instanceof Error ? err.message : 'Failed to sign out cleanly.');
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <FirebaseContext.Provider
      value={{
        currentUser,
        authReady,
        workspaceReady,
        authError,
        isSigningIn: signingInProvider !== null,
        signingInProvider,
        googleAccessToken,
        googleWorkspaceConnected: Boolean(googleAccessToken),
        connectGoogleWorkspace,
        disconnectGoogleWorkspace,
        signInWithGoogle,
        signInWithApple,
        signOutUser,
        clearAuthError,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return ctx;
}
