
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
import AuthProvider from '@/components/AuthProvider';
import { useEffect, useState } from 'react';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { videoDB } from '@/lib/database';
import { getCurrentUser } from '@/lib/auth';

function App() {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Set up database user ID
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        const user = await getCurrentUser();
        const db = await databaseSwitcher.getDatabase();
        db.setCurrentUserId(user?.id || null);
        
        // Also set it on the facade
        await videoDB.setCurrentUserId(user?.id || null);
      } catch (error) {
        console.error("Error setting up database user ID:", error);
      }
    };
    
    setupDatabase();
  }, []);
  
  return (
    <Router>
      <AuthProvider onAuthStateChange={setIsAuthLoading}>
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
              <VideoPage />
            </RequireAuth>
          } />
          <Route path="/upload" element={
            <UploadPage />
          } />
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
