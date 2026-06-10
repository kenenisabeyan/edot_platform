import React, { useEffect, useRef, useState } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import Hls from 'hls.js';
import axios from 'axios';
import ReactPlayer from 'react-player';
import { Lock } from 'lucide-react';

// Detect video source type
const getVideoType = (url) => {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  // YouTube
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  
  // Vimeo
  if (lowerUrl.includes('vimeo.com')) {
    return 'vimeo';
  }
  
  // HLS stream
  if (lowerUrl.includes('.m3u8')) {
    return 'hls';
  }
  
  // Cloudinary video
  if (lowerUrl.includes('cloudinary.com')) {
    return 'cloudinary';
  }
  
  // Direct video file (mp4, webm, etc.)
  if (lowerUrl.match(/\.(mp4|webm|ogg|avi|mov|mkv)(\?|$)/i)) {
    return 'direct';
  }
  
  return 'unknown';
};

// Resolve Cloudinary URL to video format
const resolveCloudinaryUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  try {
    let resolvedUrl = url.replace(/^http:\/\//i, 'https://');
    const urlObj = new URL(resolvedUrl);
    let pathname = urlObj.pathname;
    
    // Convert image/raw upload to video upload
    pathname = pathname.replace(/\/(image|raw)\/upload\//, '/video/upload/');
    
    // Ensure video extension
    if (!pathname.match(/\.(mkv|mov|avi|webm|mp4)$/i)) {
      pathname += '.mp4';
    } else {
      pathname = pathname.replace(/\.(mkv|mov|avi|webm)$/i, '.mp4');
    }
    
    urlObj.pathname = pathname;
    return urlObj.toString();
  } catch (e) {
    console.error('Error resolving Cloudinary URL:', e);
    return url;
  }
};

const VideoPlayer = ({ videoUrl, courseId, lessonId, requiredDuration, onComplete }) => {
  const isDarkMode = useThemeMode();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoType, setVideoType] = useState('unknown');
  const [resolvedUrl, setResolvedUrl] = useState('');
  const lastHeartbeatRef = useRef(0);

  useEffect(() => {
    if (!videoUrl) return;
    
    const type = getVideoType(videoUrl);
    setVideoType(type);
    
    // Resolve URL based on type
    let resolved = videoUrl;
    if (type === 'cloudinary') {
      resolved = resolveCloudinaryUrl(videoUrl);
    } else if (type === 'youtube' || type === 'vimeo') {
      // ReactPlayer handles these natively
      resolved = videoUrl;
    } else {
      resolved = videoUrl;
    }
    
    setResolvedUrl(resolved);
    
    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, [videoUrl]);

  // Handle HLS streams with native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoType !== 'hls' || !resolvedUrl) return;
    
    if (Hls.isSupported()) {
      hlsRef.current = new Hls();
      hlsRef.current.loadSource(resolvedUrl);
      hlsRef.current.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = resolvedUrl;
    }
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoType, resolvedUrl]);

  const pingProgress = async (currentSecond) => {
    try {
      const res = await axios.post(
        'http://localhost:5000/api/progress/ping',
        { courseId, lessonId, currentSecond },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      if (res.data.success && res.data.data.isComplete) {
        if (onComplete) onComplete();
      }
    } catch (err) {
      console.error('Failed to log progress heartbeat', err);
    }
  };

  // Time update handler for progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoType === 'youtube' || videoType === 'vimeo') return;
    
    const handleTimeUpdate = () => {
      const currentSecond = Math.floor(video.currentTime);
      
      if (currentSecond - lastHeartbeatRef.current >= 30) {
        lastHeartbeatRef.current = currentSecond;
        pingProgress(currentSecond);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoType, courseId, lessonId, onComplete]);


  // Render YouTube/Vimeo with ReactPlayer
  if (videoType === 'youtube' || videoType === 'vimeo') {
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-2xl border-2 border-[#00D4FF]/60 aspect-video" style={{boxShadow: '0 0 20px rgba(0, 212, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.5)'}}>
        <ReactPlayer
          url={resolvedUrl}
          width="100%"
          height="100%"
          controls
          playing={false}
          onProgress={({ played }) => {
            if (played > 0.95 && onComplete) {
              onComplete();
            }
          }}
          config={{
            youtube: {
              playerVars: { modestbranding: 1, rel: 0, showinfo: 0, fs: 1 }
            }
          }}
        />
        <div className={`absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md border text-white/80 text-xs font-medium flex items-center gap-2 pointer-events-none ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          EDOT Secured Stream
        </div>
      </div>
    );
  }

  // Render HLS or direct video with native video element
  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-2xl border-2 border-[#00D4FF]/60 aspect-video" style={{boxShadow: '0 0 20px rgba(0, 212, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.5)'}}>
      <video
        ref={videoRef}
        controls
        className="w-full h-full object-contain"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        controlsList="nodownload"
        playsInline
      />
      {!isPlaying && (
        <div className={`absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md border text-white/80 text-xs font-medium flex items-center gap-2 pointer-events-none ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          EDOT Secured Stream
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
