
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Upload from "./pages/upload";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import VideoPage from "./pages/VideoPage";
import { useEffect } from "react";
import { migrateExistingVideos } from "./lib/migrationUtil";
import RequireAuth from "./components/RequireAuth";

// Initialize the query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

const App = () => {
  useEffect(() => {
    // Run migration for existing videos on app load
    migrateExistingVideos().catch(error => {
      console.error('Error during video migration:', error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={
              <RequireAuth allowUnauthenticated>
                <Index />
              </RequireAuth>
            } />
            <Route path="/upload" element={<Upload />} />
            <Route path="/admin" element={
              <RequireAuth requireAdmin>
                <Admin />
              </RequireAuth>
            } />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/assets/loras/:id" element={<VideoPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
