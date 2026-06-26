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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  
  if (!context) return null;
  const { subscriptions, fetchVideosForChannel, setSelectedChannel, setActiveSubTab } = context;

  const navItems = [
    { name: 'Accueil', path: '/', icon: '/assets/home.svg', activeIcon: '/assets/is-home.svg' },
    { name: 'Shorts', path: '/shorts', icon: '/assets/shorts.svg', activeIcon: '/assets/is-shorts.svg' },
    { name: 'Abonnements', path: '/subscriptions', icon: '/assets/subscribes.svg', activeIcon: '/assets/is-subscribes.svg', hasToggle: true },
    { name: 'Vous', path: '/profile', icon: '/assets/you.svg', activeIcon: '/assets/is-you.svg', hasToggle: true },
  ]

  const handleToggle = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setOpenMenu(openMenu === name ? null : name);
  };

  const handleChannelClick = (sub: YouTubeSubscription) => {
    // Juste naviguer, ne pas manipuler le contexte ici
    router.push(`/channel/${sub.id}`)
  }


  return (
    <nav className={`navbar ${isOpen ? 'expanded' : 'mini'}`}>
      {navItems.map((item) => {
        const isActive = pathname === item.path
        const isMenuOpen = openMenu === item.name;

        return (
          <div key={item.path} className="nav-group">
            <button 
              onClick={() => router.push(item.path)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <img src={isActive ? item.activeIcon : item.icon} alt={item.name} className="nav-icon" />
              {isOpen && <span className="nav-text">{item.name}</span>}
              
              {isOpen && item.hasToggle && (
                <span className="nav-arrow" onClick={(e) => handleToggle(e, item.name)}>
                  {isMenuOpen ? '▲' : '▼'}
                </span>
              )}
            </button>

            {/* Le menu cascade est inséré ici, juste en dessous du bouton */}
            {isOpen && isMenuOpen && (
              <div className="navbar-cascade open">
                {item.name === 'Abonnements' ? (
                  subscriptions.map((sub: any) => (
                    <div key={sub.id} className="nav-sub-item" onClick={() => handleChannelClick(sub)}>
                      <img src={sub.thumbnail} alt={sub.title} className="nav-sub-avatar" />
                      <span className="nav-sub-name">{sub.title}</span>
                    </div>
                  ))
                ) : (
                  <div className="nav-sub-item">Profil utilisateur ici...</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}