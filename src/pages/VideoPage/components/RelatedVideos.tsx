import React, { useState } from 'react';
import { VideoEntry } from '@/lib/types';
import { Check, X, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/EmptyState';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { NavigateFunction } from 'react-router-dom';

interface RelatedVideosProps {
  videos: VideoEntry[];
  assetId?: string;
  navigate: NavigateFunction;
}

const RelatedVideos: React.FC<RelatedVideosProps> = ({ videos, assetId, navigate }) => {
  const [assetFilter, setAssetFilter] = useState<{approved: boolean, notApproved: boolean}>({
    approved: true,
    notApproved: true
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const filteredVideos = videos.filter(video => {
    if (assetFilter.approved && video.admin_status === "Curated") return true;
    if (assetFilter.notApproved && (video.admin_status === "Rejected" || video.admin_status === "Listed")) return true;
    return false;
  });

  if (!assetId || videos.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Related Videos</h2>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-4">
            <h3 className="font-medium mb-2">Filter by approval</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="approved" 
                  checked={assetFilter.approved}
                  onCheckedChange={(checked) => 
                    setAssetFilter(prev => ({...prev, approved: checked === true}))
                  }
                />
                <Label htmlFor="approved">Curated</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="not-approved" 
                  checked={assetFilter.notApproved}
                  onCheckedChange={(checked) => 
                    setAssetFilter(prev => ({...prev, notApproved: checked === true}))
                  }
                />
                <Label htmlFor="not-approved">Listed/Rejected</Label>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {filteredVideos.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableCaption>List of related videos with the same asset ID.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Creator</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVideos.map(video => (
                  <TableRow key={video.id}>
                    <TableCell className="font-medium">
                      {video.metadata?.title || 'Untitled'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {video.metadata?.creatorName || video.reviewer_name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(video.created_at)}
                    </TableCell>
                    <TableCell>
                      {video.admin_status === "Curated" ? (
                        <Badge variant="secondary" className="gap-1 bg-green-500 hover:bg-green-600 text-white">
                          <Check className="h-3 w-3" />
                          Curated
                        </Badge>
                      ) : (
                        <Badge variant={video.admin_status === "Rejected" ? "destructive" : "outline"} className="gap-1">
                          {video.admin_status === "Rejected" && <X className="h-3 w-3" />}
                          {video.admin_status === "Rejected" ? "Rejected" : "Listed"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/videos/${video.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState 
          title="No related videos found"
          description="There are no other videos with this asset ID that match your current filter."
        />
      )}
    </div>
  );
};

export default RelatedVideos;
