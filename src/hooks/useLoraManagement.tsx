
import { useState, useCallback, useEffect } from 'react';
import { LoraAsset, VideoEntry } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth';
import { useVideoManagement } from './useVideoManagement';

export const useLoraManagement = () => {
  const [loras, setLoras] = useState<LoraAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { videos } = useVideoManagement();

  // First check if user is authenticated
  useEffect(() => {
    const checkUser = async () => {
      try {
        console.log("useLoraManagement: Checking current user");
        const user = await getCurrentUser();
        console.log("useLoraManagement: Current user:", user ? user.id : "not authenticated");
        setUserId(user?.id || null);
      } catch (error) {
        console.error("useLoraManagement: Error checking user:", error);
        setUserId(null);
      }
    };
    
    checkUser();

    // Also set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("useLoraManagement: Auth state changed:", event);
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("useLoraManagement: User signed in:", session.user.id);
        setUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log("useLoraManagement: User signed out");
        setUserId(null);
      }
    });

    return () => {
      console.log("useLoraManagement: Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, []);

  const loadAllLoras = useCallback(async () => {
    setIsLoading(true);
    console.log("useLoraManagement: Loading all LoRAs");
    
    try {
      // Get all assets first, then filter them client-side to debug
      console.log("useLoraManagement: About to query all assets");
      
      const { data: allAssets, error: allAssetsError } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (allAssetsError) {
        throw allAssetsError;
      }
      
      console.log("useLoraManagement: All assets from database:", allAssets);
      
      // Now fetch LoRA assets with the existing query
      const { data: loraAssets, error } = await supabase
        .from('assets')
        .select('*')
        .or('type.ilike.%lora%,type.eq.LoRA') // Match any variation of "lora"
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      console.log("useLoraManagement: LoRA assets from database:", loraAssets);
      
      // Manual filtering to verify the results
      const manuallyFilteredAssets = allAssets.filter(asset => 
        asset.type && 
        (asset.type.toLowerCase().includes('lora') || asset.type === 'LoRA')
      );
      
      console.log("useLoraManagement: Manually filtered LoRA assets:", manuallyFilteredAssets);
      
      // If there are assets in the manually filtered list but not in the query results,
      // use the manually filtered list instead
      const assetsToUse = manuallyFilteredAssets.length > loraAssets.length 
        ? manuallyFilteredAssets 
        : loraAssets;
      
      // Map videos to their assets
      const lorasWithVideos = assetsToUse.map((asset) => {
        // Find primary video
        const primaryVideo = videos.find(v => v.id === asset.primary_media_id);
        console.log(`useLoraManagement: Asset ${asset.id} (${asset.name}) primary video:`, 
          primaryVideo ? primaryVideo.id : "none found");
        
        // Find all videos associated with this asset through metadata
        const assetVideos = videos.filter(v => 
          v.metadata?.assetId === asset.id
        );
        console.log(`useLoraManagement: Asset ${asset.id} has ${assetVideos.length} associated videos via metadata`);
        
        // If we don't have any videos via metadata, let's check for any videos where the LoRA name matches
        let allMatchingVideos = assetVideos.length > 0 ? assetVideos : videos.filter(v => 
          v.metadata?.loraName && v.metadata.loraName.toLowerCase() === asset.name.toLowerCase()
        );
        
        if (allMatchingVideos.length === 0) {
          console.log(`useLoraManagement: No videos found for asset ${asset.id} (${asset.name}), checking for any matches`);
        } else {
          console.log(`useLoraManagement: Found ${allMatchingVideos.length} matching videos for asset ${asset.id}`);
        }
        
        return {
          ...asset,
          primaryVideo,
          videos: allMatchingVideos
        } as LoraAsset;
      });
      
      console.log("useLoraManagement: Final LoRAs with videos:", lorasWithVideos);
      setLoras(lorasWithVideos);
    } catch (error) {
      console.error("useLoraManagement: Error loading LoRAs:", error);
      toast.error("Error loading LoRAs. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [videos]);

  useEffect(() => {
    if (videos.length > 0) {
      console.log("useLoraManagement: Videos loaded, loading LoRAs");
      loadAllLoras();
    }
  }, [videos, loadAllLoras]);

  const refetchLoras = useCallback(async () => {
    await loadAllLoras();
    toast.success("LoRAs refreshed");
  }, [loadAllLoras]);

  return {
    loras,
    isLoading: isLoading,
    refetchLoras
  };
};
