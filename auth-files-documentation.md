# Authentication Files Documentation

## Overview
This document contains all the authentication-related files from the codebase.
Each file is documented with its full content for reference.

## Page Authentication Usage

### Home Page (/)

- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user and loading state:
  ```typescript
  const { user, isLoading: authLoading } = useAuth();
  ```
- Checks permissions based on user state:
  ```typescript
  useEffect(() => {
    if (authLoading) return;
    const checkPermissions = async () => {
      if (user && !permissionsChecked /*...*/) {
        // ... permission checking logic using user.id ...
      }
    };
    checkPermissions();
  }, [user, permissionsChecked, authLoading]);
  ```
- Displays `AuthButton` in `Navigation`, which uses `useAuth`.
- Disables 'Propose New LoRA' button based on `authLoading`:
  ```typescript
  <PageHeader 
    // ...
    buttonDisabled={lorasLoading || authLoading}
  />
  ```


### Auth Page (/auth)

- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user, session, and loading state:
  ```typescript
  const { user, session, isLoading: isAuthLoading } = useAuth();
  ```
- Redirects authenticated users:
  ```typescript
  useEffect(() => {
    if (!isAuthLoading && user && session && !redirecting) {
      const returnUrl = /*... get returnUrl ...*/;
      navigate(returnUrl, { replace: true });
    }
  }, [user, session, isAuthLoading, /* ... */]);
  ```
- Handles Discord sign-in action:
  ```typescript
  import { signInWithDiscord } from '@/lib/auth';
  // ...
  const handleDiscordSignIn = async () => {
    await signInWithDiscord();
  };
  ```
- Shows loading state:
  ```typescript
  if (isAuthLoading || redirecting) {
    return ( /* ... loading UI ... */ );
  }
  ```


### Auth Callback Page (/auth/callback)

- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user and loading state:
  ```typescript
  const { user, isLoading: isAuthLoading } = useAuth();
  ```
- Redirects after successful authentication verification:
  ```typescript
  useEffect(() => {
    if (isAuthLoading || !isProcessing) return;
    if (user) {
      const returnUrl = /*... get returnUrl ...*/;
      navigate(returnUrl, { replace: true });
    } else {
      // Handle case where AuthProvider finishes loading but no user is found
      setError(/*...*/);
    }
  }, [user, isAuthLoading, /* ... */]);
  ```
- Shows error state if authentication times out or fails:
  ```typescript
  {error ? (
    <div className="text-center space-y-4">
      {/* ... Error Message ... */}
    </div>
  ) : (
    /* ... Loading Spinner ... */
  )}
  ```


### Profile Page (/profile)

- Imports `RequireAuth` component:
  ```typescript
  import RequireAuth from '@/components/RequireAuth';
  ```
- Wraps the entire page content with `RequireAuth` to enforce authentication:
  ```typescript
  export default function ProfilePage() {
    return (
      <RequireAuth>
        <div className="min-h-screen flex flex-col bg-background">
          <Navigation />
          <main {/* ... */}>
            {/* ... Profile settings content ... */}
            <UserProfileSettings />
          </main>
          <Footer />
        </div>
      </RequireAuth>
    );
  }
  ```
- The `UserProfileSettings` component likely uses `useAuth` or related hooks internally to fetch and update profile data for the authenticated user.


### Upload Page (/upload)

- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user state:
  ```typescript
  const { user } = useAuth();
  ```
- Shows a prompt and disables the form if the user is not authenticated:
  ```typescript
  {!user && (
    <Alert className="mb-8 /*...*/">
      <AlertTitle>You must be signed in to submit videos.</AlertTitle>
      <AlertDescription>
        Please <Link to="/auth">sign in</Link> to access all features...
      </AlertDescription>
    </Alert>
  )}
  // ...
  <LoRADetailsForm disabled={!user} />
  <MultipleVideoUploader disabled={!user} />
  <Button type="submit" disabled={isSubmitting || !user}>...</Button>
  ```
- Requires authentication check before submitting the form:
  ```typescript
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast.error('You must be signed in to submit videos');
      navigate('/auth');
      return;
    }
    // ... rest of submission logic using user.id or user.email ...
    await submitVideos(videos, loraDetails, reviewerName, user);
  };
  ```


### Admin Page (/admin)

- Imports `RequireAuth` component:
  ```typescript
  import RequireAuth from '@/components/RequireAuth';
  ```
- Wraps the entire page content with `RequireAuth`, requiring admin privileges:
  ```typescript
  return (
    <RequireAuth requireAdmin>
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="container py-8 px-4 flex-1">
          {/* ... Admin dashboard content ... */}
        </main>
      </div>
    </RequireAuth>
  );
  ```
- Note: `useAuth` is not used *directly* within `Admin.tsx`, but access control is handled by the `RequireAuth` wrapper which uses the hook internally.


### Video Page (/videos/:id)

- Authentication state is primarily managed by the `Navigation` component (via `AuthButton`), which uses `useAuth`.
- This page itself does not appear to directly use the `useAuth` hook or gate content based on authentication status in the main component logic.
- Actions like editing or deleting might be present in child components or added later, potentially requiring authentication checks.


### Asset Detail Page (/assets/:id)

- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user and admin status:
  ```typescript
  const { user, isAdmin } = useAuth();
  ```
- Passes `isAdmin` status to child components for conditional rendering/actions:
  ```typescript
  <AssetInfoCard 
    /* ... */
    isAdmin={isAdmin}
    /* ... */
  />
  <AssetVideoSection 
    /* ... */
    isAdmin={isAdmin}
    /* ... */
  />
  ```
- Admin actions (like `handleCurateAsset`) are available, implicitly gated by the `isAdmin` check passed to child components.
- Video upload functionality (within `AssetVideoSection` -> `LoRAVideoUploader`) requires the user to be logged in:
  ```typescript
  // Inside LoRAVideoUploader component used by AssetVideoSection
  const { user } = useAuth();
  // ... checks if user exists before allowing upload actions ...
  ```


## Troubleshooting Random Logouts

This section details aspects of the authentication system relevant to diagnosing issues where users are unexpectedly logged out.

