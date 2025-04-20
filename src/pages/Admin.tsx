import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { videoDB } from '@/lib/db';
import { VideoEntry, AdminStatus, LoraAsset } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import StorageVideoPlayer from '@/components/StorageVideoPlayer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StorageSettings from '@/components/StorageSettings';
import RequireAuth from '@/components/RequireAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { downloadEntriesAsCsv } from '@/lib/csvUtils';
import { 
  Download, 
  CheckCircle, 
  X, 
  SkipForward, 
  EyeOff,
  Flame,
  ListChecks,
  List,
  ChevronDown,
  Trash2,
  RefreshCw,
  Package,
  CheckCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Logger } from '@/lib/logger';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/useAuth';
import { videoEntryService } from '@/lib/services/videoEntryService';
import { assetService } from '@/lib/services/assetService';

const logger = new Logger('AdminPage');

const statusConfig: { [key in AdminStatus]: { label: string, icon: React.ReactNode, variant: 'default' | 'secondary' | 'destructive' | 'outline', filterKey: string } } = {
  Listed: { label: 'Listed', icon: <List className="h-3 w-3 mr-1" />, variant: 'secondary', filterKey: 'listed' },
  Curated: { label: 'Curated', icon: <ListChecks className="h-3 w-3 mr-1" />, variant: 'default', filterKey: 'curated' },
  Featured: { label: 'Featured', icon: <Flame className="h-3 w-3 mr-1" />, variant: 'default', filterKey: 'featured' },
  Hidden: { label: 'Hidden', icon: <EyeOff className="h-3 w-3 mr-1" />, variant: 'destructive', filterKey: 'hidden' },
  Rejected: { label: 'Rejected', icon: <X className="h-3 w-3 mr-1"/>, variant: 'destructive', filterKey: 'rejected' },
};

type VideoFilterKey = 'listed' | 'curated' | 'featured' | 'hidden' | 'skipped' | 'reviewed';
type AssetFilterKey = 'listed' | 'curated' | 'featured' | 'hidden' | 'reviewed';

const filterableStatuses: Exclude<AdminStatus, 'Rejected'>[] = ['Listed', 'Curated', 'Featured', 'Hidden'];

