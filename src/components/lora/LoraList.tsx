
import React, { useState, useEffect } from 'react';
import { LoraAsset } from '@/lib/types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from '@/components/ui/input';
import { FileVideo, RefreshCw } from 'lucide-react';
import LoraCard from './LoraCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LoraListProps {
  loras: LoraAsset[];
  onRefresh?: () => Promise<void>;
}

const LoraList: React.FC<LoraListProps> = ({ loras, onRefresh }) => {
  const [filterText, setFilterText] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('curated');
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
        toast.success("LoRA list refreshed");
      } catch (error) {
        console.error("Error refreshing LoRAs:", error);
        toast.error("Failed to refresh LoRAs");
      } finally {
        setRefreshing(false);
      }
    }
  };

  const filteredLoras = loras.filter(lora => {
    // Text filter
    const searchTerm = filterText.toLowerCase();
    const matchesText = (
      ((lora.name || '').toLowerCase().includes(searchTerm)) ||
      ((lora.description || '').toLowerCase().includes(searchTerm)) ||
      ((lora.creator || '').toLowerCase().includes(searchTerm))
    );
    
    // Approval filter - skip approval check if 'all' is selected
    if (approvalFilter === 'all') {
      return matchesText; // Only apply text filter when 'all' is selected
    }
    
    // Apply appropriate approval filters for other options
    const primaryVideo = lora.primaryVideo;
    
    if (approvalFilter === 'curated') {
      return matchesText && !!primaryVideo && primaryVideo.admin_approved === true;
    } else if (approvalFilter === 'pending') {
      return matchesText && !!primaryVideo && primaryVideo.admin_approved === null;
    } else if (approvalFilter === 'rejected') {
      return matchesText && !!primaryVideo && primaryVideo.admin_approved === false;
    }
    
    return matchesText; // Fallback (shouldn't reach here)
  });

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-1 gap-4">
          <Input
            type="text"
            placeholder="Filter LoRAs..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="max-w-sm"
          />
          
          <Select
            value={approvalFilter}
            onValueChange={setApprovalFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="curated">Curated</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {onRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
      
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLoras.length > 0 ? (
            filteredLoras.map((lora) => (
              <LoraCard key={lora.id} lora={lora} />
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <FileVideo className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No LoRAs found</h3>
              <p className="text-muted-foreground">
                {filterText || approvalFilter !== 'curated' 
                  ? "Try different filter settings" 
                  : "Upload some LoRAs to get started"}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {loras.length === 0 && (
        <div className="mt-4 p-4 border rounded bg-muted/20">
          <h3 className="font-medium">Debugging Info</h3>
          <p className="text-sm text-muted-foreground">No LoRAs were found in the database. This could be because:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
            <li>No assets with type 'LoRA' have been created</li>
            <li>The assets exist but don't have the correct type ('LoRA' or similar)</li>
            <li>The assets exist but don't have videos associated with them</li>
            <li>The database connection is not working properly</li>
          </ul>
          <div className="mt-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoraList;
