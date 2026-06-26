'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/app/context/AppContext'
import "@/app/styles/channel.css"
import { YouTubePlaylist, YouTubeVideo } from '@/app/types/youtube'

export default function ChannelPage() {
  const [activeTab, setActiveTab] = useState('Accueil')
  const tabs = ['Accueil', 'Videos', 'Shorts', 'Playlists']

  


  const context = useAppContext();
  console.log("DEBUG CONTEXT:", context); // <--- AJOUTEZ CECI
  
  const { 
    selectedChannel, videos, fetchVideosForChannel, 
    fetchChannelPlaylists, channelPlaylists, handleToggleSubscribe, 
    isSubscribed, fetchChannelBanner, setSelectedChannel 
  } = context;

  console.log("Context check:", { setSelectedChannel, fetchChannelBanner });

  const params = useParams(); // Récupérer l'ID de l'URL
  const channelId = params?.channelId as string;

  useEffect(() => {
    // Vérification de sécurité : on attend que selectedChannel soit présent
    if (selectedChannel?.id && channelId) {
      fetchVideosForChannel(selectedChannel.id);
      fetchChannelPlaylists(selectedChannel.id);
      
      // Vérification que la fonction existe avant de l'appeler
      if (typeof fetchChannelBanner === 'function') {
        fetchChannelBanner(selectedChannel.id).then((url: string | null) => {
          setSelectedChannel({ ...selectedChannel, bannerImageUrl: url });
        });
      }
    }
  }, [selectedChannel?.id, channelId]); // On dépend de l'ID du canal

  // Filtrage intelligent
  const filteredVideos = videos.filter((v: YouTubeVideo) => { // Ajoutez le type ici
    if (activeTab === 'Videos') return v.type === 'standard';
    if (activeTab === 'Shorts') return v.type === 'shorts';
    return true;
  });

  if (!selectedChannel) return <div>Chargement de la chaîne...</div>

  return (
    <div className="channel-page">
      {/* Bannière */}
      <div 
        className="channel-banner" 
        style={{ 
          backgroundImage: selectedChannel?.bannerImageUrl ? `url(${selectedChannel.bannerImageUrl})` : 'none',
          backgroundColor: selectedChannel?.bannerImageUrl ? 'transparent' : '#333' 
        }}
      ></div>

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

      <div className="channel-content">
        {activeTab === 'Playlists' ? (
          channelPlaylists.map((pl: YouTubePlaylist) => (
            <div key={pl.id} className="playlist-card">
              {pl.snippet.title}
            </div>
          ))
        ) : (
          filteredVideos.map((video: YouTubeVideo) => (
            <div key={video.id} className="video-card">
              <img src={video.thumbnail} alt={video.title} />
              <h4>{video.title}</h4>
            </div>
          ))
        )}
      </div>
    </div>
  )
}