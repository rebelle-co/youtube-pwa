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
  subscriptionId?: string // Stocke l'ID unique pour pouvoir supprimer l'abonnement
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

interface Playlist {
  id: string
  title: string
  isSystem?: boolean
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
  if (diffSecs < 60) return "à l'instant"
  if (diffMins < 60) return `${diffMins} min`
  if (diffHours < 24) return `${diffHours} h`
  return `${diffDays} j`
}

const parseISODuration = (isoDuration: string): string => {
  if (!isoDuration) return ''
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const hours = match[1] ? parseInt(match[1], 10) : 0
  const minutes = match[2] ? parseInt(match[2], 10) : 0
  const seconds = match[3] ? parseInt(match[3], 10) : 0
  const parts = []
  if (hours > 0) { parts.push(hours); parts.push(minutes.toString().padStart(2, '0')); }
  else { parts.push(minutes); }
  parts.push(seconds.toString().padStart(2, '0'))
  return parts.join(':')
}

const formatViews = (views?: number): string => {
  if (!views) return '0 vue'
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)} M de vues`
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
    standard: 'recent', shorts: 'recent'
  })

  const [subscriptions, setSubscriptions] = useState<YouTubeSubscription[]>([])
  const [isCascadeOpen, setIsCascadeOpen] = useState(false)
  const [loadingSubs, setLoadingSubs] = useState(false)

  const [selectedChannel, setSelectedChannel] = useState<YouTubeSubscription | null>(null)
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)

  // ÉTATS LECTEUR & INTERACTIONS INTERACTIVES
  const [currentVideo, setCurrentVideo] = useState<YouTubeVideo | null>(null)
  const [interaction, setInteraction] = useState<'like' | 'dislike' | 'none'>('none')
  const [isSubscribed, setIsSubscribed] = useState(true)
  const [downloadedVideos, setDownloadedVideos] = useState<any[]>([])

  // ÉTATS GESTION PLAYLISTS MODALE
  const [isPlaylistPanelOpen, setIsPlaylistPanelOpen] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([
    { id: 'liked', title: 'Vidéos j\'aime', isSystem: true },
    { id: 'watch_later', title: 'À regarder plus tard', isSystem: true }
  ])
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [selectedPlaylistsForVideo, setSelectedPlaylistsForVideo] = useState<string[]>([])

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
        if (savedToken) fetchYouTubeSubscriptions(savedToken)
        else { loginWithGoogle(); return; }
      }
      setLoading(false)
    }
    initializeAuth()
    loadDownloadedVideos()
    loadCustomPlaylists()
  }, [])

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

  // Synchronise les checkbox de la modale playlist quand on change de vidéo active
  useEffect(() => {
    if (currentVideo) {
      const savedMapping = JSON.parse(localStorage.getItem('yt_video_playlists') || '{}')
      setSelectedPlaylistsForVideo(savedMapping[currentVideo.id] || [])
    }
  }, [currentVideo])

  const fetchYouTubeSubscriptions = async (token: string) => {
    setLoadingSubs(true)
    try {
      let allSubs: YouTubeSubscription[] = []
      let nextPageToken = ''
      let hasNextPage = true

      while (hasNextPage) {
        const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : ''
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${pageParam}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.status === 401) { localStorage.removeItem('yt_oauth_token'); loginWithGoogle(); return; }
        if (!res.ok) throw new Error('Erreur API YouTube')
        const data = await res.json()
        
        const formattedSubs = data.items.map((item: any) => ({
          id: item.snippet.resourceId.channelId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.default?.url || '',
          subscriptionId: item.id // Crucial pour le désabonnement direct
        }))
        allSubs = [...allSubs, ...formattedSubs]
        if (data.nextPageToken) nextPageToken = data.nextPageToken
        else hasNextPage = false
      }
      setSubscriptions(allSubs)
    } catch (err) { console.error(err) } finally { setLoadingSubs(false) }
  }

  const fetchVideosForChannel = async (channelId: string, channelThumbnail?: string) => {
    setLoadingVideos(true)
    try {
      const token = localStorage.getItem('yt_oauth_token')
      if (!token) return

      const { data: cachedVideos } = await supabase.from('videos').select('*').eq('channel_id', channelId)
      const formattedCached: YouTubeVideo[] = cachedVideos ? cachedVideos.map((v: any) => ({
        id: v.id, title: v.title, thumbnail: v.thumbnail_url,
        publishedAt: new Date(v.published_at).toLocaleDateString('fr-FR'),
        rawPublishedAt: v.published_at, type: (v.type || 'standard') as SubTabType,
        duration: parseISODuration(v.duration), viewCount: v.view_count || 0
      })) : []

      setVideos(formattedCached.sort((a, b) => new Date(b.rawPublishedAt).getTime() - new Date(a.rawPublishedAt).getTime()))

      const uploadsPlaylistId = 'UU' + channelId.substring(2)
      const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=30`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      const chunk = data.items.map((item: any) => item.snippet.resourceId.videoId)

      if (chunk.length > 0) {
        const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${chunk.join(',')}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json()
          const dbInserts: any[] = []
          const updatedChunk: YouTubeVideo[] = detailsData.items.map((item: any) => {
            const isShort = item.snippet.title.toLowerCase().includes('#shorts') || (item.contentDetails?.duration && !item.contentDetails.duration.includes('M'))
            const finalType = isShort ? 'shorts' : 'standard'
            
            dbInserts.push({
              id: item.id, title: item.snippet.title, channel_title: item.snippet.channelTitle,
              channel_id: item.snippet.channelId, thumbnail_url: item.snippet.thumbnails?.medium?.url || '',
              channel_avatar_url: channelThumbnail, duration: item.contentDetails?.duration,
              view_count: item.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : 0,
              published_at: item.snippet.publishedAt, type: finalType
            })

            return {
              id: item.id, title: item.snippet.title, thumbnail: item.snippet.thumbnails?.medium?.url || '',
              publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString('fr-FR'),
              rawPublishedAt: item.snippet.publishedAt, type: finalType,
              duration: parseISODuration(item.contentDetails?.duration),
              viewCount: item.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : 0
            }
          })
          if (dbInserts.length > 0) await supabase.from('videos').upsert(dbInserts)
          setVideos(updatedChunk)
        }
      }
    } catch (err) { console.error(err) } finally { setLoadingVideos(false) }
  }

  // LOGIQUE TOGGLE LIKE / DISLIKE AVEC RETRAIT DE L'ANCIEN ETAT
  const handleLikeVideo = async (videoId: string) => {
    const token = localStorage.getItem('yt_oauth_token')
    if (!token) return
    const targetRating = interaction === 'like' ? 'none' : 'like'
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=${targetRating}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setInteraction(targetRating)
        updateSystemPlaylistMapping('liked', videoId, targetRating === 'like')
      }
    } catch (err) { console.error(err) }
  }

  const handleDislikeVideo = async (videoId: string) => {
    const token = localStorage.getItem('yt_oauth_token')
    if (!token) return
    const targetRating = interaction === 'dislike' ? 'none' : 'dislike'
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=${targetRating}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setInteraction(targetRating)
        if (interaction === 'like') updateSystemPlaylistMapping('liked', videoId, false)
      }
    } catch (err) { console.error(err) }
  }

  // LOGIQUE ABONNEMENT EN CLIQUANT DE NOUVEAU POUR SE DÉSABONNER SANS ERREUR
  const handleToggleSubscribe = async () => {
    if (!selectedChannel) return
    const token = localStorage.getItem('yt_oauth_token')
    if (!token) return

    try {
      if (isSubscribed) {
        // Suppression active via l'ID de l'abonnement
        const subId = selectedChannel.subscriptionId || subscriptions.find(s => s.id === selectedChannel.id)?.subscriptionId
        if (subId) {
          const res = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?id=${subId}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) setIsSubscribed(false)
        } else {
          setIsSubscribed(false) // Fallback local
        }
      } else {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ snippet: { resourceId: { kind: 'youtube#channel', channelId: selectedChannel.id } } })
        })
        if (res.ok) {
          const data = await res.json()
          // Met à jour l'ID d'abonnement généré par Google
          selectedChannel.subscriptionId = data.id
          setIsSubscribed(true)
        }
      }
    } catch (err) { console.error(err) }
  }

  // GESTION DES PLAYLISTS PERSISTÉES EN LOCAL
  const loadCustomPlaylists = () => {
    const saved = localStorage.getItem('yt_custom_playlists')
    if (saved) {
      setPlaylists([
        { id: 'liked', title: 'Vidéos j\'aime', isSystem: true },
        { id: 'watch_later', title: 'À regarder plus tard', isSystem: true },
        ...JSON.parse(saved)
      ])
    }
  }

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return
    const newPl: Playlist = { id: 'custom_' + Date.now(), title: newPlaylistName.trim() }
    const updated = [...playlists.filter(p => !p.isSystem), newPl]
    localStorage.setItem('yt_custom_playlists', JSON.stringify(updated))
    setPlaylists([...playlists, newPl])
    setNewPlaylistName('')
  }

  const toggleVideoInPlaylist = (playlistId: string) => {
    if (!currentVideo) return
    const savedMapping = JSON.parse(localStorage.getItem('yt_video_playlists') || '{}')
    let currentLists = savedMapping[currentVideo.id] || []

    if (currentLists.includes(playlistId)) {
      currentLists = currentLists.filter((id: string) => id !== playlistId)
    } else {
      currentLists.push(playlistId)
    }

    savedMapping[currentVideo.id] = currentLists
    localStorage.setItem('yt_video_playlists', JSON.stringify(savedMapping))
    setSelectedPlaylistsForVideo(currentLists)
  }

  const updateSystemPlaylistMapping = (playlistId: string, videoId: string, add: boolean) => {
    const savedMapping = JSON.parse(localStorage.getItem('yt_video_playlists') || '{}')
    let currentLists = savedMapping[videoId] || []
    if (add && !currentLists.includes(playlistId)) currentLists.push(playlistId)
    if (!add) currentLists = currentLists.filter((id: string) => id !== playlistId)
    savedMapping[videoId] = currentLists
    localStorage.setItem('yt_video_playlists', JSON.stringify(savedMapping))
    if (currentVideo?.id === videoId) setSelectedPlaylistsForVideo(currentLists)
  }

  const handleDownloadVideo = (video: YouTubeVideo) => {
    const localDownloads = JSON.parse(localStorage.getItem('yt_sim_downloads') || '[]')
    if (localDownloads.some((v: any) => v.id === video.id)) return
    const updated = [...localDownloads, { ...video, localUrl: 'offline_active' }]
    localStorage.setItem('yt_sim_downloads', JSON.stringify(updated))
    setDownloadedVideos(updated)
  }

  const loadDownloadedVideos = () => {
    setDownloadedVideos(JSON.parse(localStorage.getItem('yt_sim_downloads') || '[]'))
  }

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        scopes: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
        queryParams: { access_type: 'offline', prompt: 'select_account' }
      },
    })
  }

  const handleLogout = async () => {
    localStorage.removeItem('yt_oauth_token')
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="auth-wrapper"><p className="loading-text">Chargement du simulateur...</p></div>

  if (!user) {
    return (
      <main className="auth-wrapper">
        <div className="auth-card">
          <div className="site-brand"><span>🔻</span> YT Premium Simulator</div>
          <button onClick={loginWithGoogle} className="btn-google">Se connecter avec Google</button>
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
      <main className="tab-content" style={{ paddingBottom: '100px' }}>
        
        {/* LECTEUR AMÉLIORÉ */}
        {currentVideo && (
          <div className="youtube-player-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', marginBottom: '30px', background: '#0f0f0f', padding: '20px', borderRadius: '16px' }}>
            <div className="player-main-col">
              <div className="video-wrapper" style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                <iframe
                  width="100%" height="100%"
                  src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1`}
                  title={currentVideo.title} frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                ></iframe>
              </div>
              <h1 style={{ fontSize: '18px', margin: '14px 0 10px 0', color: '#fff', fontWeight: 'bold' }}>{currentVideo.title}</h1>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={selectedChannel?.thumbnail || user.user_metadata?.avatar_url} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <div>
                    <h3 style={{ fontSize: '15px', margin: 0, color: '#fff' }}>{selectedChannel?.title || "Chaîne YouTube"}</h3>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>{formatViews(currentVideo.viewCount)}</span>
                  </div>
                  <button 
                    onClick={handleToggleSubscribe}
                    style={{ background: isSubscribed ? '#272727' : '#fff', color: isSubscribed ? '#fff' : '#000', padding: '8px 16px', borderRadius: '18px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginLeft: '12px' }}
                  >
                    {isSubscribed ? 'Abonné' : "S'abonner"}
                  </button>
                </div>

                {/* MODULE D'INTERACTION CORRIGÉ */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'flex', background: '#272727', borderRadius: '18px', overflow: 'hidden' }}>
                    <button onClick={() => handleLikeVideo(currentVideo.id)} style={{ background: interaction === 'like' ? '#444' : 'transparent', color: '#fff', padding: '8px 16px', border: 'none', borderRight: '1px solid #444', fontWeight: '500', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {interaction === 'like' ? '❤️' : '👍'} Like
                    </button>
                    <button onClick={() => handleDislikeVideo(currentVideo.id)} style={{ background: interaction === 'dislike' ? '#444' : 'transparent', color: '#fff', padding: '8px 14px', border: 'none', cursor: 'pointer' }}>
                      {interaction === 'dislike' ? '💔' : '👎'}
                    </button>
                  </div>

                  <button onClick={() => setIsPlaylistPanelOpen(!isPlaylistPanelOpen)} style={{ background: '#272727', color: '#fff', padding: '8px 16px', borderRadius: '18px', border: 'none', fontWeight: '500', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📁 Enregistrer
                  </button>
                  <button onClick={() => handleDownloadVideo(currentVideo)} style={{ background: '#272727', color: '#4af', padding: '8px 16px', borderRadius: '18px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>📥 Télécharger</button>
                </div>
              </div>

              {/* ENREGISTRER DANS LES PLAYLISTS PANEL DYNAMIQUE */}
              {isPlaylistPanelOpen && (
                <div style={{ background: '#1f1f1f', borderRadius: '12px', padding: '16px', marginTop: '15px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Création rapide tout en haut */}
                  <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
                    <input 
                      type="text" placeholder="Créer une playlist..." value={newPlaylistName} 
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      style={{ flex: 1, background: '#0f0f0f', border: '1px solid #444', padding: '8px 12px', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                    />
                    <button type="submit" style={{ background: '#fff', color: '#000', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Créer</button>
                  </form>

                  {/* Listes des playlists dynamiques et par défaut */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {playlists.map((pl) => (
                      <label key={pl.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '14px', cursor: 'pointer', padding: '4px 0' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedPlaylistsForVideo.includes(pl.id) || (pl.id === 'liked' && interaction === 'like')} 
                          disabled={pl.id === 'liked'} // Les likes sont gérés nativement par le bouton Like
                          onChange={() => toggleVideoInPlaylist(pl.id)}
                          style={{ accentColor: '#e50914', width: '16px', height: '16px' }}
                        />
                        {pl.title}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions de flux à droite */}
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

        {/* CONTENU ONGLETS ACCUEIL ET ABONNEMENTS */}
        {activeTab === 'accueil' && (
          <section><h2 className="tab-title">Accueil</h2><p style={{ color: '#aaa', fontSize: '14px' }}>Sélectionnez un créateur pour extraire son flux.</p></section>
        )}

        {activeTab === 'subscriptions' && (
          <section>
            {selectedChannel ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', background: '#1a1a1a', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
                  <img src={selectedChannel.thumbnail} alt={selectedChannel.title} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedChannel.title}</h2>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', borderBottom: '1px solid #222' }}>
                  <button onClick={() => setActiveSubTab('standard')} style={{ background: 'none', border: 'none', color: activeSubTab === 'standard' ? '#fff' : '#666', borderBottom: activeSubTab === 'standard' ? '2px solid #e50914' : '2px solid transparent', paddingBottom: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Vidéos</button>
                  <button onClick={() => setActiveSubTab('shorts')} style={{ background: 'none', border: 'none', color: activeSubTab === 'shorts' ? '#fff' : '#666', borderBottom: activeSubTab === 'shorts' ? '2px solid #e50914' : '2px solid transparent', paddingBottom: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Shorts ⚡</button>
                </div>

                {loadingVideos ? (
                  <div style={{ color: '#aaa', fontSize: '14px' }}>Extraction sécurisée en cours...</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: activeSubTab === 'shorts' ? 'repeat(auto-fill, minmax(160px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                    {processedVideos.map((video) => (
                      <div key={video.id} className="video-card" style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333', cursor: 'pointer' }} onClick={() => setCurrentVideo(video)}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: activeSubTab === 'shorts' ? '9/16' : '16/9' }}>
                          <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ padding: '12px' }}>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{video.title}</h4>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : <p style={{ color: '#aaa' }}>Sélectionnez une chaîne ci-dessous.</p>}
          </section>
        )}

        {activeTab === 'downloads' && (
          <section>
            <h2 className="tab-title">Téléchargements (Hors-ligne)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
              {downloadedVideos.map((video) => (
                <div key={video.id} className="video-card" style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }} onClick={() => setCurrentVideo(video)}>
                  <img src={video.thumbnail} alt={video.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                  <div style={{ padding: '12px' }}><h4 style={{ margin: 0, fontSize: '13px', color: '#fff' }}>{video.title}</h4></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section><button onClick={handleLogout} style={{ padding: '12px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Se déconnecter</button></section>
        )}
      </main>

      {/* NAVBAR STRUCTURELLE */}
      <nav className="navbar">
        <button onClick={() => { setActiveTab('accueil'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'accueil' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Accueil</span>
        </button>

        <div className="nav-item-wrapper">
          <button onClick={() => { setActiveTab('subscriptions'); setIsCascadeOpen(!isCascadeOpen); }} className={`nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`} style={{ width: '100%' }}>
            <svg className="nav-icon" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0-2-.9-2-2V4c0-1.1-.9-2-2-2z"/></svg><span>Abonnements</span>
          </button>
          <div className={`navbar-cascade ${isCascadeOpen ? 'open' : ''}`}>
            {subscriptions.map((sub) => (
              <div key={sub.id} className="nav-sub-item" onClick={() => { setActiveTab('subscriptions'); setSelectedChannel(sub); fetchVideosForChannel(sub.id, sub.thumbnail); setIsCascadeOpen(false); router.push(`?channel=${sub.id}`); }}>
                <img src={sub.thumbnail} alt={sub.title} className="nav-sub-avatar" />
                <span className="nav-sub-name">{sub.title}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => { setActiveTab('downloads'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'downloads' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg><span>Téléchargements</span>
        </button>

        <button onClick={() => { setActiveTab('profile'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}>
          {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="Profil" className="nav-icon" style={{ borderRadius: '50%', width: '24px', height: '24px' }} /> : <span>Vous</span>}
        </button>
      </nav>
    </div>
  )
}

export default function Home() {
  return (<Suspense fallback={<div className="auth-wrapper"><p className="loading-text">Chargement...</p></div>}><SimulatorApp /></Suspense>)
}