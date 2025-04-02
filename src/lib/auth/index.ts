
// Export all auth functionality from this central file
export { signInWithDiscord, signOut } from './authMethods';
export { getCurrentUser } from './currentUser';
export { getCurrentUserProfile, updateUserProfile } from './userProfile';
export { getUserRoles, checkIsAdmin, addUserRole } from './userRoles';
