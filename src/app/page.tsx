'use client';

import AudioRecorder from '@/components/AudioRecorder';
import AudioFeed from '@/components/AudioFeed';
import { useState } from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-black relative">
      {/* Main Content Area */}
      <div className="h-screen">
        <AudioFeed />
      </div>

      {/* Fixed Record Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <AudioRecorder />
      </div>
    </div>
  );
} 