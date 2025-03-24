
import React, { useState, useEffect } from 'react';
import { VideoEntry, VideoMetadata } from '@/lib/types';
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
import { MoreVertical, Edit, Trash2, Eye, Check, X, ExternalLink } from 'lucide-react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

interface VideoListProps {
  videos: VideoEntry[];
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  refetchData: () => void;
}

// Form schema for video metadata editing
const videoMetadataSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  creator: z.enum(["self", "other"], {
    required_error: "Please specify who created this video.",
  }),
  creatorName: z.string().optional(),
  model: z.enum(["wan", "hunyuan", "ltxv", "cogvideox", "animatediff"], {
    required_error: "Please select which model this LoRA is for.",
  }),
});

const VideoList: React.FC<VideoListProps> = ({ videos, onDelete, onApprove, onReject, refetchData }) => {
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [editingVideo, setEditingVideo] = useState<VideoEntry | null>(null);
  const navigate = useNavigate();

  // Initialize form with react-hook-form
  const form = useForm<z.infer<typeof videoMetadataSchema>>({
    resolver: zodResolver(videoMetadataSchema),
    defaultValues: {
      title: "",
      description: "",
      creator: "self",
      creatorName: "",
      model: "wan"
    },
  });

  const creatorType = form.watch("creator");

  // Reset form when editing video changes
  useEffect(() => {
    if (editingVideo && editingVideo.metadata) {
      form.reset({
        title: editingVideo.metadata.title || "",
        description: editingVideo.metadata.description || "",
        creator: editingVideo.metadata.creator || "self",
        creatorName: editingVideo.metadata.creatorName || "",
        model: editingVideo.metadata.model || "wan"
      });
    }
  }, [editingVideo, form]);

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
      (video.metadata?.title?.toLowerCase().includes(searchTerm) ?? false) ||
      (video.metadata?.model?.toLowerCase().includes(searchTerm) ?? false)
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

  const saveVideoMetadata = async (data: z.infer<typeof videoMetadataSchema>) => {
    if (!editingVideo) return;

    try {
      const db = await databaseSwitcher.getDatabase();
      
      // Prepare updated metadata
      const updatedMetadata: VideoMetadata = {
        ...editingVideo.metadata,
        title: data.title,
        description: data.description,
        creator: data.creator,
        creatorName: data.creator === 'other' ? data.creatorName : undefined,
        model: data.model
      };
      
      // Update in database
      await db.updateEntry(editingVideo.id, {
        metadata: updatedMetadata
      });
      
      toast.success('Video details updated successfully.');
      refetchData();
      setEditingVideo(null);
    } catch (error) {
      console.error('Error updating video metadata:', error);
      toast.error('Failed to update video details.');
    }
  };

  const getModelBadge = (model?: string) => {
    switch (model) {
      case 'wan':
        return <Badge variant="default" className="bg-blue-500">Wan</Badge>;
      case 'hunyuan':
        return <Badge variant="default" className="bg-purple-500">Hunyuan</Badge>;
      case 'ltxv':
        return <Badge variant="default" className="bg-green-500">LTXV</Badge>;
      case 'cogvideox':
        return <Badge variant="default" className="bg-orange-500">CogVideoX</Badge>;
      case 'animatediff':
        return <Badge variant="default" className="bg-pink-500">Animatediff</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
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

      {/* Card layout for videos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {filteredVideos.map((video) => (
          <Card key={video.id} className={cn(
            "transition-all duration-200",
            selectedVideos.includes(video.id) ? "ring-2 ring-primary" : ""
          )}>
            <CardHeader className="relative pb-2">
              <div className="absolute top-4 right-4 flex items-center space-x-2">
                <Checkbox
                  checked={selectedVideos.includes(video.id)}
                  onCheckedChange={() => toggleVideoSelection(video.id)}
                  aria-label={`Select video ${video.id}`}
                />
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
                          <Check className="mr-2 h-4 w-4" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onReject(video.id)}>
                          <X className="mr-2 h-4 w-4" />
                          Reject
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <CardTitle className="text-lg">
                {video.metadata?.title || 'Untitled'}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {getModelBadge(video.metadata?.model)}
                {video.admin_approved === null ? (
                  <Badge variant="secondary">Pending</Badge>
                ) : video.admin_approved ? (
                  <Badge variant="success">Approved</Badge>
                ) : (
                  <Badge variant="destructive">Rejected</Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="pb-2">
              {video.metadata?.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {video.metadata.description}
                </p>
              )}
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creator:</span>
                  <span className="font-medium">
                    {video.metadata?.creator === 'self' ? 'Self' : video.metadata?.creatorName || 'Someone else'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uploaded by:</span>
                  <span className="font-medium">{video.reviewer_name}</span>
                </div>
                
                {video.metadata?.url && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">LoRA Link:</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 p-0" 
                      onClick={() => window.open(video.metadata?.url, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">View</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="pt-2">
              <div className="flex justify-between w-full">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(`/videos/${video.id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingVideo(video)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit Details
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}

        {filteredVideos.length === 0 && (
          <div className="col-span-full text-center py-10 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">No videos found.</p>
          </div>
        )}
      </div>

      {/* Edit Video Dialog */}
      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Video Details</DialogTitle>
            <DialogDescription>
              Update the information for this video.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(saveVideoMetadata)} className="space-y-4">
              {/* Title field */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Video title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Description field */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe this video" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Creator field */}
              <FormField
                control={form.control}
                name="creator"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Creator</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="self" id="creator-self" />
                          <Label htmlFor="creator-self">I made this</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="other" id="creator-other" />
                          <Label htmlFor="creator-other">Someone else made this</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Creator name field - conditional */}
              {creatorType === "other" && (
                <FormField
                  control={form.control}
                  name="creatorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Creator Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Name of creator" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {/* Model field */}
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="wan">Wan</SelectItem>
                        <SelectItem value="hunyuan">Hunyuan</SelectItem>
                        <SelectItem value="ltxv">LTXV</SelectItem>
                        <SelectItem value="cogvideox">CogVideoX</SelectItem>
                        <SelectItem value="animatediff">Animatediff</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingVideo(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoList;
