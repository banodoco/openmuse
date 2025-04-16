# How Items Load & Authentication Flow in the Video Response Generator (Updated Strategy)

This document outlines the process by which LoRAs and videos are loaded and displayed, and how user authentication is handled within the application, following an updated strategy to prioritize showing content quickly.

## I. Overall Application Initialization & Auth Setup

1.  **App Mount (`index.html` -> `main.tsx` -> `App.tsx`):**
    *   The React application mounts.
    *   `App.tsx` sets up the core structure, including React Router.
    *   Crucially, `<AuthProvider>` wraps the entire `<Router>`, making authentication state available globally.

2.  **`AuthProvider` Initialization (`src/providers/AuthProvider.tsx`):**
    *   Mounts very early, before specific page components.
    *   **Initial Context:** Provides the `AuthContext` used by `useAuth()`. Consumers initially might see the context's default (`isLoading: true`, `user: null`) until `AuthProvider`'s first render provides the actual state (`isLoading: false`, potentially with user/session data).
    *   **Session Check:** Immediately calls `supabase.auth.getSession()` to check for an existing, valid session (e.g., from a previous login).
    *   **Auth Listener:** Subscribes to `supabase.auth.onAuthStateChange` to react instantly to logins, logouts, and token refreshes.
    *   **State Updates:**
        *   If a session is found or an auth event occurs, it updates its internal `user`, `session` state.
        *   It performs an asynchronous check (`checkIsAdmin` in `src/lib/auth.ts`) to determine if the logged-in user has admin privileges.
        *   Updates the `AuthContext` value with the latest `user`, `session`, `isAdmin` status, and sets `isLoading` to `false` in the provided context value.

3.  **Routing and Page Loading (`App.tsx`):**
    *   React Router matches the current URL to a route definition.
    *   `React.Suspense` handles the lazy loading of the associated page component (e.g., `HomePage`, `AdminPage`). A generic `LoadingState` (`src/components/LoadingState.tsx`) is shown while the page's code is downloaded if it hasn't been already.

## II. Route Protection & Page Rendering (Revised Approach)

4.  **`RequireAuth` Check (`src/components/RequireAuth.tsx`):**
    *   If a route is wrapped in `RequireAuth` (e.g., `/admin`), this component renders *before* the target page.
    *   **Immediate Child Rendering:** `RequireAuth` is modified to render its child component (`children`) immediately, allowing the protected page to mount and begin its own data fetching without waiting for the authentication status to be resolved.
    *   **Reads Auth Context:** Uses `useAuth()` to get the current authentication state (`user`, `session`, `isAdmin`, `isLoading`).
    *   **Shows Loading Overlay (Potentially):** While `useAuth().isLoading` is `true`, `RequireAuth` might display a non-blocking overlay or indicator (e.g., "Checking access...") *over* the already-rendering child page, or coordinate loading states if needed.
    *   **Authorization Logic (Executed *after* `isLoading` is false):**
        *   Once `useAuth().isLoading` becomes `false`, `RequireAuth` performs its checks:
        *   **Public Route?** If `allowUnauthenticated` is true or the path is explicitly public (like `/auth`), it simply ensures the child remains visible (it was already rendered).
        *   **Authenticated Required?** If no `user`/`session` exists and authentication is required, it redirects to `/auth?returnUrl=...`.
        *   **Admin Required?** If `requireAdmin` is true but `isAdmin` from context is false, it redirects to `/` with an error message.
        *   **Access Granted:** If all checks pass, it ensures the child remains visible and removes any loading overlay it might have shown.

## III. Page-Specific Data Loading Examples (Revised Flow)

5.  **Homepage (`src/pages/Index.tsx`):**
    *   Mounts after lazy loading. Does not require authentication itself to display the basic layout and core content.
    *   Uses `useAuth()`, `useVideoManagement()`, `useLoraManagement()`.
    *   **Loading Sequence & Data Fetching:**
        *   `useVideoManagement`: Fetches *all* videos (`db.getAllEntries()`) immediately upon hook initialization, independent of auth state. Manages `videosLoading` state.
        *   `useLoraManagement`: Waits for `videosLoading` (from `useVideoManagement`) to become `false`. Then fetches *all* LoRA assets (`assets` table, filtered by type) and associated creator profiles (`profiles` table). Combines LoRAs with video data and creator display names. Manages its own `lorasLoading` state. This happens *regardless* of the initial auth state.
        *   `Index` Page:
            *   Shows `SkeletonGallery` if `videosLoading || lorasLoading` is true. The page becomes interactive with core data as soon as these are false.
            *   **Auth-Dependent Actions (Delayed):** Uses a `useEffect` hook that triggers *only when* `useAuth().isLoading` becomes `false`. Inside this effect:
                *   If a `user` exists, it performs the explicit RLS permission check (`testRLSPermissions`) and displays a toast error if issues are found.
                *   If a `user` exists, it triggers the initial `refetchLoras()` if needed (based on `sessionStorage`).
    *   **Filtering & Rendering:**
        *   Reads the `model` query parameter from the URL.
        *   Applies an initial filter to the fetched `loras` based on this URL parameter (`displayLoras`).
        *   Passes the potentially pre-filtered `displayLoras`, the `lorasLoading` state, and the `modelFilterFromUrl` to the `LoraManager` component.
        *   `LoraManager`: Shows loading/empty states or passes the data to `LoraList`.
        *   `LoraList`:
            *   Receives the `loras` from `LoraManager`.
            *   Provides UI controls for further filtering. Admin-only filters (like 'Rejected') would be enabled/disabled based on the `isAdmin` state from `useAuth()`, checked *after* auth resolves.
            *   Applies filters client-side.
            *   Renders the final filtered list using `LoraCard`.

