'use client'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { YouTubeSubscription } from '../types/youtube'



const AppContext = createContext<any>(null)
type TabType = 'accueil' | 'downloads' | 'subscriptions' | 'profile'
type SubTabType = 'standard' | 'shorts'
type FilterType = 'recent' | 'popular' | 'old'


interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  publishedAt: string     
  rawPublishedAt: string  
  type: SubTabType
  duration?: string       
  viewCount?: number      
}


// Outils de formatage
const getRelativeTime = (isoString: string): string => {
  if (!isoString) return "à l'instant"
  const now = new Date()
  const past = new Date(isoString)
  const diffMs = now.getTime() - past.getTime()
  if (diffMs < 0) return "à l'instant"

  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30.416)
  const diffYears = Math.floor(diffDays / 365.25)

  if (diffSecs < 60) return diffSecs <= 1 ? "à l'instant" : `${diffSecs} seconde${diffSecs > 1 ? 's' : ''}`
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''}`
  if (diffHours < 24) return `${diffHours} heure${diffHours > 1 ? 's' : ''}`
  if (diffDays < 7) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`
  if (diffWeeks < 4) return `${diffWeeks} semaine${diffWeeks > 1 ? 's' : ''}`
  if (diffMonths < 12) return `${diffMonths} mois`
  return `${diffYears} an${diffYears > 1 ? 's' : ''}`
}

const parseISODuration = (isoDuration: string): string => {
  if (!isoDuration) return ''
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const hours = match[1] ? parseInt(match[1], 10) : 0
  const minutes = match[2] ? parseInt(match[2], 10) : 0
  const seconds = match[3] ? parseInt(match[3], 10) : 0

  const parts = []
  if (hours > 0) {
    parts.push(hours)
    parts.push(minutes.toString().padStart(2, '0'))
  } else {
    parts.push(minutes)
  }
  parts.push(seconds.toString().padStart(2, '0'))
  return parts.join(':')
}

const formatViews = (views?: number): string => {
  if (!views) return '0 vue'
  if (views >= 1000000) return `${(views / 1000000).toFixed(1).replace('.', '.')} M de vues`
  if (views >= 1000) return `${(views / 1000).toFixed(0)} k de vues`
  return `${views} vue${views > 1 ? 's' : ''}`
}

