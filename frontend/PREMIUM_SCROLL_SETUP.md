# Premium 2026 Scroll System Setup

## Installation

```bash
cd frontend
npm install lenis gsap
```

## Features

### 1. Lenis Smooth Scroll
- Buttery smooth, low-friction scrolling
- Premium easing curves
- Optimized for performance

### 2. GSAP ScrollTrigger Animations
- Subtle fade-up animations
- Scale-in effects
- Slide-up reveals
- Minimal and luxurious

### 3. Micro-Parallax
- Extremely subtle movement (2-5px)
- Perfect for floating elements
- Hero section coins with slight rotation

### 4. Horizontal Scroll Section
- Elegant horizontal scroll activated by vertical scroll
- Used for crypto table section
- Smooth and cinematic

## Usage

### Basic Setup
The hooks are already integrated in `DashboardPage.tsx`:

```tsx
import { useLenisScroll } from '../hooks/useLenisScroll';
import { useGSAPScrollAnimations } from '../hooks/useGSAPScrollAnimations';
import { useMicroParallax } from '../hooks/useMicroParallax';

// In component:
useLenisScroll();
useGSAPScrollAnimations();
useMicroParallax();
```

### GSAP Animations

Add `data-gsap-animate` attribute to elements:

```tsx
<div data-gsap-animate="fade-up" data-gsap-delay="0.2" data-gsap-duration="1.2">
  Content
</div>
```

**Animation Types:**
- `fade-up` - Fades in and slides up
- `scale-in` - Scales in from 0.95 to 1
- `slide-up` - Slides up from below

**Attributes:**
- `data-gsap-animate` - Animation type
- `data-gsap-delay` - Delay in seconds (e.g., "0.2")
- `data-gsap-duration` - Duration in seconds (e.g., "1.2")
- `data-gsap-stagger` - Stagger delay for multiple elements

### Micro-Parallax

Add `data-parallax` attribute to floating elements:

```tsx
<div 
  data-parallax 
  data-parallax-speed="0.03" 
  data-parallax-rotation="0.3"
>
  Floating Element
</div>
```

**Attributes:**
- `data-parallax` - Enables parallax
- `data-parallax-speed` - Movement speed (0.02-0.05 recommended)
- `data-parallax-rotation` - Rotation amount (0.2-0.5 recommended)

### Horizontal Scroll

Wrap content in `HorizontalScrollSection`:

```tsx
<HorizontalScrollSection speed={1.5}>
  <div className="your-content">
    {/* Content that scrolls horizontally */}
  </div>
</HorizontalScrollSection>
```

**Props:**
- `speed` - Scroll speed multiplier (default: 1)

## Performance Tips

1. **GPU Acceleration**: All transforms use `translateZ(0)` for GPU acceleration
2. **Will-Change**: Elements use `will-change: transform` for optimization
3. **Mobile**: Parallax disabled on mobile for better performance
4. **Reduced Motion**: Respects `prefers-reduced-motion` media query

## Customization

### Easing Curves
Edit `premium-scroll.css`:
```css
:root {
  --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-luxury: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-cinematic: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Lenis Settings
Edit `useLenisScroll.ts`:
```tsx
const lenis = new Lenis({
  duration: 1.2, // Adjust smoothness
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  // ... other options
});
```

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile: Smooth scroll disabled, native scroll used