### Session Lifecycle & Persistence

- **Persistence**: Supabase Auth automatically persists user sessions in the browser's `localStorage`. This allows users to remain logged in across browser restarts.
- **Initial Check**: When the app loads, `AuthProvider` checks for an existing session using `supabase.auth.getSession()`.
  ```typescript
  // src/providers/AuthProvider.tsx
  const checkInitialSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (data.session) {
      // Session found, update state
      setSession(data.session);
      setUser(data.session.user);
      // ... check admin status ...
    } else {
      // No session found
    }
  };
  ```
- **State Listener**: `AuthProvider` subscribes to `supabase.auth.onAuthStateChange` to react to events like `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`. This listener updates the global `AuthContext` state (`user`, `session`, `isAdmin`).
  ```typescript
  // src/providers/AuthProvider.tsx
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event: AuthChangeEvent, currentSession) => {
      logger.log(`Persistent auth state changed: ${event}`, currentSession?.user?.id || 'no user');
      
      if (!isMounted.current) {
        logger.log(`[${loadingCount}] Component not mounted, ignoring auth state change`);
        return;
      }
      
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        
        // Check admin status
        if (!adminCheckInProgress.current) {
          adminCheckInProgress.current = true;
          logger.log(`[${loadingCount}] Starting admin check for user after auth change:`, currentSession.user.id);
          
          try {
            const adminStatus = await checkIsAdmin(currentSession.user.id);
            logger.log(`[${loadingCount}] Admin check result after auth change:`, adminStatus);
            setIsAdmin(adminStatus);
          } catch (adminError) {
            logger.error(`[${loadingCount}] Error checking admin status after auth change:`, adminError);
            setIsAdmin(false);
          } finally {
            adminCheckInProgress.current = false;
          }
        }
      } else {
        logger.log(`[${loadingCount}] Auth state change: No session`);
        setUser(null);
        setSession(null);
        setIsAdmin(false);
      }
      
      if (isInitialLoading && initialSessionCheckComplete.current) {
        logger.log(`[${loadingCount}] Finishing initial loading after auth state change`);
        setIsInitialLoading(false);
      }
      
      setLoadingCount(prev => prev + 1);
    }
  );

  // Start the initial session check after setting up the listener
  checkInitialSession();

  return () => {
    logger.log(`[${loadingCount}] Cleaning up auth provider subscription`);
    isMounted.current = false;
    subscription.unsubscribe();
  };
}, []);

```

### Token Expiry & Refresh

- **Tokens**: Supabase sessions use JWTs (JSON Web Tokens): an `access_token` (short-lived, typically 1 hour) and a `refresh_token` (long-lived).
- **Expiry Check**: `getCurrentUser` logs details about the current session's expiration.
  ```typescript
  // src/lib/auth/currentUser.ts
  const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
  const now = new Date();
  const isExpired = expiresAt ? expiresAt < now : false;
  const timeUntilExpiry = expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000) : null;
  
  logger.log('User found in session:', {
    userId: session.user.id,
    expiresAt: expiresAt?.toISOString(),
    now: now.toISOString(),
    isExpired,
    timeUntilExpiry: timeUntilExpiry !== null ? `${timeUntilExpiry} seconds` : 'unknown',
    hasRefreshToken: !!session.refresh_token, // Check if refresh token exists
  });
  ```
- **Automatic Refresh**: Supabase client attempts to automatically refresh the `access_token` using the `refresh_token` before it expires. This happens implicitly when making authenticated requests or calling `getSession`.
- **Manual Refresh**: A manual refresh can be triggered for debugging using `testSessionRefresh`.
  ```typescript
  // src/lib/auth/currentUser.ts
  export const testSessionRefresh = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      logger.error('Error refreshing session:', error);
      return false;
    }
    // ... log success ...
    return true;
  };
  ```
- **Auto-Refresh on Long Load**: `RequireAuth` attempts a manual refresh if authentication is taking too long (> 5 seconds), potentially recovering a session.
  ```typescript
  // src/components/RequireAuth.tsx
  if (isAuthLoading && loadingTime > 5000 && !autoRefreshAttempted && !shouldSkipCheck) {
    logger.log(`Auth loading for ${loadingTime}ms - attempting session refresh`);
    setAutoRefreshAttempted(true);
    testSessionRefresh().then(/* ... */);
  }
  ```

### State Management & Synchronization

- **`AuthProvider`**: The central piece managing auth state (`user`, `session`, `isAdmin`, `isLoading`). It listens to Supabase events and updates the context.
- **`AuthContext`**: Provides the auth state to the rest of the application.
- **`useAuth` Hook**: The standard way for components to access the current auth state (`user`, `session`, `isLoading`, `isAdmin`).
- **`RequireAuth`**: A wrapper component that checks the auth state (`isLoading`, `user`, `session`, `isAdmin`) from `useAuth` before rendering protected routes. It handles loading states and redirects.

### Potential Causes for Random Logouts

1.  **Session Expiration without Refresh**: If the `refresh_token` is invalid, expired, or revoked, the session cannot be refreshed, leading to logout when the `access_token` expires. Check `currentUser.ts` logs for `hasRefreshToken` and `testSessionRefresh` logs for errors.
2.  **Token Refresh Failure**: Network errors or Supabase service issues during the token refresh process can cause it to fail. Check browser network console and `currentUser.ts` logs for `Error refreshing session`.
3.  **Explicit Sign Out Call**: Ensure `signOut` isn't being called unexpectedly.
    ```typescript
    // src/lib/auth/authMethods.ts
    export const signOut = async () => {
      // ... clear caches ...
      const { error } = await supabase.auth.signOut();
      // ... handle error & log ...
    };
    ```
4.  **Client Initialization Options (`persistSession`)**: Ensure the Supabase client is initialized with session persistence enabled. While `persistSession: true` and `autoRefreshToken: true` are usually the defaults in `supabase-js` v2+, explicitly setting them guarantees this behavior.
    ```typescript
    // src/integrations/supabase/client.ts (Current)
    export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    // src/integrations/supabase/client.ts (Recommended explicit config)
    export const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    );
    ```
    If `persistSession` is effectively `false`, the session will not be stored in `localStorage` and will be lost on page reloads.
    
    *Note: Explicitly setting `persistSession` and `autoRefreshToken` to `true` was attempted but did not resolve the observed random logout issue, suggesting the cause lies elsewhere.*
