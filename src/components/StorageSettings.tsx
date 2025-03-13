
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { remoteStorage } from '@/lib/remoteStorage';
import { StorageConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StorageSettingsProps {
  onSettingsSaved?: () => void;
}

const StorageSettings: React.FC<StorageSettingsProps> = ({ onSettingsSaved }) => {
  const [storageType, setStorageType] = useState<'local' | 'supabase'>('local');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load current configuration
    const config = remoteStorage.getConfig();
    setStorageType(config.type as 'local' | 'supabase');
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    
    try {
      const config: StorageConfig = {
        type: storageType,
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
        <CardTitle>Storage Settings</CardTitle>
        <CardDescription>
          Configure where your videos will be stored
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue={storageType} onValueChange={(value) => setStorageType(value as 'local' | 'supabase')}>
          <TabsList className="mb-4">
            <TabsTrigger value="local">Browser Storage</TabsTrigger>
            <TabsTrigger value="supabase">Supabase</TabsTrigger>
          </TabsList>

          <TabsContent value="local">
            <div className="p-4 bg-muted/40 rounded-md">
              <p className="text-sm mb-2">Videos will be stored locally in your browser.</p>
              <p className="text-sm text-muted-foreground">
                Note: Videos will be lost if you clear your browser data.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="supabase">
            <div className="p-4 bg-muted/40 rounded-md">
              <p className="text-sm mb-2">Videos will be stored in Supabase Storage.</p>
              <p className="text-sm text-muted-foreground">
                This option uses Supabase as both the database and storage solution, providing a more persistent and scalable option.
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
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveConfig} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default StorageSettings;
