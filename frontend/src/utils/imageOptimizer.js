/**
 * Image Optimization Utility
 * 
 * Provides functions to optimize images using Cloudinary transformations.
 * Reduces image payload by 60-85% while maintaining visual quality.
 * 
 * Usage:
 * import { optimizeImageUrl, UserAvatar, CourseThumbnail } from '@/utils/imageOptimizer';
 * 
 * const optimized = optimizeImageUrl(imageUrl, 400, 225, 80);
 * <img src={optimized} alt="Course" loading="lazy" />
 */

import { useEffect } from 'react';

/**
 * Main image optimization function
 * 
 * @param {string} url - Original Cloudinary image URL
 * @param {number} width - Target width in pixels (optional)
 * @param {number} height - Target height in pixels (optional)
 * @param {number|string} quality - Quality 1-100 or 'auto' (default: 'auto')
 * @param {string} crop - Crop mode: 'fill', 'fit', 'pad', 'crop' (default: 'fill')
 * @returns {string} Optimized image URL
 */
export function optimizeImageUrl(
  url,
  width = null,
  height = null,
  quality = 'auto',
  crop = 'fill'
) {
  if (!url) return null;
  
  // Skip if not a Cloudinary URL
  if (!url.includes('cloudinary') && !url.includes('res.cloud')) {
    return url;
  }
  
  try {
    // Parse the URL
    const parts = url.split('/upload/');
    if (parts.length !== 2) return url;
    
    const [base, pathWithPublicId] = parts;
    const publicIdPath = pathWithPublicId.split('?')[0]; // Remove query params
    
    // Build transformation string
    const transformations = [];
    
    // Format optimization
    transformations.push('f_auto'); // Automatic format (WebP for modern browsers)
    
    // Quality optimization
    transformations.push(`q_${quality}`);
    
    // Dimensions
    if (width) transformations.push(`w_${width}`);
    if (height) transformations.push(`h_${height}`);
    
    // Crop mode
    if (width || height) {
      transformations.push(`c_${crop}`);
    }
    
    // Add gravity for better crop results
    if (crop === 'fill' && (width || height)) {
      transformations.push('g_auto'); // Auto-detect important areas
    }
    
    const transform = transformations.join(',');
    
    return `${base}/upload/${transform}/${publicIdPath}`;
  } catch (error) {
    console.warn('Image optimization error:', error, url);
    return url;
  }
}

/**
 * Get optimized URL for specific image use cases
 */
export const ImageSizes = {
  // Course thumbnails for listings
  CourseThumbnail: (url, quality = 80) => 
    optimizeImageUrl(url, 400, 225, quality, 'fill'),
  
  // Course hero image (desktop)
  CourseHeroDesktop: (url, quality = 85) => 
    optimizeImageUrl(url, 1200, 600, quality, 'fill'),
  
  // Course hero image (mobile)
  CourseHeroMobile: (url, quality = 80) => 
    optimizeImageUrl(url, 600, 400, quality, 'fill'),
  
  // Course hero image (tablet)
  CourseHeroTablet: (url, quality = 80) => 
    optimizeImageUrl(url, 900, 500, quality, 'fill'),
  
  // Small user avatar (navbar, comments)
  AvatarSmall: (url, quality = 85) => 
    optimizeImageUrl(url, 32, 32, quality, 'fill'),
  
  // Medium user avatar (course cards, message lists)
  AvatarMedium: (url, quality = 85) => 
    optimizeImageUrl(url, 48, 48, quality, 'fill'),
  
  // Large user avatar (profile pages, modal)
  AvatarLarge: (url, quality = 85) => 
    optimizeImageUrl(url, 120, 120, quality, 'fill'),
  
  // Certificate images
  Certificate: (url, quality = 90) => 
    optimizeImageUrl(url, 1200, 800, quality, 'fit'),
  
  // Dashboard cards
  DashboardCard: (url, quality = 80) => 
    optimizeImageUrl(url, 300, 200, quality, 'fill'),
  
  // Background images (full screen)
  FullScreenBG: (url, quality = 75) => 
    optimizeImageUrl(url, 1920, 1080, quality, 'fill'),
};

/**
 * React Component: Lazy-loaded course thumbnail
 */
