**Commit:** `a3f1791`
**Author:** POM
**Date:** 2025-04-22
**Message:** feat: add thumbnail generation and aspect ratio to media-only uploads, remove model_variant field
```diff
diff --git a/src/pages/upload/UploadPage.tsx b/src/pages/upload/UploadPage.tsx
index 9cc4884..ed79198 100644
--- a/src/pages/upload/UploadPage.tsx
+++ b/src/pages/upload/UploadPage.tsx
@@ -148,6 +148,24 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
         // create media rows & link to LoRA assets
         for (const video of videos) {
           if (!video.url) continue;
+          
+          // Calculate aspect ratio for media-only upload
+          let aspectRatio = 16 / 9; // Default aspect ratio
+          try {
+            aspectRatio = await getVideoAspectRatio(video.url);
+          } catch (ratioError) {
+            logger.warn(`Could not calculate aspect ratio for ${video.url}:`, ratioError);
+            // Keep default aspect ratio
+          }
+
+          // Generate thumbnail for media-only upload
+          let thumbnailUrl: string | null = null;
+          try {
+            thumbnailUrl = await thumbnailService.generateThumbnail(video.url);
+          } catch (thumbError) {
+             logger.warn(`Could not generate thumbnail for ${video.url}:`, thumbError);
+          }
+
           const { data: mediaData, error: mediaError } = await supabase
             .from('media')
             .insert({
@@ -157,7 +175,9 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
               classification: video.metadata.classification || 'art',
               creator: video.metadata.creator === 'self' ? reviewerName : video.metadata.creatorName,
               user_id: user?.id || null,
-              metadata: {}
+              metadata: { aspectRatio: aspectRatio },
+              placeholder_image: thumbnailUrl,
+              admin_status: 'Listed'
             })
             .select()
             .single();
@@ -321,12 +341,12 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
               title: video.metadata.title || '',
               url: videoUrl,
               type: 'video',
-              model_variant: loraDetails.modelVariant,
               classification: video.metadata.classification || 'art',
               creator: video.metadata.creator === 'self' ? reviewerName : video.metadata.creatorName,
               user_id: user?.id || null,
-              placeholder_image: thumbnailUrl, // Save the generated thumbnail URL
-              metadata: { aspectRatio: aspectRatio } // <-- Store aspect ratio
+              placeholder_image: thumbnailUrl,
+              metadata: { aspectRatio: aspectRatio },
+              admin_status: 'Listed'
             })
             .select()
             .single();
```
---
**Commit:** `41fd023`
**Author:** POM
**Date:** 2025-04-23
**Message:** feat: remove creator field in favor of user_id, simplify media metadata
```diff
diff --git a/src/components/VideoList.tsx b/src/components/VideoList.tsx
index 9f52a6b..cb887d9 100644
--- a/src/components/VideoList.tsx
+++ b/src/components/VideoList.tsx
@@ -4,7 +4,7 @@ import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from "@/components/ui/scroll-area"
 import { Button } from '@/components/ui/button';
 import { useNavigate } from 'react-router-dom';
-import { MoreVertical, Edit, Trash2, Eye, FileVideo, Star } from 'lucide-react';
+import { MoreVertical, Edit, Trash2, Eye, FileVideo, Star, UserCircle } from 'lucide-react';
 import {
   DropdownMenu,
   DropdownMenuContent,
@@ -325,12 +325,10 @@ const VideoList: React.FC<VideoListProps> = ({
               
               <CardContent className="px-4 py-2 text-xs">
                 <div className="space-y-1">
-                  <div className="flex justify-between">
-                    <span className="text-muted-foreground">Created by:</span>
-                    <span className="font-medium">
-                      {video.metadata?.creator === 'self' 
-                        ? video.reviewer_name 
-                        : video.metadata?.creatorName || 'Unknown'}
+                  <div className="flex items-center space-x-2">
+                    <UserCircle size={16} className="text-muted-foreground" />
+                    <span className="text-xs text-muted-foreground">
+                      {video.user_id ? `User ${video.user_id.substring(0, 6)}...` : 'Unknown Creator'}
                     </span>
                   </div>
                 </div>
diff --git a/src/components/upload/VideoMetadataForm.tsx b/src/components/upload/VideoMetadataForm.tsx
index 0675f4f..bf358d1 100644
--- a/src/components/upload/VideoMetadataForm.tsx
+++ b/src/components/upload/VideoMetadataForm.tsx
@@ -19,8 +19,6 @@ interface VideoMetadataFormProps {
     title: string;
     description: string;
     classification: 'art' | 'gen'; // Expects 'gen'
-    creator: 'self' | 'someone_else';
-    creatorName: string;
     isPrimary?: boolean;
     associatedLoraIds?: string[]; // Add associated Lora IDs here too if not inferred
   };
@@ -108,43 +106,7 @@ const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({
                   </div>
                 </RadioGroup>
               </div>
-              
-              <div>
-                <Label className="text-sm font-medium mb-2 block">Creator</Label>
-                <RadioGroup 
-                  value={metadata.creator}
-                  onValueChange={(value) => updateMetadata(videoId, 'creator', value)}
-                  className="flex flex-col space-y-2"
-                  disabled={disabled}
-                >
-                  <div className="flex items-center space-x-2">
-                    <RadioGroupItem value="self" id={`creator-self-${videoId}`} />
-                    <Label htmlFor={`creator-self-${videoId}`} className="cursor-pointer">Me</Label>
-                  </div>
-                  <div className="flex items-center space-x-2">
-                    <RadioGroupItem value="someone_else" id={`creator-someone-else-${videoId}`} />
-                    <Label htmlFor={`creator-someone-else-${videoId}`} className="cursor-pointer">Someone else</Label>
-                  </div>
-                </RadioGroup>
-              </div>
             </div>
-            
-            {metadata.creator === 'someone_else' && (
-              <div>
-                <Label htmlFor={`creator-name-${videoId}`} className="text-sm font-medium mb-1.5 block">
-                  Creator Username <span className="text-destructive">*</span>
-                </Label>
-                <Input
-                  type="text"
-                  id={`creator-name-${videoId}`}
-                  placeholder="Username of the creator"
-                  value={metadata.creatorName}
-                  onChange={(e) => updateMetadata(videoId, 'creatorName', e.target.value)}
-                  required
-                  disabled={disabled}
-                />
-              </div>
-            )}
           </div>
           
           {canSetPrimary && (
diff --git a/src/lib/csvUtils.ts b/src/lib/csvUtils.ts
index 1ced652..42a35c3 100644
--- a/src/lib/csvUtils.ts
+++ b/src/lib/csvUtils.ts
@@ -17,8 +17,10 @@ export const convertToCSV = (videos: VideoEntry[]): string => {
     'Creation Date',
     'Video URL',
     'Title',
-    'Creator',
+    'Description',
     'Classification',
+    'URL',
+    'Placeholder Image',
   ];
 
   // Map data to CSV rows
@@ -34,10 +36,12 @@ export const convertToCSV = (videos: VideoEntry[]): string => {
       `"${video.reviewer_name.replace(/"/g, '""')}"`,
       adminStatus,
       formattedDate,
-      `"${video.url}"`,
-      `"${(video.metadata?.title || 'No title').replace(/"/g, '""')}"`,
-      `"${(video.metadata?.creator === 'self' ? 'Self' : video.metadata?.creatorName || 'Someone else').replace(/"/g, '""')}"`,
-      `"${(video.metadata?.classification || 'Unknown').replace(/"/g, '""')}"`,
+      `"${video.url || ''}"`,
+      `"${(video.title || '').replace(/"/g, '""')}"`,
+      `"${(video.description || '').replace(/"/g, '""')}"`,
+      `"${video.metadata?.classification || 'gen'}"`,
+      `"${video.url || ''}"`,
+      `"${video.placeholder_image || ''}"`,
     ].map(field => field === undefined || field === null ? '' : field);
   });
 
diff --git a/src/lib/database/SupabaseDatabase.ts b/src/lib/database/SupabaseDatabase.ts
index f893253..d55b5a8 100644
--- a/src/lib/database/SupabaseDatabase.ts
+++ b/src/lib/database/SupabaseDatabase.ts
@@ -89,7 +89,6 @@ export class SupabaseDatabase extends BaseDatabase {
         .update({
           title: update.metadata?.title,
           classification: update.metadata?.classification,
-          creator: update.metadata?.creatorName || update.reviewer_name,
           admin_status: update.admin_status
         })
         .eq('id', id)
@@ -107,7 +106,6 @@ export class SupabaseDatabase extends BaseDatabase {
           .update({
             name: update.metadata.loraName,
             description: update.metadata.loraDescription,
-            creator: update.metadata.creatorName || update.reviewer_name,
             admin_status: update.admin_status,
             user_status: update.user_status
           })
@@ -128,9 +126,8 @@ export class SupabaseDatabase extends BaseDatabase {
         user_status: mediaData.user_status || null,
         user_id: mediaData.user_id,
         metadata: {
-          title: mediaData.title,
+          title: mediaData.title || '',
           description: update.metadata?.description || '',
-          creator: update.metadata?.creator || 'self',
           classification: mediaData.classification || 'art',
           loraName: update.metadata?.loraName,
           loraDescription: update.metadata?.loraDescription,
diff --git a/src/lib/database/SupabaseDatabaseOperations.ts b/src/lib/database/SupabaseDatabaseOperations.ts
index 44c8dcd..6ded62e 100644
--- a/src/lib/database/SupabaseDatabaseOperations.ts
+++ b/src/lib/database/SupabaseDatabaseOperations.ts
@@ -131,7 +131,6 @@ export class SupabaseDatabaseOperations extends SupabaseDatabase {
           url: entry.url,
           type: 'video',
           classification: entry.metadata?.classification || 'art',
-          creator: entry.metadata?.creatorName || entry.reviewer_name,
           user_id: entry.user_id || this.currentUserId,
           admin_status: 'Listed',
           user_status: null,
diff --git a/src/lib/services/videoEntryService.ts b/src/lib/services/videoEntryService.ts
index e0dc976..b0b5951 100644
--- a/src/lib/services/videoEntryService.ts
+++ b/src/lib/services/videoEntryService.ts
@@ -56,15 +56,9 @@ export class VideoEntryService {
           metadata: {
             title: media.title,
             description: media.description || '',
-            creator: 'self',
-            creatorName: media.creator || 'Unknown',
-            classification: media.classification || 'art',
-            loraName: undefined,
-            loraDescription: undefined,
-            assetId: undefined,
+            classification: (media.classification as 'art' | 'gen') || 'gen',
             isPrimary: false,
-            placeholder_image: media.placeholder_image,
-            aspectRatio: (media.metadata as any)?.aspectRatio ?? null
+            aspectRatio: (media.metadata as any)?.aspectRatio || 16/9,
           }
         };
         
@@ -82,15 +76,17 @@ export class VideoEntryService {
     try {
       // Prepare the update object for the 'media' table
       const mediaUpdate: Record<string, any> = {};
-      if (update.metadata?.title !== undefined) mediaUpdate.title = update.metadata.title;
-      if (update.metadata?.classification !== undefined) mediaUpdate.classification = update.metadata.classification;
-      if (update.metadata?.creatorName !== undefined || update.reviewer_name !== undefined) {
-         mediaUpdate.creator = update.metadata?.creatorName || update.reviewer_name;
-      }
+      if (update.metadata?.title) mediaUpdate.title = update.metadata.title;
+      if (update.metadata?.description) mediaUpdate.description = update.metadata.description;
+      if (update.metadata?.classification) mediaUpdate.classification = update.metadata.classification;
       if (update.admin_status !== undefined) mediaUpdate.admin_status = update.admin_status;
       if (update.user_status !== undefined) mediaUpdate.user_status = update.user_status;
-      if (update.metadata?.description !== undefined) mediaUpdate.description = update.metadata.description;
       if (update.admin_reviewed !== undefined) mediaUpdate.admin_reviewed = update.admin_reviewed;
+      if (update.placeholder_image) mediaUpdate.placeholder_image = update.placeholder_image;
+      if (update.metadata?.aspectRatio) {
+        if (!mediaUpdate.metadata) mediaUpdate.metadata = {};
+        mediaUpdate.metadata.aspectRatio = update.metadata.aspectRatio;
+      }
 
       // Only proceed if there's something to update
       if (Object.keys(mediaUpdate).length === 0) {
@@ -112,19 +108,19 @@ export class VideoEntryService {
            reviewer_name: existingData.creator || 'Unknown',
            skipped: false,
            created_at: existingData.created_at,
-           admin_status: existingData.admin_status || 'Listed',
-           user_status: existingData.user_status || null,
+           admin_status: (existingData.admin_status as AdminStatus) || null,
+           user_status: (existingData.user_status as AdminStatus) || null,
            user_id: existingData.user_id,
            admin_reviewed: existingData.admin_reviewed || false,
            metadata: {
-             title: existingData.title,
+             title: existingData.title || '',
              description: existingData.description || '',
-             creator: 'self',
-             creatorName: existingData.creator || 'Unknown',
-             classification: existingData.classification || 'art',
-             placeholder_image: existingData.placeholder_image,
-             aspectRatio: (existingData.metadata as any)?.aspectRatio ?? null
-           }
+             classification: (existingData.classification as 'art' | 'gen') || 'gen',
+             isPrimary: false,
+             aspectRatio: (existingData.metadata as any)?.aspectRatio || 16/9,
+           },
+           associatedAssetId: null,
+           placeholder_image: existingData.placeholder_image,
          };
          return mappedData;
       }
@@ -148,19 +144,19 @@ export class VideoEntryService {
         reviewer_name: data.creator || 'Unknown',
         skipped: false,
         created_at: data.created_at,
-        admin_status: data.admin_status || 'Listed',
-        user_status: data.user_status || null,
+        admin_status: (data.admin_status as AdminStatus) || null,
+        user_status: (data.user_status as AdminStatus) || null,
         user_id: data.user_id,
         admin_reviewed: data.admin_reviewed || false,
         metadata: {
-          title: data.title,
+          title: data.title || '',
           description: data.description || '',
-          creator: 'self',
-          creatorName: data.creator || 'Unknown',
-          classification: data.classification || 'art',
-          placeholder_image: data.placeholder_image,
-          aspectRatio: (data.metadata as any)?.aspectRatio ?? null
-        }
+          classification: (data.classification as 'art' | 'gen') || 'gen',
+          isPrimary: false,
+          aspectRatio: (data.metadata as any)?.aspectRatio || 16/9,
+        },
+        associatedAssetId: null,
+        placeholder_image: data.placeholder_image,
       };
       
       return updatedEntry;
diff --git a/src/lib/services/videoUploadService.ts b/src/lib/services/videoUploadService.ts
index 19228a9..a300ec5 100644
--- a/src/lib/services/videoUploadService.ts
+++ b/src/lib/services/videoUploadService.ts
@@ -66,7 +66,6 @@ class VideoUploadService {
           url: videoUrl,
           type: 'video',
           classification: videoFile.metadata?.classification || 'art',
-          creator: videoFile.metadata?.creatorName || reviewerName,
           user_id: userId || this.currentUserId,
           admin_status: 'Listed',
           placeholder_image: thumbnailUrl,
@@ -183,7 +182,6 @@ class VideoUploadService {
           url: videoUrl,
           type: 'video',
           classification: videoFile.metadata?.classification || 'art',
-          creator: videoFile.metadata?.creatorName || reviewerName,
           user_id: userId || this.currentUserId,
           admin_status: 'Listed',
           placeholder_image: thumbnailUrl,
@@ -348,7 +346,6 @@ class VideoUploadService {
           url: entryData.url,
           type: 'video',
           classification: entryData.metadata?.classification || 'art',
-          creator: entryData.metadata?.creatorName || entryData.reviewer_name,
           user_id: entryData.user_id || this.currentUserId,
           admin_status: 'Listed',
           placeholder_image: entryData.metadata?.placeholder_image,
@@ -437,7 +434,6 @@ class VideoUploadService {
           url: entryData.url,
           type: 'video',
           classification: entryData.metadata?.classification || 'art',
-          creator: entryData.metadata?.creatorName || entryData.reviewer_name,
           user_id: entryData.user_id || this.currentUserId,
           admin_status: 'Listed',
           placeholder_image: thumbnailUrl,
diff --git a/src/lib/types.ts b/src/lib/types.ts
index 97d3c28..2892910 100644
--- a/src/lib/types.ts
+++ b/src/lib/types.ts
@@ -2,10 +2,8 @@ import { UserAssetPreferenceStatus } from '@/components/lora/LoraCard';
 
 export interface VideoMetadata {
   title: string;
-  description?: string;
-  creator?: 'self' | 'someone_else';
-  creatorName?: string;
-  classification?: 'art' | 'gen';
+  description: string;
+  classification: 'art' | 'gen';
   isPrimary?: boolean;
   loraName?: string;
   loraDescription?: string;
@@ -19,7 +17,8 @@ export interface VideoMetadata {
   trainingSteps?: string | number;
   resolution?: string;
   trainingDataset?: string;
-  aspectRatio?: number | null;
+  aspectRatio?: number;
+  associatedLoraIds?: string[];
 }
 
 export type VideoDisplayStatus = 'Pinned' | 'View' | 'Hidden';
@@ -114,10 +113,8 @@ export interface LoraManagerProps {
 // Standard video metadata form interface to be used across components
 export interface VideoMetadataForm {
   title: string;
-  description: string;
+  description: string
   classification: 'art' | 'gen';
-  creator: 'self' | 'someone_else';
-  creatorName: string;
   isPrimary?: boolean;
 }
 
@@ -129,5 +126,5 @@ export interface VideoItem {
   metadata: VideoMetadataForm;
   associatedLoraIds?: string[];
 }
-
+ 
 export type { UserAssetPreferenceStatus } from '@/components/lora/LoraCard';
diff --git a/src/pages/AssetDetailPage/hooks/useAssetDetails.tsx b/src/pages/AssetDetailPage/hooks/useAssetDetails.tsx
index 7d24262..a6e54a5 100644
--- a/src/pages/AssetDetailPage/hooks/useAssetDetails.tsx
+++ b/src/pages/AssetDetailPage/hooks/useAssetDetails.tsx
@@ -124,8 +124,6 @@ export const useAssetDetails = (assetId: string | undefined) => {
                   title: pVideo.title || '',
                   placeholder_image: pVideo.placeholder_image || null,
                   description: pVideo.description,
-                  creator: (pVideo as any)?.creator ? 'self' : undefined,
-                  creatorName: (pVideo as any)?.creator_name,
                   classification: (pVideo as any)?.classification,
                   loraName: assetData.name,
                   assetId: assetData.id,
@@ -178,8 +176,6 @@ export const useAssetDetails = (assetId: string | undefined) => {
                 assetId: processedAsset.id,
                 loraType: processedAsset.lora_type,
                 loraLink: processedAsset.lora_link,
-                creator: media.creator ? 'self' : undefined,
-                creatorName: media.creator_name,
                 modelVariant: processedAsset.model_variant,
                 aspectRatio: (media.metadata as any)?.aspectRatio ?? null
               },
diff --git a/src/pages/UserProfilePage.tsx b/src/pages/UserProfilePage.tsx
index 08220d7..c47bc20 100644
--- a/src/pages/UserProfilePage.tsx
+++ b/src/pages/UserProfilePage.tsx
@@ -310,6 +310,8 @@ export default function UserProfilePage() {
               title: video.title || '',
               description: video.description || '',
               is_primary: false,
+              aspectRatio: (video.metadata as any)?.aspectRatio || 16/9,
+              classification: (video.classification as 'art' | 'gen') || 'gen',
             };
           }).filter(Boolean) as VideoEntry[];
 
@@ -871,7 +873,7 @@ export default function UserProfilePage() {
         <VideoLightbox isOpen={!!lightboxVideo} onClose={handleCloseLightbox} videoUrl={lightboxVideo.url} videoId={lightboxVideo.id}
           title={lightboxVideo.metadata?.title} description={lightboxVideo.metadata?.description}
           initialAssetId={lightboxVideo.associatedAssetId ?? undefined}
-          creator={lightboxVideo.user_id || lightboxVideo.metadata?.creatorName}
+          creator={lightboxVideo.user_id}
           thumbnailUrl={lightboxVideo.placeholder_image || lightboxVideo.metadata?.placeholder_image}
           creatorId={lightboxVideo.user_id}
           onVideoUpdate={() => { if (profile?.id) fetchUserVideos(profile.id, user?.id, isAdmin && !forceLoggedOutView, false); }}
diff --git a/src/pages/upload/UploadPage.tsx b/src/pages/upload/UploadPage.tsx
index ed79198..d66dfd6 100644
--- a/src/pages/upload/UploadPage.tsx
+++ b/src/pages/upload/UploadPage.tsx
@@ -173,7 +173,6 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
               url: video.url,
               type: 'video',
               classification: video.metadata.classification || 'art',
-              creator: video.metadata.creator === 'self' ? reviewerName : video.metadata.creatorName,
               user_id: user?.id || null,
               metadata: { aspectRatio: aspectRatio },
               placeholder_image: thumbnailUrl,
@@ -223,14 +222,6 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
       return;
     }
     
-    const missingCreatorNames = videos.filter(
-      video => video.file && video.metadata.creator === 'someone_else' && !video.metadata.creatorName
-    );
-    if (missingCreatorNames.length > 0) {
-      toast.error('Please provide the creator name for all videos created by someone else');
-      return;
-    }
-
     const hasPrimary = videos.some(video => (video.file || video.url) && video.metadata.isPrimary);
     if (!hasPrimary) {
       toast.error('Please set one video as the primary media for this LoRA');
@@ -342,7 +333,6 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
               url: videoUrl,
               type: 'video',
               classification: video.metadata.classification || 'art',
-              creator: video.metadata.creator === 'self' ? reviewerName : video.metadata.creatorName,
               user_id: user?.id || null,
               placeholder_image: thumbnailUrl,
               metadata: { aspectRatio: aspectRatio },
diff --git a/src/pages/upload/components/MultipleVideoUploader.tsx b/src/pages/upload/components/MultipleVideoUploader.tsx
index 36a93a3..7d1cecb 100644
--- a/src/pages/upload/components/MultipleVideoUploader.tsx
+++ b/src/pages/upload/components/MultipleVideoUploader.tsx
@@ -63,8 +63,6 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
       title: '',
       description: '',
       classification: defaultClassification,
-      creator: 'self',
-      creatorName: user?.email || '',
       isPrimary: videos.length === 0,
       associatedLoraIds: []
     },
@@ -96,8 +94,6 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
             title: '',
             description: '',
             classification: defaultClassification,
-            creator: 'self' as 'self' | 'someone_else',
-            creatorName: user?.email || '',
             isPrimary: isFirst,
             associatedLoraIds: []
           },
@@ -133,8 +129,6 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
           title: '',
           description: '',
           classification: defaultClassification,
-          creator: 'self',
-          creatorName: user?.email || '',
           isPrimary: isFirst,
           associatedLoraIds: []
         },
@@ -173,8 +167,6 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
             title: '',
             description: '',
             classification: defaultClassification,
-            creator: 'self' as 'self' | 'someone_else',
-            creatorName: user?.email || '',
             isPrimary: isFirst,
             associatedLoraIds: []
           },
```
---
**Commit:** `459af0e`
**Author:** POM
**Date:** 2025-04-23
**Message:** feat: make LoRA selection optional for video uploads, add logging for debugging LoRA selection issues
```diff
diff --git a/src/components/upload/VideoMetadataForm.tsx b/src/components/upload/VideoMetadataForm.tsx
index bf358d1..65f3a31 100644
--- a/src/components/upload/VideoMetadataForm.tsx
+++ b/src/components/upload/VideoMetadataForm.tsx
@@ -7,6 +7,9 @@ import { Switch } from '@/components/ui/switch';
 import { useAuth } from '@/hooks/useAuth';
 import { Card, CardContent } from "@/components/ui/card";
 import { LoraMultiSelectCombobox } from '@/components/upload/LoraMultiSelectCombobox';
+import { Logger } from '@/lib/logger';
+
+const logger = new Logger('VideoMetadataForm');
 
 type LoraOption = {
   id: string;
@@ -35,19 +38,32 @@ const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({
   updateMetadata, 
   canSetPrimary = true,
   disabled = false,
-  showLoraSelector = false, 
+  showLoraSelector = false,
   availableLoras = [], 
 }) => {
   const { user } = useAuth();
   
+  logger.log(`Rendering VideoMetadataForm for videoId: ${videoId}. Received props:`, {
+    canSetPrimary,
+    disabled,
+    showLoraSelector,
+    availableLorasCount: availableLoras.length,
+    initialSelectedLoraIds: metadata.associatedLoraIds || []
+  });
+
   // Handler specifically for the LoRA selector within this form
   const handleLoraSelectionChange = (selectedIds: string[]) => {
+    logger.log(`LoRA selection changed for video ${videoId}:`, selectedIds);
     updateMetadata(videoId, 'associatedLoraIds', selectedIds);
   };
 
   // Extract selected IDs from metadata, default to empty array
   const associatedLoraIds = metadata.associatedLoraIds || [];
 
+  // Prepare options for the combobox
+  const loraOptions = availableLoras.map(lora => ({ value: lora.id, label: lora.name }));
+  logger.log(`Prepared LoRA options for combobox (video ${videoId}):`, loraOptions);
+
   return (
     <Card>
       <CardContent className="pt-6">
diff --git a/src/pages/upload/UploadPage.tsx b/src/pages/upload/UploadPage.tsx
index 4a1f8cf..a26d67b 100644
--- a/src/pages/upload/UploadPage.tsx
+++ b/src/pages/upload/UploadPage.tsx
@@ -119,13 +119,13 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
       // MEDIA ONLY FLOW --------------------------------------------------
 
       // Check if *any* video is missing a LoRA selection (if not forced)
-      if (!finalForcedLoraId) {
-        const videoMissingLoras = videos.find(v => !v.metadata.associatedLoraIds || v.metadata.associatedLoraIds.length === 0);
-        if (videoMissingLoras) {
-          toast.error(`Please select the LoRA(s) used for all videos (missing for video: ${videoMissingLoras.metadata.title || videoMissingLoras.id})`);
-          return;
-        }
-      }
+      // if (!finalForcedLoraId) {
+      //   const videoMissingLoras = videos.find(v => !v.metadata.associatedLoraIds || v.metadata.associatedLoraIds.length === 0);
+      //   if (videoMissingLoras) {
+      //     toast.error(`Please select the LoRA(s) used for all videos (missing for video: ${videoMissingLoras.metadata.title || videoMissingLoras.id})`);
+      //     return;
+      //   }
+      // }
 
       setIsSubmitting(true);
       const reviewerName = user?.email || 'Anonymous';
@@ -189,14 +189,15 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
           // Link based on the video's specific LoRA selection or the forced ID
           const targetAssetIds = finalForcedLoraId ? [finalForcedLoraId] : (video.metadata.associatedLoraIds || []);
           if (targetAssetIds.length === 0) {
-            console.warn(`Video ${mediaId} had no associated LoRAs selected/forced.`);
-            continue; // Should not happen if validation above works, but good safeguard
-          }
-          
-          for (const assetId of targetAssetIds) {
-            const { error: linkError } = await supabase.from('asset_media').insert({ asset_id: assetId, media_id: mediaId });
-            if (linkError) {
-              console.error(`Error linking media ${mediaId} to asset ${assetId}:`, linkError);
+            console.warn(`Video ${mediaId} had no associated LoRAs selected/forced. Proceeding with media creation without LoRA link.`);
+            // Original: continue; // Skip linking if no LoRAs - now we proceed to create media anyway
+          } else {
+            // Only attempt linking if there are IDs
+            for (const assetId of targetAssetIds) {
+              const { error: linkError } = await supabase.from('asset_media').insert({ asset_id: assetId, media_id: mediaId });
+              if (linkError) {
+                console.error(`Error linking media ${mediaId} to asset ${assetId}:`, linkError);
+              }
             }
           }
         }
diff --git a/src/pages/upload/components/MultipleVideoUploader.tsx b/src/pages/upload/components/MultipleVideoUploader.tsx
index 7d1cecb..305320d 100644
--- a/src/pages/upload/components/MultipleVideoUploader.tsx
+++ b/src/pages/upload/components/MultipleVideoUploader.tsx
@@ -7,6 +7,9 @@ import VideoDropzone from '@/components/upload/VideoDropzone';
 import VideoMetadataForm from '@/components/upload/VideoMetadataForm';
 import { useToast } from '@/components/ui/use-toast';
 import { useAuth } from '@/hooks/useAuth';
+import { Logger } from '@/lib/logger';
+
+const logger = new Logger('MultipleVideoUploader');
 
 type LoraOption = {
   id: string;
@@ -56,6 +59,16 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [urlInput, setUrlInput] = useState('');
   
+  logger.log('Rendering MultipleVideoUploader. Received props:', {
+    videoCount: videos.length,
+    disabled,
+    hideIsPrimary,
+    allowPrimarySelection,
+    availableLorasCount: availableLoras.length,
+    showLoraSelectors,
+    defaultClassification
+  });
+  
   const createEmptyVideoItem = (): VideoItem => ({
     file: null,
     url: null,
@@ -63,6 +76,8 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
       title: '',
       description: '',
       classification: defaultClassification,
+      creator: 'self',
+      creatorName: '',
       isPrimary: videos.length === 0,
       associatedLoraIds: []
     },
@@ -94,6 +109,8 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
             title: '',
             description: '',
             classification: defaultClassification,
+            creator: 'self',
+            creatorName: '',
             isPrimary: isFirst,
             associatedLoraIds: []
           },
@@ -129,6 +146,8 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
           title: '',
           description: '',
           classification: defaultClassification,
+          creator: 'self',
+          creatorName: '',
           isPrimary: isFirst,
           associatedLoraIds: []
         },
@@ -167,6 +186,8 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
             title: '',
             description: '',
             classification: defaultClassification,
+            creator: 'self',
+            creatorName: '',
             isPrimary: isFirst,
             associatedLoraIds: []
           },
@@ -191,6 +212,10 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
   const updateVideoMetadata = (id: string, field: string, value: any) => {
     if (disabled) return;
     
+    if (field === 'associatedLoraIds') {
+      logger.log(`Updating LoRA IDs for video ${id}:`, value);
+    }
+
     setVideos(prev => {
       const updated = prev.map(video => {
         if (video.id === id) {
@@ -219,14 +244,17 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
         return video;
       });
       
-      const primaryIndex = updated.findIndex(v => v.metadata.isPrimary);
-      if (primaryIndex !== -1) {
-          return updated.map((v, idx) => ({
-              ...v,
-              metadata: { ...v.metadata, isPrimary: idx === primaryIndex }
-          }));
-      } else if (updated.length > 0) {
-          updated[0].metadata.isPrimary = true;
+      if (!hideIsPrimary && allowPrimarySelection) {
+          const primaryIndex = updated.findIndex(v => v.metadata.isPrimary);
+          if (primaryIndex === -1 && updated.length > 0) {
+              logger.log('No primary video set, making first video primary.');
+              updated[0].metadata.isPrimary = true;
+          } else if (primaryIndex !== -1) {
+              return updated.map((v, idx) => ({
+                  ...v,
+                  metadata: { ...v.metadata, isPrimary: idx === primaryIndex }
+              }));
+          }
       }
 
       return updated;
```
---
**Commit:** `0c92a95`
**Author:** POM
**Date:** 2025-04-23
**Message:** feat: remove LoRA selector from media upload flow
```diff
diff --git a/src/components/upload/VideoMetadataForm.tsx b/src/components/upload/VideoMetadataForm.tsx
index 65f3a31..22d1af9 100644
--- a/src/components/upload/VideoMetadataForm.tsx
+++ b/src/components/upload/VideoMetadataForm.tsx
@@ -6,30 +6,21 @@ import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
 import { Switch } from '@/components/ui/switch';
 import { useAuth } from '@/hooks/useAuth';
 import { Card, CardContent } from "@/components/ui/card";
-import { LoraMultiSelectCombobox } from '@/components/upload/LoraMultiSelectCombobox';
 import { Logger } from '@/lib/logger';
 
 const logger = new Logger('VideoMetadataForm');
 
-type LoraOption = {
-  id: string;
-  name: string;
-}
-
 interface VideoMetadataFormProps {
   videoId: string;
   metadata: {
     title: string;
     description: string;
-    classification: 'art' | 'gen'; // Expects 'gen'
+    classification: 'art' | 'gen';
     isPrimary?: boolean;
-    associatedLoraIds?: string[]; // Add associated Lora IDs here too if not inferred
   };
-  updateMetadata: (id: string, field: string, value: any) => void; // Expects this prop
+  updateMetadata: (id: string, field: string, value: any) => void;
   canSetPrimary?: boolean;
   disabled?: boolean;
-  showLoraSelector?: boolean;
-  availableLoras?: LoraOption[];
 }
 
 const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({ 
@@ -38,32 +29,14 @@ const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({
   updateMetadata, 
   canSetPrimary = true,
   disabled = false,
-  showLoraSelector = false,
-  availableLoras = [], 
 }) => {
   const { user } = useAuth();
   
   logger.log(`Rendering VideoMetadataForm for videoId: ${videoId}. Received props:`, {
     canSetPrimary,
     disabled,
-    showLoraSelector,
-    availableLorasCount: availableLoras.length,
-    initialSelectedLoraIds: metadata.associatedLoraIds || []
   });
 
-  // Handler specifically for the LoRA selector within this form
-  const handleLoraSelectionChange = (selectedIds: string[]) => {
-    logger.log(`LoRA selection changed for video ${videoId}:`, selectedIds);
-    updateMetadata(videoId, 'associatedLoraIds', selectedIds);
-  };
-
-  // Extract selected IDs from metadata, default to empty array
-  const associatedLoraIds = metadata.associatedLoraIds || [];
-
-  // Prepare options for the combobox
-  const loraOptions = availableLoras.map(lora => ({ value: lora.id, label: lora.name }));
-  logger.log(`Prepared LoRA options for combobox (video ${videoId}):`, loraOptions);
-
   return (
     <Card>
       <CardContent className="pt-6">
@@ -113,7 +86,7 @@ const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({
                   disabled={disabled}
                 >
                   <div className="flex items-center space-x-2">
-                    <RadioGroupItem value="gen" id={`classification-gen-${videoId}`} /> {/* Uses 'gen' */}
+                    <RadioGroupItem value="gen" id={`classification-gen-${videoId}`} />
                     <Label htmlFor={`classification-gen-${videoId}`} className="cursor-pointer">Generation</Label>
                   </div>
                   <div className="flex items-center space-x-2">
@@ -140,19 +113,6 @@ const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({
               </div>
             </div>
           )}
-
-          {showLoraSelector && (
-            <div className="pt-4 border-t border-border/40">
-              <Label className="text-sm font-medium mb-2 block">Which LoRA was this created with?</Label>
-              <LoraMultiSelectCombobox 
-                loras={availableLoras}
-                selectedIds={associatedLoraIds}
-                setSelectedIds={handleLoraSelectionChange}
-                disabled={disabled}
-              />
-              {/* Add validation message area if needed */} 
-            </div>
-          )}
         </div>
       </CardContent>
     </Card>
diff --git a/src/pages/upload/UploadPage.tsx b/src/pages/upload/UploadPage.tsx
index 7debf40..7d42e6e 100644
--- a/src/pages/upload/UploadPage.tsx
+++ b/src/pages/upload/UploadPage.tsx
@@ -117,16 +117,6 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
     
     if (uploadMode === 'media') {
       // MEDIA ONLY FLOW --------------------------------------------------
-
-      // Check if *any* video is missing a LoRA selection (if not forced)
-      // if (!finalForcedLoraId) {
-      //   const videoMissingLoras = videos.find(v => !v.metadata.associatedLoraIds || v.metadata.associatedLoraIds.length === 0);
-      //   if (videoMissingLoras) {
-      //     toast.error(`Please select the LoRA(s) used for all videos (missing for video: ${videoMissingLoras.metadata.title || videoMissingLoras.id})`);
-      //     return;
-      //   }
-      // }
-
       setIsSubmitting(true);
       const reviewerName = user?.email || 'Anonymous';
       try {
@@ -193,32 +183,12 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
 
           if (mediaError || !mediaData) {
             logger.error(`STEP 3: DB Insert FAILED for video ${video.id}:`, mediaError);
-            // We might want to throw an error here or collect errors to show the user
-            // For now, just log and continue to allow other videos to potentially succeed
             continue;
           }
           logger.log(`STEP 4: DB Insert SUCCESSFUL (Before mediaId assignment) for video ${video.id}`);
 
           const mediaId = mediaData.id;
           logger.log(`Successfully created media entry for video ${video.id}. Media ID: ${mediaId}`);
-
-          // Link based on the video's specific LoRA selection or the forced ID
-          logger.log(`STEP 5: Before LoRA Check for media ${mediaId}`);
-          const targetAssetIds = finalForcedLoraId ? [finalForcedLoraId] : (video.metadata.associatedLoraIds || []);
-          if (targetAssetIds.length === 0) {
-            logger.warn(`STEP 6: LoRA Check - No LoRAs Found for media ${mediaId}. Proceeding without LoRA link.`);
-            // Original: continue; // Skip linking if no LoRAs - now we proceed to create media anyway
-          } else {
-            logger.log(`STEP 7: LoRA Check - LoRAs Found for media ${mediaId}. Linking ${targetAssetIds.length} LoRAs.`);
-            // Only attempt linking if there are IDs
-            for (const assetId of targetAssetIds) {
-              const { error: linkError } = await supabase.from('asset_media').insert({ asset_id: assetId, media_id: mediaId });
-              if (linkError) {
-                logger.error(`Error linking media ${mediaId} to asset ${assetId}:`, linkError);
-              }
-            }
-          }
-          logger.log(`STEP 8: After LoRA Check for media ${mediaId}`);
         }
 
         logger.log('Finished processing all videos for media entry creation.');
@@ -499,8 +469,6 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
               setVideos={setVideos} 
               disabled={!user}
               hideIsPrimary={uploadMode === 'media'}
-              availableLoras={availableLoras}
-              showLoraSelectors={uploadMode === 'media' && !finalForcedLoraId}
               defaultClassification={finalDefaultClassification}
             />
           </div>
diff --git a/src/pages/upload/components/MultipleVideoUploader.tsx b/src/pages/upload/components/MultipleVideoUploader.tsx
index 305320d..4383480 100644
--- a/src/pages/upload/components/MultipleVideoUploader.tsx
+++ b/src/pages/upload/components/MultipleVideoUploader.tsx
@@ -26,7 +26,6 @@ interface VideoItem {
     creator: 'self' | 'someone_else';
     creatorName: string;
     isPrimary?: boolean;
-    associatedLoraIds?: string[];
   };
   id: string;
 }
@@ -37,9 +36,7 @@ interface MultipleVideoUploaderProps {
   disabled?: boolean;
   hideIsPrimary?: boolean;
   allowPrimarySelection?: boolean;
-  availableLoras?: LoraOption[];
   uploadContext?: string;
-  showLoraSelectors?: boolean;
   defaultClassification?: 'art' | 'gen';
 }
 
@@ -49,9 +46,7 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
   disabled = false,
   hideIsPrimary = false,
   allowPrimarySelection = true,
-  availableLoras = [],
   uploadContext = '',
-  showLoraSelectors = false,
   defaultClassification = 'gen'
 }) => {
   const { toast } = useToast();
@@ -64,8 +59,7 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
     disabled,
     hideIsPrimary,
     allowPrimarySelection,
-    availableLorasCount: availableLoras.length,
-    showLoraSelectors,
+    uploadContext,
     defaultClassification
   });
   
@@ -78,8 +72,7 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
       classification: defaultClassification,
       creator: 'self',
       creatorName: '',
-      isPrimary: videos.length === 0,
-      associatedLoraIds: []
+      isPrimary: videos.length === 0
     },
     id: uuidv4()
   });
@@ -111,8 +104,7 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
             classification: defaultClassification,
             creator: 'self',
             creatorName: '',
-            isPrimary: isFirst,
-            associatedLoraIds: []
+            isPrimary: isFirst
           },
           id: uuidv4()
         } as VideoItem;
@@ -148,8 +140,7 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
           classification: defaultClassification,
           creator: 'self',
           creatorName: '',
-          isPrimary: isFirst,
-          associatedLoraIds: []
+          isPrimary: isFirst
         },
         id: uuidv4()
       }
@@ -188,8 +179,7 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
             classification: defaultClassification,
             creator: 'self',
             creatorName: '',
-            isPrimary: isFirst,
-            associatedLoraIds: []
+            isPrimary: isFirst
           },
           id: uuidv4()
         }
@@ -212,10 +202,6 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
   const updateVideoMetadata = (id: string, field: string, value: any) => {
     if (disabled) return;
     
-    if (field === 'associatedLoraIds') {
-      logger.log(`Updating LoRA IDs for video ${id}:`, value);
-    }
-
     setVideos(prev => {
       const updated = prev.map(video => {
         if (video.id === id) {
@@ -225,12 +211,6 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
               metadata: { ...video.metadata, isPrimary: true }
             };
           }
-          if (field === 'associatedLoraIds') {
-            return {
-              ...video,
-              metadata: { ...video.metadata, associatedLoraIds: value }
-            };
-          }
           return {
             ...video,
             metadata: { ...video.metadata, [field]: value }
@@ -361,8 +341,6 @@ const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
                       updateMetadata={updateVideoMetadata}
                       canSetPrimary={!hideIsPrimary}
                       disabled={disabled}
-                      showLoraSelector={showLoraSelectors}
-                      availableLoras={availableLoras}
                     />
                   </div>
                 </CardContent>
```
---
**Commit:** `3a258a6`
**Author:** POM
**Date:** 2025-04-23
**Message:** feat: refactor video grid layout for consistency and improved mobile display - Replace Masonry with VideoGrid, fix aspect ratios, improve mobile layout, add compact mode
```diff
diff --git a/bun.lockb b/bun.lockb
index a1c7b38..5503ac2 100755
Binary files a/bun.lockb and b/bun.lockb differ
diff --git a/package-lock.json b/package-lock.json
index 6b9de24..c959aa6 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -38,20 +38,26 @@
         "@radix-ui/react-tooltip": "^1.1.4",
         "@supabase/supabase-js": "^2.49.4",
         "@tanstack/react-query": "^5.56.2",
+        "@types/imagesloaded": "^4.1.6",
+        "@types/masonry-layout": "^4.2.8",
         "class-variance-authority": "^0.7.1",
         "clsx": "^2.1.1",
         "cmdk": "^1.0.0",
         "date-fns": "^3.6.0",
         "embla-carousel-react": "^8.3.0",
+        "framer-motion": "^11.0.8",
+        "imagesloaded": "^5.0.0",
         "input-otp": "^1.2.4",
         "lucide-react": "^0.462.0",
+        "masonry-layout": "^4.2.2",
         "next-themes": "^0.3.0",
         "react": "^18.3.1",
         "react-day-picker": "^8.10.1",
         "react-dom": "^18.3.1",
         "react-dropzone": "^14.2.3",
+        "react-error-boundary": "^5.0.0",
+        "react-helmet-async": "^2.0.5",
         "react-hook-form": "^7.53.0",
-        "react-masonry-css": "^1.0.16",
         "react-resizable-panels": "^2.1.3",
         "react-router-dom": "^6.26.2",
         "recharts": "^2.12.7",
@@ -3309,6 +3315,24 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/@types/imagesloaded": {
+      "version": "4.1.6",
+      "resolved": "https://registry.npmjs.org/@types/imagesloaded/-/imagesloaded-4.1.6.tgz",
+      "integrity": "sha512-X16+aOrPwf3+JAy1rL3zi0m19mbVrhf3AgtMoppqK07QpbkvVpxOzZMjHBS2X5BMOxuP8gQrueplNoYnyaFs5g==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/jquery": "*"
+      }
+    },
+    "node_modules/@types/jquery": {
+      "version": "3.5.32",
+      "resolved": "https://registry.npmjs.org/@types/jquery/-/jquery-3.5.32.tgz",
+      "integrity": "sha512-b9Xbf4CkMqS02YH8zACqN1xzdxc3cO735Qe5AbSUFmyOiaWAbcpqh9Wna+Uk0vgACvoQHpWDg2rGdHkYPLmCiQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/sizzle": "*"
+      }
+    },
     "node_modules/@types/json-schema": {
       "version": "7.0.15",
       "resolved": "https://registry.npmjs.org/@types/json-schema/-/json-schema-7.0.15.tgz",
@@ -3316,6 +3340,15 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/@types/masonry-layout": {
+      "version": "4.2.8",
+      "resolved": "https://registry.npmjs.org/@types/masonry-layout/-/masonry-layout-4.2.8.tgz",
+      "integrity": "sha512-Et2to22C31FG1UFaHRBL6BznMOhrur3Ckr9gvR7fRVmPgxqiwCEKZtV8GpFscHyNAKhZ0QlkwXJRPnJvxZUKQw==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/jquery": "*"
+      }
+    },
     "node_modules/@types/node": {
       "version": "22.7.9",
       "resolved": "https://registry.npmjs.org/@types/node/-/node-22.7.9.tgz",
@@ -3359,6 +3392,12 @@
         "@types/react": "*"
       }
     },
+    "node_modules/@types/sizzle": {
+      "version": "2.3.9",
+      "resolved": "https://registry.npmjs.org/@types/sizzle/-/sizzle-2.3.9.tgz",
+      "integrity": "sha512-xzLEyKB50yqCUPUJkIsrVvoWNfFUbIZI+RspLWt8u+tIW/BetMBZtgV2LY/2o+tYH8dRvQ+eoPf3NdhQCcLE2w==",
+      "license": "MIT"
+    },
     "node_modules/@types/ws": {
       "version": "8.18.0",
       "resolved": "https://registry.npmjs.org/@types/ws/-/ws-8.18.0.tgz",
@@ -4560,6 +4599,12 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/desandro-matches-selector": {
+      "version": "2.0.2",
+      "resolved": "https://registry.npmjs.org/desandro-matches-selector/-/desandro-matches-selector-2.0.2.tgz",
+      "integrity": "sha512-+1q0nXhdzg1IpIJdMKalUwvvskeKnYyEe3shPRwedNcWtnhEKT3ZxvFjzywHDeGcKViIxTCAoOYQWP1qD7VNyg==",
+      "license": "MIT"
+    },
     "node_modules/detect-node-es": {
       "version": "1.1.0",
       "resolved": "https://registry.npmjs.org/detect-node-es/-/detect-node-es-1.1.0.tgz",
@@ -4885,6 +4930,12 @@
         "node": ">=0.10.0"
       }
     },
+    "node_modules/ev-emitter": {
+      "version": "2.1.2",
+      "resolved": "https://registry.npmjs.org/ev-emitter/-/ev-emitter-2.1.2.tgz",
+      "integrity": "sha512-jQ5Ql18hdCQ4qS+RCrbLfz1n+Pags27q5TwMKvZyhp5hh2UULUYZUy1keqj6k6SYsdqIYjnmz7xyyEY0V67B8Q==",
+      "license": "MIT"
+    },
     "node_modules/eventemitter3": {
       "version": "4.0.7",
       "resolved": "https://registry.npmjs.org/eventemitter3/-/eventemitter3-4.0.7.tgz",
@@ -5012,6 +5063,15 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
+    "node_modules/fizzy-ui-utils": {
+      "version": "2.0.7",
+      "resolved": "https://registry.npmjs.org/fizzy-ui-utils/-/fizzy-ui-utils-2.0.7.tgz",
+      "integrity": "sha512-CZXDVXQ1If3/r8s0T+v+qVeMshhfcuq0rqIFgJnrtd+Bu8GmDmqMjntjUePypVtjHXKJ6V4sw9zeyox34n9aCg==",
+      "license": "MIT",
+      "dependencies": {
+        "desandro-matches-selector": "^2.0.0"
+      }
+    },
     "node_modules/flat-cache": {
       "version": "4.0.1",
       "resolved": "https://registry.npmjs.org/flat-cache/-/flat-cache-4.0.1.tgz",
@@ -5063,6 +5123,33 @@
         "url": "https://github.com/sponsors/rawify"
       }
     },
+    "node_modules/framer-motion": {
+      "version": "11.18.2",
+      "resolved": "https://registry.npmjs.org/framer-motion/-/framer-motion-11.18.2.tgz",
+      "integrity": "sha512-5F5Och7wrvtLVElIpclDT0CBzMVg3dL22B64aZwHtsIY8RB4mXICLrkajK4G9R+ieSAGcgrLeae2SeUTg2pr6w==",
+      "license": "MIT",
+      "dependencies": {
+        "motion-dom": "^11.18.1",
+        "motion-utils": "^11.18.1",
+        "tslib": "^2.4.0"
+      },
+      "peerDependencies": {
+        "@emotion/is-prop-valid": "*",
+        "react": "^18.0.0 || ^19.0.0",
+        "react-dom": "^18.0.0 || ^19.0.0"
+      },
+      "peerDependenciesMeta": {
+        "@emotion/is-prop-valid": {
+          "optional": true
+        },
+        "react": {
+          "optional": true
+        },
+        "react-dom": {
+          "optional": true
+        }
+      }
+    },
     "node_modules/fsevents": {
       "version": "2.3.3",
       "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
@@ -5095,6 +5182,12 @@
         "node": ">=6"
       }
     },
+    "node_modules/get-size": {
+      "version": "2.0.3",
+      "resolved": "https://registry.npmjs.org/get-size/-/get-size-2.0.3.tgz",
+      "integrity": "sha512-lXNzT/h/dTjTxRbm9BXb+SGxxzkm97h/PCIKtlN/CBCxxmkkIVV21udumMS93MuVTDX583gqc94v3RjuHmI+2Q==",
+      "license": "MIT"
+    },
     "node_modules/glob": {
       "version": "10.4.5",
       "resolved": "https://registry.npmjs.org/glob/-/glob-10.4.5.tgz",
@@ -5203,6 +5296,15 @@
         "node": ">= 4"
       }
     },
+    "node_modules/imagesloaded": {
+      "version": "5.0.0",
+      "resolved": "https://registry.npmjs.org/imagesloaded/-/imagesloaded-5.0.0.tgz",
+      "integrity": "sha512-/0JGSubc1MTCoDKVmonLHgbifBWHdyLkun+R/151E1c5n79hiSxcd7cB7mPXFgojYu8xnRZv7GYxzKoxW8BetQ==",
+      "license": "MIT",
+      "dependencies": {
+        "ev-emitter": "^2.1.2"
+      }
+    },
     "node_modules/import-fresh": {
       "version": "3.3.0",
       "resolved": "https://registry.npmjs.org/import-fresh/-/import-fresh-3.3.0.tgz",
@@ -5249,6 +5351,15 @@
         "node": ">=12"
       }
     },
+    "node_modules/invariant": {
+      "version": "2.2.4",
+      "resolved": "https://registry.npmjs.org/invariant/-/invariant-2.2.4.tgz",
+      "integrity": "sha512-phJfQVBuaJM5raOpJjSfkiD6BpbCE4Ns//LaXl6wGYtUBY83nWS6Rf9tXm2e8VaK60JEjYldbPif/A2B1C2gNA==",
+      "license": "MIT",
+      "dependencies": {
+        "loose-envify": "^1.0.0"
+      }
+    },
     "node_modules/is-binary-path": {
       "version": "2.1.0",
       "resolved": "https://registry.npmjs.org/is-binary-path/-/is-binary-path-2.1.0.tgz",
@@ -5954,6 +6065,16 @@
         "@jridgewell/sourcemap-codec": "^1.5.0"
       }
     },
+    "node_modules/masonry-layout": {
+      "version": "4.2.2",
+      "resolved": "https://registry.npmjs.org/masonry-layout/-/masonry-layout-4.2.2.tgz",
+      "integrity": "sha512-iGtAlrpHNyxaR19CvKC3npnEcAwszXoyJiI8ARV2ePi7fmYhIud25MHK8Zx4P0LCC4d3TNO9+rFa1KoK1OEOaA==",
+      "license": "MIT",
+      "dependencies": {
+        "get-size": "^2.0.2",
+        "outlayer": "^2.1.0"
+      }
+    },
     "node_modules/merge2": {
       "version": "1.4.1",
       "resolved": "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz",
@@ -5998,6 +6119,21 @@
         "node": ">=16 || 14 >=14.17"
       }
     },
+    "node_modules/motion-dom": {
+      "version": "11.18.1",
+      "resolved": "https://registry.npmjs.org/motion-dom/-/motion-dom-11.18.1.tgz",
+      "integrity": "sha512-g76KvA001z+atjfxczdRtw/RXOM3OMSdd1f4DL77qCTF/+avrRJiawSG4yDibEQ215sr9kpinSlX2pCTJ9zbhw==",
+      "license": "MIT",
+      "dependencies": {
+        "motion-utils": "^11.18.1"
+      }
+    },
+    "node_modules/motion-utils": {
+      "version": "11.18.1",
+      "resolved": "https://registry.npmjs.org/motion-utils/-/motion-utils-11.18.1.tgz",
+      "integrity": "sha512-49Kt+HKjtbJKLtgO/LKj9Ld+6vw9BjH5d9sc40R/kVyH8GLAXgT42M2NnuPcJNuA3s9ZfZBUcwIgpmZWGEE+hA==",
+      "license": "MIT"
+    },
     "node_modules/ms": {
       "version": "2.1.3",
       "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
@@ -6113,6 +6249,23 @@
         "node": ">= 0.8.0"
       }
     },
+    "node_modules/outlayer": {
+      "version": "2.1.1",
+      "resolved": "https://registry.npmjs.org/outlayer/-/outlayer-2.1.1.tgz",
+      "integrity": "sha512-+GplXsCQ3VrbGujAeHEzP9SXsBmJxzn/YdDSQZL0xqBmAWBmortu2Y9Gwdp9J0bgDQ8/YNIPMoBM13nTwZfAhw==",
+      "license": "MIT",
+      "dependencies": {
+        "ev-emitter": "^1.0.0",
+        "fizzy-ui-utils": "^2.0.0",
+        "get-size": "^2.0.2"
+      }
+    },
+    "node_modules/outlayer/node_modules/ev-emitter": {
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/ev-emitter/-/ev-emitter-1.1.1.tgz",
+      "integrity": "sha512-ipiDYhdQSCZ4hSbX4rMW+XzNKMD1prg/sTvoVmSLkuQ1MVlwjJQQA+sW8tMYR3BLUr9KjodFV4pvzunvRhd33Q==",
+      "license": "MIT"
+    },
     "node_modules/p-limit": {
       "version": "3.1.0",
       "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-3.1.0.tgz",
@@ -6497,6 +6650,38 @@
         "react": ">= 16.8 || 18.0.0"
       }
     },
