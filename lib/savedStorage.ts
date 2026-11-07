// Saved collections live on the device only, so scope them to the signed-in
// account to keep one user's bookmarks from showing up for the next.
export function userStorageId(user: any): string {
  return String(user?.id || user?._id || 'guest');
}

export const savedReelsKey = (user: any) => `boolok_saved_reels_${userStorageId(user)}`;
export const savedPostsKey = (user: any) => `boolok_saved_posts_${userStorageId(user)}`;
