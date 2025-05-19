import { useEffect, useRef, type RefObject } from 'react';
import Hls, { ErrorData, Events as HlsEvents, HlsConfig } from 'hls.js';

interface UseHlsIntegrationProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement>;
  /** Optional error callback coming from the parent component */
  onError?: (message: string) => void;
  /** Callback to surface loading state changes back to the caller */
  setLoading?: (loading: boolean) => void;
  /** Used purely for logging / debugging so we know which VideoPlayer instance is talking */
  componentId?: string;
}

/**
 * Encapsulates all Hls.js specific logic so that the consumer only needs to
 * provide a *video* element ref and the *src* string.  The hook will:
 *  1. Decide whether Hls.js is required (i.e. `src` looks like an HLS manifest
 *     and the browser does not have native support).
 *  2. Lazily instantiate / re-use a single Hls instance.
 *  3. Bind standard Hls.js event handlers for error & manifest/level loading.
 *  4. Expose the underlying instance (read-only) for advanced operations –
 *     e.g. calling `destroy()` from the outside when performing a hard reset.
 *
 * The hook is *opinionated* – it will automatically clean-up/destroy any Hls
 * instance when the component unmounts **or** when the `src` changes.
 */
export const useHlsIntegration = ({
  src,
  videoRef,
  onError,
  setLoading,
  componentId = 'video'
}: UseHlsIntegrationProps) => {
  const hlsInstanceRef = useRef<Hls | null>(null);
  const hasFallbackAppliedRef = useRef(false);

  // Small helper so we don't have to sprinkle optional chaining everywhere.
  const updateLoading = (state: boolean) => {
    if (setLoading) setLoading(state);
  };

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const isHlsSrc = src && (src.endsWith('.m3u8') || src.includes('.m3u8?'));

    // 1. Bail early if the source is *not* an HLS manifest.
    if (!isHlsSrc) {
      // Destroy any stale Hls instance.
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      return;
    }

    // 2. If the browser supports HLS natively we *also* do nothing.
    const nativeSupport =
      videoEl.canPlayType('application/vnd.apple.mpegURL') ||
      videoEl.canPlayType('application/x-mpegURL');

    if (nativeSupport) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      return;
    }

    // 3. If Hls.js itself is not supported we surface the error.
    if (!Hls.isSupported()) {
      if (onError) onError('Hls.js is not supported in this browser');
      return;
    }

    // 4. (Re-)create the Hls instance when required.
    if (!hlsInstanceRef.current) {
      // Ensure we start from a clean slate – remove `src` so the browser does
      // not attempt a direct download.
      if (videoEl.getAttribute('src')) {
        videoEl.removeAttribute('src');
        videoEl.load();
      }

      const hlsConfig: Partial<HlsConfig> = {
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferHole: 0.8,
        maxBufferLength: 40,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 20000,
        liveDurationInfinity: true,
        liveBackBufferLength: 30,
        maxBufferSize: 30 * 1000 * 1000,
        maxMaxBufferLength: 120,
        highBufferWatchdogPeriod: 2,
        nudgeMaxRetry: 5
      };

      const hls = new Hls(hlsConfig);
      hlsInstanceRef.current = hls;

      hls.attachMedia(videoEl);

      hls.on(HlsEvents.MEDIA_ATTACHED, () => {
        hls.loadSource(src);
      });

      hls.on(HlsEvents.ERROR, (_evt, data: ErrorData) => {
        updateLoading(false);
        let message = `HLS: ${data.details || data.type}`;
        if (data.fatal) message = `Fatal HLS: ${data.details || data.type}`;

        // Enhanced logging for fragLoadError
        if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.error(
            `[VideoMobileError][${componentId}] HLS.js Network/Fragment Error:`,
            {
              message: message,
              isFatal: data.fatal,
              details: data.details,
              type: data.type,
              error: data.error,
              fragUrl: data.frag?.url,
              fragRetries: data.frag ? `${(data.frag as any).numRetry} / ${(data.frag as any).maxRetry}` : 'N/A',
              responseCode: data.response?.code, // HTTP status code if available
              rawErrorData: data // Log the whole data object for full context
            }
          );
        } else {
          // Standard logging for other HLS errors
          console.error(`[VideoMobileError][${componentId}] HLS.js Error:`, message, data.error || data, '(Full data object logged)');
        }

        // Fragment load errors may self-recover – suppress until retries exhausted.
        const frag = data.frag;
        // `any` to safely access non-standard props added by Hls.js internally.
        if (
          data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR &&
          !data.fatal &&
          frag &&
          typeof (frag as any).maxRetry === 'number' &&
          (frag as any).numRetry < (frag as any).maxRetry
        ) {
          return; // Allow internal retry loop.
        }

        // ------------------------------------------------------------------
        // Auto-fallback: If we hit a *fatal* fragment/manifest load error when
        // streaming from Cloudflare Stream, attempt to switch to the MP4
        // download rendition.  This avoids a hard failure when the HLS
        // rendition is temporarily unavailable (or blocked by corporate
        // proxies that don't allow playlist/TS traffic).
        // ------------------------------------------------------------------
        if (
          !hasFallbackAppliedRef.current &&
          data.fatal &&
          (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR)
        ) {
          const originalUrl = src;
          console.log(`[VideoMobileError][${componentId}] Attempting Cloudflare MP4 fallback due to fatal error: ${message}`); // Log fallback attempt
          const cloudflareStreamMatch = originalUrl.match(
            /^(https?:\/\/[^\/]+\/[0-9a-f]{32})\/manifest\/video\.m3u8([?#].*)?$/i
          );

          if (cloudflareStreamMatch) {
            const base = cloudflareStreamMatch[1];
            // Try both possible MP4 URLs that Cloudflare Stream might use
            const possibleMp4Urls = [
              `${base}/downloads/default.mp4`, // Downloads enabled
              `${base}/manifest/video.mp4`     // Direct MP4 stream
            ];
            
            const tryNextMp4Url = async (urls: string[], index = 0) => {
              if (index >= urls.length) {
                // All URLs failed, surface original error
                if (onError) onError(message);
                console.error(`[VideoMobileError][${componentId}] All MP4 fallbacks failed, original error:`, message);
                return;
              }

              const mp4Url = urls[index];
              console.warn(`[VideoMobileError][${componentId}] Trying MP4 fallback (${index + 1}/${urls.length}): ${mp4Url}`);

              const videoElCurrent = videoRef.current;
              if (videoElCurrent) {
                // Prevent repeated attempts
                hasFallbackAppliedRef.current = true;

                // Clean-up HLS instance before hand-off
                if (hlsInstanceRef.current) {
                  hlsInstanceRef.current.destroy();
                  hlsInstanceRef.current = null;
                }

                // Swap source & play
                videoElCurrent.src = mp4Url;
                videoElCurrent.load();
               
               // Try to play and handle failures
               videoElCurrent.play()
                 .then(() => {
                   console.log(`[VideoMobileError][${componentId}] Successfully switched to MP4 fallback`);
                   if (onError) onError('Switched to MP4 fallback due to HLS load error');
                 })
                 .catch((err) => {
                   console.warn(`[VideoMobileError][${componentId}] MP4 fallback failed:`, err);
                   // Try next URL in sequence
                   tryNextMp4Url(urls, index + 1);
                 });

                // Add error handler to try next URL if load fails
                const handleError = () => {
                  videoElCurrent?.removeEventListener('error', handleError);
                  tryNextMp4Url(urls, index + 1);
                };
                videoElCurrent?.addEventListener('error', handleError);
              }
            };

            // Start trying MP4 URLs
            tryNextMp4Url(possibleMp4Urls);
            return; // We're handling recovery
          }
        }
        
        // Buffer stalled errors are typically transient and recoverable –
        // avoid surfacing them to the UI as they tend to self-resolve.
        if (
          data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR &&
          !data.fatal
        ) {
          // Optionally indicate loading state so the caller can show a spinner.
          updateLoading(true);
          return;
        }

        // --------------------------------------------------------------
        // Media decode errors (common on Firefox with certain H.264
        // profiles) are often recoverable by asking Hls.js to detach and
        // re-attach the media element.  Attempt a single recovery pass
        // before surfacing the error to the UI.
        // --------------------------------------------------------------
        if (data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.warn(`[VideoMobileError][${componentId}] Fatal media decode error – attempting Hls.js recovery`);
          try {
            hls.recoverMediaError();
            return; // Recovery attempt made, do not surface to UI yet
          } catch (recoveryErr) {
            console.error(`[VideoMobileError][${componentId}] Media error recovery failed:`, recoveryErr);
          }
        }

        if (onError) onError(message);
        // eslint-disable-next-line no-console – dev utility.
        // console.error(`[${componentId}] HLS.js Error:`, message, data.error || ''); // Original concise log, now part of detailed log
      });

      hls.on(HlsEvents.MANIFEST_LOADED, () => updateLoading(false));
      hls.on(HlsEvents.LEVEL_LOADED, () => updateLoading(false));
    }

    // 5. Cleanup when `src` changes or the component unmounts.
    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
    // We *deliberately* omit `onError` & `setLoading` from deps because callers
    // should treat them as *stable* callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, videoRef.current]);

  return { hlsInstanceRef } as const;
}; 