+    "node_modules/react-error-boundary": {
+      "version": "5.0.0",
+      "resolved": "https://registry.npmjs.org/react-error-boundary/-/react-error-boundary-5.0.0.tgz",
+      "integrity": "sha512-tnjAxG+IkpLephNcePNA7v6F/QpWLH8He65+DmedchDwg162JZqx4NmbXj0mlAYVVEd81OW7aFhmbsScYfiAFQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.12.5"
+      },
+      "peerDependencies": {
+        "react": ">=16.13.1"
+      }
+    },
+    "node_modules/react-fast-compare": {
+      "version": "3.2.2",
+      "resolved": "https://registry.npmjs.org/react-fast-compare/-/react-fast-compare-3.2.2.tgz",
+      "integrity": "sha512-nsO+KSNgo1SbJqJEYRE9ERzo7YtYbou/OqjSQKxV7jcKox7+usiUVZOAC+XnDOABXggQTno0Y1CpVnuWEc1boQ==",
+      "license": "MIT"
+    },
+    "node_modules/react-helmet-async": {
+      "version": "2.0.5",
+      "resolved": "https://registry.npmjs.org/react-helmet-async/-/react-helmet-async-2.0.5.tgz",
+      "integrity": "sha512-rYUYHeus+i27MvFE+Jaa4WsyBKGkL6qVgbJvSBoX8mbsWoABJXdEO0bZyi0F6i+4f0NuIb8AvqPMj3iXFHkMwg==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "invariant": "^2.2.4",
+        "react-fast-compare": "^3.2.2",
+        "shallowequal": "^1.1.0"
+      },
+      "peerDependencies": {
+        "react": "^16.6.0 || ^17.0.0 || ^18.0.0"
+      }
+    },
     "node_modules/react-hook-form": {
       "version": "7.53.1",
       "resolved": "https://registry.npmjs.org/react-hook-form/-/react-hook-form-7.53.1.tgz",
@@ -6519,15 +6704,6 @@
       "integrity": "sha512-/LLMVyas0ljjAtoYiPqYiL8VWXzUUdThrmU5+n20DZv+a+ClRoevUzw5JxU+Ieh5/c87ytoTBV9G1FiKfNJdmg==",
       "license": "MIT"
     },
-    "node_modules/react-masonry-css": {
-      "version": "1.0.16",
-      "resolved": "https://registry.npmjs.org/react-masonry-css/-/react-masonry-css-1.0.16.tgz",
-      "integrity": "sha512-KSW0hR2VQmltt/qAa3eXOctQDyOu7+ZBevtKgpNDSzT7k5LA/0XntNa9z9HKCdz3QlxmJHglTZ18e4sX4V8zZQ==",
-      "license": "MIT",
-      "peerDependencies": {
-        "react": ">=16.0.0"
-      }
-    },
     "node_modules/react-remove-scroll": {
       "version": "2.6.0",
       "resolved": "https://registry.npmjs.org/react-remove-scroll/-/react-remove-scroll-2.6.0.tgz",
@@ -6847,6 +7023,12 @@
         "node": ">=10"
       }
     },
+    "node_modules/shallowequal": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/shallowequal/-/shallowequal-1.1.0.tgz",
+      "integrity": "sha512-y0m1JoUZSlPAjXVtPPW70aZWfIL/dSP7AFkRnniLCrK/8MDKog3TySTBmckD+RObVxH0v4Tox67+F14PdED2oQ==",
+      "license": "MIT"
+    },
     "node_modules/shebang-command": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz",
diff --git a/package.json b/package.json
index 7422590..a4427d3 100644
--- a/package.json
+++ b/package.json
@@ -48,6 +48,7 @@
     "cmdk": "^1.0.0",
     "date-fns": "^3.6.0",
     "embla-carousel-react": "^8.3.0",
+    "framer-motion": "^11.0.8",
     "imagesloaded": "^5.0.0",
     "input-otp": "^1.2.4",
     "lucide-react": "^0.462.0",
@@ -60,7 +61,6 @@
     "react-error-boundary": "^5.0.0",
     "react-helmet-async": "^2.0.5",
     "react-hook-form": "^7.53.0",
-    "react-masonry-css": "^1.0.16",
     "react-resizable-panels": "^2.1.3",
     "react-router-dom": "^6.26.2",
     "recharts": "^2.12.7",
diff --git a/src/components/LoraManager.tsx b/src/components/LoraManager.tsx
index 7726125..0687e27 100644
--- a/src/components/LoraManager.tsx
+++ b/src/components/LoraManager.tsx
@@ -1,5 +1,5 @@
 import React, { useMemo, useState } from 'react';
-import { LoraAsset } from '@/lib/types';
+import { LoraAsset, UserAssetPreferenceStatus } from '@/lib/types';
 import LoraList from './lora/LoraList';
 import LoadingState from './LoadingState';
 import EmptyState from './EmptyState';
