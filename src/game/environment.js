// Sky, sun/moon arc, stars, fog, weather state machine, rain/flood/smog,
// streetlight + neon pooling.
import * as THREE from 'three';
import { rand, pick, clamp, lerp, smoothTo, dist2 } from './utils.js';

const SKY_KEYS = [
  [0, '#070b16'], [4.5, '#0b1226'], [6, '#c98a6a'], [8, '#9cc8e8'],
  [12, '#87CEEB'], [15.5, '#9cc4e0'], [17.5, '#e8956a'], [19, '#46406b'],
  [20.5, '#0c1224'], [24, '#070b16']
];
// [hour, x, y, z, color, intensity] — offsets relative to the player
const SUN_KEYS = [
  [5, -50, 6, 50, '#FF9A3C', 0.0],
  [6.5, -50, 20, 50, '#FF9A3C', 0.4],
  [12, 0, 100, 10, '#FFF5E0', 1.2],
  [17.5, 50, 18, -50, '#FF6B35', 0.8],
  [19, 50, 6, -50, '#FF6B35', 0.05]
];
const FOG_BASE = { clear: 0.0045, haze: 0.007, rain: 0.009, monsoon: 0.013 };

export function createEnvironment(game) {
  const scene = game.scene;
  const env = {};

  env.hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.6);
  scene.add(env.hemi);

  env.sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
  env.sun.castShadow = true;
  env.sun.shadow.mapSize.set(2048, 2048);
  env.sun.shadow.camera.left = -160;
  env.sun.shadow.camera.right = 160;
  env.sun.shadow.camera.top = 160;
  env.sun.shadow.camera.bottom = -160;
  env.sun.shadow.camera.near = 10;
  env.sun.shadow.camera.far = 420;
  env.sun.shadow.bias = -0.0008;
  scene.add(env.sun, env.sun.target);

  env.moon = new THREE.PointLight(0xc8d8e8, 0, 600, 0.6);
  scene.add(env.moon);

  env.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(20, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffe8b0, fog: false }));
  env.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd8e2ee, fog: false }));
  scene.add(env.sunMesh, env.moonMesh);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(1400 * 3);
  for (let i = 0; i < 1400; i++) {
    const a = rand(0, Math.PI * 2), e = rand(0.08, Math.PI / 2);
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * 880;
    starPos[i * 3 + 1] = Math.sin(e) * 880;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 880;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  env.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xeef2ff, size: 1.7, transparent: true, opacity: 0, fog: false, sizeAttenuation: false }));
  env.stars.frustumCulled = false;
  scene.add(env.stars);

  // rain
  const RAIN_N = 3500;
  env.rainPos = new Float32Array(RAIN_N * 3);
  env.rainVel = new Float32Array(RAIN_N);
  for (let i = 0; i < RAIN_N; i++) {
    env.rainPos[i * 3] = rand(-120, 120);
    env.rainPos[i * 3 + 1] = rand(0, 90);
    env.rainPos[i * 3 + 2] = rand(-120, 120);
    env.rainVel[i] = rand(45, 80);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(env.rainPos, 3));
  env.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9ab0c8, size: 0.32, transparent: true, opacity: 0 }));
  env.rain.frustumCulled = false;
  scene.add(env.rain);

  // monsoon flood sheet
  env.flood = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshPhongMaterial({ color: 0x3a4438, transparent: true, opacity: 0.55, shininess: 70 })
  );
  env.flood.rotation.x = -Math.PI / 2;
  env.flood.position.y = -0.4;
  env.flood.visible = false;
  scene.add(env.flood);

  // Motijheel/Tejgaon smog drift
  const SMOG_N = 220;
  env.smogPos = new Float32Array(SMOG_N * 3);
  for (let i = 0; i < SMOG_N; i++) {
    env.smogPos[i * 3] = rand(-250, 350);
    env.smogPos[i * 3 + 1] = rand(2, 40);
    env.smogPos[i * 3 + 2] = rand(-350, 250);
  }
  const smogGeo = new THREE.BufferGeometry();
  smogGeo.setAttribute('position', new THREE.BufferAttribute(env.smogPos, 3));
  env.smog = new THREE.Points(smogGeo, new THREE.PointsMaterial({ color: 0xb09a72, size: 5, transparent: true, opacity: 0.05, depthWrite: false }));
  env.smog.frustumCulled = false;
  scene.add(env.smog);

  env.isNight = false;
  env.weatherT = rand(80, 150);
  env.rainLevel = 0;
  env.colA = new THREE.Color();
  env.colB = new THREE.Color();
  return env;
}

