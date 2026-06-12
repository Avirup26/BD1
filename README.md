# ঢাকা সিটি আন্ডারওয়ার্ল্ড — Dhaka City Underworld

An open-world 3D action game set in Dhaka, Bangladesh. Runs entirely in the browser — no install, no backend. Built with React 18, Vite 5, and Three.js.

---

## Play

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, click **নতুন খেলা — NEW GAME**, and start at Sadarghat pier.

**Controls**

| Action | Key |
|---|---|
| Move | `W A S D` |
| Sprint | `Shift` |
| Enter / Exit vehicle | `E` |
| Attack / Shoot | `F` or `Left Click` |
| Switch weapon | `1` / `2` |
| Horn (in vehicle) | `H` |
| Toggle camera mode | `C` |
| Toggle radio | `R` |
| Open full map | `M` |
| Pause | `Esc` |

Touch controls are available on mobile (virtual joystick + action buttons).

---

## World

The map covers a 2000 × 2000 unit area modelled after real Dhaka geography — north to south from Uttara to Buriganga, west to east from Mirpur to Gulshan.

**Districts**

| Bengali | Area |
|---|---|
| উত্তরা | Uttara — airport, wide boulevards |
| মিরপুর | Mirpur — dense residential, market |
| গুলশান | Gulshan — embassy row, glass towers |
| ধানমন্ডি | Dhanmondi — mid-rise, lakes |
| মতিঝিল | Motijheel — CBD, banks |
| পুরান ঢাকা | Old Dhaka — alley grid, river front |
| আজিমপুর | Azimpur — quiet streets |
| মোহাম্মদপুর | Mohammadpur — Mirpur Road corridor |
| বনানী | Banani — Gulshan satellite |

**Landmarks** (hand-built from primitives)

- Lalbagh Fort — four walls, octagonal bastions, Pari Bibi tomb, minarets
- Ahsan Manzil — pink palace with dome
- Sadarghat Launch Terminal — five-arch shed, river piers
- National Parliament — Louis Kahn cruciform with circle/triangle façade texture
- Baitul Mukarram — white cube mosque
- Shapla Chattar — eight-petal water lily monument
- Jamuna Future Park — mall with glass entrance (heist target for Mission 5)
- Hazrat Shahjalal Airport — runway, terminal, control tower

---

## Gameplay Systems

### Vehicles
Eleven driveable types: CNG auto-rickshaw, cycle rickshaw, bus, motorbike, Prado SUV, pickup truck, army truck, police car, speedboat, launch ferry, and a crossing river ferry. All have throttle/brake/steer physics, body lean, wheel rotation, and suspension bob. Traffic AI follows road polyline routes and brakes to avoid obstacles.

### NPCs
~100 pedestrians spread across districts, weighted by area type (vendors in Old Dhaka, gang members in Mirpur). They idle, walk, flee from the player, and react with Bengali exclamations when bumped.

### Combat
- **Fists** — 2.8-unit melee range
- **Pistol** — 60-unit range, line-of-sight check, muzzle flash light, shell casing particles
- Pickups (health packs, armor, ammo) spawn on kills and in the world

### Wanted System (5 stars ☸)
| Stars | Response |
|---|---|
| ★ | Foot police |
| ★★ | Patrol cars |
| ★★★ | Police + shooting |
| ★★★★ | RAB Prados, moto squads |
| ★★★★★ | Helicopter (searchlight + door gunner), army roadblocks |

Heat decays when you stay out of cop sight for ~22 seconds.

### Missions
Five scripted missions with on-screen beacons, objective ribbons, and cutscenes:

1. **সদরঘাটে আগমন — Sadarghat Landing** — steal a CNG and meet a contact at Lalbagh Fort
2. **রিকশা ট্র্যাকিং — Rickshaw Tail** — follow a target for 120 s without being spotted
3. **গুলশান ডিপ্লোম্যাট — Gulshan Diplomat** — steal a black Prado and deliver it to the chop shop
4. **নদীর পথ — River Run** — speedboat escape down the Buriganga through river police
5. **জামুনা হাইস্ট — Jamuna Heist** — recruit crew, fight guards, grab five loot crates, escape at 4★ in four minutes