export function CourseThumbnail({ 
  imageUrl, 
  title, 
  className = '',
  fallbackImage = '/default-course-image.jpg'
}) {
  const optimizedUrl = optimizeImageUrl(imageUrl, 400, 225, 80) || fallbackImage;
  
  return (
    <img
      src={optimizedUrl}
      alt={title || 'Course'}
      className={`object-cover rounded-lg ${className}`}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.target.src = fallbackImage;
      }}
    />
  );
}

/**
 * React Component: Responsive user avatar
 */
export function UserAvatar({ 
  imageUrl, 
  userName = 'User',
  size = 'medium',
  className = ''
}) {
  const sizeConfig = {
    small: { px: 32, optimized: ImageSizes.AvatarSmall },
    medium: { px: 48, optimized: ImageSizes.AvatarMedium },
    large: { px: 120, optimized: ImageSizes.AvatarLarge },
  };
  
  const config = sizeConfig[size] || sizeConfig.medium;
  const optimizedUrl = imageUrl 
    ? config.optimized(imageUrl) 
    : `/avatar-default.svg`;
  
  return (
    <img
      src={optimizedUrl}
      alt={userName}
      className={`rounded-full object-cover ${className}`}
      style={{ 
        width: `${config.px}px`, 
        height: `${config.px}px` 
      }}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.target.src = `/avatar-default.svg`;
      }}
    />
  );
}

/**
 * React Component: Responsive course hero image with picture element
 */
export function ResponsiveCourseHero({ 
  imageUrl, 
  title,
  className = ''
}) {
  if (!imageUrl) {
    return (
      <div className={`w-full h-96 bg-gradient-to-r from-slate-200 to-slate-300 ${className}`} />
    );
  }
  
  const baseUrl = imageUrl?.split('?')[0];
  if (!baseUrl?.includes('cloudinary')) {
    return (
      <img 
        src={imageUrl} 
        alt={title} 
        className={`w-full h-96 object-cover ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }
  
  return (
    <picture>
      {/* Mobile: 600px width */}
      <source
        media="(max-width: 640px)"
        srcSet={ImageSizes.CourseHeroMobile(baseUrl, 80)}
      />
      
      {/* Tablet: 900px width */}
      <source
        media="(max-width: 1024px)"
        srcSet={ImageSizes.CourseHeroTablet(baseUrl, 80)}
      />
      
      {/* Desktop: 1200px width */}
      <img
        src={ImageSizes.CourseHeroDesktop(baseUrl, 85)}
        alt={title || 'Course Hero'}
        className={`w-full h-96 object-cover ${className}`}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.target.src = '/default-hero-image.jpg';
        }}
      />
    </picture>
  );
}

/**
 * React Component: Certificate with optimization
 */
export function CertificateImage({ 
  imageUrl, 
  title,
  className = ''
}) {
  const optimizedUrl = optimizeImageUrl(imageUrl, 1200, 800, 90) || '/default-certificate.jpg';
  
  return (
    <img
      src={optimizedUrl}
      alt={title || 'Certificate'}
      className={`w-full max-w-2xl mx-auto rounded-lg shadow-lg ${className}`}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.target.src = '/default-certificate.jpg';
      }}
    />
  );
}

/**
 * Background image CSS helper
 * Usage: style={{ backgroundImage: createBackgroundImage(url) }}
 */
export function createBackgroundImage(url, width = 1920, height = 1080) {
  if (!url) return 'none';
  const optimized = optimizeImageUrl(url, width, height, 75);
  return `url('${optimized}')`;
}

/**
 * Intersection Observer based lazy loading for advanced control
 */
export function useLazyImage(ref, callback) {
  useEffect(() => {
    if (!ref?.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback();
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before visible
        threshold: 0.01,
      }
    );
    
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, callback]);
}

/**
 * Get responsive srcSet for picture element or img srcSet attribute
 */
export function getResponsiveSrcSet(url, sizes = [600, 900, 1200]) {
  return sizes
    .map(size => {
      const optimized = optimizeImageUrl(url, size, null, 80);
      return `${optimized} ${size}w`;
    })
    .join(', ');
}

export default {
  optimizeImageUrl,
  ImageSizes,
  CourseThumbnail,
  UserAvatar,
  ResponsiveCourseHero,
  CertificateImage,
  createBackgroundImage,
  useLazyImage,
  getResponsiveSrcSet,
};
