'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppContext } from '../context/AppContext'
import { YouTubeSubscription } from '../types/youtube'
import "./../styles/login.css"

export default function Navbar({ isOpen }: { isOpen: boolean }) {
  const context = useAppContext();
  if (!context) return null;

  const [isCascadeOpen, setIsCascadeOpen] = useState(false)
  const router = useRouter()
  const { subscriptions, fetchVideosForChannel, setSelectedChannel, setActiveSubTab } = useAppContext()
  const navItems = [
    { name: 'Accueil', path: '/', icon: './../assets/home.svg', activeIcon: './../assets/is-home.svg' },
    { name: 'Abonnements', path: './../subscriptions', icon: './../assets/subscribes.svg', activeIcon: './../assets/subscribes.svg' }, // Même icône si pas de version "is-sub"
    { name: 'Téléchargements', path: '/downloads', icon: './../assets/home.svg', activeIcon: './../assets/is-home.svg' }, // Remplacez par vos fichiers
    { name: 'Vous', path: '/profile', icon: './../assets/you.svg', activeIcon: './../assets/is-you.svg' },
  ]
  const pathname = usePathname() // <-- Déclaration ajoutée

  const handleChannelClick = (sub: YouTubeSubscription) => {
    setSelectedChannel(sub)
    fetchVideosForChannel(sub.id, sub.thumbnail)
    setActiveSubTab('standard')
    
    // Redirection dynamique vers la page de la chaîne
    router.push(`/channel/${sub.id}`)
  }

  return (
    <nav className={`navbar ${isOpen ? 'expanded' : 'mini'}`}>
      {navItems.map((item) => {
        const isActive = pathname === item.path
        
        return (
          <button 
            key={item.path}
            onClick={() => router.push(item.path)} 
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <img 
              src={isActive ? item.activeIcon : item.icon} 
              alt={item.name} 
              className="nav-icon"
            />
            {isOpen && <span>{item.name}</span>}
          </button>
        )
      })}
      <button 
        onClick={() => {
          router.push('/');
        }} 
        className="nav-item"
      >
         Accueil
      </button>

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

      <button 
        onClick={() => {
          router.push('/downloads');
        }} 
        className="nav-item"
      >
         Téléchargements
      </button>

      <button 
        onClick={() => {
          router.push('/profile');
        }} 
        className="nav-item"
      >
         Vous
      </button>
    </nav>
  )
}