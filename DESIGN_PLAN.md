# Design Implementation Plan

## Current State Analysis

### CSS Framework
- **Tailwind CSS v4** (latest version with CSS-based configuration)
- Uses `@import "tailwindcss"` instead of traditional `@tailwind` directives
- Configuration via `@theme inline` in globals.css
- Color system uses OKLCH color space
- Already has light/dark mode support

### Current Styling
- Simple gradient backgrounds (`bg-gradient-to-br from-blue-50 to-indigo-100`)
- Basic white cards with shadows
- Standard Tailwind utilities
- Shadcn/ui components (Button, Card, Input, Label, etc.)

### Working Features
✅ Translation functionality
✅ SVG flags from flagcdn.com
✅ User favorites system
✅ Authentication flow
✅ Dashboard with conversations
✅ All API routes functional

## Design Requirements

### Branding
1. **iK OneWorld Logo** - Add to navigation and login
2. **Invictus Logo** - "Brought to you by: Invictus"

### Visual Style
1. **Modern/Futuristic** - Dark theme with gradients
2. **Glassmorphism** - Backdrop blur effects
3. **Gradients** - Navy/purple color scheme
4. **Animations** - Smooth transitions, fade-ins, floating elements
5. **Custom Fonts** - Not default system fonts

### Technical Requirements
1. **Responsive** - Mobile, tablet, desktop
2. **Accessible** - WCAG compliance
3. **Sticky Navigation** - On language selection page
4. **Navigation** - Between pages
5. **Preserve Functionality** - Don't break existing features

## Implementation Strategy

### Phase 1: Update Color Scheme
- Modify CSS variables in globals.css
- Add navy/purple gradient colors
- Keep existing OKLCH format
- Test that existing components still work

### Phase 2: Add Custom Fonts
- Import Google Fonts (Inter, Space Grotesk)
- Add to @theme configuration
- Apply to typography

### Phase 3: Add Custom Utility Classes
- Glassmorphism effects
- Gradient backgrounds
- Animation keyframes
- Glow effects

### Phase 4: Create Navigation Component
- Add logos (properly sized)
- Sticky header
- User menu
- Navigation links

### Phase 5: Update Pages Incrementally
- Login page
- Dashboard
- Language selection
- Translation page
- Profile page

### Phase 6: Test and Deploy
- Local build test
- Verify all features work
- Deploy to Vercel

## Key Lessons from Previous Attempt

### What Went Wrong
1. ❌ Logos were not properly sized (used wrong dimensions)
2. ❌ Didn't test locally before deploying
3. ❌ Made too many changes at once
4. ❌ Broke existing functionality
5. ❌ CSS wasn't loading properly

### How to Avoid
1. ✅ Test each change locally with `pnpm run build`
2. ✅ Make incremental commits
3. ✅ Verify existing features still work after each change
4. ✅ Use proper Tailwind v4 syntax
5. ✅ Size images appropriately (h-8 for nav, not h-12)
6. ✅ Don't break existing utility classes

## Next Steps
1. Update globals.css with new color scheme
2. Add custom fonts
3. Add utility classes for glassmorphism/gradients
4. Test build locally
5. Commit if successful
6. Continue incrementally
