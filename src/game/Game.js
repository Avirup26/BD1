// Composition root: scene/renderer/camera, the main loop, input, HUD bridge,
// minimap/full-map rendering, save system, death/busted flow.
import * as THREE from 'three';
import { store } from '../state/store.js';
import { uiRefs } from '../state/uiRefs.js';
import { DISTRICTS, FALLBACK_DISTRICT, ROADS, ROUNDABOUTS, POIS, SAVE_KEY, TIME_SCALE } from './constants.js';
import { rand, clamp, dist2, smoothAngle, smoothTo, formatClock, formatTaka } from './utils.js';
import { resetColliders, buildColliderHash, resolveCircle, colliders, nearColliders } from './colliders.js';
import { buildGround, buildWater, buildRoads, buildBuildings, districtAt } from './world.js';
import { buildLandmarks } from './landmarks.js';
import { buildTreesAndLamps, buildStalls, buildSignsAndBillboards, buildEmbassyRow, buildTeaStalls, buildBoats } from './props.js';
import { createPlayer, spawnNPCs, updateNPCs, animateHumanoid, bumpNPC } from './characters.js';
import { spawnTraffic, updateVehicles, nearestVehicle, enterVehicle, exitVehicle, explodeVehicle } from './vehicles.js';
import { initCombat, attack, updateCombat } from './combat.js';
import { updatePolice, setWanted, addHeat as policeAddHeat } from './police.js';
import { MissionManager } from './missions.js';
import { createEnvironment, updateDayNight, updateWeather, updateLightPools } from './environment.js';
import { AudioEngine } from './audio.js';
import { FX } from './fx.js';

let _game = null;
export const getGame = () => _game;

export function createGame(container) {
  if (_game) return _game;
  _game = new DhakaGame(container);
  window.__game = _game; // debugging hook
  _game.boot();
  return _game;
}

const PIERS = [70, 100, 130]; // pier center x positions at Sadarghat

function defaultState() {
  return {
    money: 500, health: 100, armor: 0,
    wanted: 0, heatTimer: 0, bustedT: 0,
    time: 8 * 60, weather: 'clear', flood: 0,
    district: '', weapon: 'fists', ammo: 0,
    missionsCompleted: [],
    started: false, busy: false, dead: false
  };
}

export class DhakaGame {
  constructor(container) {
    this.container = container;
    this.store = store;
    this.state = defaultState();
    this.vehicles = [];
    this.npcs = [];
    this.cops = [];
    this.roadblocks = [];
    this.heli = null;
    this.world = {};
    this.keys = new Set();
    this.touch = { x: 0, y: 0, run: false, attackHold: false };
    this.input = { fwd: false, back: false, left: false, right: false, run: false, brake: false };
    this.camYaw = Math.PI;
    this.camMode = 'follow';
    this.elapsed = 0;
    this.shake = 0;
    this.flashT = 0;
    this.quality = 'high';
    this.timeScale = TIME_SCALE;
    this.radioIdx = -1;
    this.suppressHeat = false;
    this.freshStart = false;
    this.copProximity = 0;
    this.deathT = 0;
    this.autosaveT = 30;
    this.hudT = 0;
    this.districtT = 0;
    this.cullT = 0;
    this.bigmapT = 0;
    this.bumps = [];
    this.swimWarned = false;
  }

