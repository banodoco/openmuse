import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LoadingState from '@/components/LoadingState';
import { AuthProvider } from '@/providers/AuthProvider';
import AuthCallback from '@/pages/AuthCallback';
import RequireAuth from '@/components/RequireAuth';

// Fix imports to use correct paths
const HomePage = lazy(() => import('./pages/Index'));
const UploadPage = lazy(() => import('./pages/upload/UploadPage'));
const AdminPage = lazy(() => import('./pages/Admin'));
const AuthPage = lazy(() => import('./pages/Auth'));
const VideoPage = lazy(() => import('./pages/VideoPage'));
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function App() {
  return (
    // Ensure that AuthProvider is outside of the Router
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* LoRA asset view is public */}
            <Route path="/assets/loras/:id" element={<AssetDetailPage />} />

            {/* Protected Routes */}
            <Route 
              path="/"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route 
              path="/upload"
              element={
                <RequireAuth>
                  <UploadPage />
                </RequireAuth>
              }
            />
            <Route 
              path="/admin"
              element={
                <RequireAuth requireAdmin={true}>
                  <AdminPage />
                </RequireAuth>
              }
            />
            <Route 
              path="/videos/:id"
              element={
                <RequireAuth>
                  <VideoPage />
                </RequireAuth>
              }
            />
            <Route 
              path="/assets/:id"
              element={
                <RequireAuth>
                  <AssetDetailPage />
                </RequireAuth>
              }
            />
            <Route 
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;
