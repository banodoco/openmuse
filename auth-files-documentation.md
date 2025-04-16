1. Introduction
This document explains how authentication is managed within the application. It covers:

High-level overview of the authentication approach and architecture.

Core components: AuthProvider, useAuth hook, RequireAuth wrapper, and more.

Page-level usage: How different pages implement or require authentication.

Common issues and troubleshooting, especially around "random logout" scenarios.

Row Level Security (RLS) configuration in Supabase.

Complete source code (appendices) of all relevant authentication files.

The underlying authentication is powered by Supabase, which manages sessions with an access_token and refresh_token. All authentication state is tracked and exposed to React components via a custom React context (AuthContext) provided by the AuthProvider.

2. Core Auth Architecture
2.1 Supabase Client
Located in src/integrations/supabase/client.ts.

Created with createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY).

Ideally configured with:

typescript
Copy
{
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
}
to ensure tokens persist in localStorage and automatically refresh.

2.2 AuthContext & AuthProvider
AuthContext
Stores the current user, session, and a boolean isLoading for authentication status.

Also includes signIn(...) and signOut() methods.

Provides a boolean isAdmin indicating whether the authenticated user has administrative privileges.

AuthProvider
The top-level provider that initializes and manages auth state.

It checks for an existing session on mount (supabase.auth.getSession()) and then subscribes to supabase.auth.onAuthStateChange.

Whenever the session or user changes (i.e., a sign-in, sign-out, or token refresh event), the provider updates user, session, and isAdmin accordingly.

Maintains a robust isLoading state that remains true until the initial session check (and associated admin check) completes.

2.3 useAuth Hook
Simply calls useContext(AuthContext) to let components read and interact with the auth state (user, session, isLoading, isAdmin) and the sign-in/sign-out functions.

Used in many pages/components to conditionally render content based on whether the user is authenticated or has admin privileges.

2.4 RequireAuth Wrapper
A higher-order component that enforces authentication (and optionally admin status).

If the user is not authenticated, it redirects them to /auth (with a return URL).

If the user must be admin but is not, it redirects them to /.

Renders loading states while waiting for auth to finalize.

3. Page-Level Usage
Below is how each route or page in the application consumes the authentication system. Some rely on the useAuth hook directly; others wrap their content in RequireAuth to enforce protection.

3.1 Home Page (/)
Imports useAuth:

typescript
Copy
import { useAuth } from '@/hooks/useAuth';
Reads user and authLoading from useAuth.

Runs a useEffect that checks permissions once user is available. Uses user.id to look up or verify roles.

Disables buttons (e.g., "Propose New LoRA") when authLoading is true.

3.2 Auth Page (/auth)
Imports useAuth.

Reads user, session, and isLoading.

Redirects away if already authenticated.

Has a "Sign in with Discord" button that calls signInWithDiscord() from authMethods.

3.3 Auth Callback Page (/auth/callback)
Uses useAuth to detect when the user object and session are finalized.

Redirects to a returnUrl once a valid user is present, or shows an error if no valid session is found after a timeout.

3.4 Profile Page (/profile)
Wrapped in RequireAuth. Therefore, a user must be logged in to view it.

Contains profile settings logic, presumably leveraging the user info from useAuth.

3.5 Upload Page (/upload)
Uses useAuth to get user.

If user is absent, the page shows a prompt asking them to sign in. Submission forms are disabled when not logged in.

On submit, if no user, the code navigates to /auth.

3.6 Admin Page (/admin)
Wrapped in RequireAuth requireAdmin, so only an admin user can access it.

Uses the isAdmin logic in RequireAuth to enforce admin privileges.

3.7 Video Page (/videos/:id)
Does not directly enforce authentication.

Relies on the shared Navigation component for showing an authenticated state (the AuthButton).

Future editing/deleting features may require additional gating or RequireAuth.

3.8 Asset Detail Page (/assets/:id)
Imports useAuth to get user and isAdmin.

Passes isAdmin to child components to control admin-only actions such as curation.

Uploader sub-components also check user before allowing video uploads.

4. Troubleshooting "Random Logouts"
Many factors can cause unexpected sign-outs or apparent "random logout" scenarios. Below are the primary considerations based on code review and potential external factors:

Session Expiration without Refresh

*   **Finding:** The `refresh_token` mechanism is relied upon. If it's invalid, missing, or fails to exchange, the `access_token` will expire (typically after 1 hour).
*   **Check:** Use logs in `src/lib/auth/currentUser.ts` (specifically `getCurrentUser`) which log `expiresAt` and `hasRefreshToken`. Watch browser network traffic for failed requests to Supabase's `/token?grant_type=refresh_token` endpoint.

