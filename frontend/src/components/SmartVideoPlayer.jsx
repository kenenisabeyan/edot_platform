import React, { useEffect, useState } from 'react';
import useThemeMode from '../hooks/useThemeMode';

function getVideoType(url) {
  if (!url) return 'unknown';
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.match(/\.(mp4|webm|ogg|mov|mkv)(\?|$)/)) return 'direct';
  if (u.includes('cloudinary.com')) return 'cloudinary';
  return 'unknown';
}

function resolveCloudinaryUrl(url) {
  if (!url || !url.includes('cloudinary.com')) return url;
  try {
    let resolvedUrl = url.replace(/^http:\/\//i, 'https://');
    const urlObj = new URL(resolvedUrl);
    let pathname = urlObj.pathname;
    pathname = pathname.replace(/\/(image|raw)\/upload\//, '/video/upload/');
    if (!pathname.match(/\.(mp4|webm|ogg|mov|mkv)$/i)) pathname += '.mp4';
    urlObj.pathname = pathname;
    return urlObj.toString();
  } catch {
    return url;
  }
}

export default function SmartVideoPlayer({ url, controls = true, playing = false, ...props }) {
  const isDarkMode = useThemeMode();
  const [resolvedUrl, setResolvedUrl] = useState('');

  useEffect(() => {
    if (!url) return;
    let resolved = url;
    
    const embedMatch = resolved.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i);
    if (embedMatch) {
      resolved = `https://www.youtube.com/watch?v=${embedMatch[1]}`;
    }
    
    if (resolved.toLowerCase().includes('cloudinary.com')) {
       resolved = resolveCloudinaryUrl(resolved);
    }
    setResolvedUrl(resolved);
  }, [url]);

  if (!resolvedUrl) return <div className={`bg-black p-4 rounded text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No video URL provided.</div>;

  const type = getVideoType(resolvedUrl);

  if (type === 'youtube') {
    let ytId = '';
    if (resolvedUrl.includes('youtu.be/')) {
      ytId = resolvedUrl.split('youtu.be/')[1].split('?')[0];
    } else if (resolvedUrl.includes('watch?v=')) {
      ytId = resolvedUrl.split('watch?v=')[1].split('&')[0];
    }
    
    if (ytId) {
      return (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border-2 border-[#00D4FF]/60" style={{boxShadow: '0 0 20px rgba(0, 212, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.5)'}}>
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${ytId}?rel=0&showinfo=0${playing ? '&autoplay=1' : ''}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute top-0 left-0 w-full h-full"
          ></iframe>
        </div>
      );
    }
  }

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border-2 border-[#00D4FF]/60 flex items-center justify-center" style={{boxShadow: '0 0 20px rgba(0, 212, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.5)'}}>
      <video
        src={resolvedUrl}
        controls={controls}
        autoPlay={playing}
        className="w-full h-full object-contain"
        {...props}
      />
    </div>
  );
}
