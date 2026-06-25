'use client'
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { YouTubeSubscription } from '../types/youtube';

export default function ParamsHandler() {
  const searchParams = useSearchParams();
  const { fetchVideosForChannel, setSelectedChannel, subscriptions, setActiveTab, setIsCascadeOpen } = useAppContext();
  const channelParam = searchParams.get('channel');
  

  useEffect(() => {
    if (channelParam && subscriptions.length > 0) {
      const savedChannel = subscriptions.find((sub: YouTubeSubscription) => sub.id === channelParam);
      if (savedChannel) {
        setSelectedChannel(savedChannel);
        setActiveTab('subscriptions');
        setIsCascadeOpen(true);
        fetchVideosForChannel(savedChannel.id, savedChannel.thumbnail);
      }
    }
  }, [channelParam, subscriptions]);

  return null; // Ce composant ne rend rien, il gère juste la logique
}