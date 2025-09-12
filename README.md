# WebGPU Game Engine & Editor  
*A Roblox-style API and editor experience with Battlefield: Bad Company (2008/2009)–tier visuals as the baseline, extended with modern 2025 WebGPU rendering capabilities.*

---

## 🎯 Vision

This project aims to create a **3D game engine and editor** that:  

- Replicates the **Roblox API and Studio editor workflow** top-to-bottom for maximum familiarity.  
- Matches and surpasses the **visual fidelity of Battlefield: Bad Company (2008/2009)** — specifically targeting its destruction, terrain, lighting, and large-scale multiplayer.  
- Leverages **WebGPU** and modern browser tech to bring console/PC-grade rendering to the web.  
- Provides a **sandboxed scripting environment** in pure JavaScript (ES6+), with Roblox-parity Services, Instances, Events, Attributes, etc.  
- Ships as a **static web bundle** (CDN-deployable, PWA-ready), with optional desktop wrapping later.  
- Designed to **scale over years** of development, with a clear modular repo structure, CI/CD, and branching strategy.  

---

## 🗂 Repo & Branching

- **Master branch** → stable releases.  
- **Feature silos** branched off master:  
  - `render-core`  
  - `lighting`  
  - `terrain`  
  - `water`  
  - `destruction`  
  - `animation`  
  - `audio`  
  - `networking`  
  - `editor`  
  - `docs`  
  - `tools`  

---

## 📐 Engine Architecture

### Core
- **Instance tree** identical to Roblox (root `Instance` → subclasses).  
- **Services**: `Workspace`, `Players`, `ReplicatedStorage`, `ServerStorage`, `Lighting`, `RunService`, `UserInputService`, `TweenService`, `PhysicsService`, `CollectionService`, `DataStoreService`, `MessagingService`, `MemoryStoreService`, etc.  
- **Attributes**: every Instance supports typed key/value storage.  
- **CollectionService**: tagging/querying Instances.  
- **TweenService**: property interpolation, easing styles/directions.  
- **RemoteEvents/RemoteFunctions**: client ↔ server RPC identical to Roblox.  

### Scripting
- **Pure JavaScript ES6+**.  
- **Sandboxed runtime**, exposing only engine APIs and whitelisted browser APIs.  
- **Signals/Events** replicating Roblox semantics (`Connect`, `Wait`).  
- **Deterministic random** for gameplay; non-deterministic for FX.  

### Scene Format
- **JSON source of truth** (human-diffable, Git-friendly).  
- **Stable GUIDs** for all Instances.  
- **Prefabs** with overrides and variants.  
- **Optional binary packs** for runtime optimization.  
- **Chunked scenes** for streaming large worlds.  

---

## 🎨 Rendering & Materials

### Pipeline
- **Forward+ clustered renderer** baseline.  
- **Optional Deferred** path later.  
- **Framegraph** architecture.  

### Lighting
- Directional sun with **cascaded shadow maps**.  
- Punctual lights with shadow atlas.  
- **Destruction-aware lighting** (light leaks when walls blow open).  
- **Volumetric fog & light shafts**.  
- **Global Illumination tiers**: baked lightmaps → probe volumes → SDFGI.  
- **Reflection probes** + **SSR** fallback.  

### Materials & Shaders
- **PBR metallic-roughness** baseline.  
- Advanced extensions: clearcoat, sheen, transmission, anisotropy, parallax, decals.  
- **Node-based material editor** + direct **WGSL hot-reload**.  
- **Material Instances** with per-instance overrides.  

### Post-Processing
- HDR + **ACES tonemapping**, auto-exposure.  
- Bloom, SSAO/HBAO, SSR, DoF, motion blur.  
- Color grading LUTs, vignette, film grain, chromatic aberration.  
- **Anti-aliasing tiers**: FXAA, MSAA, TAA.  
- **Per-camera volumes** (walk into a cave → auto grading/fog).  

---

## 🌍 Terrain & Environment

### Terrain
- **Roblox-style voxel Terrain API**.  
- Extended with:  
  - Destruction/deformation (craters, trenches).  
  - Multi-layer splat mapping, tri-planar.  
  - Clipmaps for streaming large areas.  
  - Erosion/decals (tracks, scorch).  
- **Editor tools**: sculpt, paint, noise, erosion, splines (roads/rivers).  
- **Streaming previews** overlay in editor.  

### Water
- Roblox terrain water **parity API**.  
- Modern features:  
  - FFT ocean, Gerstner waves.  
  - Refraction/reflection, caustics.  
  - Flowmaps, foam, shoreline blending.  
  - Underwater fog/light scattering.  
  - Volumes (tanks, pipes, spillable).  
  - Buoyancy, vehicle interaction.  
  - Splash/spray/mist VFX tied to physics/audio.  

