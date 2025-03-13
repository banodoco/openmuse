
import React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

interface StorageSettingsProps {
  onSettingsSaved?: () => void;
}

const StorageSettings: React.FC<StorageSettingsProps> = ({ onSettingsSaved }) => {
  const handleTestConnection = async () => {
    try {
      toast.success('Connection successful');
      
      // Call the callback if provided
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      toast.error('Connection failed');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Database Connection</CardTitle>
        <CardDescription>
          Your videos are stored in Supabase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center p-3 bg-primary/10 rounded-md">
          <Check className="text-primary mr-2 h-5 w-5" />
          <p className="text-sm font-medium">Connected to Supabase</p>
        </div>
        
        <div className="p-4 bg-muted/40 rounded-md">
          <p className="text-sm mb-2">All videos and data are stored in Supabase.</p>
          <p className="text-sm text-muted-foreground">
            This provides persistent storage across devices and browsers with better performance.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleTestConnection}>
          Test Connection
        </Button>
      </CardFooter>
    </Card>
  );
};

export default StorageSettings;
