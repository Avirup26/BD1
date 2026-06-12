// Humanoid rigs (player, NPCs, cops) built from primitives, plus NPC AI.
import * as THREE from 'three';
import { DISTRICTS, BUMP_TEXTS } from './constants.js';
import { onRoad, pointBlocked, resolveCircle } from './colliders.js';
import { rand, randi, pick, clamp, dist2, smoothAngle } from './utils.js';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
const SKIN_TONES = ['#C8956C', '#B07F55', '#9C6B42', '#8A5A35', '#D4A87E'];
const SHIRTS = ['#c0392b', '#1e6f9f', '#1d7a4f', '#d4a017', '#7d3c98', '#e8e0d0', '#2c3e50', '#e67e22'];
const PANTS = ['#2c3040', '#3d4b5c', '#4a4032', '#1a1a22', '#5a5248'];

/**
 * Returns { group, parts } — parts.armL/armR/legL/legR are pivot groups at the
 * shoulders/hips so rotation.x swings the whole limb.
 */
export function makeHuman(opts = {}) {
  const skin = opts.skin || pick(SKIN_TONES);
  const shirt = opts.shirt || pick(SHIRTS);
  const pants = opts.pants || pick(PANTS);
  const group = new THREE.Group();
  const parts = {};

  const torsoH = opts.panjabi ? 1.5 : 1.2;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, torsoH, 0.4), lambert(shirt));
  torso.position.y = opts.panjabi ? 1.4 : 1.55;
  torso.castShadow = true;
  group.add(torso);
  parts.torso = torso;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), lambert(skin));
  head.position.y = 2.45;
  head.castShadow = true;
  group.add(head);
  parts.head = head;

  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 10), lambert(opts.cap));
    cap.position.y = 2.78;
    group.add(cap);
  }

  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? -0.55 : 0.55;
    const armPivot = new THREE.Group();
    armPivot.position.set(sx, 2.05, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.85, 6), lambert(opts.sleeves || shirt));
    arm.position.y = -0.42;
    arm.castShadow = true;
    armPivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), lambert(skin));
    hand.position.y = -0.9;
    armPivot.add(hand);
    group.add(armPivot);
    parts['arm' + side] = armPivot;

    const legPivot = new THREE.Group();
    legPivot.position.set(sx * 0.42, 0.95, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.9, 6), lambert(opts.lungi ? '#46414f' : pants));
    leg.position.y = -0.45;
    leg.castShadow = true;
    legPivot.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.42), lambert('#241f1a'));
    foot.position.set(0, -0.92, 0.08);
    legPivot.add(foot);
    group.add(legPivot);
    parts['leg' + side] = legPivot;
  }

  if (opts.lungi) {
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.5, 0.9, 8, 1, true),
      new THREE.MeshLambertMaterial({ color: pick(['#1d5e4a', '#6e2a3a', '#3a4a7d']), side: THREE.DoubleSide })
    );
    skirt.position.y = 0.62;
    group.add(skirt);
    parts.legL.visible = false;
    parts.legR.visible = false;
  }

  if (opts.tray) {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.5), lambert('#9a7c4a'));
    tray.position.set(0, 1.35, 0.45);
    group.add(tray);
    for (let i = 0; i < 4; i++) {
      const item = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), lambert(pick(['#e8c468', '#c0392b', '#e8e0d0'])));
      item.position.set(-0.3 + i * 0.2, 1.46, 0.45);
      group.add(item);
    }
  }

  group.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return { group, parts };
}

export function animateHumanoid(parts, t, speedNorm, running, dt) {
  const freq = running ? 8 : 5;
  const amp = (running ? 0.5 : 0.32) * clamp(speedNorm, 0, 1);
  const swing = Math.sin(t * freq) * amp;
  if (parts.legL.visible) {
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
  }
  parts.armL.rotation.x = -swing * 0.7;
  parts.armR.rotation.x = swing * 0.7;
  if (speedNorm < 0.02) {
    // settle limbs back to rest
    for (const k of ['legL', 'legR', 'armL', 'armR']) {
      parts[k].rotation.x *= Math.max(0, 1 - dt * 8);
    }
  }
}

export function createPlayer(scene) {
  const { group, parts } = makeHuman({ skin: '#C8956C', shirt: '#e8e0d0', pants: '#2c3040' });
  group.position.set(95, 0, 470);
  scene.add(group);
  return {
    group, parts,
    heading: Math.PI,           // face south toward the river at spawn
    speed: 0,
    inVehicle: null,
    swimming: false,
    punchT: 0,
    attackCd: 0,
    baseY: 0,
    dead: false
  };
}

// ------------------------------------------------------------------ NPCs
const NPC_PLAN = [
  ['oldDhaka', 26], ['motijheel', 18], ['mirpur', 18], ['gulshan', 8],
  ['uttara', 8], ['dhanmondi', 8], ['tejgaon', 6], ['sadarghat', 8]
];

