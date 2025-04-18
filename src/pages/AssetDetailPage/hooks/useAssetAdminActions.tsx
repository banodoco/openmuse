import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset } from '@/lib/types';
import { toast } from 'sonner';

export const useAssetAdminActions = (
  assetId: string | undefined, 
  setAsset: React.Dispatch<React.SetStateAction<LoraAsset | null>>,
  fetchAssetDetails: () => Promise<void>
) => {
  const [isApproving, setIsApproving] = useState(false);

  const handleCurateAsset = async () => {
    if (!assetId) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_status: 'Curated' })
        .eq('id', assetId);
      
      if (error) throw error;
      
      toast.success('LoRA curated successfully');
      setAsset(prev => prev ? { ...prev, admin_status: 'Curated' } : null);
    } catch (error) {
      console.error('Error curating LoRA:', error);
      toast.error('Failed to curate LoRA');
    } finally {
      setIsApproving(false);
    }
  };

  const handleListAsset = async () => {
    if (!assetId) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_status: 'Listed' })
        .eq('id', assetId);
      
      if (error) throw error;
      
      toast.success('LoRA listed successfully');
      setAsset(prev => prev ? { ...prev, admin_status: 'Listed' } : null);
    } catch (error) {
      console.error('Error listing LoRA:', error);
      toast.error('Failed to list LoRA');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectAsset = async () => {
    if (!assetId) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_status: 'Rejected' })
        .eq('id', assetId);
      
      if (error) throw error;
      
      toast.success('LoRA rejected');
      setAsset(prev => prev ? { ...prev, admin_status: 'Rejected' } : null);
    } catch (error) {
      console.error('Error rejecting LoRA:', error);
      toast.error('Failed to reject LoRA');
    } finally {
      setIsApproving(false);
    }
  };

  const handleFeatureAsset = async () => {
    if (!assetId) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_status: 'Featured' })
        .eq('id', assetId);
      
      if (error) throw error;
      
      toast.success('LoRA featured successfully');
      setAsset(prev => prev ? { ...prev, admin_status: 'Featured' } : null);
    } catch (error) {
      console.error('Error featuring LoRA:', error);
      toast.error('Failed to feature LoRA');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video deleted successfully');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    }
  };

  const handleApproveVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Curated' })
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video curated successfully');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error curating video:', error);
      toast.error('Failed to curate video');
    }
  };

  const handleListVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Listed' })
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video listed successfully');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error listing video:', error);
      toast.error('Failed to list video');
    }
  };

  const handleRejectVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Rejected' })
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video rejected');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error rejecting video:', error);
      toast.error('Failed to reject video');
    }
  };

  const handleFeatureVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Featured' })
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video featured successfully');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error featuring video:', error);
      toast.error('Failed to feature video');
    }
  };

  return {
    isApproving,
    handleCurateAsset,
    handleListAsset,
    handleRejectAsset,
    handleFeatureAsset,
    handleDeleteVideo,
    handleApproveVideo,
    handleListVideo,
    handleRejectVideo,
    handleFeatureVideo
  };
};