5.  **`localStorage` Issues**:
    *   Browser clearing `localStorage` (e.g., privacy settings, manual clearing).
    *   `localStorage` corruption (rare).
    *   Exceeding `localStorage` quotas (unlikely with just auth tokens). Supabase stores tokens under keys like `sb-<project-ref>-auth-token`.
6.  **Network Instability**: If `AuthProvider` fails to get the initial session (`getSession`) or receives an error during `onAuthStateChange`, it might default to a logged-out state. Check `AuthProvider.tsx` logs for errors.
7.  **State Synchronization Problems**:
    *   Race conditions between `onAuthStateChange` events and component logic using `useAuth`. The extensive logging in `AuthProvider` and `RequireAuth` should help identify this.
    *   Issues with multiple tabs/windows not syncing the logout state correctly (Supabase client usually handles this via `localStorage` events, but browser behaviour can vary).
8.  **Backend Issues & Configuration**: 
    * Problems on the Supabase side (e.g., user manually revoked sessions, server errors). Check Supabase dashboard logs.
    * Incorrect URL configuration in the Supabase Dashboard -> Auth -> URL Configuration:
      - Ensure the **Site URL** is set to `https://openmuse.ai/`.
      - Ensure the **Redirect URLs** allow list includes all required callback URLs. Currently, this should include:
        - `https://openmuse.ai/auth/callback`
        - `https://openmuse.lovable.app/auth/callback`
      Mismatches or missing entries here can break the OAuth flow (like Discord login) or session handling after authentication.
    * Session Management Settings (Supabase Dashboard -> Auth -> Session Management):
      - **Refresh Token Reuse Interval**: `10 seconds` (Time interval where the same refresh token can be used multiple times).
      - **Enforce single session per user**: `Disabled` (If enabled, logging in on a new device/browser terminates older sessions).
      - **Time-box user sessions**: `0` / `never` (No maximum session duration enforced).
      - **Inactivity timeout**: `0` / `never` (No forced logout due to inactivity).
      While the current settings (mostly disabled limits) are unlikely to cause random logouts, enabling features like "Enforce single session" could.
9.  **Rate Limits & Advanced Configuration**: Excessive requests from a single IP or user could trigger rate limits, potentially causing failed sign-ins, token refreshes, or other auth operations that might appear as logouts. (Supabase Dashboard -> Auth -> Rate Limits & Advanced)
    *   **Rate Limits (per IP / relevant period):**
        *   Email Sending: 30/hour
        *   SMS Sending: 30/hour
        *   Token Refreshes: 30/5-min interval
        *   Token Verifications (OTP/Magic Link): 30/5-min interval
        *   Anonymous Sign-ins: 30/hour
        *   Sign-ups/Sign-ins (non-anonymous): 30/5-min interval
    *   **Advanced Settings:**
        *   Request Duration Timeout: 10 seconds
        *   Max Direct Auth DB Connections: 10
    Hitting these limits, especially token refresh or sign-in limits, could prevent users from maintaining or establishing a session.
10. **Component Mounting/Unmounting**: `AuthProvider` uses `isMounted.current` checks to prevent state updates after unmounting, but rapid mounting/unmounting cycles could potentially cause issues.
11. **Conflicting Session Checks (`DatabaseProvider.ts`)**: The `DatabaseProvider` performs its own `supabase.auth.getSession()` calls with a cooldown mechanism. If this logic incorrectly determines the user is logged out (e.g., due to a temporary network error during its check, or a cooldown mismatch with the actual session state change), it might clear the user ID used for database operations (`supabaseDatabaseOperations.setCurrentUserId(null)`). While this shouldn't directly log the user *out* via `AuthProvider`, it could cause subsequent database requests to fail RLS checks, potentially leading to errors or redirects that appear like a logout. See file content below.
12. **Role Check Failures (`userRoles.ts`)**: Errors during the asynchronous `checkIsAdmin` call within `AuthProvider` (or other role checks using `getUserRoles`) could lead to incorrect `isAdmin` state. If a protected route relies on `isAdmin`, a temporary failure could cause a redirect, mimicking a logout. Caching (`userRolesCache`) adds another layer where stale data could potentially cause issues if not invalidated correctly. See file content below.
13. **General Authenticated API Call Errors**: How does the application handle `401 Unauthorized` errors when making general Supabase API calls (e.g., fetching data)? If a `401` occurs (due to an expired/invalid token missed by the initial checks), does the error handler trigger a `signOut()` call or a redirect to `/auth`? This could be a common source of apparent logouts.
14. **Browser/Environment Factors**: Consider if the issue is specific to certain browsers, occurs when multiple tabs are open, or is affected by browser extensions (especially those related to privacy or script blocking). Testing in an Incognito/Private window can help isolate these factors. Inspecting `localStorage` (for keys like `sb-*-auth-token`) in the browser's developer tools can confirm if the session data is unexpectedly missing.

### Debugging Features

- **Extensive Logging**: `AuthProvider`, `currentUser`, `RequireAuth`, `AuthCallback`, `AuthButton`, `DatabaseProvider`, `UserRoles` contain detailed logs about session checks, state changes, loading times, and errors. Enable verbose logging in the browser console to view these.
- **Loading State Tracking**: `AuthProvider` and `RequireAuth` track loading states (`isInitialLoading`, `initialSessionCheckComplete`, `isLoading`) and log timing information. `RequireAuth` includes logic to detect and break potential loading loops.
- **Session Details**: `currentUser.ts` logs detailed session information, including expiry times and refresh token presence.
- **Manual Refresh Test**: `testSessionRefresh` in `currentUser.ts` allows manually testing the refresh flow.
- **Admin Check**: `AuthProvider` includes checks for admin status (`checkIsAdmin`) and logs the results. See `userRoles.ts` below.
- **Role Management Implementation (`src/lib/auth/userRoles.ts`)**: Details how roles are fetched (`getUserRoles` with 5-min cache), checked (`checkIsAdmin`), and added (`addUserRole`). See file contents below.
- **Caching Implementation (`src/lib/auth/cache.ts`)**: Defines `userProfileCache` (1-min TTL) and `userRolesCache` (5-min TTL) using Maps. Caches cleared on sign-out/updates. See file contents below.
- **Database Provider Auth Interaction (`src/lib/database/DatabaseProvider.ts`)**: Contains logic (`getDatabase`) for separate auth checks (`getSession` with 10s cooldown) to set user ID for DB operations. See file contents below.

