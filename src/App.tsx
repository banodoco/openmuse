
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LoadingState from '@/components/LoadingState';
import { AuthProvider } from '@/providers/AuthProvider';

// Fix imports to use correct paths
const HomePage = lazy(() => import('./pages/Index'));
const UploadPage = lazy(() => import('./pages/upload/UploadPage'));
const AdminPage = lazy(() => import('./pages/Admin'));
const AuthPage = lazy(() => import('./pages/Auth'));
const VideoPage = lazy(() => import('./pages/VideoPage'));
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'));

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/videos/:id" element={<VideoPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            {/* Add the new route format for LoRA assets */}
            <Route path="/assets/loras/:id" element={<AssetDetailPage />} />
          </Routes>
        </Suspense>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;
