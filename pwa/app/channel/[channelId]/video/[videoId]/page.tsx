'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAppContext } from '@/app/context/AppContext';
import { AppComment } from '@/app/types/youtube';

export default function VideoPage() {
  const { videoId } = useParams();
  const [videoData, setVideoData] = useState<any>(null);
  const { handleLikeVideo, fetchComments, addComment, comments, setComments } = useAppContext();
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (videoId) {
      fetchComments(videoId as string);
    }
  }, [videoId]);

  const handlePost = async () => {
    await addComment(videoId as string, newComment);
    setNewComment(''); // Réinitialiser l'input
  };

  if (!videoData) return <div>Chargement...</div>;

  return (
    <div className="video-watch-page">
      <main className="video-left-column">
        <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} allowFullScreen />
        
        <h1>{videoData.title}</h1>
        
        <div className="video-header-row">
          <div className="channel-info-row">
            <img src={videoData.channel_avatar_url} className="channel-avatar" />
            <div className="channel-text">
              <strong>{videoData.channel_title}</strong>
            </div>
          </div>
        </div>

        <section className="comments-section">
          <h3>{comments.length} commentaires</h3>
          {comments.map((c: AppComment) => ( // <--- Ajoutez le type ici
            <div key={c.id} className="comment-item">
              {c.user_avatar && <img src={c.user_avatar} width={30} height={30} />}
              <strong>{c.user_name}</strong>
              <p>{c.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}