const Admin: React.FC = () => {
  const { user } = useAuth();
  
  const [entries, setEntries] = useState<VideoEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<VideoEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [videoFilters, setVideoFilters] = useState<Record<VideoFilterKey, boolean>>({
    listed: true,
    curated: true,
    featured: true,
    hidden: true,
    skipped: true,
    reviewed: false,
  });
  const [videoStatusCounts, setVideoStatusCounts] = useState<Record<VideoFilterKey | 'total', number>>({
    listed: 0, curated: 0, featured: 0, hidden: 0, skipped: 0, reviewed: 0, total: 0
  });

  const [assets, setAssets] = useState<LoraAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<LoraAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [assetFilters, setAssetFilters] = useState<Record<AssetFilterKey, boolean>>({
    listed: true,
    curated: true,
    featured: true,
    hidden: true,
    reviewed: false,
  });
  const [assetStatusCounts, setAssetStatusCounts] = useState<Record<AssetFilterKey | 'total', number>>({
    listed: 0, curated: 0, featured: 0, hidden: 0, reviewed: 0, total: 0
  });
  
  const [activeTab, setActiveTab] = useState('videos');
  
  const loadEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      const allEntries = await videoEntryService.getAllEntries(); 
      logger.log('[adminview] Raw entries from service:', allEntries.length);
      logger.log('[adminview] First entry sample:', allEntries[0]);
      
      const processedEntries = allEntries.map(entry => ({
        ...entry,
        admin_status: entry.admin_status ?? 'Listed',
        admin_reviewed: entry.admin_reviewed ?? false
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      logger.log('[adminview] Processed entries:', processedEntries.length);
      logger.log('[adminview] First processed entry sample:', processedEntries[0]);
      
      setEntries(processedEntries);
      logger.log('Loaded video entries:', processedEntries.length);
    } catch (error) {
      logger.error('[adminview] Error loading video entries:', error);
      toast.error('Failed to load videos');
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, []);

  const loadAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      const allAssets = await assetService.getAllAssets();
      logger.log('[adminview] Raw assets from service:', allAssets.length);
      logger.log('[adminview] First asset sample:', allAssets[0]);
      
      const processedAssets = allAssets.map(asset => ({
        ...asset,
        admin_status: asset.admin_status ?? 'Listed',
        admin_reviewed: asset.admin_reviewed ?? false
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      logger.log('[adminview] Processed assets:', processedAssets.length);
      logger.log('[adminview] First processed asset sample:', processedAssets[0]);
      
      setAssets(processedAssets);
      logger.log('Loaded assets:', processedAssets.length);
    } catch (error) {
      logger.error('[adminview] Error loading assets:', error);
      toast.error('Failed to load assets');
      setAssets([]);
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    logger.log('Admin page mounted, setting service user ID and loading data.');
    if (user) {
      videoEntryService.setCurrentUserId(user.id);
      assetService.setCurrentUserId(user.id);
    }
    loadEntries();
    loadAssets();
    return () => {
      logger.log('Admin page unmounting');
    };
  }, [user, loadEntries, loadAssets]);

  const applyVideoFilters = useCallback(() => {
    logger.log('[adminview] applyVideoFilters called. Raw entries count:', entries.length);
    logger.log('[adminview] Current videoFilters:', videoFilters);
    const newCounts: Record<VideoFilterKey | 'total', number> = {
      listed: 0, curated: 0, featured: 0, hidden: 0, skipped: 0, reviewed: 0, total: entries.length
    };
    
    const filtered = entries.filter(entry => {
      if (entry.admin_reviewed) {
        newCounts.reviewed++;
      }

      if (entry.admin_reviewed && !videoFilters.reviewed) {
        logger.log(`[adminview] Filtering out video ${entry.id}: Reviewed and 'Show Reviewed' is false.`);
        return false;
      }

      let currentFilterKey: VideoFilterKey;
      
      if (entry.skipped) {
        currentFilterKey = 'skipped';
      } else {
        const status = entry.admin_status ?? 'Listed'; 
        currentFilterKey = statusConfig[status]?.filterKey as VideoFilterKey || 'listed';
      }
      logger.log(`[adminview] Processing video ${entry.id}: StatusKey='${currentFilterKey}', Filtered In=${videoFilters[currentFilterKey]}`);
      
      newCounts[currentFilterKey]++;
      return videoFilters[currentFilterKey];
    });
    
    logger.log('[adminview] Filtering complete. Filtered video entries count:', filtered.length);
    setFilteredEntries(filtered);
    setVideoStatusCounts(newCounts);
  }, [entries, videoFilters]);
  
  const applyAssetFilters = useCallback(() => {
    logger.log('[adminview] applyAssetFilters called. Raw assets count:', assets.length);
    logger.log('[adminview] Current assetFilters:', assetFilters);
    const newCounts: Record<AssetFilterKey | 'total', number> = {
      listed: 0, curated: 0, featured: 0, hidden: 0, reviewed: 0, total: assets.length
    };
    
    const filtered = assets.filter(asset => {
      if (asset.admin_reviewed) {
        newCounts.reviewed++;
      }

      if (asset.admin_reviewed && !assetFilters.reviewed) {
        logger.log(`[adminview] Filtering out asset ${asset.id}: Reviewed and 'Show Reviewed' is false.`);
        return false;
      }

      const status = asset.admin_status ?? 'Listed';
      const currentFilterKey = statusConfig[status]?.filterKey as AssetFilterKey || 'listed';
      
      logger.log(`[adminview] Processing asset ${asset.id}: StatusKey='${currentFilterKey}', Filtered In=${assetFilters[currentFilterKey]}`);
      newCounts[currentFilterKey]++;
      return assetFilters[currentFilterKey];
    });
    
    logger.log('[adminview] Filtering complete. Filtered assets count:', filtered.length);
    setFilteredAssets(filtered);
    setAssetStatusCounts(newCounts);
  }, [assets, assetFilters]);

  useEffect(() => {
    applyVideoFilters();
  }, [entries, videoFilters, applyVideoFilters]);

  useEffect(() => {
    applyAssetFilters();
  }, [assets, assetFilters, applyAssetFilters]);

  const handleSetVideoAdminStatus = async (entryId: string, newStatus: AdminStatus) => {
    try {
      const updatedEntry = await videoEntryService.setApprovalStatus(entryId, newStatus);
      if (updatedEntry) {
        setEntries(prevEntries => 
          prevEntries.map(e => e.id === entryId ? { ...e, admin_status: newStatus, admin_reviewed: true } : e)
        );
        toast.success(`Video status updated to ${newStatus}`);
      } else {
         toast.error(`Failed to update video status to ${newStatus}`);
      }
    } catch (error: any) {
      logger.error(`Error setting video status to ${newStatus} for entry ${entryId}:`, error);
      toast.error(error.message || `Failed to update video status`);
    }
  };

  const handleSetVideoReviewedStatus = async (entryId: string, reviewed: boolean) => {
    try {
      const updatedEntry = await videoEntryService.setReviewedStatus(entryId, reviewed);
      if (updatedEntry) {
        setEntries(prevEntries =>
          prevEntries.map(e => e.id === entryId ? { ...e, admin_reviewed: reviewed } : e)
        );
        toast.success(`Video reviewed status set to ${reviewed}`);
      } else {
        toast.error(`Failed to update video reviewed status`);
      }
    } catch (error: any) {
      logger.error(`Error setting video reviewed status for ${entryId}:`, error);
      toast.error(error.message || `Failed to update reviewed status`);
    }
  };

  const handleDeleteVideoEntry = async (entry: VideoEntry) => {
    try {
      const success = await videoEntryService.deleteEntry(entry.id);
      if (success) {
        setEntries(entries.filter(e => e.id !== entry.id));
        toast.success('Video deleted successfully');
      } else {
        toast.error('Failed to delete video');
      }
    } catch (error: any) {
      console.error('Error deleting video entry:', error);
      toast.error(error.message || 'Error deleting video');
    }
  };

  const handleClearAllVideos = async () => {
    try {
      await videoEntryService.clearAllEntries();
      setEntries([]);
      toast.success('All videos deleted successfully');
    } catch (error: any) {
      console.error('Error clearing video entries:', error);
      toast.error(error.message || 'Failed to delete all videos');
    }
  };

  const handleDownloadCsv = () => {
    try {
      downloadEntriesAsCsv(filteredEntries, videoFilters);
      toast.success('Video CSV download started');
    } catch (error) {
      logger.error('Error downloading video CSV:', error);
      toast.error('Failed to download video CSV');
    }
  };

  const handleSetAssetAdminStatus = async (assetId: string, newStatus: AdminStatus) => {
    try {
      const updatedAsset = await assetService.setAssetAdminStatus(assetId, newStatus);
      if (updatedAsset) {
        setAssets(prevAssets =>
          prevAssets.map(a => a.id === assetId ? { ...a, admin_status: newStatus, admin_reviewed: true } : a)
        );
        toast.success(`Asset status updated to ${newStatus}`);
      } else {
        toast.error(`Failed to update asset status to ${newStatus}`);
      }
    } catch (error: any) {
      logger.error(`Error setting asset status to ${newStatus} for asset ${assetId}:`, error);
      toast.error(error.message || `Failed to update asset status`);
    }
  };

  const handleSetAssetReviewedStatus = async (assetId: string, reviewed: boolean) => {
    try {
      const updatedAsset = await assetService.setAssetReviewedStatus(assetId, reviewed);
      if (updatedAsset) {
        setAssets(prevAssets =>
          prevAssets.map(a => a.id === assetId ? { ...a, admin_reviewed: reviewed } : a)
        );
        toast.success(`Asset reviewed status set to ${reviewed}`);
      } else {
        toast.error(`Failed to update asset reviewed status`);
      }
    } catch (error: any) {
      logger.error(`Error setting asset reviewed status for ${assetId}:`, error);
      toast.error(error.message || `Failed to update reviewed status`);
    }
  };

  const handleDeleteAsset = async (asset: LoraAsset) => {
    try {
      const success = await assetService.deleteAsset(asset.id);
      if (success) {
        setAssets(assets.filter(a => a.id !== asset.id));
        toast.success('Asset deleted successfully');
      } else {
        toast.error('Failed to delete asset. Check logs for details.'); 
      }
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      toast.error(error.message || 'Error deleting asset');
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const getStatusDetails = (status: AdminStatus | undefined | null): { label: string, icon: React.ReactNode, variant: 'default' | 'secondary' | 'destructive' | 'outline', key: AssetFilterKey } => {
    const currentStatus = status ?? 'Listed';
    if (statusConfig[currentStatus]) {
      return { ...statusConfig[currentStatus], key: statusConfig[currentStatus].filterKey as AssetFilterKey };
    }
    logger.warn(`Unexpected admin_status found: ${currentStatus}. Defaulting to Listed.`);
    return { ...statusConfig.Listed, key: 'listed' }; 
  };

  const getVideoStatusDetails = (entry: VideoEntry): { label: string, icon: React.ReactNode, variant: 'default' | 'secondary' | 'destructive' | 'outline', key: VideoFilterKey } => {
    if (entry.skipped) {
      return { label: 'Skipped', icon: <SkipForward className="h-3 w-3 mr-1" />, variant: 'secondary', key: 'skipped' };
    }
    return getStatusDetails(entry.admin_status) as { label: string, icon: React.ReactNode, variant: 'default' | 'secondary' | 'destructive' | 'outline', key: VideoFilterKey };
  };

  const handleVideoFilterChange = (key: VideoFilterKey, checked: boolean) => {
    setVideoFilters(prevFilters => ({ ...prevFilters, [key]: checked }));
  };
  
  const handleAssetFilterChange = (key: AssetFilterKey, checked: boolean) => {
    setAssetFilters(prevFilters => ({ ...prevFilters, [key]: checked }));
  };

  return (
    <RequireAuth requireAdmin>
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />

        <main className="container py-8 px-4 flex-1">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground mb-8">Manage video submissions, assets, and settings</p>

          <Tabs defaultValue="assets" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="assets">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">All Assets (LoRAs)</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={loadAssets}
                    size="sm"
                    disabled={isLoadingAssets}
                  >
                    <RefreshCw className={`mr-1 h-4 w-4 ${isLoadingAssets ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-3 mb-2 p-4 bg-muted/50 rounded-lg">
                {filterableStatuses.map(status => (
                  <div key={`asset-filter-${status}`} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`asset-filter-${statusConfig[status].filterKey}`}
                      checked={assetFilters[statusConfig[status].filterKey as AssetFilterKey]}
                      onCheckedChange={(checked) => handleAssetFilterChange(statusConfig[status].filterKey as AssetFilterKey, checked as boolean)} 
                    />
                    <Label htmlFor={`asset-filter-${statusConfig[status].filterKey}`}>{statusConfig[status].label}</Label>
                  </div>
                ))}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="asset-filter-reviewed"
                    checked={assetFilters.reviewed}
                    onCheckedChange={(checked) => handleAssetFilterChange('reviewed', checked as boolean)} 
                  />
                  <Label htmlFor="asset-filter-reviewed">Show Reviewed</Label>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-6 px-4 py-2 text-sm text-muted-foreground">
                <div>
                  Showing <span className="font-medium text-foreground">{filteredAssets.length}</span> of <span className="font-medium text-foreground">{assetStatusCounts.total}</span> assets
                </div>
                <div className="flex gap-3 flex-wrap">
                  {filterableStatuses.map(status => (
                    assetFilters[statusConfig[status].filterKey as AssetFilterKey] && (
                      <span key={`asset-count-${status}`} className="flex items-center">
                        {React.cloneElement(statusConfig[status].icon as React.ReactElement, { className: "h-3 w-3 mr-1" })}
                        {assetStatusCounts[statusConfig[status].filterKey as AssetFilterKey]} {statusConfig[status].filterKey}
                      </span>
                    )
                  ))}
                  <span className="flex items-center">
                    <CheckCheck className="h-3 w-3 mr-1 text-green-600" />
                    {assetStatusCounts.reviewed} reviewed
                  </span>
                </div>
              </div>
              
              {isLoadingAssets ? (
                <p>Loading assets...</p>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">No assets match your current filters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssets.map(asset => {
                    const { label, icon, variant } = getStatusDetails(asset.admin_status);
                    const creatorName = asset.creatorDisplayName || asset.creator || 'Unknown User';
                    
                    // Prepare thumbnails for the grid, ensuring 4 items
                    const thumbnails = asset.associatedMedia || [];
                    const displayMedia = Array(4).fill(null).map((_, index) => thumbnails[index] || null);
                    
                    return (
                      <div key={asset.id} className="border rounded-lg p-4 bg-card grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        {/* Left Column: Video/Thumbnail Grid (spans 1 column on md) */}
                        <div className="grid grid-cols-2 gap-2 md:col-span-1">
                          {displayMedia.map((media, index) => (
                            <div key={media?.id || index} className="aspect-square bg-muted rounded overflow-hidden flex items-center justify-center">
                              {media?.url ? (
                            <StorageVideoPlayer
                                  videoLocation={media.url}
                                  className="w-full h-full object-cover"
                              controls
                            />
                              ) : media?.thumbnailUrl ? (
                                <img src={media.thumbnailUrl} alt={`Asset thumbnail ${index + 1}`} className="object-cover w-full h-full" />
                              ) : (
                                <span className="text-xs text-muted-foreground">No Media</span>
                              )}
                            </div>
                          ))}
                          {/* Fill remaining slots with empty placeholders */}
                          {Array(4 - (displayMedia.length || 0)).fill(null).map((_, index) => (
                            <div key={`empty-${index}`} className="aspect-square bg-muted rounded flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">No Media</span>
                            </div>
                          ))}
                        </div>

                        {/* Right Column: Details and Actions (spans 2 columns on md) */}
                        <div className="md:col-span-2 flex flex-col justify-between h-full">
                          {/* Top part: Details */}
                          <div className="mb-4 relative">
                            <Button
                              size="sm"
                              variant={asset.admin_reviewed ? "outline" : "secondary"}
                              onClick={() => handleSetAssetReviewedStatus(asset.id, !asset.admin_reviewed)}
                              className="absolute top-0 right-0 gap-1 h-7 text-xs"
                              title={asset.admin_reviewed ? "Mark as Unreviewed" : "Mark as Reviewed"}
                            >
                              <CheckCheck className="h-4 w-4" />
                              {asset.admin_reviewed ? "Reviewed" : "Mark Reviewed"}
                            </Button>

                            <Badge variant={variant} className="flex items-center whitespace-nowrap w-fit mb-2">
                              {icon}
                              {label}
                            </Badge>
                            <h3 className="font-semibold text-lg break-words">{asset.name}</h3>
                            <p className="text-sm text-muted-foreground">Creator: {creatorName}</p>
                            <p className="text-sm text-muted-foreground">Type: {asset.lora_type || asset.type || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">Created: {formatDate(asset.created_at)}</p>
                            <p className="text-xs text-muted-foreground truncate">ID: {asset.id}</p>
                          </div>

                          {/* Bottom part: Actions */}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            {filterableStatuses.map(status => (
                              <Button
                                key={`asset-action-${status}`}
                                size="sm"
                                variant={asset.admin_status === status 
                                          ? (status === 'Hidden' ? 'destructive' : 'secondary') 
                                          : 'outline'}
                                onClick={() => handleSetAssetAdminStatus(asset.id, status)}
                                disabled={asset.admin_status === status} 
                                className={`gap-1 h-8 text-xs ${
                                  asset.admin_status === status && status === 'Hidden' ? '' :
                                  asset.admin_status !== status && status === 'Hidden' ? 'border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700' : ''}`}
                              >
                                {React.cloneElement(statusConfig[status].icon as React.ReactElement, { className: "h-4 w-4" })}
                                {statusConfig[status].label}
                              </Button>
                            ))}
                          </div>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" title="Delete Asset" className="w-full">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Asset
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Asset?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the asset "{asset.name}" (ID: {asset.id})? This will also delete all associated media files and cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAsset(asset)} className="bg-destructive hover:bg-destructive/90">
                                  Confirm Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="videos">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">All Videos</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={loadEntries}
                    size="sm"
                    disabled={isLoadingEntries}
                  >
                    <RefreshCw className={`mr-1 h-4 w-4 ${isLoadingEntries ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  {filteredEntries.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadCsv}
                    >
                      <Download className="mr-1" size={16} />
                      Download CSV ({filteredEntries.length})
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-3 mb-2 p-4 bg-muted/50 rounded-lg">
                {filterableStatuses.map(status => (
                  <div key={`video-filter-${status}`} className="flex items-center space-x-2">
                  <Checkbox 
                      id={`video-filter-${statusConfig[status].filterKey}`}
                      checked={videoFilters[statusConfig[status].filterKey as VideoFilterKey]}
                      onCheckedChange={(checked) => handleVideoFilterChange(statusConfig[status].filterKey as VideoFilterKey, checked as boolean)} 
                    />
                    <Label htmlFor={`video-filter-${statusConfig[status].filterKey}`}>{statusConfig[status].label}</Label>
                </div>
                ))}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="video-filter-skipped" 
                    checked={videoFilters.skipped}
                    onCheckedChange={(checked) => handleVideoFilterChange('skipped', checked as boolean)} 
                  />
                  <Label htmlFor="video-filter-skipped">Skipped</Label>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-6 px-4 py-2 text-sm text-muted-foreground">
                <div>
                  Showing <span className="font-medium text-foreground">{filteredEntries.length}</span> of <span className="font-medium text-foreground">{videoStatusCounts.total}</span> videos
                </div>
                <div className="flex gap-3 flex-wrap">
                  {filterableStatuses.map(status => (
                    videoFilters[statusConfig[status].filterKey as VideoFilterKey] && (
                      <span key={`video-count-${status}`} className="flex items-center">
                        {React.cloneElement(statusConfig[status].icon as React.ReactElement, { className: "h-3 w-3 mr-1" })}
                        {videoStatusCounts[statusConfig[status].filterKey as VideoFilterKey]} {statusConfig[status].filterKey}
                    </span>
                    )
                  ))}
                  {videoFilters.skipped && (
                    <span className="flex items-center">
                      <SkipForward className="h-3 w-3 mr-1" />
                      {videoStatusCounts.skipped} skipped
                    </span>
                  )}
                </div>
              </div>

              {isLoadingEntries ? (
                <p>Loading videos...</p>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">No videos match your current filters</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {filteredEntries.map(entry => {
                    const { label, icon, variant } = getVideoStatusDetails(entry);
                    
                    return (
                      <div key={entry.id} className="border rounded-lg p-4 bg-card">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="rounded overflow-hidden bg-black aspect-video">
                            {entry.url ? (
                              <StorageVideoPlayer
                                videoLocation={entry.url}
                                className="w-full h-full"
                                controls
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground bg-muted">
                                Video URL missing or invalid.
                              </div>
                            )}
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2 relative">
                              <Button
                                size="sm"
                                variant={entry.admin_reviewed ? "outline" : "secondary"}
                                onClick={() => handleSetVideoReviewedStatus(entry.id, !entry.admin_reviewed)}
                                className="absolute top-0 right-0 gap-1 h-7 text-xs"
                                title={entry.admin_reviewed ? "Mark as Unreviewed" : "Mark as Reviewed"}
                              >
                                <CheckCheck className="h-4 w-4" />
                                {entry.admin_reviewed ? "Reviewed" : "Mark Reviewed"}
                              </Button>

                              <Badge variant={variant} className="flex items-center whitespace-nowrap w-fit">
                              {icon}
                              {label}
                            </Badge>
                              <h3 className="font-medium">{entry.reviewer_name}</h3>
                              <p className="text-sm text-muted-foreground">Uploaded: {formatDate(entry.created_at)}</p>
                              <p className="text-xs text-muted-foreground">ID: {entry.id}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {filterableStatuses.map(status => (
                                <Button
                                  key={`video-action-${status}`}
                                  size="sm"
                                  variant={entry.skipped ? 'outline' : (entry.admin_status === status ? statusConfig[status].variant : 'outline')}
                                  onClick={() => handleSetVideoAdminStatus(entry.id, status)}
                                  disabled={entry.skipped || entry.admin_status === status}
                                  className="gap-1 h-8 text-xs"
                                >
                                  {React.cloneElement(statusConfig[status].icon as React.ReactElement, { className: "h-4 w-4" })}
                                  {statusConfig[status].label}
                                </Button>
                              ))}
                            </div>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="w-full">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Video
                            </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Video?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this video submission by {entry.reviewer_name || 'Unknown User'} (ID: {entry.id})? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteVideoEntry(entry)} className="bg-destructive hover:bg-destructive/90">
                                    Confirm Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings">
              <h2 className="text-2xl font-semibold mb-6">Application Settings</h2>
              <StorageSettings onSettingsSaved={() => { loadEntries(); /* Consider loadAssets() too? */ }} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </RequireAuth>
  );
};

export default Admin;
