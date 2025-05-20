import React, { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react';

// Using console.log with a specific tag for easier debugging as per requirements.
const log = (...args: any[]) => console.log('[MobileVideoPlayCtx]', ...args);
// const warn = (...args: any[]) => console.warn('[MobileVideoPlayCtx]', ...args);

interface VideoInfo {
  element: HTMLVideoElement;
  prefersToPlay: boolean;
}

interface VideoPlaybackContextType {
  registerMobileVideo: (videoId: string, videoElement: HTMLVideoElement, prefersToPlayInitial: boolean) => void;
  unregisterMobileVideo: (videoId: string) => void;
  updateVideoPreference: (videoId: string, prefersToPlay: boolean) => void;
}

const VideoPlaybackContext = createContext<VideoPlaybackContextType | undefined>(undefined);

// Throttle function
const throttle = <T extends (...args: any[]) => void>(func: T, limit: number): T => {
  let lastFunc: NodeJS.Timeout | undefined;
  let lastRan: number | undefined;
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    if (lastRan === undefined) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      if (lastFunc) clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (lastRan && (Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (lastRan ? (Date.now() - lastRan) : 0));
    }
  } as T;
};

export const VideoPlaybackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mobileVideosRef = useRef<Map<string, VideoInfo>>(new Map());
  const activeMobileVideoIdRef = useRef<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);

  const updateViewportHeight = useCallback(() => {
    if (typeof window !== 'undefined') {
      setViewportHeight(window.innerHeight);
    }
  }, []);

  const manageMobileVideoPlayback = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || mobileVideosRef.current.size === 0) {
      if (activeMobileVideoIdRef.current) {
        const currentVideoInfo = mobileVideosRef.current.get(activeMobileVideoIdRef.current);
        if (currentVideoInfo && currentVideoInfo.element && !currentVideoInfo.element.paused) {
          log(`Context: Pausing ${activeMobileVideoIdRef.current} as conditions for playback are not met (e.g., no videos/window).`);
          currentVideoInfo.element.pause();
        }
        activeMobileVideoIdRef.current = null;
      }
      return;
    }

    const middleBandTop = viewportHeight * 0.4; // Top of the middle 40-60% band
    const middleBandBottom = viewportHeight * 0.6; // Bottom of the middle 40-60% band

    let bestCandidateId: string | null = null;
    let maxOverlap = 0; // Tracks the overlap amount of the best candidate

    mobileVideosRef.current.forEach((videoInfo, videoId) => {
      if (!videoInfo.element || !document.body.contains(videoInfo.element)) {
        return;
      }
      const rect = videoInfo.element.getBoundingClientRect();
      const isElementVisibleInViewport = rect.top < viewportHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;

      if (isElementVisibleInViewport) {
        const overlapTop = Math.max(rect.top, middleBandTop);
        const overlapBottom = Math.min(rect.bottom, middleBandBottom);
        const currentOverlap = Math.max(0, overlapBottom - overlapTop);

        if (currentOverlap > 0) { // Video must have *some* overlap with the band
          if (currentOverlap > maxOverlap) {
            maxOverlap = currentOverlap;
            bestCandidateId = videoId;
          } else if (currentOverlap === maxOverlap && bestCandidateId) {
            const bandCenterY = (middleBandTop + middleBandBottom) / 2;
            const currentVideoCenterY = rect.top + rect.height / 2;
            const existingCandidateInfo = mobileVideosRef.current.get(bestCandidateId);
            if (existingCandidateInfo && existingCandidateInfo.element) {
              const existingRect = existingCandidateInfo.element.getBoundingClientRect();
              const existingCandidateCenterY = existingRect.top + existingRect.height / 2;
              if (Math.abs(currentVideoCenterY - bandCenterY) < Math.abs(existingCandidateCenterY - bandCenterY)) {
                bestCandidateId = videoId;
              }
            }
          }
        }
      }
    });

    // Force pause of any video not equal to bestCandidateId
    mobileVideosRef.current.forEach((videoInfo, videoId) => {
      if (videoId !== bestCandidateId && videoInfo.element && !videoInfo.element.paused) {
        log(`Context: Pausing video ${videoId} because it is not the best candidate.`);
        videoInfo.element.pause();
      }
    });

    const previouslyActiveVideoId = activeMobileVideoIdRef.current;

    if (bestCandidateId) {
      if (previouslyActiveVideoId && previouslyActiveVideoId !== bestCandidateId) {
        const oldVideoInfo = mobileVideosRef.current.get(previouslyActiveVideoId);
        if (oldVideoInfo && oldVideoInfo.element && !oldVideoInfo.element.paused) {
          log(`Context: Pausing previously active video: ${previouslyActiveVideoId} (new best candidate: ${bestCandidateId}).`);
          oldVideoInfo.element.pause();
        }
      }

      const newVideoInfo = mobileVideosRef.current.get(bestCandidateId);
      if (newVideoInfo && newVideoInfo.element && newVideoInfo.prefersToPlay && newVideoInfo.element.paused) {
        log(`Context: Playing new best candidate video: ${bestCandidateId}.`);
        newVideoInfo.element.play().catch(e => log(`Context: Error playing ${bestCandidateId}:`, e));
      }
      activeMobileVideoIdRef.current = bestCandidateId;
    } else {
      if (previouslyActiveVideoId) {
        const oldVideoInfo = mobileVideosRef.current.get(previouslyActiveVideoId);
        if (oldVideoInfo && oldVideoInfo.element && !oldVideoInfo.element.paused) {
          log(`Context: Pausing video: ${previouslyActiveVideoId} (no video has sufficient overlap in middle band).`);
          oldVideoInfo.element.pause();
        }
      }
      activeMobileVideoIdRef.current = null;
    }

  }, [viewportHeight]);

  const throttledManagePlayback = useCallback(throttle(manageMobileVideoPlayback, 200), [manageMobileVideoPlayback]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', throttledManagePlayback, { passive: true });
      window.addEventListener('resize', updateViewportHeight);
      window.addEventListener('resize', throttledManagePlayback);
      updateViewportHeight(); // Initial call
      throttledManagePlayback(); // Initial check
      
      return () => {
        window.removeEventListener('scroll', throttledManagePlayback);
        window.removeEventListener('resize', updateViewportHeight);
        window.removeEventListener('resize', throttledManagePlayback);
      };
    }
  }, [throttledManagePlayback, updateViewportHeight]);

  const registerMobileVideo = useCallback((videoId: string, videoElement: HTMLVideoElement, prefersToPlayInitial: boolean) => {
    log(`Context: Registering video: ${videoId}, prefersToPlay: ${prefersToPlayInitial}`);
    mobileVideosRef.current.set(videoId, { element: videoElement, prefersToPlay: prefersToPlayInitial });
    throttledManagePlayback();
  }, [throttledManagePlayback]);

  const unregisterMobileVideo = useCallback((videoId: string) => {
    log(`Context: Unregistering video: ${videoId}`);
    const videoInfo = mobileVideosRef.current.get(videoId);
    if (videoInfo && videoInfo.element && !videoInfo.element.paused) {
        log(`Context: Pausing video ${videoId} during unregistration.`);
        videoInfo.element.pause();
    }
    mobileVideosRef.current.delete(videoId);
    if (activeMobileVideoIdRef.current === videoId) {
      activeMobileVideoIdRef.current = null; 
    }
    throttledManagePlayback();
  }, [throttledManagePlayback]);

  const updateVideoPreference = useCallback((videoId: string, prefersToPlay: boolean) => {
    const videoInfo = mobileVideosRef.current.get(videoId);
    if (videoInfo) {
      log(`Context: Updating preference for ${videoId} to ${prefersToPlay}`);
      videoInfo.prefersToPlay = prefersToPlay;
      throttledManagePlayback();
    }
  }, [throttledManagePlayback]);

  return (
    <VideoPlaybackContext.Provider value={{ registerMobileVideo, unregisterMobileVideo, updateVideoPreference }}>
      {children}
    </VideoPlaybackContext.Provider>
  );
};

export const useVideoPlaybackManager = () => {
  const context = useContext(VideoPlaybackContext);
  if (context === undefined) {
    throw new Error('useVideoPlaybackManager must be used within a VideoPlaybackProvider. Ensure your component is wrapped in <VideoPlaybackProvider>.');
  }
  return context;
}; 