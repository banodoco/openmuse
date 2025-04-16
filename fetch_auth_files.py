import os

# List of files to fetch
AUTH_FILES = [
    'src/integrations/supabase/client.ts',
    'src/contexts/AuthContext.tsx',
    'src/providers/AuthProvider.tsx',
    'src/hooks/useAuth.tsx',
    'src/lib/auth/authMethods.ts',
    'src/lib/auth/currentUser.ts',
    'src/lib/auth/userProfile.ts',
    'src/components/RequireAuth.tsx',
    'src/components/AuthButton.tsx',
    'src/pages/Auth.tsx',
    'src/pages/AuthCallback.tsx'
]

# Authentication usage details for each page with code snippets
PAGE_AUTH_DETAILS = {
    "Home Page (/)": """
- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user and loading state:
  ```typescript
  const { user, isLoading: authLoading } = useAuth();
  ```
- Checks permissions based on user state:
  ```typescript
  useEffect(() => {
    if (authLoading) return;
    const checkPermissions = async () => {
      if (user && !permissionsChecked /*...*/) {
        // ... permission checking logic using user.id ...
      }
    };
    checkPermissions();
  }, [user, permissionsChecked, authLoading]);
  ```
- Displays `AuthButton` in `Navigation`, which uses `useAuth`.
- Disables 'Propose New LoRA' button based on `authLoading`:
  ```typescript
  <PageHeader 
    // ...
    buttonDisabled={lorasLoading || authLoading}
  />
  ```
""",
    "Auth Page (/auth)": """
- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user, session, and loading state:
  ```typescript
  const { user, session, isLoading: isAuthLoading } = useAuth();
  ```
- Redirects authenticated users:
  ```typescript
  useEffect(() => {
    if (!isAuthLoading && user && session && !redirecting) {
      const returnUrl = /*... get returnUrl ...*/;
      navigate(returnUrl, { replace: true });
    }
  }, [user, session, isAuthLoading, /* ... */]);
  ```
- Handles Discord sign-in action:
  ```typescript
  import { signInWithDiscord } from '@/lib/auth';
  // ...
  const handleDiscordSignIn = async () => {
    await signInWithDiscord();
  };
  ```
- Shows loading state:
  ```typescript
  if (isAuthLoading || redirecting) {
    return ( /* ... loading UI ... */ );
  }
  ```
""",
    "Auth Callback Page (/auth/callback)": """
- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user and loading state:
  ```typescript
  const { user, isLoading: isAuthLoading } = useAuth();
  ```
- Redirects after successful authentication verification:
  ```typescript
  useEffect(() => {
    if (isAuthLoading || !isProcessing) return;
    if (user) {
      const returnUrl = /*... get returnUrl ...*/;
      navigate(returnUrl, { replace: true });
    } else {
      // Handle case where AuthProvider finishes loading but no user is found
      setError(/*...*/);
    }
  }, [user, isAuthLoading, /* ... */]);
  ```
- Shows error state if authentication times out or fails:
  ```typescript
  {error ? (
    <div className="text-center space-y-4">
      {/* ... Error Message ... */}
    </div>
  ) : (
    /* ... Loading Spinner ... */
  )}
  ```
""",
    "Profile Page (/profile)": """
- Imports `RequireAuth` component:
  ```typescript
  import RequireAuth from '@/components/RequireAuth';
  ```
- Wraps the entire page content with `RequireAuth` to enforce authentication:
  ```typescript
  export default function ProfilePage() {
    return (
      <RequireAuth>
        <div className="min-h-screen flex flex-col bg-background">
          <Navigation />
          <main {/* ... */}>
            {/* ... Profile settings content ... */}
            <UserProfileSettings />
          </main>
          <Footer />
        </div>
      </RequireAuth>
    );
  }
  ```
- The `UserProfileSettings` component likely uses `useAuth` or related hooks internally to fetch and update profile data for the authenticated user.
""",
    "Upload Page (/upload)": """
- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user state:
  ```typescript
  const { user } = useAuth();
  ```
- Shows a prompt and disables the form if the user is not authenticated:
  ```typescript
  {!user && (
    <Alert className="mb-8 /*...*/">
      <AlertTitle>You must be signed in to submit videos.</AlertTitle>
      <AlertDescription>
        Please <Link to="/auth">sign in</Link> to access all features...
      </AlertDescription>
    </Alert>
  )}
  // ...
  <LoRADetailsForm disabled={!user} />
  <MultipleVideoUploader disabled={!user} />
  <Button type="submit" disabled={isSubmitting || !user}>...</Button>
  ```
- Requires authentication check before submitting the form:
  ```typescript
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast.error('You must be signed in to submit videos');
      navigate('/auth');
      return;
    }
    // ... rest of submission logic using user.id or user.email ...
    await submitVideos(videos, loraDetails, reviewerName, user);
  };
  ```
""",
    "Admin Page (/admin)": """
- Imports `RequireAuth` component:
  ```typescript
  import RequireAuth from '@/components/RequireAuth';
  ```
- Wraps the entire page content with `RequireAuth`, requiring admin privileges:
  ```typescript
  return (
    <RequireAuth requireAdmin>
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="container py-8 px-4 flex-1">
          {/* ... Admin dashboard content ... */}
        </main>
      </div>
    </RequireAuth>
  );
  ```
- Note: `useAuth` is not used *directly* within `Admin.tsx`, but access control is handled by the `RequireAuth` wrapper which uses the hook internally.
""",
    "Video Page (/videos/:id)": """
- Authentication state is primarily managed by the `Navigation` component (via `AuthButton`), which uses `useAuth`.
- This page itself does not appear to directly use the `useAuth` hook or gate content based on authentication status in the main component logic.
- Actions like editing or deleting might be present in child components or added later, potentially requiring authentication checks.
""",
    "Asset Detail Page (/assets/:id)": """
- Imports `useAuth` hook:
  ```typescript
  import { useAuth } from '@/hooks/useAuth';
  ```
- Gets user and admin status:
  ```typescript
  const { user, isAdmin } = useAuth();
  ```
- Passes `isAdmin` status to child components for conditional rendering/actions:
  ```typescript
  <AssetInfoCard 
    /* ... */
    isAdmin={isAdmin}
    /* ... */
  />
  <AssetVideoSection 
    /* ... */
    isAdmin={isAdmin}
    /* ... */
  />
  ```
- Admin actions (like `handleCurateAsset`) are available, implicitly gated by the `isAdmin` check passed to child components.
- Video upload functionality (within `AssetVideoSection` -> `LoRAVideoUploader`) requires the user to be logged in:
  ```typescript
  // Inside LoRAVideoUploader component used by AssetVideoSection
  const { user } = useAuth();
  // ... checks if user exists before allowing upload actions ...
  ```
"""
}

