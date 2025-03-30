
import { useState, useEffect } from 'react';
import { VideoEntry } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';

const logger = new Logger('useVideoCreator');

export const useVideoCreator = (video: VideoEntry) => {
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (video.user_id) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', video.user_id)
            .maybeSingle();
            
          if (profile && !error) {
            setCreatorDisplayName(profile.display_name || profile.username);
          }
        } catch (error) {
          logger.error('Error fetching creator profile:', error);
        }
      }
    };
    
    fetchCreatorProfile();
  }, [video.user_id]);
  
  const getCreatorName = () => {
    if (creatorDisplayName) {
      return creatorDisplayName;
    }
    
    if (video.metadata?.creatorName) {
      if (video.metadata.creatorName.includes('@')) {
        return video.metadata.creatorName.split('@')[0];
      }
      return video.metadata.creatorName;
    }
    
    if (video.reviewer_name) {
      if (video.reviewer_name.includes('@')) {
        return video.reviewer_name.split('@')[0];
      }
      return video.reviewer_name;
    }
    
    return 'Unknown';
  };
  
  return {
    creatorDisplayName,
    getCreatorName
  };
};
