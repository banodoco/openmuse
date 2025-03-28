
import React, { useState } from 'react';
import { VideoEntry } from '@/lib/types';
import { NavigateFunction } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Filter, Check, X, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from "@/components/ui/popover";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface RelatedVideosProps {
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
    if (assetFilter.approved && video.admin_approved === "Curated") return true;
    if (assetFilter.notApproved && video.admin_approved !== "Curated") return true;
    return false;
  });

  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Related {assetId ? 'Assets' : 'Videos'}</h2>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-4">
            <h3 className="font-medium mb-2">Filter by curation</h3>
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
                <Label htmlFor="not-approved">Not Curated</Label>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {filteredVideos.length > 0 ? (
        <Table>
          <TableCaption>List of related videos{assetId ? ' with the same asset ID' : ''}.</TableCaption>
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
            {filteredVideos.map(relatedVideo => (
              <TableRow key={relatedVideo.id}>
                <TableCell>{relatedVideo.metadata?.title || 'Untitled'}</TableCell>
                <TableCell>{relatedVideo.metadata?.creatorName || relatedVideo.reviewer_name}</TableCell>
                <TableCell>{formatDate(relatedVideo.created_at)}</TableCell>
                <TableCell>
                  {relatedVideo.admin_approved === "Curated" ? (
                    <Badge variant="secondary" className="gap-1 bg-green-500 hover:bg-green-600 text-white">
                      <Check className="h-3 w-3" />
                      Curated
                    </Badge>
                  ) : relatedVideo.admin_approved === "Rejected" ? (
                    <Badge variant="destructive" className="gap-1">
                      <X className="h-3 w-3" />
                      Rejected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      Listed
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate(`/videos/${relatedVideo.id}`)}
                    className="gap-1"
                  >
                    <ArrowRight className="h-3 w-3" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState 
          title="No related videos found"
          description="There are no other videos associated with this video, or none match your current filter."
        />
      )}
    </div>
  );
};

export default RelatedVideos;
