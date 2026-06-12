// Player combat (fists + pistol), tracers, money/ammo pickups, and
// player-vehicle contact damage.
import * as THREE from 'three';
import { rand, pick, clamp, dist2 } from './utils.js';
import { lineOfSight } from './colliders.js';
import { killNPC, scareNPCs } from './characters.js';
import { damageVehicle } from './vehicles.js';

const PISTOL_RANGE = 60;

export function initCombat(game) {
  game.tracers = [];
  game.pickups = [];
  game.muzzleLight = new THREE.PointLight(0xffc868, 0, 14, 2);
  game.scene.add(game.muzzleLight);
}

export function addTracer(game, from, to, color = 0xffe9a0) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  game.scene.add(line);
  game.tracers.push({ line, ttl: 0.12 });
}

export function spawnPickup(game, x, z, kind, amount) {
  const color = kind === 'money' ? 0x28c76f : kind === 'ammo' ? 0x8898b0 : 0xe84545;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.45 })
  );
  mesh.position.set(x, 0.8, z);
  game.scene.add(mesh);
  game.pickups.push({ mesh, kind, amount, t: 0 });
}

function frontTarget(game, range, cone) {
  // nearest NPC or cop in the player's forward cone
  const p = game.player;
  const px = p.group.position.x, pz = p.group.position.z;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  let best = null, bestD = range * range;
  const consider = (ent, isCop) => {
    if (ent.state === 'dead') return;
    const e = ent.group.position;
    const dx = e.x - px, dz = e.z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 > bestD || d2 < 0.01) return;
    const d = Math.sqrt(d2);
    if ((dx * fx + dz * fz) / d < cone) return;
    best = { ent, isCop, d };
    bestD = d2;
  };
  for (const npc of game.npcs) consider(npc, false);
  for (const cop of game.cops) consider(cop, true);
  return best;
}

export function attack(game) {
  const p = game.player;
  if (p.inVehicle || p.dead || p.attackCd > 0 || p.swimming) return;

  if (game.state.weapon === 'pistol') {
    if (game.state.ammo <= 0) {
      game.toast('গুলি শেষ! Out of ammo — punch or find more.');
      game.store.set({ weapon: 'fists', ammo: '∞' });
      game.state.weapon = 'fists';
      return;
    }
    p.attackCd = 0.45;
    p.punchT = 0.25;
    game.state.ammo--;
    game.store.set({ ammo: String(game.state.ammo) });
    game.audio.playGunshot();
    const px = p.group.position.x, pz = p.group.position.z;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    game.muzzleLight.position.set(px + fx * 1.2, 1.7, pz + fz * 1.2);
    game.muzzleLight.intensity = 4;
    game.fx.burst(px + fx * 1.2, 1.7, pz + fz * 1.2, '#ffd25e', 6, 4, 0.18, 0);
    scareNPCs(game, px, pz, 40);

    const target = frontTarget(game, PISTOL_RANGE, 0.94);
    const from = new THREE.Vector3(px + fx * 1.2, 1.7, pz + fz * 1.2);
    let to;
    if (target && lineOfSight(px, pz, target.ent.group.position.x, target.ent.group.position.z)) {
      const e = target.ent.group.position;
      to = new THREE.Vector3(e.x, 1.5, e.z);
      hurtEntity(game, target.ent, 40, target.isCop);
    } else {
      to = new THREE.Vector3(px + fx * PISTOL_RANGE, 1.6, pz + fz * PISTOL_RANGE);
      // shooting vehicles
      for (const v of game.vehicles) {
        const vp = v.group.position;
        const dx = vp.x - px, dz = vp.z - pz;
        const d = Math.hypot(dx, dz);
        if (d < 40 && d > 1 && (dx * fx + dz * fz) / d > 0.96) {
          damageVehicle(game, v, 18);
          game.fx.burst(vp.x, 1.2, vp.z, '#c8c8c0', 5, 4, 0.3);
          to = new THREE.Vector3(vp.x, 1.2, vp.z);
          break;
        }
      }
    }
    addTracer(game, from, to);
    game.addHeat(target ? 1 : 0);
    if (!target && Math.random() < 0.35) game.addHeat(1); // firing in public draws heat
  } else {
    // fists
    p.attackCd = 0.5;
    p.punchT = 0.3;
    game.audio.playPunch();
    const target = frontTarget(game, 2.8, 0.5);
    if (target) {
      hurtEntity(game, target.ent, 30, target.isCop);
      const e = target.ent.group.position;
      game.fx.burst(e.x, 1.6, e.z, '#e8d8c0', 5, 2.5, 0.3);
      if (!target.isCop && Math.random() < 0.4) game.addHeat(1);
    }
  }
}

