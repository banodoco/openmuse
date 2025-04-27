import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, UserProfile } from '@/lib/types';
import { User as UserIcon } from 'lucide-react';
import { Logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const logger = new Logger('LoraCreatorInfo');

interface LoraCreatorInfoProps {
  asset: LoraAsset | null;
  className?: string; // Optional className prop
  avatarSize?: string; // e.g., "h-6 w-6"
  textSize?: string; // e.g., "text-sm"
  overrideTextColor?: string; // New prop for specific text color
}

const LoraCreatorInfo: React.FC<LoraCreatorInfoProps> = ({
  asset,
  className = "",
  avatarSize = "h-6 w-6",
  textSize = "text-sm",
  overrideTextColor
}) => {
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Fetch creator profile if user_id exists
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (asset?.user_id) {
        setIsLoadingProfile(true);
        setCreatorProfile(null); // Reset previous profile
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', asset.user_id)
            .single();

          if (error) {
            // Don't throw an error, just log it. It might be a non-user creator.
            logger.warn('Error fetching creator profile:', error.message);
          } else if (data) {
            setCreatorProfile(data as UserProfile);
          }
        } catch (err) {
          logger.error('Unexpected error fetching creator profile:', err);
        } finally {
          setIsLoadingProfile(false);
        }
      } else {
        // If there's no user_id, clear the profile state
        setCreatorProfile(null);
        setIsLoadingProfile(false);
      }
    };

    fetchCreatorProfile();
  }, [asset?.user_id]); // Depend on asset.user_id

  const getCreatorDisplayNameForFallback = () => {
    // Use fetched display name, or asset.creator, or fallback
    if (creatorProfile?.display_name) return creatorProfile.display_name;
    if (asset?.creator) {
        // Handle '@username' format if needed
        return asset.creator.startsWith('@') ? asset.creator.substring(1) : asset.creator;
    }
    return "Unknown";
  }

  // Dynamic icon size calculation based on avatar size
  const iconSizeClass = `h-${Math.floor(parseInt(avatarSize.split('-')[1])/2)} w-${Math.floor(parseInt(avatarSize.split('-')[1])/2)}`;

  if (isLoadingProfile) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Skeleton className={`${avatarSize} rounded-full`} />
        <Skeleton className={`h-4 w-24 ${textSize}`} />
      </div>
    );
  }

  if (creatorProfile) {
    // Display linked avatar and name if profile exists
    const displayName = creatorProfile.display_name || creatorProfile.username;
    const fallbackChar = displayName[0].toUpperCase();
    const profilePath = `/profile/${encodeURIComponent(creatorProfile.username)}`;

    return (
      <Link
        to={profilePath}
        className={`flex items-center space-x-2 group ${className}`}
        onClick={(e) => e.stopPropagation()} // Prevent card click-through
      >
        <Avatar className={`${avatarSize} group-hover:ring-2 group-hover:ring-primary transition-all`}>
          <AvatarImage src={creatorProfile.avatar_url ?? undefined} alt={displayName} />
          <AvatarFallback>
            {fallbackChar || <UserIcon className={iconSizeClass} />}
          </AvatarFallback>
        </Avatar>
        <span className={cn(
          `font-medium ${textSize}`,
          overrideTextColor ? overrideTextColor : 'group-hover:text-primary transition-colors'
        )}>
          {displayName}
        </span>
      </Link>
    );
  }

  if (asset?.creator) {
    // Display creator name from asset data if no profile (e.g., legacy or non-user creator)
    const creatorName = getCreatorDisplayNameForFallback();
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Avatar className={avatarSize}>
          <AvatarFallback>
             <UserIcon className={iconSizeClass} />
          </AvatarFallback>
        </Avatar>
        <span className={cn(
          `font-medium ${textSize}`,
          overrideTextColor ? overrideTextColor : 'text-muted-foreground'
        )}>
          {creatorName}
        </span>
      </div>
    );
  }

  // Fallback if no creator info at all
  return (
     <div className={`flex items-center space-x-2 ${className}`}>
        <Avatar className={avatarSize}>
          <AvatarFallback><UserIcon className={iconSizeClass} /></AvatarFallback>
        </Avatar>
        <span className={cn(
          `font-medium ${textSize}`,
          overrideTextColor ? overrideTextColor : 'text-muted-foreground'
        )}>
          Unknown Creator
        </span>
      </div>
  );
};

export default LoraCreatorInfo; 