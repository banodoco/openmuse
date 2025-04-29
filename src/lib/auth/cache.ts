import { UserProfile } from '../types';

// Cache for user profiles to reduce database queries
export const userProfileCache = new Map<string, {profile: UserProfile | null, timestamp: number}>();
export const PROFILE_CACHE_TTL = 60000; // 1 minute

// Cache for user roles to reduce database queries
export const userRolesCache = new Map<string, {roles: string[], isAdmin?: boolean, timestamp: number}>();
export const ROLES_CACHE_TTL = 300000; // 5 minutes
