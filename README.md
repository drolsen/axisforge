# WebGPU Roblox‑Inspired Game Engine & Editor

> **Vision**  
> A fully in‑browser 3D game engine **and** editor, written in **pure JavaScript (ES2023+)** on **WebGPU**, with a Roblox‑style API and Studio‑like editor.  
> **Visual Target**: match or exceed the *Battlefield: Bad Company* (2009, Frostbite 1.0) look/feel, modernized for 2025 WebGPU.

---

## 🎯 High‑Level Goals

- **Visual Bar**: large outdoor scenes, dense foliage, destructibility, PBR, stable TAA, high‑quality shadows, post‑FX (exposure, bloom, grading).  
- **Platforms**: Desktop browsers first (Chrome/Edge/Safari TP/Firefox Nightly). Mobile is a later milestone; design remains mobile‑aware.  
- **Performance**: Baseline **1080p @ 60 FPS** on a mid‑range dGPU/iGPU; scale to 1440p/4K on high‑end GPUs.  
- **Networking**: Flexible authority like Roblox (server‑auth, client‑auth, or hybrid), 8–32 players, WebRTC DataChannels + WebSocket fallback.  
- **Scripting**: Roblox‑inspired **object model + events** in JavaScript. Clear separation of **ServerScripts** and **ClientScripts**. Hot‑reload in dev.  
- **Editor**: Studio‑like in‑browser editor (Explorer, Properties, Viewport, Console, Materials/Animation/Assets tools).  
- **Assets**: glTF 2.0, FBX, OBJ; PNG/JPEG/TGA; MP3/WAV/OGG. Optional KTX2/BasisU compression. **Auto‑Docs** from AST (no comment boilerplate).

> **Legal note**: We take **heavy inspiration** from Roblox naming/UX where lawful and avoid exact duplication of proprietary APIs.

---

## 🧱 Architecture Overview

- **Core**: Hybrid **scenegraph + ECS‑lite** (`Engine`, `Instance`, `Services`).  
- **Renderer (WebGPU)**: Forward+ / clustered pipeline; PBR metal‑roughness (glTF‑aligned); VSM/CSVSM shadows; DDGI probes; post‑FX (TAA, bloom, tonemap).  
- **Terrain**: CDLOD heightfields, shader splats (height/slope rules), **GPU destruction masks** (craters).  
- **Voxels**: Chunked SDF store, Dual Contouring / Transvoxel mesher, CSG brushes, near‑field destruction that blends with heightfield far‑field.  
- **Animation**: Skeletal/morph import, blend trees, timeline editor, **IK** (FABRIK/CCD) optimized for networking.  
- **Physics**: WASM backend adapter (Rapier.js or Ammo.js), FPS character controller, ballistics (gravity/drag/wind).  
- **Networking**: Remotes (Events/Functions), replication & ownership, snapshot/interp/prediction, reconciliation; interest management grid.  
- **Audio**: WebAudio graph with HDR‑style auto‑mix (priority ducking), HRTF spatialization, occlusion, reverb zones.  
- **UI**: Roblox‑inspired **UDim/UDim2** layout, Frames, Strokes, Corners, SizeConstraints; device‑agnostic input (mouse/touch/gamepad).

---

## 🧭 Editor Parity & UX Pillars

- **Panels**: Explorer (Workspace/ServerScripts/ClientScripts/SharedStorage), Properties, Viewport, Console, Materials, Animation, Assets.  
- **Gizmos**: Translate/Rotate/Scale; world/local; snapping.  
- **Authoring**: Terrain sculpt/paint; voxel CSG; crater brush; material node graph → WGSL generator.  
- **Scripting**: Built‑in code panel for quick edits; hot reload for ClientScripts; ServerScripts require safe restart.  
- **Layout**: UDim/UDim2 math, anchors, constraints; UI primitives mirror Roblox concepts (naming adjusted where necessary).

---

