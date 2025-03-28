
import React, { useState, useEffect } from 'react';
import { LoraAsset } from '@/lib/types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from '@/components/ui/input';
import { FileVideo } from 'lucide-react';
import LoraCard from './LoraCard';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { checkIsAdmin } from '@/lib/auth';

const logger = new Logger('LoraList');

interface LoraListProps {
  loras: LoraAsset[];
}

const LoraList: React.FC<LoraListProps> = ({ loras }) => {
  const [filterText, setFilterText] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('curated'); // Default to 'curated'
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  const adminCheckComplete = React.useRef(false);
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.id && !adminCheckComplete.current) {
        try {
          adminCheckComplete.current = true;
          const adminStatus = await checkIsAdmin(user.id);
          setIsAdmin(adminStatus);
          logger.log("Admin status checked in LoraList:", adminStatus);
        } catch (error) {
          logger.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else if (!user) {
        setIsAdmin(false);
        adminCheckComplete.current = false;
      }
    };
    
    checkAdminStatus();
  }, [user]);
  
  useEffect(() => {
    logger.log("LoraList received loras:", loras?.length || 0);
  }, [loras]);
  
  const filteredLoras = (loras || []).filter(lora => {
    const searchTerm = filterText.toLowerCase();
    const matchesText = (
      ((lora.name || '').toLowerCase().includes(searchTerm)) ||
      ((lora.description || '').toLowerCase().includes(searchTerm)) ||
      ((lora.creator || '').toLowerCase().includes(searchTerm))
    );
    
    let matchesApproval = false;
    const loraApproved = lora.admin_approved;
    const videoApproved = lora.primaryVideo?.admin_approved;
    
    if (approvalFilter === 'curated') {
      matchesApproval = loraApproved === 'Curated' || videoApproved === 'Curated';
    } else if (approvalFilter === 'listed') {
      matchesApproval = (!loraApproved || loraApproved === 'Listed' || !videoApproved || videoApproved === 'Listed') 
                      && loraApproved !== 'Rejected' && videoApproved !== 'Rejected';
    } else if (approvalFilter === 'rejected') {
      matchesApproval = loraApproved === 'Rejected' || videoApproved === 'Rejected';
    }
    
    return matchesText && matchesApproval;
  });

  // Updated filter button styling to match VideoFilter component
  const getFilterButtonClass = (filter: string) => {
    return cn(
      "px-4 py-2 rounded-md text-sm font-medium transition-colors",
      approvalFilter === filter 
        ? "!bg-[#FEF7CD] !text-forest-dark hover:!bg-[#FEF7CD]" 
        : "bg-muted hover:bg-muted/80"
    );
  };

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
          
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setApprovalFilter('curated')}
              className={getFilterButtonClass('curated')}
              style={{
                backgroundColor: approvalFilter === 'curated' ? '#FEF7CD' : '',
                color: approvalFilter === 'curated' ? '#1A2D10' : ''
              }}
              variant="outline"
            >
              Curated
            </Button>
            <Button
              type="button"
              onClick={() => setApprovalFilter('listed')}
              className={getFilterButtonClass('listed')}
              style={{
                backgroundColor: approvalFilter === 'listed' ? '#FEF7CD' : '',
                color: approvalFilter === 'listed' ? '#1A2D10' : ''
              }}
              variant="outline"
            >
              Listed
            </Button>
            {isAdmin && (
              <Button
                type="button"
                onClick={() => setApprovalFilter('rejected')}
                className={getFilterButtonClass('rejected')}
                style={{
                  backgroundColor: approvalFilter === 'rejected' ? '#FEF7CD' : '',
                  color: approvalFilter === 'rejected' ? '#1A2D10' : ''
                }}
                variant="outline"
              >
                Rejected
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredLoras.length > 0 ? (
            filteredLoras.map((lora) => (
              <LoraCard key={lora.id} lora={lora} isAdmin={isAdmin} />
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
    </div>
  );
};

export default LoraList;