### Audio (Web Audio API — no samples)
All sound is synthesised at runtime:
- City ambience — layered sawtooth rumble with LFO
- Engine — oscillator pitch-mapped to vehicle speed
- Azan — melodic oscillator with vibrato, fires at five prayer times per in-game day
- Three generative radio stations: Bengali folk (pentatonic), hiphop (kick + bass), lo-fi (chord progression)
- Two-tone police siren, monsoon rain (filtered noise), explosion, horn, gunshot, punch

### Environment
- **Day/night cycle** — 24-minute loop; sky colour, fog density, star field, window textures, and vehicle headlights all change at dusk/dawn
- **Weather** — state machine: Clear → Haze → Rain → Monsoon; flood plane rises during monsoon; rain particle system; smog drift
- **Pooled lighting** — 8 streetlamp PointLights and 6 neon PointLights repositioned to the nearest fixtures each frame (budget-friendly)

---

## Architecture

```
src/
├── main.jsx              # React root (no StrictMode — prevents double WebGL context)
├── styles.css
├── state/
│   ├── store.js          # useSyncExternalStore pub/sub — bridges game loop → React HUD
│   └── uiRefs.js         # Imperative DOM refs (canvas, overlays) written by the game
├── ui/
│   ├── App.jsx
│   ├── HUD.jsx           # Minimap, health/armor bars, wanted stars, mission ribbon
│   ├── LoadingScreen.jsx
│   ├── PauseMenu.jsx     # Volume, quality (low/med/high), save, restart
│   ├── MapOverlay.jsx
│   └── TouchControls.jsx
└── game/
    ├── Game.js           # DhakaGame class — boot, tick loop, input, camera, save/load
    ├── constants.js      # Districts, roads, roundabouts, vehicle specs, mission text
    ├── utils.js          # rand, lerp, smoothTo, dist, segPointDist, formatTaka
    ├── textures.js       # Canvas-generated: building façades, road markings, signs
    ├── colliders.js      # Spatial hash (cell=50) AABB colliders + resolveCircle
    ├── world.js          # Ground, water (ripple shader), roads, instanced buildings
    ├── landmarks.js      # All hand-built landmarks from Three.js primitives
    ├── props.js          # Trees, streetlamps, stalls, signs, billboards, boats
    ├── characters.js     # Player rig, NPC spawn/update/animate
    ├── vehicles.js       # All vehicle builders, traffic AI, enter/exit, explode
    ├── combat.js         # Attack, tracers, pickups, hit detection
    ├── police.js         # Wanted quota spawning, cop AI, helicopter, roadblocks
    ├── missions.js       # MissionManager + 5 mission definitions
    ├── environment.js    # Day/night, weather, light pool update
    ├── audio.js          # AudioEngine singleton — all synthesis
    └── fx.js             # Particle system (instanced Points, MAX=1500)
```

**React ↔ Three.js bridge** — the game loop writes into a mutable `state` object and DOM refs; React re-renders only via `useSyncExternalStore` subscriptions, keeping HUD updates off the hot path.

**Performance** — InstancedMesh per district for ~900 buildings; spatial hash collider lookup; frustum+distance culling every 0.4 s (vehicles > 340 units, NPCs > 260 units); pooled real lights; canvas-generated textures (no external assets).

---

## Build

```bash
npm run build   # outputs to dist/  (~745 kB JS, ~210 kB gzip)
npm run preview # serve the production build locally
```

No external assets are required. The entire game — textures, audio, geometry — is generated at runtime in JavaScript.

---

## Stack

| | |
|---|---|
| **Renderer** | Three.js r160 — WebGL2, PCFSoftShadowMap, ACESFilmicToneMapping |
| **UI** | React 18 — `useSyncExternalStore`, no Redux |
| **Build** | Vite 5, `@vitejs/plugin-react` |
| **Audio** | Web Audio API — fully procedural, no samples |
| **Persistence** | `localStorage` — autosave every 30 s |
| **Mobile** | Touch joystick + button overlay |
