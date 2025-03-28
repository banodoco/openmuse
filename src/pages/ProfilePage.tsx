
import React from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import RequireAuth from '@/components/RequireAuth';

export default function ProfilePage() {
  const handleButtonClick = () => {
    // This is a placeholder function for the button click
    console.log('Profile settings button clicked');
  };

  return (
    <RequireAuth>
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
          <PageHeader
            title="Profile Settings"
            description="Manage your profile information"
            buttonText="Save Changes"
            onButtonClick={handleButtonClick}
          />
          <div className="max-w-2xl mx-auto">
            <UserProfileSettings />
          </div>
        </main>
        <Footer />
      </div>
    </RequireAuth>
  );
}
