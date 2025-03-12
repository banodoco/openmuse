
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { remoteStorage } from '@/lib/remoteStorage';
import { StorageConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const StorageSettings: React.FC = () => {
  const [storageType, setStorageType] = useState<'local' | 'remote'>('local');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load current configuration
    const config = remoteStorage.getConfig();
    setStorageType(config.type);
    setRemoteUrl(config.remoteUrl || '');
    setApiKey(config.apiKey || '');
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    
    try {
      // Validate remote URL if remote storage is selected
      if (storageType === 'remote') {
        if (!remoteUrl) {
          toast.error('Please enter a remote storage URL');
          setIsSaving(false);
          return;
        }
        
        if (!remoteUrl.startsWith('http://') && !remoteUrl.startsWith('https://')) {
          toast.error('Remote URL must start with http:// or https://');
          setIsSaving(false);
          return;
        }
      }
      
      const config: StorageConfig = {
        type: storageType,
        remoteUrl: storageType === 'remote' ? remoteUrl : undefined,
        apiKey: storageType === 'remote' && apiKey ? apiKey : undefined,
      };
      
      remoteStorage.configure(config);
      
      toast.success('Storage settings saved successfully');
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
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="storage-type">Use Remote Storage</Label>
            <p className="text-sm text-muted-foreground">
              {storageType === 'local' 
                ? 'Videos are currently stored in your browser' 
                : 'Videos will be uploaded to a remote server'}
            </p>
          </div>
          <Switch
            checked={storageType === 'remote'}
            onCheckedChange={(checked) => setStorageType(checked ? 'remote' : 'local')}
            id="storage-type"
          />
        </div>
        
        {storageType === 'remote' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="remote-url">Remote Storage URL</Label>
              <Input
                id="remote-url"
                placeholder="https://your-storage-server.com/upload"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the URL of your video storage server
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key (Optional)</Label>
              <Input
                id="api-key"
                placeholder="Your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                If your storage server requires authentication
              </p>
            </div>
          </>
        )}
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