## 📦 Monorepo Layout

    packages/
      runtime-core/     # engine loop, Services, Instances
      renderer-webgpu/  # device, framegraph, lighting, materials, postFX
      terrain/          # heightfields, splats, destruction masks
      voxels/           # chunk store, meshing, edit ops
      physics/          # physics adapters, character controller, ballistics
      animation/        # skeleton, animator, IK, retargeting
      net/              # transports, remotes, replication
      editor/           # shell, panels, gizmos, update notifier
      assets/           # importers (gltf/fbx/obj/audio), processors (ktx2/meshopt)
      ui/               # UDim, UDim2, Frame, constraints, layout engine
      test-utils/       # playwright config, visual diff harness
    examples/
      hello-triangle/
      pbr-sponza/
      terrain-heightfield/
      voxel-destruction/
    scripts/
      dev-server.mjs
      gen-docs.mjs
      update-check.mjs
    tools/
      pixel-compare.mjs
    docs/               # generated autodocs

> The directory tree above uses **indented code** (no nested Markdown fences) to remain copy/paste‑safe.

---

## 🔀 Branching Strategy

- `master` — **release‑only**; semantic version tags.  
- Long‑lived silos: `silo/runtime-core`, `silo/renderer-webgpu`, `silo/terrain`, `silo/voxels`, `silo/physics`, `silo/animation`, `silo/net`, `silo/editor`, `silo/assets-pipeline`, `silo/ui`.  
- Topic branches → silo (squash). Silo → master (merge + version + release notes).

Bootstrap (one‑time):
```
git checkout -b silo/runtime-core
git checkout -b silo/renderer-webgpu
git checkout -b silo/terrain
git checkout -b silo/voxels
git checkout -b silo/physics
git checkout -b silo/animation
git checkout -b silo/net
git checkout -b silo/editor
git checkout -b silo/assets-pipeline
git checkout -b silo/ui
```

---

## 🧪 Testing & Quality

- **Unit (AVA)**: math/utilities/subsystems.  
- **Integration (Playwright)**: launch examples, capture canvas → **pixelmatch** vs golden (≤2% diff).  
- **Perf canaries**: read GPU timing queries/frame time; log budget breaches.  
- **Net sims**: latency/packet loss injection for prediction/reconciliation.  
- **Auto‑Docs**: `scripts/gen-docs.mjs` parses AST to HTML tables (no comment boilerplate).

---

## 🚦 CI/CD

- GitHub Actions matrix on Node 20: `npm run ci` → lint, unit, visual tests, build.  
- Release workflow on tags `v*.*.*`: build artifacts, publish docs, attach editor build.

---

## 🧩 Milestones

- **M0 — Hello WebGPU + Loop**: Device init, swapchain, main loop, Services, hello‑triangle visual test.  
- **M1 — PBR + Import**: Forward+, PBR metal‑roughness, VSM shadows, glTF import, KTX2 option, auto‑mips.  
- **M2 — Editor MVP**: Shell + Explorer/Properties/Viewport/Console, UDim/UDim2 + Frame primitives, gizmos, client hot‑reload.  
- **M3 — Terrain**: CDLOD, splat rules, paint layers, GPU crater masks + brushes.  
- **M4 — Voxels**: Chunked SDF store, Dual Contouring/Transvoxel meshing, bridge with heightfield, CSG tools.  
- **M5 — Lighting++**: TAA + motion vectors, cascaded VSM with contact hardening, DDGI probes (v1).  
- **M6 — Physics & Animation**: Rapier/Ammo adapter, FPS controller, ballistics; skeletal import, blend trees, IK; better‑than‑Roblox animation editor.  
- **M7 — Networking**: WebRTC + WS, remotes & replication, prediction/reconciliation, 8–16 player sample.  
- **M8 — Assets & Auto‑Docs**: Texture knobs UI, meshopt, AST docs pipeline + in‑editor Help.  
- **M9 — Packaging & Updater**: Export client bundle + Node server starter; update notifier + safe pull.  
- **M10 — Mobile (stretch)**: Input abstraction parity (tap/click, virtual sticks), perf/memory trims.

---

## ✅ Definition of Done

- Pure JS (ES2023+).  
- `npm run lint`, `npm run test`, and `npm run test:visual` all pass.  
- Visual diffs ≤ **2%** vs goldens.  
- Editor runs via `npm run dev` without console errors.  
- Auto‑docs regenerate cleanly.  
- Releases cut from `master` only; SemVer honored.

---

## 📜 License

MIT (TBD)
