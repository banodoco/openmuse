
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { remoteStorage } from '@/lib/remoteStorage';
import { StorageConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface StorageSettingsProps {
  onSettingsSaved?: () => void;
}

const StorageSettings: React.FC<StorageSettingsProps> = ({ onSettingsSaved }) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    
    try {
      const config: StorageConfig = {
        type: 'supabase',
      };
      
      remoteStorage.configure(config);
      
      // Trigger storage event to notify other components
      window.dispatchEvent(new Event('storage'));
      
      toast.success('Storage settings saved successfully');
      
      // Call the callback if provided
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (error) {
      console.error('Failed to save storage settings:', error);
      toast.error('Failed to save storage settings');
    } finally {
      setIsSaving(false);
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
        <div className="p-4 bg-muted/40 rounded-md">
          <p className="text-sm mb-2">All videos and data are stored in Supabase.</p>
          <p className="text-sm text-muted-foreground">
            This provides persistent storage across devices and browsers with better performance.
          </p>
          <div className="mt-4 text-sm bg-primary/10 p-3 rounded-md">
            <p className="font-medium">Benefits:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Data persists across devices and browsers</li>
              <li>Videos are stored in a secure cloud storage</li>
              <li>Better performance for larger video collections</li>
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveConfig} disabled={isSaving}>
          {isSaving ? 'Testing Connection...' : 'Test Connection'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default StorageSettings;
