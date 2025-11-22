import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamData {
  id: string;
  title: string;
  host_name: string;
  host_user_id: string;
  current_viewers: number;
  total_likes: number;
  thumbnail?: string;
  category?: string;
}

interface StreamQueue {
  streams: StreamData[];
  currentIndex: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const useStreamQueue = (initialStreams: StreamData[] = []) => {
  const [queue, setQueue] = useState<StreamQueue>({
    streams: initialStreams,
    currentIndex: 0,
    hasNext: initialStreams.length > 1,
    hasPrevious: false
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load more streams when approaching the end
  useEffect(() => {
    const shouldLoadMore = 
      queue.streams.length > 0 && 
      queue.currentIndex >= queue.streams.length - 2 &&
      !isLoading;

    if (shouldLoadMore) {
      loadMoreStreams();
    }
  }, [queue.currentIndex, queue.streams.length]);

  const loadMoreStreams = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('streaming_sessions')
        .select('*, profiles!streaming_sessions_host_user_id_fkey(display_name)')
        .eq('status', 'live')
        .order('current_viewers', { ascending: false })
        .range(queue.streams.length, queue.streams.length + 9);

      if (error) throw error;

      if (data && data.length > 0) {
        const newStreams = data.map((session: any) => ({
          id: session.id,
          title: session.title,
          host_name: session.profiles?.display_name || 'Unknown',
          host_user_id: session.host_user_id,
          current_viewers: session.current_viewers || 0,
          total_likes: session.total_likes || 0,
          thumbnail: session.thumbnail,
          category: session.category
        }));

        setQueue(prev => ({
          ...prev,
          streams: [...prev.streams, ...newStreams],
          hasNext: true
        }));
      }
    } catch (error) {
      console.error('Error loading more streams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const goToNext = useCallback(() => {
    setQueue(prev => {
      if (prev.currentIndex < prev.streams.length - 1) {
        const newIndex = prev.currentIndex + 1;
        return {
          ...prev,
          currentIndex: newIndex,
          hasNext: newIndex < prev.streams.length - 1,
          hasPrevious: true
        };
      }
      return prev;
    });
  }, []);

  const goToPrevious = useCallback(() => {
    setQueue(prev => {
      if (prev.currentIndex > 0) {
        const newIndex = prev.currentIndex - 1;
        return {
          ...prev,
          currentIndex: newIndex,
          hasNext: true,
          hasPrevious: newIndex > 0
        };
      }
      return prev;
    });
  }, []);

  const getCurrentStream = useCallback(() => {
    return queue.streams[queue.currentIndex] || null;
  }, [queue.streams, queue.currentIndex]);

  const getNextStream = useCallback(() => {
    return queue.streams[queue.currentIndex + 1] || null;
  }, [queue.streams, queue.currentIndex]);

  const getPreviousStream = useCallback(() => {
    return queue.streams[queue.currentIndex - 1] || null;
  }, [queue.streams, queue.currentIndex]);

  return {
    currentStream: getCurrentStream(),
    nextStream: getNextStream(),
    previousStream: getPreviousStream(),
    hasNext: queue.hasNext,
    hasPrevious: queue.hasPrevious,
    goToNext,
    goToPrevious,
    isLoading
  };
};
