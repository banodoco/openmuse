import React, { useState, useEffect } from 'react';
import { VideoEntry } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from 'sonner';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface VideoListProps {
  videos: VideoEntry[];
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  refetchData: () => void;
}

const VideoList: React.FC<VideoListProps> = ({ videos, onDelete, onApprove, onReject, refetchData }) => {
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [filterText, setFilterText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Automatically update selectAll when videos change
    if (videos && videos.length > 0) {
      setSelectAll(selectedVideos.length === videos.length);
    } else {
      setSelectAll(false);
    }
  }, [videos, selectedVideos]);

  const toggleVideoSelection = (id: string) => {
    setSelectedVideos((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((videoId) => videoId !== id)
        : [...prevSelected, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedVideos([]);
    } else {
      const allVideoIds = videos.map((video) => video.id);
      setSelectedVideos(allVideoIds);
    }
    setSelectAll(!selectAll);
  };

  const filteredVideos = videos.filter(video => {
    const searchTerm = filterText.toLowerCase();
    return (
      video.reviewer_name.toLowerCase().includes(searchTerm) ||
      video.id.toLowerCase().includes(searchTerm) ||
      (video.metadata?.title?.toLowerCase().includes(searchTerm) ?? false)
    );
  });

  const handleDeleteSelected = async () => {
    if (selectedVideos.length === 0) {
      toast.error('No videos selected for deletion.');
      return;
    }

    try {
      const db = await databaseSwitcher.getDatabase();
      for (const videoId of selectedVideos) {
        await db.deleteEntry(videoId);
      }
      toast.success('Selected videos deleted successfully.');
      setSelectedVideos([]);
      setSelectAll(false);
      refetchData(); // Refresh the video list
    } catch (error) {
      console.error('Error deleting selected videos:', error);
      toast.error('Failed to delete selected videos.');
    }
  };

  const handleApproveSelected = async () => {
    if (selectedVideos.length === 0) {
      toast.error('No videos selected for approval.');
      return;
    }

    try {
      const db = await databaseSwitcher.getDatabase();
      for (const videoId of selectedVideos) {
        await db.setApprovalStatus(videoId, true);
      }
      toast.success('Selected videos approved successfully.');
      setSelectedVideos([]);
      setSelectAll(false);
      refetchData();
    } catch (error) {
      console.error('Error approving selected videos:', error);
      toast.error('Failed to approve selected videos.');
    }
  };

  const handleRejectSelected = async () => {
    if (selectedVideos.length === 0) {
      toast.error('No videos selected for rejection.');
      return;
    }

    try {
      const db = await databaseSwitcher.getDatabase();
      for (const videoId of selectedVideos) {
        await db.setApprovalStatus(videoId, false);
      }
      toast.success('Selected videos rejected successfully.');
      setSelectedVideos([]);
      setSelectAll(false);
      refetchData();
    } catch (error) {
      console.error('Error rejecting selected videos:', error);
      toast.error('Failed to reject selected videos.');
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <Input
          type="text"
          placeholder="Filter videos..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex space-x-2">
          <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedVideos.length === 0}>
            Delete Selected
          </Button>
          <Button variant="outline" size="sm" onClick={handleApproveSelected} disabled={selectedVideos.length === 0}>
            Approve Selected
          </Button>
          <Button variant="secondary" size="sm" onClick={handleRejectSelected} disabled={selectedVideos.length === 0}>
            Reject Selected
          </Button>
        </div>
      </div>
      <ScrollArea>
        <Table>
          <TableCaption>A list of your proposed LoRAs.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Uploaded by</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVideos.map((video) => (
              <TableRow key={video.id}>
                <TableCell className="font-medium">
                  <Checkbox
                    checked={selectedVideos.includes(video.id)}
                    onCheckedChange={() => toggleVideoSelection(video.id)}
                    aria-label={`Select video ${video.id}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{video.metadata?.title || 'Untitled'}</TableCell>
                <TableCell>{video.reviewer_name}</TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {video.metadata?.model || 'Unknown model'}
                  </span>
                </TableCell>
                <TableCell>
                  {video.admin_approved === null ? (
                    <Badge variant="secondary">Pending</Badge>
                  ) : video.admin_approved ? (
                    <Badge variant="success">Approved</Badge>
                  ) : (
                    <Badge variant="destructive">Rejected</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate(`/videos/${video.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/edit/${video.id}`)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(video.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {video.admin_approved === null && (
                        <>
                          <DropdownMenuItem onClick={() => onApprove(video.id)}>
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onReject(video.id)}>
                            Reject
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredVideos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No videos found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};

export default VideoList;
