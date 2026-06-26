import { Url } from "next/dist/shared/lib/router/router"

// types/youtube.ts
export interface YouTubeSubscription {
  id: string
  title: string
  thumbnail: string
  username: string
  description: string
  subscriberCount: number
  videoCount: number
  bannerImageUrl: string
}

export interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  publishedAt: string     
  rawPublishedAt: string  
  type: SubTabType
  duration?: string       
  viewCount?: number      
}

export interface YouTubePlaylist {
  id: string;
  snippet: {
    title: string;
  };
}

export type TabType = 'accueil' | 'downloads' | 'subscriptions' | 'profile'
export type SubTabType = 'standard' | 'shorts'
export type FilterType = 'recent' | 'popular' | 'old'