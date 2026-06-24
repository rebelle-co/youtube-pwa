'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import './styles/login.css'

type TabType = 'accueil' | 'downloads' | 'subscriptions' | 'profile'
type SubTabType = 'standard' | 'shorts'

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
  type: SubTabType // 'standard' ou 'shorts'
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('accueil')
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('standard')
  
  // États pour la cascade d'abonnements
  const [subscriptions, setSubscriptions] = useState<YouTubeSubscription[]>([])
  const [isCascadeOpen, setIsCascadeOpen] = useState(false)
  const [loadingSubs, setLoadingSubs] = useState(false)

  // États pour récupérer les vidéos d'une chaîne
  const [selectedChannel, setSelectedChannel] = useState<YouTubeSubscription | null>(null)
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)

  useEffect(() => {
    console.log("[YT Simulator] 🚀 Initialisation du composant");

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.provider_token) {
        console.log("[YT Simulator] 📥 Token reçu de Supabase. Sauvegarde locale...");
        localStorage.setItem('yt_oauth_token', session.provider_token)
        fetchYouTubeSubscriptions(session.provider_token)
      } else if (session?.user) {
        const savedToken = localStorage.getItem('yt_oauth_token')
        
        if (savedToken) {
          console.log("[YT Simulator] 💾 Récupération du token depuis le localStorage secondaire !");
          fetchYouTubeSubscriptions(savedToken)
        } else {
          console.warn("[YT Simulator] ❌ Utilisateur connecté mais aucun token Google trouvé. Reconnexion requise.");
        }
      }
    }
    
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.provider_token) {
        console.log(`[YT Simulator] ⚡ Événement Auth: ${event} -> Token détecté et sauvegardé.`);
        localStorage.setItem('yt_oauth_token', session.provider_token)
        fetchYouTubeSubscriptions(session.provider_token)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Récupération de TOUS les abonnements YouTube via pagination
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
          console.warn("[YT Simulator] ⏰ Le token Google a expiré.")
          localStorage.removeItem('yt_oauth_token')
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

  // Helper pour parser la durée ISO 8601 de YouTube (ex: PT1M15S) et vérifier si c'est un Short (<= 60s)
  const checkIfShort = (isoDuration: string): boolean => {
    if (!isoDuration || isoDuration.includes('H')) return false // Plus d'une heure -> standard
    const minutesMatch = isoDuration.match(/(\d+)M/)
    const secondsMatch = isoDuration.match(/(\d+)S/)
    
    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0
    const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 0
    
    const totalSeconds = (minutes * 60) + seconds
    return totalSeconds <= 60
  }

  // Récupération de TOUTES les vidéos d'une chaîne + triage Shorts vs Standard
  const fetchVideosForChannel = async (channelId: string) => {
    const token = localStorage.getItem('yt_oauth_token')
    if (!token) return

    setLoadingVideos(true)
    try {
      const uploadsPlaylistId = 'UU' + channelId.substring(2)
      let rawItems: any[] = []
      let nextPageToken = ''
      let hasNextPage = true
      let pageCount = 0 // Sécurité performance : on limite à 3 pages max (~150 vidéos récentes)
      
      // 1. On boucle pour récupérer les vidéos brutes de la playlist d'uploads
      while (hasNextPage && pageCount < 3) {
        const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : ''
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50${pageParam}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!res.ok) throw new Error('Erreur API YouTube Videos Playlist')
        const data = await res.json()
        rawItems = [...rawItems, ...data.items]

        if (data.nextPageToken) {
          nextPageToken = data.nextPageToken
          pageCount++
        } else {
          hasNextPage = false
        }
      }

      if (rawItems.length === 0) {
        setVideos([])
        return
      }

      // 2. Hydratation : L'API playlistItems ne donne pas la durée. On regroupe les IDs par packs de 50 pour demander leurs détails.
      const videoIds = rawItems.map((item: any) => item.snippet.resourceId.videoId)
      let detailedVideos: YouTubeVideo[] = []

      for (let i = 0; i < videoIds.length; i += 50) {
        const chunk = videoIds.slice(i, i + 50)
        const detailsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${chunk.join(',')}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (detailsRes.ok) {
          const detailsData = await detailsRes.json()
          const formattedChunk = detailsData.items.map((item: any) => {
            const duration = item.contentDetails?.duration || ''
            const isShort = checkIfShort(duration)

            return {
              id: item.id,
              title: item.snippet.title,
              thumbnail: isShort 
                ? (item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '')
                : (item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || ''),
              publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString('fr-FR'),
              type: isShort ? 'shorts' : 'standard'
            }
          })
          detailedVideos = [...detailedVideos, ...formattedChunk]
        }
      }

      setVideos(detailedVideos)
      console.log(`[YT Simulator] 📺 Flux trié chargé : ${detailedVideos.length} vidéos trouvées.`);
    } catch (err) {
      console.error("[YT Simulator] Erreur lors du fetch des vidéos :", err)
    } finally {
      setLoadingVideos(false)
    }
  }

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/youtube.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
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

  // Filtrage des vidéos selon le sous-onglet sélectionné
  const filteredVideos = videos.filter(video => video.type === activeSubTab)

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
                {/* En-tête de la chaîne sélectionnée */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', background: '#1a1a1a', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
                  <img src={selectedChannel.thumbnail} alt={selectedChannel.title} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedChannel.title}</h2>
                    <span style={{ color: '#e50914', fontSize: '12px', fontWeight: 'bold' }}>Flux extrait avec succès ✔</span>
                  </div>
                </div>

                {/* ─── SYSTÈME DE SOUS-ONGLETS (VIDEOS / SHORTS) ─── */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', borderBottom: '1px solid #222' }}>
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

                {loadingVideos ? (
                  <div style={{ color: '#aaa', fontSize: '14px' }}>Extraction et classification des flux médias bruts...</div>
                ) : filteredVideos.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: '14px' }}>Aucun contenu disponible dans cette catégorie.</div>
                ) : (
                  /* Grille adaptative : layout horizontal classique pour vidéos, vertical fin pour les shorts */
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: activeSubTab === 'shorts' 
                      ? 'repeat(auto-fill, minmax(160px, 1fr))' 
                      : 'repeat(auto-fill, minmax(260px, 1fr))', 
                    gap: '20px' 
                  }}>
                    {filteredVideos.map((video) => (
                      <div 
                        key={video.id} 
                        className="video-card" 
                        style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333', cursor: 'pointer' }} 
                        onClick={() => console.log("Lecture de la vidéo :", video.id)}
                      >
                        <img 
                          src={video.thumbnail} 
                          alt={video.title} 
                          style={{ 
                            width: '100%', 
                            aspectRatio: activeSubTab === 'shorts' ? '9/16' : '16/9', 
                            objectFit: 'cover' 
                          }} 
                        />
                        <div style={{ padding: '12px' }}>
                          <h4 style={{ 
                            margin: '0 0 8px 0', 
                            fontSize: '13px', 
                            color: '#fff', 
                            display: '-webkit-box', 
                            WebkitLineClamp: 2, 
                            WebkitBoxOrient: 'vertical', 
                            overflow: 'hidden', 
                            lineHeight: '1.4' 
                          }}>
                            {video.title}
                          </h4>
                          <span style={{ color: '#777', fontSize: '11px' }}>{video.publishedAt}</span>
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
                    fetchVideosForChannel(sub.id); 
                    setActiveSubTab('standard'); // Reset par défaut sur vidéos classiques
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
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5c0-4.71 3.95-6.2 6-6.2s8.5 1.49 8.5 4.2c0 1.71-1.39 3-3 3h-11.5z"/>
            </svg>
          )}
          <span>Vous</span>
        </button>
      </nav>

    </div>
  )
}