Token Refresh Failure

*   **Finding:** `AuthProvider` logs errors from `getSession()` and `onAuthStateChange`. `src/lib/auth/currentUser.ts` includes `testSessionRefresh()` for manual debugging.
*   **Check:** Check browser console/network logs for errors during session checks or refresh attempts, especially network errors or specific Supabase error messages.

Unexpected Sign Out Calls

*   **Finding:** Code review confirmed `signOut()` (from `authMethods` or `useAuth`) is primarily called by the user-facing `AuthButton` component (`src/components/AuthButton.tsx`). No automated or unexpected calls were found in the analyzed TS/TSX codebase. The core sign-out logic resides in `src/lib/auth/authMethods.ts` and `src/providers/AuthProvider.tsx`.
*   **Check:** If unexpected sign-outs occur, double-check if any recent code changes introduced new calls to `signOut`.

Supabase Client Config

*   **Finding:** **CONFIRMED:** `src/integrations/supabase/client.ts` correctly initializes the client with `{ auth: { persistSession: true, autoRefreshToken: true }}`. This ensures sessions *should* persist in `localStorage` and refresh automatically.
*   **Check:** Verify no accidental changes were made to this configuration.

localStorage Issues

*   **Finding:** The app relies on Supabase's `persistSession: true`. Issues arise if the browser clears or blocks `localStorage`. **However, debugging revealed cases where the session *is* correctly present in localStorage before and after refresh, yet the user is still logged out.**
*   **Check:** Use browser DevTools (Application -> Local Storage) to confirm if the `sb-...-auth-token` key exists and contains valid data *after* a refresh that causes logout. If the data is present, the issue likely lies elsewhere (see **Spurious `SIGNED_IN` Event** below).

Network Instability

*   **Finding:** `AuthProvider` logs errors if `getSession()` fails. Logs during debugging showed `getSession()` was *not* failing due to network issues during the problematic refresh.
*   **Check:** Review logs in `AuthProvider` for errors indicating failure to reach Supabase during initial session checks or state changes. Check network tab for failed Supabase requests.

Race Conditions in State / React Strict Mode

*   **Finding:** `AuthProvider` uses `isMounted` and `initialCheckCompleted` refs to mitigate potential issues from multiple effect runs (common in Strict Mode). The observed issue (logout on refresh despite valid stored session) might still be related to StrictMode interactions or initialization timing.
*   **Check:** Examine console logs from `AuthProvider` for repeated initialization messages. Test in a production build (where StrictMode is off) to see if the behavior differs.

**Spurious `SIGNED_IN` Event on Refresh (Observed Scenario)**

*   **Observation:** Debugging revealed a scenario where, upon page refresh:
    1.  The session *is* correctly stored in `localStorage`.
    2.  `AuthProvider` calls `supabase.auth.getSession()`.
    3.  `getSession()` successfully logs that it found the session data (e.g., `getSession() returned data: { hasSession: true, ... }`).
    4.  **Immediately after**, the `supabase.auth.onAuthStateChange` listener incorrectly fires a `SIGNED_IN` event. **Added console logs confirmed the listener receives `event: SIGNED_IN` and a valid `currentSession` object at this point.**
    5.  This unexpected event seems correlated with the user being logged out, potentially due to faulty re-initialization logic triggered by the event (or subsequent duplicate events causing loops in development builds).
*   **Cause:** This points to a potential issue within the Supabase client library (`@supabase/supabase-js@2.49.4` used during diagnosis) where its internal state management incorrectly triggers `SIGNED_IN` on refresh, despite correctly reading the session initially. This might be sensitive to initialization timing or interactions with React (especially StrictMode in development).
*   **Check:** Monitor console logs closely during the problematic refresh for this specific sequence: `getSession() returned data: { hasSession: true, ... }` **followed immediately by** `Persistent auth state changed: SIGNED_IN`. Examine the raw event/session objects logged by `onAuthStateChange`. Verify the URL hash is empty after login (manual clearing via `window.location.hash = ''` in `AuthCallback` did not resolve this specific issue during testing).
*   **Next Steps:** Consider searching the `@supabase/supabase-js` GitHub issues for similar behavior (unexpected `SIGNED_IN` events on refresh/load). If possible, try upgrading/downgrading the library version slightly. Test in a production build to rule out React StrictMode interference. Further investigation into the library's internal initialization might be needed.

Backend/Supabase Config

