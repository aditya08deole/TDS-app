# UI/UX Guidelines: Liquid Glass Asymmetric Popups, Curved Navigation & Inverted Corner Cutouts

## Design Philosophy

The EvaraTDS interface uses a state-of-the-art **Liquid Glass Aesthetic** combined with **Selective/Asymmetric Corner Rounding** and **Inverted Curve Cutouts** to create a high-density, luxury IoT command center experience.

---

## Key Visual Rules

### 1. Selective / Asymmetric Corner Rounding
Standard four-sided uniform rounding is replaced or enhanced with intentional directional corner radii:
- **Curved Top Header Panels**: Rounded ONLY on the bottom corners (`rounded-b-[2.5rem] rounded-t-none`). Creates the illusion of fluid dripping down from the status bar.
- **Curved Bottom Navigation Bar**: Rounded ONLY on the top corners (`rounded-t-[2.5rem] rounded-b-none`). Slides up gracefully from the bottom viewport.
- **Inverted Curved Tab Cutouts**: Asymmetric tab selectors featuring smooth concave transition curves between active and inactive tabs (modeled after Screen 3 in the reference UI).
- **Asymmetric Feature Popups**: Asymmetric diagonal radius pairings (e.g., `rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-xl rounded-bl-xl`). Directs user eye flow diagonally across key KPIs.

### 2. Liquid Glass Material Stack
Every popup card and dialog MUST incorporate the 4-layer Liquid Glass stack:
1. **Base Backdrop**: High-density blur `backdrop-blur-2xl` paired with `bg-background/40` or `bg-slate-950/50`.
2. **Fluid Tint**: Linear/Radial gradient tint `bg-gradient-to-br from-cyan-500/15 via-blue-600/5 to-indigo-900/20`.
3. **Specular Light Border**: High-contrast top rim reflection using `border-t border-white/30` or `border-l border-white/20`.
4. **Deep Soft Drop Shadow**: Multi-stage ambient shadow `shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]` or `shadow-cyan-500/10`.

### 3. Interactive Liquid Micro-Animations
- **Hover / Active States**: Smooth scaling `transition-all duration-500 ease-out hover:scale-[1.02] active:scale-95`.
- **Pill Action Buttons**: Full capsule buttons (`rounded-full`) with vibrant gradient glow (`bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25`).
- **Glow Follower**: Subtle radial cursor glow reflecting off liquid card surfaces.