### Weather & Sky
- **WeatherService**: presets + scripting.  
- Presets: Sunny, Overcast, Rainstorm, Snowy Winter, Tropical Storm.  
- Integrated with lighting, postFX, audio, terrain/water.  
- Scriptable API for runtime control.  
- **Atmosphere**, **Sky**, and **Clouds** objects mirrored from Roblox.  
- Modern **volumetric clouds**: dynamic density, LOD tiers, lighting hooks, storm transitions.  

---

## 💥 Destruction

- **Runtime fracture** (compute/Voronoi).  
- Support for **pre-fractured assets**.  
- **Debris system**: physics-sim for large chunks, particles/decals for small.  
- **Networking sync** of destruction states.  

---

## 🕹 Physics & Pathfinding

- Physics backend via **WASM integration** (Rapier/PhysX).  
- Collision groups + filters via `PhysicsService`.  
- Character controllers, ragdolls, vehicles.  
- PathfindingService++:  
  - Grid + navmesh.  
  - Dynamic updates on destruction/terrain changes.  
  - Agent radius/height/jump parameters.  

---

## 🎵 Audio

- **HDR mixing** (ducking, priority).  
- **3D spatial audio** (HRTF).  
- Reverb/ambient zones.  
- Occlusion/obstruction.  
- Mixer busses, snapshots.  
- **Voice chat** via Opus.  
- Formats: Ogg Vorbis (compressed), WAV/PCM (raw), MP3 (import only).  
- **In-editor mixer/visualizer**.  

---

## 🌐 Networking

- **Authoritative server** with client prediction & lag comp.  
- **Remotes** (Events & Functions) API identical to Roblox.  
- **DataStoreService** (no size limits).  
- **OrderedDataStore** for leaderboards.  
- **MemoryStore** (ephemeral, queues, TTLs).  
- **MessagingService** (cross-server pub/sub).  
- **ReplicationService** for Instances.  

---

## 🖥 Editor

### v0.1 (MVP)
- Explorer (Instance tree).  
- Properties (with Attributes).  
- Viewport (camera controls, gizmos).  
- Console/Output.  
- Asset Manager (local).  
- Git panel (repo connect, commit, branch).  
- Play/Stop in editor (single client).  
- Project Settings.  
- Basic Profiler (FPS, memory).  

### v0.2+
- Terrain tools expansion.  
- Node-based Material Editor.  
- Lighting/Weather panels.  
- Animation editor (timeline, blend trees, IK).  
- Remote viewer (network inspector).  
- Advanced profiler (GPU/CPU timers, overdraw heatmap).  

---

## 📦 Packaging & Deployment

- **Static web bundle** → host on any CDN.  
- **PWA** support (offline caching, installable).  
- Update check via `latest.json`.  
- Optional desktop wrapper (Electron/Tauri) later.  

---

## 🛠 CI/CD & Tools

- Tests: **AVA** (unit + integration).  
- Asset pipeline: store `.b64` placeholders in repo → CI decodes → binaries in dist.  
- **Docs**: auto-generated via documentation.js, integrated in editor.  
- **CI workflow**: lint → test → decode → build → docs → pack → publish.  
- Release process: atomic releases from master branch.  

---

## 🗺 Roadmap

### Milestone 1 (Editor Shell, 2–3 weeks)
- Explorer, Properties, Viewport, Console.  
- Scene JSON load/save with GUIDs.  
- Play/Stop in editor.  
- Git panel.  

### Milestone 2 (Engine Core, 2–3 weeks)
- Instance system + Services.  
- Scripting sandbox.  
- Input handling.  
- Physics integration.  
- Renderer: Forward+, PBR baseline, sun + cascaded shadows.  
- Terrain API (basic sculpt/paint).  
- Audio (spatial baseline).  

### Milestone 3 (Polish & Packaging, 2 weeks)
- Asset Manager.  
- .b64 pipeline.  
- PWA + update checks.  
- Basic profiler.  

### Milestone 4 (Showpiece Lift, 3–4 weeks)
- SSR, SSAO, TAA.  
- Decals, advanced water.  
- Runtime destruction MVP.  
- Volumetric fog/clouds.  

---

## 📌 Guiding Principle

**“Roblox parity + modern upgrades where needed.”**  
If Roblox has it → replicate exactly.  
If Roblox lacks it → extend to meet or surpass Battlefield Bad Company visuals, using modern WebGPU techniques.  
