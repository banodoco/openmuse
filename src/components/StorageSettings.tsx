
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { remoteStorage } from '@/lib/remoteStorage';
import { StorageConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const StorageSettings: React.FC = () => {
  const [storageType, setStorageType] = useState<'local' | 'remote' | 'aws' | 'supabase'>('local');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('');
  const [awsBucket, setAwsBucket] = useState('');
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load current configuration
    const config = remoteStorage.getConfig();
    setStorageType(config.type);
    setRemoteUrl(config.remoteUrl || '');
    setApiKey(config.apiKey || '');
    setAwsRegion(config.awsRegion || '');
    setAwsBucket(config.awsBucket || '');
    setAwsAccessKey(config.awsAccessKey || '');
    setAwsSecretKey(config.awsSecretKey || '');
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    
    try {
      // Validate inputs based on storage type
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
      } else if (storageType === 'aws') {
        // Validate AWS fields
        if (!awsRegion || !awsBucket || !awsAccessKey || !awsSecretKey) {
          toast.error('All AWS fields are required');
          setIsSaving(false);
          return;
        }
      }
      
      const config: StorageConfig = {
        type: storageType,
        remoteUrl: storageType === 'remote' ? remoteUrl : undefined,
        apiKey: storageType === 'remote' && apiKey ? apiKey : undefined,
        awsRegion: storageType === 'aws' ? awsRegion : undefined,
        awsBucket: storageType === 'aws' ? awsBucket : undefined,
        awsAccessKey: storageType === 'aws' ? awsAccessKey : undefined,
        awsSecretKey: storageType === 'aws' ? awsSecretKey : undefined,
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
        <Tabs defaultValue={storageType} onValueChange={(value) => setStorageType(value as 'local' | 'remote' | 'aws' | 'supabase')}>
          <TabsList className="mb-4">
            <TabsTrigger value="local">Browser Storage</TabsTrigger>
            <TabsTrigger value="remote">Custom Server</TabsTrigger>
            <TabsTrigger value="aws">AWS S3</TabsTrigger>
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
          
          <TabsContent value="remote">
            <div className="space-y-4">
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
            </div>
          </TabsContent>
          
          <TabsContent value="aws">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aws-region">AWS Region</Label>
                <Input
                  id="aws-region"
                  placeholder="us-east-1"
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="aws-bucket">S3 Bucket Name</Label>
                <Input
                  id="aws-bucket"
                  placeholder="my-video-bucket"
                  value={awsBucket}
                  onChange={(e) => setAwsBucket(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="aws-access-key">Access Key ID</Label>
                <Input
                  id="aws-access-key"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={awsAccessKey}
                  onChange={(e) => setAwsAccessKey(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="aws-secret-key">Secret Access Key</Label>
                <Input
                  id="aws-secret-key"
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  value={awsSecretKey}
                  onChange={(e) => setAwsSecretKey(e.target.value)}
                  type="password"
                />
                <p className="text-xs text-muted-foreground">
                  Your AWS credentials are stored securely in your browser session and never sent to our servers
                </p>
              </div>
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
