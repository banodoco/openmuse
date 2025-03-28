
import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { videoDB } from '@/lib/db';
import { VideoEntry } from '@/lib/types';
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
import { Download, CheckCircle, X, MessageCircle, SkipForward, MessageSquareOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const Admin: React.FC = () => {
  const [entries, setEntries] = useState<VideoEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');
  
  // Filter state
  const [showApproved, setShowApproved] = useState(true);
  const [showUnapproved, setShowUnapproved] = useState(true);
  const [showResponded, setShowResponded] = useState(true);
  const [showSkipped, setShowSkipped] = useState(true);
  const [showUnresponded, setShowUnresponded] = useState(true);

  // Status counts
  const [statusCounts, setStatusCounts] = useState({
    approved: 0,
    unapproved: 0,
    responded: 0,
    skipped: 0,
    unresponded: 0,
    total: 0
  });

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [entries, showApproved, showUnapproved, showResponded, showSkipped, showUnresponded]);

  const applyFilters = () => {
    // Count entries by status for statistics
    const counts = {
      approved: 0,
      unapproved: 0,
      responded: 0,
      skipped: 0,
      unresponded: 0,
      total: entries.length
    };
    
    const filtered = entries.filter(entry => {
      // Determine the single status for this entry
      let status: 'approved' | 'skipped' | 'responded' | 'unapproved' | 'unresponded';
      
      // Approved takes highest priority
      if (entry.admin_approved) {
        status = 'approved';
        counts.approved++;
      }
      // Then Skipped
      else if (entry.skipped) {
        status = 'skipped';
        counts.skipped++;
      }
      // Then any other video (Pending/Unapproved)
      else {
        status = 'unapproved';
        counts.unapproved++;
      }
      
      // Check if we should show this status
      return (
        (status === 'approved' && showApproved) ||
        (status === 'unapproved' && showUnapproved) ||
        (status === 'skipped' && showSkipped)
      );
    });
    
    setFilteredEntries(filtered);
    setStatusCounts(counts);
    console.log('Filtered entries:', filtered.length, 'Filters:', { 
      showApproved, 
      showUnapproved, 
      showSkipped
    });
  };

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const db = await databaseSwitcher.getDatabase();
      let allEntries;
      
      allEntries = await db.getAllEntries();
      
      allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEntries(allEntries);
      
      console.log('Loaded entries from database:', allEntries.length, 'entries');
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Failed to load videos');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveToggle = async (entry: VideoEntry) => {
    try {
      const db = await databaseSwitcher.getDatabase();
      // Update to pass a string value instead of a boolean
      const newStatus = entry.admin_approved === 'Curated' ? 'Listed' : 'Curated';
      const updatedEntry = await db.setApprovalStatus(entry.id, newStatus);
      
      if (updatedEntry) {
        setEntries(entries.map(e => e.id === entry.id ? updatedEntry : e));
        toast.success(`Video ${updatedEntry.admin_approved === 'Curated' ? 'approved' : 'unapproved'} successfully`);
      }
    } catch (error: any) {
      console.error('Error toggling approval:', error);
      toast.error(error.message || 'Failed to update approval status');
    }
  };

  const handleDeleteEntry = async (entry: VideoEntry) => {
    if (!window.confirm(`Are you sure you want to delete this video by ${entry.reviewer_name}?`)) {
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
      downloadEntriesAsCsv(filteredEntries, {
        showApproved,
        showUnapproved,
        showSkipped
      });
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading CSV:', error);
      toast.error('Failed to download CSV');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getEntryStatus = (entry: VideoEntry): {
    status: 'approved' | 'skipped' | 'unapproved',
    label: string,
    icon: React.ReactNode,
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  } => {
    if (entry.admin_approved) {
      return {
        status: 'approved',
        label: 'Approved',
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
        variant: 'default'
      };
    } else if (entry.skipped) {
      return {
        status: 'skipped',
        label: 'Skipped',
        icon: <SkipForward className="h-3 w-3 mr-1" />,
        variant: 'secondary'
      };
    } else {
      return {
        status: 'unapproved',
        label: 'Unapproved',
        icon: <X className="h-3 w-3 mr-1" />,
        variant: 'destructive'
      };
    }
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
                      Download CSV
                    </Button>
                  )}
                  {entries.length > 0 && (
                    <Button 
                      variant="destructive" 
                      onClick={handleClearAll}
                      size="sm"
                    >
                      Delete All
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-6 mb-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-approved" 
                    checked={showApproved} 
                    onCheckedChange={(checked) => setShowApproved(checked as boolean)} 
                  />
                  <Label htmlFor="filter-approved">Approved</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-unapproved" 
                    checked={showUnapproved} 
                    onCheckedChange={(checked) => setShowUnapproved(checked as boolean)} 
                  />
                  <Label htmlFor="filter-unapproved">Unapproved</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-skipped" 
                    checked={showSkipped} 
                    onCheckedChange={(checked) => setShowSkipped(checked as boolean)} 
                  />
                  <Label htmlFor="filter-skipped">Skipped</Label>
                </div>
              </div>

              {/* Video count statistics */}
              <div className="flex flex-wrap gap-4 mb-6 px-4 py-2 text-sm text-muted-foreground">
                <div>
                  Showing <span className="font-medium text-foreground">{filteredEntries.length}</span> of <span className="font-medium text-foreground">{statusCounts.total}</span> videos
                </div>
                <div className="flex gap-3">
                  {showApproved && (
                    <span className="flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1 text-primary" />
                      {statusCounts.approved} approved
                    </span>
                  )}
                  {showUnapproved && (
                    <span className="flex items-center">
                      <X className="h-3 w-3 mr-1 text-destructive" />
                      {statusCounts.unapproved} unapproved
                    </span>
                  )}
                  {showSkipped && (
                    <span className="flex items-center">
                      <SkipForward className="h-3 w-3 mr-1 text-secondary-foreground" />
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
                    const { label, icon, variant } = getEntryStatus(entry);
                    
                    return (
                      <div key={entry.id} className="border rounded-lg overflow-hidden bg-card">
                        <div className="p-4 border-b flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Badge variant={variant} className="flex items-center">
                              {icon}
                              {label}
                            </Badge>
                            <div>
                              <h3 className="font-medium">{entry.reviewer_name}</h3>
                              <p className="text-sm text-muted-foreground">Uploaded: {formatDate(entry.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              variant={entry.admin_approved ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleApproveToggle(entry)}
                            >
                              {entry.admin_approved ? "Unapprove" : "Approve"}
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteEntry(entry)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <p className="text-sm font-medium mb-2">Original Video</p>
                          <div className="rounded overflow-hidden bg-black aspect-video">
                            <StorageVideoPlayer
                              videoLocation={entry.video_location}
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
