'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Vérifier si l'utilisateur est déjà connecté au chargement
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    
    checkUser()

    // 2. Écouter les changements d'état (connexion / déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fonction pour lancer la connexion Google
  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Redirige vers localhost ou ton URL Vercel automatiquement
      },
    })
  }

  // Fonction pour se déconnecter
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f0f] text-white">
        <p className="text-lg animate-pulse">Chargement...</p>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f0f] text-white px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-red-600 flex items-center justify-center gap-2">
          <span>🔻</span> YT Premium Simulator
        </h1>
        
        <p className="text-gray-400 text-sm">
          Profite de tes playlists hors-ligne, en arrière-plan et sans aucune publicité.
        </p>

        {!user ? (
          // Écran Déconnecté
          <div className="bg-[#1f1f1f] p-8 rounded-2xl shadow-xl border border-gray-800 space-y-4">
            <h2 className="text-xl font-semibold">Bienvenue</h2>
            <p className="text-xs text-gray-500">Connecte-toi avec Google pour synchroniser ton compte.</p>
            <button
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-medium py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors duration-200"
            >
              <img 
                src="https://www.svgrepo.com/show/475656/google-color.svg" 
                alt="Google logo" 
                className="w-5 h-5"
              />
              Se connecter avec Google
            </button>
          </div>
        ) : (
          // Écran Connecté
          <div className="bg-[#1f1f1f] p-8 rounded-2xl shadow-xl border border-gray-800 space-y-4">
            <div className="flex items-center gap-4 bg-[#2f2f2f] p-4 rounded-xl">
              {user.user_metadata.avatar_url && (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Avatar" 
                  className="w-12 h-12 rounded-full border border-gray-600"
                />
              )}
              <div className="text-left">
                <p className="font-semibold text-sm">{user.user_metadata.full_name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
            
            <div className="p-4 bg-green-900/20 text-green-400 rounded-xl text-xs font-medium border border-green-900">
              ⚡ Statut Premium Activé (Simulation)
            </div>

            <button
              onClick={handleLogout}
              className="w-full bg-transparent border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-red-900/20 hover:text-red-400 hover:border-red-900 transition-all"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </main>
  )
}