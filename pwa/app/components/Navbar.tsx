'use client'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAppContext } from '../context/AppContext'
import { YouTubeSubscription } from '../types/youtube'
import "./../styles/login.css"

export default function Navbar({ isOpen }: { isOpen: boolean }) {
  const context = useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  
  // On stocke le nom du menu ouvert au lieu d'un simple booléen
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  
  if (!context) return null;
  const { subscriptions, fetchVideosForChannel, setSelectedChannel, setActiveSubTab } = context;

  const navItems = [
    { name: 'Accueil', path: '/', icon: './assets/home.svg', activeIcon: './assets/is-home.svg' },
    { name: 'Shorts', path: '/shorts', icon: './assets/shorts.svg', activeIcon: './assets/is-shorts.svg' },
    { name: 'Abonnements', path: '/subscriptions', icon: './assets/subscribes.svg', activeIcon: './assets/is-subscribes.svg', hasToggle: true },
    { name: 'Vous', path: '/profile', icon: './assets/you.svg', activeIcon: './assets/is-you.svg', hasToggle: true },
  ]

  const handleToggle = (e: React.MouseEvent, name: string) => {
    e.stopPropagation(); // Empêche la propagation vers le bouton de navigation
    setOpenMenu(openMenu === name ? null : name);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleChannelClick = (sub: YouTubeSubscription) => {
    setSelectedChannel(sub)
    fetchVideosForChannel(sub.id, sub.thumbnail)
    setActiveSubTab('standard')
    router.push(`/channel/${sub.id}`)
  }

  return (
    <nav className={`navbar ${isOpen ? 'expanded' : 'mini'}`}>
      {navItems.map((item) => {
        const isActive = pathname === item.path
        
        return (
          <div key={item.path} className="nav-group">
            <button 
              onClick={() => handleNavigation(item.path)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <img src={isActive ? item.activeIcon : item.icon} alt={item.name} className="nav-icon" />
              <span className="nav-text">{item.name}</span>
              
              {/* Flèche avec gestion de clic séparée */}
              {isOpen && item.hasToggle && (
                <span className="nav-arrow" onClick={(e) => handleToggle(e, item.name)}>
                  {openMenu === item.name ? '▲' : '▼'}
                </span>
              )}
            </button>

            {/* Cascade dynamique */}
            {isOpen && openMenu === item.name && item.name === 'Abonnements' && (
              <div className="navbar-cascade">
                {subscriptions.map((sub: YouTubeSubscription) => (
                  <div key={sub.id} className="nav-sub-item" onClick={() => handleChannelClick(sub)}>
                    <img src={sub.thumbnail} alt={sub.title} className="nav-sub-avatar" />
                    <span>{sub.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}