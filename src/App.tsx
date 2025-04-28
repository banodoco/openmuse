import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LoadingState from '@/components/LoadingState';
import { AuthProvider } from '@/providers/AuthProvider';
import AuthCallback from '@/pages/AuthCallback';
import RequireAuth from '@/components/RequireAuth';
import AssetDetailPage from './pages/AssetDetailPage';
import ErrorBoundary from './components/ErrorBoundary';

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
    const handlePageShow = () => {
      console.log('pageshow event detected, restarting animations');
      const container = document.getElementById('app-container');
      if (container) {
        container.classList.remove('restart-animations');
        // Force reflow
        void container.offsetWidth;
        container.classList.add('restart-animations');
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  return (
    <AuthProvider>
      <div id="app-container" className="min-h-screen bg-gradient-to-br from-[#FEFDF4] via-[#FEFDF4] to-[#C3C6AD]">
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
          <Toaster />
        </Router>
      </div>
    </AuthProvider>
  );
};

export default App;
