# How Items Load & Authentication Flow in the Video Response Generator

This document outlines the process by which LoRAs and videos are loaded and displayed, and how user authentication is handled within the application.

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

## II. Route Protection & Page Rendering

4.  **`RequireAuth` Check (`src/components/RequireAuth.tsx`):**
    *   If a route is wrapped in `RequireAuth` (e.g., `/admin`), this component renders *before* the target page.
    *   **Reads Auth Context:** Uses `useAuth()` to get the current authentication state (`user`, `session`, `isAdmin`, `isLoading`).
    *   **Initial Loading State:** If `isLoading` from the context is initially `true`, it displays its own "Checking access..." indicator.
    *   **Waits for AuthProvider:** It waits until `isLoading` from `useAuth()` becomes `false`, signifying that `AuthProvider` has finished its initial check and provided a definitive state.
    *   **Authorization Logic (after `isLoading` is false):**
        *   **Public Route?** If `allowUnauthenticated` is true or the path is explicitly public (like `/auth`), renders the child page immediately.
        *   **Authenticated?** If no `user`/`session` exists, redirects to `/auth?returnUrl=...`.
        *   **Admin Required?** If `requireAdmin` is true but `isAdmin` from context is false, redirects to `/` with an error message.
        *   **Access Granted:** If all checks pass, it renders the child page component.

## III. Page-Specific Data Loading Examples

5.  **Homepage (`src/pages/Index.tsx`):**
    *   Mounts after lazy loading. Does not require authentication itself to display the basic layout.
    *   Uses `useAuth()`, `useVideoManagement()`, `useLoraManagement()`.
    *   **Loading Sequence & Data Fetching:**
        *   `useVideoManagement`: Fetches *all* videos (`db.getAllEntries()`) immediately upon hook initialization, independent of auth state. Manages `videosLoading` state.
        *   `useLoraManagement`: Waits for `videosLoading` (from `useVideoManagement`) to become `false`. Then fetches *all* LoRA assets (`assets` table, filtered by type) and associated creator profiles (`profiles` table). Combines LoRAs with video data (linking `primaryVideo` and `videos` array to each LoRA based on IDs/names) and creator display names. Manages its own `lorasLoading` state.
        *   `Index` Page:
            *   Shows `SkeletonGallery` if `videosLoading || lorasLoading` is true.
            *   Performs an explicit RLS permission check (`testRLSPermissions`) once the user is authenticated (`user` is available and `authLoading` is false) and displays a toast error if issues are found.
            *   Triggers an initial `refetchLoras()` shortly after mount *if* the user is authenticated and an initial refresh hasn't already occurred in the current session (tracked via `sessionStorage`).
    *   **Filtering & Rendering:**
        *   Reads the `model` query parameter from the URL.
        *   Applies an initial filter to the fetched `loras` based on this URL parameter (`displayLoras`).
        *   Passes the potentially pre-filtered `displayLoras`, the `lorasLoading` state, and the `modelFilterFromUrl` to the `LoraManager` component.
        *   `LoraManager`: Shows loading/empty states or passes the data to `LoraList`.
        *   `LoraList`:
            *   Receives the `loras` from `LoraManager`.
            *   Provides UI controls for further filtering: text search (name, description, creator), approval status ('Curated' [default], 'Listed', 'Rejected' [admin-only]), and base model (dropdown synced with URL).
            *   Applies these filters client-side to the received LoRAs. Approval status checks both the LoRA record and its primary video.
            *   Renders the final filtered list using `LoraCard` components for each item.

6.  **Video Detail Page (`src/pages/VideoPage.tsx`):**
    *   Mounts after lazy loading. Appears to be a public route.
    *   Uses a `useEffect` hook to trigger data fetching.
    *   Fetches *all* video entries (`db.getAllEntries()`) directly within the effect.
    *   Filters the results client-side to find the specific video (`:id`) and related videos.
    *   Manages its own local `isLoading` state during this fetch/filter process.

7.  **Admin Page (`src/pages/Admin.tsx`):**
    *   Mounts *only after* `RequireAuth` verifies the user is authenticated and `isAdmin` is true.
    *   Uses a `useEffect` hook to load data (`loadEntries`).
    *   Fetches *all* video entries (`db.getAllEntries()`).
    *   Manages its own local `isLoading` state.

8.  **Upload Page (`src/pages/upload/UploadPage.tsx`):**
    *   Mounts after lazy loading. Likely requires authentication implicitly for submission.
    *   Primarily handles *data submission*, not initial loading of existing data.
    *   `handleSubmit` function performs asynchronous operations: uploads files to Supabase Storage, creates records in Supabase DB (`assets`, `media`, `asset_media`).
    *   Uses a local `isSubmitting` state for feedback during the submission process.

## IV. Authentication Flow (Discord Example)

This describes the sequence when a user signs in for the first time or after being logged out.

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

## V. Summary of Loading States & Triggers

-   **Page Code Loading:** Handled by `React.Suspense` during route transitions.
-   **Authentication State (`user`, `session`, `isAdmin`, `isLoading`):** Managed centrally by `AuthProvider` reacting to `getSession()` and `onAuthStateChange`. Consumed via `useAuth()`.
-   **Route Access:** Controlled by `RequireAuth` based on the state from `useAuth()`.
-   **Homepage Data (LoRAs & Videos):** Triggered by `Index` page mount, coordinated by `useVideoManagement` and `useLoraManagement`, dependent on auth state.
-   **Video Detail Data:** Triggered by `VideoPage` mount (`useEffect`), fetches all and filters locally.
-   **Admin Data:** Triggered by `AdminPage` mount (`useEffect`) *after* successful `RequireAuth` check.
-   **Upload Submission:** Triggered by user form submission (`handleSubmit`) on `UploadPage`. Manages local `isSubmitting` state. 