@@ -19,12 +19,14 @@ interface LoraManagerProps {
   loras: LoraAsset[];
   isLoading?: boolean;
   lorasAreLoading?: boolean;
-  filterText: string;
-  onFilterTextChange: (text: string) => void;
+  filterText?: string;
+  onFilterTextChange?: (text: string) => void;
   isAdmin?: boolean;
   onNavigateToUpload?: () => void;
   onRefreshData?: () => void;
   showSeeAllLink?: boolean;
+  onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
+  isUpdatingStatusMap?: Record<string, boolean>;
 }
 
 const LoraManager: React.FC<LoraManagerProps> = ({ 
@@ -37,6 +39,8 @@ const LoraManager: React.FC<LoraManagerProps> = ({
   onNavigateToUpload,
   onRefreshData,
   showSeeAllLink,
+  onUserStatusChange,
+  isUpdatingStatusMap,
 }) => {
   logger.log(`LoraManager rendering/initializing. Props: isLoading (videos)=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, filterText=${filterText}, isAdmin=${isAdmin}`);
 
@@ -47,7 +51,7 @@ const LoraManager: React.FC<LoraManagerProps> = ({
   const filteredLoras = loras;
 
   const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
-    onFilterTextChange(event.target.value);
+    onFilterTextChange?.(event.target.value);
   };
 
   return (
@@ -76,7 +80,12 @@ const LoraManager: React.FC<LoraManagerProps> = ({
           description="There are currently no LoRAs in the collection that match your filters. Upload a new LoRA or adjust filters!" 
         />
       ) : (
-        <LoraList loras={filteredLoras} />
+        <LoraList 
+          loras={filteredLoras} 
+          onUserStatusChange={onUserStatusChange}
+          isUpdatingStatusMap={isUpdatingStatusMap}
+          isAdmin={isAdmin}
+        />
       )}
     </div>
   );
diff --git a/src/components/lora/LoraCard.tsx b/src/components/lora/LoraCard.tsx
index 6efcba8..7772e99 100644
--- a/src/components/lora/LoraCard.tsx
+++ b/src/components/lora/LoraCard.tsx
@@ -63,7 +63,10 @@ const LoraCard: React.FC<LoraCardProps> = ({
   const [isHiding, setIsHiding] = useState(false);
   const [currentStatus, setCurrentStatus] = useState(userStatus);
   const { user } = useAuth();
-  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
+  // Initialize aspect ratio from metadata if it already exists to avoid layout shift on initial render
+  const [aspectRatio, setAspectRatio] = useState<number | null>(
+    lora?.primaryVideo?.metadata?.aspectRatio ?? null
+  );
   const [isVisible, setIsVisible] = useState(false);
   const [isInPreloadArea, setIsInPreloadArea] = useState(false);
   const isMobile = useIsMobile();
@@ -194,6 +197,14 @@ const LoraCard: React.FC<LoraCardProps> = ({
     }
   }, [lora.id, onEnterPreloadArea]);
 
+  // Keep aspect ratio in sync if the primary video (or its metadata) changes later
+  useEffect(() => {
+    const metaRatio = lora?.primaryVideo?.metadata?.aspectRatio ?? null;
+    if (metaRatio && aspectRatio === null) {
+      setAspectRatio(metaRatio);
+    }
+  }, [lora?.primaryVideo?.metadata?.aspectRatio, aspectRatio]);
+
   return (
     <Card 
       className={cn(
@@ -204,7 +215,7 @@ const LoraCard: React.FC<LoraCardProps> = ({
     >
       <div 
         className="w-full overflow-hidden bg-muted relative"
-        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16/9' }}
+        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16 / 9' }}
       >
         {videoUrl ? (
           <>
diff --git a/src/components/lora/LoraList.tsx b/src/components/lora/LoraList.tsx
index 7fc7b09..3170ebe 100644
--- a/src/components/lora/LoraList.tsx
+++ b/src/components/lora/LoraList.tsx
@@ -1,10 +1,8 @@
 import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
-import Masonry from 'react-masonry-css';
-import { LoraAsset } from '@/lib/types';
+import { LoraAsset, UserAssetPreferenceStatus } from '@/lib/types';
 import { FileVideo } from 'lucide-react';
 import LoraCard from './LoraCard';
 import { Logger } from '@/lib/logger';
-import { useAuth } from '@/hooks/useAuth';
 import { useIsMobile } from '@/hooks/use-mobile';
 import {
   Pagination,
@@ -20,10 +18,17 @@ const logger = new Logger('LoraList');
 interface LoraListProps {
   loras: LoraAsset[];
   initialModelFilter?: string;
+  isAdmin?: boolean;
+  onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
+  isUpdatingStatusMap?: Record<string, boolean>;
 }
 
-const LoraList: React.FC<LoraListProps> = ({ loras }) => {
-  const { isAdmin } = useAuth();
+const LoraList: React.FC<LoraListProps> = ({ 
+  loras, 
+  isAdmin, 
+  onUserStatusChange, 
+  isUpdatingStatusMap 
+}) => {
   const isMobile = useIsMobile();
   
   // Add state and refs for autoplay
@@ -35,12 +40,6 @@ const LoraList: React.FC<LoraListProps> = ({ loras }) => {
     logger.log("LoraList received loras:", loras?.length || 0);
   }, [loras]);
 
-  const breakpointColumnsObj = {
-    default: 3,
-    1024: 2,
-    640: 1,
-  };
-
   // Pagination logic
   const itemsPerPage = 15;
   const [currentPage, setCurrentPage] = useState(1);
@@ -103,25 +102,22 @@ const LoraList: React.FC<LoraListProps> = ({ loras }) => {
   return (
     <div className="space-y-4">
       {paginatedLoras.length > 0 ? (
-        <Masonry
-          breakpointCols={breakpointColumnsObj}
-          className="my-masonry-grid flex w-auto -ml-4"
-          columnClassName="my-masonry-grid_column pl-4 bg-clip-padding"
+        <div 
+          className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
         >
           {paginatedLoras.map((lora) => (
-            <div key={lora.id} className="mb-4">
-              <LoraCard 
-                lora={lora} 
-                isAdmin={isAdmin} 
-                // Pass autoplay props
-                onVisibilityChange={handleVideoVisibilityChange}
-                shouldBePlaying={isMobile && lora.id === visibleVideoId}
-                // Pass preload prop
-                onEnterPreloadArea={handleEnterPreloadArea}
-              />
-            </div>
+            <LoraCard 
+              key={lora.id}
+              lora={lora} 
+              isAdmin={isAdmin}
+              onUserStatusChange={onUserStatusChange}
+              isUpdatingStatus={isUpdatingStatusMap ? isUpdatingStatusMap[lora.id] : undefined}
+              onVisibilityChange={handleVideoVisibilityChange}
+              shouldBePlaying={isMobile && lora.id === visibleVideoId}
+              onEnterPreloadArea={handleEnterPreloadArea}
+            />
           ))}
-        </Masonry>
+        </div>
       ) : (
         <div className="col-span-full text-center py-8">
           <FileVideo className="h-12 w-12 mx-auto text-muted-foreground" />
diff --git a/src/components/video/VideoCard.tsx b/src/components/video/VideoCard.tsx
index a13c833..1d0bb00 100644
--- a/src/components/video/VideoCard.tsx
+++ b/src/components/video/VideoCard.tsx
@@ -71,7 +71,7 @@ const VideoCard: React.FC<VideoCardProps> = ({
   const isMobile = useIsMobile();
   const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
   const cardRef = useRef<HTMLDivElement>(null);
-  const isHoveringRef = useRef(isHovering);
+  // Initialize aspect ratio from metadata to prevent layout shift
   const [aspectRatio, setAspectRatio] = useState<number | null>(
     video.metadata?.aspectRatio ?? null
   );
@@ -83,11 +83,6 @@ const VideoCard: React.FC<VideoCardProps> = ({
   const pageContext = location.pathname.includes('/profile/') ? 'profile' : 'asset';
   logger.log(`VideoCard ${video.id}: Determined context: ${pageContext}`);
 
-  useEffect(() => {
-    isHoveringRef.current = isHovering;
-    logger.log(`VideoCard: isHovering prop changed for ${video.id}: ${isHovering}`);
-  }, [isHovering, video.id]);
-  
   useEffect(() => {
     if (video.metadata?.placeholder_image) {
       setThumbnailUrl(video.metadata.placeholder_image);
@@ -110,7 +105,7 @@ const VideoCard: React.FC<VideoCardProps> = ({
   
   const handleMouseEnter = () => {
     logger.log(`VideoCard: Mouse entered for ${video.id}`);
-    if (onHoverChange && !isHoveringRef.current) {
+    if (onHoverChange && !isHovering) {
       logger.log(`VideoCard: Notifying parent of hover start for ${video.id}`);
       onHoverChange(true);
     }
@@ -118,20 +113,14 @@ const VideoCard: React.FC<VideoCardProps> = ({
   
   const handleMouseLeave = () => {
     logger.log(`VideoCard: Mouse left for ${video.id}`);
-    if (onHoverChange && isHoveringRef.current) {
+    if (onHoverChange && isHovering) {
       logger.log(`VideoCard: Notifying parent of hover end for ${video.id}`);
       onHoverChange(false);
     }
   };
   
   const getCreatorName = () => {
-    if (video.metadata?.creatorName) {
-      if (video.metadata.creatorName.includes('@')) {
-        return video.metadata.creatorName.split('@')[0];
-      }
-      return video.metadata.creatorName;
-    }
-    
+    // No creatorName on metadata, use reviewer_name or fallback
     if (video.reviewer_name) {
       if (video.reviewer_name.includes('@')) {
         return video.reviewer_name.split('@')[0];
@@ -259,7 +248,7 @@ const VideoCard: React.FC<VideoCardProps> = ({
       ref={cardRef}
       key={video.id} 
       className={cn(
-        "relative z-10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 mb-4",
+        "relative z-10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col bg-white/5 backdrop-blur-sm border border-white/10",
         currentRelevantStatus === 'Hidden' && isAuthorized && "opacity-50 grayscale hover:opacity-75"
       )}
       onMouseEnter={handleMouseEnter}
@@ -269,221 +258,130 @@ const VideoCard: React.FC<VideoCardProps> = ({
       data-video-id={video.id}
     >
       <div 
-        className="w-full overflow-hidden bg-muted relative max-h-[75vh] group"
-        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16/9' }}
+        className="w-full overflow-hidden bg-muted relative"
+        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16 / 9' }}
       >
-        <div className="absolute inset-0 w-full h-full">
+        <div className="absolute top-0 left-0 w-full h-full">
           <VideoPreview
-            key={`video-${video.id}`}
             url={video.url}
-            title={video.metadata?.title || `Video by ${getCreatorName()}`}
-            creator={getCreatorName()}
-            className="w-full h-full object-cover"
+            thumbnailUrl={thumbnailUrl || video.placeholder_image || video.metadata?.placeholder_image}
             isHovering={isHovering}
-            lazyLoad={false}
-            thumbnailUrl={thumbnailUrl}
             onLoadedData={handleVideoLoad}
             onVisibilityChange={handleVisibilityChange}
             shouldBePlaying={shouldBePlaying}
+            className="w-full h-full object-cover"
           />
+        </div>
+      </div>
 
-          {/* Expand Icon for Mobile - Now Bottom Right */}
-          {isMobile && (
-            <div 
-              className="absolute bottom-2 right-2 z-20 p-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none"
-              title="Tap to expand"
-            >
-              <ArrowUpRight className="h-4 w-4 text-white/80" />
-            </div>
+      {/* Overlay for Admin Actions */}
+      {isAuthorized && (
+        <div 
+          className={cn(
+            "absolute top-2 right-2 z-50 flex gap-2",
+            !isMobile && "opacity-0 group-hover:opacity-100 transition-opacity duration-200" // Apply hover effect only on desktop
           )}
-
-          {/* Title and creator info for mobile (conditionally show creator) */}
-          {isMobile && (video.metadata?.title || (!isProfilePage && video.user_id)) && (
-            <div
-              className="absolute top-2 left-2 z-20 bg-black/30 backdrop-blur-sm rounded-md p-1.5 max-w-[70%] pointer-events-none"
-            >
-              {video.metadata?.title && (
-                <span className="block text-white text-xs font-medium leading-snug line-clamp-2">
-                  {video.metadata.title}
-                </span>
-              )}
-              {video.user_id && !isProfilePage && (
-                <div className="mt-0.5">
-                  <LoraCreatorInfo
-                    asset={{ user_id: video.user_id } as any}
-                    avatarSize="h-4 w-4"
-                    textSize="text-xs"
-                    overrideTextColor="text-white/80"
-                  />
-                </div>
+          onClick={e => {
+            e.stopPropagation();
+            e.preventDefault();
+          }}
+          style={{ pointerEvents: 'all' }}
+        >
+          {isLoRAAssetPage && onSetPrimaryMedia && (
+            <Button
+              variant="ghost"
+              size="icon"
+              className={cn(
+                "h-7 w-7 p-0 rounded-md shadow-sm",
+                "bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm",
+                video.is_primary && "text-yellow-400 hover:text-yellow-300"
               )}
-            </div>
-          )}
-
-          {/* Title and creator info for desktop when alwaysShowInfo is true AND hover isn't forced */}
-          {!isMobile && alwaysShowInfo && !forceCreatorHoverDesktop && (video.metadata?.title || (!isProfilePage && video.user_id)) && (
-            <div
-              className="absolute top-2 left-2 z-20 bg-black/30 backdrop-blur-sm rounded-md p-1.5 max-w-[70%] pointer-events-none"
+              onClick={handleSetPrimary}
+              title={video.is_primary ? "This is the primary media" : "Make primary video"}
+              disabled={video.is_primary}
             >
-              {video.metadata?.title && (
-                <span className="block text-white text-xs font-medium leading-snug line-clamp-2">
-                  {video.metadata.title}
-                </span>
-              )}
-              {/* Show creator info only if not on profile page */}
-              {video.user_id && !isProfilePage && (
-                <div className="mt-0.5">
-                  <LoraCreatorInfo
-                    asset={{ user_id: video.user_id } as any}
-                    avatarSize="h-4 w-4"
-                    textSize="text-xs"
-                    overrideTextColor="text-white/80"
-                  />
-                </div>
-              )}
-            </div>
-          )}
-
-          {/* Status controls at bottom left */}
-          {isAuthorized && (
-            <div className={cn(
-              "absolute bottom-2 left-2 z-50 transition-opacity duration-200",
-              !isMobile && "opacity-0 group-hover:opacity-100" // Apply hover effect only on desktop
-            )} onClick={e => {
-              e.stopPropagation();
-              e.preventDefault();
-            }} style={{ pointerEvents: 'all' }}>
-              <VideoStatusControls
-                status={currentRelevantStatus}
-                onStatusChange={handleStatusChange}
-                className=""
-              />
-            </div>
+              <Star className={cn("h-4 w-4", video.is_primary && "fill-current text-yellow-400")} />
+            </Button>
           )}
 
-          {/* Delete and primary buttons at top right (Adjust positioning if mobile expand icon is present) */}
-          {isAuthorized && (
-            <div 
-              className={cn(
-                "absolute top-2 right-2 z-50 flex gap-2",
-                !isMobile && "opacity-0 group-hover:opacity-100 transition-opacity duration-200" // Apply hover effect only on desktop
-              )}
-              onClick={e => {
-                e.stopPropagation();
-                e.preventDefault();
-              }}
-              style={{ pointerEvents: 'all' }}
-            >
-              {isLoRAAssetPage && onSetPrimaryMedia && (
-                <Button
-                  variant="ghost"
-                  size="icon"
+          {isAdmin && (
+            <AlertDialog>
+              <AlertDialogTrigger asChild>
+                <Button 
+                  variant="destructive" 
+                  size="icon" 
                   className={cn(
-                    "h-7 w-7 p-0 rounded-md shadow-sm",
-                    "bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm",
-                    video.is_primary && "text-yellow-400 hover:text-yellow-300"
+                    "h-7 w-7 p-0 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm",
+                    isDeleting && "opacity-50 cursor-not-allowed"
                   )}
-                  onClick={handleSetPrimary}
-                  title={video.is_primary ? "This is the primary media" : "Make primary video"}
-                  disabled={video.is_primary}
+                  title="Delete video permanently"
+                  disabled={!onDeleteVideo || isDeleting}
+                  onClick={(e) => e.stopPropagation()}
                 >
-                  <Star className={cn("h-4 w-4", video.is_primary && "fill-current text-yellow-400")} />
+                  {isDeleting ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Trash className="h-4 w-4" />}
                 </Button>
-              )}
-
-              {isAdmin && (
-                <AlertDialog>
-                  <AlertDialogTrigger asChild>
-                    <Button 
-                      variant="destructive" 
-                      size="icon" 
-                      className={cn(
-                        "h-7 w-7 p-0 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm",
-                        isDeleting && "opacity-50 cursor-not-allowed"
-                      )}
-                      title="Delete video permanently"
-                      disabled={!onDeleteVideo || isDeleting}
-                      onClick={(e) => e.stopPropagation()}
-                    >
-                      {isDeleting ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Trash className="h-4 w-4" />}
-                    </Button>
-                  </AlertDialogTrigger>
-                  <AlertDialogContent onClick={(e) => e.stopPropagation()}> 
-                    <AlertDialogHeader>
-                      <AlertDialogTitle>Delete this video?</AlertDialogTitle>
-                      <AlertDialogDescription>
-                        This action cannot be undone. The video file and its metadata will be permanently removed.
-                      </AlertDialogDescription>
-                    </AlertDialogHeader>
-                    <AlertDialogFooter>
-                      <AlertDialogCancel onClick={(e) => e.stopPropagation()} disabled={isDeleting}>Cancel</AlertDialogCancel>
-                      <AlertDialogAction 
-                        onClick={handleDeleteConfirm}
-                        disabled={isDeleting}
-                        className="bg-destructive hover:bg-destructive/90"
-                      >
-                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
-                      </AlertDialogAction>
-                    </AlertDialogFooter>
-                  </AlertDialogContent>
-                </AlertDialog>
-              )}
-            </div>
-          )}
-
-          {/* Play Button overlay (only shown on hover on non-mobile) */}
-          {!isMobile && (
-            <div 
-              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none
-                ${isHovering ? 'opacity-0' : 'opacity-100'} 
-              `}
-            >
-              <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm shadow-md">
-                <Play className="h-6 w-6 text-white animate-pulse-opacity" />
-              </div>
-            </div>
-          )}
-
-          {/* Gradient overlay and text (Show on hover if !alwaysShowInfo OR forceCreatorHoverDesktop, but NOT on profile page) */}
-          {!isMobile && !isProfilePage && (!alwaysShowInfo || forceCreatorHoverDesktop) && (
-            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-between p-2 z-10">
-              <div className="flex flex-col items-start">
-                {video.metadata?.title && (
-                  <span className="text-white text-sm font-medium line-clamp-2 mr-2 pointer-events-auto">
-                    {video.metadata.title}
-                  </span>
-                )}
-                {video.user_id && (
-                  <div 
-                    style={{ pointerEvents: 'auto', position: 'relative', zIndex: 20 }} 
-                    className="mt-0.5" 
-                    onClick={(e) => e.stopPropagation()}
+              </AlertDialogTrigger>
+              <AlertDialogContent onClick={(e) => e.stopPropagation()}> 
+                <AlertDialogHeader>
+                  <AlertDialogTitle>Delete this video?</AlertDialogTitle>
+                  <AlertDialogDescription>
+                    This action cannot be undone. The video file and its metadata will be permanently removed.
+                  </AlertDialogDescription>
+                </AlertDialogHeader>
+                <AlertDialogFooter>
+                  <AlertDialogCancel onClick={(e) => e.stopPropagation()} disabled={isDeleting}>Cancel</AlertDialogCancel>
+                  <AlertDialogAction 
+                    onClick={handleDeleteConfirm}
+                    disabled={isDeleting}
+                    className="bg-destructive hover:bg-destructive/90"
                   >
-                    <LoraCreatorInfo
-                      asset={{ user_id: video.user_id } as any}
-                      avatarSize="h-4 w-4"
-                      textSize="text-xs"
-                      overrideTextColor="text-white/80"
-                    />
-                  </div>
-                )}
-              </div>
-              <div /> {/* Empty div to maintain flex spacing */}
-            </div>
+                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
+                  </AlertDialogAction>
+                </AlertDialogFooter>
+              </AlertDialogContent>
+            </AlertDialog>
           )}
         </div>
-      </div>
+      )}
 
-      {/* Desktop Click Indicator - Bottom Right */}
+      {/* Play Button overlay (only shown on hover on non-mobile) */}
       {!isMobile && (
         <div 
-          className={cn(
-            "absolute bottom-2 right-2 z-20 p-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none",
-            "opacity-0 group-hover:opacity-100 transition-opacity duration-300" // Only show on hover
-          )}
-          title="Click to view details"
+          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none
+            ${isHovering ? 'opacity-0' : 'opacity-100'} 
+          `}
         >
-          <ArrowUpRight className="h-4 w-4 text-white/80" />
+          <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm shadow-md">
+            <Play className="h-6 w-6 text-white animate-pulse-opacity" />
+          </div>
+        </div>
+      )}
+
+      {/* Gradient overlay and text (Show on hover if !alwaysShowInfo OR forceCreatorHoverDesktop, but NOT on profile page) */}
+      {!isMobile && !isProfilePage && (!alwaysShowInfo || forceCreatorHoverDesktop) && (
+        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-between p-2 z-10">
+          <div className="flex flex-col items-start">
+            {video.metadata?.title && (
+              <span className="text-white text-sm font-medium line-clamp-2 mr-2 pointer-events-auto">
+                {video.metadata.title}
+              </span>
+            )}
+            {video.user_id && (
+              <div 
+                style={{ pointerEvents: 'auto', position: 'relative', zIndex: 20 }} 
+                className="mt-0.5" 
+                onClick={(e) => e.stopPropagation()}
+              >
+                <LoraCreatorInfo
+                  asset={{ user_id: video.user_id } as any}
+                  avatarSize="h-4 w-4"
+                  textSize="text-xs"
+                  overrideTextColor="text-white/80"
+                />
+              </div>
+            )}
+          </div>
+          <div /> {/* Empty div to maintain flex spacing */}
         </div>
       )}
     </div>
diff --git a/src/components/video/VideoGallerySection.tsx b/src/components/video/VideoGallerySection.tsx
index f64b04f..f3e314a 100644
--- a/src/components/video/VideoGallerySection.tsx
+++ b/src/components/video/VideoGallerySection.tsx
@@ -1,7 +1,5 @@
 import React, { useState, useEffect, useRef, useCallback } from 'react';
-import Masonry from 'react-masonry-css';
-import { VideoEntry, AdminStatus } from '@/lib/types';
-import VideoCard from '@/components/video/VideoCard';
+import { VideoEntry, AdminStatus, VideoDisplayStatus } from '@/lib/types';
 import { useIsMobile } from '@/hooks/use-mobile';
 import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
 import { Link } from 'react-router-dom';
@@ -13,10 +11,11 @@ import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import UploadPage from '@/pages/upload/UploadPage';
 import { cn } from '@/lib/utils';
+import VideoGrid from './VideoGrid';
 
 interface VideoGallerySectionProps {
   videos: VideoEntry[];
-  header: string;
+  header?: string;
   isLoading?: boolean;
   seeAllPath?: string;
   alwaysShowInfo?: boolean;
@@ -24,18 +23,21 @@ interface VideoGallerySectionProps {
   emptyMessage?: string;
   showAddButton?: boolean;
   addButtonClassification?: 'art' | 'gen';
-  /** Custom breakpoint configuration for the Masonry grid */
-  breakpointCols?: Record<string | number, number>;
+  /** Custom number of items per row */
+  itemsPerRow?: number;
   /** If true, forces creator info to only show on hover on desktop, overriding alwaysShowInfo for that element */
   forceCreatorHoverDesktop?: boolean;
-}
 
-// Default breakpoints if none are provided via props
-const defaultBreakpointColumnsObj = {
-  default: 3,
-  1100: 2,
-  640: 1,
-};
+  // Add props to pass down for actions and permissions
+  isAdmin?: boolean;
+  isAuthorized?: boolean;
+  onOpenLightbox: (video: VideoEntry) => void; // Make required as parent should handle lightbox
+  onApproveVideo?: (id: string) => Promise<void>;
+  onDeleteVideo?: (id: string) => Promise<void>;
+  onRejectVideo?: (id: string) => Promise<void>;
+  onUpdateLocalVideoStatus?: (id: string, newStatus: VideoDisplayStatus) => void;
+  compact?: boolean; // New prop to render section without default margins/header
+}
 
 const logger = new Logger('VideoGallerySection');
 
@@ -48,180 +50,72 @@ const VideoGallerySection: React.FC<VideoGallerySectionProps> = ({
   emptyMessage,
   showAddButton = false,
   addButtonClassification = 'gen',
-  breakpointCols,
+  itemsPerRow = 4,
   forceCreatorHoverDesktop = false,
+  // Destructure new props
+  isAdmin = false, 
+  isAuthorized = false,
+  onOpenLightbox, 
+  onApproveVideo,
+  onDeleteVideo,
+  onRejectVideo,
+  onUpdateLocalVideoStatus,
+  compact = false,
 }) => {
   const isMobile = useIsMobile();
-
-  // Track which video should autoplay while in viewport (mobile only)
-  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
-  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
-  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
-  const lastVideoIdRef = useRef<string | null>(null);
-  const unmountedRef = useRef(false);
-  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
-  const [galleryVideos, setGalleryVideos] = useState<VideoEntry[]>(videos);
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
-
-  useEffect(() => {
-    return () => {
-      unmountedRef.current = true;
-      if (visibilityTimeoutRef.current) {
-        clearTimeout(visibilityTimeoutRef.current);
-      }
-    };
-  }, []);
+  const [galleryVideos, setGalleryVideos] = useState<VideoEntry[]>(videos);
 
   useEffect(() => {
     setGalleryVideos(videos);
   }, [videos]);
 
-  const handleVideoVisibilityChange = useCallback(
-    (videoId: string, isVisible: boolean) => {
-      if (visibilityTimeoutRef.current) {
-        clearTimeout(visibilityTimeoutRef.current);
-        visibilityTimeoutRef.current = null;
-      }
-
-      if (isVisible) {
-        visibilityTimeoutRef.current = setTimeout(() => {
-          if (!unmountedRef.current) {
-            setVisibleVideoId(videoId);
-          }
-        }, 150);
-      } else {
-        setVisibleVideoId((prev) => (prev === videoId ? null : prev));
-      }
-    },
-    []
-  );
-
-  const handleOpenLightbox = useCallback((video: VideoEntry) => {
-    logger.log('Opening lightbox for video:', video.id);
-    lastVideoIdRef.current = video.id;
-    setLightboxVideo(video);
-  }, []);
-
-  const handleCloseLightbox = useCallback(() => {
-    logger.log('Closing lightbox');
-    setLightboxVideo(null);
-  }, []);
-
-  const updateVideoLocally = useCallback((id: string, updater: (v: VideoEntry) => VideoEntry) => {
-    setGalleryVideos(prev => prev.map(v => (v.id === id ? updater(v) : v)));
-    setLightboxVideo(prev => (prev && prev.id === id ? updater(prev) : prev));
-  }, []);
-
-  const handleLightboxVideoUpdate = useCallback(async () => {
-    const videoId = lastVideoIdRef.current;
-    if (!videoId) return;
-    try {
-      const { data, error } = await supabase
-        .from('media')
-        .select('id, title, description')
-        .eq('id', videoId)
-        .single();
-      if (error) throw error;
-      updateVideoLocally(videoId, (v) => ({
-        ...v,
-        metadata: {
-          ...(v.metadata || {}),
-          title: data.title,
-          description: data.description,
-        },
-      }));
-    } catch (error) {
-      toast.error('Failed to refresh video details');
-      console.error('handleLightboxVideoUpdate error', error);
-    }
-  }, [updateVideoLocally]);
-
-  const handleLightboxAdminStatusChange = useCallback(async (newStatus: AdminStatus) => {
-    const videoId = lastVideoIdRef.current;
-    if (!videoId) return;
-
-    // Define which statuses should remain visible in curated galleries
-    const curatedStatuses: AdminStatus[] = ['Curated', 'Featured'];
-
-    try {
-      const { error } = await supabase
-        .from('media')
-        .update({ admin_status: newStatus, admin_reviewed: true })
-        .eq('id', videoId);
-      if (error) throw error;
-
-      toast.success(`Video admin status updated to ${newStatus}`);
-
-      // If the updated status is still within curated categories, simply mutate the local state
-      if (curatedStatuses.includes(newStatus)) {
-        updateVideoLocally(videoId, (v) => ({ ...v, admin_status: newStatus }));
-      } else {
-        // Otherwise remove the video from the current gallery so the UI reflects the change immediately
-        setGalleryVideos(prev => prev.filter(v => v.id !== videoId));
-        // Also clear the lightbox video reference if it matches
-        setLightboxVideo(prev => (prev && prev.id === videoId ? null : prev));
-      }
-    } catch (error) {
-      toast.error('Failed to update admin status');
-      console.error('handleLightboxAdminStatusChange error', error);
-    }
-  }, [updateVideoLocally]);
-
   return (
-    <section className="space-y-4 mt-10">
-      <div className="flex items-center justify-between">
-        <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
-          {header}
-        </h2>
-        {seeAllPath && (
-          <Link
-            to={seeAllPath}
-            className="text-sm text-primary hover:underline ml-auto"
-          >
-            See all curated {header} →
-          </Link>
-        )}
-      </div>
+    <section className={compact ? "space-y-4" : "space-y-4 mt-10"}>
+      {header && !compact && (
+        <div className="flex items-center justify-between">
+          <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
+            {header}
+          </h2>
+          {seeAllPath && (
+            <Link
+              to={seeAllPath}
+              className="text-sm text-primary hover:underline ml-auto"
+            >
+              See all curated {header} →
+            </Link>
+          )}
+        </div>
+      )}
 
       {isLoading ? (
         <LoraGallerySkeleton count={isMobile ? 2 : 6} />
       ) : galleryVideos.length === 0 ? (
         <p className="text-muted-foreground text-sm">{emptyMessage ?? 'There are no curated videos yet :('}</p>
       ) : (
-        <Masonry
-          breakpointCols={breakpointCols || defaultBreakpointColumnsObj}
-          className="my-masonry-grid"
-          columnClassName="my-masonry-grid_column"
-        >
-          {galleryVideos.map((video) => (
-            <VideoCard
-              key={video.id}
-              video={video}
-              isAdmin={false}
-              isAuthorized={false}
-              onOpenLightbox={handleOpenLightbox}
-              isHovering={hoveredVideoId === video.id}
-              onHoverChange={(isHovering) =>
-                setHoveredVideoId(isHovering ? video.id : null)
-              }
-              onVisibilityChange={handleVideoVisibilityChange}
-              shouldBePlaying={isMobile && video.id === visibleVideoId}
-              alwaysShowInfo={alwaysShowInfo}
-              forceCreatorHoverDesktop={forceCreatorHoverDesktop}
-            />
-          ))}
-        </Masonry>
+        <VideoGrid
+          videos={galleryVideos}
+          itemsPerRow={isMobile ? 2 : itemsPerRow}
+          isAdmin={isAdmin}
+          isAuthorized={isAuthorized}
+          onOpenLightbox={onOpenLightbox}
+          onApproveVideo={onApproveVideo}
+          onDeleteVideo={onDeleteVideo}
+          onRejectVideo={onRejectVideo}
+          onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
+          alwaysShowInfo={alwaysShowInfo}
+          forceCreatorHoverDesktop={forceCreatorHoverDesktop}
+        />
       )}
 
       {/* Conditionally render the Add button and its Dialog */}
-      {showAddButton && (
+      {showAddButton && !compact && (
         <div className="mt-6 flex justify-start">
           <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
             <DialogTrigger asChild>
               <Button 
                 variant="ghost"
                 size={isMobile ? "sm" : "default"} 
-                // Consider if disabled state is needed here based on auth/loading
                 className={cn(
                   "border border-input hover:bg-accent hover:text-accent-foreground",
                   "text-muted-foreground",
@@ -231,31 +125,11 @@ const VideoGallerySection: React.FC<VideoGallerySectionProps> = ({
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-[80vw] overflow-y-auto">
-              {/* Render UploadPage with Media mode, specific classification, and hidden layout */}
               <UploadPage initialMode="media" defaultClassification={addButtonClassification} hideLayout={true} />
             </DialogContent>
           </Dialog>
         </div>
       )}
-
-      {lightboxVideo && (
-        <VideoLightbox 
-          isOpen={!!lightboxVideo} 
-          onClose={handleCloseLightbox} 
-          videoUrl={lightboxVideo.url} 
-          videoId={lightboxVideo.id}
-          title={lightboxVideo.metadata?.title}
-          description={lightboxVideo.metadata?.description}
-          thumbnailUrl={lightboxVideo.placeholder_image || lightboxVideo.metadata?.placeholder_image}
-          creatorId={lightboxVideo.user_id}
-          isAuthorized={false}
-          adminStatus={lightboxVideo.admin_status}
-          currentStatus={null}
-          onStatusChange={() => Promise.resolve()}
-          onAdminStatusChange={handleLightboxAdminStatusChange}
-          onVideoUpdate={handleLightboxVideoUpdate}
-        />
-      )}
     </section>
   );
 };
diff --git a/src/components/video/VideoGrid.tsx b/src/components/video/VideoGrid.tsx
new file mode 100644
index 0000000..a77b635
--- /dev/null
+++ b/src/components/video/VideoGrid.tsx
@@ -0,0 +1,260 @@
+import { useState, useEffect, useRef, useMemo } from "react";
+import { Button } from "@/components/ui/button";
+import { motion } from "framer-motion";
+import { VideoEntry } from "@/lib/types";
+import VideoCard from "./VideoCard";
+import { useIsMobile } from "@/hooks/use-mobile";
+
+// Define standard video resolutions and their aspect ratios
+const resolutions = [
+  { w: 1920, h: 1080, label: "16:9 1080p" },
+  { w: 1280, h: 720, label: "HD 720p" },
+  { w: 1080, h: 1920, label: "Vertical 9:16" },
+  { w: 2560, h: 1440, label: "QHD" },
+  { w: 720, h: 1280, label: "Vertical 720×1280" },
+  { w: 640, h: 480, label: "4:3 SD" },
+  { w: 1080, h: 1080, label: "Square 1:1 1080" },
+];
+
+const DEFAULT_ROW_HEIGHT = 180; // px baseline before scaling
+
+// Define an extended type for videos with display dimensions
+type DisplayVideoEntry = VideoEntry & {
+  displayW: number;
+  displayH: number;
+};
+
+interface VideoGridProps {
+  videos: VideoEntry[];
+  itemsPerRow?: number;
+  isAdmin?: boolean;
+  isAuthorized?: boolean;
+  onOpenLightbox: (video: VideoEntry) => void;
+  onApproveVideo?: (id: string) => Promise<void>;
+  onDeleteVideo?: (id: string) => Promise<void>;
+  onRejectVideo?: (id: string) => Promise<void>;
+  onSetPrimaryMedia?: (id: string) => Promise<void>;
+  onUpdateLocalVideoStatus?: (id: string, newStatus: string) => void;
+  alwaysShowInfo?: boolean;
+  forceCreatorHoverDesktop?: boolean;
+}
+
+export default function VideoGrid({
+  videos,
+  itemsPerRow = 4,
+  isAdmin = false,
+  isAuthorized = false,
+  onOpenLightbox,
+  onApproveVideo,
+  onDeleteVideo,
+  onRejectVideo,
+  onSetPrimaryMedia,
+  onUpdateLocalVideoStatus,
+  alwaysShowInfo = false,
+  forceCreatorHoverDesktop = false,
+}: VideoGridProps) {
+  const containerRef = useRef<HTMLDivElement>(null);
+  const [containerWidth, setContainerWidth] = useState(0);
+  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
+  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
+  const isMobile = useIsMobile();
+
+  // Update container width on resize
+  useEffect(() => {
+    const measure = () => {
+      if (containerRef.current) {
+        setContainerWidth(containerRef.current.offsetWidth);
+      }
+    };
+    measure();
+    window.addEventListener("resize", measure);
+    return () => window.removeEventListener("resize", measure);
+  }, []);
+
+  // Calculate rows based on container width and items per row
+  const rows = useMemo(() => {
+    if (!containerWidth || !videos.length) return [];
+    
+    // Helper function to get the correct aspect ratio
+    const getAspectRatio = (vid: VideoEntry): number => {
+      return (
+        // Prefer top‑level aspectRatio prop if provided (e.g., on profile page)
+        // then fall back to metadata.aspectRatio, otherwise assume 16/9.
+        (vid as any).aspectRatio ?? vid.metadata?.aspectRatio ?? 16 / 9
+      );
+    };
+
+    // --- Single Video Case --- 
+    if (videos.length === 1) {
+      const video = videos[0];
+      const aspectRatio = getAspectRatio(video);
+      let displayH = DEFAULT_ROW_HEIGHT * 1.5; // Make single videos a bit larger than default row height
+      let displayW = aspectRatio * displayH;
+
+      // Ensure the calculated width doesn't exceed container width
+      if (displayW > containerWidth) {
+        displayW = containerWidth * 0.9; // Use 90% of width to leave some padding
+        displayH = displayW / aspectRatio;
+      }
+
+      // Return a single row, with the single item
+      const singleVideoRow: DisplayVideoEntry[] = [
+        {
+          ...video,
+          displayW,
+          displayH,
+        }
+      ];
+      return [singleVideoRow]; // Wrap in an array as the component expects rows
+    }
+    // --- End Single Video Case ---
+    
+    // --- Mobile: Single Column Layout ---
+    if (isMobile) {
+      return videos.map((video) => {
+        // Use the same helper as desktop to get the correct aspect ratio
+        const aspectRatio = getAspectRatio(video);
+        // Use full container width for the video
+        const displayW = containerWidth;
+        const displayH = displayW / aspectRatio;
+        // Each video is its own row
+        return [
+          {
+            ...video,
+            displayW,
+            displayH,
+          },
+        ];
+      });
+    }
+    
+    // --- Desktop: Multi-Column Layout (Existing logic) ---
+    const initialRows: DisplayVideoEntry[][] = [];
+    let cursor = 0;
+    
+    // Initial layout calculation
+    while (cursor < videos.length) {
+      const slice = videos.slice(cursor, cursor + itemsPerRow);
+      const GAP_PX = 8; // Tailwind gap-2 equals 0.5rem (assuming root font-size 16px)
+
+      const sumWidth = slice.reduce((acc, vid) => {
+        const aspectRatio = getAspectRatio(vid);
+        return acc + aspectRatio * DEFAULT_ROW_HEIGHT;
+      }, 0);
+
+      // Account for total horizontal gaps in the current row to avoid overflow
+      const totalGapWidth = (slice.length - 1) * GAP_PX;
+
+      const availableWidth = containerWidth - totalGapWidth;
+
+      const scale = availableWidth / sumWidth;
+      const rowH = DEFAULT_ROW_HEIGHT * scale;
+      
+      initialRows.push(
+        slice.map(video => {
+          // Use metadata.aspectRatio again
+          const aspectRatio = getAspectRatio(video);
+          return {
+            ...video,
+            displayW: aspectRatio * rowH,
+            displayH: rowH,
+          };
+        })
+      );
+      
+      cursor += slice.length; 
+    }
+
+    // --- Row Balancing Logic ---
+    if (initialRows.length >= 2) {
+      const lastRow = initialRows[initialRows.length - 1];
+      const secondLastRow = initialRows[initialRows.length - 2];
+      const threshold = Math.ceil(itemsPerRow / 2);
+
+      if (lastRow.length < threshold && secondLastRow.length >= itemsPerRow) { // Ensure secondLastRow has enough items to give one away
+        const itemToMove = secondLastRow.pop(); 
+        if (itemToMove) {
+          lastRow.unshift(itemToMove); 
+
+          // Recalculate both affected rows to ensure proper widths/heights after balancing
+          const GAP_PX = 8; // Must match earlier constant
+
+          const recalcRow = (rowSlice: DisplayVideoEntry[]): DisplayVideoEntry[] => {
+            if (!rowSlice || rowSlice.length === 0) return [];
+
+            const sumWidth = rowSlice.reduce((acc, video) => {
+              const aspectRatio = getAspectRatio(video);
+              return acc + aspectRatio * DEFAULT_ROW_HEIGHT;
+            }, 0);
+
+            const totalGapWidth = (rowSlice.length - 1) * GAP_PX;
+            const availableWidth = containerWidth - totalGapWidth;
+            const scale = availableWidth / sumWidth;
+            const rowH = DEFAULT_ROW_HEIGHT * scale;
+
+            return rowSlice.map(video => {
+              const aspectRatio = getAspectRatio(video);
+              return {
+                ...video,
+                displayW: aspectRatio * rowH,
+                displayH: rowH,
+              };
+            });
+          };
+
+          initialRows[initialRows.length - 2] = recalcRow(secondLastRow);
+          initialRows[initialRows.length - 1] = recalcRow(lastRow);
+        }
+      }
+    }
+    
+    return initialRows.filter(row => row.length > 0); 
+  }, [containerWidth, videos, itemsPerRow, isMobile]);
+
+  const handleHoverChange = (videoId: string, isHovering: boolean) => {
+    setHoveredVideoId(isHovering ? videoId : null);
+  };
+
+  const handleVideoVisibilityChange = (videoId: string, isVisible: boolean) => {
+    if (isVisible) {
+      setVisibleVideoId(videoId);
+    } else if (visibleVideoId === videoId) {
+      setVisibleVideoId(null);
+    }
+  };
+
+  return (
+    <div ref={containerRef} className="w-full">
+      {rows.map((row, rIdx) => (
+        <div key={rIdx} className="flex gap-2 mb-2">
+          {row.map((video: DisplayVideoEntry) => (
+            <motion.div
+              key={video.id}
+              layout
+              style={{ width: video.displayW, height: video.displayH }}
+              className="relative rounded-lg"
+            >
+              <VideoCard
+                video={video}
+                isAdmin={isAdmin}
+                isAuthorized={isAuthorized}
+                onOpenLightbox={onOpenLightbox}
+                onApproveVideo={onApproveVideo}
+                onDeleteVideo={onDeleteVideo}
+                onRejectVideo={onRejectVideo}
+                onSetPrimaryMedia={onSetPrimaryMedia}
+                isHovering={hoveredVideoId === video.id}
+                onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
+                onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
+                onVisibilityChange={handleVideoVisibilityChange}
+                shouldBePlaying={isMobile && video.id === visibleVideoId}
+                alwaysShowInfo={alwaysShowInfo}
+                forceCreatorHoverDesktop={forceCreatorHoverDesktop}
+              />
+            </motion.div>
+          ))}
+        </div>
+      ))}
+    </div>
+  );
+} 
\ No newline at end of file
diff --git a/src/index.css b/src/index.css
index 50af50f..b07e323 100644
--- a/src/index.css
+++ b/src/index.css
@@ -160,45 +160,23 @@
   100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
 }
 
-/* Masonry Styles */
-.my-masonry-grid {
-  display: -webkit-box; /* Not needed if autoprefixing */
-  display: -ms-flexbox; /* Not needed if autoprefixing */
-  display: flex;
-  margin-left: -1rem; /* Adjust based on your column gap (pl-4 -> 1rem) */
-  width: auto;
-}
-
-.my-masonry-grid_column {
-  padding-left: 1rem; /* Adjust based on your column gap */
-  background-clip: padding-box;
-}
-
-/* Style for individual Masonry items */
-.my-masonry-grid_column > div { /* Adjust if your item wrapper changes */
-  margin-bottom: 1rem; /* Adjust based on desired row gap */
-}
-
 /* Fade-out effect for Masonry containers */
 .masonry-fade-container {
   position: relative;
-  /* Remove fixed max-height here, apply via Tailwind classes instead */
-  /* max-height: 85vh; */ 
-  /* overflow: hidden; */ /* REMOVED: Ensures clipping */
 }
 
 /* NEW: Styles for the dedicated fade overlay element */
 .fade-overlay-element {
-  content: ''; /* Good practice, though not strictly needed for a div */
+  content: '';
   position: absolute;
   bottom: 0;
   left: 0;
   right: 0;
-  height: 100px; /* Adjust height of the fade */
-  z-index: 5; /* Position it above default content but below elevated VideoCards */
+  height: 100px;
+  z-index: 5;
   background: linear-gradient(to bottom,
     hsl(var(--card) / 0),
-    hsl(var(--card) / 1) 60% /* Becomes fully opaque at 60% */
+    hsl(var(--card) / 1) 60%
   );
-  pointer-events: none; /* Allow clicks to pass through */
+  pointer-events: none;
 }
diff --git a/src/pages/AssetDetailPage/components/AssetVideoSection.tsx b/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
index 3ddc1d6..a0aa682 100644
--- a/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
+++ b/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
@@ -12,8 +12,6 @@ import {
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
-import Masonry from 'react-masonry-css';
-import { DummyCard, generateDummyItems } from '@/components/common/DummyCard';
 import { useLocation } from 'react-router-dom';
 import {
   Pagination,
@@ -31,15 +29,8 @@ import UploadPage from '@/pages/upload/UploadPage';
 
 const logger = new Logger('AssetVideoSection');
 
-const breakpointColumnsObj = {
-  default: 3,
-  1100: 3,
-  700: 2,
-  500: 1
-};
-
-const isVideoEntry = (item: VideoEntry | { type: 'dummy' }): item is VideoEntry => {
-  return !('type' in item && item.type === 'dummy');
+const isVideoEntry = (item: VideoEntry): item is VideoEntry => {
+  return item && typeof item === 'object' && 'id' in item && 'url' in item;
 };
 
 interface AssetVideoSectionProps {
@@ -110,17 +101,6 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
     return sorted;
   }, [videos, classification, asset?.primary_media_id]);
 
-  const getItemsWithDummies = <T extends VideoEntry>(
-    allItems: T[]
-  ): Array<T | { type: 'dummy'; id: string; colorClass: string }> => {
-    if (allItems.length > 4 && allItems.length < 10) {
-      const dummyItems = generateDummyItems(6, allItems.length);
-      return [...allItems, ...dummyItems];
-    } else {
-      return allItems;
-    }
-  };
-
   const videosToDisplay = useMemo(() => {
     // logger.log(`Filtering by authorization. isAuthorized: ${isAuthorized}`);
     if (isAuthorized) {
@@ -140,8 +120,9 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
   // Paginate the videos
   const paginatedVideos = useMemo(() => {
     const start = (currentPage - 1) * itemsPerPage;
+    // logger.log(`Paginating videos. Current page: ${currentPage}, Start index: ${start}, Total videos: ${videosToDisplay.length}`);
     return videosToDisplay.slice(start, start + itemsPerPage);
-  }, [videosToDisplay, currentPage]);
+  }, [videosToDisplay, currentPage, itemsPerPage]);
 
   // Reset page when the classification filter changes only
   useEffect(() => {
@@ -199,8 +180,6 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
     }
   }, []); // Empty dependency array as it uses refs and state setters
 
-  const itemsToDisplay = useMemo(() => getItemsWithDummies(paginatedVideos), [paginatedVideos]); // Paginate before adding dummies
-  
   const scrollToGridWithOffset = (offset: number = -150) => {
     if (gridContainerRef.current) {
       const y = gridContainerRef.current.getBoundingClientRect().top + window.pageYOffset + offset;
@@ -239,25 +218,20 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
         <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
           <DialogTrigger asChild>
             <Button 
-              variant="ghost"
+              variant="outline"
               size={isMobile ? "sm" : "default"}
-              className={cn(
-                "border border-input hover:bg-accent hover:text-accent-foreground",
-                "text-muted-foreground",
-                isMobile ? "h-9 rounded-md px-3" : "h-10 px-4 py-2"
-              )}
+              className="w-full md:w-auto"
             >
-              Upload Video
+              Upload Video for {asset?.name}
             </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
             <DialogHeader>
-              <DialogTitle>Upload Media for {asset?.name || 'this LoRA'}</DialogTitle>
+              <DialogTitle>Upload Video for {asset?.name}</DialogTitle>
             </DialogHeader>
-            <UploadPage
+            <UploadPage 
               initialMode="media"
-              forcedLoraId={asset?.id}
-              defaultClassification="gen"
+              defaultClassification={asset?.lora_type === 'Style' ? 'art' : 'gen'}
               hideLayout={true}
               onSuccess={handleUploadSuccess}
             />
@@ -265,116 +239,104 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
         </Dialog>
       </div>
       
-      {videosToDisplay.length > 0 ? (
-        <div ref={gridContainerRef} className="relative pt-6">
-          <Masonry
-            breakpointCols={breakpointColumnsObj}
-            className="my-masonry-grid"
-            columnClassName="my-masonry-grid_column"
-          >
-            {itemsToDisplay.map(item => {
-              if (isVideoEntry(item)) {
-                return (
-                  <VideoCard
-                    key={item.id}
-                    video={item}
-                    isAdmin={isAdmin}
-                    isAuthorized={isAuthorized}
-                    onOpenLightbox={onOpenLightbox}
-                    onApproveVideo={handleApproveVideo}
-                    onDeleteVideo={handleDeleteVideo}
-                    onRejectVideo={handleRejectVideo}
-                    onSetPrimaryMedia={handleSetPrimaryMedia}
-                    isHovering={hoveredVideoId === item.id}
-                    onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)}
-                    onUpdateLocalVideoStatus={onStatusChange}
-                    // Pass down visibility callback and play state
-                    onVisibilityChange={handleVideoVisibilityChange}
-                    shouldBePlaying={isMobile && item.id === visibleVideoId} // Only true if mobile AND this video is the visible one
-                  />
-                );
-              } else {
-                return (
-                  <DummyCard
-                    key={item.id}
-                    id={item.id}
-                    colorClass={item.colorClass}
-                  />
-                );
-              }
+      <div ref={gridContainerRef} className="mt-6">
+        {videosToDisplay.length === 0 ? (
+          <EmptyState 
+            title="No Videos Yet" 
+            description={classification === 'all' 
+              ? "No videos have been associated with this LoRA yet." 
+              : `No ${classification === 'gen' ? 'generation' : 'art'} videos found for this LoRA.`} 
+          />
+        ) : (
+          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
+            {paginatedVideos.map((video) => {
+              const isHovering = hoveredVideoId === video.id;
+              const isActive = visibleVideoId === video.id;
+
+              return (
+                <VideoCard
+                  key={video.id}
+                  video={video}
+                  isAdmin={isAdmin}
+                  isAuthorized={isAuthorized}
+                  isHovering={isHovering}
+                  onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
+                  onVisibilityChange={handleVideoVisibilityChange}
+                  onOpenLightbox={onOpenLightbox}
+                  onApproveVideo={handleApproveVideo}
+                  onRejectVideo={handleRejectVideo}
+                  onDeleteVideo={handleDeleteVideo}
+                  onSetPrimaryMedia={handleSetPrimaryMedia}
+                  onStatusChange={onStatusChange}
+                  showAdminControls={isAuthorized}
+                  showUserControls={isAuthorized}
+                  showPrimaryButton={isAuthorized && isLoraPage}
+                  source="assetDetail"
+                  forceCreatorHoverDesktop={false}
+                  alwaysShowInfo={false}
+                />
+              );
             })}
-          </Masonry>
-          {/* Pagination Controls */} 
-          {totalPages > 1 && (
-            <Pagination className="mt-6">
-              <PaginationContent>
-                <PaginationItem>
-                  <PaginationPrevious
-                    onClick={() => {
-                      scrollToGridWithOffset();
-                      setTimeout(() => {
-                        if (!unmountedRef.current) {
-                            setCurrentPage((p) => Math.max(1, p - 1));
-                        }
-                      }, 300); // Changed to 300ms
-                    }}
-                    className={
-                      currentPage === 1
-                        ? 'pointer-events-none opacity-50'
-                        : 'cursor-pointer hover:bg-muted/50 transition-colors'
-                    }
-                  />
-                </PaginationItem>
+          </div>
+        )}
+      </div>
 
-                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
+      {totalPages > 1 && (
+        <Pagination className="mt-6">
+          <PaginationContent>
+            <PaginationItem>
+              <PaginationPrevious
+                href="#"
+                onClick={(e) => {
+                  e.preventDefault();
+                  if (currentPage > 1) {
+                    setCurrentPage(currentPage - 1);
+                    scrollToGridWithOffset();
+                  }
+                }}
+                aria-disabled={currentPage === 1}
+                className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
+              />
+            </PaginationItem>
+            {[...Array(totalPages)].map((_, i) => {
+              const page = i + 1;
+              if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
+                return (
                   <PaginationItem key={page}>
                     <PaginationLink
-                      onClick={() => {
-                        if (page !== currentPage) {
-                          scrollToGridWithOffset();
-                          setTimeout(() => {
-                            if (!unmountedRef.current) {
-                                setCurrentPage(page);
-                            }
-                          }, 300); // Changed to 300ms
-                        }
+                      href="#"
+                      onClick={(e) => {
+                        e.preventDefault();
+                        setCurrentPage(page);
+                        scrollToGridWithOffset();
                       }}
-                      isActive={currentPage === page}
-                      className="cursor-pointer hover:bg-muted/50 transition-colors"
+                      isActive={page === currentPage}
                     >
                       {page}
                     </PaginationLink>
                   </PaginationItem>
-                ))}
-
-                <PaginationItem>
-                  <PaginationNext
-                    onClick={() => {
-                      scrollToGridWithOffset();
-                      setTimeout(() => {
-                        if (!unmountedRef.current) {
-                            setCurrentPage((p) => Math.min(totalPages, p + 1));
-                        }
-                      }, 300); // Changed to 300ms
-                    }}
-                    className={
-                      currentPage === totalPages
-                        ? 'pointer-events-none opacity-50'
-                        : 'cursor-pointer hover:bg-muted/50 transition-colors'
-                    }
-                  />
-                </PaginationItem>
-              </PaginationContent>
-            </Pagination>
-          )}
-        </div>
-      ) : (
-        <EmptyState 
-          title="No Videos"
-          description={classification === 'all' 
-            ? "No videos are currently associated with this LoRA."
-            : `No ${classification} videos found for this LoRA.`}
-        />
+                );
+              } else if (Math.abs(page - currentPage) === 2) {
+                return <PaginationItem key={`ellipsis-${page}`}><span className="px-2">...</span></PaginationItem>;
+              }
+              return null;
+            })}
+            <PaginationItem>
+              <PaginationNext
+                href="#"
+                onClick={(e) => {
+                  e.preventDefault();
+                  if (currentPage < totalPages) {
+                    setCurrentPage(currentPage + 1);
+                    scrollToGridWithOffset();
+                  }
+                }}
+                aria-disabled={currentPage === totalPages}
+                className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
+              />
+            </PaginationItem>
+          </PaginationContent>
+        </Pagination>
       )}
     </div>
   );
diff --git a/src/pages/Index.tsx b/src/pages/Index.tsx
index ab184df..51abcfd 100644
--- a/src/pages/Index.tsx
+++ b/src/pages/Index.tsx
@@ -50,14 +50,6 @@ const getTotalPages = (totalItems: number, pageSize: number): number => {
     return Math.ceil(totalItems / pageSize);
 };
 
-// Define breakpoint columns for the Generations grid (denser)
-const generationBreakpoints = {
-  default: 6,
-  1100: 4,
-  768: 3,
-  640: 2,
-};
-
 // Smooth scroll helper
 const scrollToElementWithOffset = (element: HTMLElement | null, offset: number = -150) => {
   if (!element) return;
@@ -453,6 +445,10 @@ const Index: React.FC = () => {
     );
   };
 
+  // Define items per row for different sections
+  const GENERATION_ITEMS_PER_ROW = 6;
+  const ART_ITEMS_PER_ROW = 4;
+
   return (
     <div className="flex flex-col min-h-screen">
       <Navigation />
@@ -557,6 +553,7 @@ const Index: React.FC = () => {
               emptyMessage="There's no art matching the current filter."
               showAddButton={true}
               addButtonClassification="art"
+              itemsPerRow={ART_ITEMS_PER_ROW}
             />
             {renderPaginationControls(artPage, displayArtVideos.totalPages, handleArtPageChange)}
           </div>
@@ -574,7 +571,7 @@ const Index: React.FC = () => {
               emptyMessage="There are no generations matching the current filter."
               showAddButton={true}
               addButtonClassification="gen"
-              breakpointCols={generationBreakpoints}
+              itemsPerRow={GENERATION_ITEMS_PER_ROW}
               forceCreatorHoverDesktop={true}
             />
             {renderPaginationControls(generationPage, displayGenVideos.totalPages, handleGenerationPageChange)}
diff --git a/src/pages/UserProfilePage.tsx b/src/pages/UserProfilePage.tsx
index 4b29b30..5abcdf7 100644
--- a/src/pages/UserProfilePage.tsx
+++ b/src/pages/UserProfilePage.tsx
@@ -16,7 +16,6 @@ import { Button } from '@/components/ui/button';
 import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
 import VideoCard from '@/components/video/VideoCard';
 import VideoLightbox from '@/components/VideoLightbox';
-import Masonry from 'react-masonry-css';
 import {
   Pagination,
   PaginationContent,
@@ -32,6 +31,8 @@ import { Helmet } from 'react-helmet-async';
 import { cn } from '@/lib/utils';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import UploadPage from '@/pages/upload/UploadPage';
+import LoraManager from '@/components/LoraManager';
+import VideoGallerySection from '@/components/video/VideoGallerySection';
 
 const logger = new Logger('UserProfilePage');
 
@@ -791,26 +792,74 @@ export default function UserProfilePage() {
               <CardContent ref={lorasGridRef} className="p-4 md:p-6">
                 {isLoadingAssets ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                  userAssets.length > 0 ? ( <> 
-                    <div className="relative pt-6"> <Masonry breakpointCols={defaultBreakpointColumnsObj} className="my-masonry-grid" columnClassName="my-masonry-grid_column"> 
-                        {loraItemsForPage.map(item => ( <LoraCard 
-                            key={item.id} 
-                            lora={item} 
-                            isAdmin={isAdmin && !forceLoggedOutView} 
-                            isOwnProfile={isOwner} 
-                            userStatus={item.user_status} 
-                            onUserStatusChange={handleAssetStatusUpdate} 
-                            hideCreatorInfo={true} 
-                            isUpdatingStatus={isUpdatingAssetStatus[item.id]} 
-                            // Add autoplay props
-                            onVisibilityChange={handleVideoVisibilityChange} 
-                            shouldBePlaying={isMobile && item.id === visibleVideoId}
-                          /> ))} 
-                    </Masonry> </div> 
+                    <LoraManager
+                      loras={loraItemsForPage} 
+                      isLoading={isLoadingAssets} // Reflect LoRA loading state
+                      lorasAreLoading={isLoadingAssets} // Pass same state
+                      isAdmin={canEdit} // Use calculated edit permission
+                      onUserStatusChange={handleAssetStatusUpdate} // Pass status update handler
+                      isUpdatingStatusMap={isUpdatingAssetStatus} // Pass map of updating statuses
+                      showSeeAllLink={false} // Don't show "See All" on profile
+                      // Omit filterText, onFilterTextChange, onRefreshData, onNavigateToUpload
+                      // Omit hideCreatorInfo (handled by LoraManager or default)
+                      // Omit visibility/autoplay props for now
+                    />
                     {totalLoraPages > 1 && renderPaginationControls(loraPage, totalLoraPages, handleLoraPageChange)} </> 
                 ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't created any LoRAs yet. </div> )} 
               </CardContent>
             </Card>
-
+            <Card className="mt-8 mb-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-olive-light/30 backdrop-blur-sm border border-olive-dark/20 animate-fade-in">
+              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-olive/10 to-cream/10">
+                <CardTitle className="text-olive-dark">Art</CardTitle>
+                {isOwner && !forceLoggedOutView && (
+                   <Dialog open={isArtUploadModalOpen} onOpenChange={setIsArtUploadModalOpen}>
+                     <DialogTrigger asChild>
+                       <Button size="sm" className="bg-gradient-to-r from-olive-dark to-olive hover:opacity-90 transition-all duration-300">
+                         Add Art
+                       </Button>
+                     </DialogTrigger>
+                     <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
+                       <DialogHeader>
+                         <DialogTitle>Upload Art</DialogTitle>
+                       </DialogHeader>
+                       <UploadPage 
+                         initialMode="media" 
+                         defaultClassification="art" 
+                         hideLayout={true} 
+                         onSuccess={handleArtUploadSuccess}
+                       />
+                     </DialogContent>
+                   </Dialog>
+                )}
+              </CardHeader>
+              <CardContent>
+                 {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 4} /> ) : 
+                  artVideos.length > 0 ? ( <> 
+                    <div ref={artGridRef}> {/* Removed -mt-10 wrapper */}
+                      <VideoGallerySection 
+                        header="" // No need for header title inside card
+                        videos={artItemsForPage}
+                        itemsPerRow={4} // Match Index page
+                        isLoading={isLoadingVideos}
+                        isAdmin={canEdit}
+                        isAuthorized={canEdit}
+                        compact={true} // Use compact mode inside card
+                        onOpenLightbox={handleOpenLightbox}
+                        onApproveVideo={approveVideo}
+                        onRejectVideo={rejectVideo}
+                        onDeleteVideo={deleteVideo}
+                        onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate}
+                        alwaysShowInfo={true} // Always show on profile
+                        // Don't show add button or see all link here
+                        showAddButton={false}
+                        seeAllPath=""
+                        emptyMessage="This user hasn't added any art videos yet." // Custom empty message
+                      />
+                    </div>
+                    {totalArtPages > 1 && renderPaginationControls(artPage, totalArtPages, handleArtPageChange)} </> 
+                 ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't added any art videos yet. </div> )} 
+              </CardContent>
+            </Card>
             <Card className="mt-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-gold-light/30 backdrop-blur-sm border border-gold-dark/20 animate-fade-in">
               <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-gold/10 to-cream/10">
                 <CardTitle className="text-gold-dark">Generations</CardTitle>
@@ -838,78 +887,33 @@ export default function UserProfilePage() {
               <CardContent>
                  {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                   generationVideos.length > 0 ? ( <> 
-                     <div ref={generationsGridRef} className="relative pt-6"> <Masonry breakpointCols={generationBreakpointColumnsObj} className="my-masonry-grid" columnClassName="my-masonry-grid_column"> 
-                         {generationItemsForPage.map((item) => ( <VideoCard 
-                            key={item.id} 
-                            video={item} 
-                            isAdmin={canEdit} 
-                            isAuthorized={canEdit} 
-                            onOpenLightbox={handleOpenLightbox} 
-                            onApproveVideo={approveVideo} 
-                            onRejectVideo={rejectVideo} 
-                            onDeleteVideo={deleteVideo} 
-                            isHovering={hoveredVideoId === item.id} 
-                            onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)} 
-                            onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate} 
-                            // Autoplay props
-                            onVisibilityChange={handleVideoVisibilityChange}
-                            shouldBePlaying={isMobile && item.id === visibleVideoId}
-                          /> ))} 
-                     </Masonry> </div> 
+                    <div ref={generationsGridRef}> {/* Removed -mt-10 wrapper */}
+                       <VideoGallerySection 
+                         header="" // No header inside card
+                         videos={generationItemsForPage}
+                         itemsPerRow={6} // Match Index page
+                         isLoading={isLoadingVideos}
+                         isAdmin={canEdit}
+                         isAuthorized={canEdit}
+                         compact={true} // Use compact mode inside card
+                         onOpenLightbox={handleOpenLightbox}
+                         onApproveVideo={approveVideo}
+                         onRejectVideo={rejectVideo}
+                         onDeleteVideo={deleteVideo}
+                         onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate}
+                         alwaysShowInfo={true} // Always show on profile
+                         forceCreatorHoverDesktop={true} // Match Index page for Generations
+                         showAddButton={false}
+                         seeAllPath=""
+                         emptyMessage="This user hasn't generated any videos yet." // Custom empty message
+                       />
+                     </div>
                      {totalGenerationPages > 1 && renderPaginationControls(generationPage, totalGenerationPages, handleGenerationPageChange)} </> 
                  ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't generated any videos yet. </div> )} 
               </CardContent>
             </Card>
 
-            <Card className="mt-8 mb-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-olive-light/30 backdrop-blur-sm border border-olive-dark/20 animate-fade-in">
-              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-olive/10 to-cream/10">
-                <CardTitle className="text-olive-dark">Art</CardTitle>
-                {isOwner && !forceLoggedOutView && (
-                   <Dialog open={isArtUploadModalOpen} onOpenChange={setIsArtUploadModalOpen}>
-                     <DialogTrigger asChild>
-                       <Button size="sm" className="bg-gradient-to-r from-olive-dark to-olive hover:opacity-90 transition-all duration-300">
-                         Add Art
-                       </Button>
-                     </DialogTrigger>
-                     <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
-                       <DialogHeader>
-                         <DialogTitle>Upload Art</DialogTitle>
-                       </DialogHeader>
-                       <UploadPage 
-                         initialMode="media" 
-                         defaultClassification="art" 
-                         hideLayout={true} 
-                         onSuccess={handleArtUploadSuccess}
-                       />
-                     </DialogContent>
-                   </Dialog>
-                )}
-              </CardHeader>
-              <CardContent>
-                 {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 4} /> ) : 
-                  artVideos.length > 0 ? ( <> 
-                     <div ref={artGridRef} className="relative pt-6"> <Masonry breakpointCols={defaultBreakpointColumnsObj} className="my-masonry-grid" columnClassName="my-masonry-grid_column"> 
-                         {artItemsForPage.map((item) => ( <VideoCard 
-                            key={item.id} 
-                            video={item} 
-                            isAdmin={canEdit} 
-                            isAuthorized={canEdit} 
-                            onOpenLightbox={handleOpenLightbox} 
-                            onApproveVideo={approveVideo} 
-                            onRejectVideo={rejectVideo} 
-                            onDeleteVideo={deleteVideo} 
-                            isHovering={hoveredVideoId === item.id} 
-                            onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)} 
-                            onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate} 
-                            // Autoplay props
-                            onVisibilityChange={handleVideoVisibilityChange}
-                            shouldBePlaying={isMobile && item.id === visibleVideoId}
-                          /> ))} 
-                     </Masonry> </div> 
-                     {totalArtPages > 1 && renderPaginationControls(artPage, totalArtPages, handleArtPageChange)} </> 
-                 ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't added any art videos yet. </div> )} 
-              </CardContent>
-            </Card>
+
 
           </>
         )}
```
---
**Commit:** `06bc5a3`
**Author:** POM
**Date:** 2025-04-24
**Message:** feat: Implement lightbox navigation and fix Lora upload flow  - Added previous/next navigation buttons to VideoLightbox. - Connected lightbox navigation in AssetDetailPage, Index, and UserProfilePage. - Updated VideoCard for better hover performance and lazy-loading on profile pages. - Adjusted LoraCard aspect ratio handling for profile/home pages. - Passed forcedLoraId to UploadPage when uploading media from AssetDetailPage. - Ensured media uploaded via UploadPage with forcedLoraId is correctly linked to the asset. - Removed unused VideoGrid.tsx and related entries.
```diff
diff --git a/src/components/Navigation.tsx b/src/components/Navigation.tsx
index cf01591..16cba10 100644
--- a/src/components/Navigation.tsx
+++ b/src/components/Navigation.tsx
@@ -1,4 +1,3 @@
-
 import React, { useState, useEffect } from 'react';
 import { Link, useLocation } from 'react-router-dom';
 import { cn } from '@/lib/utils';
@@ -108,7 +107,7 @@ export const Footer = () => {
           </a>
         </div>
         <hr className="w-[12.5%] border-t-2 border-border/50" />
-        <div className="flex items-center text-xs pb-1">
+        <div className="flex items-center text-xs pb-1 social-links">
           <a 
             href="https://github.com/peteromallet/openmuse" 
             target="_blank" 
@@ -126,8 +125,512 @@ export const Footer = () => {
           </a>
         </div>
       </footer>
+      {/* Plant animation overlay */}
+      <PlantAnimation />
     </div>
   );
 };
 
 export default Navigation;
+
+const PlantAnimation: React.FC = () => {
+  // This component injects the provided plant-growing animation into the page.
+  // The bulk of the logic is executed within the useEffect so it only runs on the client.
+  useEffect(() => {
+    // --- Canvas & DOM elements -------------------------------------------------
+    const canvas = document.getElementById('plantCanvas') as HTMLCanvasElement | null;
+    if (!canvas) return;
+    const ctx = canvas.getContext('2d');
+    if (!ctx) return;
+
+    const initialBud = document.getElementById('initialBud') as HTMLElement | null;
+    const wateringContainer = document.querySelector('.watering-container') as HTMLElement | null;
+
+    if (!initialBud || !wateringContainer) return;
+
+    const dpr = window.devicePixelRatio || 1;
+
+    // Ensure initial bud is visible
+    initialBud.style.opacity = '1';
+
+    // -------------------------------------------------------------------------
+    //  Helper utilities
+    // -------------------------------------------------------------------------
+    function addSlowerTransition() {
+      wateringContainer.style.transition =
+        'transform 2.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 1s ease';
+    }
+
+    function resizeCanvas() {
+      const rect = canvas.getBoundingClientRect();
+      canvas.width = rect.width * dpr;
+      canvas.height = rect.height * dpr;
+      ctx.setTransform(1, 0, 0, 1, 0, 0);
+      ctx.scale(dpr, dpr);
+      canvas.style.width = `${rect.width}px`;
+      canvas.style.height = `${rect.height}px`;
+    }
+
+    resizeCanvas();
+
+    let baseSize = {
+      width: canvas.getBoundingClientRect().width,
+      height: canvas.getBoundingClientRect().height,
+    };
+
+    window.addEventListener('resize', () => {
+      resizeCanvas();
+      if (!animationStarted) {
+        baseSize = {
+          width: canvas.getBoundingClientRect().width,
+          height: canvas.getBoundingClientRect().height,
+        };
+      }
+    });
+
+    // -------------------------------------------------------------------------
+    //  Branch & Seed classes (mostly verbatim from provided code)
+    // -------------------------------------------------------------------------
+    interface IBranch {
+      startX: number;
+      startY: number;
+      length: number;
+      angle: number;
+      branchWidth: number;
+      grown: number;
+      speed: number;
+      flowered: boolean;
+      floweringProgress: number;
+      flowerPosition: number;
+      update: () => void;
+      draw: () => void;
+    }
+
+    const branches: any[] = [];
+    const seeds: any[] = [];
+    let animationStarted = false;
+    let treeCount = 0;
+    const MAX_TREES = 100;
+
+    class Branch implements IBranch {
+      public child1?: Branch;
+      public child2?: Branch;
+      private flowerColors = [
+        '#e04f5f',
+        '#ffc800',
+        '#24b1b0',
+        '#ba68c8',
+        '#4caf50',
+        '#ff9800',
+        '#009688',
+      ];
+      private flowerColor: string;
+
+      constructor(
+        public startX: number,
+        public startY: number,
+        public length: number,
+        public angle: number,
+        public branchWidth: number,
+        flowerColorIndex: number,
+      ) {
+        this.grown = 0;
+        this.speed = Math.random() * 0.5 + 0.5;
+        this.flowered = false;
+        this.floweringProgress = 0;
+        this.flowerPosition = Math.random() * 0.5 + 0.25;
+        this.flowerColor =
+          this.flowerColors[flowerColorIndex % this.flowerColors.length];
+      }
+
+      grown: number;
+      speed: number;
+      flowered: boolean;
+      floweringProgress: number;
+      flowerPosition: number;
+
+      update() {
+        if (this.grown < this.length) {
+          this.grown += this.speed;
+
+          if (this.grown > this.length * 0.3 && !this.child1) {
+            const branchingAngle =
+              (Math.random() * 40 + 10) * (this.angle < 180 ? 1 : -1);
+            const branchLength = this.length * (Math.random() * 0.6 + 0.3);
+            const startX =
+              this.startX + Math.sin((this.angle * Math.PI) / 180) * -this.grown;
+            const startY =
+              this.startY + Math.cos((this.angle * Math.PI) / 180) * -this.grown;
+            this.child1 = new Branch(
+              startX,
+              startY,
+              branchLength,
+              this.angle + branchingAngle,
+              this.branchWidth * 0.7,
+              Math.floor(Math.random() * 7),
+            );
+            branches.push(this.child1);
+          }
+
+          if (this.grown > this.length * 0.6 && !this.child2) {
+            const branchingAngle =
+              (Math.random() * 40 + 10) * (this.angle < 180 ? -1 : 1);
+            const branchLength = this.length * (Math.random() * 0.6 + 0.3);
+            const startX =
+              this.startX + Math.sin((this.angle * Math.PI) / 180) * -this.grown;
+            const startY =
+              this.startY + Math.cos((this.angle * Math.PI) / 180) * -this.grown;
+            this.child2 = new Branch(
+              startX,
+              startY,
+              branchLength,
+              this.angle - branchingAngle,
+              this.branchWidth * 0.7,
+              Math.floor(Math.random() * 7),
+            );
+            branches.push(this.child2);
+          }
+        } else if (!this.flowered) {
+          this.flowered = true;
+          this.startFlowering();
+        }
+        this.draw();
+      }
+
+      startFlowering() {
+        if (this.floweringProgress < 1) {
+          this.floweringProgress += 0.01;
+          setTimeout(() => this.startFlowering(), 100);
+        } else {
+          setTimeout(() => {
+            const seedX =
+              this.startX +
+              Math.sin((this.angle * Math.PI) / 180) *
+                -this.length * this.flowerPosition;
+            const seedY =
+              this.startY +
+              Math.cos((this.angle * Math.PI) / 180) *
+                -this.length * this.flowerPosition;
+            seeds.push(new Seed(seedX, seedY));
+          }, 1000 + Math.random() * 5000);
+        }
+      }
+
+      draw() {
+        ctx.lineWidth = this.branchWidth;
+        ctx.strokeStyle = '#8fb996';
+        ctx.beginPath();
+        ctx.moveTo(this.startX, this.startY);
+        ctx.lineTo(
+          this.startX + Math.sin((this.angle * Math.PI) / 180) * -this.grown,
+          this.startY + Math.cos((this.angle * Math.PI) / 180) * -this.grown,
+        );
+        ctx.stroke();
+
+        if (this.floweringProgress > 0) {
+          const flowerX =
+            this.startX +
+            Math.sin((this.angle * Math.PI) / 180) *
+              -this.length * this.flowerPosition;
+          const flowerY =
+            this.startY +
+            Math.cos((this.angle * Math.PI) / 180) *
+              -this.length * this.flowerPosition;
+
+          ctx.fillStyle = this.flowerColor;
+          ctx.beginPath();
+          let flowerSize;
+          if (this.floweringProgress < 0.33) {
+            flowerSize = 1.5 + 1.5 * (this.floweringProgress / 0.33);
+          } else if (this.floweringProgress < 0.66) {
+            flowerSize =
+              3 + 1.5 * ((this.floweringProgress - 0.33) / 0.33);
+          } else {
+            flowerSize =
+              4.5 + 1.5 * ((this.floweringProgress - 0.66) / 0.34);
+          }
+          ctx.arc(flowerX, flowerY, flowerSize, 0, Math.PI * 2);
+          ctx.fill();
+        }
+      }
+    }
+
+    class Seed {
+      planted: boolean = false;
+      hasCheckedGrowth: boolean = false;
+      vx: number;
+      speed: number;
+      constructor(public x: number, public y: number) {
+        this.vx = Math.random() * 2 - 1;
+        this.speed = Math.random() * 1 + 0.5;
+      }
+
+      update() {
+        if (this.y < canvas.getBoundingClientRect().height) {
+          this.x += this.vx;
+          this.y += this.speed;
+        } else if (!this.planted && !this.hasCheckedGrowth) {
+          this.hasCheckedGrowth = true;
+          if (Math.random() < 0.02 && treeCount < MAX_TREES) {
+            const branchStartX = this.x;
+            const branchStartY = canvas.getBoundingClientRect().height;
+            const branchLength = canvas.getBoundingClientRect().height / 6;
+            branches.push(new Branch(branchStartX, branchStartY, branchLength, 0, 8, 5));
+            treeCount++;
+          }
+          this.planted = true;
+        }
+        this.draw();
+      }
+
+      draw() {
+        ctx.fillStyle = '#c9a07a';
+        ctx.beginPath();
+        ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
+        ctx.fill();
+      }
+    }
+
+    // -------------------------------------------------------------------------
+    //  Animation logic
+    // -------------------------------------------------------------------------
+    let frameId: number;
+    const animate = () => {
+      ctx.save();
+      ctx.setTransform(1, 0, 0, 1, 0, 0);
+      ctx.fillStyle = '#fbf8ef';
+      ctx.fillRect(0, 0, canvas.width, canvas.height);
+      ctx.restore();
+
+      branches.forEach((b) => b.update());
+      seeds.forEach((s) => s.update());
+      frameId = requestAnimationFrame(animate);
+    };
+
+    // -------------------------------------------------------------------------
+    //  Growth starter
+    // -------------------------------------------------------------------------
+    const startGrowth = (startX: number, startY: number) => {
+      const offsetY = 5;
+      const finalStartX = startX;
+      const finalStartY = startY + offsetY;
+      const cssCanvasHeight = canvas.height / dpr;
+      const upBranchLength = cssCanvasHeight / 7.5;
+      branches.push(new Branch(finalStartX, finalStartY, upBranchLength, 0, 10, 7));
+      treeCount++;
+      let rootBranchLength = cssCanvasHeight - finalStartY;
+      if (rootBranchLength < 50) rootBranchLength = 50;
+      const rootBranch = new Branch(finalStartX, finalStartY, rootBranchLength, 180, 10, 0);
+      rootBranch.floweringProgress = -1;
+      rootBranch.flowered = true;
+      branches.push(rootBranch);
+      animate();
+    };
+
+    // -------------------------------------------------------------------------
+    //  Watering interaction
+    // -------------------------------------------------------------------------
+    const handleWatering = (event: Event) => {
+      event.preventDefault();
+      if (animationStarted) return;
+      animationStarted = true;
+      wateringContainer.classList.add('no-hover');
+      addSlowerTransition();
+      wateringContainer.classList.add('pouring');
+
+      const budRect = initialBud.getBoundingClientRect();
+      const canvasRect = canvas.getBoundingClientRect();
+      const startX = budRect.left - canvasRect.left + budRect.width / 2;
+      const startY = budRect.top - canvasRect.top + budRect.height / 2;
+
+      const drops = document.querySelectorAll('.drop') as NodeListOf<HTMLElement>;
+      drops.forEach((d) => (d.style.animationDuration = '0.7s'));
+
+      setTimeout(() => {
+        wateringContainer.classList.remove('pouring');
+        const freshBudRect = initialBud.getBoundingClientRect();
+        const freshStartX =
+          freshBudRect.left - canvasRect.left + freshBudRect.width / 2;
+        const freshStartY =
+          freshBudRect.top - canvasRect.top + freshBudRect.height / 2;
+        startGrowth(freshStartX, freshStartY);
+
+        setTimeout(() => {
+          wateringContainer.classList.add('fade-out');
+          initialBud.style.transition = 'opacity 1.5s ease-in-out';
+          initialBud.style.opacity = '0';
+
+          setTimeout(() => {
+            wateringContainer.style.display = 'none';
+            initialBud.style.display = 'none';
+            setTimeout(() => {
+              const socialLinks = document.querySelector('.social-links') as HTMLElement | null;
+              if (socialLinks) {
+                socialLinks.style.transition = 'margin-bottom 1.5s ease-in-out';
+                setTimeout(() => {
+                  socialLinks.style.marginBottom = '0.45rem';
+                }, 50);
+              }
+            }, 1000);
+          }, 1000);
+        }, 1000);
+      }, 1500);
+    };
+
+    wateringContainer.addEventListener('click', handleWatering, { once: true });
+    wateringContainer.addEventListener('touchend', handleWatering, { once: true });
+
+    // -------------------------------------------------------------------------
+    //  Cleanup
+    // -------------------------------------------------------------------------
+    return () => {
+      wateringContainer.removeEventListener('click', handleWatering);
+      wateringContainer.removeEventListener('touchend', handleWatering);
+      cancelAnimationFrame(frameId);
+    };
+  }, []);
+
+  return (
+    <>
+      {/* Inline styles injected for the animation */}
+      <style>{`
+        #plantCanvas {
+            position: fixed;
+            top: 0;
+            left: 0;
+            width: 100vw;
+            height: 100vh;
+            z-index: 0;
+            pointer-events: none;
+            background: transparent;
+            transform: translate3d(0, 0, 0);
+        }
+        .watering-container {
+            position: absolute;
+            top: calc(100% + 0rem);
+            left: calc(50% - 1.0rem);
+            transform: translateX(calc(-50% + 10px));
+            cursor: pointer;
+            z-index: 1000;
+            transform-origin: 80% 100%;
+            transition: transform 2.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 1s ease;
+            width: 50px;
+            height: 50px;
+        }
+        .watering-container:hover { animation: shake 0.8s ease-in-out infinite; }
+        .watering-container.no-hover:hover { animation: none; }
+        @keyframes shake {
+            0%, 100% { transform: translateX(calc(-50% + 10px)) rotate(0deg); }
+            25%      { transform: translateX(calc(-50% + 10px)) rotate(-5deg); }
+            75%      { transform: translateX(calc(-50% + 10px)) rotate(5deg); }
+        }
+        .watering-can { position: relative; width: 100%; height: 100%; }
+        .can-body {
+            position: absolute;
+            width: 34px;
+            height: 28px;
+            background: #fbf8ef;
+            border: 3px solid #888;
+            border-radius: 3px;
+            top: 10px;
+            left: 8px;
+            transform-origin: bottom right;
+        }
+        .spout {
+            position: absolute;
+            width: 18px;
+            height: 6px;
+            background: #fbf8ef;
+            border: 3px solid #888;
+            border-left: none;
+            border-radius: 0 3px 3px 0;
+            top: 16px;
+            left: 42px;
+        }
+        .handle {
+            position: absolute;
+            width: 16px;
+            height: 20px;
+            border: 3px solid #888;
+            border-left: none;
+            border-radius: 0 15px 15px 0;
+            top: 8px;
+            left: -13px;
+        }
+        .water-drops {
+            position: absolute;
+            left: 20px;
+            top: 8px;
+            width: 10px;
+            height: 10px;
+            opacity: 0;
+            transform: rotate(-30deg) translate(-5px, -5px);
+            transition: opacity 0.3s ease;
+        }
+        .drop {
+            position: absolute;
+            width: 3px;
+            height: 8px;
+            background: #6ac6ff;
+            border-radius: 1.5px;
+            opacity: 0;
+            animation: drop 0.5s infinite linear;
+        }
+        .drop:nth-child(1) { animation-delay: 0s;   }
+        .drop:nth-child(2) { animation-delay: 0.2s; }
+        .drop:nth-child(3) { animation-delay: 0.4s; }
+        @keyframes drop {
+            0%   { left: 0;  top: 0;  opacity: 1; transform: scale(1)   rotate(-45deg); }
+            100% { left: 20px; top: 8px; opacity: 0; transform: scale(0.8) rotate(-45deg); }
+        }
+        #initialBud {
+            position: absolute;
+            top: calc(100% + 2rem);
+            left: calc(50% + 1.95rem);
+            transform: translateX(calc(-50% - 2.5px));
+            width: 12px;
+            height: 12px;
+            background-color: #8fb996;
+            border-radius: 50%;
+            box-shadow: 0 0 10px rgba(143, 185, 150, 0.5);
+            z-index: 999;
+        }
+        #initialBud::after {
+            content: '';
+            position: absolute;
+            top: -8px;
+            left: 5px;
+            width: 2px;
+            height: 8px;
+            background-color: #8fb996;
+            transform: rotate(-15deg);
+        }
+        .watering-container.pouring {
+            transform: translateX(-60%) rotate(30deg);
+            animation: none;
+        }
+        .watering-container.pouring .water-drops {
+            opacity: 1;
+            transform: rotate(-30deg) translate(-2px, -2px);
+        }
+        .watering-container.fade-out { opacity: 0; }
+      `}</style>
+
+      {/* Canvas & interactive elements */}
+      <canvas id="plantCanvas" />
+      <div className="watering-container">
+        <div className="watering-can">
+          <div className="can-body" />
+          <div className="spout" />
+          <div className="handle" />
+          <div className="water-drops">
+            <div className="drop" />
+            <div className="drop" />
+            <div className="drop" />
+          </div>
+        </div>
+      </div>
+      <div id="initialBud" />
+    </>
+  );
+};
diff --git a/src/components/StorageVideoPlayer.tsx b/src/components/StorageVideoPlayer.tsx
index 48e6660..b35480c 100644
--- a/src/components/StorageVideoPlayer.tsx
+++ b/src/components/StorageVideoPlayer.tsx
@@ -282,9 +282,9 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
   };
 
   // Determine visibility states
-  const showThumbnail = !!thumbnailUrl && ((!hasHovered && !isMobile) || isLoadingVideoUrl || !isVideoLoaded);
   const showVideo = !!videoUrl && !error;
-  const showLoadingSpinner = isLoadingVideoUrl && !error && !(isMobile && !thumbnailUrl);
+  const showLoadingSpinner = isLoadingVideoUrl && !error && !isVideoLoaded && (hasHovered || shouldLoadVideo);
+  const showThumbnail = !!thumbnailUrl && !error && !(isHovering && playOnHover) && (!isVideoLoaded || preventLoadingFlicker);
 
   // logger.log(`${logPrefix} Visibility states: showThumbnail=${showThumbnail}, showVideo=${showVideo}, showLoadingSpinner=${showLoadingSpinner}, isVideoLoaded=${isVideoLoaded}, hasHovered=${hasHovered}, videoUrl=${!!videoUrl}, error=${!!error}`);
 
@@ -337,7 +337,7 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
         )}
 
         {/* Thumbnail Image */}
-        {thumbnailUrl && (
+        {showThumbnail && (
            <img 
              src={thumbnailUrl} 
              alt="Video thumbnail" 
diff --git a/src/components/VideoLightbox.tsx b/src/components/VideoLightbox.tsx
index 1046f8f..a557e54 100644
--- a/src/components/VideoLightbox.tsx
+++ b/src/components/VideoLightbox.tsx
@@ -6,7 +6,7 @@ import {
   DialogTitle,
   DialogDescription,
 } from '@/components/ui/dialog';
-import { X, Pencil, Save, XCircle, Trash, List, ListChecks, Flame, EyeOff, Loader2 } from 'lucide-react';
+import { X, Pencil, Save, XCircle, Trash, List, ListChecks, Flame, EyeOff, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
 import VideoPlayer from '@/components/video/VideoPlayer';
 import { supabase } from '@/integrations/supabase/client';
 import { useIsMobile } from '@/hooks/use-mobile';
@@ -58,6 +58,12 @@ interface VideoLightboxProps {
   onStatusChange?: (newStatus: VideoDisplayStatus) => Promise<void>;
   adminStatus?: AdminStatus | null;
   onAdminStatusChange?: (newStatus: AdminStatus) => Promise<void>;
+  /** If true, shows a button to navigate to the previous video and fires the callback when clicked */
+  hasPrev?: boolean;
+  onPrevVideo?: () => void;
+  /** If true, shows a button to navigate to the next video and fires the callback when clicked */
+  hasNext?: boolean;
+  onNextVideo?: () => void;
 }
 
 interface LoraOption {
@@ -81,7 +87,11 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
   currentStatus = null,
   onStatusChange,
   adminStatus = null,
-  onAdminStatusChange
+  onAdminStatusChange,
+  hasPrev,
+  onPrevVideo,
+  hasNext,
+  onNextVideo
 }) => {
   const { user, isAdmin } = useAuth();
 
@@ -382,6 +392,32 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
                   lazyLoad={false}
                 />
 
+                {/* Navigation Buttons - Moved inside the video player container */}
+                {hasPrev && (
+                  <Button
+                    variant="ghost"
+                    size="icon"
+                    onClick={() => {
+                      if (onPrevVideo) onPrevVideo();
+                    }}
+                    className="absolute left-2 top-1/2 -translate-y-1/2 z-50 h-10 w-10 bg-black/40 hover:bg-black/60 text-white"
+                  >
+                    <ChevronLeft className="h-6 w-6" />
+                  </Button>
+                )}
+                {hasNext && (
+                  <Button
+                    variant="ghost"
+                    size="icon"
+                    onClick={() => {
+                      if (onNextVideo) onNextVideo();
+                    }}
+                    className="absolute right-2 top-1/2 -translate-y-1/2 z-50 h-10 w-10 bg-black/40 hover:bg-black/60 text-white"
+                  >
+                    <ChevronRight className="h-6 w-6" />
+                  </Button>
+                )}
+
                 {isAuthorized && currentStatus && onStatusChange && (
                   <div
                     className="absolute top-2 left-2 z-50"
diff --git a/src/components/lora/LoraCard.tsx b/src/components/lora/LoraCard.tsx
index 7772e99..6ec7d4e 100644
--- a/src/components/lora/LoraCard.tsx
+++ b/src/components/lora/LoraCard.tsx
@@ -41,6 +41,8 @@ interface LoraCardProps {
   onVisibilityChange?: (loraId: string, isVisible: boolean) => void;
   shouldBePlaying?: boolean;
   onEnterPreloadArea?: (loraId: string, isInPreloadArea: boolean) => void;
+  /** Optional override for aspect ratio, defaults to metadata or 16:9 on profile/home */
+  aspectRatioOverride?: number;
 }
 
 const LoraCard: React.FC<LoraCardProps> = ({ 
@@ -54,9 +56,12 @@ const LoraCard: React.FC<LoraCardProps> = ({
   onVisibilityChange,
   shouldBePlaying = false,
   onEnterPreloadArea,
+  aspectRatioOverride,
 }) => {
   const navigate = useNavigate();
   const location = useLocation();
+  const isOnProfilePage = location.pathname.startsWith('/profile/');
+  const isOnHomePage = location.pathname === '/';
   const [isDeleting, setIsDeleting] = useState(false);
   const [isPinning, setIsPinning] = useState(false);
   const [isListing, setIsListing] = useState(false);
@@ -67,6 +72,9 @@ const LoraCard: React.FC<LoraCardProps> = ({
   const [aspectRatio, setAspectRatio] = useState<number | null>(
     lora?.primaryVideo?.metadata?.aspectRatio ?? null
   );
+  const finalAspectRatio = aspectRatioOverride != null
+    ? aspectRatioOverride
+    : (isOnProfilePage || isOnHomePage ? 16/9 : aspectRatio);
   const [isVisible, setIsVisible] = useState(false);
   const [isInPreloadArea, setIsInPreloadArea] = useState(false);
   const isMobile = useIsMobile();
@@ -174,8 +182,6 @@ const LoraCard: React.FC<LoraCardProps> = ({
     );
   };
   
-  const isOnProfilePage = location.pathname.startsWith('/profile/');
-  
   const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
     const video = event.target as HTMLVideoElement;
     if (video.videoWidth && video.videoHeight) {
@@ -215,7 +221,10 @@ const LoraCard: React.FC<LoraCardProps> = ({
     >
       <div 
         className="w-full overflow-hidden bg-muted relative"
-        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16 / 9' }}
+        style={finalAspectRatio != null
+          ? { paddingBottom: `${(1 / finalAspectRatio) * 100}%` }
+          : { aspectRatio: '16 / 9' }
+        }
       >
         {videoUrl ? (
           <>
diff --git a/src/components/video/VideoCard.tsx b/src/components/video/VideoCard.tsx
index 1d0bb00..04f0315 100644
--- a/src/components/video/VideoCard.tsx
+++ b/src/components/video/VideoCard.tsx
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useRef, useCallback } from 'react';
+import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
 import { useLocation } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
@@ -25,6 +25,7 @@ import { toast } from 'sonner';
 import VideoStatusControls from './VideoStatusControls';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import LoraCreatorInfo from '../lora/LoraCreatorInfo';
+import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
 
 const logger = new Logger('VideoCard');
 
@@ -78,13 +79,32 @@ const VideoCard: React.FC<VideoCardProps> = ({
   const [isDeleting, setIsDeleting] = useState(false);
   const [isStatusUpdating, setIsStatusUpdating] = useState(false);
   const [isVisible, setIsVisible] = useState(false);
+  /**
+   * Local hover state allows the card to react immediately to pointer
+   * interactions instead of waiting for the parent grid to propagate the
+   * `isHovering` prop back down. This eliminates a render-round-trip and
+   * makes the placeholder hide + video playback start perceptibly faster.
+   */
+  const [localHovering, setLocalHovering] = useState(false);
+  
+  // Merge the externally-controlled hover prop with our local state so we
+  // can respond instantly while still respecting whichever card is marked
+  // as the current hover target by the parent grid.
+  const combinedHovering = isHovering || localHovering;
+  
+  // Detect when the card itself enters the viewport (desktop only)
+  const isInViewport = useIntersectionObserver(cardRef, {
+    rootMargin: '0px 0px 300px 0px', // preload a bit before it actually appears
+    threshold: 0.05,
+  });
   
   // Determine context based on URL
   const pageContext = location.pathname.includes('/profile/') ? 'profile' : 'asset';
-  logger.log(`VideoCard ${video.id}: Determined context: ${pageContext}`);
+  // (debug) context determined
 
   useEffect(() => {
     if (video.metadata?.placeholder_image) {
+      // (debug) placeholder cached
       setThumbnailUrl(video.metadata.placeholder_image);
     }
   }, [video.metadata]);
@@ -104,19 +124,19 @@ const VideoCard: React.FC<VideoCardProps> = ({
   };
   
   const handleMouseEnter = () => {
-    logger.log(`VideoCard: Mouse entered for ${video.id}`);
-    if (onHoverChange && !isHovering) {
-      logger.log(`VideoCard: Notifying parent of hover start for ${video.id}`);
-      onHoverChange(true);
-    }
+    setLocalHovering(true);
+    // Removed callback to parent to avoid triggering parent state updates / re-renders on every hover.
+    // if (onHoverChange && !isHovering) {
+    //   onHoverChange(true);
+    // }
   };
   
   const handleMouseLeave = () => {
-    logger.log(`VideoCard: Mouse left for ${video.id}`);
-    if (onHoverChange && isHovering) {
-      logger.log(`VideoCard: Notifying parent of hover end for ${video.id}`);
-      onHoverChange(false);
-    }
+    setLocalHovering(false);
+    // Removed callback to parent to avoid triggering parent state updates / re-renders on every hover.
+    // if (onHoverChange && isHovering) {
+    //   onHoverChange(false);
+    // }
   };
   
   const getCreatorName = () => {
@@ -169,7 +189,7 @@ const VideoCard: React.FC<VideoCardProps> = ({
   const isProfilePage = pageContext === 'profile';
   const isLoRAAssetPage = pageContext === 'asset';
   
-  logger.log(`VideoCard rendering for ${video.id}, isHovering: ${isHovering}, context: ${pageContext}`);
+  // (debug) render
 
   const handleStatusChange = async (newStatus: VideoDisplayStatus) => {
     setIsStatusUpdating(true);
@@ -233,7 +253,6 @@ const VideoCard: React.FC<VideoCardProps> = ({
   
   // Callback from VideoPlayer (via VideoPreview)
   const handleVisibilityChange = useCallback((visible: boolean) => {
-    logger.log(`VideoCard ${video.id}: Visibility changed to ${visible}`);
     setIsVisible(visible);
     if (onVisibilityChange) {
       onVisibilityChange(video.id, visible);
@@ -243,145 +262,238 @@ const VideoCard: React.FC<VideoCardProps> = ({
   // Determine the relevant status to pass to the controls
   const currentRelevantStatus = isProfilePage ? video.user_status : video.assetMediaDisplayStatus;
 
+  // No need to log every hover state change; handled in handlers.
+
   return (
     <div 
       ref={cardRef}
       key={video.id} 
       className={cn(
-        "relative z-10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col bg-white/5 backdrop-blur-sm border border-white/10",
+        "relative z-10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 mb-4",
         currentRelevantStatus === 'Hidden' && isAuthorized && "opacity-50 grayscale hover:opacity-75"
       )}
       onMouseEnter={handleMouseEnter}
       onMouseLeave={handleMouseLeave}
       onClick={() => onOpenLightbox(video)}
-      data-hovering={isHovering ? "true" : "false"}
+      data-hovering={combinedHovering ? "true" : "false"}
       data-video-id={video.id}
     >
       <div 
-        className="w-full overflow-hidden bg-muted relative"
+        className="w-full overflow-hidden bg-muted relative max-h-[75vh] group"
         style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16 / 9' }}
       >
-        <div className="absolute top-0 left-0 w-full h-full">
+        <div className="absolute inset-0 w-full h-full">
           <VideoPreview
+            key={`video-${video.id}`}
             url={video.url}
-            thumbnailUrl={thumbnailUrl || video.placeholder_image || video.metadata?.placeholder_image}
-            isHovering={isHovering}
+            title={video.metadata?.title || `Video by ${getCreatorName()}`}
+            creator={getCreatorName()}
+            className="w-full h-full object-cover"
+            isHovering={combinedHovering}
+            // On profile page: lazy-load until either hovered OR the card scrolls into view (desktop only)
+            lazyLoad={isProfilePage ? (!combinedHovering && !isInViewport) : false}
+            thumbnailUrl={thumbnailUrl}
             onLoadedData={handleVideoLoad}
             onVisibilityChange={handleVisibilityChange}
             shouldBePlaying={shouldBePlaying}
-            className="w-full h-full object-cover"
           />
-        </div>
-      </div>
 
-      {/* Overlay for Admin Actions */}
-      {isAuthorized && (
-        <div 
-          className={cn(
-            "absolute top-2 right-2 z-50 flex gap-2",
-            !isMobile && "opacity-0 group-hover:opacity-100 transition-opacity duration-200" // Apply hover effect only on desktop
+          {/* Expand Icon for Mobile - Now Bottom Right */}
+          {isMobile && (
+            <div 
+              className="absolute bottom-2 right-2 z-20 p-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none"
+              title="Tap to expand"
+            >
+              <ArrowUpRight className="h-4 w-4 text-white/80" />
+            </div>
           )}
-          onClick={e => {
-            e.stopPropagation();
-            e.preventDefault();
-          }}
-          style={{ pointerEvents: 'all' }}
-        >
-          {isLoRAAssetPage && onSetPrimaryMedia && (
-            <Button
-              variant="ghost"
-              size="icon"
-              className={cn(
-                "h-7 w-7 p-0 rounded-md shadow-sm",
-                "bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm",
-                video.is_primary && "text-yellow-400 hover:text-yellow-300"
+
+          {/* Title and creator info for mobile (conditionally show creator) */}
+          {isMobile && (video.metadata?.title || (!isProfilePage && video.user_id)) && (
+            <div
+              className="absolute top-2 left-2 z-20 bg-black/30 backdrop-blur-sm rounded-md p-1.5 max-w-[70%] pointer-events-none"
+            >
+              {video.metadata?.title && (
+                <span className="block text-white text-xs font-medium leading-snug line-clamp-2">
+                  {video.metadata.title}
+                </span>
+              )}
+              {video.user_id && !isProfilePage && (
+                <div className="mt-0.5">
+                  <LoraCreatorInfo
+                    asset={{ user_id: video.user_id } as any}
+                    avatarSize="h-4 w-4"
+                    textSize="text-xs"
+                    overrideTextColor="text-white/80"
+                  />
+                </div>
               )}
-              onClick={handleSetPrimary}
-              title={video.is_primary ? "This is the primary media" : "Make primary video"}
-              disabled={video.is_primary}
+            </div>
+          )}
+
+          {/* Title and creator info for desktop when alwaysShowInfo is true AND hover isn't forced */}
+          {!isMobile && alwaysShowInfo && !forceCreatorHoverDesktop && (video.metadata?.title || (!isProfilePage && video.user_id)) && (
+            <div
+              className="absolute top-2 left-2 z-20 bg-black/30 backdrop-blur-sm rounded-md p-1.5 max-w-[70%] pointer-events-none"
             >
-              <Star className={cn("h-4 w-4", video.is_primary && "fill-current text-yellow-400")} />
-            </Button>
+              {video.metadata?.title && (
+                <span className="block text-white text-xs font-medium leading-snug line-clamp-2">
+                  {video.metadata.title}
+                </span>
+              )}
+              {/* Show creator info only if not on profile page */}
+              {video.user_id && !isProfilePage && (
+                <div className="mt-0.5">
+                  <LoraCreatorInfo
+                    asset={{ user_id: video.user_id } as any}
+                    avatarSize="h-4 w-4"
+                    textSize="text-xs"
+                    overrideTextColor="text-white/80"
+                  />
+                </div>
+              )}
+            </div>
+          )}
+
+          {/* Status controls at bottom left */}
+          {isAuthorized && (
+            <div className={cn(
+              "absolute bottom-2 left-2 z-50 transition-opacity duration-200",
+              !isMobile && "opacity-0 group-hover:opacity-100" // Apply hover effect only on desktop
+            )} onClick={e => {
+              e.stopPropagation();
+              e.preventDefault();
+            }} style={{ pointerEvents: 'all' }}>
+              <VideoStatusControls
+                status={currentRelevantStatus}
+                onStatusChange={handleStatusChange}
+                className=""
+              />
+            </div>
           )}
 
-          {isAdmin && (
-            <AlertDialog>
-              <AlertDialogTrigger asChild>
-                <Button 
-                  variant="destructive" 
-                  size="icon" 
+          {/* Delete and primary buttons at top right (Adjust positioning if mobile expand icon is present) */}
+          {isAuthorized && (
+            <div 
+              className={cn(
+                "absolute top-2 right-2 z-50 flex gap-2",
+                !isMobile && "opacity-0 group-hover:opacity-100 transition-opacity duration-200" // Apply hover effect only on desktop
+              )}
+              onClick={e => {
+                e.stopPropagation();
+                e.preventDefault();
+              }}
+              style={{ pointerEvents: 'all' }}
+            >
+              {isLoRAAssetPage && onSetPrimaryMedia && (
+                <Button
+                  variant="ghost"
+                  size="icon"
                   className={cn(
-                    "h-7 w-7 p-0 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm",
-                    isDeleting && "opacity-50 cursor-not-allowed"
+                    "h-7 w-7 p-0 rounded-md shadow-sm",
+                    "bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm",
+                    video.is_primary && "text-yellow-400 hover:text-yellow-300"
                   )}
-                  title="Delete video permanently"
-                  disabled={!onDeleteVideo || isDeleting}
-                  onClick={(e) => e.stopPropagation()}
+                  onClick={handleSetPrimary}
+                  title={video.is_primary ? "This is the primary media" : "Make primary video"}
+                  disabled={video.is_primary}
                 >
-                  {isDeleting ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Trash className="h-4 w-4" />}
+                  <Star className={cn("h-4 w-4", video.is_primary && "fill-current text-yellow-400")} />
                 </Button>
-              </AlertDialogTrigger>
-              <AlertDialogContent onClick={(e) => e.stopPropagation()}> 
-                <AlertDialogHeader>
-                  <AlertDialogTitle>Delete this video?</AlertDialogTitle>
-                  <AlertDialogDescription>
-                    This action cannot be undone. The video file and its metadata will be permanently removed.
-                  </AlertDialogDescription>
-                </AlertDialogHeader>
-                <AlertDialogFooter>
-                  <AlertDialogCancel onClick={(e) => e.stopPropagation()} disabled={isDeleting}>Cancel</AlertDialogCancel>
-                  <AlertDialogAction 
-                    onClick={handleDeleteConfirm}
-                    disabled={isDeleting}
-                    className="bg-destructive hover:bg-destructive/90"
+              )}
+
+              {isAdmin && (
+                <AlertDialog>
+                  <AlertDialogTrigger asChild>
+                    <Button 
+                      variant="destructive" 
+                      size="icon" 
+                      className={cn(
+                        "h-7 w-7 p-0 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm",
+                        isDeleting && "opacity-50 cursor-not-allowed"
+                      )}
+                      title="Delete video permanently"
+                      disabled={!onDeleteVideo || isDeleting}
+                      onClick={(e) => e.stopPropagation()}
+                    >
+                      {isDeleting ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Trash className="h-4 w-4" />}
+                    </Button>
+                  </AlertDialogTrigger>
+                  <AlertDialogContent onClick={(e) => e.stopPropagation()}> 
+                    <AlertDialogHeader>
+                      <AlertDialogTitle>Delete this video?</AlertDialogTitle>
+                      <AlertDialogDescription>
+                        This action cannot be undone. The video file and its metadata will be permanently removed.
+                      </AlertDialogDescription>
+                    </AlertDialogHeader>
+                    <AlertDialogFooter>
+                      <AlertDialogCancel onClick={(e) => e.stopPropagation()} disabled={isDeleting}>Cancel</AlertDialogCancel>
+                      <AlertDialogAction 
+                        onClick={handleDeleteConfirm}
+                        disabled={isDeleting}
+                        className="bg-destructive hover:bg-destructive/90"
+                      >
+                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
+                      </AlertDialogAction>
+                    </AlertDialogFooter>
+                  </AlertDialogContent>
+                </AlertDialog>
+              )}
+            </div>
+          )}
+
+          {/* Play Button overlay (only shown on hover on non-mobile) */}
+          {!isMobile && (
+            <div 
+              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none
+                ${combinedHovering ? 'opacity-0' : 'opacity-100'} 
+              `}
+            >
+              <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm shadow-md">
+                <Play className="h-6 w-6 text-white animate-pulse-opacity" />
+              </div>
+            </div>
+          )}
+
+          {/* Gradient overlay and text (Show on hover if !alwaysShowInfo OR forceCreatorHoverDesktop, but NOT on profile page) */}
+          {!isMobile && !isProfilePage && (!alwaysShowInfo || forceCreatorHoverDesktop) && (
+            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
+              <div className="absolute top-2 left-2 z-20 bg-black/30 backdrop-blur-sm rounded-md p-1.5 max-w-[70%]">
+                {video.metadata?.title && (
+                  <span className="block text-white text-xs font-medium leading-snug line-clamp-2 pointer-events-auto">
+                    {video.metadata.title}
+                  </span>
+                )}
+                {video.user_id && (
+                  <div 
+                    style={{ pointerEvents: 'auto' }} 
+                    className="mt-0.5" 
+                    onClick={(e) => e.stopPropagation()}
                   >
-                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
-                  </AlertDialogAction>
-                </AlertDialogFooter>
-              </AlertDialogContent>
-            </AlertDialog>
+                    <LoraCreatorInfo
+                      asset={{ user_id: video.user_id } as any}
+                      avatarSize="h-4 w-4"
+                      textSize="text-xs"
+                      overrideTextColor="text-white/80"
+                    />
+                  </div>
+                )}
+              </div>
+            </div>
           )}
         </div>
-      )}
+      </div>
 
-      {/* Play Button overlay (only shown on hover on non-mobile) */}
+      {/* Desktop Click Indicator - Bottom Right (Keep this outside the video preview area) */}
       {!isMobile && (
         <div 
-          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none
-            ${isHovering ? 'opacity-0' : 'opacity-100'} 
-          `}
+          className={cn(
+            "absolute bottom-2 right-2 z-20 p-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none",
+            "opacity-0 group-hover:opacity-100 transition-opacity duration-300" // Only show on hover
+          )}
+          title="Click to view details"
         >
-          <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm shadow-md">
-            <Play className="h-6 w-6 text-white animate-pulse-opacity" />
-          </div>
-        </div>
-      )}
-
-      {/* Gradient overlay and text (Show on hover if !alwaysShowInfo OR forceCreatorHoverDesktop, but NOT on profile page) */}
-      {!isMobile && !isProfilePage && (!alwaysShowInfo || forceCreatorHoverDesktop) && (
-        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-between p-2 z-10">
-          <div className="flex flex-col items-start">
-            {video.metadata?.title && (
-              <span className="text-white text-sm font-medium line-clamp-2 mr-2 pointer-events-auto">
-                {video.metadata.title}
-              </span>
-            )}
-            {video.user_id && (
-              <div 
-                style={{ pointerEvents: 'auto', position: 'relative', zIndex: 20 }} 
-                className="mt-0.5" 
-                onClick={(e) => e.stopPropagation()}
-              >
-                <LoraCreatorInfo
-                  asset={{ user_id: video.user_id } as any}
-                  avatarSize="h-4 w-4"
-                  textSize="text-xs"
-                  overrideTextColor="text-white/80"
-                />
-              </div>
-            )}
-          </div>
-          <div /> {/* Empty div to maintain flex spacing */}
+          <ArrowUpRight className="h-4 w-4 text-white/80" />
         </div>
       )}
     </div>
@@ -390,4 +502,31 @@ const VideoCard: React.FC<VideoCardProps> = ({
 
 VideoCard.displayName = 'VideoCard';
 
-export default VideoCard;
+// ---------------------------------------------------------------------------
+// Memoization to prevent whole-grid re-renders on hover
+// ---------------------------------------------------------------------------
+
+// Only re-render when props that materially affect the card change.
+const areEqual = (prev: Readonly<VideoCardProps>, next: Readonly<VideoCardProps>) => {
+  // Primitive props that can toggle frequently
+  if (prev.isHovering !== next.isHovering) return false;
+  if (prev.shouldBePlaying !== next.shouldBePlaying) return false;
+
+  // Auth / role flags
+  if (prev.isAdmin !== next.isAdmin) return false;
+  if (prev.isAuthorized !== next.isAuthorized) return false;
+
+  // Display options
+  if (prev.alwaysShowInfo !== next.alwaysShowInfo) return false;
+  if (prev.forceCreatorHoverDesktop !== next.forceCreatorHoverDesktop) return false;
+
+  // Video object reference – if the parent supplies a new object ref the
+  // card should update.  Deep compare is avoided for perf.
+  if (prev.video !== next.video) return false;
+
+  return true; // No significant changes → skip re-render
+};
+
+const MemoizedVideoCard = memo(VideoCard, areEqual);
+
+export default MemoizedVideoCard;
diff --git a/src/lib/types.ts b/src/lib/types.ts
index 2892910..6ab8837 100644
--- a/src/lib/types.ts
+++ b/src/lib/types.ts
@@ -3,6 +3,8 @@ import { UserAssetPreferenceStatus } from '@/components/lora/LoraCard';
 export interface VideoMetadata {
   title: string;
   description: string;
+  /** Optional display name of the creator (used in various UI components) */
+  creatorName?: string;
   classification: 'art' | 'gen';
   isPrimary?: boolean;
   loraName?: string;
diff --git a/src/pages/AssetDetailPage/AssetDetailPage.tsx b/src/pages/AssetDetailPage/AssetDetailPage.tsx
index a1dac45..242d9ce 100644
--- a/src/pages/AssetDetailPage/AssetDetailPage.tsx
+++ b/src/pages/AssetDetailPage/AssetDetailPage.tsx
@@ -1,4 +1,4 @@
-import React, { useState, useEffect } from 'react';
+import React, { useState, useEffect, useMemo, useCallback } from 'react';
 import { useParams, useNavigate } from 'react-router-dom';
 import Navigation, { Footer } from '@/components/Navigation';
 import { Skeleton } from '@/components/ui/skeleton';
@@ -383,6 +383,28 @@ function AssetDetailPage() {
     }
   };
   
+  // Build video list for navigation (all videos for this asset)
+  const videoList = useMemo(() => {
+    return videos ?? [];
+  }, [videos]);
+
+  const currentLightboxIndex = useMemo(() => {
+    if (!currentVideo) return -1;
+    return videoList.findIndex(v => v.id === currentVideo.id);
+  }, [currentVideo, videoList]);
+
+  const handlePrevLightboxVideo = useCallback(() => {
+    if (currentLightboxIndex > 0) {
+      setCurrentVideo(videoList[currentLightboxIndex - 1]);
+    }
+  }, [currentLightboxIndex, videoList]);
+
+  const handleNextLightboxVideo = useCallback(() => {
+    if (currentLightboxIndex !== -1 && currentLightboxIndex < videoList.length - 1) {
+      setCurrentVideo(videoList[currentLightboxIndex + 1]);
+    }
+  }, [currentLightboxIndex, videoList]);
+  
   // logger.log(`[AssetDetailPage Render] isLoading: ${isLoading}, asset exists: ${!!asset}`);
 
   if (isLoading) {
@@ -500,6 +522,10 @@ function AssetDetailPage() {
               isAuthorized={isAuthorized}
               adminStatus={currentVideo.admin_status}
               onAdminStatusChange={(newStatus) => handleSetVideoAdminStatus(currentVideo.id, newStatus)}
+              hasPrev={currentLightboxIndex > 0}
+              hasNext={currentLightboxIndex !== -1 && currentLightboxIndex < videoList.length - 1}
+              onPrevVideo={handlePrevLightboxVideo}
+              onNextVideo={handleNextLightboxVideo}
             />
           )}
           
diff --git a/src/pages/AssetDetailPage/components/AssetVideoSection.tsx b/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
index a0aa682..9ff541b 100644
--- a/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
+++ b/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
@@ -231,6 +231,7 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
             </DialogHeader>
             <UploadPage 
               initialMode="media"
+              forcedLoraId={asset?.id}
               defaultClassification={asset?.lora_type === 'Style' ? 'art' : 'gen'}
               hideLayout={true}
               onSuccess={handleUploadSuccess}
@@ -267,11 +268,7 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
                   onRejectVideo={handleRejectVideo}
                   onDeleteVideo={handleDeleteVideo}
                   onSetPrimaryMedia={handleSetPrimaryMedia}
-                  onStatusChange={onStatusChange}
-                  showAdminControls={isAuthorized}
-                  showUserControls={isAuthorized}
-                  showPrimaryButton={isAuthorized && isLoraPage}
-                  source="assetDetail"
+                  onUpdateLocalVideoStatus={onStatusChange}
                   forceCreatorHoverDesktop={false}
                   alwaysShowInfo={false}
                 />
diff --git a/src/pages/Index.tsx b/src/pages/Index.tsx
index 51abcfd..0f2198d 100644
--- a/src/pages/Index.tsx
+++ b/src/pages/Index.tsx
@@ -1,4 +1,4 @@
-import React, { useCallback, useEffect, useState, useRef } from 'react';
+import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
 import Navigation, { Footer } from '@/components/Navigation';
 import PageHeader from '@/components/PageHeader';
 import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
@@ -12,7 +12,7 @@ import { toast } from 'sonner';
 import { useVideoManagement } from '@/hooks/useVideoManagement';
 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/lib/supabase';
-import { LoraAsset, VideoEntry } from '@/lib/types';
+import { LoraAsset, VideoEntry, AdminStatus } from '@/lib/types';
 import VideoGallerySection from '@/components/video/VideoGallerySection';
 import { Separator } from '@/components/ui/separator';
 import { Button } from '@/components/ui/button';
@@ -30,6 +30,7 @@ import {
   PaginationNext,
   PaginationPrevious,
 } from "@/components/ui/pagination";
+import VideoLightbox from '@/components/VideoLightbox';
 
 const logger = new Logger('Index');
 // logger.log('Index page component module loaded');
@@ -70,6 +71,7 @@ const Index: React.FC = () => {
   const dataRefreshInProgress = useRef(false);
   const initialRefreshDone = useRef(false);
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
+  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
   
   // Pagination State
   const [artPage, setArtPage] = useState(1);
@@ -80,7 +82,7 @@ const Index: React.FC = () => {
   const generationsSectionRef = useRef<HTMLDivElement>(null);
   
   // Get video data & loading state
-  const { videos, isLoading: videosLoading } = useVideoManagement();
+  const { videos, isLoading: videosLoading, approveVideo, rejectVideo, refetchVideos } = useVideoManagement();
   // logger.log(`Index: useVideoManagement() state - videosLoading: ${videosLoading}`);
   
   // Get model filter from URL query params
@@ -449,16 +451,80 @@ const Index: React.FC = () => {
   const GENERATION_ITEMS_PER_ROW = 6;
   const ART_ITEMS_PER_ROW = 4;
 
+  // --- Lightbox Handlers ---
+  const handleOpenLightbox = useCallback((video: VideoEntry) => {
+    logger.log(`[Lightbox] Opening lightbox for video: ${video.id}`);
+    setLightboxVideo(video);
+  }, []);
+
+  const handleCloseLightbox = useCallback(() => {
+    logger.log(`[Lightbox] Closing lightbox`);
+    setLightboxVideo(null);
+  }, []);
+
+  // Compute a flattened list of currently displayed videos (art + generations) for navigation
+  const lightboxVideoList = useMemo(() => {
+    return [...displayArtVideos.items, ...displayGenVideos.items];
+  }, [displayArtVideos.items, displayGenVideos.items]);
+
+  const currentLightboxIndex = useMemo(() => {
+    if (!lightboxVideo) return -1;
+    return lightboxVideoList.findIndex(v => v.id === lightboxVideo.id);
+  }, [lightboxVideo, lightboxVideoList]);
+
+  const handlePrevLightboxVideo = useCallback(() => {
+    if (currentLightboxIndex > 0) {
+      setLightboxVideo(lightboxVideoList[currentLightboxIndex - 1]);
+    }
+  }, [currentLightboxIndex, lightboxVideoList]);
+
+  const handleNextLightboxVideo = useCallback(() => {
+    if (currentLightboxIndex !== -1 && currentLightboxIndex < lightboxVideoList.length - 1) {
+      setLightboxVideo(lightboxVideoList[currentLightboxIndex + 1]);
+    }
+  }, [currentLightboxIndex, lightboxVideoList]);
+
+  // This function now RETURNS the actual handler needed by the Lightbox
+  const getLightboxAdminStatusChangeHandler = useCallback((videoId: string) => {
+    return async (newStatus: AdminStatus) => {
+      logger.log(`[Lightbox] Admin status change requested: ${videoId} to ${newStatus}`);
+      try {
+        if (newStatus === 'Curated') {
+          await approveVideo(videoId);
+          toast.success("Video approved successfully.");
+        } else if (newStatus === 'Rejected') {
+          await rejectVideo(videoId);
+          toast.success("Video rejected successfully.");
+        } else {
+          logger.warn(`[Lightbox] Unhandled admin status change: ${newStatus} for video ${videoId}`);
+          toast.info(`Status change to ${newStatus} requested.`);
+        }
+        handleCloseLightbox();
+      } catch (error) {
+        logger.error(`[Lightbox] Error changing admin status for ${videoId} to ${newStatus}:`, error);
+        toast.error("Failed to update video status.");
+      }
+    };
+  }, [approveVideo, rejectVideo, handleCloseLightbox]);
+
+  const handleLightboxVideoUpdate = useCallback(() => {
+    logger.log(`[Lightbox] Video update occurred (internally within lightbox), refetching videos.`);
+    refetchVideos();
+  }, [refetchVideos]);
+  // --- End Lightbox Handlers ---
+
   return (
     <div className="flex flex-col min-h-screen">
       <Navigation />
       
       <div className="flex-1 w-full">
         <div className="max-w-screen-2xl mx-auto p-4">
-          <PageHeader 
-            title="Curated resources & art, with a focus on LoRAs for open video models"
-            description="A curated collection of artistically-oriented LoRAs for open source video models like Wan, LTXV and Hunyuan."
-          />
+          <div className="pt-2 pb-0 mb-8">
+            <PageHeader 
+              title="Welcome to the OpenMuse Video Gallery" 
+              description="Browse community-created art, LoRAs, and generations." 
+            />
+          </div>
           
           {/* Search Input - Commented out for now */}
           {/* 
@@ -549,11 +615,12 @@ const Index: React.FC = () => {
               videos={displayArtVideos.items}
               isLoading={videosLoading}
               seeAllPath="/art"
-              alwaysShowInfo
+              alwaysShowInfo={true}
               emptyMessage="There's no art matching the current filter."
               showAddButton={true}
               addButtonClassification="art"
               itemsPerRow={ART_ITEMS_PER_ROW}
+              onOpenLightbox={handleOpenLightbox}
             />
             {renderPaginationControls(artPage, displayArtVideos.totalPages, handleArtPageChange)}
           </div>
@@ -567,12 +634,13 @@ const Index: React.FC = () => {
               videos={displayGenVideos.items}
               isLoading={videosLoading}
               seeAllPath="/generations"
-              alwaysShowInfo
+              alwaysShowInfo={true}
               emptyMessage="There are no generations matching the current filter."
               showAddButton={true}
               addButtonClassification="gen"
               itemsPerRow={GENERATION_ITEMS_PER_ROW}
               forceCreatorHoverDesktop={true}
+              onOpenLightbox={handleOpenLightbox}
             />
             {renderPaginationControls(generationPage, displayGenVideos.totalPages, handleGenerationPageChange)}
           </div>
@@ -580,6 +648,29 @@ const Index: React.FC = () => {
       </div>
       
       <Footer />
+      {/* Render the lightbox when a video is selected */}
+      {lightboxVideo && (
+        <VideoLightbox 
+          isOpen={!!lightboxVideo} 
+          onClose={handleCloseLightbox} 
+          videoUrl={lightboxVideo.url} 
+          videoId={lightboxVideo.id}
+          title={lightboxVideo.metadata?.title}
+          description={lightboxVideo.metadata?.description}
+          thumbnailUrl={lightboxVideo.placeholder_image || lightboxVideo.metadata?.placeholder_image}
+          creatorId={lightboxVideo.user_id}
+          isAuthorized={isAdmin}
+          adminStatus={lightboxVideo.admin_status}
+          currentStatus={null}
+          onStatusChange={() => Promise.resolve()}
+          onAdminStatusChange={getLightboxAdminStatusChangeHandler(lightboxVideo.id)}
+          onVideoUpdate={handleLightboxVideoUpdate}
+          hasPrev={currentLightboxIndex > 0}
+          hasNext={currentLightboxIndex !== -1 && currentLightboxIndex < lightboxVideoList.length - 1}
+          onPrevVideo={handlePrevLightboxVideo}
+          onNextVideo={handleNextLightboxVideo}
+        />
+      )}
     </div>
   );
 };
diff --git a/src/pages/UserProfilePage.tsx b/src/pages/UserProfilePage.tsx
index 5abcdf7..bac5ba9 100644
--- a/src/pages/UserProfilePage.tsx
+++ b/src/pages/UserProfilePage.tsx
@@ -368,11 +368,25 @@ export default function UserProfilePage() {
       }
       try {
         const decodedDisplayName = decodeURIComponent(displayName);
-        const { data: profileData, error: profileError } = await supabase
+        // First attempt a fast lookup by `username` (which should be indexed and unique). This avoids the
+        // expensive `or()` scan across both `display_name` and `username` columns that was previously causing
+        // full‑table scans and noticeably slower profile load times.
+        let { data: profileData, error: profileError } = await supabase
           .from('profiles')
           .select('*')
-          .or(`display_name.eq.${decodedDisplayName},username.eq.${decodedDisplayName}`)
+          .eq('username', decodedDisplayName)
           .maybeSingle();
+
+        if (!profileData && !profileError) {
+          // Fallback: if no profile matched the username, try display_name. This secondary lookup is only
+          // executed when necessary and therefore does not impact the common happy‑path performance.
+          ({ data: profileData, error: profileError } = await supabase
+            .from('profiles')
+            .select('*')
+            .eq('display_name', decodedDisplayName)
+            .maybeSingle());
+        }
+
         if (!isMounted) return;
         if (profileError || !profileData) {
             logger.error('Error fetching profile or profile not found:', profileError);
@@ -716,6 +730,31 @@ export default function UserProfilePage() {
       </PaginationContent> </Pagination> ); 
   };
 
+  // Use the FULL lists (generationVideos, artVideos) for lightbox navigation
+  const fullVideoListForLightbox = useMemo(() => {
+    // Combine the full, unsorted, unpaginated lists
+    return [...generationVideos, ...artVideos];
+  }, [generationVideos, artVideos]); // Depend on the state variables holding the full lists
+
+  // Find the index in the FULL list
+  const currentLightboxIndex = useMemo(() => {
+    if (!lightboxVideo) return -1;
+    return fullVideoListForLightbox.findIndex(v => v.id === lightboxVideo.id);
+  }, [lightboxVideo, fullVideoListForLightbox]);
+
+  // Handlers now use the FULL list
+  const handlePrevLightboxVideo = useCallback(() => {
+    if (currentLightboxIndex > 0) {
+      setLightboxVideo(fullVideoListForLightbox[currentLightboxIndex - 1]);
+    }
+  }, [currentLightboxIndex, fullVideoListForLightbox]);
+
+  const handleNextLightboxVideo = useCallback(() => {
+    if (currentLightboxIndex !== -1 && currentLightboxIndex < fullVideoListForLightbox.length - 1) {
+      setLightboxVideo(fullVideoListForLightbox[currentLightboxIndex + 1]);
+    }
+  }, [currentLightboxIndex, fullVideoListForLightbox]);
+
   // --- JSX Rendering --- 
   return (
     <div className="w-full min-h-screen flex flex-col text-foreground">
@@ -928,7 +967,12 @@ export default function UserProfilePage() {
           creatorId={lightboxVideo.user_id}
           onVideoUpdate={() => { if (profile?.id) fetchUserVideos(profile.id, user?.id, isAdmin && !forceLoggedOutView, false); }}
           isAuthorized={canEdit} currentStatus={lightboxVideo.user_status} onStatusChange={handleLightboxUserStatusChange}
-          adminStatus={lightboxVideo.admin_status} onAdminStatusChange={handleLightboxAdminStatusChange} />
+          adminStatus={lightboxVideo.admin_status} onAdminStatusChange={handleLightboxAdminStatusChange}
+          hasPrev={currentLightboxIndex > 0}
+          hasNext={currentLightboxIndex !== -1 && currentLightboxIndex < fullVideoListForLightbox.length - 1}
+          onPrevVideo={handlePrevLightboxVideo}
+          onNextVideo={handleNextLightboxVideo}
+        />
       )}
 
       <Footer />
diff --git a/src/pages/upload/UploadPage.tsx b/src/pages/upload/UploadPage.tsx
index 7d42e6e..41b689d 100644
--- a/src/pages/upload/UploadPage.tsx
+++ b/src/pages/upload/UploadPage.tsx
@@ -189,6 +189,37 @@ const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, f
 
           const mediaId = mediaData.id;
           logger.log(`Successfully created media entry for video ${video.id}. Media ID: ${mediaId}`);
+
+          // If we are uploading to an existing LoRA asset, create the asset_media link
+          if (finalForcedLoraId) {
+            logger.log(`Linking media ${mediaId} to existing asset ${finalForcedLoraId}`);
+
+            // Insert relationship into asset_media
+            const { error: linkError } = await supabase
+              .from('asset_media')
+              .insert({ asset_id: finalForcedLoraId, media_id: mediaId });
+
+            if (linkError) {
+              logger.error(`Error linking media ${mediaId} to asset ${finalForcedLoraId}:`, linkError);
+            } else {
+              logger.log(`Successfully linked media ${mediaId} to asset ${finalForcedLoraId}`);
+            }
+
+            // Optionally set as primary media
+            const shouldSetPrimary = video.metadata.isPrimary || false;
+
+            if (shouldSetPrimary) {
+              logger.log(`Setting media ${mediaId} as primary for asset ${finalForcedLoraId}`);
+              const { error: primaryErr } = await supabase
+                .from('assets')
+                .update({ primary_media_id: mediaId })
+                .eq('id', finalForcedLoraId);
+
+              if (primaryErr) {
+                logger.error(`Error setting primary media for asset ${finalForcedLoraId}:`, primaryErr);
+              }
+            }
+          }
         }
 
         logger.log('Finished processing all videos for media entry creation.');
diff --git a/structure.md b/structure.md
index 7a9c037..e1e97d1 100644
--- a/structure.md
+++ b/structure.md
@@ -103,6 +103,7 @@ This document outlines the directory structure of the openmuse` project, providi
 │   │   │   ├── StandardVideoPreview.tsx # A standard component for video previews
 │   │   │   ├── VideoCard.tsx   # Card component for displaying video information and preview
 │   │   │   ├── VideoError.tsx  # Component to display when there's a video loading error
+│   │   │   ├── VideoGrid.tsx   # Grid layout component for displaying videos, replacing Masonry
 │   │   │   ├── VideoLoader.tsx # Loading indicator specifically for videos
 │   │   │   ├── VideoOverlay.tsx # Overlay content/controls for videos
 │   │   │   ├── VideoPaginatedGrid.tsx # Grid layout for videos with pagination
```
---
**Commit:** `aff200b`
**Author:** POM
**Date:** 2025-04-24
**Message:** feat: improve LoRA video loading behavior to match VideoCard - preload when near viewport
```diff
diff --git a/src/components/lora/LoraCard.tsx b/src/components/lora/LoraCard.tsx
index 6ec7d4e..8ae8e1b 100644
--- a/src/components/lora/LoraCard.tsx
+++ b/src/components/lora/LoraCard.tsx
@@ -24,6 +24,7 @@ import { Badge } from "@/components/ui/badge";
 import { Logger } from '@/lib/logger';
 import LoraCreatorInfo from './LoraCreatorInfo';
 import { useIsMobile } from '@/hooks/use-mobile';
+import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
 
 const logger = new Logger('LoraCard');
 
@@ -78,6 +79,12 @@ const LoraCard: React.FC<LoraCardProps> = ({
   const [isVisible, setIsVisible] = useState(false);
   const [isInPreloadArea, setIsInPreloadArea] = useState(false);
   const isMobile = useIsMobile();
+  // Detect when the card is near/inside the viewport so we can start pre-loading.
+  const cardRef = useRef<HTMLDivElement>(null);
+  const isInViewport = useIntersectionObserver(cardRef, {
+    rootMargin: '0px 0px 300px 0px',
+    threshold: 0.05,
+  });
   
   useEffect(() => {
     setCurrentStatus(userStatus);
@@ -218,6 +225,7 @@ const LoraCard: React.FC<LoraCardProps> = ({
         isOwnProfile && currentStatus === 'Hidden' && 'opacity-60 grayscale'
       )}
       onClick={handleView}
+      ref={cardRef}
     >
       <div 
         className="w-full overflow-hidden bg-muted relative"
@@ -233,7 +241,9 @@ const LoraCard: React.FC<LoraCardProps> = ({
                 url={videoUrl} 
                 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out" 
                 title={lora.name}
-                lazyLoad={true}
+                // Emulate VideoCard behavior: on profile & home pages, delay loading until
+                // either the card is hovered OR it’s close to the viewport.
+                lazyLoad={(isOnProfilePage || isOnHomePage) ? (!shouldBePlaying && !isInViewport) : false}
                 thumbnailUrl={thumbnailUrl}
                 onLoadedData={handleVideoLoad}
                 onVisibilityChange={handleVisibilityChange}
```
---
**Commit:** `1c84bb2`
**Author:** POM
**Date:** 2025-04-24
**Message:** feat: implement persistent approval filter toggle across pages - Add All/Curated toggle to pages, modify database layer for filtering, update hooks and components, enhance error handling
```diff
diff --git a/src/components/LoraManager.tsx b/src/components/LoraManager.tsx
index 896757a..a49eaca 100644
--- a/src/components/LoraManager.tsx
+++ b/src/components/LoraManager.tsx
@@ -25,6 +25,8 @@ interface LoraManagerProps {
   onNavigateToUpload?: () => void;
   onRefreshData?: () => void;
   showSeeAllLink?: boolean;
+  /** The current approval filter state from the parent */
+  approvalFilter?: 'all' | 'curated';
   onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
   isUpdatingStatusMap?: Record<string, boolean>;
 }
@@ -39,6 +41,7 @@ const LoraManager: React.FC<LoraManagerProps> = ({
   onNavigateToUpload,
   onRefreshData,
   showSeeAllLink,
+  approvalFilter = 'curated', // Default to 'curated' if not provided
   onUserStatusChange,
   isUpdatingStatusMap,
 }) => {
@@ -65,7 +68,7 @@ const LoraManager: React.FC<LoraManagerProps> = ({
             to="/loras"
             className="text-sm text-primary hover:underline ml-auto"
           >
-            See all curated LoRAs →
+            See all {approvalFilter === 'curated' ? `curated ` : ''}LoRAs →
           </Link>
         )}
       </div>
diff --git a/src/components/VideoLightbox.tsx b/src/components/VideoLightbox.tsx
index a557e54..727b872 100644
--- a/src/components/VideoLightbox.tsx
+++ b/src/components/VideoLightbox.tsx
@@ -40,6 +40,7 @@ import {
 } from '@/components/ui/tooltip';
 import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
 import LoraCreatorInfo from './lora/LoraCreatorInfo';
+import { Link } from 'react-router-dom';
 
 interface VideoLightboxProps {
   isOpen: boolean;
@@ -129,7 +130,7 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
 
   useEffect(() => {
     const fetchLoras = async () => {
-      if (isOpen && canEdit && availableLoras.length === 0 && !isFetchingLoras) {
+      if (isOpen && availableLoras.length === 0 && !isFetchingLoras) {
         setIsFetchingLoras(true);
         try {
           const { data, error } = await supabase
@@ -171,7 +172,7 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
     };
 
     fetchLoras();
-  }, [isOpen, canEdit, availableLoras.length, isFetchingLoras, toast]);
+  }, [isOpen, availableLoras.length, isFetchingLoras, toast]);
 
   const handleCancelEdit = useCallback(() => {
     setIsEditing(false);
@@ -586,6 +587,22 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
                       {initialDescription && (
                           <p className="text-sm mt-2 whitespace-pre-wrap">{initialDescription}</p>
                       )}
+                      {initialAssetId && (() => {
+                        const loraName = availableLoras.find(l => l.id === initialAssetId)?.name;
+                        if (!loraName) return null; // Don't render if name not found (yet)
+                        return (
+                          <p className="text-sm mt-3 text-muted-foreground">
+                            Made with{' '}
+                            <Link 
+                              to={`/assets/${initialAssetId}`}
+                              className="text-foreground underline"
+                              onClick={(e) => e.stopPropagation()} // Prevent closing lightbox on link click
+                            >
+                              {loraName}
+                            </Link>
+                          </p>
+                        );
+                      })()}
                     </div>
                   )}
               </div>
diff --git a/src/components/video/VideoGallerySection.tsx b/src/components/video/VideoGallerySection.tsx
index 6ad69fa..09a4967 100644
--- a/src/components/video/VideoGallerySection.tsx
+++ b/src/components/video/VideoGallerySection.tsx
@@ -27,6 +27,8 @@ interface VideoGallerySectionProps {
   itemsPerRow?: number;
   /** If true, forces creator info to only show on hover on desktop, overriding alwaysShowInfo for that element */
   forceCreatorHoverDesktop?: boolean;
+  /** The current approval filter state from the parent */
+  approvalFilter?: 'all' | 'curated';
 
   // Add props to pass down for actions and permissions
   isAdmin?: boolean;
@@ -52,10 +54,11 @@ const VideoGallerySection: React.FC<VideoGallerySectionProps> = ({
   addButtonClassification = 'gen',
   itemsPerRow = 4,
   forceCreatorHoverDesktop = false,
+  approvalFilter = 'curated', // Default to 'curated' if not provided
   // Destructure new props
-  isAdmin = false, 
+  isAdmin = false,
   isAuthorized = false,
-  onOpenLightbox, 
+  onOpenLightbox,
   onApproveVideo,
   onDeleteVideo,
   onRejectVideo,
@@ -82,7 +85,7 @@ const VideoGallerySection: React.FC<VideoGallerySectionProps> = ({
               to={seeAllPath}
               className="text-sm text-primary hover:underline ml-auto"
             >
-              See all curated {header} →
+              See all {approvalFilter === 'curated' ? `curated ` : ''}{header} →
             </Link>
           )}
         </div>
diff --git a/src/hooks/usePersistentToggle.ts b/src/hooks/usePersistentToggle.ts
new file mode 100644
index 0000000..8e03749
--- /dev/null
+++ b/src/hooks/usePersistentToggle.ts
@@ -0,0 +1,55 @@
+import { useState, useEffect, useCallback } from 'react';
+
+type ToggleValue = 'all' | 'curated';
+
+/**
+ * Custom hook to manage a persistent toggle state ('all' or 'curated') using localStorage.
+ * 
+ * @param storageKey The unique key for storing the state in localStorage.
+ * @param defaultValue The default value if nothing is found in localStorage.
+ * @returns A tuple containing the current state and a function to update the state.
+ */
+export function usePersistentToggle(
+  storageKey: string, 
+  defaultValue: ToggleValue = 'curated'
+): [ToggleValue, (newValue: ToggleValue) => void] {
+  
+  const [value, setValue] = useState<ToggleValue>(() => {
+    try {
+      const storedValue = window.localStorage.getItem(storageKey);
+      // Ensure stored value is valid, otherwise return default
+      if (storedValue === 'all' || storedValue === 'curated') {
+        return storedValue;
+      }
+    } catch (error) {
+      console.error(`Error reading localStorage key “${storageKey}”:`, error);
+    }
+    return defaultValue;
+  });
+
+  useEffect(() => {
+    try {
+      // Ensure value is valid before storing
+      if (value === 'all' || value === 'curated') {
+        window.localStorage.setItem(storageKey, value);
+      } else {
+         // Fallback to default if state somehow becomes invalid
+         window.localStorage.setItem(storageKey, defaultValue);
+         setValue(defaultValue); 
+      }
+    } catch (error) {
+      console.error(`Error setting localStorage key “${storageKey}”:`, error);
+    }
+  }, [storageKey, value, defaultValue]);
+
+  const updateValue = useCallback((newValue: ToggleValue) => {
+    // Only update if the value is valid
+    if (newValue === 'all' || newValue === 'curated') {
+      setValue(newValue);
+    } else {
+        console.warn(`Attempted to set invalid value for usePersistentToggle (${storageKey}): ${newValue}`);
+    }
+  }, [storageKey]); // Add storageKey to dependencies if needed, though it usually doesn't change
+
+  return [value, updateValue];
+} 
\ No newline at end of file
diff --git a/src/hooks/useVideoManagement.tsx b/src/hooks/useVideoManagement.tsx
index 7abc65f..270b931 100644
--- a/src/hooks/useVideoManagement.tsx
+++ b/src/hooks/useVideoManagement.tsx
@@ -1,17 +1,21 @@
-
-import { useState, useCallback, useEffect, useRef, useContext } from 'react';
+import { useState, useCallback, useEffect, useRef } from 'react';
 import { VideoEntry, AdminStatus } from '@/lib/types';
 import { databaseSwitcher } from '@/lib/databaseSwitcher';
 import { toast } from 'sonner';
 import { Logger } from '@/lib/logger';
-import { AuthContext } from '@/contexts/AuthContext';
 import { useAuth } from '@/hooks/useAuth';
 
 const logger = new Logger('useVideoManagement');
 logger.log('useVideoManagement hook initializing');
 
-export const useVideoManagement = () => {
-  logger.log('useVideoManagement executing');
+// Define options type
+interface UseVideoManagementOptions {
+  approvalFilter?: 'all' | 'curated';
+}
+
+export const useVideoManagement = (options?: UseVideoManagementOptions) => {
+  const { approvalFilter = 'all' } = options || {}; // Default to 'all' if no options or filter provided
+  logger.log(`useVideoManagement executing with options: ${JSON.stringify(options)}`);
   const [videos, setVideos] = useState<VideoEntry[]>([]);
   const [videoIsLoading, setVideoIsLoading] = useState(true);
   const isMounted = useRef(true);
@@ -22,7 +26,7 @@ export const useVideoManagement = () => {
   logger.log(`useVideoManagement: Auth state received - isLoading: ${authIsLoading}, userId: ${userId}`);
 
   const loadAllVideos = useCallback(async () => {
-    logger.log('[loadAllVideos] Attempting to load videos...');
+    logger.log(`[loadAllVideos] Attempting to load videos with filter: ${approvalFilter}...`);
     if (!isMounted.current) {
       logger.log("[loadAllVideos] Skipping: Component not mounted");
       return;
@@ -31,22 +35,23 @@ export const useVideoManagement = () => {
     logger.log('[loadAllVideos] Setting videoIsLoading = true');
     setVideoIsLoading(true);
     fetchAttempted.current = true;
-    logger.log("[loadAllVideos] Fetching videos (User ID for potential RLS: ", userId, ")");
+    logger.log(`[loadAllVideos] Fetching videos (User ID: ${userId}, Filter: ${approvalFilter})`);
 
     try {
       logger.log("[loadAllVideos] Getting database from switcher");
       const db = await databaseSwitcher.getDatabase();
-      logger.log("[loadAllVideos] Got database, fetching all entries");
-      const allEntries = await db.getAllEntries();
+      logger.log(`[loadAllVideos] Got database, fetching entries with filter: ${approvalFilter}`);
+      // Pass the approvalFilter to the database method
+      const allEntries = await db.getAllEntries(approvalFilter);
 
       if (!isMounted.current) {
         logger.log("[loadAllVideos] Component unmounted during fetch, discarding results.");
         return;
       }
 
-      logger.log("[loadAllVideos] Loaded entries count:", allEntries.length);
+      logger.log(`[loadAllVideos] Loaded entries count: ${allEntries.length} for filter: ${approvalFilter}`);
 
-      // Original transformation logic
+      // Original transformation logic (can remain the same)
       const transformedEntries = allEntries.map(entry => {
         if (entry.metadata && entry.metadata.assetId) {
           const isPrimary = entry.metadata.isPrimary === true;
@@ -66,100 +71,96 @@ export const useVideoManagement = () => {
       setVideoIsLoading(false);
 
     } catch (error) {
-      logger.error("[loadAllVideos] Error loading videos:", error);
+      logger.error(`[loadAllVideos] Error loading videos (filter: ${approvalFilter}):`, error);
       if (isMounted.current) {
         toast.error("Error loading videos. Please try again.");
         logger.log("[loadAllVideos] Setting videoIsLoading = false after error");
         setVideoIsLoading(false);
       }
     }
-  }, [userId]);
+  }, [userId, approvalFilter]); // Add approvalFilter as a dependency
 
   useEffect(() => {
-    logger.log('[Effect Mount] Running effect to trigger initial load');
+    logger.log(`[Effect Mount/Filter Change] Running effect. Filter: ${approvalFilter}`);
     isMounted.current = true;
-    fetchAttempted.current = false; // Reset fetch attempt flag on mount/effect run
+    fetchAttempted.current = false; // Reset fetch attempt flag on mount or filter change
 
-    logger.log(`[Effect Mount] Current state: fetchAttempted=${fetchAttempted.current}`);
-    // Trigger load immediately if not already attempted
-    if (!fetchAttempted.current) {
-      logger.log("[Effect Mount] Fetch not attempted, triggering video load");
-      loadAllVideos();
-    } else {
-       logger.log("[Effect Mount] Fetch already attempted, not triggering video load");
-    }
+    logger.log(`[Effect Mount/Filter Change] Current state: fetchAttempted=${fetchAttempted.current}`);
+    
+    loadAllVideos(); // Load videos whenever the hook mounts or the filter changes
 
     return () => {
       logger.log('[Effect Cleanup] Setting isMounted = false');
       isMounted.current = false;
       logger.log("useVideoManagement cleanup complete");
     };
-  }, [loadAllVideos]);
+  }, [loadAllVideos, approvalFilter]); // Add approvalFilter to dependency array
 
   const refetchVideos = useCallback(async () => {
-    logger.log('[refetchVideos] Attempting refetch...');
+    logger.log(`[refetchVideos] Attempting refetch with filter: ${approvalFilter}...`);
     if (isMounted.current && !authIsLoading) {
-      logger.log("[refetchVideos] Conditions met (mounted, auth not loading), calling loadAllVideos");
-      fetchAttempted.current = false; // Reset fetch attempt flag before refetching
+      logger.log(`[refetchVideos] Conditions met (mounted, auth not loading), calling loadAllVideos with filter: ${approvalFilter}`);
+      fetchAttempted.current = false; // Reset flag
       await loadAllVideos();
       toast.success("Videos refreshed");
     } else {
       logger.log(`[refetchVideos] Skipping refetch: isMounted=${isMounted.current}, authIsLoading=${authIsLoading}`);
     }
-  }, [loadAllVideos, authIsLoading]);
+  }, [loadAllVideos, authIsLoading, approvalFilter]); // Add approvalFilter dependency
 
-  // --- CRUD operations (logging added) ---
+  // --- CRUD operations (remain largely the same, but state updates trigger re-renders with potentially filtered data) ---
   const deleteVideo = useCallback(async (id: string) => {
+    // ... (implementation is the same, but relies on loadAllVideos/refetch potentially filtering)
     logger.log(`[deleteVideo] Attempting to delete video ID: ${id}`);
     try {
       const db = await databaseSwitcher.getDatabase();
       await db.deleteEntry(id);
-      logger.log(`[deleteVideo] Successfully deleted, updating state for ID: ${id}`);
-      setVideos(prev => prev.filter(video => video.id !== id));
+      logger.log(`[deleteVideo] Successfully deleted ID: ${id}. Refetching videos.`);
+      await refetchVideos(); // Refetch to update the list based on the current filter
+      toast.success("Video deleted successfully.");
       return true;
     } catch (error) {
       logger.error(`[deleteVideo] Error deleting video ID ${id}:`, error);
+      toast.error("Failed to delete video.");
       throw error;
     }
-  }, []);
+  }, [refetchVideos]);
 
   const approveVideo = useCallback(async (id: string) => {
+    // ... (implementation is the same, but relies on loadAllVideos/refetch potentially filtering)
     logger.log(`[approveVideo] Attempting to approve video ID: ${id}`);
     try {
       const db = await databaseSwitcher.getDatabase();
       const updatedVideo = await db.setApprovalStatus(id, "Curated");
-      if (updatedVideo) {
-        logger.log(`[approveVideo] Successfully approved, updating state for ID: ${id}`);
-        setVideos(prev => prev.map(video =>
-          video.id === id ? { ...video, admin_status: "Curated" as AdminStatus } : video
-        ));
-      }
-      return updatedVideo;
+      logger.log(`[approveVideo] Successfully approved ID: ${id}. Refetching videos.`);
+      await refetchVideos(); // Refetch to update the list based on the current filter
+      toast.success("Video approved successfully.");
+      return updatedVideo; // Return the single updated video from DB if needed
     } catch (error) {
       logger.error(`[approveVideo] Error approving video ID ${id}:`, error);
+      toast.error("Failed to approve video.");
       throw error;
     }
-  }, []);
+  }, [refetchVideos]);
 
   const rejectVideo = useCallback(async (id: string) => {
+    // ... (implementation is the same, but relies on loadAllVideos/refetch potentially filtering)
     logger.log(`[rejectVideo] Attempting to reject video ID: ${id}`);
     try {
       const db = await databaseSwitcher.getDatabase();
       const updatedVideo = await db.setApprovalStatus(id, "Rejected");
-      if (updatedVideo) {
-         logger.log(`[rejectVideo] Successfully rejected, updating state for ID: ${id}`);
-        setVideos(prev => prev.map(video =>
-          video.id === id ? { ...video, admin_status: "Rejected" as AdminStatus } : video
-        ));
-      }
-      return updatedVideo;
+      logger.log(`[rejectVideo] Successfully rejected ID: ${id}. Refetching videos.`);
+      await refetchVideos(); // Refetch to update the list based on the current filter
+      toast.success("Video rejected successfully.");
+      return updatedVideo; // Return the single updated video from DB if needed
     } catch (error) {
       logger.error(`[rejectVideo] Error rejecting video ID ${id}:`, error);
+      toast.error("Failed to reject video.");
       throw error;
     }
-  }, []);
+  }, [refetchVideos]);
 
-  logger.log(`useVideoManagement: Returning state - isLoading: ${videoIsLoading}, videos count: ${videos.length}`);
+  logger.log(`useVideoManagement: Returning state - isLoading: ${videoIsLoading}, videos count: ${videos.length}, filter: ${approvalFilter}`);
 
   return {
     videos,
diff --git a/src/lib/database/BaseDatabase.ts b/src/lib/database/BaseDatabase.ts
index 81a02cf..7f242b2 100644
--- a/src/lib/database/BaseDatabase.ts
+++ b/src/lib/database/BaseDatabase.ts
@@ -18,7 +18,7 @@ export abstract class BaseDatabase {
   }
   
   // Core methods that all database implementations must provide
-  abstract getAllEntries(): Promise<VideoEntry[]>;
+  abstract getAllEntries(approvalFilter?: 'all' | 'curated'): Promise<VideoEntry[]>;
   abstract updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null>;
   abstract markAsSkipped(id: string): Promise<VideoEntry | null>;
   abstract setApprovalStatus(id: string, approved: string): Promise<VideoEntry | null>;
diff --git a/src/lib/database/SupabaseDatabase.ts b/src/lib/database/SupabaseDatabase.ts
index d55b5a8..3bb002c 100644
--- a/src/lib/database/SupabaseDatabase.ts
+++ b/src/lib/database/SupabaseDatabase.ts
@@ -15,71 +15,67 @@ export class SupabaseDatabase extends BaseDatabase {
     super('SupabaseDB');
   }
   
-  async getAllEntries(): Promise<VideoEntry[]> {
-    try {
-      this.logger.log("Getting all entries from media table");
-      
-      const { data: mediaData, error: mediaError } = await supabase
-        .from('media')
-        .select('*, assets(id, name, description, type, creator)')
-        .eq('type', 'video')
-        .order('created_at', { ascending: false });
-      
-      if (mediaError) {
-        this.logger.error('Error getting media entries:', mediaError);
-        return [];
-      }
-      
-      this.logger.log(`Retrieved ${mediaData?.length || 0} media entries`);
-      
-      const entries: VideoEntry[] = mediaData.map(media => {
-        const asset = media.assets && media.assets.length > 0 ? media.assets[0] : null;
-        
-        return {
-          id: media.id,
-          url: media.url,
-          reviewer_name: media.creator || 'Unknown',
-          skipped: false,
-          created_at: media.created_at,
-          admin_status: media.admin_status || 'Listed',
-          user_status: media.user_status || null,
-          user_id: media.user_id,
-          metadata: {
-            title: media.title,
-            description: media.description || '',
-            creator: 'self',
-            creatorName: media.creator || 'Unknown',
-            classification: media.classification || 'art',
-            loraName: asset?.name,
-            loraDescription: asset?.description,
-            assetId: asset?.id,
-            isPrimary: false,
-            placeholder_image: media.placeholder_image,
-            aspectRatio: (media.metadata as any)?.aspectRatio ?? null
-          }
-        };
-      });
+  async getAllEntries(approvalFilter: 'all' | 'curated' = 'all'): Promise<VideoEntry[]> {
+    this.logger.log(`[getAllEntries] Fetching videos with filter: ${approvalFilter}`);
+    let query = supabase.from('media').select('*, assets(id, name, description, type, creator)');
 
-      const { data: assetMediaData, error: assetMediaError } = await supabase
-        .from('assets')
-        .select('id, primary_media_id');
+    if (approvalFilter === 'curated') {
+      this.logger.log('[getAllEntries] Applying curated filter: admin_status in (Curated, Featured)');
+      query = query.eq('admin_status', 'Curated');
+    }
+
+    const { data, error } = await query.eq('type', 'video').order('created_at', { ascending: false });
+
+    if (error) {
+      this.logger.error('[getAllEntries] Error fetching video entries:', error);
+      throw new Error(`Error fetching video entries: ${error.message}`);
+    }
+    this.logger.log(`[getAllEntries] Fetched ${data?.length ?? 0} entries.`);
+    
+    const entries: VideoEntry[] = data.map(media => {
+      const asset = media.assets && media.assets.length > 0 ? media.assets[0] : null;
       
-      if (!assetMediaError && assetMediaData) {
-        for (const entry of entries) {
-          if (entry.metadata?.assetId) {
-            const asset = assetMediaData.find(a => a.id === entry.metadata?.assetId);
-            if (asset && asset.primary_media_id === entry.id) {
-              entry.metadata.isPrimary = true;
-            }
+      return {
+        id: media.id,
+        url: media.url,
+        reviewer_name: media.creator || 'Unknown',
+        skipped: false,
+        created_at: media.created_at,
+        admin_status: media.admin_status || 'Listed',
+        user_status: media.user_status || null,
+        user_id: media.user_id,
+        metadata: {
+          title: media.title,
+          description: media.description || '',
+          creator: 'self',
+          creatorName: media.creator || 'Unknown',
+          classification: media.classification || 'art',
+          loraName: asset?.name,
+          loraDescription: asset?.description,
+          assetId: asset?.id,
+          isPrimary: false,
+          placeholder_image: media.placeholder_image,
+          aspectRatio: (media.metadata as any)?.aspectRatio ?? null
+        }
+      };
+    });
+
+    const { data: assetMediaData, error: assetMediaError } = await supabase
+      .from('assets')
+      .select('id, primary_media_id');
+    
+    if (!assetMediaError && assetMediaData) {
+      for (const entry of entries) {
+        if (entry.metadata?.assetId) {
+          const asset = assetMediaData.find(a => a.id === entry.metadata?.assetId);
+          if (asset && asset.primary_media_id === entry.id) {
+            entry.metadata.isPrimary = true;
           }
         }
       }
-      
-      return entries;
-    } catch (error) {
-      this.logger.error('Error getting entries:', error);
-      return [];
     }
+    
+    return entries;
   }
   
   async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
diff --git a/src/lib/database/index.ts b/src/lib/database/index.ts
index 2dfa6f7..5ef1ed9 100644
--- a/src/lib/database/index.ts
+++ b/src/lib/database/index.ts
@@ -7,11 +7,13 @@ import { VideoEntry } from '../types';
  */
 export class VideoDatabase {
   /**
-   * Get all video entries
+   * Get all video entries, optionally filtering by approval status.
+   * @param approvalFilter Optional filter ('all' or 'curated')
+   * @returns A promise that resolves to an array of VideoEntry objects.
    */
-  async getAllEntries(): Promise<VideoEntry[]> {
+  async getAllEntries(approvalFilter?: 'all' | 'curated'): Promise<VideoEntry[]> {
     const db = await databaseProvider.getDatabase();
-    return db.getAllEntries();
+    return db.getAllEntries(approvalFilter);
   }
   
   /**
diff --git a/src/pages/ArtPage.tsx b/src/pages/ArtPage.tsx
index 3f19b3f..4d22139 100644
--- a/src/pages/ArtPage.tsx
+++ b/src/pages/ArtPage.tsx
@@ -1,49 +1,183 @@
-import React, { useMemo } from 'react';
+import React, { useMemo, useState, useCallback } from 'react';
 import Navigation, { Footer } from '@/components/Navigation';
 import PageHeader from '@/components/PageHeader';
 import { useVideoManagement } from '@/hooks/useVideoManagement';
 import VideoGallerySection from '@/components/video/VideoGallerySection';
 import { Helmet } from 'react-helmet-async';
 import { Logger } from '@/lib/logger';
+import { usePersistentToggle } from '@/hooks/usePersistentToggle';
+import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
+import { Separator } from '@/components/ui/separator';
+import { VideoEntry, AdminStatus } from '@/lib/types';
+import VideoLightbox from '@/components/VideoLightbox';
+import { useAuth } from '@/hooks/useAuth';
+import { toast } from 'sonner';
 
 const logger = new Logger('ArtPage');
 
 const ArtPage: React.FC = () => {
   logger.log('ArtPage component rendering');
-  const { videos, isLoading: videosLoading } = useVideoManagement();
 
-  // Filter for Featured/Curated Art videos
+  const { user, isLoading: authLoading, isAdmin } = useAuth();
+
+  const [approvalFilter, setApprovalFilter] = usePersistentToggle(
+    'artPageApprovalFilter', 
+    'curated'
+  );
+
+  const { 
+    videos, 
+    isLoading: videosLoading, 
+    refetchVideos, 
+    approveVideo, 
+    rejectVideo 
+  } = useVideoManagement({ approvalFilter });
+
   const artVideos = useMemo(() => 
-    videos
-      .filter(v => ['Curated', 'Featured'].includes(v.admin_status))
-      .filter(v => v.metadata?.classification === 'art'),
+    videos.filter(v => v.metadata?.classification === 'art'),
     [videos]
   );
 
+  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
+  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
+
+  const handleOpenLightbox = useCallback((video: VideoEntry) => {
+    const index = artVideos.findIndex(v => v.id === video.id);
+    setLightboxVideo(video);
+    setLightboxIndex(index);
+  }, [artVideos]);
+
+  const handleCloseLightbox = useCallback(() => {
+    setLightboxVideo(null);
+    setLightboxIndex(-1);
+  }, []);
+
+  const handlePrevLightbox = useCallback(() => {
+    if (lightboxIndex > 0) {
+      const prevIndex = lightboxIndex - 1;
+      setLightboxVideo(artVideos[prevIndex]);
+      setLightboxIndex(prevIndex);
+    }
+  }, [lightboxIndex, artVideos]);
+
+  const handleNextLightbox = useCallback(() => {
+    if (lightboxIndex !== -1 && lightboxIndex < artVideos.length - 1) {
+      const nextIndex = lightboxIndex + 1;
+      setLightboxVideo(artVideos[nextIndex]);
+      setLightboxIndex(nextIndex);
+    }
+  }, [lightboxIndex, artVideos]);
+
+  const handleAdminStatusChange = useCallback(async (newStatus: AdminStatus) => {
+    if (!lightboxVideo) return;
+    const videoId = lightboxVideo.id;
+    logger.log(`[Lightbox Admin] Status change requested: ${videoId} to ${newStatus}`);
+    try {
+      if (newStatus === 'Curated') {
+        await approveVideo(videoId);
+        toast.success("Video approved successfully.");
+      } else if (newStatus === 'Rejected') {
+        await rejectVideo(videoId);
+        toast.success("Video rejected successfully.");
+      } else {
+        logger.warn(`[Lightbox Admin] Unhandled status change: ${newStatus} for video ${videoId}`);
+        toast.info(`Status change to ${newStatus} requested.`);
+      }
+      handleCloseLightbox();
+    } catch (error) {
+      logger.error(`[Lightbox Admin] Error changing status for ${videoId} to ${newStatus}:`, error);
+      toast.error("Failed to update video status.");
+    }
+  }, [lightboxVideo, approveVideo, rejectVideo, handleCloseLightbox]);
+
+  const handleLightboxVideoUpdate = useCallback(() => {
+    logger.log('[Lightbox Update] Triggering video refetch due to internal lightbox update.');
+    refetchVideos(); 
+  }, [refetchVideos]);
+
+  const pageTitle = approvalFilter === 'all' ? 'All Art' : 'Curated Art';
+  const pageDescription = approvalFilter === 'all' 
+    ? 'Browse the full collection of art videos, including community uploads.'
+    : 'Browse the curated collection of high-quality art videos.';
+
   return (
     <div className="flex flex-col min-h-screen">
        <Helmet>
-        <title>All Featured Art | OpenMuse</title>
-        <meta name="description" content="Browse all featured and curated art videos on OpenMuse." />
+        <title>{pageTitle} | OpenMuse</title>
+        <meta name="description" content={pageDescription} />
       </Helmet>
       <Navigation />
       <div className="flex-1 w-full">
         <div className="max-w-screen-2xl mx-auto p-4">
           <PageHeader 
-            title="All Featured Art"
-            description="Browse the full collection of featured and curated art videos."
+            title={pageTitle}
+            description={pageDescription}
           />
+
+          <div className="flex justify-start mt-4 mb-6">
+            <ToggleGroup 
+              type="single" 
+              value={approvalFilter} 
+              onValueChange={(value) => {
+                if (value === 'curated' || value === 'all') {
+                   setApprovalFilter(value);
+                }
+              }}
+              className="bg-muted/50 p-1 rounded-lg"
+            >
+              <ToggleGroupItem value="curated" aria-label="Toggle curated" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
+                Curated
+              </ToggleGroupItem>
+              <ToggleGroupItem value="all" aria-label="Toggle all" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
+                All
+              </ToggleGroupItem>
+            </ToggleGroup>
+          </div>
+
+          <Separator className="mb-8" />
           
           <VideoGallerySection
-            header="" // Use a different header for the page itself
+            header="Art"
             videos={artVideos}
             isLoading={videosLoading}
-            seeAllPath={undefined} // No "See all" link on the all page
-            emptyMessage="There's no curated art yet :("
+            seeAllPath={undefined}
+            emptyMessage={approvalFilter === 'curated' ? "There is no curated art yet." : "There is no art yet."}
+            approvalFilter={approvalFilter}
+            onOpenLightbox={handleOpenLightbox}
+            itemsPerRow={4}
+            alwaysShowInfo={true}
+            showAddButton={true}
+            addButtonClassification="art"
+            isAdmin={isAdmin}
           />
         </div>
       </div>
       <Footer />
+
+      {lightboxVideo && (
+        <VideoLightbox
+          isOpen={!!lightboxVideo}
+          onClose={handleCloseLightbox}
+          videoId={lightboxVideo.id}
+          videoUrl={lightboxVideo.url}
+          title={lightboxVideo.metadata?.title}
+          description={lightboxVideo.metadata?.description}
+          initialAssetId={lightboxVideo.metadata?.assetId}
+          creator={lightboxVideo.metadata?.creatorName}
+          creatorId={lightboxVideo.user_id}
+          thumbnailUrl={lightboxVideo.metadata?.placeholder_image}
+          adminStatus={lightboxVideo.admin_status}
+          
+          hasPrev={lightboxIndex > 0}
+          onPrevVideo={handlePrevLightbox}
+          hasNext={lightboxIndex !== -1 && lightboxIndex < artVideos.length - 1}
+          onNextVideo={handleNextLightbox}
+          
+          onAdminStatusChange={handleAdminStatusChange}
+          onVideoUpdate={handleLightboxVideoUpdate}
+          isAuthorized={!!user}
+        />
+      )}
     </div>
   );
 };
diff --git a/src/pages/GenerationsPage.tsx b/src/pages/GenerationsPage.tsx
index eaf5e7d..3c3960c 100644
--- a/src/pages/GenerationsPage.tsx
+++ b/src/pages/GenerationsPage.tsx
@@ -1,49 +1,189 @@
-import React, { useMemo } from 'react';
+import React, { useMemo, useState, useCallback } from 'react';
 import Navigation, { Footer } from '@/components/Navigation';
 import PageHeader from '@/components/PageHeader';
 import { useVideoManagement } from '@/hooks/useVideoManagement';
 import VideoGallerySection from '@/components/video/VideoGallerySection';
 import { Helmet } from 'react-helmet-async';
 import { Logger } from '@/lib/logger';
+import { usePersistentToggle } from '@/hooks/usePersistentToggle';
+import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
+import { Separator } from '@/components/ui/separator';
+import { VideoEntry, AdminStatus } from '@/lib/types';
+import VideoLightbox from '@/components/VideoLightbox';
+import { useAuth } from '@/hooks/useAuth';
+import { toast } from 'sonner';
 
 const logger = new Logger('GenerationsPage');
 
 const GenerationsPage: React.FC = () => {
   logger.log('GenerationsPage component rendering');
-  const { videos, isLoading: videosLoading } = useVideoManagement();
 
-  // Filter for Featured/Curated Generation videos
+  const { user, isLoading: authLoading, isAdmin } = useAuth();
+
+  const [approvalFilter, setApprovalFilter] = usePersistentToggle(
+    'generationsPageApprovalFilter', 
+    'curated'
+  );
+
+  const { 
+    videos, 
+    isLoading: videosLoading, 
+    refetchVideos, 
+    approveVideo, 
+    rejectVideo 
+  } = useVideoManagement({ approvalFilter });
+
   const generationVideos = useMemo(() => 
-    videos
-      .filter(v => ['Curated', 'Featured'].includes(v.admin_status))
-      .filter(v => v.metadata?.classification !== 'art'), // Assuming anything not 'art' is 'gen'
+    videos.filter(v => v.metadata?.classification !== 'art'),
     [videos]
   );
 
+  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
+  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
+
+  const handleOpenLightbox = useCallback((video: VideoEntry) => {
+    const index = generationVideos.findIndex(v => v.id === video.id);
+    setLightboxVideo(video);
+    setLightboxIndex(index);
+  }, [generationVideos]);
+
+  const handleCloseLightbox = useCallback(() => {
+    setLightboxVideo(null);
+    setLightboxIndex(-1);
+  }, []);
+
+  const handlePrevLightbox = useCallback(() => {
+    if (lightboxIndex > 0) {
+      const prevIndex = lightboxIndex - 1;
+      setLightboxVideo(generationVideos[prevIndex]);
+      setLightboxIndex(prevIndex);
+    }
+  }, [lightboxIndex, generationVideos]);
+
+  const handleNextLightbox = useCallback(() => {
+    if (lightboxIndex !== -1 && lightboxIndex < generationVideos.length - 1) {
+      const nextIndex = lightboxIndex + 1;
+      setLightboxVideo(generationVideos[nextIndex]);
+      setLightboxIndex(nextIndex);
+    }
+  }, [lightboxIndex, generationVideos]);
+
+  const handleAdminStatusChange = useCallback(async (newStatus: AdminStatus) => {
+    if (!lightboxVideo) return;
+    const videoId = lightboxVideo.id;
+    logger.log(`[Lightbox Admin] Status change requested: ${videoId} to ${newStatus}`);
+    try {
+      if (newStatus === 'Curated') {
+        await approveVideo(videoId);
+        toast.success("Video approved successfully.");
+      } else if (newStatus === 'Rejected') {
+        await rejectVideo(videoId);
+        toast.success("Video rejected successfully.");
+      } else {
+        logger.warn(`[Lightbox Admin] Unhandled status change: ${newStatus} for video ${videoId}`);
+        toast.info(`Status change to ${newStatus} requested.`);
+      }
+      handleCloseLightbox();
+    } catch (error) {
+      logger.error(`[Lightbox Admin] Error changing status for ${videoId} to ${newStatus}:`, error);
+      toast.error("Failed to update video status.");
+    }
+  }, [lightboxVideo, approveVideo, rejectVideo, handleCloseLightbox]);
+
+  const handleLightboxVideoUpdate = useCallback(() => {
+    logger.log('[Lightbox Update] Triggering video refetch due to internal lightbox update.');
+    refetchVideos();
+  }, [refetchVideos]);
+
+  const pageTitle = approvalFilter === 'all' ? 'All Generations' : 'Curated Generations';
+  const pageDescription = approvalFilter === 'all' 
+    ? 'Browse the full collection of generation videos, including community uploads.'
+    : 'Browse the curated collection of high-quality generation videos.';
+
   return (
     <div className="flex flex-col min-h-screen">
       <Helmet>
-        <title>All Featured Generations | OpenMuse</title>
-        <meta name="description" content="Browse all featured and curated generation videos on OpenMuse." />
+        <title>{pageTitle} | OpenMuse</title>
+        <meta name="description" content={pageDescription} />
       </Helmet>
       <Navigation />
       <div className="flex-1 w-full">
         <div className="max-w-screen-2xl mx-auto p-4">
           <PageHeader 
-            title="All Featured Generations"
-            description="Browse the full collection of featured and curated generation videos."
+            title={pageTitle}
+            description={pageDescription}
           />
+
+          <div className="flex justify-start mt-4 mb-6">
+            <ToggleGroup 
+              type="single" 
+              value={approvalFilter} 
+              onValueChange={(value) => {
+                if (value === 'curated' || value === 'all') {
+                   setApprovalFilter(value);
+                }
+              }}
+              className="bg-muted/50 p-1 rounded-lg"
+            >
+              <ToggleGroupItem value="curated" aria-label="Toggle curated" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
+                Curated
+              </ToggleGroupItem>
+              <ToggleGroupItem value="all" aria-label="Toggle all" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
+                All
+              </ToggleGroupItem>
+            </ToggleGroup>
+          </div>
+
+          <Separator className="mb-8" />
           
           <VideoGallerySection
-            header=""
+            header="Generations"
             videos={generationVideos}
             isLoading={videosLoading}
-            seeAllPath={undefined} // No "See all" link on the all page
-            emptyMessage="There are are no curated generations yet"
+            seeAllPath={undefined}
+            emptyMessage={approvalFilter === 'curated' ? "There are no curated generations yet." : "There are no generations yet."}
+            approvalFilter={approvalFilter}
+            onOpenLightbox={handleOpenLightbox}
+            itemsPerRow={6}
+            forceCreatorHoverDesktop={true}
+            showAddButton={true}
+            addButtonClassification="gen"
+            isAdmin={isAdmin}
           />
         </div>
       </div>
       <Footer />
+
+      {/* Render Lightbox if a video is selected */}
+      {lightboxVideo && (
+        <VideoLightbox
+          isOpen={!!lightboxVideo} // Control lightbox visibility
+          onClose={handleCloseLightbox}
+          videoId={lightboxVideo.id}
+          videoUrl={lightboxVideo.url}
+          title={lightboxVideo.metadata?.title}
+          description={lightboxVideo.metadata?.description}
+          initialAssetId={lightboxVideo.metadata?.assetId}
+          creator={lightboxVideo.metadata?.creatorName}
+          creatorId={lightboxVideo.user_id}
+          thumbnailUrl={lightboxVideo.metadata?.placeholder_image}
+          adminStatus={lightboxVideo.admin_status}
+          
+          // Navigation Props
+          hasPrev={lightboxIndex > 0}
+          onPrevVideo={handlePrevLightbox}
+          hasNext={lightboxIndex !== -1 && lightboxIndex < generationVideos.length - 1}
+          onNextVideo={handleNextLightbox}
+          
+          // Action Props
+          onAdminStatusChange={handleAdminStatusChange}
+          onVideoUpdate={handleLightboxVideoUpdate}
+          isAuthorized={!!user}
+          // Pass currentStatus and onStatusChange if user-specific status exists
+          // currentStatus={...}
+          // onStatusChange={...}
+        />
+      )}
     </div>
   );
 };
diff --git a/src/pages/Index.tsx b/src/pages/Index.tsx
index 3d6f789..5d223e6 100644
--- a/src/pages/Index.tsx
+++ b/src/pages/Index.tsx
@@ -575,11 +575,12 @@ const Index: React.FC = () => {
             isLoading={isPageLoading}
             lorasAreLoading={lorasLoading}
             filterText={filterText}
-            onFilterTextChange={setFilterText} 
+            onFilterTextChange={setFilterText}
             isAdmin={isAdmin || false}
             onNavigateToUpload={handleNavigateToUpload}
             onRefreshData={handleRefreshData}
             showSeeAllLink={true}
+            approvalFilter={currentApprovalFilter}
           />
 
           {/* Add LoRA Button and Dialog */}
@@ -621,6 +622,7 @@ const Index: React.FC = () => {
               addButtonClassification="art"
               itemsPerRow={ART_ITEMS_PER_ROW}
               onOpenLightbox={handleOpenLightbox}
+              approvalFilter={currentApprovalFilter}
             />
             {renderPaginationControls(artPage, displayArtVideos.totalPages, handleArtPageChange)}
           </div>
@@ -641,6 +643,7 @@ const Index: React.FC = () => {
               itemsPerRow={GENERATION_ITEMS_PER_ROW}
               forceCreatorHoverDesktop={true}
               onOpenLightbox={handleOpenLightbox}
+              approvalFilter={currentApprovalFilter}
             />
             {renderPaginationControls(generationPage, displayGenVideos.totalPages, handleGenerationPageChange)}
           </div>
diff --git a/src/pages/LorasPage.tsx b/src/pages/LorasPage.tsx
index c94a74f..85918d0 100644
--- a/src/pages/LorasPage.tsx
+++ b/src/pages/LorasPage.tsx
@@ -6,6 +6,9 @@ import LoraManager from '@/components/LoraManager';
 import { useAuth } from '@/hooks/useAuth';
 import { Helmet } from 'react-helmet-async';
 import { Logger } from '@/lib/logger';
+import { usePersistentToggle } from '@/hooks/usePersistentToggle';
+import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
+import { Separator } from '@/components/ui/separator';
 
 const logger = new Logger('LorasPage');
 
@@ -13,39 +16,66 @@ const LorasPage: React.FC = () => {
   logger.log('LorasPage component rendering');
   const { user, isLoading: authLoading, isAdmin } = useAuth();
 
-  // Fetch all LoRAs with 'Featured' or 'Curated' status (same as index page)
+  const [approvalFilter, setApprovalFilter] = usePersistentToggle(
+    'lorasPageApprovalFilter', 
+    'curated'
+  );
+
   const { 
     loras, 
     isLoading: lorasLoading, 
-  } = useLoraManagement({ modelFilter: 'all', approvalFilter: 'all' });
+  } = useLoraManagement({ modelFilter: 'all', approvalFilter: approvalFilter });
 
   const isPageLoading = lorasLoading || authLoading;
 
+  const pageTitle = approvalFilter === 'all' ? 'All LoRAs' : 'Curated LoRAs';
+  const pageDescription = approvalFilter === 'all' 
+    ? 'Browse the full collection of LoRAs, including community uploads.'
+    : 'Browse the curated collection of high-quality LoRAs.';
+
   return (
     <div className="flex flex-col min-h-screen">
       <Helmet>
-        <title>All Featured LoRAs | OpenMuse</title>
-        <meta name="description" content="Browse all featured and curated LoRA assets for open source video models on OpenMuse." />
+        <title>{pageTitle} | OpenMuse</title>
+        <meta name="description" content={pageDescription} />
       </Helmet>
       <Navigation />
       <div className="flex-1 w-full">
         <div className="max-w-screen-2xl mx-auto p-4">
           <PageHeader 
-            title="All Featured LoRAs"
-            description="Browse the full collection of featured and curated LoRAs."
+            title={pageTitle}
+            description={pageDescription}
           />
+
+          <div className="flex justify-start mt-4 mb-6">
+            <ToggleGroup 
+              type="single" 
+              value={approvalFilter} 
+              onValueChange={(value) => {
+                if (value === 'curated' || value === 'all') {
+                   setApprovalFilter(value);
+                }
+              }}
+              className="bg-muted/50 p-1 rounded-lg"
+            >
+              <ToggleGroupItem value="curated" aria-label="Toggle curated" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
+                Curated
+              </ToggleGroupItem>
+              <ToggleGroupItem value="all" aria-label="Toggle all" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
+                All
+              </ToggleGroupItem>
+            </ToggleGroup>
+          </div>
+
+          <Separator className="mb-8" />
           
           <LoraManager
-            loras={loras} // Pass the fetched LoRAs directly
+            loras={loras}
             isLoading={isPageLoading}
-            lorasAreLoading={lorasLoading} // Use dedicated loading state
-            filterText="" // No initial text filter
-            onFilterTextChange={() => {}} // Placeholder, could add filtering later
-            modelFilter="all" // Show all models
-            onModelFilterChange={() => {}} // Placeholder
+            lorasAreLoading={lorasLoading}
+            approvalFilter={approvalFilter}
             isAdmin={isAdmin || false}
-            // No need for upload button or refresh here, simpler view
-            showSeeAllLink={false} // Don't show the link on the 'all' page
+            showSeeAllLink={false}
           />
         </div>
       </div>
```
---
**Commit:** `74fec46`
**Author:** POM
**Date:** 2025-04-24
**Message:** feat: improve video display and layout handling - refactor AssetVideoSection, enhance aspect ratio, add mobile scroll behavior
```diff
diff --git a/src/components/video/VideoCard.tsx b/src/components/video/VideoCard.tsx
index 04f0315..79f1e6a 100644
--- a/src/components/video/VideoCard.tsx
+++ b/src/components/video/VideoCard.tsx
@@ -72,10 +72,26 @@ const VideoCard: React.FC<VideoCardProps> = ({
   const isMobile = useIsMobile();
   const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
   const cardRef = useRef<HTMLDivElement>(null);
-  // Initialize aspect ratio from metadata to prevent layout shift
-  const [aspectRatio, setAspectRatio] = useState<number | null>(
-    video.metadata?.aspectRatio ?? null
-  );
+  // ---------------------------------------------------------------
+  // Use the dimensions calculated by the VideoGrid (displayW / displayH)
+  // to seed the local aspect-ratio state so that the placeholder box
+  // exactly matches the slot reserved by the grid on the very first
+  // paint.  This eliminates the brief "misshaped" flash that was visible
+  // before the video metadata loaded.
+  // ---------------------------------------------------------------
+  const [aspectRatio, setAspectRatio] = useState<number | null>(() => {
+    // Prefer explicit displayW/H passed down from VideoGrid, if present
+    // (DisplayVideoEntry extends VideoEntry so these can exist).
+    const displayW = (video as any).displayW as number | undefined;
+    const displayH = (video as any).displayH as number | undefined;
+
+    if (displayW && displayH) {
+      return displayW / displayH;
+    }
+
+    // Fall back to any aspectRatio provided at the top-level or in metadata.
+    return (video as any).aspectRatio ?? video.metadata?.aspectRatio ?? null;
+  });
   const [isDeleting, setIsDeleting] = useState(false);
   const [isStatusUpdating, setIsStatusUpdating] = useState(false);
   const [isVisible, setIsVisible] = useState(false);
diff --git a/src/pages/AssetDetailPage/components/AssetVideoSection.tsx b/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
index 3836983..bc0b447 100644
--- a/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
+++ b/src/pages/AssetDetailPage/components/AssetVideoSection.tsx
@@ -1,8 +1,7 @@
 import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
 import { VideoEntry, LoraAsset, VideoDisplayStatus } from '@/lib/types';
-import EmptyState from '@/components/EmptyState';
 import { cn } from '@/lib/utils';
-import VideoCard from '@/components/video/VideoCard';
+import VideoGallerySection from '@/components/video/VideoGallerySection';
 import { useAuth } from '@/hooks/useAuth';
 import { Logger } from '@/lib/logger';
 import {
@@ -21,11 +20,11 @@ import {
   PaginationNext,
   PaginationPrevious,
 } from '@/components/ui/pagination';
-import { useIsMobile } from '@/hooks/use-mobile';
 import { sortAssetPageVideos } from '@/lib/utils/videoUtils';
 import { Button } from '@/components/ui/button';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import UploadPage from '@/pages/upload/UploadPage';
+import { useIsMobile } from '@/hooks/use-mobile';
 
 const logger = new Logger('AssetVideoSection');
 
@@ -64,27 +63,17 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
   const { pathname } = useLocation();
   const isMobile = useIsMobile();
   const isLoraPage = pathname.includes('/assets/loras/');
-  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
   const [classification, setClassification] = useState<'all' | 'gen' | 'art'>('all');
   
-  // State to track the ID of the video currently in view for autoplay
-  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
-  // Ref for the container holding the video grid
+  // Ref for scrolling to the top of the section when pagination changes
   const gridContainerRef = useRef<HTMLDivElement>(null);
-  // Ref for debouncing the visibility change
-  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
-
+  
   // Pagination state
   const itemsPerPage = 15; // Or make this a prop
   const [currentPage, setCurrentPage] = useState(1);
 
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
 
-  const handleHoverChange = (videoId: string, isHovering: boolean) => {
-    // logger.log(`Hover change: ${videoId}, ${isHovering}`);
-    setHoveredVideoId(isHovering ? videoId : null);
-  };
-  
   const sortedAndFilteredVideos = useMemo(() => {
     // logger.log(`Filtering videos. Initial count: ${videos?.length || 0}, classification: ${classification}`);
     if (!videos) return [];
@@ -143,43 +132,9 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
     unmountedRef.current = false;
     return () => {
       unmountedRef.current = true;
-      // Clear any pending timeout on unmount
-      if (visibilityTimeoutRef.current) {
-        clearTimeout(visibilityTimeoutRef.current);
-      }
     };
   }, []);
 
-  // Callback from VideoCard when its visibility changes - with debounce
-  const handleVideoVisibilityChange = useCallback((videoId: string, isVisible: boolean) => {
-    logger.log(`AssetVideoSection: Visibility change reported for ${videoId}: ${isVisible}`);
-
-    // Clear any existing timeout when visibility changes for *any* card
-    if (visibilityTimeoutRef.current) {
-      clearTimeout(visibilityTimeoutRef.current);
-      visibilityTimeoutRef.current = null;
-    }
-
-    if (isVisible) {
-      // If a video becomes visible, set a timeout to make it the active one
-      visibilityTimeoutRef.current = setTimeout(() => {
-        if (!unmountedRef.current) { // Check if component is still mounted
-            logger.log(`AssetVideoSection: Debounced - Setting visible video to ${videoId}`);
-            setVisibleVideoId(videoId);
-        }
-      }, 150); // 150ms debounce delay
-    } else {
-      // If a video becomes hidden, check if it was the currently active one
-      setVisibleVideoId(prevVisibleId => {
-        if (prevVisibleId === videoId) {
-          logger.log(`AssetVideoSection: Clearing visible video ${videoId} (became hidden)`);
-          return null; // Clear the active video ID immediately
-        }
-        return prevVisibleId; // Otherwise, keep the current state
-      });
-    }
-  }, []); // Empty dependency array as it uses refs and state setters
-
   const scrollToGridWithOffset = (offset: number = -150) => {
     if (gridContainerRef.current) {
       const y = gridContainerRef.current.getBoundingClientRect().top + window.pageYOffset + offset;
@@ -246,41 +201,23 @@ const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
       </div>
       
       <div ref={gridContainerRef} className="mt-6">
-        {videosToDisplay.length === 0 ? (
-          <EmptyState 
-            title="No Videos Yet" 
-            description={classification === 'all' 
+        <VideoGallerySection
+          videos={paginatedVideos}
+          isLoading={!asset || !videos}
+          isAdmin={isAdmin}
+          isAuthorized={isAuthorized}
+          onOpenLightbox={onOpenLightbox}
+          onApproveVideo={handleApproveVideo}
+          onRejectVideo={handleRejectVideo}
+          onDeleteVideo={handleDeleteVideo}
+          onUpdateLocalVideoStatus={(id, newStatus) => onStatusChange(id, newStatus as VideoDisplayStatus, 'assetMedia')}
+          itemsPerRow={classification === 'art' ? 4 : 6}
+          alwaysShowInfo={false}
+          compact={true}
+          emptyMessage={classification === 'all' 
               ? "No videos have been associated with this LoRA yet." 
-              : `No ${classification === 'gen' ? 'generation' : 'art'} videos found for this LoRA.`} 
-          />
-        ) : (
-          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
-            {paginatedVideos.map((video) => {
-              const isHovering = hoveredVideoId === video.id;
-              const isActive = visibleVideoId === video.id;
-
-              return (
-                <VideoCard
-                  key={video.id}
-                  video={video}
-                  isAdmin={isAdmin}
-                  isAuthorized={isAuthorized}
-                  isHovering={isHovering}
-                  onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
-                  onVisibilityChange={handleVideoVisibilityChange}
-                  onOpenLightbox={onOpenLightbox}
-                  onApproveVideo={handleApproveVideo}
-                  onRejectVideo={handleRejectVideo}
-                  onDeleteVideo={handleDeleteVideo}
-                  onSetPrimaryMedia={handleSetPrimaryMedia}
-                  onUpdateLocalVideoStatus={onStatusChange}
-                  forceCreatorHoverDesktop={false}
-                  alwaysShowInfo={false}
-                />
-              );
-            })}
-          </div>
-        )}
+              : `No ${classification === 'gen' ? 'generation' : 'art'} videos found for this LoRA.`}
+        />
       </div>
 
       {totalPages > 1 && (
diff --git a/src/pages/Index.tsx b/src/pages/Index.tsx
index c8d72b9..1e364a2 100644
--- a/src/pages/Index.tsx
+++ b/src/pages/Index.tsx
@@ -338,13 +338,17 @@ const Index: React.FC = () => {
   // Pagination Handlers
   const handleArtPageChange = useCallback((newPage: number) => {
     setArtPage(newPage);
-    scrollToElementWithOffset(artSectionRef.current);
-  }, []);
+    if (isMobile) {
+      scrollToElementWithOffset(artSectionRef.current);
+    }
+  }, [isMobile]);
 
   const handleGenerationPageChange = useCallback((newPage: number) => {
     setGenerationPage(newPage);
-    scrollToElementWithOffset(generationsSectionRef.current);
-  }, []);
+    if (isMobile) {
+      scrollToElementWithOffset(generationsSectionRef.current);
+    }
+  }, [isMobile]);
 
   // Pagination UI Renderer (Copied from UserProfilePage)
   const renderPaginationControls = (
```
---
**Commit:** `93b2083`
**Author:** POM
**Date:** 2025-04-24
**Message:** feat(VideoGrid): enhance layout animations and responsive behavior - Add LayoutGroup and layoutId for smoother transitions - Introduce tablet breakpoint for better responsive layout - Remove flickering during video grid rearrangement
```diff
diff --git a/src/components/lora/LoraCard.tsx b/src/components/lora/LoraCard.tsx
index 6ec7d4e..72bffe4 100644
--- a/src/components/lora/LoraCard.tsx
+++ b/src/components/lora/LoraCard.tsx
@@ -339,41 +339,6 @@ const LoraCard: React.FC<LoraCardProps> = ({
           </div>
         </CardFooter>
       )}
-      
-      {isAdmin && !isOwnProfile && location.pathname !== '/' && (
-         <CardFooter className="p-3 border-t" onClick={(e) => e.stopPropagation()}>
-             <AlertDialog>
-               <AlertDialogTrigger asChild>
-                 <Button 
-                   variant="destructive" 
-                   size="sm" 
-                   className="text-xs h-8 w-full"
-                   disabled={isDeleting}
-                 >
-                   <Trash className="h-3 w-3 mr-1" /> 
-                   Admin Delete
-                 </Button>
-               </AlertDialogTrigger>
-               <AlertDialogContent>
-                 <AlertDialogHeader>
-                   <AlertDialogTitle>Are you sure?</AlertDialogTitle>
-                   <AlertDialogDescription>
-                     This will permanently delete this LoRA and all its associated data. This is an admin action.
-                   </AlertDialogDescription>
-                 </AlertDialogHeader>
-                 <AlertDialogFooter>
-                   <AlertDialogCancel>Cancel</AlertDialogCancel>
-                   <AlertDialogAction 
-                     onClick={handleDelete}
-                     className="bg-destructive text-destructive-foreground"
-                   >
-                     Delete
-                   </AlertDialogAction>
-                 </AlertDialogFooter>
-               </AlertDialogContent>
-             </AlertDialog>
-         </CardFooter>
-      )}
     </Card>
   );
 };
diff --git a/src/components/video/VideoGrid.tsx b/src/components/video/VideoGrid.tsx
index a77b635..21a2973 100644
--- a/src/components/video/VideoGrid.tsx
+++ b/src/components/video/VideoGrid.tsx
@@ -1,6 +1,6 @@
 import { useState, useEffect, useRef, useMemo } from "react";
 import { Button } from "@/components/ui/button";
-import { motion } from "framer-motion";
+import { motion, LayoutGroup } from "framer-motion";
 import { VideoEntry } from "@/lib/types";
 import VideoCard from "./VideoCard";
 import { useIsMobile } from "@/hooks/use-mobile";
@@ -39,6 +39,8 @@ interface VideoGridProps {
   forceCreatorHoverDesktop?: boolean;
 }
 
+const TABLET_BREAKPOINT = 1024; // px – treat widths below this as tablet (but above mobile)
+
 export default function VideoGrid({
   videos,
   itemsPerRow = 4,
@@ -73,6 +75,19 @@ export default function VideoGrid({
 
   // Calculate rows based on container width and items per row
   const rows = useMemo(() => {
+    // Determine how many items we should show per row depending on the screen size
+    const effectiveItemsPerRow = (() => {
+      if (isMobile) return 1; // already handled separately below, but keep for clarity
+
+      // Tablet: between mobile and tablet breakpoint → show roughly half the usual density
+      if (containerWidth < TABLET_BREAKPOINT) {
+        return Math.max(2, Math.ceil(itemsPerRow / 2));
+      }
+
+      // Desktop/default
+      return itemsPerRow;
+    })();
+
     if (!containerWidth || !videos.length) return [];
     
     // Helper function to get the correct aspect ratio
@@ -134,7 +149,7 @@ export default function VideoGrid({
     
     // Initial layout calculation
     while (cursor < videos.length) {
-      const slice = videos.slice(cursor, cursor + itemsPerRow);
+      const slice = videos.slice(cursor, cursor + effectiveItemsPerRow);
       const GAP_PX = 8; // Tailwind gap-2 equals 0.5rem (assuming root font-size 16px)
 
       const sumWidth = slice.reduce((acc, vid) => {
@@ -169,9 +184,9 @@ export default function VideoGrid({
     if (initialRows.length >= 2) {
       const lastRow = initialRows[initialRows.length - 1];
       const secondLastRow = initialRows[initialRows.length - 2];
-      const threshold = Math.ceil(itemsPerRow / 2);
+      const threshold = Math.ceil(effectiveItemsPerRow / 2);
 
-      if (lastRow.length < threshold && secondLastRow.length >= itemsPerRow) { // Ensure secondLastRow has enough items to give one away
+      if (lastRow.length < threshold && secondLastRow.length >= effectiveItemsPerRow) { // Ensure secondLastRow has enough items to give one away
         const itemToMove = secondLastRow.pop(); 
         if (itemToMove) {
           lastRow.unshift(itemToMove); 
@@ -224,37 +239,44 @@ export default function VideoGrid({
   };
 
   return (
-    <div ref={containerRef} className="w-full">
-      {rows.map((row, rIdx) => (
-        <div key={rIdx} className="flex gap-2 mb-2">
-          {row.map((video: DisplayVideoEntry) => (
-            <motion.div
-              key={video.id}
-              layout
-              style={{ width: video.displayW, height: video.displayH }}
-              className="relative rounded-lg"
-            >
-              <VideoCard
-                video={video}
-                isAdmin={isAdmin}
-                isAuthorized={isAuthorized}
-                onOpenLightbox={onOpenLightbox}
-                onApproveVideo={onApproveVideo}
-                onDeleteVideo={onDeleteVideo}
-                onRejectVideo={onRejectVideo}
-                onSetPrimaryMedia={onSetPrimaryMedia}
-                isHovering={hoveredVideoId === video.id}
-                onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
-                onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
-                onVisibilityChange={handleVideoVisibilityChange}
-                shouldBePlaying={isMobile && video.id === visibleVideoId}
-                alwaysShowInfo={alwaysShowInfo}
-                forceCreatorHoverDesktop={forceCreatorHoverDesktop}
-              />
-            </motion.div>
-          ))}
-        </div>
-      ))}
-    </div>
+    <LayoutGroup>
+      <div ref={containerRef} className="w-full">
+        {rows.map((row, rIdx) => (
+          <motion.div
+            key={`row-${rIdx}`}
+            layout="position"
+            className="flex gap-2 mb-2"
+          >
+            {row.map((video: DisplayVideoEntry) => (
+              <motion.div
+                key={video.id}
+                layout
+                layoutId={video.id}
+                style={{ width: video.displayW, height: video.displayH }}
+                className="relative rounded-lg"
+              >
+                <VideoCard
+                  video={video}
+                  isAdmin={isAdmin}
+                  isAuthorized={isAuthorized}
+                  onOpenLightbox={onOpenLightbox}
+                  onApproveVideo={onApproveVideo}
+                  onDeleteVideo={onDeleteVideo}
+                  onRejectVideo={onRejectVideo}
+                  onSetPrimaryMedia={onSetPrimaryMedia}
+                  isHovering={hoveredVideoId === video.id}
+                  onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
+                  onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
+                  onVisibilityChange={handleVideoVisibilityChange}
+                  shouldBePlaying={isMobile && video.id === visibleVideoId}
+                  alwaysShowInfo={alwaysShowInfo}
+                  forceCreatorHoverDesktop={forceCreatorHoverDesktop}
+                />
+              </motion.div>
+            ))}
+          </motion.div>
+        ))}
+      </div>
+    </LayoutGroup>
   );
 } 
\ No newline at end of file
```
---
**Commit:** `f6f2f03`
**Author:** POM
**Date:** 2025-04-24
**Message:** refactor: render VideoGrid as single flex-wrap list to prevent row unmounts and further reduce flicker
```diff
diff --git a/src/components/video/VideoGrid.tsx b/src/components/video/VideoGrid.tsx
index 6ad26d0..d279a6a 100644
--- a/src/components/video/VideoGrid.tsx
+++ b/src/components/video/VideoGrid.tsx
@@ -245,40 +245,32 @@ export default function VideoGrid({
 
   return (
     <LayoutGroup id={gridId}>
-      <div ref={containerRef} className="w-full">
-        {rows.map((row, rIdx) => (
+      <div ref={containerRef} className="w-full flex flex-wrap gap-2">
+        {rows.flat().map((video: DisplayVideoEntry) => (
           <motion.div
-            key={`row-${rIdx}`}
+            key={video.id}
             layout="position"
-            className="flex gap-2 mb-2"
+            layoutId={`${gridId}-${video.id}`}
+            style={{ width: video.displayW, height: video.displayH }}
+            className="relative rounded-lg"
           >
-            {row.map((video: DisplayVideoEntry) => (
-              <motion.div
-                key={video.id}
-                layout="position"
-                layoutId={`${gridId}-${video.id}`}
-                style={{ width: video.displayW, height: video.displayH }}
-                className="relative rounded-lg"
-              >
-                <VideoCard
-                  video={video}
-                  isAdmin={isAdmin}
-                  isAuthorized={isAuthorized}
-                  onOpenLightbox={onOpenLightbox}
-                  onApproveVideo={onApproveVideo}
-                  onDeleteVideo={onDeleteVideo}
-                  onRejectVideo={onRejectVideo}
-                  onSetPrimaryMedia={onSetPrimaryMedia}
-                  isHovering={hoveredVideoId === video.id}
-                  onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
-                  onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
-                  onVisibilityChange={handleVideoVisibilityChange}
-                  shouldBePlaying={isMobile && video.id === visibleVideoId}
-                  alwaysShowInfo={alwaysShowInfo}
-                  forceCreatorHoverDesktop={forceCreatorHoverDesktop}
-                />
-              </motion.div>
-            ))}
+            <VideoCard
+              video={video}
+              isAdmin={isAdmin}
+              isAuthorized={isAuthorized}
+              onOpenLightbox={onOpenLightbox}
+              onApproveVideo={onApproveVideo}
+              onDeleteVideo={onDeleteVideo}
+              onRejectVideo={onRejectVideo}
+              onSetPrimaryMedia={onSetPrimaryMedia}
+              isHovering={hoveredVideoId === video.id}
+              onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
+              onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
+              onVisibilityChange={handleVideoVisibilityChange}
+              shouldBePlaying={isMobile && video.id === visibleVideoId}
+              alwaysShowInfo={alwaysShowInfo}
+              forceCreatorHoverDesktop={forceCreatorHoverDesktop}
+            />
           </motion.div>
         ))}
       </div>
```
---
**Commit:** `ccef762`
**Author:** POM
**Date:** 2025-04-24
**Message:** feat: enable initial entry animation for VideoGrid tiles
```diff
diff --git a/src/components/video/VideoGrid.tsx b/src/components/video/VideoGrid.tsx
index d279a6a..c61760a 100644
--- a/src/components/video/VideoGrid.tsx
+++ b/src/components/video/VideoGrid.tsx
@@ -1,6 +1,6 @@
 import { useState, useEffect, useRef, useMemo, useId } from "react";
 import { Button } from "@/components/ui/button";
-import { motion, LayoutGroup } from "framer-motion";
+import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
 import { VideoEntry } from "@/lib/types";
 import VideoCard from "./VideoCard";
 import { useIsMobile } from "@/hooks/use-mobile";
@@ -41,6 +41,12 @@ interface VideoGridProps {
 
 const TABLET_BREAKPOINT = 1024; // px – treat widths below this as tablet (but above mobile)
 
+const tileVariants = {
+  hidden: { opacity: 0, y: 20, scale: 0.98 },
+  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
+  exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" } },
+};
+
 export default function VideoGrid({
   videos,
   itemsPerRow = 4,
@@ -246,33 +252,37 @@ export default function VideoGrid({
   return (
     <LayoutGroup id={gridId}>
       <div ref={containerRef} className="w-full flex flex-wrap gap-2">
-        {rows.flat().map((video: DisplayVideoEntry) => (
-          <motion.div
-            key={video.id}
-            layout="position"
-            layoutId={`${gridId}-${video.id}`}
-            style={{ width: video.displayW, height: video.displayH }}
-            className="relative rounded-lg"
-          >
-            <VideoCard
-              video={video}
-              isAdmin={isAdmin}
-              isAuthorized={isAuthorized}
-              onOpenLightbox={onOpenLightbox}
-              onApproveVideo={onApproveVideo}
-              onDeleteVideo={onDeleteVideo}
-              onRejectVideo={onRejectVideo}
-              onSetPrimaryMedia={onSetPrimaryMedia}
-              isHovering={hoveredVideoId === video.id}
-              onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
-              onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
-              onVisibilityChange={handleVideoVisibilityChange}
-              shouldBePlaying={isMobile && video.id === visibleVideoId}
-              alwaysShowInfo={alwaysShowInfo}
-              forceCreatorHoverDesktop={forceCreatorHoverDesktop}
-            />
-          </motion.div>
-        ))}
+        <AnimatePresence mode="wait">
+          {rows.flat().map((video: DisplayVideoEntry) => (
+            <motion.div
+              key={video.id}
+              variants={tileVariants}
+              initial="hidden"
+              animate="visible"
+              exit="exit"
+              style={{ width: video.displayW, height: video.displayH }}
+              className="relative rounded-lg"
+            >
+              <VideoCard
+                video={video}
+                isAdmin={isAdmin}
+                isAuthorized={isAuthorized}
+                onOpenLightbox={onOpenLightbox}
+                onApproveVideo={onApproveVideo}
+                onDeleteVideo={onDeleteVideo}
+                onRejectVideo={onRejectVideo}
+                onSetPrimaryMedia={onSetPrimaryMedia}
+                isHovering={hoveredVideoId === video.id}
+                onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
+                onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
+                onVisibilityChange={handleVideoVisibilityChange}
+                shouldBePlaying={isMobile && video.id === visibleVideoId}
+                alwaysShowInfo={alwaysShowInfo}
+                forceCreatorHoverDesktop={forceCreatorHoverDesktop}
+              />
+            </motion.div>
+          ))}
+        </AnimatePresence>
       </div>
     </LayoutGroup>
   );
```
---
**Commit:** `53f048d`
**Author:** POM
**Date:** 2025-04-24
**Message:** feat: Improve video loading, add lightbox query param & progressive grid loading
```diff
diff --git a/public/Open-Muse-logo.png b/public/Open-Muse-logo.png
new file mode 100644
index 0000000..7c77791
Binary files /dev/null and b/public/Open-Muse-logo.png differ
diff --git a/src/components/LoraManager.tsx b/src/components/LoraManager.tsx
index a49eaca..4a2195b 100644
--- a/src/components/LoraManager.tsx
+++ b/src/components/LoraManager.tsx
@@ -29,6 +29,8 @@ interface LoraManagerProps {
   approvalFilter?: 'all' | 'curated';
   onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
   isUpdatingStatusMap?: Record<string, boolean>;
+  /** Optional prop to control the visibility of the internal header (h2 and See All link). Defaults to true. */
+  showHeader?: boolean;
 }
 
 const LoraManager: React.FC<LoraManagerProps> = ({ 
@@ -44,8 +46,9 @@ const LoraManager: React.FC<LoraManagerProps> = ({
   approvalFilter = 'curated', // Default to 'curated' if not provided
   onUserStatusChange,
   isUpdatingStatusMap,
+  showHeader = true, // Default to true if not provided
 }) => {
-  logger.log(`LoraManager rendering/initializing. Props: isLoading (videos)=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, filterText=${filterText}, isAdmin=${isAdmin}`);
+  logger.log(`LoraManager rendering/initializing. Props: isLoading (videos)=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, filterText=${filterText}, isAdmin=${isAdmin}, showHeader=${showHeader}`);
 
   const { isAdmin: authIsAdmin } = useAuth();
   
@@ -59,19 +62,21 @@ const LoraManager: React.FC<LoraManagerProps> = ({
 
   return (
     <div className="space-y-4">
-      <div className="flex items-center justify-between">
-        <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
-          LoRAs
-        </h2>
-        {showSeeAllLink && (
-          <Link
-            to="/loras"
-            className="text-sm text-primary hover:underline ml-auto"
-          >
-            See all {approvalFilter === 'curated' ? `curated ` : ''}LoRAs →
-          </Link>
-        )}
-      </div>
+      {showHeader && (
+        <div className="flex items-center justify-between">
+          <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
+            LoRAs
+          </h2>
+          {showSeeAllLink && (
+            <Link
+              to="/loras"
+              className="text-sm text-primary hover:underline ml-auto"
+            >
+              See all {approvalFilter === 'curated' ? `curated ` : ''}LoRAs →
+            </Link>
+          )}
+        </div>
+      )}
 
       {isLoading ? (
         <LoadingState />
diff --git a/src/components/Navigation.tsx b/src/components/Navigation.tsx
index cf01591..66cb14d 100644
--- a/src/components/Navigation.tsx
+++ b/src/components/Navigation.tsx
@@ -1,4 +1,3 @@
-
 import React, { useState, useEffect } from 'react';
 import { Link, useLocation } from 'react-router-dom';
 import { cn } from '@/lib/utils';
@@ -7,7 +6,7 @@ import AuthButton from './AuthButton';
 import { useAuth } from '@/hooks/useAuth';
 import { useIsMobile } from '@/hooks/use-mobile';
 
-const logoPath = 'https://i.ibb.co/C3ZhdXgS/cropped-Open-Muse-logo.png';
+const logoPath = '/Open-Muse-logo.png';
 
 const Navigation: React.FC = () => {
   const location = useLocation();
diff --git a/src/components/StorageVideoPlayer.tsx b/src/components/StorageVideoPlayer.tsx
index b35480c..21a7fe6 100644
--- a/src/components/StorageVideoPlayer.tsx
+++ b/src/components/StorageVideoPlayer.tsx
@@ -64,7 +64,7 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
   const [errorDetails, setErrorDetails] = useState<string | null>(null);
   const [retryCount, setRetryCount] = useState(0);
   const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
-  const [shouldLoadVideo, setShouldLoadVideo] = useState(true);
+  const [shouldLoadVideo, setShouldLoadVideo] = useState<boolean>(() => forcePreload || (isMobile && autoPlay));
   const [hasHovered, setHasHovered] = useState(forcePreload || (!isMobile && autoPlay));
   const [shouldPlay, setShouldPlay] = useState(isMobile ? false : (forcePreload || autoPlay));
   const prevVideoLocationRef = useRef<string | null>(null);
@@ -283,8 +283,13 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
 
   // Determine visibility states
   const showVideo = !!videoUrl && !error;
-  const showLoadingSpinner = isLoadingVideoUrl && !error && !isVideoLoaded && (hasHovered || shouldLoadVideo);
-  const showThumbnail = !!thumbnailUrl && !error && !(isHovering && playOnHover) && (!isVideoLoaded || preventLoadingFlicker);
+  // Show the loading spinner only while the user is interacting (hovering) on desktop.
+  // Mobile devices don't have hover, so maintain previous behaviour there.
+  const showLoadingSpinner = isLoadingVideoUrl && !error && !isVideoLoaded && (isMobile || isHovering);
+  // Always keep thumbnail visible until the video has actually loaded. The
+  // previous condition hid it as soon as the user hovered, which resulted in
+  // a brief grey flash while the video element was still buffering.
+  const showThumbnail = !!thumbnailUrl && !error && (!isVideoLoaded || preventLoadingFlicker);
 
   // logger.log(`${logPrefix} Visibility states: showThumbnail=${showThumbnail}, showVideo=${showVideo}, showLoadingSpinner=${showLoadingSpinner}, isVideoLoaded=${isVideoLoaded}, hasHovered=${hasHovered}, videoUrl=${!!videoUrl}, error=${!!error}`);
 
diff --git a/src/components/VideoLightbox.tsx b/src/components/VideoLightbox.tsx
index 727b872..0e85d81 100644
--- a/src/components/VideoLightbox.tsx
+++ b/src/components/VideoLightbox.tsx
@@ -40,7 +40,7 @@ import {
 } from '@/components/ui/tooltip';
 import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
 import LoraCreatorInfo from './lora/LoraCreatorInfo';
-import { Link } from 'react-router-dom';
+import { Link, useSearchParams } from 'react-router-dom';
 
 interface VideoLightboxProps {
   isOpen: boolean;
@@ -121,6 +121,8 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
     Rejected: XCircle, // Keep for mapping, though button won't be shown
   };
 
+  const [, setSearchParams] = useSearchParams();
+
   useEffect(() => {
     setEditableTitle(initialTitle || '');
     setEditableDescription(initialDescription || '');
@@ -174,6 +176,31 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
     fetchLoras();
   }, [isOpen, availableLoras.length, isFetchingLoras, toast]);
 
+  // --------------------------------------------------
+  // Keep ?video=<id> in the URL while the lightbox is open.
+  // --------------------------------------------------
+  // 1. Whenever `videoId` changes _and_ the lightbox is open → write param.
+  useEffect(() => {
+    if (!isOpen) return;
+    setSearchParams(prev => {
+      const p = new URLSearchParams(prev);
+      p.set('video', videoId);
+      return p;
+    }, { replace: true });
+  }, [videoId, isOpen, setSearchParams]);
+
+  // 2. When the lightbox is closed/unmounted → remove the param once.
+  useEffect(() => {
+    if (!isOpen) return;
+    return () => {
+      setSearchParams(prev => {
+        const p = new URLSearchParams(prev);
+        p.delete('video');
+        return p;
+      }, { replace: true });
+    };
+  }, [isOpen, setSearchParams]);
+
   const handleCancelEdit = useCallback(() => {
     setIsEditing(false);
     setEditableTitle(initialTitle || '');
@@ -359,13 +386,37 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
   return (
     <AlertDialog>
       <TooltipProvider delayDuration={100}>
-        <Dialog open={isOpen} onOpenChange={(open) => {
+        <Dialog
+          open={isOpen}
+          onOpenChange={(open) => {
             if (!open) {
-                if (isEditing) handleCancelEdit();
-                onClose();
+              // Remove ?video param immediately so parent pages don't auto-reopen
+              setSearchParams(prev => {
+                const p = new URLSearchParams(prev);
+                p.delete('video');
+                return p;
+              }, { replace: true });
+
+              if (isEditing) handleCancelEdit();
+              onClose();
             }
-        }}>
-          <DialogContent className="max-w-5xl p-0 bg-background max-h-[90vh] flex flex-col">
+          }}
+        >
+          <DialogContent
+            className="max-w-5xl p-0 bg-background max-h-[90vh] flex flex-col"
+            onClickCapture={(e) => {
+              const anchor = (e.target as HTMLElement).closest('a');
+              if (anchor) {
+                // Clear param then close lightbox so navigation proceeds cleanly
+                setSearchParams(prev => {
+                  const p = new URLSearchParams(prev);
+                  p.delete('video');
+                  return p;
+                }, { replace: true });
+                onClose();
+              }
+            }}
+          >
             <DialogHeader className="p-4 border-b">
               <DialogTitle>
                 {isEditing ? editableTitle : initialTitle || 'Video'}
@@ -596,7 +647,16 @@ const VideoLightbox: React.FC<VideoLightboxProps> = ({
                             <Link 
                               to={`/assets/${initialAssetId}`}
                               className="text-foreground underline"
-                              onClick={(e) => e.stopPropagation()} // Prevent closing lightbox on link click
+                              onClick={(e) => {
+                                e.stopPropagation();
+                                // Clear URL param and close before navigating
+                                setSearchParams(prev => {
+                                  const p = new URLSearchParams(prev);
+                                  p.delete('video');
+                                  return p;
+                                }, { replace: true });
+                                onClose();
+                              }}
                             >
                               {loraName}
                             </Link>
diff --git a/src/components/lora/LoraCard.tsx b/src/components/lora/LoraCard.tsx
index 72bffe4..5d611cd 100644
--- a/src/components/lora/LoraCard.tsx
+++ b/src/components/lora/LoraCard.tsx
@@ -233,7 +233,7 @@ const LoraCard: React.FC<LoraCardProps> = ({
                 url={videoUrl} 
                 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out" 
                 title={lora.name}
-                lazyLoad={true}
+                lazyLoad={false}
                 thumbnailUrl={thumbnailUrl}
                 onLoadedData={handleVideoLoad}
                 onVisibilityChange={handleVisibilityChange}
diff --git a/src/components/video/VideoCard.tsx b/src/components/video/VideoCard.tsx
index 79f1e6a..6c018df 100644
--- a/src/components/video/VideoCard.tsx
+++ b/src/components/video/VideoCard.tsx
@@ -70,7 +70,14 @@ const VideoCard: React.FC<VideoCardProps> = ({
   const location = useLocation();
   const { user } = useAuth();
   const isMobile = useIsMobile();
-  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
+  // Attempt to seed thumbnail from several possible fields, defaulting to a
+  // generic placeholder so the card never appears as a stark black square.
+  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() =>
+    video.metadata?.placeholder_image ||
+    (video as any).placeholder_image ||
+    (video as any).thumbnailUrl ||
+    '/placeholder.svg',
+  );
   const cardRef = useRef<HTMLDivElement>(null);
   // ---------------------------------------------------------------
   // Use the dimensions calculated by the VideoGrid (displayW / displayH)
@@ -306,8 +313,7 @@ const VideoCard: React.FC<VideoCardProps> = ({
             creator={getCreatorName()}
             className="w-full h-full object-cover"
             isHovering={combinedHovering}
-            // On profile page: lazy-load until either hovered OR the card scrolls into view (desktop only)
-            lazyLoad={isProfilePage ? (!combinedHovering && !isInViewport) : false}
+            lazyLoad={false}
             thumbnailUrl={thumbnailUrl}
             onLoadedData={handleVideoLoad}
             onVisibilityChange={handleVisibilityChange}
diff --git a/src/components/video/VideoGrid.tsx b/src/components/video/VideoGrid.tsx
index c61760a..2aafb19 100644
--- a/src/components/video/VideoGrid.tsx
+++ b/src/components/video/VideoGrid.tsx
@@ -4,6 +4,7 @@ import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
 import { VideoEntry } from "@/lib/types";
 import VideoCard from "./VideoCard";
 import { useIsMobile } from "@/hooks/use-mobile";
+import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
 
 // Define standard video resolutions and their aspect ratios
 const resolutions = [
@@ -62,8 +63,33 @@ export default function VideoGrid({
   forceCreatorHoverDesktop = false,
 }: VideoGridProps) {
   const containerRef = useRef<HTMLDivElement>(null);
+  const sentinelRef = useRef<HTMLDivElement>(null);
   // Unique id for this grid instance so layoutIds don't clash across multiple grids on the page
   const gridId = useId();
+
+  const CHUNK_SIZE = 40; // number of videos to add each time on desktop
+  const INITIAL_CHUNK = 40; // initial items to render
+
+  // Track how many videos are currently visible (rendered)
+  const [visibleCount, setVisibleCount] = useState<number>(() => Math.min(videos.length, INITIAL_CHUNK));
+
+  // Reset visibleCount if the videos array changes significantly (e.g., new search)
+  useEffect(() => {
+    setVisibleCount(Math.min(videos.length, INITIAL_CHUNK));
+  }, [videos]);
+
+  // Use intersection observer on a sentinel element at the bottom of the grid to progressively load more
+  const isSentinelVisible = useIntersectionObserver(sentinelRef, { rootMargin: '300px', threshold: 0 });
+
+  useEffect(() => {
+    if (isSentinelVisible && visibleCount < videos.length) {
+      setVisibleCount(prev => Math.min(prev + CHUNK_SIZE, videos.length));
+    }
+  }, [isSentinelVisible, visibleCount, videos.length]);
+
+  // Slice the videos array based on visibleCount
+  const visibleVideos = useMemo(() => videos.slice(0, visibleCount), [videos, visibleCount]);
+
   const [containerWidth, setContainerWidth] = useState(0);
   const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
   const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
@@ -81,7 +107,7 @@ export default function VideoGrid({
     return () => window.removeEventListener("resize", measure);
   }, []);
 
-  // Calculate rows based on container width and items per row
+  // Calculate rows based on container width and items per row (only for visibleVideos)
   const rows = useMemo(() => {
     // Determine how many items we should show per row depending on the screen size
     const effectiveItemsPerRow = (() => {
@@ -96,7 +122,7 @@ export default function VideoGrid({
       return itemsPerRow;
     })();
 
-    if (!containerWidth || !videos.length) return [];
+    if (!containerWidth || !visibleVideos.length) return [];
     
     // Helper function to get the correct aspect ratio
     const getAspectRatio = (vid: VideoEntry): number => {
@@ -108,8 +134,8 @@ export default function VideoGrid({
     };
 
     // --- Single Video Case --- 
-    if (videos.length === 1) {
-      const video = videos[0];
+    if (visibleVideos.length === 1) {
+      const video = visibleVideos[0];
       const aspectRatio = getAspectRatio(video);
       let displayH = DEFAULT_ROW_HEIGHT * 1.5; // Make single videos a bit larger than default row height
       let displayW = aspectRatio * displayH;
@@ -134,7 +160,7 @@ export default function VideoGrid({
     
     // --- Mobile: Single Column Layout ---
     if (isMobile) {
-      return videos.map((video) => {
+      return visibleVideos.map((video) => {
         // Use the same helper as desktop to get the correct aspect ratio
         const aspectRatio = getAspectRatio(video);
         // Use full container width for the video
@@ -156,8 +182,8 @@ export default function VideoGrid({
     let cursor = 0;
     
     // Initial layout calculation
-    while (cursor < videos.length) {
-      const slice = videos.slice(cursor, cursor + effectiveItemsPerRow);
+    while (cursor < visibleVideos.length) {
+      const slice = visibleVideos.slice(cursor, cursor + effectiveItemsPerRow);
       const GAP_PX = 8; // Tailwind gap-2 equals 0.5rem (assuming root font-size 16px)
 
       const sumWidth = slice.reduce((acc, vid) => {
@@ -235,7 +261,7 @@ export default function VideoGrid({
     }
     
     return initialRows.filter(row => row.length > 0); 
-  }, [containerWidth, videos, itemsPerRow, isMobile]);
+  }, [containerWidth, visibleVideos, itemsPerRow, isMobile]);
 
   const handleHoverChange = (videoId: string, isHovering: boolean) => {
     setHoveredVideoId(isHovering ? videoId : null);
@@ -283,6 +309,8 @@ export default function VideoGrid({
             </motion.div>
           ))}
         </AnimatePresence>
+        {/* Sentinel element to trigger loading more videos */}
+        <div ref={sentinelRef} className="w-full h-px" />
       </div>
     </LayoutGroup>
   );
diff --git a/src/pages/AssetDetailPage/AssetDetailPage.tsx b/src/pages/AssetDetailPage/AssetDetailPage.tsx
index 242d9ce..22482a1 100644
--- a/src/pages/AssetDetailPage/AssetDetailPage.tsx
+++ b/src/pages/AssetDetailPage/AssetDetailPage.tsx
@@ -1,5 +1,5 @@
 import React, { useState, useEffect, useMemo, useCallback } from 'react';
-import { useParams, useNavigate } from 'react-router-dom';
+import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
 import Navigation, { Footer } from '@/components/Navigation';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Button } from '@/components/ui/button';
@@ -28,6 +28,8 @@ function AssetDetailPage() {
   const { user, isAdmin } = useAuth();
   const [lightboxOpen, setLightboxOpen] = useState(false);
   const [currentVideo, setCurrentVideo] = useState<VideoEntry | null>(null);
+  const [initialVideoParamHandled, setInitialVideoParamHandled] = useState(false);
+  const [searchParams] = useSearchParams();
   
   const {
     asset,
@@ -50,6 +52,7 @@ function AssetDetailPage() {
   const handleOpenLightbox = (video: VideoEntry) => {
     setCurrentVideo(video);
     setLightboxOpen(true);
+    setInitialVideoParamHandled(true);
   };
   
   const handleCloseLightbox = () => {
@@ -405,6 +408,18 @@ function AssetDetailPage() {
     }
   }, [currentLightboxIndex, videoList]);
   
+  const videoParam = searchParams.get('video');
+  useEffect(() => {
+    if (!videoParam) return;
+    if (initialVideoParamHandled) return;
+    if (currentVideo && currentVideo.id === videoParam) return;
+    const found = videos.find(v => v.id === videoParam);
+    if (found) {
+      handleOpenLightbox(found);
+      setInitialVideoParamHandled(true);
+    }
+  }, [videoParam, videos, currentVideo, initialVideoParamHandled, handleOpenLightbox]);
+  
   // logger.log(`[AssetDetailPage Render] isLoading: ${isLoading}, asset exists: ${!!asset}`);
 
   if (isLoading) {
diff --git a/src/pages/AssetDetailPage/components/AssetInfoCard.tsx b/src/pages/AssetDetailPage/components/AssetInfoCard.tsx
index 88832f7..b7f2c7d 100644
--- a/src/pages/AssetDetailPage/components/AssetInfoCard.tsx
+++ b/src/pages/AssetDetailPage/components/AssetInfoCard.tsx
@@ -207,12 +207,9 @@ const AssetInfoCard = ({
                   {/* Hidden Button */}
                   <Button
                     size="sm"
-                    variant={asset?.admin_status === 'Hidden' ? "destructive" : "outline"}
+                    variant={asset?.admin_status === 'Hidden' ? "secondary" : "outline"}
                     onClick={() => onAdminStatusChange('Hidden')}
-                    className={cn(
-                      "gap-1 h-8 text-xs",
-                      asset?.admin_status === 'Hidden' ? "" : "border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
-                    )}
+                    className="gap-1 h-8 text-xs"
                     disabled={isUpdatingAdminStatus || asset?.admin_status === 'Hidden'}
                   >
                     <EyeOff className="h-4 w-4" /> Hide
diff --git a/src/pages/AssetDetailPage/components/AssetVideoSection/VideoCard.tsx b/src/pages/AssetDetailPage/components/AssetVideoSection/VideoCard.tsx
new file mode 100644
index 0000000..0519ecb
--- /dev/null
+++ b/src/pages/AssetDetailPage/components/AssetVideoSection/VideoCard.tsx
@@ -0,0 +1 @@
+ 
\ No newline at end of file
diff --git a/src/pages/Index.tsx b/src/pages/Index.tsx
index b8b24d5..a6dadc0 100644
--- a/src/pages/Index.tsx
+++ b/src/pages/Index.tsx
@@ -517,6 +517,25 @@ const Index: React.FC = () => {
   }, [refetchVideos]);
   // --- End Lightbox Handlers ---
 
+  // -----------------------------
+  // Open lightbox automatically if ?video query param is present
+  // -----------------------------
+  useEffect(() => {
+    const videoParam = searchParams.get('video');
+    if (!videoParam) return;
+
+    // If lightbox already open for this video, do nothing
+    if (lightboxVideo && lightboxVideo.id === videoParam) return;
+
+    // Once we have the video list, try to find the video and open it
+    if (videos && videos.length > 0) {
+      const found = videos.find(v => v.id === videoParam);
+      if (found) {
+        handleOpenLightbox(found);
+      }
+    }
+  }, [searchParams, videos, lightboxVideo, handleOpenLightbox]);
+
   return (
     <div className="flex flex-col min-h-screen">
       <Navigation />
diff --git a/src/pages/UserProfilePage.tsx b/src/pages/UserProfilePage.tsx
index d2d6d42..b1aa167 100644
--- a/src/pages/UserProfilePage.tsx
+++ b/src/pages/UserProfilePage.tsx
@@ -125,6 +125,7 @@ export default function UserProfilePage() {
   const [totalGenerationVideos, setTotalGenerationVideos] = useState(0);
   const [totalArtVideos, setTotalArtVideos] = useState(0);
   const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
+  const [initialVideoParamHandled, setInitialVideoParamHandled] = useState(false);
   const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
   const [isUpdatingAssetStatus, setIsUpdatingAssetStatus] = useState<Record<string, boolean>>({});
   // State for autoplay on scroll
@@ -159,6 +160,9 @@ export default function UserProfilePage() {
   const [isGenerationUploadModalOpen, setIsGenerationUploadModalOpen] = useState(false);
   const [isArtUploadModalOpen, setIsArtUploadModalOpen] = useState(false);
 
+  // Only this flag (not the whole query string) should trigger data refetch
+  const loggedOutViewParam = searchParams.get('loggedOutView');
+
   // --- Data Fetching Functions defined using useCallback --- 
   const fetchUserAssets = useCallback(async (profileUserId: string, canViewerSeeHiddenAssets: boolean, page: number) => {
     logger.log('[fetchUserAssets] Fetching page...', { profileUserId, canViewerSeeHiddenAssets, page });
@@ -348,7 +352,7 @@ export default function UserProfilePage() {
 
   // --- Main Data Fetching Effect --- 
   useEffect(() => {
-    const shouldForceLoggedOutView = searchParams.get('loggedOutView') === 'true';
+    const shouldForceLoggedOutView = loggedOutViewParam === 'true';
     setForceLoggedOutView(shouldForceLoggedOutView);
     let isMounted = true;
     const fetchProfileAndInitialData = async () => {
@@ -436,7 +440,7 @@ export default function UserProfilePage() {
     };
     fetchProfileAndInitialData();
     return () => { isMounted = false }; 
-  }, [displayName, user, navigate, isAdmin, searchParams, fetchUserAssets, fetchUserVideos]);
+  }, [displayName, user, navigate, isAdmin, loggedOutViewParam, fetchUserAssets, fetchUserVideos]);
 
   // --- Derived State with useMemo --- 
   const generationVideos = useMemo(() => userVideos.filter(v => v.metadata?.classification === 'gen'), [userVideos]);
@@ -688,10 +692,13 @@ export default function UserProfilePage() {
     scrollToElementWithOffset(lorasGridRef.current);
     setTimeout(() => { if (!unmountedRef.current) setLoraPage(newPage); }, 300);
   };
-  const handleOpenLightbox = (video: VideoEntry) => setLightboxVideo(video);
+  const handleOpenLightbox = (video: VideoEntry) => {
+    setLightboxVideo(video);
+    setInitialVideoParamHandled(true);
+  };
   const handleCloseLightbox = () => setLightboxVideo(null);
   const handleHoverChange = (videoId: string, isHovering: boolean) => {
-    setHoveredVideoId(isHovering ? videoId : (hoveredVideoId === videoId ? null : hoveredVideoId)); 
+    setHoveredVideoId(isHovering ? videoId : null);
   };
 
   // --- Constants defined inside component (Keep these) --- 
@@ -758,6 +765,23 @@ export default function UserProfilePage() {
     }
   }, [currentLightboxIndex, fullVideoListForLightbox]);
 
+  // --------------------------------------------------
+  // Auto-open lightbox when ?video=<id> is present
+  // --------------------------------------------------
+  useEffect(() => {
+    const videoParam = searchParams.get('video');
+    if (!videoParam) return;
+
+    if (initialVideoParamHandled) return;
+    if (lightboxVideo && lightboxVideo.id === videoParam) return;
+    if (userVideos && userVideos.length > 0) {
+      const found = userVideos.find(v => v.id === videoParam);
+      if (found) {
+        handleOpenLightbox(found);
+      }
+    }
+  }, [searchParams, lightboxVideo, initialVideoParamHandled, userVideos, handleOpenLightbox]);
+
   // --- JSX Rendering --- 
   return (
     <div className="w-full min-h-screen flex flex-col text-foreground">
@@ -831,7 +855,7 @@ export default function UserProfilePage() {
                   </Dialog>
                 )}
               </CardHeader>
-              <CardContent ref={lorasGridRef} className="p-4 md:p-6">
+              <CardContent ref={lorasGridRef} className="p-4 md:p-6 pt-6">
                 {isLoadingAssets ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                  userAssets.length > 0 ? ( <> 
                     <LoraManager
@@ -842,6 +866,7 @@ export default function UserProfilePage() {
                       onUserStatusChange={handleAssetStatusUpdate} // Pass status update handler
                       isUpdatingStatusMap={isUpdatingAssetStatus} // Pass map of updating statuses
                       showSeeAllLink={false} // Don't show "See All" on profile
+                      showHeader={false} // Hide the internal LoraManager header on the profile page
                       // Omit filterText, onFilterTextChange, onRefreshData, onNavigateToUpload
                       // Omit hideCreatorInfo (handled by LoraManager or default)
                       // Omit visibility/autoplay props for now
@@ -874,7 +899,7 @@ export default function UserProfilePage() {
                    </Dialog>
                 )}
               </CardHeader>
-              <CardContent>
+              <CardContent className="pt-6">
                  {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 4} /> ) : 
                   artVideos.length > 0 ? ( <> 
                     <div ref={artGridRef}> {/* Removed -mt-10 wrapper */}
@@ -926,7 +951,7 @@ export default function UserProfilePage() {
                   </Dialog>
                 )}
               </CardHeader>
-              <CardContent>
+              <CardContent className="pt-6">
                  {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                   generationVideos.length > 0 ? ( <> 
                     <div ref={generationsGridRef}> {/* Removed -mt-10 wrapper */}
```
---
**Commit:** `c7076e0`
**Author:** POM
**Date:** 2025-04-27
**Message:** fix: Ensure mobile video plays and use username for profile link
```diff
diff --git a/src/components/StorageVideoPlayer.tsx b/src/components/StorageVideoPlayer.tsx
index 21a7fe6..8ccbd65 100644
--- a/src/components/StorageVideoPlayer.tsx
+++ b/src/components/StorageVideoPlayer.tsx
@@ -55,27 +55,29 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
 }) => {
   const componentId = useRef(`storage_video_${Math.random().toString(36).substring(2, 9)}`).current;
   const logPrefix = `[SVP_DEBUG][${componentId}]`;
-  // logger.log(`${logPrefix} Rendering. Initial props: thumbnailUrl=${!!thumbnailUrl}, forcePreload=${forcePreload}, autoPlay=${autoPlay}`);
+  // logger.log(`${logPrefix} Rendering. Initial props: thumbnailUrl=${!!thumbnailUrl}, forcePreload=${forcePreload}, autoPlay=${autoPlay}, shouldBePlaying=${shouldBePlaying}`);
 
   const [videoUrl, setVideoUrl] = useState<string>('');
-  const [isLoadingVideoUrl, setIsLoadingVideoUrl] = useState<boolean>(false); 
-  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false); 
+  const [isLoadingVideoUrl, setIsLoadingVideoUrl] = useState<boolean>(false);
+  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false);
   const [error, setError] = useState<string | null>(null);
   const [errorDetails, setErrorDetails] = useState<string | null>(null);
   const [retryCount, setRetryCount] = useState(0);
+  // Internal hover state, synced with external if provided, otherwise manual
   const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
-  const [shouldLoadVideo, setShouldLoadVideo] = useState<boolean>(() => forcePreload || (isMobile && autoPlay));
-  const [hasHovered, setHasHovered] = useState(forcePreload || (!isMobile && autoPlay));
-  const [shouldPlay, setShouldPlay] = useState(isMobile ? false : (forcePreload || autoPlay));
+  const [shouldLoadVideo, setShouldLoadVideo] = useState<boolean>(() => forcePreload || (isMobile && autoPlay)); // Keep initial load logic
+  const [hasHovered, setHasHovered] = useState(forcePreload || (!isMobile && autoPlay)); // Keep initial hasHovered logic
+  // This state now primarily reflects the *intent* to play based on props/hover
+  const [shouldPlay, setShouldPlay] = useState(false);
   const prevVideoLocationRef = useRef<string | null>(null);
   const [preloadTriggered, setPreloadTriggered] = useState(false);
 
-  // logger.log(`${logPrefix} Initial state: shouldLoadVideo=${shouldLoadVideo}, hasHovered=${hasHovered}`);
+  // logger.log(`${logPrefix} Initial state: shouldLoadVideo=${shouldLoadVideo}, hasHovered=${hasHovered}, shouldPlay=${shouldPlay}`);
 
   const containerRef = useRef<HTMLDivElement>(null);
   const internalVideoRef = useRef<HTMLVideoElement>(null);
   const videoRef = externalVideoRef || internalVideoRef;
-  const isHoveringRef = useRef(isHoveringExternally || false);
+  const isHoveringRef = useRef(isHoveringExternally || false); // Ref to track hover state
   const unmountedRef = useRef(false);
   
   const isBlobUrl = videoLocation.startsWith('blob:');
@@ -89,27 +91,49 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
     };
   }, []);
 
-  // Sync external hover state
+  // Effect to sync external hover state and trigger video loading on hover
   useEffect(() => {
     isHoveringRef.current = isHoveringExternally || false;
     if (isHoveringExternally !== undefined && !unmountedRef.current) {
       // logger.log(`${logPrefix} isHoveringExternally changed to ${isHoveringExternally}`);
-      setIsHovering(isHoveringExternally);
+      setIsHovering(isHoveringExternally); // Update internal hover state for consistency
       if (isHoveringExternally) {
-        setHasHovered(true); 
-        setShouldLoadVideo(true);
-        // Update shouldPlay when hovering starts
-        if (!isMobile) {
-          setShouldPlay(true);
+        // Trigger loading on hover start if not already loading/loaded
+        if (!shouldLoadVideo && !videoUrl && !error) {
+           // logger.log(`${logPrefix} Triggering load on external hover start`);
+           setShouldLoadVideo(true);
+           setHasHovered(true); // Mark as interacted
         }
-      } else {
-        // Stop playing when hover ends
-        setShouldPlay(false);
       }
+      // NOTE: Play decision is handled in the dedicated effect below
     }
-  }, [isHoveringExternally, isMobile]);
+  }, [isHoveringExternally, shouldLoadVideo, videoUrl, error]);
 
-  // Effect to handle mobile state – only auto–load if `forcePreload` is set.
+  // Effect to determine if the video should be playing based on props and state
+  useEffect(() => {
+    if (unmountedRef.current) return;
+
+    // logger.log(`${logPrefix} Play control effect triggered. shouldBePlaying=${shouldBePlaying}, isHovering=${isHovering}, isMobile=${isMobile}, playOnHover=${playOnHover}`);
+
+    if (shouldBePlaying) {
+      // logger.log(`${logPrefix} Setting shouldPlay = true because shouldBePlaying is true`);
+      setShouldPlay(true);
+      // Ensure video loading is also triggered if needed
+      if (!shouldLoadVideo && !videoUrl && !error) {
+        // logger.log(`${logPrefix} Triggering load because shouldPlay is true and video not loading/loaded`);
+        setShouldLoadVideo(true);
+        setHasHovered(true); // Treat as "interacted"
+      }
+    } else {
+      // If shouldBePlaying is false, determine play state based on hover (desktop only)
+      const playBasedOnHover = playOnHover && isHovering && !isMobile;
+      // logger.log(`${logPrefix} Setting shouldPlay based on hover: ${playBasedOnHover}`);
+      setShouldPlay(playBasedOnHover);
+    }
+
+  }, [shouldBePlaying, isHovering, isMobile, playOnHover, shouldLoadVideo, videoUrl, error]);
+
+  // Effect to handle initial mobile state + forcePreload
   useEffect(() => {
     if (isMobile && forcePreload && !unmountedRef.current) {
       // logger.log(`${logPrefix} Mobile + forcePreload: Setting shouldLoadVideo=true, hasHovered=true`);
@@ -118,15 +142,16 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
     }
   }, [isMobile, forcePreload]);
 
-  // Handle manual hover events
+  // Handle manual hover events (only trigger load, play logic handled above)
   const handleManualHoverStart = () => {
     if (isHoveringExternally === undefined && !unmountedRef.current) {
       // logger.log(`${logPrefix} Manual hover start`);
       setIsHovering(true);
-      setHasHovered(true);
-      setShouldLoadVideo(true);
-      if (!isMobile) {
-        setShouldPlay(true);
+      // Trigger loading on hover if not already loading/loaded
+      if (!shouldLoadVideo && !videoUrl && !error) {
+        // logger.log(`${logPrefix} Triggering load on manual hover start`);
+        setShouldLoadVideo(true);
+        setHasHovered(true);
       }
     }
   };
@@ -135,7 +160,7 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
     if (isHoveringExternally === undefined && !unmountedRef.current) {
       // logger.log(`${logPrefix} Manual hover end`);
       setIsHovering(false);
-      setShouldPlay(false);
+      // Play state will be updated by the dedicated effect based on isHovering=false
     }
   };
   
@@ -374,9 +399,9 @@ const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
             )}
             controls={controls && !previewMode} 
             autoPlay={false}
-            triggerPlay={shouldBePlaying}
+            triggerPlay={shouldPlay}
             muted={muted}
-            loop={shouldBePlaying || (playOnHover && isHovering) || loop}
+            loop={loop}
             playOnHover={playOnHover && !isMobile}
             onError={handleVideoError}
             showPlayButtonOnHover={showPlayButtonOnHover && !isMobile}
diff --git a/src/components/lora/LoraCreatorInfo.tsx b/src/components/lora/LoraCreatorInfo.tsx
index 2b2fdea..669772a 100644
--- a/src/components/lora/LoraCreatorInfo.tsx
+++ b/src/components/lora/LoraCreatorInfo.tsx
@@ -88,7 +88,7 @@ const LoraCreatorInfo: React.FC<LoraCreatorInfoProps> = ({
     // Display linked avatar and name if profile exists
     const displayName = creatorProfile.display_name || creatorProfile.username;
     const fallbackChar = displayName[0].toUpperCase();
-    const profilePath = `/profile/${encodeURIComponent(displayName)}`;
+    const profilePath = `/profile/${encodeURIComponent(creatorProfile.username)}`;
 
     return (
       <Link
```
