'use client'
import { useAppContext } from '../context/AppContext'
import Link from 'next/link'

export default function Header({ toggleNavbar }: { toggleNavbar: () => void }) {
  const { user } = useAppContext()

  return (
    <header className="yt-header">
      <div className="header-left">
        <button className="menu-btn" onClick={toggleNavbar}>☰</button>
        <Link href="/" className="logo">YT Simulator</Link>
      </div>
      
      <div className="header-center">
        <input type="text" placeholder="Rechercher" className="search-input" />
        <button className="search-btn">🔍</button>
      </div>

      <div className="header-right">
        <Link href="/profile" className="user-profile-link">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="User" className="user-avatar" />
          ) : (
            <div className="user-placeholder">👤</div>
          )}
        </Link>
      </div>
    </header>
  )
}