
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';
import RequireAuth from '@/components/RequireAuth';
import Admin from '@/pages/Admin';
import VideoPage from '@/pages/VideoPage';
import Auth from '@/pages/Auth';
import AuthCallback from '@/pages/AuthCallback';
import { Toaster } from 'sonner';
import UploadPage from '@/pages/upload';
import { useEffect } from 'react';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { videoDB } from '@/lib/database';
import { getCurrentUser } from '@/lib/auth';
import AssetDetailPage from '@/pages/AssetDetailPage';
import { AuthProvider } from '@/hooks/useAuth'; // Use the unified AuthProvider

function App() {
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        const user = await getCurrentUser();
        const db = await databaseSwitcher.getDatabase();
        db.setCurrentUserId(user?.id || null);
        
        await videoDB.setCurrentUserId(user?.id || null);
      } catch (error) {
        console.error("Error setting up database user ID:", error);
      }
    };
    
    setupDatabase();
  }, []);
  
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={
            <RequireAuth allowUnauthenticated={true}>
              <Index />
            </RequireAuth>
          } />
          <Route path="/admin/*" element={
            <RequireAuth requireAdmin={true}>
              <Admin />
            </RequireAuth>
          } />
          <Route path="/assets/loras/:id" element={
            <RequireAuth allowUnauthenticated={true}>
              <AssetDetailPage />
            </RequireAuth>
          } />
          <Route path="/videos/:id" element={
            <RequireAuth allowUnauthenticated={true}>
              <VideoPage />
            </RequireAuth>
          } />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
      <Toaster richColors position="top-center" />
    </Router>
  );
}

export default App;
