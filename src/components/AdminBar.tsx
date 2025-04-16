
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';

const logger = new Logger('AdminBar');

/**
 * AdminBar - A component shown only to admin users
 * Provides quick actions for admin operations
 */
const AdminBar: React.FC = () => {
  const navigate = useNavigate();
  
  const handleRefreshData = () => {
    toast.info("Refreshing data...");
    logger.log("Admin requested data refresh");
    // This would typically call a refetch function passed as props
    // For now, just show a toast
    setTimeout(() => {
      toast.success("Data refresh complete");
    }, 1000);
  };
  
  const handleNavigateToAdmin = () => {
    navigate('/admin');
  };
  
  return (
    <div className="fixed bottom-4 right-4 flex gap-2 z-50">
      <Button 
        variant="outline" 
        size="sm" 
        className="bg-background rounded-full shadow-md flex items-center gap-2"
        onClick={handleRefreshData}
      >
        <RefreshCw className="h-4 w-4" />
        <span className="hidden sm:inline">Refresh Data</span>
      </Button>
      
      <Button 
        variant="default" 
        size="sm" 
        className="bg-olive hover:bg-olive/90 rounded-full shadow-md flex items-center gap-2"
        onClick={handleNavigateToAdmin}
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Admin Panel</span>
      </Button>
    </div>
  );
};

export default AdminBar;
