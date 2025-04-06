import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Filter } from 'lucide-react';
import { LoraAsset } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import AssetHeader from './components/AssetHeader';
import AssetInfoCard from './components/AssetInfoCard';
import AssetVideoSection from './components/AssetVideoSection';
import { useAssetDetails } from './hooks/useAssetDetails';
import { useAssetAdminActions } from './hooks/useAssetAdminActions';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const logger = new Logger('AssetDetailPage');

function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [modelFilter, setModelFilter] = useState<string>('all');
  
  const {
    asset,
    videos,
    isLoading,
    creatorDisplayName,
    getCreatorName,
    fetchAssetDetails,
    setAsset
  } = useAssetDetails(id);
  
  const {
    isApproving,
    handleCurateAsset,
    handleListAsset,
    handleRejectAsset,
  } = useAssetAdminActions(id, setAsset, fetchAssetDetails);
  
  // Get unique models from the database to use in filter
  const [allLoras, setAllLoras] = useState<LoraAsset[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  
  useEffect(() => {
    async function loadAllLoras() {
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('*')
          .or(`type.ilike.%lora%,type.eq.LoRA,type.eq.lora,type.eq.Lora`);
          
        if (error) {
          throw error;
        }
        
        setAllLoras(data || []);
      } catch (error) {
        logger.error('Error loading all loras:', error);
      } finally {
        setIsLoadingAll(false);
      }
    }
    
    loadAllLoras();
  }, []);
  
  // Get unique models from loras
  const uniqueModels = React.useMemo(() => {
    const models = new Set<string>();
    allLoras?.forEach(lora => {
      if (lora.lora_base_model) {
        models.add(lora.lora_base_model.toLowerCase());
      }
    });
    return Array.from(models).sort();
  }, [allLoras]);

  // Format model name for display
  const formatModelName = (model: string) => {
    switch (model.toLowerCase()) {
      case 'wan': return 'Wan';
      case 'hunyuan': return 'Hunyuan';
      case 'ltxv': return 'LTXV';
      case 'cogvideox': return 'CogVideoX';
      case 'animatediff': return 'Animatediff';
      default: return model.charAt(0).toUpperCase() + model.slice(1);
    }
  };
  
  const handleBackClick = () => {
    navigate('/');
  };
  
  const handleModelFilterChange = (value: string) => {
    setModelFilter(value);
    navigate(`/?model=${value}`);
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navigation />
        <div className="flex-1 w-full max-w-6xl mx-auto p-4">
          <div className="mb-6">
            <Button variant="outline" size="sm" onClick={handleBackClick}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to LoRAs
            </Button>
          </div>
          <div className="flex justify-center items-center h-64">
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <div className="flex-1 w-full max-w-screen-2xl mx-auto p-4">
        <div className="mb-6">
          <Button variant="outline" size="sm" onClick={handleBackClick}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to LoRAs
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Left sidebar with model filter */}
          <div className="col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter size={18} />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="model-filter">Model</Label>
                    <Select
                      value={modelFilter}
                      onValueChange={handleModelFilterChange}
                    >
                      <SelectTrigger id="model-filter" className="w-full mt-1">
                        <SelectValue placeholder="Filter by model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Models</SelectItem>
                        {uniqueModels.map(model => (
                          <SelectItem key={model} value={model}>
                            {formatModelName(model)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Main content */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            {asset && (
              <>
                <AssetHeader 
                  asset={asset}
                  handleGoBack={handleBackClick}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                  <div className="lg:col-span-1">
                    <AssetInfoCard 
                      asset={asset}
                      creatorDisplayName={creatorDisplayName}
                      isAdmin={isAdmin}
                      isApproving={isApproving}
                      handleCurateAsset={handleCurateAsset}
                      handleListAsset={handleListAsset}
                      handleRejectAsset={handleRejectAsset}
                      getCreatorName={getCreatorName}
                    />
                  </div>
                  
                  <div className="lg:col-span-2">
                    <AssetVideoSection 
                      asset={asset}
                      videos={videos}
                      isAdmin={isAdmin}
                      handleOpenLightbox={() => {}}
                      handleApproveVideo={() => Promise.resolve()}
                      handleDeleteVideo={() => Promise.resolve()}
                      fetchAssetDetails={fetchAssetDetails}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}

export default AssetDetailPage;
