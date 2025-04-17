
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LoraAsset } from '@/lib/types';
import { useNavigate, useLocation } from 'react-router-dom';
import { Logger } from '@/lib/logger';

const logger = new Logger('AssetHeader');

interface AssetHeaderProps {
  asset: LoraAsset | null;
}

const AssetHeader: React.FC<AssetHeaderProps> = ({ asset }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleGoBack = () => {
    // Log the location state to debug
    logger.log('Location state:', location.state);
    
    // Check if there's source information in the location state
    const { state } = location;
    
    if (state && state.from === 'profile') {
      // If coming from a profile page, navigate back to that profile
      logger.log('Navigating to profile with display name:', state.displayName);
      if (state.displayName) {
        navigate(`/profile/${state.displayName}`);
      } else {
        // If no display name, go to the user's own profile
        navigate('/profile');
      }
    } else {
      // Default behavior: go back to previous page in history
      logger.log('Navigating back in history');
      navigate(-1);
    }
  };

  return (
    <div className="mb-6 flex items-center">
      <Button 
        variant="outline" 
        onClick={handleGoBack}
        className="mr-4 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <h1 className="text-3xl font-bold">{asset?.name}</h1>
    </div>
  );
};

export default AssetHeader;
