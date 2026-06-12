// Wanted/heat system: foot cops, patrol cars, moto squads, RAB Prados,
// the helicopter with sweeping spotlight, and 5★ army roadblocks.
import * as THREE from 'three';
import { rand, pick, clamp, dist2, smoothAngle, smoothTo } from './utils.js';
import { resolveCircle, lineOfSight } from './colliders.js';
import { makeHuman, animateHumanoid } from './characters.js';
import { makeVehicle, buildHelicopter } from './vehicles.js';
import { addTracer } from './combat.js';

// desired unit counts per wanted level (index = level 0..5)
const FOOT = [0, 2, 2, 3, 3, 5];
const CARS = [0, 0, 1, 1, 2, 2];
const MOTOS = [0, 0, 0, 3, 2, 2];
const RABS = [0, 0, 0, 0, 2, 3];

export function setWanted(game, n) {
  n = clamp(Math.round(n), 0, 5);
  if (n === game.state.wanted) return;
  game.state.wanted = n;
  game.store.set({ wanted: n });
  if (n === 0) clearPolice(game);
}

export function addHeat(game, n) {
  if (n <= 0) return;
  game.state.heatTimer = 0;
  setWanted(game, game.state.wanted + n);
}

export function clearPolice(game) {
  for (const cop of game.cops) game.scene.remove(cop.group);
  game.cops.length = 0;
  for (let i = game.vehicles.length - 1; i >= 0; i--) {
    const v = game.vehicles[i];
    if (v.police && v.temp) {
      game.scene.remove(v.group);
      game.vehicles.splice(i, 1);
    }
  }
  for (const rb of game.roadblocks) game.scene.remove(rb.group);
  game.roadblocks.length = 0;
  if (game.heli) game.heliLeaving = true;
  game.state.bustedT = 0;
}

function spawnFootCop(game, x, z, rab = false) {
  const { group, parts } = makeHuman(
    rab ? { shirt: '#16161a', pants: '#16161a', cap: '#16161a', skin: '#B07F55' }
        : { shirt: '#2c3e50', pants: '#10325c', cap: '#10325c' }
  );
  const r = resolveCircle(x, z, 0.6);
  group.position.set(r.x, 0, r.z);
  game.scene.add(group);
  game.cops.push({
    group, parts, hp: rab ? 120 : 80, rab,
    state: 'chase', shootCd: rand(0.8, 2), meleeCd: 0,
    phase: rand(0, 9), deadT: 0
  });
}

function spawnPoliceVehicle(game, kind) {
  const p = game.player.group.position;
  const a = rand(0, Math.PI * 2);
  const d = rand(90, 130);
  let x = clamp(p.x + Math.cos(a) * d, -950, 950);
  let z = clamp(p.z + Math.sin(a) * d, -950, 440);
  const r = resolveCircle(x, z, 3);
  const heading = Math.atan2(p.x - r.x, p.z - r.z);
  const v = makeVehicle(game, kind, r.x, r.z, heading, { driver: true, cop: true });
  v.temp = true;
  return v;
}

