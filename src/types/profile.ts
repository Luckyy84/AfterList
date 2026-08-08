import type { MediaItem } from './media'
export type ExternalLinks = Array<{ label: string; url: string }>
export type OwnProfile = { user_id: string; username: string | null; display_name: string; bio: string; avatar_url: string | null; external_links: ExternalLinks; is_public: boolean; show_library: boolean; show_favorites: boolean; show_stats: boolean }
export type PublicProfile = { username: string; displayName: string; bio?: string; avatarUrl?: string; externalLinks?: ExternalLinks; lists?: Array<{ name: string; slug: string }> }
export type PublicProfileResponse = PublicProfile & { favorites?: MediaItem[]; stats?: Record<string, number>; redirectUsername?: string }
export type PublicMediaPage = Pick<PublicProfile, 'username' | 'displayName'> & { name?: string; slug?: string; items: MediaItem[]; redirectUsername?: string }
