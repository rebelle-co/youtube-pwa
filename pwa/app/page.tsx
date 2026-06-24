'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import './styles/login.css'

type TabType = 'accueil' | 'downloads' | 'subscriptions' | 'profile'

interface YouTubeSubscription {
  id: string
  title: string
  thumbnail: string
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('accueil')
  
  // États pour la cascade d'abonnements
  const [subscriptions, setSubscriptions] = useState<YouTubeSubscription[]>([])
  const [isCascadeOpen, setIsCascadeOpen] = useState(false)
  const [loadingSubs, setLoadingSubs] = useState(false)

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

  const fetchYouTubeSubscriptions = async (token: string) => {
    setLoadingSubs(true)
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=25&order=alphabetical`,
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
      
      setSubscriptions(formattedSubs)
      console.log("[YT Simulator] 🎉 Abonnements chargés avec succès !");
    } catch (err) {
      console.error("[YT Simulator] Erreur lors du fetch YouTube :", err)
    } finally {
      setLoadingSubs(false)
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
    setIsCascadeOpen(false)
    setActiveTab('accueil') // Reset sur l'accueil pour le prochain login
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
            <h2 className="tab-title">Vos Abonnements</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>Sélectionnez une chaîne dans le menu du bas pour filtrer.</p>
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
                <div key={sub.id} className="nav-sub-item" onClick={() => console.log('Chaîne sélectionnée:', sub.id)}>
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