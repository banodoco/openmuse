import React from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import UploadContent from '@/components/upload/UploadContent';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleUploadSuccess = () => {
    navigate('/');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <main className="flex-1 container mx-auto p-4">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Add Content</h1>
        <p className="text-muted-foreground mb-8">
          Submit a LoRA or standalone video to be featured.
        </p>
        
        {!user && (
          <Alert className="mb-8 border border-olive/20 bg-cream-light text-foreground font-body">
            <AlertTitle className="font-heading font-medium">You must be signed in to submit.</AlertTitle>
            <AlertDescription className="mt-1 font-body">
              Please <Link to="/auth" className="font-medium text-olive hover:text-olive-dark underline">sign in</Link> to access all features.
            </AlertDescription>
          </Alert>
        )}
        
        <UploadContent 
          onSuccess={handleUploadSuccess} 
        />

      </main>
      
      <Footer />
    </div>
  );
};

export default UploadPage;
