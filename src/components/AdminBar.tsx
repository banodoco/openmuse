
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminBarProps {
  onRefresh?: () => void;
}

const AdminBar: React.FC<AdminBarProps> = ({ onRefresh }) => {
  const navigate = useNavigate();

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const navigateToAdmin = () => {
    navigate('/admin');
  };

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      <Button 
        size="sm" 
        variant="outline" 
        className="flex items-center gap-1 bg-background shadow-md"
        onClick={handleRefresh}
      >
        <RefreshCw className="h-4 w-4" />
        <span>Refresh Data</span>
      </Button>
      
      <Button 
        size="sm" 
        variant="default" 
        className="flex items-center gap-1 shadow-md"
        onClick={navigateToAdmin}
      >
        <Settings className="h-4 w-4" />
        <span>Admin Panel</span>
      </Button>
    </div>
  );
};

export default AdminBar;
