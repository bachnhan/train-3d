---
name: accessible-diorama-ui
description: >-
  Synchronizes a 3D WebGL/WebGPU diorama or product viewer with an accessible 2D HTML navigation UI.
  Handles smooth camera framing transitions, keyboard accessibility, screen-reader semantics,
  and responsive viewport boundary clamping across mobile (320px/390px) and desktop screens.
  Use when building accessible 3D product showcases, interactive dioramas, architectural maps, or 3D galleries.
---

# Accessible Diorama UI Skill

This skill provides the accessible diorama camera picker used by Train 3D (`src/accessible-twin.js`). It bridges 3D WebGL/WebGPU viewports with WCAG 2.2-compliant 2D navigation. The reference implementation is at `references/diorama_picker.js`.

---

## When to Use

- Building 3D dioramas, product configurators, or virtual exhibition galleries.
- Allowing keyboard and screen-reader users to select and focus 3D rooms, exhibits, or components.
- Smoothly animating camera positions between focal targets with easing and dampening.
- Clamping 3D camera zoom and pan extents dynamically so scenes don't clip offscreen on small mobile viewports (320px, 390px).

## Not For

- Free-roaming first-person shooter WASD controls.
- Full 2D web forms or standard HTML pages without 3D viewports.

---

## Core Architecture

1. **Semantic HTML Control Surface:**
   An accessible list/grid (`<nav role="navigation"><ul><li><button>`) that mirrors all selectable 3D diorama targets.
2. **Camera Focus Transitions:**
   Smoothly interpolates camera eye position and look-at target vector using cubic easing:
   $$\mathbf{P}(t) = \text{lerp}(\mathbf{P}_{\text{start}}, \mathbf{P}_{\text{end}}, \text{easeOutCubic}(t))$$
3. **Responsive Extent Clamping:**
   Dynamically scales camera distance based on viewport aspect ratio to prevent clipping on mobile portrait screens:
   $$\text{scaleFactor} = \max\left(1.0, \frac{\text{aspect}_{\text{design}}}{\text{aspect}_{\text{current}}}\right)$$

See the complete reference implementation:
👉 [references/diorama_picker.js](./references/diorama_picker.js)

---

## Quick Start Example (Railway Diorama)

```javascript
import { DioramaPicker } from '.agents/skills/accessible-diorama-ui/references/diorama_picker.js';

const picker = new DioramaPicker({
  containerElement: document.getElementById('diorama-nav'),
  onFocusTarget: (target) => {
    console.log(`Camera transitioning to focus: ${target.name}`);
    // Update 3D camera eye & target coordinates
    camera.flyTo(target.camera);
  }
});

// Register line diorama stations
picker.registerTarget({
  id: 'shibuya',
  name: '渋谷 (Shibuya)',
  description: 'Main terminus with Scramble crossing and high-rise skyline',
  camera: { eye: [25, 18, 30], lookAt: [0, 2, 0] }
});

picker.registerTarget({
  id: 'futako-tamagawa',
  name: '二子玉川 (Futako-Tamagawa)',
  description: 'Tama river crossing and verdant shopping terraces',
  camera: { eye: [15, 22, 25], lookAt: [0, 0, 0] }
});

picker.registerTarget({
  id: 'yokohama',
  name: '横浜 (Yokohama)',
  description: 'Minato Mirai bay terminus and port skyline',
  camera: { eye: [30, 20, 35], lookAt: [5, 0, 5] }
});
```
