import { useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_WEB = '__YOUR_GOOGLE_WEB_CLIENT_ID__';
const GOOGLE_CLIENT_ID_ANDROID = '__YOUR_GOOGLE_ANDROID_CLIENT_ID__';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

type UseGoogleAuthReturn = {
  accessToken: string | null;
  isConnected: boolean;
  isLoading: boolean;
  userEmail: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
};

export function useGoogleAuth(): UseGoogleAuthReturn {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID_WEB,
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
    scopes: SCOPES,
  });

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await promptAsync();

      if (result.type === 'success' && result.authentication) {
        const token = result.authentication.accessToken;
        setAccessToken(token);

        // Fetch user info to get email
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          setUserEmail(userInfo.email ?? null);
        }
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [promptAsync]);

  const signOut = useCallback(() => {
    setAccessToken(null);
    setUserEmail(null);
  }, []);

  return {
    accessToken,
    isConnected: accessToken !== null,
    isLoading,
    userEmail,
    signIn,
    signOut,
  };
}
