# REACT — Audio-Reactive 3D Visualizer & Motion Studio

<p align="center">
  <img src="tp-logo.png" alt="Teja Priyan TP Logo" width="120" style="border-radius: 50%; box-shadow: 0 0 25px rgba(0, 229, 255, 0.4);" />
</p>

<p align="center">
  <strong>Conceived, Designed & Developed by Teja Priyan</strong>
</p>

<p align="center">
  <a href="https://reactsound.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/LIVE%20STUDIO-reactsound.vercel.app-00e5ff?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Studio" />
  </a>
  <img src="https://img.shields.io/badge/Architecture-100%25%20Client--Side-00e5ff?style=for-the-badge&logoColor=white" alt="Client Side" />
  <img src="https://img.shields.io/badge/Graphics-WebGL2%20Procedural%20Shaders-7928ca?style=for-the-badge&logoColor=white" alt="WebGL2" />
  <img src="https://img.shields.io/badge/Audio-Web%20Audio%20API%20%2B%20Live%20Analysis-ff007f?style=for-the-badge&logoColor=white" alt="Web Audio" />
  <img src="https://img.shields.io/badge/License-Proprietary%20%C2%B7%20All%20Rights%20Reserved-white?style=for-the-badge" alt="License" />
</p>

<p align="center">
  🌐 <strong>Experience the Studio Live:</strong> <a href="https://reactsound.vercel.app/">https://reactsound.vercel.app/</a>
</p>

---

## Overview

