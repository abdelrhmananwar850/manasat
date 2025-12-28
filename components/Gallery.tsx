import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Property } from '../types';

interface GalleryProps {
  property: Property;
  onClose: () => void;
  onInterested?: () => void;
}

const Gallery: React.FC<GalleryProps> = ({ property, onClose, onInterested }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);

  const SLIDE_DURATION = 5000; // 5 seconds per image

  // Progress bar animation
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          return 0;
        }
        return prev + (100 / (SLIDE_DURATION / 50));
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPaused, currentIndex]);

  // Auto-slide and cycle tracking
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        const nextIndex = (prev + 1) % property.images.length;
        if (nextIndex === 0) {
          setCycleCount(c => c + 1);
        }
        setProgress(0);
        return nextIndex;
      });
    }, SLIDE_DURATION);

    return () => clearInterval(timer);
  }, [property.images.length, isPaused]);

  // Close after 2 cycles
  useEffect(() => {
    if (cycleCount >= 2) {
      onClose();
    }
  }, [cycleCount, onClose]);

  const goNext = useCallback(() => {
    setCurrentIndex(prev => {
      const nextIndex = (prev + 1) % property.images.length;
      if (nextIndex === 0) {
        setCycleCount(c => c + 1);
      }
      return nextIndex;
    });
    setProgress(0);
  }, [property.images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + property.images.length) % property.images.length);
    setProgress(0);
  }, [property.images.length]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const diffY = touchStartY.current - touchEndY;
    const diffX = touchStartX.current - touchEndX;

    // Vertical swipe (like Reels)
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 50) {
      if (diffY > 0) {
        goNext(); // Swipe up = next
      } else {
        goPrev(); // Swipe down = previous
      }
    }
    // Horizontal swipe
    else if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        goNext(); // Swipe left = next
      } else {
        goPrev(); // Swipe right = previous
      }
    }
    
    setIsPaused(false);
  };

  // Tap to navigate (left/right sides)
  const handleTap = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    if (x < width * 0.3) {
      goPrev();
    } else if (x > width * 0.7) {
      goNext();
    } else {
      // Center tap - toggle pause
      setIsPaused(prev => !prev);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') setIsPaused(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Stories-style Progress Bars */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 p-2 md:p-3">
        {property.images.map((_, idx) => (
          <div key={idx} className="flex-1 h-0.5 md:h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ 
                width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-8 md:top-10 right-3 md:right-4 z-30 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 backdrop-blur-sm transition-all"
      >
        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image Counter */}
      <div className="absolute top-8 md:top-10 left-3 md:left-4 z-30 bg-black/40 text-white text-xs md:text-sm px-2 py-1 rounded-full backdrop-blur-sm">
        {currentIndex + 1} / {property.images.length}
      </div>

      {/* Main Image Container - Full Screen Vertical */}
      <div 
        ref={containerRef}
        className="relative w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
      >
        {/* Images */}
        {property.images.map((img, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-all duration-500 ${
              idx === currentIndex 
                ? 'opacity-100 scale-100' 
                : idx < currentIndex 
                  ? 'opacity-0 -translate-y-full' 
                  : 'opacity-0 translate-y-full'
            }`}
          >
            <img
              src={img}
              alt={`عقار ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
          </div>
        ))}

        {/* Pause Indicator */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-black/50 rounded-full p-4 backdrop-blur-sm">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </div>
          </div>
        )}

        {/* Navigation Hints (Desktop) */}
        <div className="hidden md:flex absolute inset-y-0 left-0 w-1/4 items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
          <div className="bg-white/10 rounded-full p-3 backdrop-blur-sm">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>
        <div className="hidden md:flex absolute inset-y-0 right-0 w-1/4 items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
          <div className="bg-white/10 rounded-full p-3 backdrop-blur-sm">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Property Info Overlay - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 md:p-6 pb-20 md:pb-24">
        <div className="max-w-lg">
          {/* Property Type Badge */}
          <span className="inline-block bg-blue-500/80 text-white text-xs px-2 py-1 rounded-full mb-2 backdrop-blur-sm">
            {property.type}
          </span>
          
          {/* Title */}
          <h2 className="text-xl md:text-2xl font-bold text-white mb-1 drop-shadow-lg">
            {property.title}
          </h2>
          
          {/* Location */}
          <p className="text-white/80 text-sm md:text-base flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {property.location}
          </p>
          
          {/* Description - Truncated */}
          <p className="text-white/70 text-xs md:text-sm line-clamp-2">
            {property.description}
          </p>
        </div>
      </div>

      {/* Action Buttons - Fixed Bottom */}
      <div className="absolute bottom-4 md:bottom-6 left-0 right-0 z-30 flex justify-center gap-3 md:gap-4 px-4">
        {/* Skip/Next Button */}
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-full backdrop-blur-md transition-all border border-white/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          <span className="text-sm md:text-base font-medium">التالي</span>
        </button>

        {/* Interested Button */}
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            if (onInterested) onInterested();
            onClose();
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-full shadow-lg shadow-blue-500/30 transition-all"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span className="text-sm md:text-base font-medium">مهتم</span>
        </button>
      </div>

      {/* Swipe Hint - Mobile Only (shows briefly) */}
      <div className="md:hidden absolute bottom-32 left-1/2 -translate-x-1/2 z-20 animate-bounce opacity-50">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </div>
    </div>
  );
};

export default Gallery;
