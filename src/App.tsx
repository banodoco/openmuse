import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LoadingState from '@/components/LoadingState';

const HomePage = lazy(() => import('./pages/HomePage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const VideoPage = lazy(() => import('./pages/VideoPage'));
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'));

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/videos/:id" element={<VideoPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
        </Routes>
      </Suspense>
      <Toaster />
    </Router>
  );
}

export default App;