**REACT** ([https://reactsound.vercel.app/](https://reactsound.vercel.app/)) is an advanced, high-performance audio-reactive 3D motion design studio operating directly inside modern web browsers. Conceived and engineered by **Teja Priyan**, REACT transforms audio tracks, musical instruments, and live microphone input into mesmerizing, cinematic 3D visualizers powered by real-time audio telemetry, procedural shaders, and massive GPU particle swarms.

Every computation — from low-frequency Fourier transforms and spectral-flux beat tracking to signed-distance field (SDF) raymarching and particle physics — executes entirely on your local machine with zero network latency, zero cloud dependencies, and uncompromising visual fidelity.

---

## Core Capabilities

### 1. 3D Procedural Materials
* **Chrome**: Hyper-reflective liquid-metal surface with Fresnel environment reflections and dynamic chromatic dispersion.
* **Glass**: High-refraction volumetric glass with internal caustics, edge aberration, and light transmission.
* **Neon**: High-energy emissive gas tubes with multi-pass HDR bloom and audio-coupled intensity spikes.
* **Liquid**: Real-time turbulent surface distortion that ripples and surges with sub-bass frequencies.
* **Paper, Pixel & Organic**: Stylized tactile materials ranging from matte cardstock shadows to retro rasterization and organic flesh shaders.

### 2. Audio Intelligence & Reactivity
* **Multi-Band Frequency Splitting**: Independent tracking across Sub-Bass (20–120 Hz), Mids (120–2000 Hz), and Treble (2–16 kHz).
* **Spectral-Flux Beat Tracking**: Automatic transient detection that catches rhythm hits and drop moments with look-ahead precision.
* **Live Microphone & Line-In Stream**: Real-time live audio capture with Adaptive Gain Control (AGC) and feedback isolation.
* **Waveform Timeline**: Interactive scrubber with beat markers, drop indicators, playback speeds (0.25× to 2×), reverse play, and loop controls.

### 3. Particle Dynamics System
* **100,000+ Physics Particles**: Additive particles that bind to the contours of 3D objects and erupt upon beat drops.
* **Audio-Force Synthesis**: Particle push, turbulent flow, jitter, and expansion directly modulated by track energy.
* **Particle Reactivity Tuner**: Granular slider control adjusting particle responsiveness from subtle cosmic dust to explosive supernovas.

### 4. Custom Typography & Artwork Compositing
* **Font Drag-and-Drop / Upload**: Real-time browser parsing of `.ttf`, `.otf`, and `.woff2` font files using the `FontFace` API.
* **Image & Logo Compositing**: Drop transparent logos or album artwork with multi-position text overlays (`BELOW`, `BOTTOM`, `CENTER`, `TOP`).
* **SDF Extrusion**: Signed-distance field generation that converts raster typography and artwork into beveled 3D geometry in real-time.

### 5. Custom Color Palette Builder
* **Dynamic 4-Channel Palette Architect**:
  * **Primary (`c0`)**: Base typography and core reflections.
  * **Secondary (`c1`)**: Mid-tone highlight and particle accent.
  * **Accent (`c2`)**: Edge glow, specular fringe, and UI chrome accent.
  * **Background (`bg`)**: Low-light environment gradient.
* **Live UI Synchronisation**: Changing colors dynamically theme both the 3D WebGL engine and the user interface.

### 6. Studio Recording & Export Engine
* **High-Bitrate Video**: Vertical (9:16 for Reels/TikTok/Shorts), Widescreen (16:9), and Square (1:1) video capture.
* **Deterministic Render Pipeline**: Offline frame-by-frame synthesis guaranteeing pristine 60 FPS output regardless of device hardware.
* **Animated GIF & Single Frame Capture**: High-density animated GIF exporter and 4K still frame capture.

---

## Interactive Controls

| Control | Description |
| :--- | :--- |
| **`Space`** | Play or Pause audio playback |
| **`←` / `→`** | Seek backward / forward 2 seconds |
| **`1` - `4`** | Toggle Studio Panels (`AUDIO`, `OBJECT`, `MOTION`, `STYLE`) |
| **`S`** | ✦ **SURPRISE ME** (Generates curated aesthetic combinations) |
| **`R`** | Open **RECORD** export dialog |
| **`C`** | Enter **CINEMA Mode** (Full-screen minimalist interface) |
| **`Esc`** | Exit panels, Cinema mode, or Discover overlays |
| **Pointer Motion** | Interactive camera whip, parallax tilt, and particle vortex attraction |

---

## Architecture

```
                      ┌──────────────────────────────────────┐
                      │          Web Audio API Engine        │
                      │  (FFT, Spectral Flux, AGC, Beats)   │
                      └──────────────────┬───────────────────┘
                                         │
                                         ▼
                      ┌──────────────────────────────────────┐
                      │          Engine Spring Driver        │
                      │ (Transient Smoothing, Camera Whip)   │
                      └──────────────────┬───────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│        SDF & Geometry Pipeline       │   │        GPU Particle System           │
│  (Custom Fonts, Logos, Text Overlays)│   │  (100k+ Additive Audio Swarm)        │
└──────────────────┬───────────────────┘   └──────────────────┬───────────────────┘
                   │                                          │
                   └────────────────────┬─────────────────────┘
                                        │
                                        ▼
                      ┌──────────────────────────────────────┐
                      │           WebGL2 Compositor          │
                      │ (Procedural Shaders, Multi-Tap Bloom)│
                      └──────────────────┬───────────────────┘
                                         │
                                         ▼
                      ┌──────────────────────────────────────┐
                      │       4K / 60FPS Video Exporter      │
                      │ (Deterministic Offline / Realtime)   │
                      └──────────────────────────────────────┘
```

---

## Author & Intellectual Property

**REACT** is created, designed, and maintained by **Teja Priyan**.

* **Live Studio**: [https://reactsound.vercel.app/](https://reactsound.vercel.app/)
* **Creator**: Teja Priyan
* **GitHub**: [@TejaPriyan](https://github.com/TejaPriyan)
* **Repository**: [https://github.com/TejaPriyan/REACT](https://github.com/TejaPriyan/REACT)
* **Contact**: [teja1616150@gmail.com](mailto:teja1616150@gmail.com)

### Copyright & License

```
Copyright (c) 2026 Teja Priyan. All Rights Reserved.
```

This software and its source code are proprietary. Unauthorized reproduction, modification, distribution, reverse engineering, or commercial use without prior written consent from Teja Priyan is strictly prohibited.
