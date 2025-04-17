import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';

export default function UserProfilePage() {
  const { displayName } = useParams<{ displayName: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const fetchProfileByDisplayName = async () => {
      if (!displayName) return;
      
      setIsLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('display_name', displayName)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }
        
        if (data) {
          setProfile(data as UserProfile);
          const ownerStatus = user?.id === data.id;
          setIsOwner(ownerStatus);
          setCanEdit(ownerStatus || !!isAdmin);
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfileByDisplayName();
  }, [displayName, user, navigate, isAdmin]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
        <PageHeader
          title={profile ? `${profile.display_name}'s Profile` : 'Profile'}
          description={canEdit ? "Manage your profile information" : "View user profile"}
        />
        
        {isLoading ? (
          <Card className="w-full max-w-2xl mx-auto">
            <CardContent className="py-8">
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-2xl mx-auto">
            {canEdit ? (
              <UserProfileSettings />
            ) : (
              <Card className="w-full">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={profile?.avatar_url || ''} alt={profile?.display_name || ''} />
                      <AvatarFallback>{profile ? getInitials(profile.display_name || profile.username) : '??'}</AvatarFallback>
                    </Avatar>
                    
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">{profile?.display_name}</h2>
                      <p className="text-muted-foreground">{profile?.username}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
