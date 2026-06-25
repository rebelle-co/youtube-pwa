'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation' // ◄ AJOUT : Imports Next.js Navigation
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

export default function Home() {
  const router = useRouter() // ◄ AJOUT : Initialisation du router
  const searchParams = useSearchParams() // ◄ AJOUT : Lecture des paramètres d'URL
  const channelParam = searchParams.get('channel') // ◄ AJOUT : Récupération du paramètre ?channel=...

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

  // ÉFFET 1 : Initialisation de l'authentification
  useEffect(() => {
    console.log("[YT Simulator] 🚀 Initialisation du composant");

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.provider_token) {
        console.log("[YT Simulator] 📥 Token frais reçu de Supabase. Sauvegarde locale...");
        localStorage.setItem('yt_oauth_token', session.provider_token)
        setUser(session.user)
        fetchYouTubeSubscriptions(session.provider_token)
      } else if (session?.user) {
        setUser(session.user)
        const savedToken = localStorage.getItem('yt_oauth_token')
        
        if (savedToken) {
          console.log("[YT Simulator] 💾 Récupération du token depuis le localStorage secondaire !");
          fetchYouTubeSubscriptions(savedToken)
        } else {
          console.warn("[YT Simulator] ❌ Utilisateur connecté mais aucun token Google trouvé. Relance automatique du flux...");
          loginWithGoogle()
          return
        }
      }
      setLoading(false)
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[YT Simulator] ⚡ Événement Auth détecté: ${event}`);
      
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

  // ◄ AJOUT : ÉFFET 2 : Restauration de la chaîne active depuis l'URL après un reload
  useEffect(() => {
    if (subscriptions.length > 0 && channelParam && !selectedChannel) {
      const savedChannel = subscriptions.find(sub => sub.id === channelParam)
      if (savedChannel) {
        console.log(`[YT Simulator] 🔄 Restauration de la chaîne active depuis l'URL : ${savedChannel.title}`);
        setSelectedChannel(savedChannel)
        setActiveTab('subscriptions')
        setIsCascadeOpen(true) // Optionnel : ouvre l'accordéon pour montrer la sélection
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
          console.warn("[YT Simulator] ⏰ Le token Google a expiré. Nettoyage et demande de reconnexion.")
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

        if (data.nextPageToken) {
          nextPageToken = data.nextPageToken
        } else {
          hasNextPage = false
        }
      }
      
      setSubscriptions(allSubs)
      console.log(`[YT Simulator] 🎉 ${allSubs.length} abonnements chargés avec succès !`);
    } catch (err) {
      console.error("[YT Simulator] Erreur lors du fetch YouTube :", err)
    } finally {
      setLoadingSubs(false)
    }
  }

  const checkIfShort = (isoDuration: string): boolean => {
    if (!isoDuration || isoDuration.includes('H')) return false 
    const minutesMatch = isoDuration.match(/(\d+)M/)
    const secondsMatch = isoDuration.match(/(\d+)S/)
    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0
    const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 0
    return (minutes * 60) + seconds <= 60
  }

  const fetchVideosForChannel = async (channelId: string, channelThumbnail?: string) => {
    setLoadingVideos(true)
    try {
      const token = localStorage.getItem('yt_oauth_token')
      if (!token) {
        loginWithGoogle()
        return
      }

      console.log(`[YT Simulator] 🔍 Récupération des vidéos existantes en DB pour le canal ${channelId}...`);
      const { data: cachedVideos, error: dbError } = await supabase
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

      console.log(`[YT Simulator] 🛰️ Vérification des compteurs de vidéos...`);
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
      const dbVideoCount = formattedCached.length

      console.log(`[YT Simulator] 📊 Comparatif Totaux -> YouTube: ${ytVideoCount} | Base de données: ${dbVideoCount}`);

      if (ytVideoCount === dbVideoCount) {
        console.log(`[YT Simulator] ✅ Synchro parfaite détectée (${ytVideoCount} vidéos). Rendu basé sur la DB locale.`);
        setLoadingVideos(false)
        return
      }

      console.log(`[YT Simulator] 🔄 Différence détectée. Récupération de la liste complète pour synchronisation...`);
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

        if (data.nextPageToken) {
          nextPageToken = data.nextPageToken
        } else {
          hasNextPage = false
        }
      }

      if (allPlaylistVideoIds.length === 0) {
        setLoadingVideos(false)
        return
      }

      const cachedIdsSet = new Set(formattedCached.map(v => v.id))
      const missingVideoIds = allPlaylistVideoIds.filter(id => !cachedIdsSet.has(id))

      console.log(`[YT Simulator] 📊 Résultat : ${missingVideoIds.length} vidéos manquantes à intégrer.`);

      if (missingVideoIds.length > 0) {
        for (let i = 0; i < missingVideoIds.length; i += 50) {
          const chunk = missingVideoIds.slice(i, i + 50)
          console.log(`[YT Simulator] 📥 Fetching des détails pour un chunk de ${chunk.length} vidéos manquantes...`);

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
            if (classificationRes.ok) {
              realTypes = await classificationRes.json()
            }

            const dbInserts: any[] = []
            const formattedChunk: YouTubeVideo[] = []

            detailsData.items.forEach((item: any) => {
              const finalType = realTypes[item.id] || 'standard'
              const isShort = finalType === 'shorts'

              const thumbnail = isShort 
                ? (item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '')
                : (item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '')

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
              const { error: upsertError } = await supabase.from('videos').upsert(dbInserts)
              if (upsertError) console.error("[YT Simulator] Erreur insertion Supabase :", upsertError)
            }

            setVideos((prevVideos) => {
              const newCombined = [...prevVideos, ...formattedChunk]
              return newCombined.sort((a, b) => new Date(b.rawPublishedAt).getTime() - new Date(a.rawPublishedAt).getTime())
            })
          }
        }
        console.log(`[YT Simulator] 🎉 Synchronisation complète terminée !`);
      }

    } catch (err) {
      console.error("[YT Simulator] Erreur lors du traitement des vidéos :", err)
    } finally {
      setLoadingVideos(false)
    }
  }

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        scopes: 'https://www.googleapis.com/auth/youtube.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account' 
        }
      },
    })
  }

  const handleLogout = async () => {
    console.log("[YT Simulator] 🚪 Déconnexion complète.");
    localStorage.removeItem('yt_oauth_token')
    await supabase.auth.signOut()
    setSubscriptions([])
    setVideos([])
    setSelectedChannel(null)
    setIsCascadeOpen(false)
    setActiveTab('accueil')
    setActiveSubTab('standard')
    router.push('/') // ◄ AJOUT : Nettoie les query params de l'URL à la déconnexion
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
      if (currentFilter === 'recent') {
        return new Date(b.rawPublishedAt).getTime() - new Date(a.rawPublishedAt).getTime()
      }
      if (currentFilter === 'old') {
        return new Date(a.rawPublishedAt).getTime() - new Date(b.rawPublishedAt).getTime()
      }
      if (currentFilter === 'popular') {
        return (b.viewCount || 0) - (a.viewCount || 0)
      }
      return 0
    })

  return (
    <div className="app-container">
      
      {/* ─── CONTENU DYNAMIQUE DES ONGLETS ─── */}
      <main className="tab-content">
        {activeTab === 'accueil' && (
          <section>
            <h2 className="tab-title">Accueil</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>Ici s'affichera la grille principale des vidéos.</p>
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
                  <button 
                    onClick={() => setActiveSubTab('standard')} 
                    style={{
                      background: 'none',
                      border: 'none',
                      color: activeSubTab === 'standard' ? '#fff' : '#666',
                      borderBottom: activeSubTab === 'standard' ? '2px solid #e50914' : '2px solid transparent',
                      paddingBottom: '10px',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Vidéos
                  </button>
                  <button 
                    onClick={() => setActiveSubTab('shorts')} 
                    style={{
                      background: 'none',
                      border: 'none',
                      color: activeSubTab === 'shorts' ? '#fff' : '#666',
                      borderBottom: activeSubTab === 'shorts' ? '2px solid #e50914' : '2px solid transparent',
                      paddingBottom: '10px',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Shorts ⚡
                  </button>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  padding: '0 4px',
                  fontFamily: 'Roboto, "Arial", sans-serif',
                  fontSize: '13px'
                }}>
                  <button 
                    onClick={() => setFilters(prev => ({ ...prev, [activeSubTab]: 'recent' }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: currentFilter === 'recent' ? '#fff' : '#666',
                      fontWeight: currentFilter === 'recent' ? 'bold' : 'normal',
                      cursor: 'pointer',
                      padding: '5px 0',
                      fontFamily: 'inherit'
                    }}
                  >
                    Les plus récentes
                  </button>
                  <button 
                    onClick={() => setFilters(prev => ({ ...prev, [activeSubTab]: 'popular' }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: currentFilter === 'popular' ? '#fff' : '#666',
                      fontWeight: currentFilter === 'popular' ? 'bold' : 'normal',
                      cursor: 'pointer',
                      padding: '5px 0',
                      fontFamily: 'inherit'
                    }}
                  >
                    Populaires
                  </button>
                  <button 
                    onClick={() => setFilters(prev => ({ ...prev, [activeSubTab]: 'old' }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: currentFilter === 'old' ? '#fff' : '#666',
                      fontWeight: currentFilter === 'old' ? 'bold' : 'normal',
                      cursor: 'pointer',
                      padding: '5px 0',
                      fontFamily: 'inherit'
                    }}
                  >
                    Les plus anciennes
                  </button>
                </div>

                {loadingVideos && processedVideos.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: '14px' }}>Extraction et classification des flux médias bruts...</div>
                ) : processedVideos.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: '14px' }}>Aucun contenu disponible dans cette catégorie.</div>
                ) : (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: activeSubTab === 'shorts' 
                      ? 'repeat(auto-fill, minmax(160px, 1fr))' 
                      : 'repeat(auto-fill, minmax(260px, 1fr))', 
                    gap: '20px' 
                  }}>
                    {processedVideos.map((video) => (
                      <div 
                        key={video.id} 
                        className="video-card" 
                        style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333', cursor: 'pointer' }} 
                        onClick={() => console.log("Lecture de la vidéo :", video.id)}
                      >
                        <div style={{ position: 'relative', width: '100%', aspectRatio: activeSubTab === 'shorts' ? '9/16' : '16/9' }}>
                          <img 
                            src={video.thumbnail} 
                            alt={video.title} 
                            style={{ 
                              width: '100%', 
                              height: '100%',
                              objectFit: 'cover' 
                            }} 
                          />
                          {video.duration && (
                            <span style={{
                              position: 'absolute',
                              bottom: '6px',
                              right: '6px',
                              backgroundColor: 'rgba(0, 0, 0, 0.75)',
                              color: '#fff',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '500',
                              fontFamily: 'Roboto, "Arial", sans-serif'
                            }}>
                              {video.duration}
                            </span>
                          )}
                        </div>

                        <div style={{ padding: '12px' }}>
                          <h4 style={{ 
                            margin: '0 0 6px 0', 
                            fontSize: '13px', 
                            color: '#fff', 
                            fontFamily: 'Roboto, "Arial", sans-serif',
                            display: '-webkit-box', 
                            WebkitLineClamp: 2, 
                            WebkitBoxOrient: 'vertical', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            lineHeight: '1.4' 
                          }}>
                            {video.title}
                          </h4>
                          
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            color: '#777', 
                            fontSize: '11px',
                            fontFamily: 'Roboto, "Arial", sans-serif' 
                          }}>
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
            <h2 className="tab-title">Téléchargements</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>Aucun contenu téléchargé pour le moment.</p>
          </section>
        )}

        {activeTab === 'profile' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 className="tab-title">Mon Profil</h2>
            
            <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                {user.user_metadata?.avatar_url && (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Avatar" 
                    style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid red' }}
                  />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{user.user_metadata?.full_name || 'Utilisateur'}</h3>
                  <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>{user.email}</p>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '20px 0' }} />

              <button 
                onClick={handleLogout} 
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#e50914',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#b81d24')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#e50914')}
              >
                Se déconnecter de l'application
              </button>
            </div>
          </section>
        )}
      </main>

      {/* ─── NAVBAR AVEC ACCORDÉON INTÉGRÉ ─── */}
      <nav className="navbar">
        <button onClick={() => { setActiveTab('accueil'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'accueil' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Accueil</span>
        </button>

        <div className="nav-item-wrapper">
          <button 
            onClick={() => {
              setActiveTab('subscriptions');
              setIsCascadeOpen(!isCascadeOpen);
            }} 
            className={`nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <svg className="nav-icon" viewBox="0 0 24 24">
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0-2-.9-2-2V4c0-1.1-.9-2-2-2zm-1 7h-2v2h-2V9h-2V7h2V5h2v2h2v2z"/>
            </svg>
            <span>Abonnements {isCascadeOpen ? '▲' : '▼'}</span>
          </button>

          <div className={`navbar-cascade ${isCascadeOpen ? 'open' : ''}`}>
            {loadingSubs ? (
              <div className="navbar-cascade-loading">Mise à jour automatique...</div>
            ) : subscriptions.length === 0 ? (
              <div className="navbar-cascade-loading">Aucun abonnement trouvé</div>
            ) : (
              subscriptions.map((sub) => (
                <div 
                  key={sub.id} 
                  className="nav-sub-item" 
                  style={{ 
                    background: selectedChannel?.id === sub.id ? '#333' : 'transparent',
                    cursor: 'pointer' 
                  }}
                  onClick={() => {
                    setActiveTab('subscriptions');
                    setSelectedChannel(sub);      
                    fetchVideosForChannel(sub.id, sub.thumbnail);
                    setActiveSubTab('standard'); 
                    router.push(`?channel=${sub.id}`); // ◄ AJOUT : Met à jour l'URL avec l'ID de la chaîne
                  }}
                >
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

        <button 
          onClick={() => { setActiveTab('profile'); setIsCascadeOpen(false); }} 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        >
          {user?.user_metadata?.avatar_url ? (
            <img 
              src={user.user_metadata.avatar_url} 
              alt="Mon profil" 
              className="nav-icon" 
              style={{ 
                borderRadius: '50%', 
                objectFit: 'cover',
                width: '24px',
                height: '24px' 
              }} 
            />
          ) : (
            <svg className="nav-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          )}
          <span>Vous</span>
        </button>
      </nav>
    </div>
  )
}