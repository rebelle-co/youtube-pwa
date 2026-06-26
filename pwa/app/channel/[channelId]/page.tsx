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

  
  const { 
    selectedChannel, videos, fetchVideosForChannel, 
    fetchChannelPlaylists, channelPlaylists, handleToggleSubscribe, 
    isSubscribed, fetchChannelBanner, setSelectedChannel, fetchChannelById,
    formatNumber,setVideos, formatViews, getRelativeTime
  } = context;

  console.log("Context check:", { setSelectedChannel, fetchChannelBanner });
  console.log("DEBUG CONTEXT:", context); // <--- AJOUTEZ CECI

  const params = useParams(); // Récupérer l'ID de l'URL
  const channelId = params?.channelId as string;

  useEffect(() => {
    let isMounted = true; // Sécurité pour éviter les fuites mémoire

    const loadChannelData = async () => {
      // Nettoyage immédiat
      setSelectedChannel(null);

      if (channelId) {
        await fetchChannelById(channelId);
        
        // On recharge les vidéos/playlists seulement si le composant est toujours monté
        if (isMounted) {
          fetchVideosForChannel(channelId);
          fetchChannelPlaylists(channelId);
        }
      }
    };

    loadChannelData();
    return () => { isMounted = false; };
  }, [channelId]);

  // Filtrage intelligent
  const filteredVideos = videos.filter((v: YouTubeVideo) => { // Ajoutez le type ici
    if (activeTab === 'Videos') return v.type === 'standard';
    if (activeTab === 'Shorts') return v.type === 'shorts';
    return true;
  });

  console.log("URL de la bannière :", selectedChannel?.bannerImageUrl)

  if (!selectedChannel) return <div>Chargement de la chaîne...</div>

  return (
    <div className="channel-page">
      {/* Bannière */}
      {selectedChannel?.bannerImageUrl && selectedChannel.bannerImageUrl !== "null" &&(
        <div className="channel-banner-container">
          {selectedChannel?.bannerImageUrl ? (
            <img 
              src={selectedChannel.bannerImageUrl} 
              alt="Bannière"
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',      // Recadre l'image pour remplir sans déformer
                objectPosition: 'center', // Centre l'image
                borderRadius: 18,
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: '#333' }} /> // Gris par défaut si pas de bannière
          )}
        </div>
      )}

      <div className="channel-header">
        <img src={selectedChannel.thumbnail} alt={selectedChannel.title} className="channel-avatar" />
        <div className="channel-info">
          <h1>{selectedChannel.title}</h1>
          <p>
            {selectedChannel?.username ? `${selectedChannel.username} ` : ''}  
            <span>
               • {selectedChannel?.subscriberCount ? ` ${formatNumber(selectedChannel.subscriberCount)} abonnés` : ' 0 abonné'} • 
              {selectedChannel?.videoCount ? ` ${selectedChannel.videoCount} vidéos` : ' 0 vidéo'}
            </span>
          </p>
          <div className="channel-desc">
            <h1>{selectedChannel.description}</h1>
            <button 
              className="more-description"
            >
              plus
            </button>
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
      {/* Une seule div pour tout le contenu */}
      <div className="channel-content">
        {activeTab === 'Playlists' ? (
          // Affichage des Playlists
          channelPlaylists.map((pl: YouTubePlaylist) => (
            <div key={pl.id} className="playlist-card">
              {pl.snippet.title}
            </div>
          ))
        ) : (
          // Affichage des Vidéos / Shorts (via filteredVideos)
          filteredVideos.map((video: YouTubeVideo) => (
            <div key={video.id} className="video-card">
              <div className="thumbnail-container">
                <img src={video.thumbnail} alt={video.title} />
                {/* Optionnel : afficher la durée si présente */}
                {video.duration && <span className="duration-tag">{video.duration}</span>}
              </div>
              
              <h4>{video.title}</h4>
              
              <div className="video-meta">
                <span>{formatViews(video.viewCount)}</span>
                <span>•</span>
                <span>{getRelativeTime(video.rawPublishedAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

