'use client';

import { useEffect, useRef, useCallback } from 'react';

interface AudioVisualizerProps {
  audioUrl: string;
  isPlaying: boolean;
  preloadedAudio?: HTMLAudioElement;
  onEnded?: () => void;
  autoplayEnabled?: boolean;
}

export default function AudioVisualizer({ audioUrl, isPlaying, preloadedAudio, onEnded, autoplayEnabled }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const sourceNodeRef = useRef<MediaElementAudioSourceNode>();
  const gradientCenterRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const blackHoleRadiusRef = useRef(35);
  const targetBlackHoleRadiusRef = useRef(35);
  const lastUrlRef = useRef<string>('');

  // Clean up function
  const cleanupAudio = useCallback(() => {
    console.log('AudioVisualizer: Cleaning up audio resources');
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = undefined;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
      audioRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = undefined;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = undefined;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get frequency data
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Calculate average frequency
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const normalizedAverage = average / 256;

    // Update black hole radius with smooth animation
    blackHoleRadiusRef.current += (targetBlackHoleRadiusRef.current - blackHoleRadiusRef.current) * 0.1;

    // Update gradient center based on audio
    const angle = Date.now() * 0.001;
    const radius = 50 + normalizedAverage * 50;
    gradientCenterRef.current.targetX = centerX + Math.cos(angle) * radius;
    gradientCenterRef.current.targetY = centerY + Math.sin(angle) * radius;
    gradientCenterRef.current.x += (gradientCenterRef.current.targetX - gradientCenterRef.current.x) * 0.02;
    gradientCenterRef.current.y += (gradientCenterRef.current.targetY - gradientCenterRef.current.y) * 0.02;

    // Draw outer gradient
    const gradient = ctx.createRadialGradient(
      gradientCenterRef.current.x,
      gradientCenterRef.current.y,
      blackHoleRadiusRef.current,
      centerX,
      centerY,
      canvas.height * (0.4 + normalizedAverage * 0.2)
    );

    const hue1 = (Date.now() * 0.02) % 360;
    const hue2 = (hue1 + 60) % 360;
    const hue3 = (hue1 + 180) % 360;

    gradient.addColorStop(0, `hsla(${hue1}, 70%, 50%, ${0.4 + normalizedAverage * 0.3})`);
    gradient.addColorStop(0.5, `hsla(${hue2}, 70%, 50%, ${0.2 + normalizedAverage * 0.2})`);
    gradient.addColorStop(1, `hsla(${hue3}, 70%, 50%, ${0.1 + normalizedAverage * 0.1})`);

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw black hole
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(centerX, centerY, blackHoleRadiusRef.current, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    draw();
    animationRef.current = requestAnimationFrame(animate);
  }, [draw]);

  // Handle track changes
  useEffect(() => {
    if (audioUrl !== lastUrlRef.current) {
      console.log('AudioVisualizer: Track change detected');
      cleanupAudio();
      lastUrlRef.current = audioUrl;
      
      // Animate black hole
      targetBlackHoleRadiusRef.current = 5;
      setTimeout(() => {
        targetBlackHoleRadiusRef.current = 35;
      }, 100);
    }
  }, [audioUrl, cleanupAudio]);

  // Handle audio setup
  useEffect(() => {
    let isCurrentSetup = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const setupAudio = async () => {
      try {
        // Create audio element first
        if (!audioRef.current) {
          audioRef.current = preloadedAudio || new Audio();
          audioRef.current.crossOrigin = "anonymous";
          audioRef.current.loop = autoplayEnabled ? false : true;
          audioRef.current.onended = onEnded;
          audioRef.current.preload = "auto";
        }

        // Set audio source if changed
        if (audioRef.current.src !== audioUrl) {
          console.log('AudioVisualizer: Loading audio from URL:', audioUrl);
          
          // Reset audio element completely
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
          
          // Add cache buster to prevent range request issues
          const cacheBuster = `${audioUrl}${audioUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;
          audioRef.current.src = cacheBuster;
          
          // Wait for metadata to load first
          await new Promise((resolve, reject) => {
            if (!audioRef.current || !isCurrentSetup) return reject(new Error('Setup cancelled'));
            
            const onLoadedMetadata = () => {
              if (!isCurrentSetup) return;
              console.log('AudioVisualizer: Audio metadata loaded');
              audioRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
              audioRef.current?.removeEventListener('error', onError);
              resolve(true);
            };

            const onError = (e: Event) => {
              console.error('AudioVisualizer: Audio load error:', e);
              audioRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
              audioRef.current?.removeEventListener('error', onError);
              if (isCurrentSetup) {
                reject(e);
              }
            };

            audioRef.current.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
            audioRef.current.addEventListener('error', onError, { once: true });
            audioRef.current.load();
          });

          // Wait for enough data to start playback
          await new Promise((resolve, reject) => {
            if (!audioRef.current || !isCurrentSetup) return reject(new Error('Setup cancelled'));
            
            const onCanPlayThrough = () => {
              if (!isCurrentSetup) return;
              console.log('AudioVisualizer: Audio buffered enough to play');
              audioRef.current?.removeEventListener('canplaythrough', onCanPlayThrough);
              audioRef.current?.removeEventListener('error', onError);
              resolve(true);
            };

            const onError = (e: Event) => {
              console.error('AudioVisualizer: Audio buffer error:', e);
              audioRef.current?.removeEventListener('canplaythrough', onCanPlayThrough);
              audioRef.current?.removeEventListener('error', onError);
              if (isCurrentSetup) {
                reject(e);
              }
            };

            if (audioRef.current.readyState >= 4) {
              resolve(true);
            } else {
              audioRef.current.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
              audioRef.current.addEventListener('error', onError, { once: true });
            }
          });
        }

        // Initialize audio context only when needed
        if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
        }

        // Set up analyzer if needed
        if (!analyserRef.current && audioContextRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
        }

        // Connect nodes if needed
        if (!sourceNodeRef.current && audioRef.current && audioContextRef.current && analyserRef.current) {
          sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          sourceNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }

        // Start animation
        animate();

        // Handle playback state
        if (isPlaying && audioRef.current && isCurrentSetup) {
          try {
            // Resume audio context on user interaction
            if (audioContextRef.current?.state === 'suspended') {
              await audioContextRef.current.resume();
            }
            
            // Start playback
            const playPromise = audioRef.current.play();
            if (playPromise) {
              await playPromise;
              console.log('AudioVisualizer: Playback started successfully');
              // Reset retry count on successful playback
              retryCount = 0;
            }
          } catch (error: any) {
            if (!isCurrentSetup) return;
            console.error('AudioVisualizer: Playback error:', error);
            
            if (error.name === 'NotAllowedError') {
              console.log('AudioVisualizer: Waiting for user interaction');
              const resumePlayback = async () => {
                try {
                  if (audioContextRef.current && audioRef.current && isCurrentSetup) {
                    await audioContextRef.current.resume();
                    await audioRef.current.play();
                    window.removeEventListener('click', resumePlayback);
                    window.removeEventListener('touchstart', resumePlayback);
                  }
                } catch (e) {
                  console.error('AudioVisualizer: Resume playback error:', e);
                }
              };
              window.addEventListener('click', resumePlayback);
              window.addEventListener('touchstart', resumePlayback);
            } else if (retryCount < maxRetries) {
              // Retry setup on other errors
              retryCount++;
              console.log(`AudioVisualizer: Retrying setup (${retryCount}/${maxRetries})`);
              cleanupAudio();
              await setupAudio();
            }
          }
        } else if (audioRef.current) {
          audioRef.current.pause();
        }
      } catch (error) {
        if (!isCurrentSetup) return;
        console.error('AudioVisualizer: Setup error:', error);
        
        if (retryCount < maxRetries) {
          // Retry setup on errors
          retryCount++;
          console.log(`AudioVisualizer: Retrying setup (${retryCount}/${maxRetries})`);
          cleanupAudio();
          await setupAudio();
        } else {
          cleanupAudio();
        }
      }
    };

    setupAudio();

    return () => {
      isCurrentSetup = false;
      cleanupAudio();
    };
  }, [audioUrl, preloadedAudio, onEnded, animate, cleanupAudio, isPlaying, autoplayEnabled]);

  // Handle play/pause
  useEffect(() => {
    const handlePlayPause = async () => {
      if (!audioRef.current || !audioContextRef.current) return;

      try {
        if (isPlaying) {
          await audioContextRef.current.resume();
          await audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      } catch (error) {
        console.error('AudioVisualizer: Playback error:', error);
      }
    };

    handlePlayPause();
  }, [isPlaying]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full bg-black cursor-pointer"
    />
  );
} 