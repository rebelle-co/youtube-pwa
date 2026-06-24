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
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.provider_token) {
        fetchYouTubeSubscriptions(session.provider_token)
      }
    }
    
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.provider_token) {
        fetchYouTubeSubscriptions(session.provider_token)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Récupération des vrais abonnements YouTube de l'utilisateur
  const fetchYouTubeSubscriptions = async (token: string) => {
    setLoadingSubs(true)
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=25&order=alphabetical`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (!res.ok) throw new Error('Erreur API YouTube')
      
      const data = await res.json()
      
      const formattedSubs = data.items.map((item: any) => ({
        id: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.default?.url || '',
      }))
      
      setSubscriptions(formattedSubs)
    } catch (err) {
      console.warn("API YouTube bloquée ou token expiré. Chargement des données de test.")
      // Données de secours (Mock) pour le développement
      setSubscriptions([
        { id: 'ch1', title: 'Lofi Girl', thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80' },
        { id: 'ch2', title: 'DevCode Master', thumbnail: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80' },
        { id: 'ch3', title: 'Iron Workout', thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80' },
        { id: 'ch4', title: 'Tech Horizon', thumbnail: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80' }
      ])
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
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSubscriptions([])
    setIsCascadeOpen(false)
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
            Cette application modifie la réception de vos flux vidéo en extrayant uniquement le contenu média brut de vos abonnements. En contournant les scripts natifs des lecteurs tiers, elle neutralise l'affichage des publicités et active de façon fluide l'écoute en arrière-plan, le maintien audio écran éteint (MediaSession API) ainsi que la mise en cache locale pour vos playlists hors-ligne.
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
      
      <main className="tab-content">
        
        {activeTab === 'accueil' && (
          <section>
            <h2 className="tab-title">Accueil</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>
              Ici s'affichera la grille principale avec barre de recherche et vidéos tendances.
            </p>
          </section>
        )}

        {activeTab === 'downloads' && (
          <section>
            <h2 className="tab-title">Téléchargements</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>
              Vos musiques et vidéos enregistrées localement (Mode Hors-ligne).
            </p>
          </section>
        )}

        {activeTab === 'subscriptions' && (
          <section>
            <h2 className="tab-title">Abonnements</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>
              Vue globale ou gestion avancée de vos abonnements.
            </p>
          </section>
        )}

        {activeTab === 'profile' && (
          <section style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 className="tab-title">Vous</h2>
            <div className="user-profile">
              {user.user_metadata.avatar_url && (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="user-avatar" />
              )}
              <div className="user-info">
                <h3>{user.user_metadata.full_name}</h3>
                <p style={{ margin: '4px 0 0 0' }}>{user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-logout" style={{ width: '100%', marginTop: '16px' }}>
              Fermer la session (Déconnexion)
            </button>
          </section>
        )}

      </main>

      {/* ─── NAVBAR AVEC ACCORDÉON INTÉGRÉ ─── */}
      <nav className="navbar">
        <button onClick={() => { setActiveTab('accueil'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'accueil' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Accueil</span>
        </button>

        {/* CONTENEUR DU BOUTON ABONNEMENT + SA CASCADE */}
        <div className="nav-item-wrapper">
          <button 
            onClick={() => {
              setActiveTab('subscriptions');
              setIsCascadeOpen(!isCascadeOpen); // Ouvre ou ferme la cascade au clic
            }} 
            className={`nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <svg className="nav-icon" viewBox="0 0 24 24">
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0-2-.9-2-2V4c0-1.1-.9-2-2-2zm-1 7h-2v2h-2V9h-2V7h2V5h2v2h2v2z"/>
            </svg>
            <span>Abonnements {isCascadeOpen ? '▲' : '▼'}</span>
          </button>

          {/* LA CASCADE DE CHAÎNES DIRECTEMENT ICI */}
          <div className={`navbar-cascade ${isCascadeOpen ? 'open' : ''}`}>
            {loadingSubs ? (
              <div className="navbar-cascade-loading">Chargement...</div>
            ) : subscriptions.length === 0 ? (
              <div className="navbar-cascade-loading">Aucun abonnement</div>
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

        <button onClick={() => { setActiveTab('profile'); setIsCascadeOpen(false); }} className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5c0-4.71 3.95-6.2 6-6.2s8.5 1.49 8.5 4.2c0 1.71-1.39 3-3 3h-11.5z"/></svg>
          <span>Vous</span>
        </button>
      </nav>

    </div>
  )
}