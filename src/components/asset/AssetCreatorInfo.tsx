import React, { useEffect, useState } from 'react';
import { AnyAsset, UserProfile } from '@/lib/types';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface AssetCreatorInfoProps {
  asset: AnyAsset | null;
  avatarSize?: string;
  textSize?: string;
  className?: string;
  // Prop to indicate if the creator name itself should be a link (e.g. to an external profile if no local user_id)
  isCreatorNameLink?: boolean; 
}

const AssetCreatorInfo: React.FC<AssetCreatorInfoProps> = ({
  asset,
  avatarSize = "h-6 w-6",
  textSize = "text-sm",
  className,
  isCreatorNameLink = false,
}) => {
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      if (!asset?.user_id) {
        setCreatorProfile(null);
        return;
      }
      setIsLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', asset.user_id)
          .single();
        if (isMounted) {
          if (error && error.code !== 'PGRST116') {
            console.error("Error fetching creator profile:", error);
            setCreatorProfile(null);
          } else {
            setCreatorProfile(data as UserProfile | null);
          }
        }
      } catch (e) {
        if (isMounted) setCreatorProfile(null);
        console.error("Exception fetching creator profile:", e);
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [asset?.user_id]);

  if (!asset) return null;

  const creatorNameFromAsset = asset.creator || 'Unknown';

  if (isLoadingProfile) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Skeleton className={cn("rounded-full", avatarSize)} />
        <Skeleton className={cn("h-4 w-20", textSize === 'text-xs' ? 'w-16' : 'w-24')} />
      </div>
    );
  }

  if (creatorProfile && creatorProfile.username) {
    const displayName = creatorProfile.display_name || creatorProfile.username;
    return (
      <Link 
        to={`/profile/${encodeURIComponent(creatorProfile.username)}`} 
        className={cn("flex items-center space-x-2 group w-fit", className)}
        onClick={(e) => e.stopPropagation()} // Prevent card click if nested
      >
        <Avatar className={cn(avatarSize, "group-hover:ring-2 group-hover:ring-primary transition-all")}>
          <AvatarImage src={creatorProfile.avatar_url ?? undefined} alt={displayName} />
          <AvatarFallback>{displayName?.[0]?.toUpperCase() || <UserIcon style={{width: '60%', height: '60%'}} />}</AvatarFallback>
        </Avatar>
        <span className={cn("font-medium group-hover:text-primary transition-colors", textSize)}>
          {displayName}
        </span>
      </Link>
    );
  } else if (isCreatorNameLink && asset.creator && (asset.creator.startsWith('http') || asset.creator.startsWith('www'))) {
    // If it looks like a URL and no profile, link it directly
    return (
        <a 
            href={asset.creator} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={cn("flex items-center space-x-1 group w-fit text-primary hover:underline", className, textSize)}
            onClick={(e) => e.stopPropagation()}
        >
            <span>{creatorNameFromAsset}</span>
            <LinkIcon className="h-3 w-3 opacity-70 group-hover:opacity-100" />
        </a>
    );
  } else if (creatorNameFromAsset) { // Fallback to text display from asset.creator
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        {/* Optionally show a generic avatar if no profile but creator text exists */}
        {/* <Avatar className={cn(avatarSize)}><AvatarFallback><UserIcon style={{width: '60%', height: '60%'}} /></AvatarFallback></Avatar> */}
        <span className={cn("font-medium", textSize)}>{creatorNameFromAsset}</span>
      </div>
    );
  }

  return null; // Should not be reached if asset exists
};

export default AssetCreatorInfo; 