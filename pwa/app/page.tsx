'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import './styles/login.css' // Importation directe de tes styles CSS

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

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
  }

  if (loading) {
    return (
      <div className="auth-wrapper">
        <p className="loading-text">Chargement du simulateur...</p>
      </div>
    )
  }

  return (
    <main className="auth-wrapper">
      <div className="auth-card">
        
        {/* Nom du site (Brand) */}
        <div className="site-brand">
          <span>🔻</span> YT Premium Simulator
        </div>

        {!user ? (
          // ─── APPARENCE DÉCONNECTÉE (CENTRE UNIQUE) ───
          <>
            {/* Titre accrocheur et vague */}
            <h2 className="site-title">
              L'expérience de streaming, purifiée.
            </h2>

            {/* Description complète de l'application */}
            <p className="site-description">
              Cette application modifie la réception de vos flux vidéo en extrayant uniquement le contenu média brut de vos abonnements. En contournant les scripts natifs des lecteurs tiers, elle neutralise l'affichage des publicités et active de façon fluide l'écoute en arrière-plan, le maintien audio écran éteint (MediaSession API) ainsi que la mise en cache locale pour vos playlists hors-ligne.
            </p>

            {/* Bouton de connexion Google */}
            <button onClick={loginWithGoogle} className="btn-google">
              <img 
                src="https://www.svgrepo.com/show/475656/google-color.svg" 
                alt="Google icon" 
                className="google-icon"
              />
              Se connecter avec Google
            </button>
          </>
        ) : (
          // ─── APPARENCE CONNECTÉE (STATUT) ───
          <>
            <h2 className="site-title" style={{ fontSize: '24px' }}>Session Active</h2>
            <p className="site-description" style={{ marginBottom: '20px' }}>
              Votre compte est associé avec succès aux passerelles Google et Supabase Auth.
            </p>

            <div className="user-profile">
              {user.user_metadata.avatar_url && (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="user-avatar" />
              )}
              <div className="user-info">
                <h3>{user.user_metadata.full_name}</h3>
                <p>{user.email}</p>
              </div>
            </div>

            <button onClick={handleLogout} className="btn-logout">
              Fermer la session
            </button>
          </>
        )}

      </div>
    </main>
  )
}