export function AppProvider({ children }: { children: ReactNode }) {

  const router = useRouter()
  
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('accueil')
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('standard')
    
  const [filters, setFilters] = useState<Record<SubTabType, FilterType>>({
    standard: 'recent',
    shorts: 'recent'
  })
  
  const [subscriptions, setSubscriptions] = useState<YouTubeSubscription[]>([])
  const [isCascadeOpen, setIsCascadeOpen] = useState(false)
  const [loadingSubs, setLoadingSubs] = useState(false)
  
  const [selectedChannel, setSelectedChannel] = useState<YouTubeSubscription | null>(null)
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  
  // NOUVEAUX ÉTATS : Lecteur vidéo et fonctionnalités YouTube interactives
  const [currentVideo, setCurrentVideo] = useState<YouTubeVideo | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(true) // Vrai par défaut puisqu'il s'agit de la liste d'abonnements
  const [downloadedVideos, setDownloadedVideos] = useState<any[]>([])
  
  const [playlists, setPlaylists] = useState<any[]>([])
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [rating, setRating] = useState<'like' | 'dislike' | 'none'>('none')
  

  // Ajoutez ces états dans AppProvider
  const [channelData, setChannelData] = useState<any>(null); // Pour stocker abonnés/bannière
  const [channelPlaylists, setChannelPlaylists] = useState<any[]>([]);


  // Dans AppContext.tsx

  const fetchChannelBanner = async (channelId: string) => {
    const token = localStorage.getItem('yt_oauth_token');
    
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=brandingSettings&id=${channelId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    
    const bannerUrl = data.items?.[0]?.brandingSettings?.image?.bannerExternalUrl;
    if (!bannerUrl) return null;

    // SOLUTION : Si l'URL contient des paramètres après le '=', 
    // on les coupe pour forcer le CDN à servir l'image originale.
    return `${bannerUrl}=w2560-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`;
  };

  // Dans AppProvider (AppContext.tsx)
  // 1. Assurez-vous d'ajouter "brandingSettings" dans la requête API
  const fetchChannelById = async (channelId: string) => {
    const token = localStorage.getItem("yt_oauth_token");
    
    // 1. Requête Supabase optimisée avec maybeSingle()
    const { data: cached, error } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .maybeSingle();

    // 2. Vérification simplifiée : si on a une donnée et qu'elle a moins de 24h
    const isFresh = cached && (new Date().getTime() - new Date(cached.updated_at).getTime() < 86400000);

    if (isFresh) {
      setSelectedChannel({
        id: cached.id,
        title: cached.title,
        thumbnail: cached.thumbnail_url,
        bannerImageUrl: cached.banner_url,
        username: cached.username,
        description: cached.description,
        subscriberCount: cached.subscriber_count,
        videoCount: cached.video_count,
      });
      return; // On arrête là, pas besoin d'appeler l'API YouTube
    }

    // 3. Sinon, fetch YouTube et Upsert
    if (!token) return;
    
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (!res.ok) return; // Sécurité en cas d'erreur API YouTube
    const data = await res.json();

    if (data.items?.length) {
      const item = data.items[0];
      
      // ... (votre logique de traitement des données reste inchangée)
      const bannerUrl = item.brandingSettings?.image?.bannerExternalUrl?.split('=')[0];
      const avatarUrl = (item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url)
        ?.replace('default.jpg', 's800-c-k-c0x00ffffff-no-rj')
        ?.replace('hqdefault.jpg', 's800-c-k-c0x00ffffff-no-rj');

      const channelData = {
        id: item.id,
        title: item.snippet.title,
        thumbnail_url: avatarUrl,
        banner_url: bannerUrl || null,
        username: item.snippet.customUrl,
        description: item.snippet.description,
        subscriber_count: parseInt(item.statistics.subscriberCount),
        video_count: parseInt(item.statistics.videoCount),
        updated_at: new Date().toISOString()
      };

      await supabase.from('channels').upsert(channelData);

      setSelectedChannel({
        id: channelData.id,
        title: channelData.title,
        thumbnail: channelData.thumbnail_url,
        bannerImageUrl: channelData.banner_url,
        username: channelData.username,
        description: channelData.description,
        subscriberCount: channelData.subscriber_count,
        videoCount: channelData.video_count,
      });
    }
  };

  const formatNumber = (num: string | number) => {
    const n = parseInt(num as string, 10);
    if (isNaN(n)) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + " M";
    if (n >= 1000) return (n / 1000).toFixed(1) + " k";
    return n.toString();
  };

  // Fonction pour synchroniser le nombre de vidéos
  const syncChannelVideos = async (channelId: string, ytTotal: number) => {
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);

    if (count !== ytTotal) {
      // Appel à fetchVideosForChannel existant qui gère l'upsert
      await fetchVideosForChannel(channelId);
    }
  };

  

  // Fonction pour récupérer Playlists de la chaîne spécifique
  const fetchChannelPlaylists = async (channelId: string) => {
    const token = localStorage.getItem('yt_oauth_token');
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    setChannelPlaylists(data.items || []);
  };

  const fetchYouTubeSubscriptions = async (token: string) => {
    setLoadingSubs(true)
    try {
      let allSubs: YouTubeSubscription[] = []
      let nextPageToken = ''
      let hasNextPage = true

      while (hasNextPage) {
        const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : ''
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50&order=alphabetical${pageParam}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        
        if (res.status === 401) {
          localStorage.removeItem('yt_oauth_token')
          loginWithGoogle()
          return
        }

        if (!res.ok) throw new Error('Erreur API YouTube')
        const data = await res.json()
        
        const formattedSubs = data.items.map((item: any) => ({
          id: item.snippet.resourceId.channelId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.default?.url || '',
        }))
        
        allSubs = [...allSubs, ...formattedSubs]
        if (data.nextPageToken) nextPageToken = data.nextPageToken
        else hasNextPage = false
      }
      setSubscriptions(allSubs)
    } catch (err) {
      console.error("Erreur lors du fetch YouTube :", err)
    } finally {
      setLoadingSubs(false)
    }
  }

  const fetchVideosForChannel = async (channelId: string, channelThumbnail?: string) => {
    setLoadingVideos(true)
    try {
      const token = localStorage.getItem('yt_oauth_token')
      if (!token) { loginWithGoogle(); return; }

      const { data: cachedVideos } = await supabase
        .from('videos')
        .select('*')
        .eq('channel_id', channelId)

      const formattedCached: YouTubeVideo[] = cachedVideos ? cachedVideos.map((v: any) => ({
        id: v.id,
        title: v.title,
        thumbnail: v.thumbnail_url,
        publishedAt: new Date(v.published_at).toLocaleDateString('fr-FR'),
        rawPublishedAt: v.published_at,
        type: (v.type || 'standard') as SubTabType,
        duration: parseISODuration(v.duration),
        viewCount: v.view_count || 0
      })) : []

      formattedCached.sort((a, b) => new Date(b.rawPublishedAt).getTime() - new Date(a.rawPublishedAt).getTime())
      setVideos(formattedCached)

      const channelStatsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (channelStatsRes.status === 401) {
        localStorage.removeItem('yt_oauth_token')
        loginWithGoogle()
        return
      }

      if (!channelStatsRes.ok) throw new Error('Erreur API YouTube Channel Stats')
      const channelStatsData = await channelStatsRes.json()
      const ytVideoCount = parseInt(channelStatsData.items?.[0]?.statistics?.videoCount || '0', 10)

      if (ytVideoCount === formattedCached.length) {
        setLoadingVideos(false)
        return
      }

      const uploadsPlaylistId = 'UU' + channelId.substring(2)
      let allPlaylistVideoIds: string[] = []
      let nextPageToken = ''
      let hasNextPage = true

      while (hasNextPage) {
        const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : ''
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50${pageParam}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!res.ok) throw new Error('Erreur API YouTube Videos Playlist')
        const data = await res.json()
        const ids = data.items.map((item: any) => item.snippet.resourceId.videoId)
        allPlaylistVideoIds = [...allPlaylistVideoIds, ...ids]

        if (data.nextPageToken) nextPageToken = data.nextPageToken
        else hasNextPage = false
      }

      if (allPlaylistVideoIds.length === 0) {
        setLoadingVideos(false)
        return
      }

      const cachedIdsSet = new Set(formattedCached.map(v => v.id))
      const missingVideoIds = allPlaylistVideoIds.filter(id => !cachedIdsSet.has(id))

      if (missingVideoIds.length > 0) {
        for (let i = 0; i < missingVideoIds.length; i += 50) {
          const chunk = missingVideoIds.slice(i, i + 50)
          const detailsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${chunk.join(',')}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )

          if (detailsRes.ok) {
            const detailsData = await detailsRes.json()
            const classificationRes = await fetch('/api/classify-videos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoIds: chunk })
            })

            let realTypes: Record<string, 'standard' | 'shorts'> = {}
            if (classificationRes.ok) realTypes = await classificationRes.json()

            const dbInserts: any[] = []
            const formattedChunk: YouTubeVideo[] = []

            detailsData.items.forEach((item: any) => {
              const finalType = realTypes[item.id] || 'standard'
              // Remplacez 'medium' par 'maxres' pour avoir la meilleure qualité possible
              const thumbnail = finalType === 'shorts' 
                ? (item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || '')
                : (item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '')

              dbInserts.push({
                id: item.id,
                title: item.snippet.title,
                channel_title: item.snippet.channelTitle,
                channel_id: item.snippet.channelId,
                thumbnail_url: thumbnail,
                channel_avatar_url: channelThumbnail || null,
                duration: item.contentDetails?.duration || null,
                view_count: item.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : 0,
                published_at: item.snippet.publishedAt,
                type: finalType
              })

              formattedChunk.push({
                id: item.id,
                title: item.snippet.title,
                thumbnail: thumbnail,
                publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString('fr-FR'),
                rawPublishedAt: item.snippet.publishedAt,
                type: finalType,
                duration: parseISODuration(item.contentDetails?.duration),
                viewCount: item.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : 0
              })
            })

            if (dbInserts.length > 0) {
              await supabase.from('videos').upsert(dbInserts)
            }

            setVideos((prev) => [...prev, ...formattedChunk].sort((a, b) => new Date(b.rawPublishedAt).getTime() - new Date(a.rawPublishedAt).getTime()))
          }
        }
      }
    } catch (err) {
      console.error("Erreur traitement vidéos :", err)
    } finally {
      setLoadingVideos(false)
    }
  }

  // INTERACTION DIRECTE AVEC L'API YOUTUBE (Écriture réelle)
  const handleLikeVideo = async (videoId: string, type: 'like' | 'dislike') => {
    const token = localStorage.getItem('yt_oauth_token')
    if (!token) return
    
    // Si on clique sur le même bouton, on met à 'none' (retrait)
    const newRating = rating === type ? 'none' : type
    
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=${newRating}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setRating(newRating)
    } catch (err) { console.error(err) }
  }

  const fetchUserPlaylists = async () => {
    const token = localStorage.getItem('yt_oauth_token')
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    setPlaylists(data.items || [])
    setShowPlaylistModal(true)
  }

  const createPlaylist = async (title: string) => {
    const token = localStorage.getItem('yt_oauth_token')
    await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { title } })
    })
    fetchUserPlaylists() // Rafraîchir
  }

  const addVideoToPlaylist = async (playlistId: string, videoId: string) => {
    const token = localStorage.getItem('yt_oauth_token');
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          snippet: {
            playlistId: playlistId,
            resourceId: { kind: 'youtube#video', videoId: videoId }
          }
        })
      });
      if (res.ok) alert("Vidéo ajoutée avec succès !");
    } catch (err) { console.error(err); }
  };

  const handleToggleSubscribe = async (channelId: string) => {
    const token = localStorage.getItem('yt_oauth_token');
    if (!token) return;

    try {
      if (isSubscribed) {
        // 1. Chercher l'ID de l'abonnement pour cette chaîne
        const checkRes = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=id&forChannelId=${channelId}&mine=true`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await checkRes.json();
        
        if (data.items.length > 0) {
          const subId = data.items[0].id;
          // 2. Supprimer l'abonnement
          await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?id=${subId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          setIsSubscribed(false);
        }
      } else {
        // 3. S'abonner
        await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ snippet: { resourceId: { kind: 'youtube#channel', channelId: channelId } } })
        });
        setIsSubscribed(true);
      }
    } catch (err) { console.error("Erreur:", err); }
  };

  // SIMULATION TÉLÉCHARGEMENT COMPATIBLE CLIENT (Mock Blobs / LocalStorage)
  const handleDownloadVideo = (video: YouTubeVideo) => {
    const localDownloads = JSON.parse(localStorage.getItem('yt_sim_downloads') || '[]')
    if (localDownloads.some((v: any) => v.id === video.id)) {
      alert("Vidéo déjà téléchargée !")
      return
    }
    const updated = [...localDownloads, { ...video, localUrl: 'offline_active' }]
    localStorage.setItem('yt_sim_downloads', JSON.stringify(updated))
    setDownloadedVideos(updated)
    alert("Vidéo enregistrée pour le mode hors-ligne !")
  }

  const loadDownloadedVideos = () => {
    const localDownloads = JSON.parse(localStorage.getItem('yt_sim_downloads') || '[]')
    setDownloadedVideos(localDownloads)
  }

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        // AJOUT IMPÉRATIF DU SCOPE D'ÉCRITURE FORCE-SSL
        scopes: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
        queryParams: { access_type: 'offline', prompt: 'select_account' }
      },
    })
  }

  const handleLogout = async () => {
    localStorage.removeItem('yt_oauth_token')
    await supabase.auth.signOut()
    setSubscriptions([])
    setVideos([])
    setSelectedChannel(null)
    setIsCascadeOpen(false)
    setActiveTab('accueil')
    setActiveSubTab('standard')
    setCurrentVideo(null)
    router.push('/')
  }

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.provider_token) {
        localStorage.setItem('yt_oauth_token', session.provider_token)
        setUser(session.user)
        fetchYouTubeSubscriptions(session.provider_token)
      } else if (session?.user) {
        setUser(session.user)
        const savedToken = localStorage.getItem('yt_oauth_token')
        if (savedToken) {
          fetchYouTubeSubscriptions(savedToken)
        } else {
          loginWithGoogle()
          return
        }
      }
      setLoading(false)
    }

    initializeAuth()
    loadDownloadedVideos()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_token) {
        localStorage.setItem('yt_oauth_token', session.provider_token)
        setUser(session.user)
        fetchYouTubeSubscriptions(session.provider_token)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])


  return (
    <AppContext.Provider value={{ 
      user, setUser, 
      subscriptions, setSubscriptions, 
      currentVideo, setCurrentVideo,
      loading,
      activeTab, setActiveTab,
      activeSubTab, setActiveSubTab,
      filters, setFilters,
      selectedChannel, setSelectedChannel,
      videos, setVideos,
      loadingVideos, setLoadingVideos,
      isLiked, setIsLiked,
      isSubscribed, setIsSubscribed,
      downloadedVideos, setDownloadedVideos,
      playlists, setPlaylists,
      showPlaylistModal, setShowPlaylistModal,
      rating, setRating,
      fetchVideosForChannel,
      handleLikeVideo,
      fetchUserPlaylists,
      createPlaylist,
      addVideoToPlaylist,
      handleToggleSubscribe,
      handleDownloadVideo,
      fetchChannelById,
      fetchChannelPlaylists,
      loginWithGoogle,
      fetchChannelBanner,
      handleLogout,
      formatViews,
      formatNumber,
      getRelativeTime
    }}>
      {children}
    </AppContext.Provider>
  )
}

// Dans AppContext.tsx
export const useAppContext = () => useContext(AppContext)