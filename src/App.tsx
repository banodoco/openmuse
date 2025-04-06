
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Index from './pages/Index';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import VideoPage from './pages/VideoPage';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import AssetDetailPage from './pages/AssetDetailPage';
import UploadPage from './pages/upload/UploadPage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider } from './providers/AuthProvider';
import { Toaster } from './components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { addLoraBaseModelColumn } from './lib/addLoraBaseModelColumn';
import { Logger } from './lib/logger';

const logger = new Logger('App');

function App() {
  useEffect(() => {
    // Check and add the lora_base_model column if needed
    const initializeApp = async () => {
      try {
        const result = await addLoraBaseModelColumn();
        logger.log(`Database column check completed: ${result ? 'Success' : 'Failed'}`);
      } catch (error) {
        logger.error('Error during app initialization:', error);
      }
    };
    
    initializeApp();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="/asset/:id" element={<AssetDetailPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
        <SonnerToaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