export function updatePolice(game, dt) {
  const state = game.state;
  const p = game.player;
  const pp = p.group.position;
  const wanted = state.wanted;

  // ---------- heat decay ----------
  if (wanted > 0) {
    state.heatTimer += dt;
    let nearestCop = 1e9;
    for (const c of game.cops) {
      if (c.state !== 'dead') nearestCop = Math.min(nearestCop, dist2(c.group.position.x, c.group.position.z, pp.x, pp.z));
    }
    for (const v of game.vehicles) {
      if (v.police && v.temp && !v.exploded) nearestCop = Math.min(nearestCop, dist2(v.group.position.x, v.group.position.z, pp.x, pp.z));
    }
    if (state.heatTimer > 22 && nearestCop > 70 * 70) {
      setWanted(game, wanted - 1);
      state.heatTimer = 10;
    }
    game.copProximity = clamp(1 - Math.sqrt(nearestCop) / 120, 0, 1);
  } else {
    game.copProximity = 0;
  }

  // ---------- spawning to quota ----------
  game.copSpawnT = (game.copSpawnT || 0) - dt;
  if (wanted > 0 && game.copSpawnT <= 0) {
    game.copSpawnT = 1.4;
    const aliveFoot = game.cops.filter((c) => c.state !== 'dead').length;
    const cars = game.vehicles.filter((v) => v.type === 'police' && v.temp && !v.exploded).length;
    const motos = game.vehicles.filter((v) => v.type === 'policeMoto' && v.temp && !v.exploded).length;
    const rabs = game.vehicles.filter((v) => v.type === 'rab' && v.temp && !v.exploded).length;
    if (aliveFoot < FOOT[wanted]) {
      const a = rand(0, Math.PI * 2);
      spawnFootCop(game, pp.x + Math.cos(a) * rand(45, 70), clamp(pp.z + Math.sin(a) * rand(45, 70), -950, 460), wanted >= 4 && Math.random() < 0.5);
    } else if (cars < CARS[wanted]) spawnPoliceVehicle(game, 'police');
    else if (motos < MOTOS[wanted]) spawnPoliceVehicle(game, 'policeMoto');
    else if (rabs < RABS[wanted]) spawnPoliceVehicle(game, 'rab');
  }

  // ---------- foot cop AI ----------
  let bustedPressure = false;
  for (let i = game.cops.length - 1; i >= 0; i--) {
    const cop = game.cops[i];
    const cp = cop.group.position;

    if (cop.state === 'dead') {
      cop.deadT += dt;
      if (cop.deadT > 6) {
        game.scene.remove(cop.group);
        game.cops.splice(i, 1);
      }
      continue;
    }
    if (wanted === 0) {
      // stand down and vanish when out of sight
      if (dist2(cp.x, cp.z, pp.x, pp.z) > 80 * 80) {
        game.scene.remove(cop.group);
        game.cops.splice(i, 1);
      }
      continue;
    }

    const dx = pp.x - cp.x, dz = pp.z - cp.z;
    const d = Math.hypot(dx, dz) || 1;
    const desired = Math.atan2(dx / d, dz / d);
    cop.group.rotation.y = smoothAngle(cop.group.rotation.y, desired, 7, dt);

    const shootRange = wanted >= 3 || cop.rab;
    const wantDist = shootRange ? rand(14, 22) : 1.6;

    if (d > wantDist) {
      const speed = 6.8;
      const nx = cp.x + Math.sin(cop.group.rotation.y) * speed * dt;
      const nz = clamp(cp.z + Math.cos(cop.group.rotation.y) * speed * dt, -950, 462);
      const r = resolveCircle(nx, nz, 0.5);
      cp.x = r.x; cp.z = r.z;
      animateHumanoid(cop.parts, game.elapsed + cop.phase, 1, true, dt);
    } else {
      animateHumanoid(cop.parts, game.elapsed + cop.phase, 0, false, dt);
    }

    // melee
    cop.meleeCd -= dt;
    if (d < 2.0 && cop.meleeCd <= 0 && !p.inVehicle) {
      cop.meleeCd = 0.9;
      game.damagePlayer(6, 'baton');
      game.fx.burst(pp.x, 1.6, pp.z, '#e8d8c0', 4, 2, 0.25);
    }

    // shooting at 3★+
    if (shootRange && wanted >= 3) {
      cop.shootCd -= dt;
      if (cop.shootCd <= 0 && d < 42) {
        cop.shootCd = rand(1.2, 2.2) / (cop.rab ? 1.6 : 1);
        if (lineOfSight(cp.x, cp.z, pp.x, pp.z)) {
          game.audio.playGunshot();
          addTracer(game,
            new THREE.Vector3(cp.x, 1.8, cp.z),
            new THREE.Vector3(pp.x + rand(-0.8, 0.8), 1.4, pp.z + rand(-0.8, 0.8)),
            0xffb0b0);
          if (Math.random() < 0.55) {
            const dmg = (cop.rab ? 8 : 5) + wanted;
            if (p.inVehicle) {
              p.inVehicle.hp -= dmg;
            } else {
              game.damagePlayer(dmg, 'gunfire');
            }
          }
        }
      }
    }

    // arrest pressure
    if (!p.inVehicle && d < 2.4) bustedPressure = true;
  }

  // ---------- busted check ----------
  if (wanted > 0 && bustedPressure && !p.dead) {
    state.bustedT = (state.bustedT || 0) + dt;
    if (state.bustedT > 1.6) game.playerBusted();
  } else {
    state.bustedT = 0;
  }

  // ---------- police vehicles disgorge officers when they corner you ----------
  for (const v of game.vehicles) {
    if (!v.police || !v.temp || v.exploded || v.isBoat) continue;
    const d = dist2(v.group.position.x, v.group.position.z, pp.x, pp.z);
    if (d < 13 * 13 && Math.abs(v.speed) < 4 && !v.disgorged) {
      v.disgorged = true;
      const n = v.type === 'rab' ? 2 : 1;
      for (let k = 0; k < n; k++) {
        spawnFootCop(game, v.group.position.x + rand(-2, 2), v.group.position.z + rand(-2, 2), v.type === 'rab');
      }
      if (v.driver) { v.group.remove(v.driver); v.driver = null; }
    }
    // ramming the player on foot hurts
    if (!p.inVehicle && d < (v.spec.radius + 0.8) * (v.spec.radius + 0.8) && Math.abs(v.speed) > 8) {
      game.damagePlayer(22, 'rammed');
      v.speed *= 0.4;
    }
  }

  // ---------- helicopter ----------
  if (wanted >= 4 && !game.heli) {
    game.heli = buildHelicopter(game.scene);
    game.heli.group.position.set(pp.x + 80, 90, pp.z + 80);
    game.heliLeaving = false;
    game.toast('🚁 র‍্যাব হেলিকপ্টার মোতায়েন! RAB helicopter deployed!');
  }
  if (game.heli) {
    const h = game.heli;
    h.angle += dt * 0.35;
    h.rotor.rotation.y += dt * 28;
    h.tailRotor.rotation.x += dt * 34;
    if (game.heliLeaving || wanted < 4) {
      h.group.position.y += dt * 22;
      h.group.position.x += dt * 30;
      if (h.group.position.y > 150) {
        game.scene.remove(h.group);
        game.heli = null;
      }
    } else {
      const tx = pp.x + Math.cos(h.angle) * 26;
      const tz = pp.z + Math.sin(h.angle) * 26;
      h.group.position.x = smoothTo(h.group.position.x, tx, 1.2, dt);
      h.group.position.z = smoothTo(h.group.position.z, tz, 1.2, dt);
      h.group.position.y = smoothTo(h.group.position.y, 52, 1.5, dt);
      h.group.rotation.y = Math.atan2(pp.x - h.group.position.x, pp.z - h.group.position.z);
      // sweeping searchlight
      h.spot.intensity = 250;
      h.spotTarget.position.set(
        Math.sin(game.elapsed * 0.9) * 7,
        -52,
        18 + Math.cos(game.elapsed * 1.3) * 7
      );
      // door gunner at 5★
      if (wanted >= 5) {
        h.fireCd -= dt;
        if (h.fireCd <= 0) {
          h.fireCd = rand(1.6, 2.6);
          game.audio.playGunshot();
          addTracer(game, h.group.position.clone(), new THREE.Vector3(pp.x + rand(-1.5, 1.5), 1.2, pp.z + rand(-1.5, 1.5)), 0xffb0b0);
          if (Math.random() < 0.45) {
            if (p.inVehicle) p.inVehicle.hp -= 10;
            else game.damagePlayer(8, 'helicopter fire');
          }
        }
      }
    }
  }

  // ---------- 5★ roadblocks ----------
  if (wanted >= 5 && game.roadblocks.length === 0) {
    for (const ahead of [60, -60]) {
      const bx = clamp(pp.x + Math.sin(p.heading) * ahead, -940, 940);
      const bz = clamp(pp.z + Math.cos(p.heading) * ahead, -940, 440);
      const truck = makeVehicle(game, 'truck', bx, bz, p.heading + Math.PI / 2, {});
      truck.temp = true;
      truck.police = true;
      truck.static = true;
      game.roadblocks.push(truck);
      spawnFootCop(game, bx + 4, bz + 4, true);
    }
    game.toast('সেনা রোডব্লক! Army roadblocks deployed!');
  }
}
