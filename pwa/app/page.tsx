'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import './styles/login.css'

type TabType = 'accueil' | 'downloads' | 'subscriptions' | 'profile'
type SubTabType = 'standard' | 'shorts'
type FilterType = 'recent' | 'popular' | 'old'

interface YouTubeSubscription {
  id: string
  title: string
  thumbnail: string
}

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

function SimulatorApp() {
  const router = useRouter()
  const searchParams = useSearchParams() 
  const channelParam = searchParams.get('channel')

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

  // Initialisation de l'authentification et récupération du stockage local au démarrage
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

  // Restauration de la chaîne active depuis l'URL
  useEffect(() => {
    if (subscriptions.length > 0 && channelParam && !selectedChannel) {
      const savedChannel = subscriptions.find(sub => sub.id === channelParam)
      if (savedChannel) {
        setSelectedChannel(savedChannel)
        setActiveTab('subscriptions')
        setIsCascadeOpen(true) 
        fetchVideosForChannel(savedChannel.id, savedChannel.thumbnail)
      }
    }
  }, [subscriptions, channelParam, selectedChannel])

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
              const thumbnail = finalType === 'shorts' 
                ? (item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || '')
                : (item.snippet.thumbnails?.medium?.url || '')

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

  if (loading) {
    return (
      <div className="auth-wrapper">
        <p className="loading-text">Chargement du simulateur...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <main className="auth-wrapper">
        <div className="auth-card">
          <div className="site-brand"><span>🔻</span> YT Premium Simulator</div>
          <h2 className="site-title">L'expérience de streaming, purifiée.</h2>
          <p className="site-description">
            Cette application modifie la réception de vos flux vidéo en extrayant uniquement le contenu média brut de vos abonnements.
          </p>
          <button onClick={loginWithGoogle} className="btn-google">
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="google-icon" />
            Se connecter avec Google
          </button>
        </div>
      </main>
    )
  }

  const currentFilter = filters[activeSubTab]
  const processedVideos = videos
    .filter(video => video.type === activeSubTab)
    .sort((a, b) => {
      if (currentFilter === 'recent') return new Date(b.rawPublishedAt).getTime() - new Date(a.rawPublishedAt).getTime()
      if (currentFilter === 'old') return new Date(a.rawPublishedAt).getTime() - new Date(b.rawPublishedAt).getTime()
      if (currentFilter === 'popular') return (b.viewCount || 0) - (a.viewCount || 0)
      return 0
    })

  return (
    <div className="app-container">
      
      {/* ─── CONTENU DYNAMIQUE DES ONGLETS ─── */}
      <main className="tab-content" style={{ paddingBottom: '100px' }}>
        
        {/* LECTEUR STYLE YOUTUBE (S'affiche en haut de l'onglet actif si une vidéo est sélectionnée) */}
        {currentVideo && (
          <div className="youtube-player-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', marginBottom: '30px', background: '#0f0f0f', padding: '20px', borderRadius: '16px' }}>
            {/* Colonne Principale de Gauche */}
            <div className="player-main-col">
              <div className="video-wrapper" style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1`}
                  title={currentVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
              <h1 style={{ fontSize: '18px', margin: '14px 0 10px 0', color: '#fff', fontWeight: 'bold', fontFamily: 'Roboto, "Arial", sans-serif' }}>{currentVideo.title}</h1>
              
              {/* Informations Créateur & Boutons d'interactions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={selectedChannel?.thumbnail || user.user_metadata?.avatar_url} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <div>
                    <h3 style={{ fontSize: '15px', margin: 0, color: '#fff', fontFamily: 'Roboto, "Arial", sans-serif'}}>{selectedChannel?.title || "Chaîne YouTube"}</h3>
                    <span style={{ fontSize: '12px', color: '#aaa', fontFamily: 'Roboto, "Arial", sans-serif' }}>{formatViews(currentVideo.viewCount)}</span>
                  </div>
                  <button 
                    onClick={() => handleToggleSubscribe(selectedChannel?.id || '')}
                    style={{ background: isSubscribed ? '#272727' : '#fff', color: isSubscribed ? '#fff' : '#000', padding: '8px 16px', borderRadius: '18px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginLeft: '12px' }}
                  >
                    {isSubscribed ? 'Abonné' : "S'abonner"}
                  </button>
                </div>

                {/* Barre d'outils d'interactions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleLikeVideo(currentVideo.id, 'like')} 
                          style={{ background: rating === 'like' ? '#fff' : '#272727', color: rating === 'like' ? '#000' : '#fff', padding: '8px 16px', borderRadius: '18px 0 0 18px', border: 'none', cursor: 'pointer' }}>
                    👍 {rating === 'like' ? 'Liké' : 'Like'}
                  </button>
                  <button onClick={() => handleLikeVideo(currentVideo.id, 'dislike')}
                          style={{ background: rating === 'dislike' ? '#fff' : '#272727', color: rating === 'dislike' ? '#000' : '#fff', padding: '8px 12px', borderRadius: '0 18px 18px 0', border: 'none', cursor: 'pointer' }}>
                    👎
                  </button>
                  <button onClick={fetchUserPlaylists} style={{ background: '#272727', color: '#fff', padding: '8px 16px', borderRadius: '18px', border: 'none', cursor: 'pointer' }}>
                    📁 Enregistrer
                  </button>
                </div>
              </div>
            </div>

            {/* Colonne de Droite (Vidéos suggérées) */}
            <div className="player-sidebar-col" style={{ overflowY: 'auto', maxHeight: '500px' }}>
              <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#fff' }}>Prochaines vidéos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {processedVideos.filter(v => v.id !== currentVideo.id).slice(0, 8).map(video => (
                  <div key={video.id} onClick={() => setCurrentVideo(video)} style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
                    <img src={video.thumbnail} alt={video.title} style={{ width: '120px', aspectRatio: '16/9', borderRadius: '8px', objectFit: 'cover' }} />
                    <div>
                      <h4 style={{ fontSize: '12px', margin: 0, color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{video.title}</h4>
                      <span style={{ fontSize: '10px', color: '#aaa', display: 'block', marginTop: '4px' }}>{getRelativeTime(video.rawPublishedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accueil' && (
          <section>
            <h2 className="tab-title">Accueil</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>Sélectionnez un créateur dans l'onglet abonnements ci-dessous.</p>
          </section>
        )}

        {activeTab === 'subscriptions' && (
          <section>
            {selectedChannel ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', background: '#1a1a1a', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
                  <img src={selectedChannel.thumbnail} alt={selectedChannel.title} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedChannel.title}</h2>
                    <span style={{ color: '#e50914', fontSize: '12px', fontWeight: 'bold' }}>Flux extrait avec succès ✔</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', borderBottom: '1px solid #222' }}>
                  <button onClick={() => setActiveSubTab('standard')} style={{ background: 'none', border: 'none', color: activeSubTab === 'standard' ? '#fff' : '#666', borderBottom: activeSubTab === 'standard' ? '2px solid #e50914' : '2px solid transparent', paddingBottom: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                    Vidéos
                  </button>
                  <button onClick={() => setActiveSubTab('shorts')} style={{ background: 'none', border: 'none', color: activeSubTab === 'shorts' ? '#fff' : '#666', borderBottom: activeSubTab === 'shorts' ? '2px solid #e50914' : '2px solid transparent', paddingBottom: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                    Shorts ⚡
                  </button>
                </div>

                <div style={{ display: 'flex', gap:25, alignItems: 'center', marginBottom: '20px', padding: '0 4px', fontFamily: 'Roboto, "Arial", sans-serif', fontSize: '13px' }}>
                  <button onClick={() => setFilters(prev => ({ ...prev, [activeSubTab]: 'recent' }))} style={{ background: currentFilter === 'recent' ? '#fff' : 'none', border: 'none', color: currentFilter === 'recent' ? '#111' : '#fff', fontWeight: currentFilter === 'recent' ? 'bold' : 'normal', cursor: 'pointer', padding: '10px', fontFamily: 'inherit', borderRadius:18 }}>
                    Les plus récentes
                  </button>
                  <button onClick={() => setFilters(prev => ({ ...prev, [activeSubTab]: 'popular' }))} style={{ background: currentFilter === 'popular' ? '#fff' : 'none', border: 'none', color: currentFilter === 'popular' ? '#111' : '#fff', fontWeight: currentFilter === 'popular' ? 'bold' : 'normal', cursor: 'pointer', padding: '10px', fontFamily: 'inherit', borderRadius:18 }}>
                    Populaires
                  </button>
                  <button onClick={() => setFilters(prev => ({ ...prev, [activeSubTab]: 'old' }))} style={{ background: currentFilter === 'old' ? '#fff' : 'none', border: 'none', color: currentFilter === 'old' ? '#111' : '#fff', fontWeight: currentFilter === 'old' ? 'bold' : 'normal', cursor: 'pointer', padding: '10px', fontFamily: 'inherit', borderRadius:18 }}>
                    Les plus anciennes
                  </button>
                </div>

                {loadingVideos && processedVideos.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: '14px' }}>Extraction et classification des flux médias bruts...</div>
                ) : processedVideos.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: '14px' }}>Aucun contenu disponible dans cette catégorie.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: activeSubTab === 'shorts' ? 'repeat(auto-fill, minmax(160px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                    {processedVideos.map((video) => (
                      <div key={video.id} className="video-card" style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333', cursor: 'pointer' }} onClick={() => setCurrentVideo(video)}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: activeSubTab === 'shorts' ? '9/16' : '16/9' }}>
                          <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {video.duration && (
                            <span style={{ position: 'absolute', bottom: '6px', right: '6px', backgroundColor: 'rgba(0, 0, 0, 0.75)', color: '#fff', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', fontFamily: 'Roboto, "Arial", sans-serif' }}>{video.duration}</span>
                          )}
                        </div>
                        <div style={{ padding: '12px' }}>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#fff', fontFamily: 'Roboto, "Arial", sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4' }}>{video.title}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#777', fontSize: '11px', fontFamily: 'Roboto, "Arial", sans-serif' }}>
                            <span>{formatViews(video.viewCount)}</span>
                            <span style={{ fontSize: '8px', color: '#444' }}>●</span>
                            <span>{getRelativeTime(video.rawPublishedAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="tab-title">Vos Abonnements</h2>
                <p style={{ color: '#aaa', fontSize: '14px' }}>Sélectionnez une chaîne dans le menu déroulant du bas pour voir ses vidéos.</p>
              </>
            )}
          </section>
        )}

        {activeTab === 'downloads' && (
          <section>
            <h2 className="tab-title">Téléchargements (Hors-ligne)</h2>
            {downloadedVideos.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '14px' }}>Aucun contenu téléchargé localement.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {downloadedVideos.map((video) => (
                  <div key={video.id} className="video-card" style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333', cursor: 'pointer' }} onClick={() => setCurrentVideo(video)}>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                      <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '12px' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#fff' }}>{video.title}</h4>
                      <span style={{ fontSize: '11px', color: '#4af', fontWeight: 'bold' }}>Disponible Hors-ligne (Simulé)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'profile' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 className="tab-title">Mon Profil</h2>
            <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                {user.user_metadata?.avatar_url && (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid red' }} />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{user.user_metadata?.full_name || 'Utilisateur'}</h3>
                  <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>{user.email}</p>
                </div>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '20px 0' }} />
              <button onClick={handleLogout} style={{ width: '100%', padding: '12px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Se déconnecter de l'application
              </button>
            </div>
          </section>
        )}

        {showPlaylistModal && (
          <div style={{ position: 'fixed', top: '20%', left: '30%', width: '400px', background: '#1f1f1f', padding: '20px', borderRadius: '12px', zIndex: 1000 }}>
            <h3 style={{ color: '#fff' }}>Enregistrer dans...</h3>
            <button onClick={() => createPlaylist(prompt("Nom de la playlist :") || "Ma Playlist")} style={{ marginBottom: '10px', width: '100%', padding: '10px' }}>+ Créer une playlist</button>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {playlists.map(p => (
                <div key={p.id} 
                    onClick={() => addVideoToPlaylist(p.id, currentVideo!.id)}
                    style={{ padding: '10px', color: '#fff', borderBottom: '1px solid #333', cursor: 'pointer' }}>
                  {p.snippet.title}
                </div>
              ))}
            </div>
            <button onClick={() => setShowPlaylistModal(false)} style={{ marginTop: '10px', width: '100%' }}>Fermer</button>
          </div>
        )}
      </main>

      {/* ─── NAVBAR AVEC ACCORDÉON (PARTIE 1 + PARTIE 2 COMPLET) ─── */}
      <nav className="navbar">
        <button onClick={() => { setActiveTab('accueil'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'accueil' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Accueil</span>
        </button>

        <div className="nav-item-wrapper">
          <button onClick={() => { setActiveTab('subscriptions'); setIsCascadeOpen(!isCascadeOpen); }} className={`nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`} style={{ width: '100%' }}>
            <svg className="nav-icon" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0-2-.9-2-2V4c0-1.1-.9-2-2-2zm-1 7h-2v2h-2V9h-2V7h2V5h2v2h2v2z"/></svg>
            <span>Abonnements {isCascadeOpen ? '▲' : '▼'}</span>
          </button>

          <div className={`navbar-cascade ${isCascadeOpen ? 'open' : ''}`}>
            {loadingSubs ? (
              <div className="navbar-cascade-loading">Mise à jour automatique...</div>
            ) : subscriptions.length === 0 ? (
              <div className="navbar-cascade-loading">Aucun abonnement trouvé</div>
            ) : (
              subscriptions.map((sub) => (
                <div key={sub.id} className="nav-sub-item" style={{ background: selectedChannel?.id === sub.id ? '#333' : 'transparent', cursor: 'pointer' }} onClick={() => {
                  setActiveTab('subscriptions');
                  setSelectedChannel(sub);      
                  fetchVideosForChannel(sub.id, sub.thumbnail);
                  setActiveSubTab('standard'); 
                  router.push(`?channel=${sub.id}`);
                }}>
                  <img src={sub.thumbnail} alt={sub.title} className="nav-sub-avatar" />
                  <span className="nav-sub-name">{sub.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <button onClick={() => { setActiveTab('downloads'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'downloads' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
          <span>Téléchargements</span>
        </button>

        <button onClick={() => { setActiveTab('profile'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Mon profil" className="nav-icon" style={{ borderRadius: '50%', objectFit: 'cover', width: '24px', height: '24px' }} />
          ) : (
            <svg className="nav-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          )}
          <span>Vous</span>
        </button>
      </nav>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="auth-wrapper">
        <p className="loading-text">Chargement de l'environnement...</p>
      </div>
    }>
      <SimulatorApp />
    </Suspense>
  )
}