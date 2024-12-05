'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000,
      });

      mediaRecorder.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        audioChunks.current = [];
        
        const fileName = `snippet-${Date.now()}.webm`;
        const { data, error } = await supabase.storage
          .from('audio-snippets')
          .upload(fileName, audioBlob, {
            contentType: 'audio/webm',
          });

        if (error) {
          console.error('Error uploading audio:', error);
        }
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  return (
    <button
      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform ${
        isRecording 
          ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/50'
          : 'bg-white shadow-lg hover:scale-105'
      }`}
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
    >
      <div 
        className={`w-12 h-12 rounded-full transition-all ${
          isRecording 
            ? 'bg-red-600 scale-90'
            : 'bg-red-500'
        }`}
      />
    </button>
  );
} 