6.  **Video Detail Page (`src/pages/VideoPage.tsx`):**
    *   Mounts after lazy loading. Public route.
    *   Fetches *all* video entries (`db.getAllEntries()`) immediately upon mount (`useEffect`).
    *   Filters the results client-side to find the specific video (`:id`) and related videos.
    *   Manages its own local `isLoading` state. (No changes needed here as it was already public).

7.  **Admin Page (`src/pages/Admin.tsx`):**
    *   Mounts after lazy loading, rendered immediately by the modified `RequireAuth`.
    *   Uses a `useEffect` hook to load data (`loadEntries`) immediately on mount.
    *   Fetches *all* video entries (`db.getAllEntries()`).
    *   Manages its own local `isLoading` state for data fetching.
    *   The page content starts rendering and fetching data *before* the final auth check completes.
    *   `RequireAuth` will handle redirecting the user away *if*, after `useAuth().isLoading` becomes `false`, it determines the user is not an admin.

8.  **Upload Page (`src/pages/upload/UploadPage.tsx`):**
    *   Mounts after lazy loading.
    *   The form UI renders immediately.
    *   Authentication is implicitly required for *submission*. The `handleSubmit` function likely checks `useAuth().user` before proceeding or relies on RLS policies configured in Supabase which require an authenticated user for insert operations. The submit button might be disabled until `useAuth().isLoading` is false and a `user` is present.
    *   Uses a local `isSubmitting` state for feedback during the submission process.

## IV. Authentication Flow (Discord Example)

This describes the sequence when a user signs in for the first time or after being logged out. (This flow remains largely the same, as it concerns the explicit sign-in mechanism).

1.  **Navigate to Sign In (`/auth`):** User visits or is redirected to the `Auth` page.
2.  **Render Sign In (`Auth` Page):** The `Auth` component checks `useAuth()`. If the user is already logged in, it redirects them away (e.g., to `/`). Otherwise, it displays the "Sign in with Discord" button.
3.  **Initiate OAuth Flow:** User clicks the button. `handleDiscordSignIn` calls `signInWithDiscord` (`src/lib/auth.ts`), which uses `supabase.auth.signInWithOAuth({ provider: 'discord' })`. This redirects the user's browser to Discord for authorization.
4.  **External Authentication:** User logs into Discord (if necessary) and approves the application's request for access.
5.  **Redirect to Callback:** Discord redirects the browser back to the application's configured Supabase callback URL (likely handled implicitly by Supabase, but resolves to `/auth/callback` in the app's routes). Crucially, the access token information is included in the URL hash (`#access_token=...&`).
6.  **Callback Page Mount (`/auth/callback`):** The `AuthCallback` component renders, showing a "Finalizing Authentication..." message.
7.  **Supabase Client Processing:** The Supabase JS client library (running within `AuthProvider`'s context) automatically detects the session information in the URL hash. It verifies the token with Supabase servers.
8.  **`AuthProvider` Update:** Upon successful verification, the Supabase client triggers the `onAuthStateChange` listener within `AuthProvider` with a `SIGNED_IN` event and the new `session` object. `AuthProvider` updates its state (`user`, `session`), checks for admin privileges (`checkIsAdmin`), and updates the `AuthContext`.
9.  **`AuthCallback` Detects Change:** `AuthCallback` uses `useAuth()`. Its `useEffect` hook detects that the auth state has changed (`isLoading` is false, `user` is now populated).
10. **Final Redirect:** `AuthCallback` clears the sensitive information from the URL hash (`window.location.hash = ''`) and navigates the user to their original intended destination (stored in `returnUrl` query param) or the homepage (`/`).

## V. Summary of Loading States & Triggers (Revised)

-   **Page Code Loading:** Handled by `React.Suspense` during route transitions.
-   **Core Data Loading (Videos, LoRAs, etc.):** Triggered immediately on page/hook mount, independent of authentication status. Managed by page-specific or hook-specific loading states (e.g., `videosLoading`, `lorasLoading`).
-   **Authentication State (`user`, `session`, `isAdmin`, `isLoading`):** Managed centrally by `AuthProvider` reacting to `getSession()` and `onAuthStateChange`. Consumed via `useAuth()`. `isLoading` signifies the *authentication check* is in progress.
-   **Route Access Control:** Handled by `RequireAuth`. Allows child pages to render and load data immediately. Performs redirection checks *after* `useAuth().isLoading` becomes false.
-   **Auth-Dependent Data/Features:** Triggered within pages/components *after* `useAuth().isLoading` becomes false and the necessary `user` or `isAdmin` status is confirmed (e.g., enabling admin controls, fetching user preferences, running RLS checks).
-   **Upload Submission:** Triggered by user form submission (`handleSubmit`). Authentication check likely happens at the point of submission or via RLS. Manages local `isSubmitting` state. 