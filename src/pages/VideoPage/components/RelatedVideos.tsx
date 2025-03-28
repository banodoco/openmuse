
import React, { useState } from 'react';
import { VideoEntry } from '@/lib/types';
import { NavigateFunction } from 'react-router-dom';
import { Check, X, Filter, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/EmptyState';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface RelatedVideosProps {
  assetId: string;
  videos: VideoEntry[];
  navigate: NavigateFunction;
}

const RelatedVideos: React.FC<RelatedVideosProps> = ({ assetId, videos, navigate }) => {
  const [assetFilter, setAssetFilter] = useState<{approved: boolean, notApproved: boolean}>({
    approved: true,
    notApproved: true
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  const filteredRelatedVideos = videos.filter(video => {
    if (assetFilter.approved && video.admin_approved === true) return true;
    if (assetFilter.notApproved && (video.admin_approved === false || video.admin_approved === null)) return true;
    return false;
  });

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Related Assets</h2>
        
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
                <Label htmlFor="approved">Approved</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="not-approved" 
                  checked={assetFilter.notApproved}
                  onCheckedChange={(checked) => 
                    setAssetFilter(prev => ({...prev, notApproved: checked === true}))
                  }
                />
                <Label htmlFor="not-approved">Not Approved</Label>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {filteredRelatedVideos.length > 0 ? (
        <Table>
          <TableCaption>List of related videos with the same asset ID.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRelatedVideos.map(relatedVideo => (
              <TableRow key={relatedVideo.id}>
                <TableCell>{relatedVideo.metadata?.title || 'Untitled'}</TableCell>
                <TableCell>{relatedVideo.metadata?.creatorName || relatedVideo.reviewer_name}</TableCell>
                <TableCell>{formatDate(relatedVideo.created_at)}</TableCell>
                <TableCell>
                  {relatedVideo.admin_approved === true ? (
                    <Badge variant="secondary" className="gap-1 bg-green-500 hover:bg-green-600 text-white">
                      <Check className="h-3 w-3" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <X className="h-3 w-3" />
                      Not Approved
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate(`/videos/${relatedVideo.id}`)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState 
          title="No related assets found"
          description="There are no other assets associated with this video, or none match your current filter."
        />
      )}
    </div>
  );
};

export default RelatedVideos;