  // ============================================================ boot
  async boot() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      store.set({ webglError: 'WebGL is not available in this browser. ঢাকা সিটি আন্ডারওয়ার্ল্ড needs WebGL — try Chrome or Firefox with hardware acceleration enabled.' });
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;
    this.container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0045);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2600);
    this.camera.position.set(100, 10, 540);
    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      r.setSize(window.innerWidth, window.innerHeight);
    });

    store.set({ phase: 'loading', hasSave: !!localStorage.getItem(SAVE_KEY) });

    const steps = [
      ['বাংলা ফন্ট লোড হচ্ছে... loading fonts', async () => {
        try {
          await Promise.race([
            Promise.all([
              document.fonts.load('700 28px "Noto Sans Bengali"', 'ঢাকা'),
              document.fonts.load('600 16px Rajdhani', 'DHAKA')
            ]),
            new Promise((res) => setTimeout(res, 3000))
          ]);
        } catch { /* offline fonts fallback is fine */ }
      }],
      ['বুড়িগঙ্গা নদী আঁকা হচ্ছে... pouring the Buriganga', () => {
        resetColliders();
        buildGround(this.scene);
        buildWater(this.scene, this.world);
      }],
      ['রাস্তা বানানো হচ্ছে... laying the road network', () => buildRoads(this.scene, this.world)],
      ['ভবন উঠছে... raising 900 buildings', () => buildBuildings(this.scene, this.world)],
      ['ল্যান্ডমার্ক বসানো হচ্ছে... placing landmarks', () => buildLandmarks(this.scene)],
      ['দোকানপাট সাজানো হচ্ছে... hanging shop signs', () => {
        buildTreesAndLamps(this.scene, this.world);
        buildStalls(this.scene);
        buildSignsAndBillboards(this.scene, this.world);
        buildEmbassyRow(this.scene);
        buildTeaStalls(this.scene, this.world);
        buildBoats(this.scene, this.world);
      }],
      ['কলাইডার গণনা হচ্ছে... hashing collisions', () => buildColliderHash()],
      ['মানুষজন নামছে... waking up the city', () => {
        this.env = createEnvironment(this);
        this.fx = new FX(this.scene);
        this.audio = AudioEngine;
        this.player = createPlayer(this.scene);
        this.npcs = spawnNPCs(this.scene);
        spawnTraffic(this);
        initCombat(this);
        this.missions = new MissionManager(this);
        this.buildMapBase();
      }]
    ];
    for (let i = 0; i < steps.length; i++) {
      store.set({ loadLabel: steps[i][0], loadPct: Math.round((i / steps.length) * 100) });
      await new Promise((res) => setTimeout(res, 30));
      await steps[i][1]();
    }
    store.set({ loadPct: 100, loadLabel: 'প্রস্তুত! ready', phase: 'ready', touch: 'ontouchstart' in window });
    this.initInput();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  start(isNew) {
    this.audio.init();
    this.audio.setVolume(store.get().volume);
    if (!isNew && this.load()) {
      this.toast('সেভ লোড হয়েছে। Welcome back to Dhaka.');
    } else {
      this.state = { ...defaultState(), started: true };
      this.player.group.position.set(100, 0.7, 508); // on the Sadarghat pier
      this.player.heading = Math.PI;
      this.camYaw = Math.PI;
      this.freshStart = true;
      this.toast('🛳️ সদরঘাট, ঢাকা — লঞ্চ থেকে নামলেন। Fresh off the launch from Barishal.');
    }
    this.state.started = true;
    store.set({
      phase: 'playing',
      money: this.state.money,
      health: this.state.health,
      armor: this.state.armor,
      wanted: this.state.wanted,
      weapon: this.state.weapon,
      ammo: this.state.weapon === 'pistol' ? String(this.state.ammo) : '∞'
    });
  }

  // ============================================================ input
  initInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const s = store.get();
      if (e.code === 'Escape') {
        if (s.mapOpen) { store.set({ mapOpen: false }); return; }
        if (s.phase === 'playing') store.set({ paused: !s.paused });
        return;
      }
      if (s.phase !== 'playing' || s.paused) return;
      this.keys.add(e.code);
      switch (e.code) {
        case 'KeyE': this.interact(); break;
        case 'KeyF': attack(this); break;
        case 'Digit1':
          this.state.weapon = 'fists';
          store.set({ weapon: 'fists', ammo: '∞' });
          break;
        case 'Digit2':
          if (this.state.ammo > 0) {
            this.state.weapon = 'pistol';
            store.set({ weapon: 'pistol', ammo: String(this.state.ammo) });
          } else this.toast('পিস্তলের গুলি নেই! No pistol ammo.');
          break;
        case 'KeyC': this.camMode = this.camMode === 'follow' ? 'top' : 'follow'; break;
        case 'KeyM': store.set({ mapOpen: !s.mapOpen }); break;
        case 'KeyR': this.cycleRadio(); break;
        case 'KeyH':
          if (this.player.inVehicle) {
            if (this.player.inVehicle.type === 'rickshaw') this.audio.playBell();
            else this.audio.playHorn();
          }
          break;
        default: break;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.renderer.domElement.addEventListener('pointerdown', () => {
      const s = store.get();
      if (s.phase === 'playing' && !s.paused && !s.mapOpen) attack(this);
    });
  }

  computeInput() {
    const k = this.keys, t = this.touch;
    this.input.fwd = k.has('KeyW') || k.has('ArrowUp') || t.y < -0.3;
    this.input.back = k.has('KeyS') || k.has('ArrowDown') || t.y > 0.3;
    this.input.left = k.has('KeyA') || k.has('ArrowLeft') || t.x < -0.3;
    this.input.right = k.has('KeyD') || k.has('ArrowRight') || t.x > 0.3;
    this.input.run = k.has('ShiftLeft') || k.has('ShiftRight') || t.run;
    this.input.brake = k.has('Space');
    if (t.attackHold && this.player.attackCd <= 0) attack(this);
  }

  setTouchVector(x, y) { this.touch.x = x; this.touch.y = y; }
  touchButton(name, down) {
    if (name === 'E' && down) this.interact();
    else if (name === 'ATK') this.touch.attackHold = down;
    else if (name === 'RUN') this.touch.run = down;
  }

  interact() {
    if (this.state.busy || this.state.dead) return;
    if (this.missions.tryInteract()) return;
    const p = this.player;
    if (p.inVehicle) { exitVehicle(this); return; }
    // tea stall heal
    for (const ts of this.world.teaStalls) {
      if (dist2(ts.x, ts.z, p.group.position.x, p.group.position.z) < 9) {
        if (this.state.money >= 20) {
          this.addMoney(-20);
          this.state.health = clamp(this.state.health + 25, 0, 100);
          store.set({ health: this.state.health });
          this.audio.playPickup();
          this.toast('☕ গরম চা! +25 HP (-৳20)');
        } else this.toast('টাকা নেই! Tea costs ৳20.');
        return;
      }
    }
    const v = nearestVehicle(this);
    if (v) enterVehicle(this, v);
  }

  cycleRadio() {
    if (!this.player.inVehicle) { this.toast('📻 রেডিও শুনতে গাড়িতে উঠুন। Radio works in vehicles.'); return; }
    this.radioIdx = this.radioIdx >= 2 ? -1 : this.radioIdx + 1;
    if (this.radioIdx === -1) {
      this.audio.radioToggle(false);
      store.set({ radio: null });
    } else {
      this.audio.stationIdx = this.radioIdx;
      this.audio.step = 0;
      this.audio.radioToggle(true);
      store.set({ radio: this.audio.stations[this.radioIdx].name });
    }
  }

  // ============================================================ economy / damage
  toast(msg) { store.set({ toast: msg, toastTick: store.get().toastTick + 1 }); }
  addMoney(n) {
    this.state.money = Math.max(0, this.state.money + n);
    store.set({ money: this.state.money });
  }
  addHeat(n) {
    if (this.suppressHeat || n <= 0) return;
    policeAddHeat(this, n);
  }

  damagePlayer(d, src) {
    if (this.state.dead) return;
    if (this.state.armor > 0) {
      const absorbed = Math.min(this.state.armor, d * 0.6);
      this.state.armor -= absorbed;
      d -= absorbed;
      store.set({ armor: Math.round(this.state.armor) });
    }
    this.state.health -= d;
    this.flashT = 0.6;
    store.set({ health: Math.max(0, Math.round(this.state.health)) });
    if (this.state.health <= 0) this.playerDie(src);
  }

  playerDie() {
    this.state.dead = true;
    this.deathT = 3.8;
    store.set({ deathMsg: { bn: 'নিহত!', en: 'WASTED' } });
    if (this.player.inVehicle) exitVehicle(this);
    this.audio.engineStop();
    this.missions.onPlayerDown();
  }

  playerBusted() {
    if (this.state.dead) return;
    this.state.dead = true;
    this.deathT = 3.8;
    this.respawnAt = 'police';
    store.set({ deathMsg: { bn: 'গ্রেফতার!', en: 'BUSTED' } });
    if (this.player.inVehicle) exitVehicle(this);
    this.audio.engineStop();
    this.missions.onPlayerDown();
  }

  respawn() {
    const busted = this.respawnAt === 'police';
    this.respawnAt = null;
    this.state.dead = false;
    this.state.health = 100;
    this.state.bustedT = 0;
    setWanted(this, 0);
    if (busted) this.addMoney(-Math.min(500, this.state.money));
    else this.state.money = Math.round(this.state.money * 0.92);
    store.set({ deathMsg: null, health: 100, money: this.state.money });
    const [rx, rz] = busted ? [160, 76] : [60, 238];
    const r = resolveCircle(rx, rz, 0.6);
    this.player.group.position.set(r.x, 0, r.z);
    this.player.heading = 0;
    this.toast(busted ? 'থানা থেকে ছাড়া পেলেন — ৳500 জরিমানা। Released with a fine.' : 'হাসপাতাল থেকে ছাড়া পেলেন। Patched up at Dhaka Medical.');
    this.save();
  }

  // ============================================================ save system
  save() {
    if (!this.state.started) return;
    const p = this.player.inVehicle ? this.player.inVehicle.group.position : this.player.group.position;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      pos: { x: p.x, z: p.z },
      heading: this.player.heading,
      money: this.state.money,
      health: this.state.health,
      armor: this.state.armor,
      weapon: this.state.weapon,
      ammo: this.state.ammo,
      missionsCompleted: this.state.missionsCompleted,
      time: this.state.time,
      weather: this.state.weather
    }));
    store.set({ hasSave: true });
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      this.state = { ...defaultState(), ...{
        money: s.money ?? 500, health: s.health ?? 100, armor: s.armor ?? 0,
        weapon: s.weapon ?? 'fists', ammo: s.ammo ?? 0,
        missionsCompleted: s.missionsCompleted ?? [],
        time: s.time ?? 480, weather: s.weather ?? 'clear'
      }, started: true };
      // if the save was made in the river or on the piers, come ashore
      const sz = (s.pos?.z ?? 460) > 470 ? 460 : (s.pos?.z ?? 460);
      const r = resolveCircle(s.pos?.x ?? 100, sz, 0.6);
      this.player.group.position.set(r.x, 0, clamp(r.z, -980, 470));
      this.player.heading = s.heading ?? 0;
      this.camYaw = this.player.heading;
      store.set({ weather: this.state.weather });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================ player update
  pierY(x, z) {
    if (z > 491 && z < 529) {
      for (const px of PIERS) if (Math.abs(x - px) < 4.2) return 0.7;
    }
    return 0;
  }

  updatePlayer(dt) {
    const p = this.player;
    if (p.dead || this.state.dead) return;

    if (p.inVehicle) {
      const v = p.inVehicle;
      if (v.hp <= 0 && !v.exploded) explodeVehicle(this, v);
      // drowning a land vehicle dumps you in the river
      if (!v.isBoat && v.group.position.z > 478) {
        this.audio.playSplash();
        v.hp = 1;
        v.speed = 0;
        exitVehicle(this);
        this.toast('গাড়ি বুড়িগঙ্গায়! Your ride sank into the Buriganga!');
      }
      return;
    }

    const pos = p.group.position;
    const mf = (this.input.fwd ? 1 : 0) - (this.input.back ? 1 : 0);
    const ms = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const mx = fx * mf + -fz * ms;
    const mz = fz * mf + fx * ms;
    const len = Math.hypot(mx, mz);

    const pierY = this.pierY(pos.x, pos.z);
    const swimming = pos.z > 474 && pierY === 0;
    p.swimming = swimming;

    if (len > 0.01 && !this.state.busy) {
      const target = Math.atan2(mx / len, mz / len);
      p.heading = smoothAngle(p.heading, target, 10, dt);
      const speed = swimming ? 2.4 : this.input.run ? 11 : 6;
      const nx = pos.x + Math.sin(p.heading) * speed * dt;
      const nz = pos.z + Math.cos(p.heading) * speed * dt;
      const r = resolveCircle(clamp(nx, -985, 985), clamp(nz, -985, 612), 0.55);
      pos.x = r.x; pos.z = r.z;
      animateHumanoid(p.parts, this.elapsed, swimming ? 0.5 : 1, this.input.run, dt);
      // shoulder-checking pedestrians
      for (const npc of this.npcs) {
        if (npc.state === 'dead') continue;
        if (dist2(npc.group.position.x, npc.group.position.z, pos.x, pos.z) < 1.1) bumpNPC(this, npc, false);
      }
    } else {
      animateHumanoid(p.parts, this.elapsed, 0, false, dt);
    }

    if (swimming) {
      pos.y = -0.75 + Math.sin(this.elapsed * 2) * 0.1;
      this.state.health -= dt * 1.3; // the Buriganga is NOT for swimming
      if (!this.swimWarned) {
        this.swimWarned = true;
        this.toast('🤢 বুড়িগঙ্গার পানি বিষাক্ত! This water is toxic — get out!');
      }
      if (this.state.health <= 0) this.playerDie('polluted river');
      store.set({ health: Math.max(0, Math.round(this.state.health)) });
    } else {
      pos.y = pierY + (len > 0.01 ? Math.abs(Math.sin(this.elapsed * (this.input.run ? 10 : 6))) * 0.05 : Math.sin(this.elapsed * 2) * 0.02);
      this.swimWarned = false;
    }
    p.group.rotation.y = p.heading;
  }

  // ============================================================ camera
  camBlocked(x, y, z) {
    for (const list of nearColliders(x, z)) {
      for (const idx of list) {
        const c = colliders[idx];
        if (x >= c.x1 && x <= c.x2 && z >= c.z1 && z <= c.z2 && y < c.h) return true;
      }
    }
    return false;
  }

  updateCamera(dt) {
    const p = this.player;
    const inV = p.inVehicle;
    const anchor = inV ? inV.group.position : p.group.position;
    const heading = inV ? inV.heading : p.heading;
    this.camYaw = smoothAngle(this.camYaw, heading, inV ? 2.2 : 2.8, dt);

    if (this.camMode === 'top') {
      this.camera.position.set(
        smoothTo(this.camera.position.x, anchor.x, 4, dt),
        smoothTo(this.camera.position.y, 175, 4, dt),
        smoothTo(this.camera.position.z, anchor.z + 0.1, 4, dt)
      );
      this.camera.lookAt(anchor.x, 0, anchor.z);
      return;
    }

    const dist = inV ? 25 : 15;
    const height = inV ? 12 : 8;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    let dx = anchor.x - fx * dist;
    let dy = anchor.y + height;
    let dz = anchor.z - fz * dist;

    // pull the camera in if a building blocks the line of sight
    let cut = 1;
    for (let t = 0.3; t <= 1; t += 0.14) {
      const sx = anchor.x + (dx - anchor.x) * t;
      const sy = anchor.y + 2 + (dy - anchor.y - 2) * t;
      const sz = anchor.z + (dz - anchor.z) * t;
      if (this.camBlocked(sx, sy, sz)) { cut = Math.max(0.25, t - 0.14); break; }
    }
    dx = anchor.x + (dx - anchor.x) * cut;
    dy = anchor.y + 2 + (dy - anchor.y - 2) * cut;
    dz = anchor.z + (dz - anchor.z) * cut;

    const k = 1 - Math.exp(-5 * dt); // ~0.08 lerp at 60fps
    this.camera.position.x += (dx - this.camera.position.x) * k;
    this.camera.position.y += (dy - this.camera.position.y) * k;
    this.camera.position.z += (dz - this.camera.position.z) * k;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.camera.position.x += rand(-1, 1) * this.shake * 0.5;
      this.camera.position.y += rand(-1, 1) * this.shake * 0.4;
    }
    this.camera.lookAt(anchor.x, anchor.y + 2.6, anchor.z);
  }

  // ============================================================ maps
  buildMapBase() {
    const px = 1000;
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    const g = cv.getContext('2d');
    const S = px / 2000;
    const X = (x) => (x + 1000) * S;
    const Z = (z) => (z + 1000) * S;
    g.fillStyle = '#191d26';
    g.fillRect(0, 0, px, px);
    for (const d of DISTRICTS) {
      g.fillStyle = d.map + '55';
      g.fillRect(X(d.x1), Z(d.z1), (d.x2 - d.x1) * S, (d.z2 - d.z1) * S);
    }
    // river + lakes
    g.fillStyle = '#4d3f2a';
    g.fillRect(0, Z(478), px, (618 - 478) * S);
    g.fillStyle = '#3e5a52';
    g.beginPath(); g.ellipse(X(350), Z(-262), 65 * S, 47 * S, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(X(280), Z(-80), 120 * S, 45 * S, -0.35, 0, 7); g.fill();
    g.beginPath(); g.ellipse(X(-450), Z(28), 75 * S, 15 * S, 0, 0, 7); g.fill();
    // airport runway
    g.fillStyle = '#2e2e30';
    g.fillRect(X(-335), Z(-744), 360 * S, 28 * S);
    // roads
    g.strokeStyle = '#454b57';
    g.lineCap = 'round';
    for (const rd of ROADS) {
      g.lineWidth = Math.max(2, rd.w * S * 1.1);
      g.beginPath();
      g.moveTo(X(rd.pts[0][0]), Z(rd.pts[0][1]));
      for (let i = 1; i < rd.pts.length; i++) g.lineTo(X(rd.pts[i][0]), Z(rd.pts[i][1]));
      g.stroke();
    }
    g.fillStyle = '#454b57';
    for (const rb of ROUNDABOUTS) {
      g.beginPath(); g.arc(X(rb.x), Z(rb.z), rb.r * S * 1.4, 0, 7); g.fill();
    }
    this.mapBase = cv;
  }

  drawMinimap() {
    const cv = uiRefs.minimap;
    if (!cv || !this.mapBase) return;
    const g = cv.getContext('2d');
    const size = cv.width;
    const pp = this.player.inVehicle ? this.player.inVehicle.group.position : this.player.group.position;
    const S = 1000 / 2000;
    const win = 320; // world units shown across the minimap
    const sx = (pp.x + 1000) * S - (win * S) / 2;
    const sy = (pp.z + 1000) * S - (win * S) / 2;
    g.clearRect(0, 0, size, size);
    g.drawImage(this.mapBase, sx, sy, win * S, win * S, 0, 0, size, size);

    const toMap = (wx, wz) => [
      ((wx - (pp.x - win / 2)) / win) * size,
      ((wz - (pp.z - win / 2)) / win) * size
    ];
    // mission marker (clamped to edge)
    const mk = this.missions ? this.missions.markerInfo() : null;
    if (mk) {
      let [mx, my] = toMap(mk.x, mk.z);
      mx = clamp(mx, 8, size - 8); my = clamp(my, 8, size - 8);
      g.fillStyle = '#ffd25e';
      g.beginPath(); g.arc(mx, my, 5, 0, 7); g.fill();
      g.fillStyle = '#1a1408';
      g.font = 'bold 8px Rajdhani';
      g.textAlign = 'center';
      g.fillText('★', mx, my + 3);
    }
    // cops
    g.fillStyle = '#ff5252';
    for (const c of this.cops) {
      if (c.state === 'dead') continue;
      const [mx, my] = toMap(c.group.position.x, c.group.position.z);
      if (mx > 0 && mx < size && my > 0 && my < size) { g.beginPath(); g.arc(mx, my, 2.5, 0, 7); g.fill(); }
    }
    for (const v of this.vehicles) {
      if (v.exploded) continue;
      const [mx, my] = toMap(v.group.position.x, v.group.position.z);
      if (mx < 0 || mx > size || my < 0 || my > size) continue;
      g.fillStyle = v.police ? '#ff5252' : 'rgba(255,255,255,0.55)';
      g.beginPath(); g.arc(mx, my, v.police ? 2.5 : 1.6, 0, 7); g.fill();
    }
    // player arrow
    g.save();
    g.translate(size / 2, size / 2);
    const heading = this.player.inVehicle ? this.player.inVehicle.heading : this.player.heading;
    g.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)));
    g.fillStyle = '#ffd25e';
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6);
    g.closePath(); g.fill();
    g.restore();
    // north tick
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = 'bold 11px Rajdhani';
    g.textAlign = 'center';
    g.fillText('N', size / 2, 13);
  }

  drawBigMap() {
    const cv = uiRefs.bigmap;
    if (!cv || !this.mapBase) return;
    const g = cv.getContext('2d');
    const size = cv.width;
    g.clearRect(0, 0, size, size);
    g.drawImage(this.mapBase, 0, 0, size, size);
    const M = (w) => ((w + 1000) / 2000) * size;
    g.font = `${Math.round(size * 0.022)}px "Noto Sans Bengali"`;
    g.textAlign = 'center';
    for (const poi of POIS) {
      g.fillText(poi.icon, M(poi.x), M(poi.z));
      g.fillStyle = 'rgba(240,242,248,0.85)';
      g.font = `${Math.round(size * 0.016)}px "Noto Sans Bengali"`;
      g.fillText(poi.label, M(poi.x), M(poi.z) + size * 0.022);
      g.font = `${Math.round(size * 0.022)}px "Noto Sans Bengali"`;
    }
    for (const d of DISTRICTS) {
      if (d.id === 'sadarghat') continue;
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.font = `bold ${Math.round(size * 0.017)}px "Noto Sans Bengali"`;
      g.fillText(d.bn, M((d.x1 + d.x2) / 2), M((d.z1 + d.z2) / 2));
    }
    const mk = this.missions ? this.missions.markerInfo() : null;
    if (mk) {
      g.fillStyle = '#ffd25e';
      g.beginPath(); g.arc(M(mk.x), M(mk.z), 7, 0, 7); g.fill();
    }
    const pp = this.player.inVehicle ? this.player.inVehicle.group.position : this.player.group.position;
    g.fillStyle = '#6fd86f';
    g.beginPath(); g.arc(M(pp.x), M(pp.z), 6, 0, 7); g.fill();
    g.strokeStyle = '#0d1018'; g.lineWidth = 2; g.stroke();
  }

  // ============================================================ floating UI bits
  showBump(worldPos, text) {
    if (!uiRefs.floatLayer) return;
    let slot = this.bumps.find((b) => b.t <= 0);
    if (!slot) {
      if (this.bumps.length >= 10) return;
      const el = document.createElement('div');
      el.className = 'bump-text';
      uiRefs.floatLayer.appendChild(el);
      slot = { el, t: 0, wp: new THREE.Vector3() };
      this.bumps.push(slot);
    }
    slot.t = 1.3;
    slot.wp.set(worldPos.x, 2.8, worldPos.z);
    slot.el.textContent = text;
  }

  updateBumpsAndLabels(dt) {
    const v = new THREE.Vector3();
    for (const b of this.bumps) {
      if (b.t <= 0) { b.el.style.opacity = '0'; continue; }
      b.t -= dt;
      b.wp.y += dt * 1.2;
      v.copy(b.wp).project(this.camera);
      if (v.z > 1 || v.z < -1) { b.el.style.opacity = '0'; continue; }
      b.el.style.opacity = String(clamp(b.t, 0, 0.9));
      b.el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
      b.el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    }
    // mission beacon label
    const label = uiRefs.beaconLabel;
    if (label) {
      const mk = this.missions ? this.missions.markerInfo() : null;
      if (mk) {
        v.set(mk.x, 17, mk.z).project(this.camera);
        const behind = v.z > 1;
        if (!behind && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05) {
          label.style.display = 'block';
          label.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
          label.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
          label.textContent = `◆ ${mk.label}`;
        } else label.style.display = 'none';
      } else label.style.display = 'none';
    }
    if (uiRefs.damageFlash) {
      this.flashT = Math.max(0, this.flashT - dt);
      uiRefs.damageFlash.style.opacity = String(Math.min(0.9, this.flashT * 1.6));
    }
  }

  // ============================================================ HUD sync
  syncHUD(dt) {
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.25;
      const h = this.state.time / 60;
      store.set({
        health: Math.max(0, Math.round(this.state.health)),
        armor: Math.round(this.state.armor),
        money: this.state.money,
        timeStr: formatClock(this.state.time),
        timeIcon: h >= 5.5 && h < 18.5 ? '☀️' : '🌙',
        speed: this.player.inVehicle ? Math.round(Math.abs(this.player.inVehicle.speed) * 3.6) : 0
      });
    }
    this.districtT -= dt;
    if (this.districtT <= 0) {
      this.districtT = 0.6;
      const pp = this.player.inVehicle ? this.player.inVehicle.group.position : this.player.group.position;
      const d = districtAt(pp.x, pp.z) || FALLBACK_DISTRICT;
      if (d.id !== this.state.district) {
        this.state.district = d.id;
        store.set({ districtBn: d.bn, districtEn: d.en, districtTick: store.get().districtTick + 1 });
      }
    }
  }

  // ============================================================ culling
  updateCulling() {
    const pp = this.camera.position;
    const R2 = 340 * 340;
    for (const v of this.vehicles) {
      if (v === this.player.inVehicle) { v.group.visible = true; continue; }
      v.group.visible = dist2(v.group.position.x, v.group.position.z, pp.x, pp.z) < R2;
    }
    for (const n of this.npcs) {
      if (n.state === 'dead') continue;
      n.group.visible = dist2(n.group.position.x, n.group.position.z, pp.x, pp.z) < 260 * 260;
    }
    for (const b of this.world.boats) {
      b.group.visible = dist2(b.group.position.x, b.group.position.z, pp.x, pp.z) < R2;
    }
  }

  applyQuality(q) {
    this.quality = q;
    const r = this.renderer;
    r.shadowMap.enabled = q !== 'low';
    this.env.sun.castShadow = q !== 'low';
    r.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 2) : q === 'medium' ? 1.25 : 1);
    const sz = q === 'high' ? 2048 : 1024;
    this.env.sun.shadow.mapSize.set(sz, sz);
    if (this.env.sun.shadow.map) {
      this.env.sun.shadow.map.dispose();
      this.env.sun.shadow.map = null;
    }
    this.scene.traverse((o) => {
      if (o.isMesh && o.material) o.material.needsUpdate = true;
    });
    store.set({ quality: q });
  }

  // ============================================================ main loop
  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const s = store.get();

    if (!this.state.started || s.phase !== 'playing') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (s.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (s.mapOpen) {
      this.bigmapT -= dt;
      if (this.bigmapT <= 0) { this.bigmapT = 0.5; this.drawBigMap(); }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.elapsed += dt;

    // death / respawn timer
    if (this.state.dead) {
      this.deathT -= dt;
      if (this.deathT <= 0) this.respawn();
      this.fx.update(dt);
      updateDayNight(this, dt);
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.computeInput();
    this.missions.update(dt);

    if (!this.state.busy) {
      this.updatePlayer(dt);
      updateVehicles(this, dt);
      updateNPCs(this, dt);
      updatePolice(this, dt);
      updateCombat(this, dt);
    }

    this.fx.update(dt);
    updateDayNight(this, dt);
    updateWeather(this, dt);
    updateLightPools(this);

    // water + boats idle animation
    this.world.waterTime.value = this.elapsed;
    for (const b of this.world.boats) {
      b.group.position.y = Math.sin(this.elapsed * 1.6 + b.phase) * b.amp - 0.05;
      if (b.drift) b.group.rotation.y += Math.sin(this.elapsed * 0.4 + b.phase) * dt * 0.04;
    }
    const ferry = this.world.ferry;
    ferry.group.position.x += ferry.dir * 4.2 * dt;
    ferry.group.position.y = Math.sin(this.elapsed * 1.4) * 0.12 - 0.05;
    if (Math.abs(ferry.group.position.x) > 820) {
      ferry.dir *= -1;
      ferry.group.rotation.y = ferry.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    const districtBusy = this.state.district === 'oldDhaka' || this.state.district === 'motijheel' || this.state.district === 'sadarghat';
    this.audio.tick(dt, {
      trafficDensity: districtBusy ? 1.5 : 0.8,
      crowdDensity: districtBusy ? 1 : 0.4,
      sirenActive: this.state.wanted > 0,
      sirenProximity: this.copProximity,
      gameMin: this.state.time,
      toast: (m) => this.toast(m)
    });

    this.updateCamera(dt);
    this.syncHUD(dt);
    this.drawMinimap();
    this.updateBumpsAndLabels(dt);

    this.cullT -= dt;
    if (this.cullT <= 0) { this.cullT = 0.4; this.updateCulling(); }

    this.autosaveT -= dt;
    if (this.autosaveT <= 0) {
      this.autosaveT = 30;
      if (this.state.wanted === 0 && !this.state.dead) this.save();
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer?.setAnimationLoop(null);
    this.renderer?.dispose();
  }
}
