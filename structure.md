# Project Directory Structure

This document outlines the directory structure of the openmuse` project, providing a brief overview of the purpose of each major file and folder.

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
├── package.json            # Defines project metadata, dependencies, and scripts
├── package-lock.json       # Lockfile for npm, ensuring reproducible installs (may be redundant if using bun)
├── postcss.config.js       # Configuration file for PostCSS processor (used with Tailwind)
├── public/                 # Static assets served directly by the web server
│   ├── favicon.ico         # Application icon displayed in browser tabs
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
│   │   ├── lora/           # Components related to LoRA asset management/display
│   │   │   ├── AddLoRAModal.tsx # Modal dialog for adding new LoRA assets
│   │   │   ├── EditableLoraDescription.tsx # Component for editing LoRA descriptions
│   │   │   ├── EditableLoraDetails.tsx # Component for editing detailed LoRA information
│   │   │   ├── LoRAVideoUploader.tsx # Component specifically for uploading videos related to LoRA assets
│   │   │   ├── LoraCard.tsx    # Card component to display LoRA asset information
│   │   │   ├── LoraCardSkeleton.tsx # Skeleton loader for the LoRA card
│   │   │   ├── LoraCreatorInfo.tsx # Component displaying information about the LoRA creator
│   │   │   ├── LoraFilters.tsx # Components for filtering LoRA assets
│   │   │   └── LoraList.tsx    # Component to display a list of LoRA assets
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
│   │   │   ├── GlobalLoRADetailsForm.tsx # Form for LoRA details, possibly in a global context
│   │   │   ├── LoRADetailsForm.tsx # Form specific to LoRA asset details during upload
│   │   │   ├── LoraMultiSelectCombobox.tsx # Combobox for selecting multiple LoRAs
│   │   │   ├── UploadContent.tsx # Main content area for the upload page/modal
│   │   │   ├── UploadModal.tsx # Modal dialog for the upload process
│   │   │   ├── VideoDropzone.tsx # Drag-and-drop area for uploading videos
│   │   │   └── VideoMetadataForm.tsx # Form for entering video metadata during upload
│   │   ├── video/          # Components related to video display and interaction
│   │   │   ├── EmbeddedVideoPlayer.tsx # Player specifically for embedding videos
│   │   │   ├── LazyPosterImage.tsx # Image component that lazy-loads video posters
│   │   │   ├── StandardVideoPreview.tsx # A standard component for video previews
│   │   │   ├── VideoCard.tsx   # Card component for displaying video information and preview
│   │   │   ├── VideoError.tsx  # Component to display when there's a video loading error
│   │   │   ├── VideoLoader.tsx # Loading indicator specifically for videos
│   │   │   ├── VideoOverlay.tsx # Overlay content/controls for videos
│   │   │   ├── VideoPaginatedGrid.tsx # Grid layout for videos with pagination
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
│   ├── contexts/           # React Context definitions for global state management
│   │   └── AuthContext.tsx # Context specifically for providing authentication state (user, session) and functions
│   ├── hooks/              # Custom React hooks for encapsulating reusable stateful logic
│   │   ├── use-mobile.tsx  # Hook to detect if the application is being viewed on a mobile device
│   │   ├── use-toast.ts    # Hook for programmatically triggering UI notifications (toasts) - likely related to `sonner` or `react-hot-toast` via shadcn/ui
│   │   ├── useAuth.tsx     # Hook providing easy access to the AuthContext values
│   │   ├── useLoraManagement.tsx # Hook encapsulating logic for fetching, creating, updating, and deleting LoRA assets
│   │   ├── useVideoHover.ts # Hook for handling hover interactions on video elements (e.g., showing controls, preview)
│   │   ├── useVideoLoader.ts # Hook for managing the loading state and data fetching for videos
│   │   ├── useVideoManagement.tsx # Hook encapsulating logic for managing video assets (fetching, uploading, metadata, etc.)
│   │   └── useVideoPlayback.ts # Hook for controlling video playback state (play, pause, seek)
│   ├── index.css           # Global CSS styles, likely includes Tailwind CSS base, components, and utilities directives
│   ├── integrations/       # Code dedicated to integrating with external services
│   │   └── supabase/       # Modules specifically for interacting with Supabase
│   │       ├── client.ts       # Supabase client initialization and configuration
│   │       ├── database.types.ts # TypeScript types generated from the Supabase database schema
│   │       └── types.ts        # Additional Supabase-related type definitions
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
│   │   │   ├── DatabaseProvider.ts # React component or setup for providing database access, potentially context-based
│   │   │   ├── SupabaseDatabase.ts # Supabase-specific implementation of database operations
│   │   │   ├── SupabaseDatabaseOperations.ts # Detailed Supabase database operations (CRUD)
│   │   │   └── index.ts        # Barrel file exporting database utilities
│   │   ├── services/       # Modules acting as clients for backend APIs or specific data operations
│   │   │   ├── assetService.ts # Service for managing general assets (CRUD operations)
│   │   │   ├── thumbnailService.ts # Service specifically for handling video thumbnails
│   │   │   ├── videoEntryService.ts # Service for managing video entry records in the database
│   │   │   ├── videoUploadService.ts # Service handling the logic of video upload processing
│   │   │   └── videoUrlService.ts # Service for generating or managing video URLs (e.g., signed URLs)
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
│   │   ├── supabaseStorage.ts # Supabase Storage specific helper functions (upload, download, get URL)
│   │   ├── types.ts        # Shared TypeScript type definitions used across the application
│   │   └── utils.ts        # General utility functions, often includes things like `cn` for class name merging (Tailwind)
│   ├── main.tsx            # Main entry point of the React application, responsible for rendering the root component (`App`) into the DOM
│   ├── pages/              # Page-level components, typically corresponding to application routes
│   │   ├── AssetDetailPage/ # Components specifically for the asset detail page route
│   │   │   ├── components/   # Sub-components used only within the AssetDetailPage
│   │   │   │   ├── AssetHeader.tsx # Header section for the asset detail page
│   │   │   │   ├── AssetInfoCard.tsx # Card displaying detailed information about the asset
│   │   │   │   └── AssetVideoSection.tsx # Section displaying videos related to the asset
│   │   │   ├── hooks/        # Hooks used specifically by the AssetDetailPage
│   │   │   │   ├── useAssetAdminActions.tsx # Hook for administrative actions on an asset
│   │   │   │   └── useAssetDetails.tsx # Hook for fetching and managing asset details
│   │   │   ├── AssetDetailPage.tsx # Main component for the asset detail page
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
│   │   │   │   ├── LoRADetailsForm.tsx # Reusable form for LoRA details within upload context
│   │   │   │   ├── MultipleVideoUploader.tsx # Component for handling multiple video uploads simultaneously
│   │   │   │   └── index.ts    # Barrel file exporting upload page components
│   │   │   ├── UploadPage.tsx # Main component for the upload page
│   │   │   └── index.ts      # Barrel file exporting the UploadPage component
│   │   ├── Admin.tsx       # Component for the administrative dashboard page
│   │   ├── Auth.tsx        # Component handling the user authentication flow (login/signup forms)
│   │   ├── AuthCallback.tsx # Component that handles the redirect callback from an external OAuth provider (like Supabase Auth)
│   │   ├── Index.tsx       # Component for the main landing page or home page of the application
│   │   ├── Manifesto.tsx   # Component likely displaying a project manifesto, mission statement, or about text
│   │   ├── NotFound.tsx    # Component displayed when a route is not found (404 page)
│   │   ├── UserProfilePage.tsx # Component for the user's profile page, allowing viewing and editing of profile information
│   │   └── VideoPage.tsx   # Component for displaying a specific video (potentially a list or gallery view, distinct from `VideoPage/VideoPage.tsx`)
│   ├── providers/          # React Context Provider components
│   │   └── AuthProvider.tsx # Provider component that wraps parts of the app to supply authentication context (user data, login/logout functions)
│   └── vite-env.d.ts       # TypeScript definition file for environment variables exposed by Vite
├── supabase/               # Configuration and assets related to the Supabase backend-as-a-service platform
│   ├── config.toml         # Main configuration file for the Supabase project (used by Supabase CLI)
│   ├── functions/          # Directory containing code for Supabase Edge Functions (serverless functions)
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
```
```