## Supabase RLS Policies

This section outlines the Row Level Security policies configured for the main tables in Supabase.

### `asset_media` Table

- **Policy:** `Allow admins to manage all asset_media`
  - **Operation:** `ALL`
  - **Role:** `public` (*Note: Likely intended for an 'admin' role via function security or check*) 
- **Policy:** `Allow anonymous users to insert asset_media`
  - **Operation:** `INSERT`
  - **Role:** `anon`
- **Policy:** `Allow anonymous users to select asset_media`
  - **Operation:** `SELECT`
  - **Role:** `anon`
- **Policy:** `Allow authenticated users to read all asset_media`
  - **Operation:** `SELECT`
  - **Role:** `authenticated`
- **Policy:** `Users can delete their own asset_media`
  - **Operation:** `DELETE`
  - **Role:** `public` (*Note: Likely requires a `USING` clause checking `auth.uid()`*)
- **Policy:** `Users can insert their own asset_media`
  - **Operation:** `INSERT`
  - **Role:** `public` (*Note: Likely requires a `WITH CHECK` clause checking `auth.uid()`*)
- **Policy:** `Users can view their own asset_media`
  - **Operation:** `SELECT`
  - **Role:** `public` (*Note: Likely requires a `USING` clause checking `auth.uid()`*)

### `assets` Table

- **Policy:** `Allow admins to manage all assets`
  - **Operation:** `ALL`
  - **Role:** `public` (*Note: Likely intended for an 'admin' role via function security or check*)
- **Policy:** `Allow anonymous users to insert assets`
  - **Operation:** `INSERT`
  - **Role:** `anon`
- **Policy:** `Allow anonymous users to select assets`
  - **Operation:** `SELECT`
  - **Role:** `anon`
- **Policy:** `Allow anonymous users to update assets`
  - **Operation:** `UPDATE`
  - **Role:** `anon`
- **Policy:** `Allow authenticated users to read all assets`
  - **Operation:** `SELECT`
  - **Role:** `authenticated`
- **Policy:** `Users can delete their own assets`
  - **Operation:** `DELETE`
  - **Role:** `public` (*Note: Likely requires a `USING` clause checking `auth.uid()`*)
- **Policy:** `Users can insert their own assets`
  - **Operation:** `INSERT`
  - **Role:** `public` (*Note: Likely requires a `WITH CHECK` clause checking `auth.uid()`*)
- **Policy:** `Users can update their own assets`
  - **Operation:** `UPDATE`
  - **Role:** `public` (*Note: Likely requires `USING` and `WITH CHECK` clauses checking `auth.uid()`*)
- **Policy:** `Users can view their own assets`
  - **Operation:** `SELECT`
  - **Role:** `public` (*Note: Likely requires a `USING` clause checking `auth.uid()`*)

### `media` Table

- **Policy:** `Allow admins to manage all media`
  - **Operation:** `ALL`
  - **Role:** `public` (*Note: Likely intended for an 'admin' role via function security or check*)
- **Policy:** `Allow anonymous users to insert media`
  - **Operation:** `INSERT`
  - **Role:** `anon`
- **Policy:** `Allow anonymous users to select media`
  - **Operation:** `SELECT`
  - **Role:** `anon`
- **Policy:** `Allow authenticated users to read all media`
  - **Operation:** `SELECT`
  - **Role:** `authenticated`
- **Policy:** `Users can delete their own media`
  - **Operation:** `DELETE`
  - **Role:** `public` (*Note: Likely requires a `USING` clause checking `auth.uid()`*)
- **Policy:** `Users can insert their own media`
  - **Operation:** `INSERT`
  - **Role:** `public` (*Note: Likely requires a `WITH CHECK` clause checking `auth.uid()`*)
- **Policy:** `Users can update their own media`
  - **Operation:** `UPDATE`
  - **Role:** `public` (*Note: Likely requires `USING` and `WITH CHECK` clauses checking `auth.uid()`*)
- **Policy:** `Users can view their own media`
  - **Operation:** `SELECT`
  - **Role:** `public` (*Note: Likely requires a `USING` clause checking `auth.uid()`*)

### `profiles` Table

- **Policy:** `Allow public access to profiles`
  - **Operation:** `SELECT`
  - **Role:** `public`
- **Policy:** `Users can update own profile`
  - **Operation:** `UPDATE`
  - **Role:** `public` (*Note: Likely requires `USING` and `WITH CHECK` clauses checking `auth.uid() = id`*)

### `user_roles` Table

- **Policy:** `Allow users to see all roles`
  - **Operation:** `SELECT`
  - **Role:** `public` (*Caution: This allows any user, including anonymous, to potentially see all user-role assignments if not further restricted by column permissions or views*)

## Authentication Files

### src/integrations/supabase/client.ts

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const SUPABASE_URL = "https://ujlwuvkrxlvoswwkerdf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHd1dmtyeGx2b3N3d2tlcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODM1MDYsImV4cCI6MjA1NzM1OTUwNn0.htwJHr4Z4NlMZYVrH1nNGkU53DyBTWgMeOeUONYFy_4";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Helper function to retrieve asset media relationships for debugging
export const debugAssetMedia = async (assetId: string) => {
  const { data, error } = await supabase
    .rpc('debug_asset_media', { asset_id: assetId });
  
  if (error) {
    console.error('Error fetching asset media relationships:', error);
    return null;
  }
  
  return data;
};

