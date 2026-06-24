'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

// Liste de fausses vidéos pour donner l'effet "YouTube" dès l'accueil non-authentifié
const MOCK_VIDEOS = [
  {
    id: '1',
    title: 'Lofi Hip Hop Radio 📚 Musique pour Étudier / Se Relaxer',
    channel: 'Lofi Girl',
    views: '4,2 M de vues',
    time: 'En direct',
    duration: 'LIVE',
    thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&q=80',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80'
  },
  {
    id: '2',
    title: 'NEXT.JS 15 MASTERCLASS - Apprends à coder comme un Pro',
    channel: 'DevCode',
    views: '120 k vues',
    time: 'il y a 3 jours',
    duration: '24:15',
    thumbnail: 'https://images.unsplash.com/photo-1618401471353-b98aedd07871?w=500&q=80',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80'
  },
  {
    id: '3',
    title: 'Calisthenics : Routine Ultime au poids du corps (Full Body)',
    channel: 'Iron Workout',
    views: '890 k vues',
    time: 'il y a 2 mois',
    duration: '12:40',
    thumbnail: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&q=80',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80'
  },
  {
    id: '4',
    title: 'Cette IA va-t-elle remplacer les Développeurs Web en 2026 ?',
    channel: 'Tech Horizon',
    views: '1,5 M de vues',
    time: 'il y a 1 semaine',
    duration: '18:02',
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=500&q=80',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80'
  }
]

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
      <div className="flex h-screen items-center justify-center bg-[#0f0f0f] text-white">
        <p className="text-lg animate-pulse font-medium tracking-wide">Chargement de l'expérience...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white flex flex-col">
      
      {/* ─── NAVBAR COMMUNE (DESKTOP & MOBILE) ─── */}
      <header className="w-full h-16 bg-[#0f0f0f]/90 backdrop-blur-md border-b border-gray-900 sticky top-0 z-50 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2 cursor-pointer">
          <span className="text-2xl">🔻</span>
          <h1 className="text-xl font-bold tracking-tighter text-white hidden sm:block">
            YT Premium <span className="text-red-600">Simulator</span>
          </h1>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#1f1f1f] py-1.5 px-3 rounded-full border border-gray-800">
              {user.user_metadata.avatar_url && (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-6 h-6 rounded-full" />
              )}
              <span className="text-xs font-medium hidden md:inline">{user.user_metadata.full_name}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-xs bg-transparent border border-gray-800 hover:border-red-600 hover:text-red-500 py-2 px-3 rounded-xl transition-all"
            >
              Déconnexion
            </button>
          </div>
        ) : (
          <button
            onClick={loginWithGoogle}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs md:text-sm py-2 px-4 rounded-full transition-all shadow-lg shadow-red-600/10"
          >
            Se connecter
          </button>
        )}
      </header>

      {/* ─── CONTENU PRINCIPAL ─── */}
      {!user ? (
        // ─── ÉCRAN DECONNECTÉ (LANDING + MOCK FEED) ───
        <div className="flex-1 flex flex-col">
          
          {/* Hero Section Banner */}
          <section className="w-full max-w-7xl mx-auto px-4 pt-10 pb-8 text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-red-600/10 text-red-500 text-xs px-3 py-1 rounded-full border border-red-500/20 font-medium">
              🚀 Version PWA Mobile & Desktop opérationnelle
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight max-w-2xl mx-auto leading-tight">
              Le streaming YouTube pur. <br />
              <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                Sans aucune publicité.
              </span>
            </h2>
            <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto">
              Écran éteint, lecture en arrière-plan et playlists hors-ligne. Synchronise tes abonnements en un clic.
            </p>
            
            <div className="pt-2">
              <button
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-3 bg-white text-black font-semibold py-3.5 px-6 rounded-2xl hover:bg-gray-100 transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-xl"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                Débloquer le mode Premium Gratuit
              </button>
            </div>
          </section>

          {/* Grille de Vidéos (Faux Feed) */}
          <section className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 pb-16">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-300 border-t border-gray-900 pt-8">
              🔥 Contenus Tendances
            </h3>
            
            {/* Grille responsive : 1 col sur mobile, 2 sur tablette, 3-4 sur grand écran */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {MOCK_VIDEOS.map((video) => (
                <div 
                  key={video.id} 
                  onClick={loginWithGoogle}
                  className="group cursor-pointer flex flex-col space-y-3 bg-[#171717]/40 p-2 rounded-2xl border border-transparent hover:bg-[#171717] hover:border-gray-800 transition-all duration-200"
                >
                  {/* Miniature & Durée */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-gray-900">
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className={`absolute bottom-2 right-2 text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      video.duration === 'LIVE' ? 'bg-red-600 text-white' : 'bg-black/80 text-white'
                    }`}>
                      {video.duration}
                    </span>
                  </div>

                  {/* Infos Vidéo */}
                  <div className="flex gap-3 px-1">
                    <img src={video.avatar} alt="Avatar chaîne" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    <div className="flex flex-col">
                      <h4 className="text-sm font-semibold line-clamp-2 text-gray-100 group-hover:text-red-500 transition-colors leading-tight">
                        {video.title}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1.5 font-medium">{video.channel}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {video.views} • {video.time}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      ) : (
        // ─── ÉCRAN CONNECTÉ (TABLEAU DE BORD / FEED USER TEMP) ───
        <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-12 text-center space-y-6">
          <div className="bg-[#1f1f1f] p-8 rounded-3xl shadow-2xl border border-gray-800 space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center text-2xl mx-auto border border-green-500/20">
              ✓
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Connexion Réussie !</h2>
              <p className="text-xs text-gray-400">Ton pass d'authentification Google avec accès YouTube est actif.</p>
            </div>

            <div className="p-4 bg-green-950/40 text-green-400 rounded-2xl text-xs font-semibold border border-green-900/50 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
              Mode Anti-Pub & Écran Éteint Prêt
            </div>

            <div className="text-gray-400 text-sm pt-2">
              Prochaine étape : Brancher l'API YouTube v3 pour charger ton vrai feed d'abonnements ici.
            </div>
          </div>
        </div>
      )}

      {/* Mini-Footer Mobile Déco */}
      <footer className="w-full text-center py-4 border-t border-gray-950 text-[11px] text-gray-600 mt-auto bg-[#090909]">
        YT Premium Simulator — Conçu pour iOS Safari PWA & Desktop Chrome
      </footer>

    </main>
  )
}