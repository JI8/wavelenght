'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import AudioVisualizer from './AudioVisualizer';

interface AudioSnippet {
  url: string;
  name: string;
  created_at: string;
  liked?: boolean;
}

interface PreloadedAudio {
  audio: HTMLAudioElement;
  loaded: boolean;
  error: boolean;
}

export default function AudioFeed() {
  // State
  const [snippets, setSnippets] = useState<AudioSnippet[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [playOrder, setPlayOrder] = useState<number[]>([]);

  // Refs
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastTapTime = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout>();
  const audioChunksRef = useRef<Blob[]>([]);
  const isTouchMoveRef = useRef(false);
  const preloadedAudiosRef = useRef<Map<string, PreloadedAudio>>(new Map());
  const preloadQueueRef = useRef<string[]>([]);
  const isPreloadingRef = useRef(false);
  const maxPreloadCount = 3;

  // Core playback controls
  const handlePlayPause = useCallback(() => {
    console.log('AudioFeed: Play/Pause toggled');
    setIsPlaying(prev => !prev);
  }, []);

  const handleNext = useCallback(() => {
    console.log('AudioFeed: Next track');
    setCurrentIndex(prev => (prev + 1) % snippets.length);
    setIsPlaying(true);
  }, [snippets.length]);

  const handlePrevious = useCallback(() => {
    console.log('AudioFeed: Previous track');
    setCurrentIndex(prev => (prev - 1 + snippets.length) % snippets.length);
    setIsPlaying(true);
  }, [snippets.length]);

  const handleTrackEnd = useCallback(() => {
    console.log('AudioFeed: Track ended');
    if (autoplayEnabled) {
      handleNext();
    } else {
      setIsPlaying(false);
    }
  }, [autoplayEnabled, handleNext]);

  // Like functionality
  const handleDoubleTap = useCallback(() => {
    console.log('AudioFeed: Double tap detected, toggling like');
    setSnippets(prev => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        liked: !updated[currentIndex].liked
      };
      return updated;
    });
  }, [currentIndex]);

  // Basic interaction handlers
  const handleTap = useCallback(() => {
    console.log('AudioFeed: Tap detected');
    handlePlayPause();
  }, [handlePlayPause]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    console.log('AudioFeed: Click detected');
    handleTap();
  }, [handleTap]);

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    console.log('AudioFeed: Touch start');
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isTouchMoveRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    
    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
      console.log('AudioFeed: Touch move detected as vertical swipe', { deltaX, deltaY });
      isTouchMoveRef.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    console.log('AudioFeed: Touch end');
    if (!touchStartX.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime.current;
    
    if (isTouchMoveRef.current) {
      const deltaY = touchEndY - touchStartY.current;
      console.log('AudioFeed: Processing vertical swipe', { deltaY });
      if (Math.abs(deltaY) > 50) {
        if (deltaY > 0) {
          handlePrevious();
        } else {
          handleNext();
        }
      }
    } else if (touchDuration < 200 && 
               Math.abs(touchEndX - touchStartX.current) < 10 && 
               Math.abs(touchEndY - touchStartY.current) < 10) {
      console.log('AudioFeed: Processing tap', { touchDuration });
      if (touchEndTime - lastTapTime.current < 300) {
        handleDoubleTap();
      } else {
        console.log('AudioFeed: Single tap detected');
        handleTap();
      }
      lastTapTime.current = touchEndTime;
    }

    touchStartX.current = 0;
    touchStartY.current = 0;
  }, [handlePrevious, handleNext, handleDoubleTap, handleTap]);

  // Audio preloading
  const preloadAudio = useCallback(async (url: string) => {
    if (!url || url.includes('.emptyFolderPlaceholder')) return;
    
    if (preloadedAudiosRef.current.size >= maxPreloadCount) {
      console.log('AudioFeed: Max preload count reached, skipping', { url });
      return;
    }

    if (preloadedAudiosRef.current.has(url)) {
      const existing = preloadedAudiosRef.current.get(url);
      if (existing?.error) {
        console.log('AudioFeed: Retrying failed preload', { url });
        preloadedAudiosRef.current.delete(url);
      } else {
        console.log('AudioFeed: Already preloaded or in progress', { url });
        return;
      }
    }

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";

    preloadedAudiosRef.current.set(url, {
      audio,
      loaded: false,
      error: false
    });

    console.log('AudioFeed: Starting preload', { url });

    try {
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          console.log('AudioFeed: Preload complete', { url });
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          const entry = preloadedAudiosRef.current.get(url);
          if (entry) {
            entry.loaded = true;
          }
          resolve(true);
        };

        const onError = (e: Event) => {
          console.error('AudioFeed: Preload error', { url, error: e });
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          const entry = preloadedAudiosRef.current.get(url);
          if (entry) {
            entry.error = true;
          }
          reject(e);
        };

        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('error', onError);
        audio.src = url;
        audio.load();
      });
    } catch (error) {
      console.error('AudioFeed: Preload failed', { url, error });
      const entry = preloadedAudiosRef.current.get(url);
      if (entry) {
        entry.error = true;
        entry.audio.src = '';
        entry.audio.load();
      }
      throw error;
    }
  }, []);

  const processPreloadQueue = useCallback(async () => {
    if (isPreloadingRef.current || preloadQueueRef.current.length === 0) return;

    isPreloadingRef.current = true;
    console.log('AudioFeed: Processing preload queue', { 
      queueLength: preloadQueueRef.current.length 
    });

    try {
      const url = preloadQueueRef.current[0];
      await preloadAudio(url);
      preloadQueueRef.current.shift();
    } catch (error) {
      console.error('AudioFeed: Queue processing error', error);
      const failedUrl = preloadQueueRef.current.shift();
      if (failedUrl) {
        preloadQueueRef.current.push(failedUrl);
      }
    } finally {
      isPreloadingRef.current = false;
      if (preloadQueueRef.current.length > 0) {
        setTimeout(() => processPreloadQueue(), 1000);
      }
    }
  }, [preloadAudio]);

  const queuePreload = useCallback((url: string) => {
    if (!url || url.includes('.emptyFolderPlaceholder')) return;
    
    if (!preloadQueueRef.current.includes(url) && !preloadedAudiosRef.current.has(url)) {
      console.log('AudioFeed: Queueing preload', { url });
      preloadQueueRef.current.push(url);
      processPreloadQueue();
    }
  }, [processPreloadQueue]);

  // Data fetching
  const generatePlayOrder = useCallback((length: number) => {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }, []);

  const getCurrentTrack = useCallback(() => {
    if (!snippets.length || !playOrder.length) return null;
    const orderIndex = currentIndex % playOrder.length;
    return snippets[playOrder[orderIndex]];
  }, [snippets, playOrder, currentIndex]);

  const fetchSnippets = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: snippetsData, error } = await supabase.storage
        .from('audio-snippets')
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      console.log('AudioFeed: Raw snippets fetched:', snippetsData);

      const rawSnippets = snippetsData.map(file => {
        const url = supabase.storage
          .from('audio-snippets')
          .getPublicUrl(file.name);
        
        return {
          url: url.data.publicUrl,
          name: file.name,
          created_at: file.created_at
        };
      });

      const filteredSnippets = rawSnippets.filter(s => !s.name.includes('.emptyFolderPlaceholder'));
      console.log('AudioFeed: Filtered snippets', { 
        before: rawSnippets.length, 
        after: filteredSnippets.length,
        snippets: filteredSnippets
      });

      const newOrder = generatePlayOrder(filteredSnippets.length);
      console.log('AudioFeed: Generated new play order', newOrder);
      setPlayOrder(newOrder);
      setSnippets(filteredSnippets);
      setIsLoading(false);
    } catch (error) {
      console.error('AudioFeed: Failed to fetch snippets:', error);
      setIsLoading(false);
    }
  }, [generatePlayOrder]);

  // Initial setup
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await fetchSnippets();
        console.log('AudioFeed: Initial setup complete');
        // Start in paused state
        setAutoplayEnabled(true);
        setIsPlaying(false);
      } catch (error) {
        console.error('AudioFeed: Failed to initialize:', error);
      }
    };

    initializeAudio();
  }, [fetchSnippets]);

  // Handle autoplay
  useEffect(() => {
    if (!snippets.length || !autoplayEnabled) return;
    setIsPlaying(true);
  }, [snippets.length, autoplayEnabled]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious]);

  // UI
  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="w-3 h-3 bg-white rounded-full animate-ping" />
      </div>
    );
  }

  return (
    <div 
      className="h-screen bg-black relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white" />
            <span className="text-white text-sm">wavelength</span>
          </div>
          <button 
            className="group h-8 px-3 rounded-full bg-white/10 flex items-center gap-2 cursor-pointer hover:bg-white/20 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              setAutoplayEnabled(prev => !prev);
            }}
          >
            <div className={`w-2 h-2 rounded-full transition-all ${
              autoplayEnabled ? 'bg-white' : 'bg-white/50'
            }`} />
            <span className={`text-sm transition-all ${
              autoplayEnabled ? 'text-white' : 'text-white/50'
            }`}>
              {autoplayEnabled ? 'Autoplay On' : 'Autoplay Off'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="absolute inset-0">
        {getCurrentTrack() && (
          <AudioVisualizer
            audioUrl={getCurrentTrack()!.url}
            isPlaying={isPlaying}
            preloadedAudio={preloadedAudiosRef.current.get(getCurrentTrack()!.url)?.audio}
            onEnded={handleTrackEnd}
            autoplayEnabled={autoplayEnabled}
          />
        )}
      </div>

      {/* Status Text */}
      <div className="absolute inset-x-0 top-1/4 flex flex-col items-center text-white/50 text-sm gap-1">
        <div>Autoplay</div>
        <div>Endless audio stream</div>
      </div>

      {/* Progress Bar */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1 h-48 bg-white/10 rounded-full">
        <div 
          className="w-full bg-white rounded-full transition-all"
          style={{ 
            height: `${(currentIndex / (snippets.length - 1)) * 100}%`,
          }}
        />
      </div>

      {/* Interaction Instructions */}
      <div className="absolute inset-x-0 bottom-32 flex flex-col items-center text-white/50 text-sm gap-1">
        <div>Swipe</div>
        <div>Double tap to like</div>
        <div>Tap to pause</div>
      </div>

      {/* Record Button */}
      <div className="absolute bottom-8 inset-x-0 flex justify-center">
        <div className="relative">
          <svg
            className="absolute inset-0 -rotate-90 w-12 h-12"
            viewBox="0 0 36 36"
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="2"
            />
            {isRecording && (
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray={`${recordingProgress * 100.53} 100.53`}
                strokeLinecap="round"
              />
            )}
          </svg>
          <button
            className="w-12 h-12 rounded-full bg-white flex items-center justify-center touch-none"
          >
            <div className="w-8 h-8 rounded-full transition-all bg-black" />
          </button>
        </div>
      </div>

      {/* Hold to Record Text */}
      <div className="absolute bottom-4 inset-x-0 text-center text-white/50 text-sm">
        Hold to record
      </div>
    </div>
  );
} 