export function hurtEntity(game, ent, dmg, isCop) {
  ent.hp -= dmg;
  if (ent.hp > 0) {
    if (!isCop) {
      ent.state = 'flee';
      ent.fleeFrom = { x: game.player.group.position.x, z: game.player.group.position.z };
      ent.t = 5;
    }
    return;
  }
  if (isCop) {
    ent.state = 'dead';
    ent.group.rotation.x = -Math.PI / 2;
    ent.group.position.y = 0.4;
    ent.deadT = 0;
    game.addHeat(1);
    spawnPickup(game, ent.group.position.x + rand(-1, 1), ent.group.position.z + rand(-1, 1), 'ammo', 8);
  } else {
    killNPC(game, ent);
    game.addHeat(1);
    spawnPickup(game, ent.group.position.x + rand(-1, 1), ent.group.position.z + rand(-1, 1), 'money', Math.round(rand(40, 160)));
  }
}

export function updateCombat(game, dt) {
  const p = game.player;
  p.attackCd = Math.max(0, p.attackCd - dt);
  game.muzzleLight.intensity = Math.max(0, game.muzzleLight.intensity - dt * 40);

  // punch animation
  if (p.punchT > 0) {
    p.punchT -= dt;
    p.parts.armR.rotation.x = -1.6 * Math.sin((p.punchT / 0.3) * Math.PI);
  }

  // tracers fade
  for (let i = game.tracers.length - 1; i >= 0; i--) {
    const t = game.tracers[i];
    t.ttl -= dt;
    t.line.material.opacity = Math.max(0, t.ttl / 0.12);
    if (t.ttl <= 0) {
      game.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      game.tracers.splice(i, 1);
    }
  }

  // pickups: bob, spin, collect
  const px = p.group.position.x, pz = p.group.position.z;
  const collectorX = p.inVehicle ? p.inVehicle.group.position.x : px;
  const collectorZ = p.inVehicle ? p.inVehicle.group.position.z : pz;
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i];
    pk.t += dt;
    pk.mesh.rotation.y += dt * 3;
    pk.mesh.position.y = 0.8 + Math.sin(pk.t * 3) * 0.15;
    if (dist2(pk.mesh.position.x, pk.mesh.position.z, collectorX, collectorZ) < 4) {
      if (pk.kind === 'money') {
        game.addMoney(pk.amount);
        game.toast(`+৳${pk.amount}`);
      } else if (pk.kind === 'ammo') {
        game.state.ammoReserve = (game.state.ammoReserve || 0);
        game.state.ammo += pk.amount;
        if (game.state.weapon === 'pistol') game.store.set({ ammo: String(game.state.ammo) });
        game.toast(`+${pk.amount} গুলি (ammo)`);
      } else {
        game.state.health = clamp(game.state.health + pk.amount, 0, 100);
        game.store.set({ health: game.state.health });
      }
      game.audio.playPickup();
      game.scene.remove(pk.mesh);
      game.pickups.splice(i, 1);
    } else if (pk.t > 45) {
      game.scene.remove(pk.mesh);
      game.pickups.splice(i, 1);
    }
  }

  // player vehicle vs other vehicles: simple separation + damage
  const pv = p.inVehicle;
  if (pv && !pv.exploded) {
    const pos = pv.group.position;
    for (const v of game.vehicles) {
      if (v === pv || v.exploded || v.isBoat !== pv.isBoat) continue;
      const vp = v.group.position;
      const rr = pv.spec.radius + v.spec.radius;
      const d2 = dist2(pos.x, pos.z, vp.x, vp.z);
      if (d2 < rr * rr && d2 > 0.001) {
        const d = Math.sqrt(d2);
        const nx = (pos.x - vp.x) / d, nz = (pos.z - vp.z) / d;
        const overlap = rr - d;
        pos.x += nx * overlap * 0.6;
        pos.z += nz * overlap * 0.6;
        vp.x -= nx * overlap * 0.4;
        vp.z -= nz * overlap * 0.4;
        const rel = Math.abs(pv.speed) + Math.abs(v.speed);
        if (rel > 10) {
          damageVehicle(game, pv, (rel - 8) * 1.1);
          damageVehicle(game, v, (rel - 8) * 1.6);
          game.fx.burst((pos.x + vp.x) / 2, 1, (pos.z + vp.z) / 2, '#d8d0b8', 8, 5, 0.4);
          game.shake = 0.3;
          if (!v.police && v.route) game.addHeat(0); // fender benders are free... mostly
        }
        pv.speed *= 0.55;
        v.speed *= 0.55;
        if (v.route) v.route = Math.random() < 0.15 ? null : v.route; // some drivers give up
      }
    }
  }
}
