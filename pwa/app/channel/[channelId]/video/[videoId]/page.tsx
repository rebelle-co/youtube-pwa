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

      // 1. Récupération jointe Vidéo + Chaîne
      const { data: videoWithChannel, error } = await supabase
        .from('videos')
        .select(`
          *,
          channels:channel_id (*)
        `)
        .eq('id', vidId)
        .single();

      if (videoWithChannel) {
        setVideoData(videoWithChannel);
        // Vous avez maintenant accès à videoWithChannel.channels
        // Exemple : videoWithChannel.channels.title
      } else {
        console.error("Erreur chargement vidéo:", error);
      }

      // 2. Récupération séparée pour les commentaires (car ce n'est pas une relation 1:1)
      await fetchComments(vidId);
      await fetchRelatedVideos(vidId);
    };

    loadAllData();
  }, [videoId]);

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
            <img src={videoData.channels?.thumbnail_url} alt="Logo" />
            <div className="channel-text">
              <h3>{videoData.channels?.title}</h3>
              <p>{videoData.channels?.subscriber_count} abonnés</p>
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