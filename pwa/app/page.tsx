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
    console.log("[YT Simulator] 🚀 useEffect principal initialisé");

    const checkUser = async () => {
      console.log("[YT Simulator] 🔍 Exécution de checkUser()...");
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log("[YT Simulator] 📊 Résultat de getSession() :", {
        userPresent: !!session?.user,
        email: session?.user?.email,
        providerTokenPresent: !!session?.provider_token,
        tokenPrefix: session?.provider_token ? session.provider_token.substring(0, 10) + "..." : "aucun"
      });

      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.provider_token) {
        console.log("[YT Simulator] ✅ Cas 1 : Token présent dans getSession(). Nettoyage du flag et chargement.");
        sessionStorage.removeItem('yt_sync_pending')
        fetchYouTubeSubscriptions(session.provider_token)
      } else if (session?.user) {
        const isSyncPending = sessionStorage.getItem('yt_sync_pending')
        console.log(`[YT Simulator] 🤔 Cas 2 : Utilisateur connecté mais PAS de token Google. Status du flag synchro: ${isSyncPending}`);

        if (isSyncPending === 'true') {
          // Si on revient de la redirection et que c'est toujours vide
          sessionStorage.removeItem('yt_sync_pending')
          console.warn("[YT Simulator] ⚠️ La synchronisation automatique a échoué à récupérer le jeton Google.");
        } else {
          console.log("[YT Simulator] 🔄 Flag absent. Tentative de synchronisation silencieuse via signInWithOAuth...");
          sessionStorage.setItem('yt_sync_pending', 'true')
          setLoadingSubs(true)

          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin,
              scopes: 'https://www.googleapis.com/auth/youtube.readonly',
              queryParams: { prompt: 'none' }, 
            },
          })
        }
      }
    }
    
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[YT Simulator] ⚡ onAuthStateChange déclenché - Événement: ${event}`, {
        userPresent: !!session?.user,
        providerTokenPresent: !!session?.provider_token,
        tokenPrefix: session?.provider_token ? session.provider_token.substring(0, 10) + "..." : "aucun"
      });

      setUser(session?.user ?? null)
      if (session?.provider_token) {
        console.log("[YT Simulator] 🎉 Jeton trouvé dans onAuthStateChange ! Nettoyage et chargement des abonnements...");
        sessionStorage.removeItem('yt_sync_pending')
        fetchYouTubeSubscriptions(session.provider_token)
      }
    })

    return () => {
      console.log("[YT Simulator] 🛑 Nettoyage du useEffect");
      subscription.unsubscribe()
    }
  }, [])

  // Récupération des vrais abonnements YouTube
  const fetchYouTubeSubscriptions = async (token: string) => {
    console.log("[YT Simulator] 📥 fetchYouTubeSubscriptions appelé avec le token:", token.substring(0, 10) + "...");
    setLoadingSubs(true)
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=25&order=alphabetical`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      console.log(`[YT Simulator] 📡 Réponse HTTP API YouTube: ${res.status} ${res.statusText}`);
      
      if (!res.ok) throw new Error(`Erreur API YouTube: ${res.status}`)
      
      const data = await res.json()
      console.log(`[YT Simulator] 📋 Données YouTube reçues. Nombre d'items:`, data.items?.length || 0);
      
      const formattedSubs = data.items.map((item: any) => ({
        id: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.default?.url || '',
      }))
      
      setSubscriptions(formattedSubs)
    } catch (err) {
      console.error("[YT Simulator] ❌ Erreur dans fetchYouTubeSubscriptions:", err)
    } finally {
      setLoadingSubs(false)
    }
  }

  const loginWithGoogle = async () => {
    console.log("[YT Simulator] 🔑 Clic sur Connexion manuelle Google");
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/youtube.readonly',
      },
    })
  }

  const handleLogout = async () => {
    console.log("[YT Simulator] 🚪 Déconnexion de l'application");
    sessionStorage.removeItem('yt_sync_pending')
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
      
      <main className="tab-content">
        {activeTab === 'accueil' && (
          <section>
            <h2 className="tab-title">Accueil</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>Ici s'affichera la grille principale.</p>
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