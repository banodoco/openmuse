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

// Simple in-memory cache for user profiles - Re-adding as component will fetch its own data
const profileCache = new Map<string, UserProfile | null>();

interface LoraCreatorInfoProps {
  asset: LoraAsset | null;
  className?: string;
  avatarSize?: string;
  textSize?: string;
  overrideTextColor?: string;
}

const LoraCreatorInfo: React.FC<LoraCreatorInfoProps> = ({
  asset,
  className = "",
  avatarSize = "h-6 w-6",
  textSize = "text-sm",
  overrideTextColor
}) => {
  // Re-add internal state and useEffect for fetching
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      logger.log(`[LoraLoadSpeed] LoraCreatorInfo: fetchCreatorProfile effect for asset ${asset?.id}, user_id: ${asset?.user_id}`);
      if (asset?.user_id) {
        if (profileCache.has(asset.user_id)) {
          const cachedProfile = profileCache.get(asset.user_id);
          setCreatorProfile(cachedProfile);
          setIsLoadingProfile(false);
          logger.log(`[LoraLoadSpeed] LoraCreatorInfo: Cache hit for profile ID: ${asset.user_id}`);
          return;
        }

        logger.log(`[LoraLoadSpeed] LoraCreatorInfo: Cache miss for profile ID: ${asset.user_id}. Fetching...`);
        setIsLoadingProfile(true);
        setCreatorProfile(null);
        const fetchTimeStart = performance.now();
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', asset.user_id)
            .single();

          if (error) {
            logger.warn(`[LoraLoadSpeed] LoraCreatorInfo: Error fetching creator profile for ${asset.user_id}: ${error.message}`);
            profileCache.set(asset.user_id, null);
          } else if (data) {
            const profileData = data as UserProfile;
            setCreatorProfile(profileData);
            profileCache.set(asset.user_id, profileData);
            logger.log(`[LoraLoadSpeed] LoraCreatorInfo: Successfully fetched profile for ${asset.user_id}`);
          } else {
            profileCache.set(asset.user_id, null);
            logger.log(`[LoraLoadSpeed] LoraCreatorInfo: No profile data returned for ${asset.user_id}, caching null.`);
          }
        } catch (err: any) {
          logger.error(`[LoraLoadSpeed] LoraCreatorInfo: Unexpected error fetching creator profile for ${asset.user_id}:`, err.message || err);
        } finally {
          setIsLoadingProfile(false);
          logger.log(`[LoraLoadSpeed] LoraCreatorInfo: Profile fetch attempt for ${asset.user_id} took ${performance.now() - fetchTimeStart}ms. Loading state: ${isLoadingProfile}`);
        }
      } else {
        logger.log(`[LoraLoadSpeed] LoraCreatorInfo: No asset.user_id, clearing profile state for asset ${asset?.id}`);
        setCreatorProfile(null);
        setIsLoadingProfile(false);
      }
    };

    fetchCreatorProfile();
  }, [asset?.user_id]);

  const getCreatorDisplayNameForFallback = () => {
    if (creatorProfile?.display_name) return creatorProfile.display_name;
    if (asset?.creator) {
        return asset.creator.startsWith('@') ? asset.creator.substring(1) : asset.creator;
    }
    return "Unknown";
  }

  // Dynamic icon size calculation based on avatar size
  // Ensure avatarSize is valid before parsing
  let iconSizeClass = `h-3 w-3`; // Default icon size
  if (avatarSize && avatarSize.includes('-')) {
    const sizePart = avatarSize.split('-')[1];
    if (sizePart && !isNaN(parseInt(sizePart))) {
        const baseSize = parseInt(sizePart);
        iconSizeClass = `h-${Math.floor(baseSize / 2)} w-${Math.floor(baseSize / 2)}`;
    }
  }

  if (isLoadingProfile) {
    logger.log(`[LoraLoadSpeed] LoraCreatorInfo: Rendering SKELETON for asset ${asset?.id} (isLoadingProfile: true)`);
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Skeleton className={`${avatarSize} rounded-full`} />
        <Skeleton className={`h-4 w-24 ${textSize}`} />
      </div>
    );
  }

  if (creatorProfile) {
    const displayName = creatorProfile.display_name || creatorProfile.username;
    const fallbackChar = displayName ? displayName[0]?.toUpperCase() : '';
    const profilePath = `/profile/${encodeURIComponent(creatorProfile.username)}`;
    logger.log(`[LoraLoadSpeed] LoraCreatorInfo: Rendering actual PROFILE for asset ${asset?.id}, creator: ${displayName}`);
    return (
      <Link
        to={profilePath}
        className={`flex items-center space-x-2 group ${className}`}
        onClick={(e) => e.stopPropagation()}
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
    const creatorName = getCreatorDisplayNameForFallback();
    logger.log(`[LoraLoadSpeed] LoraCreatorInfo: Rendering asset.creator FALLBACK for asset ${asset?.id}, name: ${creatorName}`);
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

  logger.log(`[LoraLoadSpeed] LoraCreatorInfo: Rendering UNKNOWN creator for asset ${asset?.id}`);
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