def read_file_content(filepath):
    """Read and return the content of a file"""
    try:
        with open(filepath, 'r') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file {filepath}: {str(e)}"

def generate_markdown():
    """Generate markdown content with all auth-related files"""
    markdown_content = ["# Authentication Files Documentation\n"]
    
    # Add overview
    markdown_content.append("""## Overview
This document contains all the authentication-related files from the codebase.
Each file is documented with its full content for reference.\n""")

    # Add page authentication details
    markdown_content.append("## Page Authentication Usage\n")
    for page, details in PAGE_AUTH_DETAILS.items():
        markdown_content.append(f"### {page}\n{details}\n")
    
    # Process each file
    markdown_content.append("## Authentication Files\n")
    for filepath in AUTH_FILES:
        # Add file header
        markdown_content.append(f"### {filepath}\n")
        markdown_content.append("```typescript")
        
        # Add file content
        content = read_file_content(filepath)
        markdown_content.append(content)
        
        # Close code block
        markdown_content.append("```\n")
    
    return "\n".join(markdown_content)

def main():
    """Main function to generate and save the markdown file"""
    # Generate markdown content
    content = generate_markdown()
    
    # Save to file
    output_file = "auth-files-documentation.md"
    with open(output_file, 'w') as f:
        f.write(content)
    
    print(f"Documentation has been saved to {output_file}")

if __name__ == "__main__":
    main() 