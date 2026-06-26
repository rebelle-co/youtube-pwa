'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/app/context/AppContext'
import "@/app/styles/channel.css"
import { YouTubePlaylist, YouTubeVideo } from '@/app/types/youtube'

export default function ChannelPage() {
  const [activeTab, setActiveTab] = useState('Accueil')
  const [visibleCount, setVisibleCount] = useState(20);
  const tabs = ['Accueil', 'Videos', 'Shorts', 'Playlists']

  


  const context = useAppContext();

  
  const { 
    selectedChannel, videos, fetchVideosForChannel, 
    fetchChannelPlaylists, channelPlaylists, handleToggleSubscribe, 
    isSubscribed, fetchChannelBanner, setSelectedChannel, fetchChannelById,
    formatNumber,setVideos, getRelativeTime, formatViews
  } = context;

  console.log("Context check:", { setSelectedChannel, fetchChannelBanner });
  console.log("DEBUG CONTEXT:", context); // <--- AJOUTEZ CECI

  const params = useParams(); // Récupérer l'ID de l'URL
  const channelId = params?.channelId as string;

  useEffect(() => {
    setVisibleCount(20);
  }, [activeTab]);



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
  const filteredVideos = useMemo(() => {
    return videos
      .filter((v: YouTubeVideo) => {
        if (activeTab === 'Videos') return v.type === 'standard';
        if (activeTab === 'Shorts') return v.type === 'shorts';
        return true;
      })
      .sort((a: YouTubeVideo, b: YouTubeVideo) => {
        return new Date(b.rawPublishedAt).getTime() - new Date(a.rawPublishedAt).getTime();
      });
  }, [videos, activeTab]);

  console.log("URL de la bannière :", selectedChannel?.bannerImageUrl)

  useEffect(() => {
    const handleScroll = () => {
      // Si on est à 100px du bas de la page
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        setVisibleCount(prev => prev + 20);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredVideos]); // On écoute filteredVideos pour savoir s'il reste des éléments

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
          filteredVideos.slice(0, visibleCount).map((video: YouTubeVideo) => (
            <div key={video.id} className="video-card">
              <div style={{position:"relative"}}>
                <img src={video.thumbnail} alt={video.title} />
                {video.duration && <span className="duration-tag">{video.duration}</span>}
              </div>
              <div style={{gap: 2, display: "flex", flexDirection: "column",}}>
                <h4>{video.title}</h4>
                <div className="video-meta">
                  <span>{formatViews(video.viewCount)}</span>
                  <span>•</span>
                  <span>{getRelativeTime(video.rawPublishedAt)}</span>
                </div>
              </div>
            </div>
          ))
        )}
        
      </div>
    </div>
  )
}

