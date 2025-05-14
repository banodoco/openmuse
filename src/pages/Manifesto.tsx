import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';
import SproutingCursorCanvas, { SproutingCanvasHandle } from '@/components/SproutingCursorCanvas';
import { cn } from '@/lib/utils';

const ManifestoPage: React.FC = () => {
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const reverseAnimationIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const lockAtEndRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const sproutingCanvasRef = useRef<SproutingCanvasHandle>(null);
  const [isEmojiVisible, setIsEmojiVisible] = useState(true);

  // Apply fade-in effect to the prose and video container
  useFadeInOnScroll(proseRef);
  useFadeInOnScroll(containerRef);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (reverseAnimationIdRef.current) {
        cancelAnimationFrame(reverseAnimationIdRef.current);
      }
    };
  }, []);

  // Reverse playback using requestAnimationFrame
  const reverseStep = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const step = (1 / 60); // Target ~60fps reverse (adjust as needed)
    const newTime = video.currentTime - step;

    if (newTime <= 0) {
      video.currentTime = 0;
      if (reverseAnimationIdRef.current) {
        cancelAnimationFrame(reverseAnimationIdRef.current);
        reverseAnimationIdRef.current = null;
      }
      video.pause(); // Ensure paused at the start
    } else {
      video.currentTime = newTime;
      reverseAnimationIdRef.current = requestAnimationFrame(reverseStep);
    }
  }, []); // No dependencies needed as it uses refs

  // Start reverse playback
  const startReversePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.currentTime <= 0) return; // Don't start if already at 0

    // Cancel any existing reverse frame first
    if (reverseAnimationIdRef.current) {
      cancelAnimationFrame(reverseAnimationIdRef.current);
    }
    // Pause video if playing forward before reversing
    if (!video.paused) {
        video.pause();
    }

    reverseAnimationIdRef.current = requestAnimationFrame(reverseStep);
  }, [reverseStep]);

  // Mouse Enter Handler
  const handleMouseEnter = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Stop any ongoing reverse playback
    if (reverseAnimationIdRef.current) {
      cancelAnimationFrame(reverseAnimationIdRef.current);
      reverseAnimationIdRef.current = null;
    }

    // Play forward only if it's currently paused and not ended
    if (video.paused && !video.ended) {
      // Using 1x playback speed as per the example provided
      video.playbackRate = 0.75;
      video.play().catch(error => {
        console.error("Video play failed on hover:", error);
      });
    }
  }, []);

  // Mouse Leave Handler
  const handleMouseLeave = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Pause immediately on leave before starting reverse
    if (!video.paused) {
      video.pause();
    }

    // Start reverse playback if not already at the beginning
    if (video.currentTime > 0 && !reverseAnimationIdRef.current) {
      startReversePlayback();
    }
  }, [startReversePlayback]);

  // Click/Tap Handler (now primarily for Desktop)
  const handleClick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Stop reverse if active
    if (reverseAnimationIdRef.current) {
      cancelAnimationFrame(reverseAnimationIdRef.current);
      reverseAnimationIdRef.current = null;
    }

    // Toggle play/pause
    if (video.paused) {
      // On desktop click, ensure poster is removed if needed (though hover usually handles it)
      // video.removeAttribute('poster'); // Probably not needed with hover logic
      video.playbackRate = 0.75; // Ensure 50% speed on click play
      video.play().catch(e => console.error('Error playing video on click:', e));
    } else {
      video.pause();
    }
  }, []); // Removed isMobile dependency

  // Handle clicking the emoji in the title
  const handleEmojiClick = useCallback((event: React.MouseEvent) => {
    if (sproutingCanvasRef.current) {
      sproutingCanvasRef.current.createBurst(event.clientX, event.clientY);
      sproutingCanvasRef.current.activateCursorFollowing();
    }
    setIsEmojiVisible(false);
  }, []);

  // Handle video ending naturally (while playing forward)
  const handleVideoEnded = useCallback(() => {
    const video = videoRef.current;
    // We don't need to do much here, as mouseleave or click handles pausing.
    // If the mouse is still hovering when it ends, it should ideally stay on the last frame.
    // If we want it to rewind automatically on end even if hovering, we'd add logic here.
    // console.log('Video ended while playing forward.');
    if (video) {
        // Optional: rewind to beginning if desired when naturally ended
        // video.currentTime = 0;
    }
  }, []);

  // Effect to add/remove listeners and observer
  useEffect(() => {
    const node = containerRef.current;
    const videoNode = videoRef.current;
    // Ensure elements exist before proceeding
    if (!node || !videoNode) return;

    if (!isMobile) {
      // --- Desktop Setup --- 
      node.addEventListener('mouseenter', handleMouseEnter);
      node.addEventListener('mouseleave', handleMouseLeave);
      node.addEventListener('click', handleClick);
      videoNode.addEventListener('ended', handleVideoEnded);
    } else {
      // --- Mobile Setup --- ensure video is paused; scroll handler will update currentTime
      videoNode.pause();
    }

    // Cleanup listeners
    return () => {
      // --- Desktop Cleanup --- 
      if (!isMobile && node) { // Check node exists for cleanup
        node.removeEventListener('mouseenter', handleMouseEnter);
        node.removeEventListener('mouseleave', handleMouseLeave);
        node.removeEventListener('click', handleClick);
      }

      // --- Common Cleanup --- 
      if (videoNode) { // Check videoNode exists for cleanup
        videoNode.removeEventListener('ended', handleVideoEnded);
      }

      if (reverseAnimationIdRef.current) {
        cancelAnimationFrame(reverseAnimationIdRef.current);
        reverseAnimationIdRef.current = null; // Clear the ref
      }
    };
  }, [isMobile, handleMouseEnter, handleMouseLeave, handleClick, handleVideoEnded, startReversePlayback]);

  /* -----------------------------------------------------------
     Scroll-driven video scrubbing on mobile devices
  -----------------------------------------------------------*/
  useEffect(() => {
    if (!isMobile) return;

    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    // Ensure video is paused initially (placeholder remains via poster attribute)
    video.pause();

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.target === container) {
          if (entry.intersectionRatio >= 0.5) {
            if (video.paused) {
              video.playbackRate = 0.5;
              video.play().catch(() => {});
            }
          } else {
            if (!video.paused) {
              video.pause();
            }
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: [0.5]
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [isMobile]);

  /* -----------------------------------------------------------
     Scroll-driven video auto-play on desktop devices using overlay approach
  -----------------------------------------------------------*/
  useEffect(() => {
    if (isMobile) return;

    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    // Ensure the video is paused and overlay is visible initially
    video.pause();
    setOverlayVisible(true);

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.target === container) {
          if (entry.intersectionRatio >= 0.6) {
            if (video.paused) {
              video.playbackRate = 0.75;
              video.play().catch(() => {});
            }
          } else {
            if (!video.paused) {
              video.pause();
              setOverlayVisible(true);
            }
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: [0.6]
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [isMobile]);

  return (
    <>
      <style>
        {`
          @keyframes provocativeWiggle {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(8deg); }
            75% { transform: rotate(-8deg); }
          }

          .sapling-emoji-interactive {
            animation: provocativeWiggle 0.8s ease-in-out infinite;
            display: inline-block; /* Ensures transform origin is respected */
            transition: opacity 0.5s ease-out; /* Added for fade-out */
          }

          /* Remove animation when not hovering if combined with fade out */
          .sapling-emoji-interactive:not(:hover) {
            animation: none;
          }

          .emoji-fade-out {
            opacity: 0;
            pointer-events: none; /* Prevent interactions after fade */
          }
        `}
      </style>
      <div className="flex flex-col min-h-screen">
        <div className="z-10 bg-[#FEFDF4]/30 backdrop-blur-sm">
          <Navigation />
        </div>
        <SproutingCursorCanvas ref={sproutingCanvasRef} />
        
        <div className="flex-1 w-full">
          <div className="max-w-screen-2xl mx-auto p-4">

            <div 
              ref={proseRef} 
              className={cn(
                "prose max-w-3xl mx-auto py-8",
                "bg-[#FEFDF4]/30 p-6 rounded-lg",
                "prose-feathered-backdrop"
              )}
            >
              <h2 className="text-3xl font-bold mb-6 text-left">
                Let's Build a Beautiful Home for Open-Source AI Art
                <span 
                  onClick={handleEmojiClick} 
                  style={{ cursor: 'pointer', marginLeft: '0.25em' }} 
                  className={cn(
                    "sapling-emoji-interactive",
                    !isEmojiVisible && "emoji-fade-out"
                  )}
                  role="button" 
                  aria-label="Trigger animation">
                  🌱
                </span>
              </h2>

              <p className="text-lg leading-relaxed mb-4">
                With OpenMuse, we aim to cultivate a home for open-source AI art that showcases the creativity and excellence within our ecosystem.
              </p>

              <p className="text-lg leading-relaxed mb-4">
                Thanks to curation by trusted community members, we believe that it can become a place that informs, inspires, and empowers people within and outside this ecosystem - somewhere you'd be proud to share with an AI-skeptic friend.
              </p>

              <p className="text-lg leading-relaxed mb-4">
                It's built as an extension of the <a href="https://banodoco.ai" target="_blank" rel="noopener noreferrer" className="!underline">Banodoco</a> community - aiming to spread its vibrant ethos to the wider world.
              </p>

              <p className="text-lg leading-relaxed mb-4">
                We believe that AI art shouldn't be dictated by fleeting hype and closed platforms - it should be driven by an open, constantly evolving interplay between art and the tools that enable it.
              </p>

              <p className="text-lg leading-relaxed mb-4">
                To start, OpenMuse will focus only on Videos LoRAs and art created with them - but this is just the beginning.
              </p>

              <p className="text-lg leading-relaxed mb-4">
                With your help, we can grow into a place we're all proud of: a platform that genuinely elevates the potential of the ecosystem.
              </p>

              <p className="text-lg leading-relaxed mb-4">
                To make this happen, we need your help. If you'd like to support this effort, please consider training LoRAs or creating art with them, and sharing your work here to inspire and empower others.
              </p>

              <p className="text-lg leading-relaxed font-semibold mb-4">
                Together, we can create something beautiful!
              </p>

              <p className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                Note: We will share <a href="https://banodoco.ai/pages/ownership.html" target="_blank" rel="noopener noreferrer" className="!underline">100% of the ownership</a> in our company with people who help us with this and <a href="https://banodoco.ai" target="_blank" rel="noopener noreferrer" className="!underline">our broader efforts</a>.
              </p>
            </div>

            {/* Commenting out the video section
            <div
              ref={containerRef}
              className="max-w-3xl mx-auto pb-8 flex justify-center items-center"
            >
              <div className="relative w-full max-w-3xl aspect-video overflow-hidden rounded-lg">
                <video
                  ref={videoRef}
                  src="/the_creation.mp4"
                  muted
                  playsInline
                  preload="auto"
                  onPlay={() => setOverlayVisible(false)}
                  className="absolute top-0 left-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "url('/first_frame.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transition: 'opacity 0.5s ease',
                    opacity: overlayVisible ? 1 : 0
                  }}
                />
              </div>
            </div>
            */}
          </div>
        </div>
        
        <Footer />
      </div>
    </>
  );
};

export default ManifestoPage;
