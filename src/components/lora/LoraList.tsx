
import React, { useState } from 'react';
import { LoraAsset } from '@/lib/types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from '@/components/ui/input';
import { FileVideo } from 'lucide-react';
import LoraCard from './LoraCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LoraListProps {
  loras: LoraAsset[];
}

const LoraList: React.FC<LoraListProps> = ({ loras }) => {
  const [filterText, setFilterText] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('all');

  const filteredLoras = loras.filter(lora => {
    // Text filter
    const searchTerm = filterText.toLowerCase();
    const matchesText = (
      lora.name.toLowerCase().includes(searchTerm) ||
      (lora.description?.toLowerCase().includes(searchTerm) ?? false) ||
      (lora.creator?.toLowerCase().includes(searchTerm) ?? false)
    );
    
    // Approval filter
    let matchesApproval = true;
    if (approvalFilter !== 'all') {
      // Check if the primary video exists and matches the approval filter
      const primaryVideo = lora.primaryVideo;
      if (approvalFilter === 'approved') {
        matchesApproval = !!primaryVideo && primaryVideo.admin_approved === true;
      } else if (approvalFilter === 'pending') {
        matchesApproval = !!primaryVideo && primaryVideo.admin_approved === null;
      } else if (approvalFilter === 'rejected') {
        matchesApproval = !!primaryVideo && primaryVideo.admin_approved === false;
      }
    }
    
    return matchesText && matchesApproval;
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
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLoras.map((lora) => (
            <LoraCard key={lora.id} lora={lora} />
          ))}
          
          {filteredLoras.length === 0 && (
            <div className="col-span-full text-center py-8">
              <FileVideo className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No LoRAs found</h3>
              <p className="text-muted-foreground">
                {filterText || approvalFilter !== 'all' 
                  ? "Try different filter settings" 
                  : "Upload some LoRAs to get started"}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LoraList;
