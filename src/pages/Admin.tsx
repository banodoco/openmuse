import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { videoDB } from '@/lib/db';
import { VideoEntry, AdminStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import StorageVideoPlayer from '@/components/StorageVideoPlayer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StorageSettings from '@/components/StorageSettings';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import RequireAuth from '@/components/RequireAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { downloadEntriesAsCsv } from '@/lib/csvUtils';
import { 
  Download, 
  CheckCircle, 
  X, 
  SkipForward, 
  EyeOff,
  Flame,
  ListChecks,
  List,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Logger } from '@/lib/logger';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

const logger = new Logger('AdminPage');

const statusConfig: { [key in AdminStatus]: { label: string, icon: React.ReactNode, variant: 'default' | 'secondary' | 'destructive' | 'outline', filterKey: string } } = {
  Listed: { label: 'Listed', icon: <List className="h-3 w-3 mr-1" />, variant: 'secondary', filterKey: 'listed' },
  Curated: { label: 'Curated', icon: <ListChecks className="h-3 w-3 mr-1" />, variant: 'default', filterKey: 'curated' },
  Featured: { label: 'Featured', icon: <Flame className="h-3 w-3 mr-1" />, variant: 'default', filterKey: 'featured' },
  Hidden: { label: 'Hidden', icon: <EyeOff className="h-3 w-3 mr-1" />, variant: 'destructive', filterKey: 'hidden' },
};

type FilterKey = 'listed' | 'curated' | 'featured' | 'hidden' | 'skipped';

const Admin: React.FC = () => {
  const [entries, setEntries] = useState<VideoEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');
  
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    listed: true,
    curated: true,
    featured: true,
    hidden: true,
    skipped: true,
  });

  const [statusCounts, setStatusCounts] = useState<Record<FilterKey | 'total', number>>({
    listed: 0,
    curated: 0,
    featured: 0,
    hidden: 0,
    skipped: 0,
    total: 0
  });

  useEffect(() => {
    logger.log('Admin page mounted');
    loadEntries();
    return () => {
      logger.log('Admin page unmounting');
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [entries, filters]);

  const applyFilters = () => {
    const newCounts: Record<FilterKey | 'total', number> = {
      listed: 0, curated: 0, featured: 0, hidden: 0, skipped: 0, total: entries.length
    };

    const filtered = entries.filter(entry => {
      let currentFilterKey: FilterKey;
      
      if (entry.skipped) {
        currentFilterKey = 'skipped';
      } else if (entry.admin_status && statusConfig[entry.admin_status]) {
        currentFilterKey = statusConfig[entry.admin_status].filterKey as FilterKey;
      } else {
        currentFilterKey = 'listed'; 
        entry.admin_status = 'Listed';
      }
      
      newCounts[currentFilterKey]++;
      return filters[currentFilterKey];
    });
    
    setFilteredEntries(filtered);
    setStatusCounts(newCounts);
    logger.log('Filtered entries:', filtered.length, 'Filters:', filters, 'Counts:', newCounts);
  };

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const db = await databaseSwitcher.getDatabase();
      let allEntries = await db.getAllEntries();
      
      allEntries = allEntries.map(entry => ({
        ...entry,
        admin_status: entry.admin_status ?? 'Listed'
      }));

      allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEntries(allEntries);
      logger.log('Loaded entries:', allEntries.length, 'entries');
    } catch (error) {
      logger.error('Error loading entries:', error);
      toast.error('Failed to load videos');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetAdminStatus = async (entryId: string, newStatus: AdminStatus) => {
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedEntry = await db.setApprovalStatus(entryId, newStatus);
      
      if (updatedEntry) {
        setEntries(prevEntries => 
          prevEntries.map(e => e.id === entryId ? { ...e, admin_status: newStatus } : e)
        );
        toast.success(`Video status updated to ${newStatus}`);
      } else {
         toast.error(`Failed to update status to ${newStatus}`);
      }
    } catch (error: any) {
      logger.error(`Error setting status to ${newStatus} for entry ${entryId}:`, error);
      toast.error(error.message || `Failed to update status to ${newStatus}`);
    }
  };

  const handleDeleteEntry = async (entry: VideoEntry) => {
    if (!window.confirm(`Are you sure you want to delete this video by ${entry.reviewer_name} (ID: ${entry.id})?`)) {
      return;
    }

    try {
      const db = await databaseSwitcher.getDatabase();
      const success = await db.deleteEntry(entry.id);
      
      if (success) {
        setEntries(entries.filter(e => e.id !== entry.id));
        toast.success('Video deleted successfully');
      } else {
        toast.error('Failed to delete video');
      }
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error(error.message || 'Error deleting video');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL videos? This cannot be undone.')) {
      return;
    }

    try {
      const db = await databaseSwitcher.getDatabase();
      await db.clearAllEntries();
      setEntries([]);
      toast.success('All videos deleted successfully');
    } catch (error: any) {
      console.error('Error clearing entries:', error);
      toast.error(error.message || 'Failed to delete all videos');
    }
  };

  const handleDownloadCsv = () => {
    try {
      downloadEntriesAsCsv(filteredEntries, filters);
      toast.success('Download started');
    } catch (error) {
      logger.error('Error downloading CSV:', error);
      toast.error('Failed to download CSV');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getEntryStatusDetails = (entry: VideoEntry): { label: string, icon: React.ReactNode, variant: 'default' | 'secondary' | 'destructive' | 'outline', key: FilterKey } => {
    if (entry.skipped) {
      return { label: 'Skipped', icon: <SkipForward className="h-3 w-3 mr-1" />, variant: 'secondary', key: 'skipped' };
    }
    const status = entry.admin_status ?? 'Listed';
    if (statusConfig[status]) {
      return { ...statusConfig[status], key: statusConfig[status].filterKey as FilterKey };
    }
    logger.warn(`Unexpected admin_status found: ${status} for entry ${entry.id}. Defaulting to Listed.`);
    return { ...statusConfig.Listed, key: 'listed' }; 
  };

  const handleFilterChange = (key: FilterKey, checked: boolean) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [key]: checked
    }));
  };

  return (
    <RequireAuth requireAdmin>
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />

        <main className="container py-8 px-4 flex-1">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground mb-8">Manage video submissions and settings</p>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="videos">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">All Videos</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={loadEntries}
                    size="sm"
                  >
                    Refresh
                  </Button>
                  {filteredEntries.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadCsv}
                    >
                      <Download className="mr-1" size={16} />
                      Download CSV ({filteredEntries.length})
                    </Button>
                  )}
                  {entries.length > 0 && (
                    <Button 
                      variant="destructive" 
                      onClick={handleClearAll}
                      size="sm"
                    >
                      Delete All ({entries.length})
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-3 mb-2 p-4 bg-muted/50 rounded-lg">
                {(Object.keys(statusConfig) as AdminStatus[]).map(status => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`filter-${statusConfig[status].filterKey}`}
                      checked={filters[statusConfig[status].filterKey as FilterKey]}
                      onCheckedChange={(checked) => handleFilterChange(statusConfig[status].filterKey as FilterKey, checked as boolean)} 
                    />
                    <Label htmlFor={`filter-${statusConfig[status].filterKey}`}>{statusConfig[status].label}</Label>
                  </div>
                ))}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-skipped" 
                    checked={filters.skipped}
                    onCheckedChange={(checked) => handleFilterChange('skipped', checked as boolean)} 
                  />
                  <Label htmlFor="filter-skipped">Skipped</Label>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-6 px-4 py-2 text-sm text-muted-foreground">
                <div>
                  Showing <span className="font-medium text-foreground">{filteredEntries.length}</span> of <span className="font-medium text-foreground">{statusCounts.total}</span> videos
                </div>
                <div className="flex gap-3 flex-wrap">
                  {(Object.keys(statusConfig) as AdminStatus[]).map(status => (
                    filters[statusConfig[status].filterKey as FilterKey] && (
                      <span key={status} className="flex items-center">
                        {React.cloneElement(statusConfig[status].icon as React.ReactElement, { className: "h-3 w-3 mr-1" })}
                        {statusCounts[statusConfig[status].filterKey as FilterKey]} {statusConfig[status].filterKey}
                      </span>
                    )
                  ))}
                  {filters.skipped && (
                    <span className="flex items-center">
                      <SkipForward className="h-3 w-3 mr-1" />
                      {statusCounts.skipped} skipped
                    </span>
                  )}
                </div>
              </div>

              {isLoading ? (
                <p>Loading videos...</p>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">No videos match your current filters</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {filteredEntries.map(entry => {
                    const { label, icon, variant, key } = getEntryStatusDetails(entry);
                    
                    return (
                      <div key={entry.id} className="border rounded-lg overflow-hidden bg-card">
                        <div className="p-4 border-b flex justify-between items-start">
                          <div className="flex items-start gap-3 flex-1 mr-4">
                            <Badge variant={variant} className="flex items-center mt-1 whitespace-nowrap">
                              {icon}
                              {label}
                            </Badge>
                            <div className="flex-grow">
                              <h3 className="font-medium">{entry.reviewer_name}</h3>
                              <p className="text-sm text-muted-foreground">Uploaded: {formatDate(entry.created_at)}</p>
                              <p className="text-xs text-muted-foreground">ID: {entry.id}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                             <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Set Status <ChevronDown className="ml-1 h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(Object.keys(statusConfig) as AdminStatus[]).map(status => (
                                  <DropdownMenuItem 
                                    key={status}
                                    onClick={() => handleSetAdminStatus(entry.id, status)}
                                    disabled={entry.admin_status === status}
                                  >
                                    {React.cloneElement(statusConfig[status].icon as React.ReactElement, { className: "h-4 w-4 mr-2" })}
                                    {statusConfig[status].label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteEntry(entry)}
                              title="Delete Video"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <p className="text-sm font-medium mb-2">Original Video</p>
                          <div className="rounded overflow-hidden bg-black aspect-video">
                            <StorageVideoPlayer
                              videoLocation={entry.url}
                              className="w-full h-full"
                              controls
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings">
              <h2 className="text-2xl font-semibold mb-6">Application Settings</h2>
              <StorageSettings onSettingsSaved={loadEntries} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </RequireAuth>
  );
};

export default Admin;