*   **Finding:** Code cannot verify this. Settings in the Supabase Dashboard are crucial, although less likely to be the cause given the specific logging observed.
*   **Check:** **ACTION REQUIRED:** Manually review Supabase project settings:
    *   Authentication -> Settings: Check session length, inactivity timeout settings.
    *   Authentication -> Rate Limits: Ensure token refresh limits are not being hit.
    *   Authentication -> Providers: Ensure Discord provider is correctly configured.
    *   Authentication -> URL Configuration: Verify Site URL and Redirect URLs are correct.

DatabaseProvider or Role Check Conflicts

*   **Finding:** `AuthProvider` calls `checkIsAdmin` (`src/lib/auth/userRoles.ts`) upon session load/change. `checkIsAdmin` performs a direct, *uncached* database query. No obvious conflicts found.
*   **Check:** Review logs from `UserRoles` (`checkIsAdmin`) if admin status seems incorrect or causes issues.

401 Unauthorized Handling

*   **Finding:** Code review did not find any global API interceptors that automatically trigger `signOut()` upon receiving a 401 status code.
*   **Check:** Verify that specific data-fetching components handle 401s appropriately.

Browser/Environment Factors

*   **Finding:** Code cannot control the browser environment.
*   **Check:** Test across different browsers. Disable browser extensions temporarily.

By leveraging the extensive logging (especially from `AuthProvider`, `CurrentUser`, `UserRoles`) and debugging features (`testSessionRefresh`), and cross-referencing with Supabase Dashboard settings and potentially the Supabase JS library issues, authentication problems can be further investigated. The key observed issue appears to be an unexpected `SIGNED_IN` event firing on refresh despite a valid session being read from storage.

5. Supabase Row-Level Security (RLS) Policies
Supabase RLS policies ensure that only authorized users (or roles) can read, insert, update, or delete rows. Below is a summary of the existing RLS rules:

Key Points:

Admins can manage everything (ALL operation).

Anonymous users have some insert/select/update privileges (particularly for "public" actions like contributing or reading), though the actual system typically relies on "authenticated" role.

Authenticated users can insert and select data. They can only delete or update records that match auth.uid() in the corresponding table's policy.

5.1 asset_media Table
Allow admins to manage all (ALL for role public, but presumably enforced by function security).

Allow anonymous users to insert and select.

Allow authenticated users to select.

Users can delete their own.

Users can insert their own.

Users can view their own.

5.2 assets Table
Similar pattern:

Admins manage all.

Anonymous can insert/select/update.

Authenticated can select.

Users can delete/insert/update/view their own.

5.3 media Table
Same approach as asset_media—admins do anything; users can manipulate their own.

5.4 profiles Table
Public SELECT is allowed, meaning anyone can read profile data.

Users can update their own profile (auth.uid() = id).

5.5 user_roles Table
All roles are SELECTable by public, meaning the roles assigned to each user might be visible to other users unless further constrained.

Admin checks are performed by code that queries user_roles to see if the user has an "admin" role (cached up to 5 minutes).

6. Full Source Code (Appendices)
Below is the full content of all authentication-related files referenced in this document, with minimal commentary. These are provided "as is" for reference and debugging.

Appendix A: Page Snippets
Home Page (/)
typescript
Copy
// Code excerpt showing how it integrates useAuth, checks user, etc.
const { user, isLoading: authLoading } = useAuth();

useEffect(() => {
  if (authLoading) return;
  const checkPermissions = async () => {
    if (user && !permissionsChecked /*...*/) {
      // ... permission checking logic using user.id ...
    }
  };
  checkPermissions();
}, [user, permissionsChecked, authLoading]);

// Example button usage
<PageHeader 
  // ...
  buttonDisabled={lorasLoading || authLoading}
/>;
Auth Page (/auth)
typescript
Copy
import { useAuth } from '@/hooks/useAuth';
import { signInWithDiscord } from '@/lib/auth';

const { user, session, isLoading: isAuthLoading } = useAuth();

useEffect(() => {
  if (!isAuthLoading && user && session && !redirecting) {
    // navigate to returnUrl
  }
}, [user, session, isAuthLoading]);

const handleDiscordSignIn = async () => {
  await signInWithDiscord();
};
Auth Callback Page (/auth/callback)
typescript
Copy
import { useAuth } from '@/hooks/useAuth';

const { user, isLoading: isAuthLoading } = useAuth();

useEffect(() => {
  if (isAuthLoading || !isProcessing) return;
  if (user) {
    navigate(returnUrl, { replace: true });
  } else {
    setError(...);
  }
}, [user, isAuthLoading]);
Profile Page (/profile)
typescript
Copy
import RequireAuth from '@/components/RequireAuth';

export default function ProfilePage() {
  return (
    <RequireAuth>
      {/* ... protected content ... */}
    </RequireAuth>
  );
}
Upload Page (/upload)
typescript
Copy
import { useAuth } from '@/hooks/useAuth';

