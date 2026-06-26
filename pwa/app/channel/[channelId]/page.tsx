'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/app/context/AppContext'
import "./../styles/channel.css"
import { YouTubeVideo } from '@/app/types/youtube'

export default function ChannelPage() {
  const { selectedChannel, handleToggleSubscribe, isSubscribed, videos } = useAppContext()
  const [activeTab, setActiveTab] = useState('Accueil')
  const tabs = ['Accueil', 'Videos', 'Shorts', 'Playlists']

  if (!selectedChannel) return <div>Chargement de la chaîne...</div>

  return (
    <div className="channel-page">
      {/* Bannière */}
      <div className="channel-banner"></div>

      <div className="channel-header">
        <img src={selectedChannel.thumbnail} alt={selectedChannel.title} className="channel-avatar" />
        <div className="channel-info">
          <h1>{selectedChannel.title}</h1>
          <p>@username • X abonnés • Y vidéos</p>
          <div className="channel-desc">
            Description courte de la chaîne ici... plus
          </div>
          <button 
            className={`subscribe-btn ${isSubscribed ? 'subscribed' : ''}`}
            onClick={() => handleToggleSubscribe(selectedChannel.id)}
          >
            {isSubscribed ? 'Abonné' : 'S\'abonner'}
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="channel-tabs">
        {tabs.map(tab => (
          <button 
            key={tab} 
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Contenu (Grille de vidéos) */}
      <div className="channel-content">
        {videos
          .filter((v: YouTubeVideo) => activeTab === 'Videos' ? v.type === 'standard' : true)
          // Ajout du type ici : (video: YouTubeVideo)
          .map((video: YouTubeVideo) => (
            <div key={video.id} className="video-card">
              <img src={video.thumbnail} alt={video.title} />
              <h4>{video.title}</h4>
            </div>
          ))}
      </div>
    </div>
  )
}