// Test RLS permissions to ensure proper data access
export const testRLSPermissions = async () => {
  const results = {
    assetsAccess: false,
    mediaAccess: false
  };
  
  // Test assets access
  try {
    const { data: assetsData, error: assetsError } = await supabase
      .from('assets')
      .select('id')
      .limit(1);
      
    results.assetsAccess = !assetsError && Array.isArray(assetsData);
  } catch (error) {
    console.error('Error testing assets access:', error);
  }
  
  // Test media access
  try {
    const { data: mediaData, error: mediaError } = await supabase
      .from('media')
      .select('id')
      .limit(1);
      
    results.mediaAccess = !mediaError && Array.isArray(mediaData);
  } catch (error) {
    console.error('Error testing media access:', error);
  }
  
  return results;
};

```

### src/contexts/AuthContext.tsx

```typescript
import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin?: boolean; // Add isAdmin property to track admin status
};

// Create the auth context with default values
export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAdmin: false, // Default to false for safety
  signIn: async () => {},
  signOut: async () => {},
});

```

### src/providers/AuthProvider.tsx

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { checkIsAdmin } from '@/lib/auth';

const logger = new Logger('AuthProvider');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Log version to help with debugging
  logger.log('--- AuthProvider Module Execution (Persistent Session v2 with Debug) ---');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loadingCount, setLoadingCount] = useState(0);

  const isMounted = useRef(true);
  const initialSessionCheckComplete = useRef(false);
  const adminCheckInProgress = useRef(false);

  useEffect(() => {
    logger.log('Setting up persistent auth provider with enhanced logging');
    isMounted.current = true;
    initialSessionCheckComplete.current = false;

    // Immediately check for an existing session when the component mounts
    const checkInitialSession = async () => {
      try {
        logger.log(`[${loadingCount}] Checking for existing persistent session`);
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error(`[${loadingCount}] Error getting initial session:`, error);
          setIsInitialLoading(false);
          initialSessionCheckComplete.current = true;
          return;
        }
        
        if (data.session) {
          logger.log(`[${loadingCount}] Persistent session found:`, data.session.user.id);
          setSession(data.session);
          setUser(data.session.user);
          
          // Check admin status
          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[${loadingCount}] Starting admin check for user:`, data.session.user.id);
            
            try {
              const adminStatus = await checkIsAdmin(data.session.user.id);
              logger.log(`[${loadingCount}] Admin check result for ${data.session.user.id}:`, adminStatus);
              setIsAdmin(adminStatus);
            } catch (adminError) {
              logger.error(`[${loadingCount}] Error checking admin status:`, adminError);
              setIsAdmin(false);
            } finally {
              adminCheckInProgress.current = false;
            }
          }
        } else {
          logger.log(`[${loadingCount}] No persistent session found`);
        }
        
        logger.log(`[${loadingCount}] Initial session check completed`);
        setIsInitialLoading(false);
        initialSessionCheckComplete.current = true;
      } catch (error) {
        logger.error(`[${loadingCount}] Unexpected error during initial session check:`, error);
        setIsInitialLoading(false);
        initialSessionCheckComplete.current = true;
      }
      
      setLoadingCount(prev => prev + 1);
    };
    
    // Set up auth state change listener
    logger.log(`[${loadingCount}] Setting up auth state change listener`);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        logger.log(`[${loadingCount}] Persistent auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        
        if (!isMounted.current) {
          logger.log(`[${loadingCount}] Component not mounted, ignoring auth state change`);
          return;
        }
        
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Check admin status
          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[${loadingCount}] Starting admin check for user after auth change:`, currentSession.user.id);
            
            try {
              const adminStatus = await checkIsAdmin(currentSession.user.id);
              logger.log(`[${loadingCount}] Admin check result after auth change:`, adminStatus);
              setIsAdmin(adminStatus);
            } catch (adminError) {
              logger.error(`[${loadingCount}] Error checking admin status after auth change:`, adminError);
              setIsAdmin(false);
            } finally {
              adminCheckInProgress.current = false;
            }
          }
        } else {
          logger.log(`[${loadingCount}] Auth state change: No session`);
          setUser(null);
          setSession(null);
          setIsAdmin(false);
        }
        
        if (isInitialLoading && initialSessionCheckComplete.current) {
          logger.log(`[${loadingCount}] Finishing initial loading after auth state change`);
          setIsInitialLoading(false);
        }
        
        setLoadingCount(prev => prev + 1);
      }
    );

    // Start the initial session check after setting up the listener
    checkInitialSession();

    return () => {
      logger.log(`[${loadingCount}] Cleaning up auth provider subscription`);
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      logger.log(`[${loadingCount}] Starting sign in process for email: ${email}`);
      toast.loading('Signing in...', { id: 'signin-toast' }); 
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      toast.dismiss('signin-toast');

      if (error) {
        logger.error(`[${loadingCount}] Sign in error:`, error);
        throw error;
      }
      
      logger.log(`[${loadingCount}] Sign in successful for: ${email}`);
      setLoadingCount(prev => prev + 1);
    } catch (error: any) {
      toast.dismiss('signin-toast');
      toast.error(error.message || 'Error signing in');
      logger.error(`[${loadingCount}] Sign in error:`, error);
    }
  };

  const signOut = async () => {
    try {
      logger.log(`[${loadingCount}] Starting sign out process`);
      toast.loading('Signing out...', { id: 'signout-toast' });
      await supabase.auth.signOut();
      toast.dismiss('signout-toast');
      logger.log(`[${loadingCount}] Sign out successful`);
      setLoadingCount(prev => prev + 1);
    } catch (error: any) {
      toast.dismiss('signout-toast');
      toast.error(error.message || 'Error signing out');
      logger.error(`[${loadingCount}] Sign out error:`, error);
    }
  };

  // Combine loading states
  const combinedIsLoading = isInitialLoading || !initialSessionCheckComplete.current;

  logger.log(`[${loadingCount}] AuthProvider State: isLoading=${combinedIsLoading}, user=${!!user}, session=${!!session}, isAdmin=${isAdmin}`);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        isAdmin, 
        isLoading: combinedIsLoading, 
        signIn, 
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

```

### src/hooks/useAuth.tsx

```typescript
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

// Export the hook for using the auth context
export const useAuth = () => useContext(AuthContext);

