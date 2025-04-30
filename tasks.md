# Task: Refactor Video Playback for Robust Shared Video Element

## 1. Problem Statement

The current video playback system involves separate `HTMLVideoElement` instances for previews (in `VideoCard`) and the full view (`VideoLightbox`). This causes a noticeable delay and re-initialization when opening the lightbox, even if the video file is cached. An initial attempt to share a single video element has proven fragile, working inconsistently for subsequent videos and potentially leaving empty containers upon closing the lightbox. The core challenge is managing the lifecycle and state of a *single* video element as it's dynamically moved between different UI contexts (multiple potential previews and one lightbox) and ensuring the correct element is returned to the correct, still-mounted container.

## 2. Goal

Implement a robust system where a **single, persistent `HTMLVideoElement`** is managed globally and seamlessly "teleported" between its originating preview container and the `VideoLightbox`. This transition must be instant, preserving buffered data and avoiding video re-initialization, while correctly handling multiple video sources and component lifecycles.

## 3. Core Requirements

### 3.1. Shared State Management (Zustand - `useSharedVideo` store)

The Zustand store (`src/stores/useSharedVideo.ts`) is the single source of truth and must manage:

*   `videoElement`: A reference to the *single* `HTMLVideoElement` currently being managed. Null if no video is active.
*   `currentSrc`: The `src` attribute of the `videoElement` currently being managed. Used for identification.
*   `previewContainerRef`: A **React Ref (`React.RefObject<HTMLElement | null>`)** pointing to the specific container element *within the preview component* that currently owns or should own the `videoElement` when not in the lightbox. This ref ensures we always target the correct, potentially re-rendered, preview container.
*   `isInLightbox`: Boolean flag indicating if the `videoElement` is currently attached to the lightbox container.
*   `activeSharedKey`: An identifier (e.g., the video `src` or `videoId`) representing the video intended to be active, whether in preview or lightbox.

### 3.2. Element Lifecycle Management (Zustand Actions)

*   **`mountVideoElement(element, src, previewContainerRef, sharedKey)`**:
    *   Called by `VideoPlayer` instances in the `preview` context via `useEffect`.
    *   **Crucially:** It should only register/update the `videoElement`, `currentSrc`, and `previewContainerRef` in the store **IF** `isInLightbox` is `false` OR if the incoming `sharedKey` matches the `activeSharedKey` (allowing the correct preview to reclaim the element if the lightbox was just closed for it).
    *   If registering, it ensures the `element` is physically appended to the container pointed to by `previewContainerRef.current`.
    *   Sets standard preview defaults (muted, no controls, `object-cover`).
    *   Updates `activeSharedKey`.
*   **`teleportToLightbox(lightboxContainerRef, sharedKey, options)`**:
    *   Called by `VideoPlayer` instance in the `lightbox` context via `useEffect`.
    *   **Precondition:** Checks if `sharedKey` matches the store's `activeSharedKey`. If not, this lightbox instance should *not* steal the element and potentially render its own, non-shared video temporarily or show a loading state.
    *   If preconditions met:
        *   Physically appends the store's `videoElement` to the `lightboxContainerRef.current`.
        *   Applies lightbox `options` (unmute, controls, `object-contain`, updated `className`).
        *   Resets `videoElement.currentTime = 0`.
        *   Calls `videoElement.play()` (handling potential promise rejection).
        *   Sets `isInLightbox = true`.
*   **`returnToPreview(sharedKey)`**:
    *   Called by the `VideoPlayer`'s `useEffect` cleanup *only when `shareContext` is `lightbox`*.
    *   **Precondition:** Checks if `sharedKey` matches the store's `activeSharedKey`.
    *   If preconditions met:
        *   Retrieves the correct `previewContainerRef` from the store.
        *   **Checks if `previewContainerRef.current` exists** (the original preview might have unmounted).
        *   If the container exists, physically appends the `videoElement` back to `previewContainerRef.current`.
        *   Restores preview defaults (pause, mute, no controls, `object-cover`).
        *   Sets `isInLightbox = false`.
        *   Optionally: Clear `activeSharedKey` or leave it, depending on desired behavior if the preview unmounted.
*   **`cleanupPreview(sharedKey)`**: (New action)
    *   Called by the `VideoPlayer`'s `useEffect` cleanup *only when `shareContext` is `preview`*.
    *   **Precondition:** Checks if `sharedKey` matches the store's `activeSharedKey`.
    *   If preconditions met and `!isInLightbox`:
        *   Sets `videoElement`, `currentSrc`, `previewContainerRef`, `activeSharedKey` to `null` in the store, effectively releasing the element.

### 3.3. Component Integration