export function spawnNPCs(scene) {
  const npcs = [];
  for (const [districtId, count] of NPC_PLAN) {
    const d = DISTRICTS.find((x) => x.id === districtId);
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0, ok = false;
      for (let tries = 0; tries < 24 && !ok; tries++) {
        x = rand(d.x1 + 5, d.x2 - 5);
        z = rand(Math.max(d.z1, -795) + 5, Math.min(d.z2, 462) - 5);
        ok = !pointBlocked(x, z) && !onRoad(x, z, 1);
      }
      if (!ok) continue;
      const roll = Math.random();
      const kind = roll < 0.68 ? 'walker' : roll < 0.9 ? 'vendor' : 'gang';
      const { group, parts } = makeHuman({
        lungi: Math.random() < 0.3,
        panjabi: Math.random() < 0.25,
        tray: kind === 'vendor'
      });
      group.position.set(x, 0, z);
      group.rotation.y = rand(0, Math.PI * 2);
      scene.add(group);
      if (kind === 'gang') {
        parts.armL.rotation.z = 0.45;
        parts.armR.rotation.z = -0.45;
      }
      npcs.push({
        group, parts, kind,
        home: { x, z },
        tgt: { x, z },
        state: kind === 'walker' ? 'walk' : 'idle',
        t: rand(0, 4),
        speed: rand(1.3, 2.1),
        hp: 50,
        phase: rand(0, Math.PI * 2),
        bumpCd: 0,
        deadT: 0
      });
    }
  }
  return npcs;
}

function pickTarget(npc) {
  npc.tgt.x = npc.home.x + rand(-28, 28);
  npc.tgt.z = clamp(npc.home.z + rand(-28, 28), -795, 462);
}

export function updateNPCs(game, dt) {
  const p = game.player.group.position;
  const time = game.elapsed;
  for (const npc of game.npcs) {
    const pos = npc.group.position;
    const d2p = dist2(pos.x, pos.z, p.x, p.z);
    if (d2p > 300 * 300) continue; // far NPCs sleep

    npc.t -= dt;
    npc.bumpCd -= dt;

    if (npc.state === 'dead') {
      npc.deadT += dt;
      if (npc.deadT > 8) {
        // recycle: respawn fresh at home (entity pooling)
        npc.state = npc.kind === 'walker' ? 'walk' : 'idle';
        npc.hp = 50;
        npc.deadT = 0;
        npc.group.rotation.x = 0;
        npc.group.position.set(npc.home.x, 0, npc.home.z);
        npc.group.visible = d2p > 60 * 60; // don't pop in on screen right next to player
      } else if (npc.deadT > 5) {
        npc.group.position.y = -npc.deadT + 5; // sink away
      }
      continue;
    }

    if (npc.state === 'flee') {
      const dx = pos.x - npc.fleeFrom.x, dz = pos.z - npc.fleeFrom.z;
      const L = Math.hypot(dx, dz) || 1;
      const tgtHeading = Math.atan2(dx / L, dz / L);
      npc.group.rotation.y = smoothAngle(npc.group.rotation.y, tgtHeading, 8, dt);
      const nx = pos.x + Math.sin(npc.group.rotation.y) * 4.6 * dt;
      const nz = clamp(pos.z + Math.cos(npc.group.rotation.y) * 4.6 * dt, -795, 462);
      const r = resolveCircle(nx, nz, 0.5);
      pos.x = r.x; pos.z = r.z;
      animateHumanoid(npc.parts, time + npc.phase, 1, true, dt);
      if (npc.t <= 0) npc.state = npc.kind === 'walker' ? 'walk' : 'idle';
      continue;
    }

    if (npc.state === 'idle') {
      // vendors sway, gang members loiter
      npc.group.position.y = Math.sin(time * 1.8 + npc.phase) * 0.04;
      animateHumanoid(npc.parts, time + npc.phase, 0, false, dt);
      if (npc.kind === 'walker' && npc.t <= 0) { npc.state = 'walk'; pickTarget(npc); npc.t = rand(6, 14); }
      continue;
    }

    // walking
    const dx = npc.tgt.x - pos.x, dz = npc.tgt.z - pos.z;
    const distT = Math.hypot(dx, dz);
    if (distT < 1.2 || npc.t <= 0) {
      if (Math.random() < 0.3) { npc.state = 'idle'; npc.t = rand(2, 6); }
      else { pickTarget(npc); npc.t = rand(6, 14); }
      continue;
    }
    const tgtHeading = Math.atan2(dx / distT, dz / distT);
    npc.group.rotation.y = smoothAngle(npc.group.rotation.y, tgtHeading, 5, dt);
    const nx = pos.x + Math.sin(npc.group.rotation.y) * npc.speed * dt;
    const nz = clamp(pos.z + Math.cos(npc.group.rotation.y) * npc.speed * dt, -795, 462);
    const r = resolveCircle(nx, nz, 0.5);
    if (r.hit && Math.random() < 0.1) pickTarget(npc); // blocked — try elsewhere
    pos.x = r.x; pos.z = r.z;
    pos.y = Math.abs(Math.sin(time * 6 + npc.phase)) * 0.04;
    animateHumanoid(npc.parts, time + npc.phase, 0.6, false, dt);
  }
}

export function scareNPCs(game, x, z, radius) {
  for (const npc of game.npcs) {
    if (npc.state === 'dead') continue;
    const pos = npc.group.position;
    if (dist2(pos.x, pos.z, x, z) < radius * radius) {
      npc.state = 'flee';
      npc.fleeFrom = { x, z };
      npc.t = rand(4, 7);
    }
  }
}

export function bumpNPC(game, npc, hard) {
  if (npc.state === 'dead' || npc.bumpCd > 0) return;
  npc.bumpCd = 2.5;
  game.showBump(npc.group.position, pick(BUMP_TEXTS));
  if (!hard) {
    npc.state = 'flee';
    npc.fleeFrom = { x: game.player.group.position.x, z: game.player.group.position.z };
    npc.t = 2.5;
  }
}

export function killNPC(game, npc) {
  if (npc.state === 'dead') return;
  npc.state = 'dead';
  npc.hp = 0;
  npc.deadT = 0;
  npc.group.rotation.x = -Math.PI / 2;
  npc.group.position.y = 0.4;
}
