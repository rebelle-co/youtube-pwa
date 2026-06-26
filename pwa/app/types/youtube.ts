// types/youtube.ts
export interface YouTubeSubscription {
  id: string
  title: string
  thumbnail: string
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

export type TabType = 'accueil' | 'downloads' | 'subscriptions' | 'profile'
export type SubTabType = 'standard' | 'shorts'
export type FilterType = 'recent' | 'popular' | 'old'