// Re-export the AuthProvider for convenience
export { AuthProvider } from '@/providers/AuthProvider';

```

### src/lib/auth/authMethods.ts

```typescript
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import { userProfileCache, userRolesCache } from './cache';

const logger = new Logger('AuthMethods');

export const signInWithDiscord = async () => {
  try {
    // Get the current URL to use as redirect
    let redirectUrl = `${window.location.origin}/auth/callback`;
    
    // Clear caches before signing in but maintain sessions
    logger.log('Cleaning up caches before Discord login');
    userProfileCache.clear();
    userRolesCache.clear();
    
    logger.log('Starting Discord sign in, redirect URL:', redirectUrl);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: redirectUrl,
        scopes: 'identify email guilds',
        skipBrowserRedirect: false,
        queryParams: {
          prompt: 'consent'
        }
      }
    });
    
    if (error) {
      logger.error('Error signing in with Discord:', error);
      throw error;
    }
    
    logger.log('Sign in with Discord initiated successfully', data);
    return data;
  } catch (error) {
    logger.error('Error in signInWithDiscord:', error);
    throw error;
  }
};

export const signOut = async () => {
  logger.log('Signing out');
  
  try {
    // Clear caches first
    userProfileCache.clear();
    userRolesCache.clear();
    
    // Sign out from Supabase globally
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logger.error('Error signing out:', error);
      throw error;
    }
    
    logger.log('Sign out successful');
    
    // Wait for auth state to update
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return true;
  } catch (error) {
    logger.error('Error in signOut:', error);
    throw error;
  }
};

```

### src/lib/auth/currentUser.ts

```typescript
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';

const logger = new Logger('CurrentUser');

export const getCurrentUser = async () => {
  try {
    const startTime = new Date().getTime();
    logger.log(`Getting current session at ${startTime}`);
    const { data: { session }, error } = await supabase.auth.getSession();
    
    const endTime = new Date().getTime();
    logger.log(`Session fetch completed in ${endTime - startTime}ms`);
    
    if (error) {
      logger.error('Error getting session:', error);
      return null;
    }
    
    if (!session?.user) {
      logger.log('No user in session');
      return null;
    }
    
    // Log session expiration details for debugging
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();
    const isExpired = expiresAt ? expiresAt < now : false;
    const timeUntilExpiry = expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000) : null;
    
    logger.log('User found in session:', {
      userId: session.user.id,
      expiresAt: expiresAt?.toISOString(),
      now: now.toISOString(),
      isExpired,
      timeUntilExpiry: timeUntilExpiry !== null ? `${timeUntilExpiry} seconds` : 'unknown',
      hasRefreshToken: !!session.refresh_token,
    });
    
    // Return the user directly without checking profile
    return session.user;
  } catch (error) {
    logger.error('Error in getCurrentUser:', error);
    return null;
  }
};

// Add a debug function to test token refresh
export const testSessionRefresh = async () => {
  try {
    logger.log('Testing session refresh');
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      logger.error('Error refreshing session:', error);
      return false;
    }
    
    logger.log('Session refresh successful:', {
      userId: data.session?.user.id,
      newExpiresAt: data.session ? new Date(data.session.expires_at! * 1000).toISOString() : null,
    });
    
    return true;
  } catch (error) {
    logger.error('Unexpected error in testSessionRefresh:', error);
    return false;
  }
};

```

### src/lib/auth/userProfile.ts

```typescript
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '../types';
import { Logger } from '../logger';
import { toast } from 'sonner';
import { signOut } from './authMethods';
import { userProfileCache, PROFILE_CACHE_TTL } from './cache';

const logger = new Logger('UserProfile');

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.error('Error getting session in getCurrentUserProfile:', sessionError);
      return null;
    }
    
    if (!session) {
      logger.log('No active session in getCurrentUserProfile');
      return null;
    }
    
    const userId = session.user.id;
    
    // Check cache first
    const now = Date.now();
    const cachedData = userProfileCache.get(userId);
    if (cachedData && now - cachedData.timestamp < PROFILE_CACHE_TTL) {
      logger.log('Returning cached user profile');
      return cachedData.profile;
    }
    
    // Check if user profile exists in database
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      logger.error('Error getting user profile:', error);
      // Don't clear cache or return null on temporary errors
      // Return cached data if available, even if expired
      if (cachedData) {
        logger.log('Returning expired cached profile due to database error');
        return cachedData.profile;
      }
      // Only set null if we have no cached data at all
      userProfileCache.set(userId, {profile: null, timestamp: now});
      return null;
    }
    
    if (!data) {
      logger.warn(`User profile not found for authenticated user: ${userId}`);
      userProfileCache.set(userId, {profile: null, timestamp: now});
      return null;
    }
    
    logger.log('Successfully retrieved user profile');
    userProfileCache.set(userId, {profile: data as UserProfile, timestamp: now});
    return data as UserProfile;
  } catch (error) {
    logger.error('Error in getCurrentUserProfile:', error);
    // Don't clear cache on error - be resilient
    return null;
  }
};

export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<UserProfile | null> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      toast.error('You must be logged in to update your profile');
      return null;
    }
    
    const userId = session.user.id;
    logger.log('Updating user profile:', userId, updates);
    
    // Check if display_name is unique if it's being updated
    if (updates.display_name) {
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('display_name', updates.display_name)
        .neq('id', userId)
        .limit(1);
      
      if (checkError) {
        logger.error('Error checking display name uniqueness:', checkError);
        toast.error('Failed to check if display name is available');
        return null;
      }
      
      if (existingUser && existingUser.length > 0) {
        toast.error('This display name is already taken. Please choose another one.');
        return null;
      }
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating user profile:', error);
      toast.error('Failed to update profile');
      return null;
    }
    
    // Clear cache
    userProfileCache.delete(userId);
    
    toast.success('Profile updated successfully');
    return data as UserProfile;
  } catch (error) {
    logger.error('Error in updateUserProfile:', error);
    toast.error('An error occurred while updating your profile');
    return null;
  }
};

```

### src/components/RequireAuth.tsx

```typescript
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { testSessionRefresh } from '@/lib/auth/currentUser';

