'use client' // Important pour utiliser useState
import { useState } from 'react'
import Link from 'next/link'

export default function Navbar({ user, subscriptions }: { user: any, subscriptions: any[] }) {
  const [isCascadeOpen, setIsCascadeOpen] = useState(false)

  return (
    <nav className="navbar">
      <Link href="/" className="nav-item">
        <span>Accueil</span>
      </Link>

      <div className="nav-item-wrapper">
        <button onClick={() => setIsCascadeOpen(!isCascadeOpen)} className="nav-item">
          <span>Abonnements {isCascadeOpen ? '▲' : '▼'}</span>
        </button>
        <div className={`navbar-cascade ${isCascadeOpen ? 'open' : ''}`}>
           {/* Mapper vos abonnements ici avec <Link href={`/channel/${sub.id}`}> */}
        </div>
      </div>

      <Link href="/downloads" className="nav-item"><span>Téléchargements</span></Link>
      <Link href="/profile" className="nav-item"><span>Vous</span></Link>
    </nav>
  )
}