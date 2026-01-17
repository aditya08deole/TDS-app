# EvaraTDS iOS/macOS Aesthetic Overhaul - Implementation Plan

## Phase 1: Core Design Language & System Foundations
- [ ] **Design System Setup**: Define strict CSS variables for "True Black" background, deep charcoal panels, and Apple system colors.
- [ ] **Typography**: Implement system-ui/San Francisco font stack with careful weight balancing (Regular/Medium/Semibold).
- [ ] **Glassmorphism**: Create professional `glass-panel` utilities with subtle blur, noise (optional), and inner highlights.
- [ ] **Animations**: Define slow, easing-based transitions for hover, modal, and page interactions.

## Phase 2: Application Structure & Navigation
- [ ] **Sidebar Redesign**: Transform into a floating macOS-style control panel with translucent background.
- [ ] **Navigation Items**: Use SF-style line icons, subtle active states (glow/fill), and minimalistic profile section.
- [ ] **Top Bar**: Minimalist header with system status indicators.

## Phase 3: Dashboard Page (Real-Time Core)
- [ ] **Summary Cards**: Compact, calm cards for Online/Warning/Critical counts.
- [ ] **Device Widgets**: iOS-widget style cards for individual devices with sparklines.
- [ ] **Trend Charts**: Refine Recharts to use smooth curves, gradients, and minimal axes (Apple Health style).
- [ ] **Status Distribution**: Minimalist donut chart with system colors.

## Phase 4: Device Table & Data Density
- [ ] **Table Styling**: Clean, spacious rows with soft separators and hover states.
- [ ] **Status Indicators**: Small, glowing dots/pills.
- [ ] **Interactions**: Smooth checkbox animations and sorting.

## Phase 5: Map View Page (Spatial Intelligence)
- [ ] **Map Theme**: Custom dark map tiles (Apple Maps Dark inspired).
- [ ] **Markers**: Custom CSS/SVG markers color-coded by status (pulsing for critical).
- [ ] **Popups**: Translucent, glass-effect info cards on click.

## Phase 6: Alerts & Logs Page
- [ ] **Layout**: Summary header + clean alert history table.
- [ ] **Visuals**: Use subtle color accents for severity, plain text for readability.

## Phase 7: Settings & Administration
- [ ] **Layout**: Two-panel iOS Settings style layout.
- [ ] **Components**: Soft input fields, toggle switches, and calm buttons.

## Phase 8: Performance & Real-time
- [ ] **Loaders**: Skeleton shimmer effects.
- [ ] **Optimizations**: Ensure invalidation of queries is efficient and animations don't cause layout shifts.

## Phase 9: Final Polish
- [ ] **Review**: Cross-reference with reference images and Apple Human Interface Guidelines.
- [ ] **Mobile**: Verification of touch targets and responsive behavior.