const logger = new Logger('RequireAuth');

interface RequireAuthProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowUnauthenticated?: boolean;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  requireAdmin = false,
  allowUnauthenticated = false
}) => {
  const { user, session, isLoading: isAuthLoading, isAdmin: isContextAdmin } = useAuth();
  const location = useLocation();
  const [authCheckCount, setAuthCheckCount] = useState(0);
  const [autoRefreshAttempted, setAutoRefreshAttempted] = useState(false);
  const loadStartTime = React.useRef(Date.now());
  const checkCompleted = React.useRef(false);
  
  // Determine if the path should skip auth checks
  const shouldSkipCheck = 
    allowUnauthenticated || // Always allow if explicitly set
    location.pathname === '/auth' || 
    location.pathname === '/auth/callback' ||
    location.pathname.startsWith('/assets/loras/'); // Allow unauthenticated access to LoRA details

  // Log the state RequireAuth sees *before* any decisions are made
  logger.log(
    `RequireAuth Initial Check (${authCheckCount}) - Path: ${location.pathname}, isAuthLoading: ${isAuthLoading}, User: ${!!user}, Session: ${!!session}, isContextAdmin: ${isContextAdmin}, requireAdmin: ${requireAdmin}, allowUnauthenticated: ${allowUnauthenticated}, shouldSkipCheck: ${shouldSkipCheck}`
  );
  
  useEffect(() => {
    // Only increment check counter if we haven't completed our check yet
    if (!checkCompleted.current) {
      setAuthCheckCount(prev => prev + 1);
    }
    
    // Log authentication status when component mounts or auth state changes
    logger.log(`Auth check #${authCheckCount} - Path: ${location.pathname}, User: ${user ? user.id : 'unauthenticated'}, Session: ${session ? 'valid' : 'none'}, ContextAdmin: ${isContextAdmin ? 'yes' : 'no'}, isLoading: ${isAuthLoading}`);
    
    // If we've been in loading state too long, try auto-refreshing the session once
    const loadingTime = Date.now() - loadStartTime.current;
    if (isAuthLoading && loadingTime > 5000 && !autoRefreshAttempted && !shouldSkipCheck) {
      logger.log(`Auth loading for ${loadingTime}ms - attempting session refresh`);
      setAutoRefreshAttempted(true);
      testSessionRefresh().then(success => {
        logger.log(`Session refresh attempt result: ${success ? 'successful' : 'failed'}`);
      });
    }
    
    // Mark our check as completed if we have auth state
    if (!isAuthLoading && !checkCompleted.current) {
      checkCompleted.current = true;
      logger.log(`Auth check completed after ${authCheckCount} checks and ${Date.now() - loadStartTime.current}ms`);
    }
  }, [user, session, isContextAdmin, isAuthLoading]);

  // Debug check to prevent infinite loading
  useEffect(() => {
    if (isAuthLoading && authCheckCount > 5 && !checkCompleted.current) {
      logger.warn(`Potential loading loop detected in RequireAuth - Path: ${location.pathname}, checks: ${authCheckCount}, time in loading: ${(Date.now() - loadStartTime.current) / 1000}s`);
      
      // After 30 seconds, show a toast with helpful information
      if (authCheckCount === 15) {
        toast.error("Authentication is taking longer than expected. You may need to sign in again.");
      }
      
      // After 20 checks, force completion to break potential loops
      if (authCheckCount > 20 && !checkCompleted.current) {
        logger.error(`Force-breaking potential auth loop after ${authCheckCount} checks`);
        checkCompleted.current = true;
      }
    }
  }, [authCheckCount, isAuthLoading, location.pathname]);
  
  // Use the loading state directly from the Auth context
  const isLoading = isAuthLoading && !checkCompleted.current; 
  
  // Show loading state while authentication is being checked (but not forever)
  if (isLoading) {
    const loadTime = (Date.now() - loadStartTime.current) / 1000;
    logger.log(`Rendering Loading State - Path: ${location.pathname} (Auth Loading: ${isAuthLoading}), check #${authCheckCount}, loading for ${loadTime}s`);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">
          Checking access... {authCheckCount > 5 ? `(${loadTime.toFixed(1)}s)` : ""}
        </h1>
        {authCheckCount > 10 && (
          <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
            {loadTime > 15 ? 
              "This is taking much longer than expected. There may be an issue with the authentication service." :
              "Still checking... This is taking longer than expected."}
          </p>
        )}
        {loadTime > 30 && (
          <div className="mt-4">
            <button 
              onClick={() => window.location.href = '/auth'} 
              className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 transition-colors"
            >
              Go to login page
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Handle skipped checks first
  if (shouldSkipCheck) {
    logger.log(`Skipping Auth Checks - Path: ${location.pathname}`);
    return <>{children}</>;
  }
  
  // Handle unauthenticated users for protected routes
  if (!user || !session) {
    logger.warn(
      `Redirecting to /auth: User not authenticated. Path: ${location.pathname}, User: ${user ? 'exists' : 'null'}, Session: ${session ? 'exists' : 'null'}`
    );
    return (
      <Navigate 
        to={`/auth?returnUrl=${encodeURIComponent(location.pathname)}`} 
        replace 
      />
    );
  }
  
  // Handle non-admin users trying to access admin resources
  if (requireAdmin && !isContextAdmin) {
    logger.warn(
      `Redirecting to /: User NOT admin (checked context). Path: ${location.pathname}, isContextAdmin: ${isContextAdmin}`
    );
    toast.error('You do not have access to this resource');
    return <Navigate to="/" replace />;
  }
  
  // If all checks pass, render children
  logger.log(`Rendering Children - Path: ${location.pathname}, User authenticated and authorized`);
  return <>{children}</>;
};

export default RequireAuth;

```

### src/components/AuthButton.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LogOut, LogIn, User, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUserProfile } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const logger = new Logger('AuthButton');

const AuthButton: React.FC = () => {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  const [forceUpdate, setForceUpdate] = useState(0);
  
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 3000); // Set timeout to 3 seconds
      
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [isLoading]);
  
  useEffect(() => {
    if (user) {
      setForceUpdate(prev => prev + 1);
      logger.log('User authenticated, forcing re-render');
    }
  }, [user]);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        setIsLoadingProfile(true);
        try {
          const profile = await getCurrentUserProfile();
          setUserProfile(profile);
        } catch (error) {
          logger.error('Error fetching user profile:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      } else {
        setUserProfile(null);
      }
    };
    
    fetchUserProfile();
  }, [user, forceUpdate]);
  
  const handleSignIn = () => {
    navigate('/auth');
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      logger.error('Error signing out:', error);
    }
  };

  const handleSettings = () => {
    navigate('/profile');
  };
  
  const getDisplayName = () => {
    if (userProfile) {
      return userProfile.display_name || userProfile.username;
    }
    return user?.user_metadata.preferred_username || user?.email || 'User';
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  if (isLoading && !loadingTimeout) {
    return (
      <Button variant="ghost" disabled className="animate-pulse">
        <div className="h-5 w-20 bg-muted rounded" />
      </Button>
    );
  }
  
  if (!user) {
    return (
      <Button 
        variant="outline" 
        onClick={handleSignIn}
        className="flex items-center gap-2 border-olive/30 text-olive"
      >
        <LogIn className="h-4 w-4" />
        Sign In
      </Button>
    );
  }
  
  const displayName = getDisplayName();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 border-2 border-olive/40 text-olive shadow-sm hover:bg-cream pl-2 pr-3"
        >
          {userProfile?.avatar_url ? (
            <Avatar className="h-6 w-6 mr-1">
              <AvatarImage src={userProfile.avatar_url} alt={displayName} />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-4 w-4" />
          )}
          {isLoadingProfile ? '...' : displayName}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 border border-olive/20">
        <DropdownMenuLabel className="font-heading">My Account</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-olive/10" />
        <DropdownMenuItem 
          onClick={handleSettings}
          className="flex items-center cursor-pointer"
        >
          <Settings className="h-4 w-4 mr-2" />
          Profile Settings
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleSignOut} 
          className="text-destructive flex items-center cursor-pointer font-medium hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AuthButton;

```

### src/pages/Auth.tsx

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signInWithDiscord } from '@/lib/auth';
import { toast } from 'sonner';
import Navigation, { Footer } from '@/components/Navigation';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('Auth');

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoadingDiscord, setIsLoadingDiscord] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const { user, session, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    logger.log(`Auth page useEffect: isAuthLoading=${isAuthLoading}, user=${!!user}, session=${!!session}, redirecting=${redirecting}`);

    // Prevent redirect loops by tracking if we've already started redirecting
    if (!isAuthLoading && user && session && !redirecting) {
      const searchParams = new URLSearchParams(location.search);
      const returnUrl = searchParams.get('returnUrl') || '/';

      logger.log(`Auth page: User is logged in (via useAuth), redirecting to ${returnUrl}`);
      setRedirecting(true);
      
      // Use setTimeout to break potential synchronous loop
      setTimeout(() => {
        navigate(returnUrl, { replace: true });
      }, 100);
    } else if (!isAuthLoading && (!user || !session)) {
      logger.log('Auth page: User is not logged in (via useAuth), showing login form.');
    }
  }, [user, session, isAuthLoading, navigate, location.search, redirecting]);

  const handleDiscordSignIn = async () => {
    if (isLoadingDiscord) return;

    try {
      logger.log('Auth page: Starting Discord sign-in');
      setIsLoadingDiscord(true);

      await signInWithDiscord();
    } catch (error) {
      logger.error('Error signing in with Discord:', error);
      toast.error('Failed to sign in with Discord');
      setIsLoadingDiscord(false);
    }
  };

  if (isAuthLoading || redirecting) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        
        <div className="flex-1 w-full">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-center p-4">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p>{redirecting ? "Redirecting you..." : "Checking authentication status..."}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-center p-4">
          <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-subtle space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold">Sign In</h1>
              <p className="text-muted-foreground">
                Sign in to OpenMuse to add LoRAs and videos
              </p>
            </div>
            
            <Button
              className="w-full flex items-center justify-center gap-2"
              onClick={handleDiscordSignIn}
              disabled={isLoadingDiscord}
            >
              {isLoadingDiscord ? (
                <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
              ) : (
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 127.14 96.36"
                  fill="currentColor"
                >
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
              )}
              Sign in with Discord
            </Button>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Auth;