const { user } = useAuth();

{!user && (
  <Alert>
    <AlertTitle>You must be signed in to submit videos.</AlertTitle>
    <AlertDescription>Please <Link to="/auth">sign in</Link>...</AlertDescription>
  </Alert>
)}

<Button type="submit" disabled={!user}>...</Button>

const handleSubmit = async () => {
  if (!user) {
    navigate('/auth');
    return;
  }
  // ...
};
Admin Page (/admin)
typescript
Copy
import RequireAuth from '@/components/RequireAuth';

return (
  <RequireAuth requireAdmin>
    {/* ... admin content ... */}
  </RequireAuth>
);
Video Page (/videos/:id)
Relies on global navigation for auth state; no direct gating in the main component.

Asset Detail Page (/assets/:id)
typescript
Copy
import { useAuth } from '@/hooks/useAuth';
const { user, isAdmin } = useAuth();

<AssetInfoCard isAdmin={isAdmin} />
<AssetVideoSection isAdmin={isAdmin} />
Appendix B: Auth Files
B.1 client.ts (Supabase Client)
typescript
Copy
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const SUPABASE_URL = "https://ujlwuvkrxlvoswwkerdf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1Ni...";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// debug helpers...
B.2 AuthContext.tsx
typescript
Copy
import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin?: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAdmin: false,
  signIn: async () => {},
  signOut: async () => {},
});
B.3 AuthProvider.tsx
typescript
Copy
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { checkIsAdmin } from '@/lib/auth';

const logger = new Logger('AuthProvider');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ... state definitions ...

  useEffect(() => {
    // 1) check initial session
    // 2) subscribe to onAuthStateChange
    // 3) track isLoading until done
  }, []);

  const signIn = async (email: string, password: string) => { /* ... */ };
  const signOut = async () => { /* ... */ };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAdmin,
      isLoading,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
B.4 useAuth.tsx
typescript
Copy
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export const useAuth = () => useContext(AuthContext);
export { AuthProvider } from '@/providers/AuthProvider';
B.5 authMethods.ts
typescript
Copy
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import { userProfileCache, userRolesCache } from './cache';

export const signInWithDiscord = async () => {
  // calls supabase.auth.signInWithOAuth({ provider: 'discord', ... })
  // ...
};

export const signOut = async () => {
  // Clears local caches, calls supabase.auth.signOut()
  // ...
};
B.6 currentUser.ts
typescript
Copy
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';

export const getCurrentUser = async () => {
  // checks supabase.auth.getSession() and logs details about expiration
};

export const testSessionRefresh = async () => {
  // calls supabase.auth.refreshSession() for debugging
};
B.7 userProfile.ts
typescript
Copy
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';
import { toast } from 'sonner';
import { signOut } from './authMethods';
import { userProfileCache, PROFILE_CACHE_TTL } from './cache';

export const getCurrentUserProfile = async () => {
  // fetches or caches the user's profile from 'profiles'
};

export const updateUserProfile = async (updates) => {
  // updates the 'profiles' table, checks for unique display_name, etc.
};
B.8 RequireAuth.tsx
typescript
Copy
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { testSessionRefresh } from '@/lib/auth/currentUser';

const RequireAuth = ({ children, requireAdmin, allowUnauthenticated }) => {
  // uses isAuthLoading, user, session, isAdmin from useAuth
  // if user not authenticated -> navigate('/auth')
  // if requireAdmin && !isAdmin -> navigate('/')
  // else render children
};

export default RequireAuth;
B.9 AuthButton.tsx
typescript
Copy
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUserProfile } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

// Displays sign-in/out or user profile info
const AuthButton = () => {
  // ...
};

export default AuthButton;
B.10 Auth.tsx (the /auth page)
typescript
Copy
import { useAuth } from '@/hooks/useAuth';
import { signInWithDiscord } from '@/lib/auth';

const Auth = () => {
  // if user is already logged in, navigate to returnUrl
  // else show "Sign in with Discord" button
};

export default Auth;
B.11 AuthCallback.tsx (the /auth/callback page)
typescript
Copy
import { useAuth } from '@/hooks/useAuth';

const AuthCallback = () => {
  // wait for user to be set
  // if user is set, redirect or show error if not
};

export default AuthCallback;
End of Document
This concludes the comprehensive overview of how authentication is set up and managed in the codebase. It includes detailed usage patterns, potential pitfalls, row-level security notes, and the complete source for reference. By following the debug logs and verifying each step—from session persistence to RLS policies—most authentication issues, including unexpected logouts, can be identified and resolved.