import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LoadingState from '@/components/LoadingState';
import { AuthProvider } from '@/providers/AuthProvider';
import AuthCallback from '@/pages/AuthCallback';
import RequireAuth from '@/components/RequireAuth';
import AssetDetailPage from './pages/AssetDetailPage';
import ErrorBoundary from './components/ErrorBoundary';
import { LoraProvider } from './contexts/LoraContext';
import { HelmetProvider } from 'react-helmet-async';
import { TooltipProvider } from '@/components/ui/tooltip';

const HomePage = lazy(() => import('./pages/Index'));
const UploadPage = lazy(() => import('./pages/upload/UploadPage'));
const AdminPage = lazy(() => import('./pages/Admin'));
const AuthPage = lazy(() => import('./pages/Auth'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const ManifestoPage = lazy(() => import('./pages/Manifesto'));
const LorasPage = lazy(() => import('./pages/LorasPage'));
const ArtPage = lazy(() => import('./pages/ArtPage'));
const GenerationsPage = lazy(() => import('./pages/GenerationsPage'));

const App: React.FC = () => {
  // Global Autoplay Unlock for Mobile
  useEffect(() => {
    const unlockAutoplay = () => {
      document.querySelectorAll('video').forEach(video => {
        if (video.paused) { // Only try to play if paused
          video.play().catch(err => {
            // Log errors but don't spam the console if it's the known interaction error
            if (err.name !== 'NotAllowedError') {
              console.error('Failed to unlock video autoplay:', err);
            }
          });
        }
      });
      // Listener is { once: true }, so it removes itself
      console.log('Global touchstart detected, attempted to unlock video autoplay.');
    };

    // Check if we're on a mobile device before adding the listener
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      document.addEventListener('touchstart', unlockAutoplay, { once: true, passive: true });
      console.log('Global autoplay unlock listener added for mobile.');

      // Cleanup function to remove listener if component unmounts before interaction
      return () => {
        document.removeEventListener('touchstart', unlockAutoplay);
        console.log('Global autoplay unlock listener removed.');
      };
    }
  }, []);

  // Global Animation Restart on Page Show for Mobile
  useEffect(() => {
    const handlePageShow = (event) => {
      console.log('pageshow event detected. Persisted:', event.persisted);
      if (event.persisted) {
        console.log('Page restored from bfcache, refreshing to restart videos and animations.');
        window.location.reload();
      } else {
        // If not from bfcache, just restart animations
        const container = document.getElementById('app-container');
        if (container) {
          container.classList.remove('restart-animations');
          // Force reflow
          void container.offsetWidth;
          container.classList.add('restart-animations');
        }
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Global Refresh Toast on Window Focus when videos remain paused or stuck
  const [showRefreshToast, setShowRefreshToast] = useState(false);
  useEffect(() => {
    const handleFocus = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log('[handleFocus] isMobile:', isMobile, 'userAgent:', navigator.userAgent); // DEBUG LOG
      const videos = document.querySelectorAll('video');
      const allStuck = videos.length > 0 && Array.from(videos).every(video => video.paused || video.readyState < 3);
      console.log('[handleFocus] allStuck:', allStuck); // DEBUG LOG
      if (isMobile && allStuck) {
        console.log('All videos are stuck on focus on mobile; showing refresh toast.');
        setShowRefreshToast(true);
      } else {
        // Only log if we are actively setting it to false when it was true
        // if (showRefreshToast) console.log('[handleFocus] Hiding toast. Reason: isMobile=', isMobile, 'allStuck=', allStuck);
        setShowRefreshToast(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Periodic check if videos remain stuck (fallback)
  useEffect(() => {
    const checkVideosStuck = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log('[checkVideosStuck] isMobile:', isMobile, 'userAgent:', navigator.userAgent); // DEBUG LOG
      const videos = document.querySelectorAll('video');
      const allStuck = videos.length > 0 && Array.from(videos).every(video => video.paused || video.readyState < 3);
      console.log('[checkVideosStuck] allStuck:', allStuck); // DEBUG LOG
      if (isMobile && allStuck) {
        console.log('Periodic check: all videos remain stuck on mobile, showing refresh toast.');
        setShowRefreshToast(true);
      } else {
        // Only log if we are actively setting it to false when it was true
        // if (showRefreshToast) console.log('[checkVideosStuck] Hiding toast. Reason: isMobile=', isMobile, 'allStuck=', allStuck);
        setShowRefreshToast(false);
      }
    };
    const intervalId = setInterval(checkVideosStuck, 10000); // check every 10 seconds
    return () => clearInterval(intervalId);
  }, []);

  const refreshStuckVideos = () => {
    document.querySelectorAll('video').forEach(video => {
      if (video.paused || video.readyState < 3) {
        video.pause();
        video.load();
        video.play().catch(err => console.error('Error refreshing video playback:', err));
      }
    });
    console.log('Refreshed stuck videos');
  };

  return (
    <HelmetProvider>
      <ErrorBoundary 
        fallback={<div className="p-4 text-red-500">An unexpected error occurred. Please try refreshing the page.</div>}
      >
        <TooltipProvider>
          <AuthProvider>
            <LoraProvider>
              <Router>
                <Suspense fallback={<LoadingState />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/manifesto" element={<ManifestoPage />} />
                    <Route path="/assets/:id" element={<AssetDetailPage />} />
                    <Route path="/assets/loras/:id" element={<AssetDetailPage />} />
                    <Route path="/loras" element={<LorasPage />} />
                    <Route path="/art" element={<ArtPage />} />
                    <Route path="/generations" element={<GenerationsPage />} />
                    <Route path="/profile/:displayName" element={
                      <ErrorBoundary fallback={<p>Error loading profile page.</p>}>
                        <UserProfilePage />
                      </ErrorBoundary>
                    } />
                    <Route path="/upload" element={<UploadPage />} />

                    <Route 
                      path="/admin"
                      element={
                        <RequireAuth requireAdmin={true}>
                          <AdminPage />
                        </RequireAuth>
                      }
                    />
                  </Routes>
                </Suspense>
              </Router>
            </LoraProvider>
          </AuthProvider>
          <Toaster />
          {showRefreshToast && (
            <div className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white px-4 py-2 rounded shadow-lg cursor-pointer"
                 onClick={refreshStuckVideos}>
              Refresh to fix animations
            </div>
          )}
        </TooltipProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
};

export default App;
