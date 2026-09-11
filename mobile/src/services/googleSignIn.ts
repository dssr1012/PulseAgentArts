// ============================================================
// PulseExpends - Google Sign-In Service
// Native Google Sign-In for mobile using @react-native-google-signin
// ============================================================

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../constants/config';

/**
 * Configure Google Sign-In
 */
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    forceCodeForRefreshToken: true,
    iosClientId: undefined, // Configured via app.json plugin
  });
}

/**
 * Check if Google Play Services are available (Android)
 */
export async function hasPlayServices(): Promise<boolean> {
  try {
    return await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch {
    return false;
  }
}

/**
 * Initiate Google Sign-In flow
 * Returns the ID token for server-side validation
 */
export async function signIn(): Promise<{ idToken: string; user: GoogleUser }> {
  await hasPlayServices();
  await GoogleSignin.signIn();

  const idToken = await GoogleSignin.getTokens();
  const currentUser = GoogleSignin.getCurrentUser() as any;

  if (!idToken.idToken || !currentUser) {
    throw new Error('Google Sign-In failed: no ID token received');
  }

  return {
    idToken: idToken.idToken,
    user: {
      id: currentUser.id,
      email: currentUser.email,
      givenName: currentUser.givenName ?? '',
      photo: currentUser.photo ?? undefined,
    },
  };
}

/**
 * Sign out from Google
 */
export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore errors on sign out
  }
}

/**
 * Check if user is currently signed in with Google
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    return await (GoogleSignin as any).isSignedIn();
  } catch {
    return false;
  }
}

export interface GoogleUser {
  id: string;
  email: string;
  givenName: string;
  photo?: string;
}