```

### src/pages/AuthCallback.tsx

```typescript
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('AuthCallback');

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  
  useEffect(() => {
    let isActive = true;
    
    logger.log('AuthCallback: Mounted. Waiting for AuthProvider to handle session...', {
      hash: !!window.location.hash,
      query: window.location.search,
    });
    
    // Set a timeout only as a fallback for catastrophic failure
    const maxWaitTimeoutId = setTimeout(() => {
      if (isActive && isProcessing && !user) {
        logger.error('Auth callback timed out after 15 seconds - no session detected by AuthProvider');
        setError('Authentication timed out or failed. Please try signing in again.');
        setIsProcessing(false);
      }
    }, 15000); 
    
    return () => {
      logger.log('AuthCallback: Cleaning up');
      isActive = false;
      clearTimeout(maxWaitTimeoutId);
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isProcessing) return;
    
    if (user) {
      const searchParams = new URLSearchParams(location.search);
      const returnUrl = searchParams.get('returnUrl') || '/';
      
      logger.log(`AuthCallback: User detected by AuthProvider, navigating to ${returnUrl}`);
      queueMicrotask(() => {
         navigate(returnUrl, { replace: true });
      });
    } else {
      logger.log('AuthCallback: AuthProvider finished loading, but no user session found.');
      if (isProcessing) {
           setIsProcessing(false);
      }
    }
  }, [user, isAuthLoading, navigate, location.search, isProcessing]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {error ? (
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Authentication Issue</h1>
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={() => navigate('/auth', { replace: true })}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Go to Sign In
          </button>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Finalizing Authentication</h1>
          <p className="text-muted-foreground">Please wait while we complete the sign-in process...</p>
        </div>
      )}
    </div>
  );
};

export default AuthCallback;

```
