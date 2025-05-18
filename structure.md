# Project Directory Structure

This document outlines the directory structure of the openmuse` project, providing a brief overview of the purpose of each major file and folder.

## Database Tables

### assets (Updated)
- Stores metadata for various asset types (LoRAs, Workflows, etc.).
- Columns include:
  - id (UUID, primary key)
  - user_id (UUID, foreign key to auth.users)
  - curator_id (UUID, foreign key to auth.users, optional)
  - name (TEXT)
  - description (TEXT)
  - type (VARCHAR, e.g., 'lora', 'workflow')
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)
  - admin_status (VARCHAR)
  - user_status (VARCHAR) - User's preference for display (Pinned, Listed, Hidden)
  - admin_reviewed (BOOLEAN)
  - primary_media_id (UUID, foreign key to media table)
  - download_link (TEXT, URL to the asset file, e.g., LoRA model or workflow file in Supabase Storage)
  - lora_type (VARCHAR, LoRA specific)
  - lora_base_model (VARCHAR, LoRA specific)
  - model_variant (VARCHAR, LoRA specific)
  - lora_link (TEXT, LoRA specific, e.g., CivitAI or HuggingFace page)
- Row Level Security should be in place.

### api_keys
- Stores user API keys securely
- Columns:
  - id (UUID, primary key)
  - user_id (UUID, foreign key to auth.users)
  - service (VARCHAR, e.g., 'huggingface')
  - key_value (TEXT, encrypted API key)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)
- Row Level Security enabled
- Policies ensure users can only access their own API keys

### media
- Stores video and image metadata.
- Columns include:
  - id (UUID, primary key)
  - user_id (UUID, foreign key to auth.users)
  - title (TEXT)
  - description (TEXT)
  - type (VARCHAR, e.g., 'video', 'image')
  - url (TEXT, original Supabase Storage URL or external link if applicable; for Cloudflare, this might store the HLS URL as a primary playback URL)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)
  - classification (VARCHAR, e.g., 'art', 'gen')
  - metadata (JSONB, for additional metadata like aspect ratio, duration, etc.)
  - placeholder_image (TEXT, URL to a placeholder or thumbnail, may be Supabase or Cloudflare-derived)
  - admin_status (VARCHAR)
  - user_status (VARCHAR) - User's preference for display (Pinned, Listed, Hidden)
  - assetMediaDisplayStatus (VARCHAR) - Display status in context of an asset
  - storage_provider (VARCHAR) - Indicates storage location (e.g., 'supabase', 'cloudflare-stream', 'other')
  - cloudflare_stream_uid (TEXT) - Cloudflare Stream video unique identifier
  - cloudflare_thumbnail_url (TEXT) - Direct URL to Cloudflare-generated thumbnail
  - cloudflare_playback_hls_url (TEXT) - HLS manifest URL from Cloudflare Stream
  - cloudflare_playback_dash_url (TEXT) - DASH manifest URL from Cloudflare Stream
- Row Level Security should be in place.

### asset_media
- Links assets to media entries (e.g., example videos for a LoRA or Workflow).
- ... (columns as before) ...

## Supabase Storage Buckets (New Section)

### videos
- Stores uploaded video files (primarily for legacy videos; new uploads target Cloudflare Stream).
- Access policies managed via Supabase dashboard.

### thumbnails
- Stores generated video thumbnails (primarily for legacy videos; new uploads use Cloudflare-generated thumbnails).
- Access policies managed via Supabase dashboard.

### workflows
- Stores uploaded workflow files (e.g., JSON, ZIP).
- Access policies should allow authenticated users to upload and provide public/signed URLs for download.

## Edge Functions

### huggingface-upload
- Handles secure uploads to Hugging Face
- Uses stored API keys from the api_keys table
- Handles file uploads, README generation, and repository management
- Requires authentication
- Returns the URL of the uploaded LoRA file

### get-cloudflare-video-upload-url
- Handles generating a direct creator upload URL for Cloudflare Stream.
- Invoked by the client-side `videoUploadService.ts`.
- Uses Cloudflare API Token and Account ID (environment variables).
- Calls Cloudflare API to create a video object and returns a one-time TUS upload URL and the video UID.
- CORS headers are handled directly within the function.
- Requires authentication.

### profile-og-image
- Edge function specifically for generating OpenGraph images for profiles

## Components Updates

### LoraCard.tsx
- Enhanced to allow admins to change asset admin_status directly from the card UI
- Added dropdown menu with options for Featured, Curated, Listed, Hidden, and Rejected statuses
- Added admin status badge to visually indicate current status
- Includes loading indicators during status changes

### useLoraManagement.tsx
- Added setLoraAdminStatus function to allow changing admin status of LoRA assets
- Includes admin permission checking and optimistic UI updates
- Returns updated hook with new functionality exposed

### SproutingCursorCanvas.tsx
- Full-screen decorative canvas that renders sprouting cursor/branch effect across the entire app

## Developer Tools / Staging Features

### Role-Switching Mode (Staging/Development)
- Allows developers to simulate viewing the application as different user types.
- Activated when the Vite `MODE` is set to 'staging' (e.g., via `vite --mode staging`).
- Provides a UI dropdown (`RoleSwitcher.tsx`) to select roles.
- Roles include: Logged out, Logged in, Admin.
- On profile or LoRA asset pages, an additional "View as Owner" option appears, simulating ownership of that specific item.
- Core logic is managed by `MockRoleContext.tsx` and integrated into `AuthProvider.tsx`.

```
.
├── .git/                   # Git version control directory
├── .cursorrules            # Cursor IDE specific rules and configurations
├── .gitignore              # Specifies intentionally untracked files that Git should ignore
├── bun.lockb               # Lockfile for bun package manager, ensuring reproducible installs
├── components.json         # Configuration for shadcn/ui components
├── eslint.config.js        # Configuration file for ESLint JavaScript/TypeScript linter
├── fetch_auth_files.py     # Python script potentially used for fetching authentication related files or setup
├── index.html              # Main HTML entry point for the Vite application
├── node_modules/           # Directory containing project dependencies installed by npm/yarn/bun (typically excluded)
├── package.json            # Defines project metadata, dependencies, and scripts. `dev` script updated to run in 'staging' mode for role-switching.
├── package-lock.json       # Lockfile for npm, ensuring reproducible installs (may be redundant if using bun)
├── postcss.config.js       # Configuration file for PostCSS processor (used with Tailwind)
├── public/                 # Static assets served directly by the web server
│   ├── first_frame.png     # Poster frame for the manifesto page video
│   ├── the_creation.mp4    # Video used on the manifesto page
│   ├── placeholder.svg     # Placeholder image asset
│   └── lovable-uploads/    # Directory likely containing user-uploaded or sample assets
│       ├── *.png           # Example uploaded image files
├── README.md               # Project overview, setup instructions, and general information
├── src/                    # Main application source code directory
│   ├── App.css             # Legacy or global CSS styles for the application
│   ├── App.tsx             # Root React component, sets up routing and providers
│   ├── components/         # Reusable React UI components
│   │   ├── common/         # General-purpose shared components
│   │   │   └── DummyCard.tsx # A placeholder or example card component
│   │   │   └── RoleSwitcher.tsx # UI component for selecting mock user roles in staging/dev mode. Appears when `import.meta.env.MODE` is 'staging'.
│   │   ├── **asset/**      # **NEW/UPDATED: Components related to any asset type**
│   │   │   ├── **AssetCard.tsx**       # **Card component to display any asset**
│   │   │   ├── **AssetCreatorInfo.tsx**# **Displays creator info for an asset**
│   │   │   ├── **EditableAssetDetails.tsx** # **Form for editing asset details**
│   │   │   └── **AssetInfoCard.tsx** # **Card displaying detailed information about the asset**
│   │   ├── lora/           # Components specifically for LoRA (some might be deprecated/merged into asset/)
│   │   │   ├── AddLoRAModal.tsx # Modal dialog for adding new LoRA assets
│   │   │   ├── EditableLoraDescription.tsx # Potentially merged into EditableAssetDetails
│   │   │   ├── LoRAVideoUploader.tsx # Component specifically for uploading videos related to LoRA assets
│   │   │   ├── LoraCardSkeleton.tsx # Could become AssetGallerySkeleton
│   │   │   ├── LoraFilters.tsx # Components for filtering LoRA assets
│   │   │   └── LoraList.tsx    # Replaced by AssetManager using AssetCard
│   │   ├── ui/             # Base UI components (likely from shadcn/ui library)
│   │   │   ├── accordion.tsx # Accordion component
│   │   │   ├── alert-dialog.tsx # Alert dialog component
│   │   │   ├── alert.tsx       # Alert message component
│   │   │   ├── aspect-ratio.tsx # Aspect ratio container component
│   │   │   ├── avatar.tsx      # Avatar display component
│   │   │   ├── badge.tsx       # Badge component
│   │   │   ├── breadcrumb.tsx  # Breadcrumb navigation component
│   │   │   ├── button.tsx      # Button component
│   │   │   ├── calendar.tsx    # Calendar component
│   │   │   ├── card.tsx        # Card layout component
│   │   │   ├── carousel.tsx    # Carousel component
│   │   │   ├── chart.tsx       # Charting component wrapper
│   │   │   ├── checkbox.tsx    # Checkbox component
│   │   │   ├── collapsible.tsx # Collapsible content component
│   │   │   ├── command.tsx     # Command palette component
│   │   │   ├── context-menu.tsx # Context menu component
│   │   │   ├── dialog.tsx      # Dialog/modal component
│   │   │   ├── drawer.tsx      # Drawer component (sliding panel)
│   │   │   ├── dropdown-menu.tsx # Dropdown menu component
│   │   │   ├── form.tsx        # Form handling components and hooks
│   │   │   ├── hover-card.tsx  # Hover card component
│   │   │   ├── input-otp.tsx   # One-time password input component
│   │   │   ├── input.tsx       # Input field component
│   │   │   ├── label.tsx       # Form label component
│   │   │   ├── menubar.tsx     # Menu bar component
│   │   │   ├── navigation-menu.tsx # Navigation menu component
│   │   │   ├── pagination.tsx  # Pagination control component
│   │   │   ├── popover.tsx     # Popover component
│   │   │   ├── progress.tsx    # Progress bar component
│   │   │   ├── radio-group.tsx # Radio button group component
│   │   │   ├── resizable.tsx   # Resizable panel component
│   │   │   ├── scroll-area.tsx # Scrollable area component
│   │   │   ├── select.tsx      # Select dropdown component
│   │   │   ├── separator.tsx   # Separator line component
│   │   │   ├── sheet.tsx       # Sheet component (similar to drawer/dialog)
│   │   │   ├── sidebar.tsx     # Sidebar component (potentially custom or complex)
│   │   │   ├── skeleton.tsx    # Skeleton loading placeholder component
│   │   │   ├── slider.tsx      # Slider component
│   │   │   ├── sonner.tsx      # Wrapper/integration for Sonner (toast notifications)
│   │   │   ├── switch.tsx      # Switch toggle component
│   │   │   ├── table.tsx       # Table component
│   │   │   ├── tabs.tsx        # Tabs component
│   │   │   ├── textarea.tsx    # Textarea component
│   │   │   ├── toast.tsx       # Toast notification display component
│   │   │   ├── toaster.tsx     # Toaster container for managing toasts
│   │   │   ├── toggle-group.tsx # Group of toggle buttons
│   │   │   ├── toggle.tsx      # Single toggle button
│   │   │   ├── tooltip.tsx     # Tooltip component
│   │   │   ├── use-toast.ts    # Hook for using the toast system (shadcn/ui specific)
│   │   │   └── visually-hidden.tsx # Component for visually hiding elements accessibly
│   │   ├── upload/         # Components specifically for the upload process
│   │   │   ├── GlobalLoRADetailsForm.tsx # Potentially replaced by AssetDetailsForm logic within UploadPage
│   │   │   ├── LoraMultiSelectCombobox.tsx # Combobox for selecting multiple LoRAs
│   │   │   ├── UploadContent.tsx # Main content area for the upload page/modal
│   │   │   ├── VideoDropzone.tsx # Drag-and-drop area for uploading videos
│   │   │   └── VideoMetadataForm.tsx # Form for entering video metadata during upload
│   │   ├── video/          # Components related to video display and interaction
│   │   │   ├── EmbeddedVideoPlayer.tsx # Player specifically for embedding videos
│   │   │   ├── LazyPosterImage.tsx # Image component that lazy-loads video posters
│   │   │   ├── StandardVideoPreview.tsx # A standard component for video previews
│   │   │   ├── VideoCard.tsx   # Card component for displaying video information and preview
│   │   │   ├── VideoError.tsx  # Component to display when there's a video loading error
│   │   │   ├── VideoGrid.tsx   # Grid layout component for displaying videos, replacing Masonry
│   │   │   ├── VideoLoader.tsx # Loading indicator specifically for videos
│   │   │   ├── VideoOverlay.tsx # Overlay content/controls for videos
│   │   │   ├── VideoPaginatedGrid.tsx # Grid layout for videos with pagination
│   │   │   ├── VideoGallerySection.tsx # Section component for curated video galleries
│   │   │   ├── VideoPlayer.tsx # Core video player component
│   │   │   ├── VideoPreviewError.tsx # Component to display errors specifically in video previews
│   │   │   ├── VideoStatusControls.tsx # Controls related to the status of a video (e.g., processing, published)
│   │   │   └── VideoThumbnailGenerator.tsx # Component or utility to generate video thumbnails
│   │   ├── AuthButton.tsx  # Component for handling user authentication display/actions (login/logout/profile link)
│   │   ├── ConsentDialog.tsx # Component for managing user consent (e.g., cookies, terms)
│   │   ├── EmptyState.tsx  # Component to display when a list or area has no content
│   │   ├── LoadingState.tsx # Generic component to display during loading operations
│   │   ├── LoraGallerySkeleton.tsx # Skeleton loader specifically for the LoRA gallery view
│   │   ├── LoraManager.tsx # High-level component for managing LoRA assets (viewing, filtering, etc.)
│   │   ├── Navigation.tsx  # Main application navigation bar or menu
│   │   ├── PageHeader.tsx  # Standard header component for application pages
│   │   ├── PrimaryVideoSorter.tsx # Component specifically for sorting primary videos
│   │   ├── RequireAuth.tsx # Higher-order component or wrapper to protect routes requiring user authentication
│   │   ├── StorageSettings.tsx # Component for configuring storage options (e.g., Supabase bucket details)
│   │   ├── StorageVideoPlayer.tsx # Video player component likely integrated directly with Supabase Storage
│   │   ├── UserProfileSettings.tsx # Component containing forms/controls for editing user profile information
│   │   ├── VideoFilter.tsx # Component providing options to filter the list of videos
│   │   ├── VideoLightbox.tsx # Component for displaying videos in a modal overlay (lightbox)
│   │   ├── VideoList.tsx   # Component for displaying a list or grid of videos
│   │   ├── VideoManager.tsx # High-level component for managing video assets
│   │   ├── VideoPreview.tsx # Component for showing a preview of a video (potentially distinct from VideoCard)
│   │   └── WebcamRecorder.tsx # Component for recording video directly from the user's webcam
│   │   └── ErrorBoundary.tsx # Catches React errors in its child component tree and displays a fallback UI
│   │   └── UserProfilePage.tsx # Updated to show LoRAs and Workflows
│   ├── contexts/           # React Context definitions for global state management
│   │   ├── AuthContext.tsx # Context specifically for providing authentication state (user, session) and functions
│   │   └── MockRoleContext.tsx # Context for managing the currently selected mock role, owner ID for simulation, and staging status.
│   ├── hooks/              # Custom React hooks for encapsulating reusable stateful logic
│   │   ├── use-mobile.tsx  # Hook to detect if the application is being viewed on a mobile device
│   │   ├── use-toast.ts    # Hook for programmatically triggering UI notifications (toasts) - likely related to `sonner` or `react-hot-toast` via shadcn/ui
│   │   ├── useAuth.tsx     # Hook providing easy access to the AuthContext values
│   │   ├── useDebouncedValue.ts # Hook to debounce a value over a specified delay
│   │   ├── useLoraManagement.tsx # Hook encapsulating logic for fetching, creating, updating, and deleting LoRA assets
│   │   ├── usePersistentToggle.ts # Hook for managing persistent toggle state ('all' or 'curated') using localStorage
│   │   ├── useVideoHover.ts # Hook for handling hover interactions on video elements (e.g., showing controls, preview)
│   │   ├── useVideoLoader.ts # Hook for managing the loading state and data fetching for videos
│   │   ├── useVideoManagement.tsx # Hook encapsulating logic for managing video assets (fetching, uploading, metadata, etc.)
│   │   └── useVideoPlayback.ts # Hook for controlling video playback state (play, pause, seek)
│   │   ├── **useAssetManagement.tsx** # **Generalized from useLoraManagement.tsx**
│   │   └── **useAssetManagement.tsx** # **Generalized from useLoraManagement.tsx**
│   ├── index.css           # Global CSS styles, likely includes Tailwind CSS base, components, and utilities directives
│   ├── integrations/       # Code dedicated to integrating with external services
│   │   └── supabase/       # Modules specifically for interacting with Supabase
│   │       ├── client.ts       # Supabase client initialization and configuration
│   │       ├── database.types.ts # TypeScript types generated from the Supabase database schema
│   │       └── types.ts        # Additional Supabase-related type definitions (Updated with AnyAsset, BaseAsset, WorkflowAsset)
│   ├── lib/                # Utility functions, helper modules, and shared logic not tied to UI
│   │   ├── auth/           # Utilities specifically related to authentication logic
│   │   │   ├── authMethods.ts  # Functions for specific auth actions (e.g., login, logout, signup)
│   │   │   ├── cache.ts        # Caching mechanisms related to authentication/user data
│   │   │   ├── currentUser.ts  # Utilities for getting or managing the current user's data
│   │   │   ├── index.ts        # Barrel file exporting auth utilities
│   │   │   ├── userProfile.ts  # Functions for fetching/updating user profile data
│   │   │   └── userRoles.ts    # Utilities related to user roles and permissions
│   │   ├── database/       # Abstraction layer and utilities for database interactions
│   │   │   ├── BaseDatabase.ts # Base class or interface for database operations
│   │   │   ├── DatabaseProvider.ts # Provider component that manages database access with optimized session handling, caching, and timeout management (v1.2.0)
│   │   │   ├── SupabaseDatabase.ts # Supabase-specific implementation of database operations
│   │   │   ├── SupabaseDatabaseOperations.ts # Detailed Supabase database operations (CRUD)
│   │   │   └── index.ts        # Barrel file exporting database utilities
│   │   ├── services/       # Modules acting as clients for backend APIs or specific data operations
│   │   │   ├── assetService.ts # Service for managing general assets (CRUD operations)
│   │   │   ├── thumbnailService.ts # Service specifically for handling video thumbnails
│   │   │   ├── videoEntryService.ts # Service for managing video entry records in the database
│   │   │   ├── videoUploadService.ts # **Manages video upload process. For new uploads, orchestrates calls to the `get-cloudflare-video-upload-url` Edge Function and uses `tus-js-client` to upload directly to Cloudflare Stream. Handles creation of `media` table entries with Cloudflare-specific URLs and UIDs.**
│   │   │   └── videoUrlService.ts # Service for generating or managing video URLs (e.g., signed URLs for Supabase)
│   │   ├── utils/          # General, reusable utility functions
│   │   │   ├── videoPreviewUtils.ts # Utilities specifically for video previews
│   │   │   └── videoUtils.ts   # General utility functions related to video processing or manipulation
│   │   ├── csvUtils.ts     # Utility functions for parsing or generating CSV data
│   │   ├── databaseSwitcher.ts # Utility potentially allowing switching between different database backends or configurations (e.g., local vs. remote)
│   │   ├── db.ts           # Core database client setup or a simplified abstraction layer
│   │   ├── logger.ts       # Configuration and setup for application logging
│   │   ├── migrationUtil.ts # Utility functions to assist with database migrations
│   │   ├── remoteStorage.ts # Abstraction layer for interacting with remote file storage (e.g., Supabase Storage)
│   │   ├── storage.ts      # General storage utility functions (could encompass local storage, session storage, or remote storage)
│   │   ├── supabase.ts     # Supabase client instance initialization
│   │   ├── supabaseDB.ts   # Supabase database specific helper functions or constants
│   │   ├── supabaseStorage.ts # Supabase Storage specific helper functions (upload, download, get URL) - Usage may decrease with Cloudflare Stream.
│   │   ├── types.ts        # Shared TypeScript type definitions used across the application (Updated with Cloudflare fields in VideoEntry/VideoMetadata)
│   │   └── utils.ts        # General utility functions, often includes things like `cn` for class name merging (Tailwind)
│   ├── main.tsx            # Main entry point of the React application, responsible for rendering the root component (`App`) into the DOM
│   ├── pages/              # Page-level components, typically corresponding to application routes
│   │   ├── AssetDetailPage/ # Updated to handle AnyAsset (LoRAs and Workflows)
│   │   │   ├── components/   # Sub-components used only within the AssetDetailPage
│   │   │   │   ├── AssetHeader.tsx # Updated for AnyAsset
│   │   │   │   ├── AssetInfoCard.tsx # Updated for AnyAsset, conditional display
│   │   │   │   └── AssetVideoSection.tsx # Updated for AnyAsset
│   │   │   ├── hooks/        # Hooks used specifically by the AssetDetailPage
│   │   │   │   ├── useAssetAdminActions.tsx # Hook for administrative actions on an asset
│   │   │   │   └── useAssetDetails.tsx # Updated to fetch and return AnyAsset
│   │   │   ├── AssetDetailPage.tsx # Updated to use AnyAsset
│   │   │   └── index.tsx     # Barrel file exporting the AssetDetailPage component
│   │   ├── VideoPage/      # Components specifically for the individual video page route
│   │   │   ├── components/   # Sub-components used only within the VideoPage
│   │   │   │   ├── RelatedVideos.tsx # Section displaying related videos
│   │   │   │   ├── VideoDetails.tsx # Section displaying details about the video
│   │   │   │   └── VideoPlayerCard.tsx # Card containing the video player for the main video
│   │   │   ├── VideoPage.tsx # Main component for the individual video page (likely different from the file with the same name at the parent level)
│   │   │   └── index.tsx     # Barrel file exporting the VideoPage component
│   │   ├── upload/         # Components related to the file/video upload page route
│   │   │   ├── components/   # Sub-components used only within the UploadPage
│   │   │   │   ├── AssetDetailsForm.tsx # **NEW: Form for common asset details, conditional for LoRA/Workflow**
│   │   │   │   ├── MultipleVideoUploader.tsx # Component for handling multiple video uploads simultaneously
│   │   │   │   └── index.ts    # Barrel file exporting upload page components
│   │   │   ├── UploadPage.tsx # Updated to support 'workflow' upload mode
│   │   │   └── index.ts      # Barrel file exporting the UploadPage component
│   │   ├── Updated navigation logic to return to the previous location after successful submission.
│   │   ├── Admin.tsx       # Component for the administrative dashboard page
│   │   ├── Auth.tsx        # Component handling the user authentication flow (login/signup forms)
│   │   ├── AuthCallback.tsx # Component that handles the redirect callback from an external OAuth provider (like Supabase Auth)
│   │   ├── Index.tsx       # Updated to display LoRAs and Workflows using AssetManager
│   │   ├── Manifesto.tsx   # Component likely displaying a project manifesto, mission statement, or about text
│   │   ├── NotFound.tsx    # Component displayed when a route is not found (404 page)
│   │   ├── UserProfilePage.tsx # Updated to display LoRAs and Workflows using AssetManager
│   │   ├── ArtPage.tsx     # Component for browsing curated art videos
│   │   ├── GenerationsPage.tsx # Component listing generation videos created by users
│   │   ├── LorasPage.tsx   # This page might become a more generic AssetsPage or have a sibling WorkflowsPage
│   │   └── **WorkflowsPage.tsx (Potential New Page)** # Page for listing all workflows
│   ├── providers/          # React Context Provider components
│   │   └── AuthProvider.tsx # Provider component supplying auth context. Enhanced to provide mocked auth states (user, session, isAdmin, isLoading) and no-op auth functions when a mock role is active in staging mode.
│   └── vite-env.d.ts       # TypeScript definition file for environment variables exposed by Vite
├── supabase/               # Configuration and assets related to the Supabase backend-as-a-service platform
│   ├── config.toml         # Main configuration file for the Supabase project (used by Supabase CLI)
│   ├── import_map.json     # **NEW: Deno import map for resolving module paths in Edge Functions**
│   ├── functions/          # Directory containing code for Supabase Edge Functions (serverless functions)
│   │   ├── _shared/        # **NEW: Shared utility modules for Edge Functions**
│   │   │   └── cors.ts     # **NEW: Shared CORS header configuration**
│   │   ├── get-cloudflare-video-upload-url/ # **NEW: Edge Function for Cloudflare video uploads**
│   │   │   └── index.ts    # **NEW: Entry point for the get-cloudflare-video-upload-url Edge Function**
│   │   └── profile-og-image/ # Edge function specifically for generating OpenGraph images for profiles
│   │       └── index.ts    # Entry point for the profile-og-image Edge Function
│   └── migrations/         # Directory containing SQL files for database schema migrations managed by Supabase CLI
│       └── *.sql           # SQL migration files defining database schema changes
├── tailwind.config.ts      # Configuration file for the Tailwind CSS framework (defining theme, plugins, content sources)
├── tasks.md                # Markdown file potentially used for tracking development tasks, notes, or a to-do list
├── tsconfig.app.json       # TypeScript configuration specifically for building the application source code (`src`)
├── tsconfig.json           # Root TypeScript configuration file, often extended by other tsconfig files
├── tsconfig.node.json      # TypeScript configuration for Node.js environments (e.g., for Vite config, scripts)
└── vite.config.ts          # Configuration file for the Vite build tool (defining plugins, server options, build settings)