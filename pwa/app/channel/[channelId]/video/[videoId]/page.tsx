'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAppContext } from '@/app/context/AppContext';
import { AppComment } from '@/app/types/youtube';

export default function VideoPage() {
  const { videoId } = useParams();
  const [videoData, setVideoData] = useState<any>(null);
  const { handleLikeVideo, fetchComments, addComment, comments, setComments, fetchRelatedVideos } = useAppContext();
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const loadAllData = async () => {
      if (!videoId) return;

      const vidId = videoId as string;

      // 1. Récupérer les détails de la vidéo depuis Supabase
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', vidId)
        .single();
      
      if (data) {
        setVideoData(data);
      } else {
        console.error("Erreur chargement vidéo:", error);
      }

      // 2. Récupérer les commentaires et suggestions
      await fetchComments(vidId);
      await fetchRelatedVideos(vidId);
    };

    loadAllData();
  }, [videoId]); // S'exécute uniquement quand le videoId change

  const handlePost = async () => {
    await addComment(videoId as string, newComment);
    setNewComment(''); // Réinitialiser l'input
  };

  if (!videoData) return <div>Chargement...</div>;

  return (
    <div className="video-watch-page">
      <main className="video-left-column">
        {/* 1. Utiliser le conteneur pour le ratio 16/9 */}
        <div className="video-player-container">
          <iframe 
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} 
            allowFullScreen 
          />
        </div>
        
        <h1>{videoData.title}</h1>
        
        <div className="video-header-row">
          <div className="channel-info-row">
            <img src={videoData.channel_avatar_url} className="channel-avatar" alt="Avatar" />
            <div className="channel-text">
              <strong>{videoData.channel_title}</strong>
            </div>
          </div>
          {/* Ajoutez ici vos boutons d'actions (like, etc.) */}
        </div>

        <section className="comments-section">
          <h3>{comments.length} commentaires</h3>
          {/* ... mapping des commentaires ... */}
        </section>
      </main>

      {/* 2. Ajouter la sidebar qui est présente dans votre CSS mais absente du JSX */}
      <aside className="video-sidebar">
        <h3>Suggestions</h3>
        {/* Ici, vous devrez mapper vos "relatedVideos" */}
      </aside>
    </div>
  )
}