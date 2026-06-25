'use client'
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { YouTubeSubscription } from '../types/youtube';

export default function ParamsHandler() {
  const searchParams = useSearchParams();
  const { fetchVideosForChannel, setSelectedChannel, subscriptions, setActiveTab, setIsCascadeOpen } = useAppContext();
  const channelParam = searchParams.get('channel');
  
  // Ref pour éviter de fetcher en boucle si le composant re-render
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (channelParam && subscriptions.length > 0) {
      const savedChannel = subscriptions.find((sub: YouTubeSubscription) => sub.id === channelParam);
      
      if (savedChannel) {
        setSelectedChannel(savedChannel);
        setActiveTab('subscriptions');
        setIsCascadeOpen(true);
        fetchVideosForChannel(savedChannel.id, savedChannel.thumbnail);
        hasInitialized.current = true;
      }
    }
  }, [channelParam, subscriptions]); // Se déclenche quand l'URL change ou que les abonnements sont chargés

  return null;
}