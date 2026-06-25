'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation' // <-- Import indispensable
import { useAppContext } from '../context/AppContext'
import { YouTubeSubscription } from '../types/youtube'


export default function Navbar() {
  const [isCascadeOpen, setIsCascadeOpen] = useState(false)
  const router = useRouter()
  const { subscriptions, fetchVideosForChannel, setSelectedChannel, setActiveSubTab } = useAppContext()

  const handleChannelClick = (sub: YouTubeSubscription) => {
    setSelectedChannel(sub)
    fetchVideosForChannel(sub.id, sub.thumbnail)
    setActiveSubTab('standard')
    
    router.push(`/channel/${sub.id}`)
  }

  return (
    <nav className="navbar">
      <Link href="/" className="nav-item">Accueil</Link>

      <div className="nav-item-wrapper">
        <button onClick={() => setIsCascadeOpen(!isCascadeOpen)} className="nav-item">
          Abonnements {isCascadeOpen ? '▲' : '▼'}
        </button>
        
        <div className={`navbar-cascade ${isCascadeOpen ? 'open' : ''}`}>
          {/* On définit le type de 'sub' ici même lors du mapping */}
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