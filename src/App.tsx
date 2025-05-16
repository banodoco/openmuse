import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react';
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
import RoleSwitcher from './components/common/RoleSwitcher';

const HomePage = lazy(() => import('./pages/Index'));
const UploadPage = lazy(() => import('./pages/upload/UploadPage'));
const AdminPage = lazy(() => import('./pages/Admin'));
const AuthPage = lazy(() => import('./pages/Auth'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const ManifestoPage = lazy(() => import('./pages/Manifesto'));
const LorasPage = lazy(() => import('./pages/LorasPage'));
const ArtPage = lazy(() => import('./pages/ArtPage'));
const GenerationsPage = lazy(() => import('./pages/GenerationsPage'));
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'));

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
      document.addEventListener('touchstart', unlockAutoplay, { passive: true });
      console.log('Persistent global autoplay unlock listener added for mobile (fires on every touchstart).');

      // No cleanup removal – we want it to persist for the lifetime of the SPA
      return () => {
        // Do nothing – keep listener.
      };
    }
  }, []);

  // Global Animation Restart on Page Show for Mobile
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
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

  return (
    <HelmetProvider>
      <ErrorBoundary 
        fallback={<div className="p-4 text-red-500">An unexpected error occurred. Please try refreshing the page.</div>}
      >
        <TooltipProvider>
          <AuthProvider>
            <LoraProvider>
              <div id="app-container" className="min-h-screen bg-gradient-to-br from-[#FEFDF4] via-[#FEFDF4] to-[#C3C6AD]">
                <Router>
                  <Suspense fallback={<LoadingState />}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/auth" element={<AuthPage />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/manifesto" element={<ManifestoPage />} />
                      <Route path="/assets/loras/:id" element={<AssetDetailPage />} />
                      <Route path="/assets/workflows/:id" element={<AssetDetailPage />} />
                      <Route path="/loras" element={<LorasPage />} />
                      <Route path="/workflows" element={<WorkflowsPage />} />
                      <Route path="/art" element={<ArtPage />} />
                      <Route path="/generations" element={<GenerationsPage />} />
                      <Route path="/profile/:username" element={
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
                  <RoleSwitcher />
                </Router>
              </div>
            </LoraProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
};

export default App;