function keyLerp(keys, h, out) {
  // generic keyframe interpolation over [hour, ...values]
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (h >= keys[i][0] && h <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  }
  const t = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
  return { a, b, t: clamp(t, 0, 1) };
}

export function updateDayNight(game, dt) {
  const env = game.env;
  const state = game.state;
  state.time = (state.time + dt * game.timeScale) % 1440;
  const h = state.time / 60;
  const pp = game.player.group.position;

  // sky + fog color
  const sk = keyLerp(SKY_KEYS, h);
  env.colA.set(sk.a[1]);
  env.colB.set(sk.b[1]);
  env.colA.lerp(env.colB, sk.t);
  game.scene.background.copy(env.colA);
  game.scene.fog.color.copy(env.colA).multiplyScalar(0.92);

  // sun
  const su = keyLerp(SUN_KEYS, clamp(h, 5, 19));
  const sx = lerp(su.a[1], su.b[1], su.t), sy = lerp(su.a[2], su.b[2], su.t), sz = lerp(su.a[3], su.b[3], su.t);
  env.colA.set(su.a[4]); env.colB.set(su.b[4]); env.colA.lerp(env.colB, su.t);
  const night = h < 5.3 || h > 19.1;
  const intensity = night ? 0.05 : lerp(su.a[5], su.b[5], su.t);
  env.sun.color.copy(env.colA);
  env.sun.intensity = intensity * (game.state.weather === 'clear' ? 1 : game.state.weather === 'haze' ? 0.8 : 0.45);
  env.sun.position.set(pp.x + sx * 2.4, Math.max(sy * 2.4, 18), pp.z + sz * 2.4);
  env.sun.target.position.set(pp.x, 0, pp.z);
  env.sunMesh.position.set(pp.x + sx * 8, sy * 8, pp.z + sz * 8);
  env.sunMesh.visible = !night && sy > 2;

  // moon mirrors the sun
  env.moonMesh.position.set(pp.x - sx * 8, Math.max(140, sy * -8 + 300), pp.z - sz * 8);
  env.moonMesh.visible = night;
  env.moon.intensity = night ? 0.3 : 0;
  env.moon.position.set(pp.x, 120, pp.z);

  env.hemi.intensity = night ? 0.14 : 0.25 + intensity * 0.32;
  env.stars.material.opacity = smoothTo(env.stars.material.opacity, night ? 0.9 : 0, 1.5, dt);
  env.stars.position.set(pp.x, 0, pp.z);

  // fog density by weather + night
  const target = (FOG_BASE[state.weather] || 0.0045) + (night ? 0.002 : 0);
  game.scene.fog.density = smoothTo(game.scene.fog.density, target, 0.8, dt);

  // night transitions: windows, lamps, headlights, clock icon
  if (night !== env.isNight) {
    env.isNight = night;
    for (const set of game.world.buildingSets) {
      set.mat.map = night ? set.night : set.day;
      set.mat.needsUpdate = true;
    }
    game.world.lampHeadMat.emissive.set(night ? 0xffa050 : 0x000000);
    game.world.lampHeadMat.emissiveIntensity = night ? 1.3 : 0;
    for (const v of game.vehicles) {
      for (const l of v.parts.lights || []) {
        l.material.emissive.set(night ? l.userData.lightColor : 0x000000);
        l.material.emissiveIntensity = night ? 1.2 : 0;
      }
    }
  }
}

