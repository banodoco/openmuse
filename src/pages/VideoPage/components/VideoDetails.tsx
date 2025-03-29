
import React, { useEffect, useState } from 'react';
import { VideoEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface VideoDetailsProps {
  video: VideoEntry;
}

const VideoDetails: React.FC<VideoDetailsProps> = ({ video }) => {
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  
  // Fetch user profile information when component mounts
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      // Only attempt to fetch profile if we have a user_id
      if (video.user_id) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', video.user_id)
            .maybeSingle();
            
          if (profile && !error) {
            // Use display_name or username from profile
            setCreatorDisplayName(profile.display_name || profile.username);
          }
        } catch (error) {
          console.error('Error fetching creator profile:', error);
        }
      }
    };
    
    fetchCreatorProfile();
  }, [video.user_id]);
  
  // Helper function to get the best display name
  const getCreatorName = () => {
    // First priority: Profile display name if we fetched it
    if (creatorDisplayName) {
      return creatorDisplayName;
    }
    
    // Second priority: metadata.creatorName
    if (video.metadata?.creatorName) {
      // If it's an email, only show the part before @
      if (video.metadata.creatorName.includes('@')) {
        return video.metadata.creatorName.split('@')[0];
      }
      return video.metadata.creatorName;
    }
    
    // Then try reviewer_name with the same email handling
    if (video.reviewer_name) {
      if (video.reviewer_name.includes('@')) {
        return video.reviewer_name.split('@')[0];
      }
      return video.reviewer_name;
    }
    
    return 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{video.metadata?.title || 'Video Details'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created by</h3>
          <p>{getCreatorName()}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoDetails;
