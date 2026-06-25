'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAppContext } from '../context/AppContext'
import { YouTubeSubscription } from '../types/youtube'
import "./../styles/login.css"

export default function Navbar() {
  const [isCascadeOpen, setIsCascadeOpen] = useState(false)
  const router = useRouter()
  const { subscriptions, fetchVideosForChannel, setSelectedChannel, setActiveSubTab } = useAppContext()

  const handleChannelClick = (sub: YouTubeSubscription) => {
    setSelectedChannel(sub)
    fetchVideosForChannel(sub.id, sub.thumbnail)
    setActiveSubTab('standard')
    
    // Redirection dynamique vers la page de la chaîne
    router.push(`/channel/${sub.id}`)
  }

  return (
    <nav className="navbar">
      <Link href="/" className="nav-item">Accueil</Link>

      <div className="nav-item-wrapper">
        {/* BOUTON ABONNEMENTS : Redirige vers /subscriptions ET toggle l'accordéon */}
        <button 
          onClick={() => {
            router.push('/subscriptions');
            setIsCascadeOpen(!isCascadeOpen);
          }} 
          className="nav-item"
        >
          Abonnements {isCascadeOpen ? '▲' : '▼'}
        </button>
        
        {/* LISTE DES CHAÎNES DANS L'ACCORDÉON */}
        <div className={`navbar-cascade ${isCascadeOpen ? 'open' : ''}`}>
          {subscriptions.map((sub: YouTubeSubscription) => (
            <div 
              key={sub.id} 
              className="nav-sub-item" 
              onClick={() => handleChannelClick(sub)}
            >
              <img src={sub.thumbnail} alt={sub.title} className="nav-sub-avatar" />
              <span>{sub.title}</span>
            </div>
          ))}
        </div>
      </div>

      <Link href="/downloads" className="nav-item">Téléchargements</Link>
      <Link href="/profile" className="nav-item">Vous</Link>
    </nav>
  )
}