*   **`VideoPlayer.tsx`**:
    *   Accepts `sharedKey` (mandatory for shared playback, e.g., `video.id` or `video.url`) and `shareContext: 'preview' | 'lightbox'`.
    *   Uses `useRef` for its own immediate container (`containerRef`).
    *   **Preview Context (`shareContext === 'preview'`)**:
        *   `useEffect` calls `mountVideoElement` with the video element, `src`, its `containerRef`, and `sharedKey`.
        *   `useEffect` cleanup calls `cleanupPreview` with `sharedKey`.
    *   **Lightbox Context (`shareContext === 'lightbox'`)**:
        *   `useEffect` calls `teleportToLightbox` with its `containerRef`, `sharedKey`, and necessary display options.
        *   `useEffect` cleanup calls `returnToPreview` with `sharedKey`.
    *   The actual `<video>` tag is rendered, but its attachment to the DOM is primarily controlled by the Zustand store actions.
*   **`VideoCard.tsx` / `StandardVideoPreview.tsx` / `StorageVideoPlayer.tsx`**:
    *   Pass the appropriate `sharedKey` (e.g., `video.id` or `video.url`) and `shareContext="preview"` to their `VideoPlayer` instance.
*   **`VideoLightbox.tsx`**:
    *   Pass the `videoId` or `videoUrl` as `sharedKey` and `shareContext="lightbox"` to its `VideoPlayer` instance.

## 4. Implementation Details

*   Use stable identifiers for `sharedKey` (e.g., `video.id` if available and unique, otherwise `video.url`).
*   Ensure `useEffect` dependency arrays in `VideoPlayer` correctly capture `sharedKey`, `shareContext`, and refs to trigger actions appropriately.
*   Handle potential errors during DOM manipulation (`appendChild`).
*   State transitions (mute, play, styles) must be applied *after* the element is appended to the correct container.
*   Insert logs with unique marker "[SHARED_VIDEO]" for debugging:
    *   `mountVideoElement`: Log "Mounting video element {sharedKey} in preview"
    *   `teleportToLightbox`: Log "Moving video {sharedKey} to lightbox" and "Video {sharedKey} failed to play in lightbox" on error
    *   `returnToPreview`: Log "Returning video {sharedKey} to preview" and "Preview container not found for {sharedKey}" if container missing
    *   `cleanupPreview`: Log "Cleaning up preview video {sharedKey}"

## 5. Key Considerations & Edge Cases

*   **Race Conditions:** Rapidly opening/closing the lightbox or scrolling previews in/out of view. The store logic must prevent inconsistent states. Using `activeSharedKey` and checking `isInLightbox` helps.
*   **Stale Refs:** The `previewContainerRef` in the store *must* be a React Ref passed from the preview `VideoPlayer` to ensure it points to the current DOM node, even after re-renders. `returnToPreview` must check if `previewContainerRef.current` is still valid before appending.
*   **Preview Unmounting:** If the preview container unmounts while the video is in the lightbox, `returnToPreview` should potentially do nothing or log a warning, as there's nowhere valid to return the element to. The `cleanupPreview` action handles releasing the element if the preview unmounts normally.
*   **Multiple Videos with Same `src`:** If `src` is used as `sharedKey`, this could cause conflicts. Using a unique `video.id` is preferred.
*   **Initial Load:** The first time a video is encountered in preview, `mountVideoElement` registers it. When the lightbox opens for it, `teleportToLightbox` uses that registered element.

## 6. Testing Scenarios

Verify the following scenarios work seamlessly:

1.  Open Video 1 -> Close Lightbox -> Video 1 preview works correctly.
2.  Open Video 1 -> Close Lightbox -> Open Video 2 -> Close Lightbox -> Video 1 & 2 previews work correctly.
3.  Open Video 1 -> Scroll Video 1's card out of view -> Close Lightbox -> Scroll Video 1 back into view -> Preview works correctly (or shows placeholder if element was cleaned up).
4.  Open Video 1 Lightbox -> While open, hover over Video 2 preview -> Video 1 remains in lightbox, Video 2 preview behaves normally (doesn't steal element).
5.  Open Video 1 Lightbox -> While open, click to open Video 2 Lightbox -> Video 1 returns to its (potentially unmounted) preview, Video 2 takes over the element and appears in the lightbox.
6.  Rapidly click different video previews to open the lightbox multiple times.
7.  Test on both desktop and mobile.

## 7. Files Likely Involved

*   `src/stores/useSharedVideo.ts` (Major changes to state and actions)
*   `src/contexts/SharedVideoContext.ts` (No changes needed if just re-exporting)
*   `src/components/video/VideoPlayer.tsx` (Add cleanup effect, pass refs, adjust effect logic)
*   `src/components/video/StandardVideoPreview.tsx` (Pass `sharedKey`)
*   `src/components/StorageVideoPlayer.tsx` (Pass `sharedKey`)
*   `src/components/VideoLightbox.tsx` (Pass `sharedKey`)
*   Components using `VideoLightbox` (Ensure correct `videoId`/`videoUrl` is passed).
