import React, { useState, useRef, useEffect } from 'react';
import Navigation, { Footer } from '@/components/Navigation';

const ManifestoPage: React.FC = () => {
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reverseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to start reverse playback at ~0.7x speed using setInterval
  const startReversePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    // Clear any existing interval first
    if (reverseIntervalRef.current) {
      clearInterval(reverseIntervalRef.current);
      reverseIntervalRef.current = null;
    }

    // Approximate 0.7x reverse speed – 0.07 s every 100 ms ⇒ 0.7 s / real‑second
    reverseIntervalRef.current = setInterval(() => {
      if (!video) return;

      if (video.currentTime <= 0) {
        // Reached the beginning – stop reverse playback
        clearInterval(reverseIntervalRef.current as NodeJS.Timeout);
        reverseIntervalRef.current = null;
        video.pause();
        video.currentTime = 0;
        return;
      }

      // Step backwards
      video.currentTime = Math.max(0, video.currentTime - 0.07);
    }, 100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reverseIntervalRef.current) {
        clearInterval(reverseIntervalRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);

    // Stop any ongoing reverse playback
    if (reverseIntervalRef.current) {
      clearInterval(reverseIntervalRef.current);
      reverseIntervalRef.current = null;
    }

    if (videoRef.current) {
      // Play forward at 0.7× speed
      videoRef.current.playbackRate = 0.7;
      videoRef.current.play().catch(error => {
        // Autoplay might be blocked, handle error silently or log
        console.error("Video play failed:", error);
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);

    if (videoRef.current) {
      // Pause forward playback before starting reverse
      videoRef.current.pause();
    }

    // Begin reverse playback at the same speed (0.7×)
    startReversePlayback();
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">

          <div className="prose max-w-3xl mx-auto py-8">
            <h2 className="text-3xl font-bold mb-6 text-left">Let's Build a Beautiful Home for Open-Source AI Art</h2>

            <p className="text-lg leading-relaxed mb-4">
              Imagine a place where you can discover the most inspired, creative, and thoughtful AI art and technology - curated by trusted voices from within the community.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              Imagine a destination that informs, inspires, and empowers you every single visit.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              Imagine a platform that you can confidently share with a skeptical friend to help them understand the beauty you see in AI art.
            </p>

            <p className="text-lg leading-relaxed font-semibold mb-4">
              This is why we're building OpenMuse.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              We aim to cultivate a home for open-source AI art that showcases the creativity, talent, and innovation within our ecosystem.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              It's built as an extension of the <a href="https://banodoco.ai" target="_blank" rel="noopener noreferrer" className="!underline">Banodoco</a> community - aiming extend its vibrant and utopian ethos to the wider world.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              By combining radical openness with thoughtful curation, OpenMuse aims to become the definitive destination for artists, engineers, dreamers, and curious newcomers alike.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              We believe the future of AI art shouldn't be dictated by hype, fleeting trends, or closed platforms - it should be driven by art and the tools and technology that enable it.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              To start, OpenMuse will just focus on Videos LoRAs and art created with them - but this is just the beginning.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              With your help, we can grow into a place we're proud of—a platform that genuinely elevates the potential of the ecosystem.
            </p>

            <p className="text-lg leading-relaxed mb-4">
              Join us: train LoRAs, create art, share your work, and inspire others.
            </p>

            <p className="text-lg leading-relaxed font-semibold mb-4">
              Together, we can create something beautiful!
            </p>
          </div>

          <div
            className="max-w-3xl mx-auto pb-8 flex justify-center items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="relative w-full max-w-3xl aspect-video overflow-hidden rounded-lg">
              <img
                src="/first_frame.png"
                alt="First frame of the creation video"
                className={`absolute top-0 left-0 w-full h-full object-contain`}
              />
              <video
                ref={videoRef}
                src="/the_creation.mp4"
                muted
                playsInline
                preload="metadata"
                className={`absolute top-0 left-0 w-full h-full object-contain transition-opacity duration-300 ease-in-out ${isHovering ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
