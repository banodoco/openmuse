import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';

const ManifestoPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reverseAnimationIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const lockAtEndRef = useRef(false);
  const lastScrollYRef = useRef(0);

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
    setIsHovering(true); // Keep state for potential styling
    const video = videoRef.current;
    if (!video) return;

    // Stop any ongoing reverse playback
    if (reverseAnimationIdRef.current) {
      cancelAnimationFrame(reverseAnimationIdRef.current);
      reverseAnimationIdRef.current = null;
    }

    // Play forward only if it's currently paused
    if (video.paused) {
      // Using 1x playback speed as per the example provided
      video.playbackRate = 1;
      video.play().catch(error => {
        console.error("Video play failed on hover:", error);
      });
    }
  }, []);

  // Mouse Leave Handler
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  }, []);

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
      video.playbackRate = 1; // Ensure normal speed on click play
      video.play().catch(e => console.error('Error playing video on click:', e));
    } else {
      video.pause();
    }
  }, []); // Removed isMobile dependency

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

    // Remove poster on mobile and ensure video is paused
    video.removeAttribute('poster');
    video.pause();

    // Initialize lastScrollYRef with current scroll position
    lastScrollYRef.current = window.scrollY || window.pageYOffset;

    // Updated: use delta-based scrubbing to update video time based on actual scroll direction
    const updateTimeBasedOnScroll = () => {
      if (!video.duration) return;
      const currentScrollY = window.scrollY || window.pageYOffset;
      // Only update if scrolled further down than ever before
      if (currentScrollY <= lastScrollYRef.current) {
        return;
      }
      const deltaY = currentScrollY - lastScrollYRef.current;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollEndThreshold = docHeight - viewportHeight;

      if ((scrollEndThreshold - currentScrollY) <= 10) {
        video.currentTime = video.duration;
        lastScrollYRef.current = currentScrollY;
        return;
      } else if (currentScrollY + viewportHeight >= docHeight - 50) {
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const rect = container.getBoundingClientRect();
      const containerTopOffset = rect.top + currentScrollY;
      const scrollStartThreshold = containerTopOffset - viewportHeight;
      const effectiveScrollRange = scrollEndThreshold - scrollStartThreshold;
      const animationStartOffset = 100;
      // Avoid division by zero
      const scrubRange = effectiveScrollRange > animationStartOffset ? (effectiveScrollRange - animationStartOffset) : 1;
      const factor = video.duration / scrubRange;

      let newVideoTime = video.currentTime + deltaY * factor;
      newVideoTime = Math.min(newVideoTime, video.duration);

      if (Math.abs(video.currentTime - newVideoTime) > 0.01) {
        video.currentTime = newVideoTime;
        video.play().then(() => setTimeout(() => video.pause(), 20)).catch(() => {});
      }

      lastScrollYRef.current = currentScrollY;
    };

    // The handleMetadata function remains unchanged for initial sync
    const handleMetadata = () => {
      const currentScrollY = window.scrollY || window.pageYOffset;
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollEndThreshold = docHeight - viewportHeight;
      // If near the bottom (within 10px) then force video to its end
      if ((scrollEndThreshold - currentScrollY) <= 10) {
        video.currentTime = video.duration;
        lastScrollYRef.current = currentScrollY;
        return;
      }
      const containerTopOffset = rect.top + currentScrollY;
      const scrollStartThreshold = containerTopOffset - viewportHeight;
      const effectiveScrollRange = scrollEndThreshold - scrollStartThreshold;
      const animationStartOffset = 100;
      const effectiveScrollStart = scrollStartThreshold + animationStartOffset;
      let progress = 0;
      if (currentScrollY <= effectiveScrollStart) {
        progress = 0;
      } else if (effectiveScrollRange > animationStartOffset) {
        progress = Math.min(Math.max((currentScrollY - effectiveScrollStart) / (effectiveScrollRange - animationStartOffset), 0), 1);
      } else {
        progress = 1;
      }
      video.currentTime = progress * video.duration;
      video.play().then(() => setTimeout(() => video.pause(), 20)).catch(() => {});
      lastScrollYRef.current = currentScrollY;
    };

    video.addEventListener('loadedmetadata', handleMetadata);
    if (video.readyState >= 1) {
      handleMetadata();
    }
    
    window.addEventListener('scroll', updateTimeBasedOnScroll, { passive: true });
    window.addEventListener('resize', updateTimeBasedOnScroll);

    return () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
      window.removeEventListener('scroll', updateTimeBasedOnScroll);
      window.removeEventListener('resize', updateTimeBasedOnScroll);
    };
  }, [isMobile]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">

          <div ref={proseRef} className="prose max-w-3xl mx-auto py-8">
            <h2 className="text-3xl font-bold mb-6 text-left">Let's Build a Beautiful Home for Open-Source AI Art</h2>

            <p className="text-lg leading-relaxed mb-4">
              Imagine a place where you can discover the most inspired and thoughtful AI art and technology - curated by trusted voices from within the community.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              Imagine a platform that informs, inspires, and empowers you every time you visit.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              Imagine a destination that you can confidently share with a skeptical friend to help them understand the beauty you see in AI art.
            </p>

            <p className="text-lg leading-relaxed font-semibold mb-4">
              This is why we're building OpenMuse.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              We aim to cultivate a home for open-source AI art that showcases the creativity, talent, and innovation within our ecosystem.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              It's built as an extension of the <a href="https://banodoco.ai" target="_blank" rel="noopener noreferrer" className="!underline">Banodoco</a> community - aiming spread its vibrant and utopian ethos to the wider world.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              By combining radical openness with thoughtful curation, OpenMuse aims to become the definitive destination for artists, engineers, and curious newcomers alike.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              We believe that the future of AI art shouldn't be dictated by hype, fleeting trends, or closed platforms - it should be driven by an open, constantly evolving interplay between art and the tools that enable it.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              To start, OpenMuse will focus only on Videos LoRAs and art created with them - but this is just the beginning.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              With your help, we can grow into a place we're all proud of — a platform that genuinely elevates the potential of the ecosystem.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              But to make this happen, we need your help. If you'd like to support this effort, please consider training LoRAs or creating art with them, and sharing your work here to inspire and empower others. 
            </p>

            <p className="text-lg leading-relaxed font-semibold mb-4">
              Together, we can create something beautiful!
            </p>
            
            <p className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
              Note: We will share <a href="https://banodoco.ai/pages/ownership.html" target="_blank" rel="noopener noreferrer" className="!underline">100% of the ownership</a> in our company with people who help us with this and <a href="https://banodoco.ai" target="_blank" rel="noopener noreferrer" className="!underline">our broader efforts</a>.              
            </p>
          </div>

          <div
            ref={containerRef}
            className="max-w-3xl mx-auto pb-8 flex justify-center items-center cursor-pointer"
          >
            <div className="relative w-full max-w-3xl aspect-video overflow-hidden rounded-lg">
              <video
                ref={videoRef}
                src="/the_creation.mp4"
                muted
                playsInline
                preload="auto"
                poster={!isMobile ? "/first_frame.png" : undefined}
                className="absolute top-0 left-0 w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default ManifestoPage;