export function updateLightPools(game) {
  const env = game.env;
  const world = game.world;
  const pp = game.player.group.position;

  // street lamps: bring the 8 pooled lights to the nearest posts at night
  if (env.isNight && world.lampSpots.length) {
    const sorted = world.lampSpots
      .map((s) => ({ s, d: dist2(s[0], s[1], pp.x, pp.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, world.lampLights.length);
    world.lampLights.forEach((L, i) => {
      if (sorted[i] && sorted[i].d < 150 * 150) {
        L.position.set(sorted[i].s[0], 7.4, sorted[i].s[1]);
        L.intensity = 14;
      } else L.intensity = 0;
    });
  } else {
    for (const L of world.lampLights) L.intensity = 0;
  }

  // neon: pulse sign brightness, park pooled colored lights on the nearest few
  if (world.neonSigns.length) {
    const t = game.elapsed;
    if (env.isNight) {
      let nearest = [];
      for (const ns of world.neonSigns) {
        const d = dist2(ns.mesh.position.x, ns.mesh.position.z, pp.x, pp.z);
        ns.mat.color.setScalar(d < 200 * 200 ? 0.72 + Math.sin(t * 2 + ns.phase) * 0.28 : 0.9);
        if (d < 90 * 90) nearest.push({ ns, d });
      }
      nearest.sort((a, b) => a.d - b.d);
      world.neonLights.forEach((L, i) => {
        const n = nearest[i];
        if (n) {
          L.position.set(n.ns.mesh.position.x, n.ns.mesh.position.y + 0.6, n.ns.mesh.position.z);
          L.color.set(n.ns.color);
          L.intensity = 6 + Math.sin(t * 2 + n.ns.phase) * 2.5;
        } else L.intensity = 0;
      });
    } else {
      for (const ns of world.neonSigns) ns.mat.color.setScalar(0.85);
      for (const L of world.neonLights) L.intensity = 0;
    }
  }
}

const NEXT_WEATHER = {
  clear: ['clear', 'clear', 'haze', 'rain'],
  haze: ['clear', 'haze', 'rain'],
  rain: ['clear', 'rain', 'monsoon'],
  monsoon: ['rain', 'rain', 'clear']
};

export function updateWeather(game, dt) {
  const env = game.env;
  const state = game.state;

  env.weatherT -= dt;
  if (env.weatherT <= 0) {
    const next = pick(NEXT_WEATHER[state.weather] || ['clear']);
    if (next !== state.weather) {
      state.weather = next;
      game.store.set({ weather: next });
      if (next === 'rain') game.toast('🌧️ বৃষ্টি শুরু হলো... Rain rolling in.');
      if (next === 'monsoon') game.toast('⛈️ মৌসুমি ঝড়! Monsoon downpour — streets are flooding!');
    }
    env.weatherT = rand(90, 210);
  }

  const targetRain = state.weather === 'rain' ? 0.55 : state.weather === 'monsoon' ? 1 : 0;
  env.rainLevel = smoothTo(env.rainLevel, targetRain, 0.5, dt);
  game.audio.setRain(env.rainLevel);
  env.rain.material.opacity = env.rainLevel * 0.6;

  const pp = game.player.group.position;
  if (env.rainLevel > 0.02) {
    const pos = env.rainPos;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3 + 1] -= env.rainVel[i] * dt;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = pp.x + rand(-120, 120);
        pos[i * 3 + 1] = rand(70, 95);
        pos[i * 3 + 2] = pp.z + rand(-120, 120);
      }
    }
    env.rain.geometry.attributes.position.needsUpdate = true;
  }

  // flood rises ~30s into a monsoon, recedes over ~2 minutes after
  if (state.weather === 'monsoon') state.flood = clamp(state.flood + dt / 30, 0, 1);
  else state.flood = clamp(state.flood - dt / 120, 0, 1);
  env.flood.visible = state.flood > 0.03;
  env.flood.position.y = -0.42 + state.flood * 0.75;
  env.flood.position.x = pp.x;
  env.flood.position.z = pp.z;

  // smog shimmer (daytime industrial haze)
  env.smog.visible = !env.isNight && game.quality !== 'low';
  if (env.smog.visible) {
    const sp = env.smogPos;
    for (let i = 0; i < sp.length / 3; i++) {
      sp[i * 3] += Math.sin(game.elapsed * 0.3 + i) * dt * 1.2;
    }
    env.smog.geometry.attributes.position.needsUpdate = true;
  }
}
