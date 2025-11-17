# Premium Hero Image Animations - Documentation

## Overview

A complete set of modular, reusable React hooks for creating premium, futuristic 2026-style animations for hero images. All animations are GPU-accelerated, performant, and subtle.

## Hooks

### 1. `useCursorParallax`
Micro cursor parallax effect with 1-3 degree rotation and slight xy movement.

**Usage:**
```tsx
const parallaxRef = useCursorParallax<HTMLDivElement>({
  rotation: 2,      // Max rotation in degrees (1-3)
  movement: 3,      // Max movement in pixels (1-3)
  smoothness: 0.1,  // Smoothing factor (0-1)
});

<div ref={parallaxRef}>Content</div>
```

### 2. `useFloatingAnimation`
Smooth up/down floating animation (2-6px).

**Usage:**
```tsx
const floatRef = useFloatingAnimation<HTMLDivElement>({
  distance: 4,      // Distance in pixels (2-6)
  duration: 3,      // Duration in seconds
  delay: 0,         // Delay in seconds
  randomize: false, // Randomize distance and duration
});

<div ref={floatRef}>Floating content</div>
```

### 3. `useGlowPulse`
Soft pulsing animation for neon edges/elements.

**Usage:**
```tsx
const glowRef = useGlowPulse<HTMLDivElement>({
  minOpacity: 0.4,  // Minimum opacity
  maxOpacity: 0.8,  // Maximum opacity
  duration: 2,      // Pulse duration in seconds
});

<div ref={glowRef} data-glow>Glowing element</div>
```

### 4. `useHeroScrollParallax`
Subtle scroll parallax for hero image.

**Usage:**
```tsx
const parallaxRef = useHeroScrollParallax<HTMLImageElement>(0.1);

<img ref={parallaxRef} src="..." alt="..." />
```

## Complete Example

```tsx
import { useCursorParallax } from '../hooks/useCursorParallax';
import { useFloatingAnimation } from '../hooks/useFloatingAnimation';
import { useGlowPulse } from '../hooks/useGlowPulse';
import { useHeroScrollParallax } from '../hooks/useHeroScrollParallax';

function HeroSection() {
  // Cursor parallax for main container
  const heroImageParallaxRef = useCursorParallax<HTMLDivElement>({
    rotation: 2,
    movement: 3,
    smoothness: 0.1,
  });

  // Floating animation for stacked cards
  const cardsFloatRef = useFloatingAnimation<HTMLDivElement>({
    distance: 4,
    duration: 3,
  });

  // Glow pulse overlay
  const glowRef = useGlowPulse<HTMLDivElement>({
    minOpacity: 0.5,
    maxOpacity: 0.9,
    duration: 2,
  });

  // Floating crypto icons
  const btcFloatRef = useFloatingAnimation<HTMLDivElement>({
    distance: 5,
    duration: 4,
    randomize: true,
  });

  // Scroll parallax for image
  const imgParallaxRef = useHeroScrollParallax<HTMLImageElement>(0.1);

  return (
    <div className="hero-image" ref={heroImageParallaxRef}>
      <div className="coin btc" ref={btcFloatRef}>₿</div>
      <div className="hero-img-box" ref={cardsFloatRef}></div>
      <div className="hero-glow-overlay" ref={glowRef} data-glow></div>
      <img ref={imgParallaxRef} src="..." alt="..." />
    </div>
  );
}
```

## Features

✅ **GPU-Accelerated** - Uses `transform`, `translate3d`, and `will-change`  
✅ **Performance Optimized** - `backface-visibility: hidden` for smooth rendering  
✅ **Modular & Reusable** - Each hook is independent and composable  
✅ **TypeScript** - Full type safety with generics  
✅ **GSAP Integration** - Uses GSAP for smooth, professional animations  
✅ **ScrollTrigger** - Integrated with GSAP ScrollTrigger for scroll-based animations  

## Animation Details

1. **Floating Cards**: 2-6px vertical movement, 3-second cycle
2. **Cursor Parallax**: 1-3 degree rotation + 1-3px movement based on mouse position
3. **Scroll Parallax**: 10% of scroll distance, smooth scrubbing
4. **Entrance**: Fade + scale animation when entering viewport
5. **Floating Icons**: Random drift with different durations (4-6 seconds)
6. **Glow Pulse**: Soft opacity animation (0.4-0.8) with 2-second cycle

## Performance Tips

- All animations use `transform` and `opacity` (GPU-friendly)
- `will-change` is set for animated properties
- `backface-visibility: hidden` prevents flickering
- Smooth easing curves for premium feel
- Minimal repaints and reflows

