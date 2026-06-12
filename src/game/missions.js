// Mission manager + the five scripted missions.
import * as THREE from 'three';
import { MISSION_TEXT } from './constants.js';
import { rand, clamp, dist2, dist, smoothAngle } from './utils.js';
import { makeVehicle } from './vehicles.js';
import { makeHuman, animateHumanoid } from './characters.js';
import { setWanted } from './police.js';

const ORDER = ['m1', 'm2', 'm3', 'm4', 'm5'];

function makeBeacon(scene, colorHex) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 16, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  cyl.position.y = 8;
  g.add(cyl);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 8, 28),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);
  g.userData.ring = ring;
  scene.add(g);
  return g;
}

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.data = {};
    this.startBeacon = null;
    this.objBeacon = null;
    this.objLabel = '';
    this.timer = null;
    this.spawned = []; // every mission-spawned object for cleanup
  }

  get completed() { return this.game.state.missionsCompleted; }

  nextId() { return ORDER.find((id) => !this.completed.includes(id)) || null; }

  // ---------- beacons ----------
  placeStartBeacon(x, z, label) {
    this.clearStartBeacon();
    this.startBeacon = makeBeacon(this.game.scene, 0xffd25e);
    this.startBeacon.position.set(x, 0, z);
    this.startBeacon.userData.label = label;
  }
  clearStartBeacon() {
    if (this.startBeacon) { this.game.scene.remove(this.startBeacon); this.startBeacon = null; }
  }
  setObjBeacon(x, z, label) {
    if (!this.objBeacon) {
      this.objBeacon = makeBeacon(this.game.scene, 0x6fd86f);
    }
    this.objBeacon.position.set(x, 0, z);
    this.objBeacon.userData.label = label;
    this.objBeacon.visible = true;
  }
  clearObjBeacon() {
    if (this.objBeacon) this.objBeacon.visible = false;
  }
  markerInfo() {
    if (this.objBeacon && this.objBeacon.visible) return { x: this.objBeacon.position.x, z: this.objBeacon.position.z, label: this.objBeacon.userData.label };
    if (this.startBeacon) return { x: this.startBeacon.position.x, z: this.startBeacon.position.z, label: this.startBeacon.userData.label };
    return null;
  }

  // ---------- lifecycle ----------
  start(id) {
    const g = this.game;
    this.active = id;
    this.data = { step: 0 };
    this.clearStartBeacon();
    g.store.set({ missionTitle: `${MISSION_TEXT[id].bn} — ${MISSION_TEXT[id].en}` });
    DEFS[id].onStart(g, this);
  }

  objective(text) { this.game.store.set({ objective: text }); }

  setTimer(sec) { this.timer = sec; }

  track(obj) { this.spawned.push(obj); return obj; }

  cleanup() {
    const g = this.game;
    for (const o of this.spawned) {
      if (o.isVehicle) {
        const i = g.vehicles.indexOf(o.v);
        if (i >= 0) g.vehicles.splice(i, 1);
        g.scene.remove(o.v.group);
      } else if (o.isNpc) {
        const i = g.npcs.indexOf(o.npc);
        if (i >= 0) g.npcs.splice(i, 1);
        g.scene.remove(o.npc.group);
      } else if (o.isObj) {
        g.scene.remove(o.mesh);
      }
    }
    this.spawned = [];
    this.clearObjBeacon();
    this.timer = null;
    this.game.suppressHeat = false;
    this.game.store.set({ objective: null, missionTitle: null, missionTimer: null });
  }

  complete(reward) {
    const g = this.game;
    const id = this.active;
    this.active = null;
    if (DEFS[id].onComplete) DEFS[id].onComplete(g, this);
    this.cleanup();
    this.completed.push(id);
    g.addMoney(reward);
    g.toast(`✅ মিশন সম্পন্ন! Mission passed — ৳${reward.toLocaleString()}`);
    g.save();
  }

  fail(reason) {
    const g = this.game;
    this.active = null;
    this.cleanup();
    setWanted(g, 0);
    g.toast(`❌ মিশন ব্যর্থ! Mission failed — ${reason}`);
  }

  onPlayerDown() {
    if (this.active) this.fail('আপনি ধরা পড়েছেন / you went down');
  }

  tryInteract() {
    if (this.active && DEFS[this.active].interact) {
      return DEFS[this.active].interact(this.game, this);
    }
    return false;
  }

  update(dt) {
    const g = this.game;
    const pp = g.player.group.position;

    // animate beacons
    for (const b of [this.startBeacon, this.objBeacon]) {
      if (b && b.visible) {
        b.userData.ring.rotation.z += dt * 1.8;
        const s = 1 + Math.sin(g.elapsed * 3) * 0.12;
        b.userData.ring.scale.set(s, s, 1);
      }
    }

    if (this.timer !== null && this.active) {
      this.timer -= dt;
      g.store.set({ missionTimer: Math.max(0, Math.ceil(this.timer)) });
      if (this.timer <= 0) { this.fail('সময় শেষ / time ran out'); return; }
    }

    if (!this.active) {
      const next = this.nextId();
      if (!next) return;
      const def = DEFS[next];
      if (!this.startBeacon) {
        this.placeStartBeacon(def.start[0], def.start[1], `${MISSION_TEXT[next].bn} শুরু করুন`);
        g.store.set({ objective: null, missionTimer: null, missionTitle: null });
      }
      // m1 auto-starts on a brand-new game (you wake up on the ferry)
      if (next === 'm1' && g.freshStart && g.elapsed > 2) {
        g.freshStart = false;
        this.start('m1');
        return;
      }
      if (dist2(pp.x, pp.z, def.start[0], def.start[1]) < 25) this.start(next);
      return;
    }

    DEFS[this.active].update(g, this, dt);
  }
}

// ============================================================ mission defs
const DEFS = {
  // ---------------------------------------------- M1: Sadarghat Landing
  m1: {
    start: [95, 474],
    onStart(g, m) {
      // checkpoint at (-30, 380): barrier + two stationed officers
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(10, 1, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xd8d8d0 })
      );
      barrier.position.set(-30, 1, 380);
      g.scene.add(barrier);
      m.track({ isObj: true, mesh: barrier });
      for (const ox of [-5, 5]) {
        const cop = makeHuman({ shirt: '#2c3e50', pants: '#10325c', cap: '#10325c' });
        cop.group.position.set(-30 + ox, 0, 381.5);
        cop.group.rotation.y = Math.PI;
        g.scene.add(cop.group);
        m.track({ isObj: true, mesh: cop.group });
      }
      m.data.step = 0;
      m.objective('নৌকা থেকে নেমে ঘাটে আসুন — Walk ashore. WASD to move, Shift to run.');
    },
    update(g, m, dt) {
      const pp = g.player.group.position;
      const d = m.data;
      if (d.step === 0 && pp.z < 470) {
        d.step = 1;
        m.objective('পার্ক করা সবুজ সিএনজিটা নিন (E) — Steal the parked green CNG. Press E near it.');
        m.setObjBeacon(62, 432, 'সিএনজি');
      }
      if (d.step === 1 && g.player.inVehicle) {
        d.step = 2;
        m.objective('লালবাগ কেল্লার গেটে যোগাযোগের কাছে যান — পুলিশ চেকপোস্ট এড়িয়ে! Avoid the police checkpoint!');
        m.setObjBeacon(-50, 456, 'লালবাগ কেল্লা');
      }
      // checkpoint spots you on foot
      if (!g.player.inVehicle && dist2(pp.x, pp.z, -30, 380) < 13 * 13) {
        m.fail('চেকপোস্টে ধরা পড়েছেন! Spotted at the checkpoint!');
        return;
      }
      if (d.step === 2 && dist2(pp.x, pp.z, -50, 456) < 49) {
        g.state.weapon = 'pistol';
        g.state.ammo = 24;
        g.store.set({ weapon: 'pistol', ammo: '24' });
        g.toast('🔫 যোগাযোগ আপনাকে একটা পিস্তল দিল! Contact handed you a pistol (1/2 to switch, F to fire).');
        m.complete(500);
      }
    }
  },

  // ---------------------------------------------- M2: Rickshaw Runner
  m2: {
    start: [40, 345],
    onStart(g, m) {
      const route = { pts: [[50, 350], [8, 338], [4, 160], [40, 150], [96, 142], [100, 108]], w: 10 };
      const v = makeVehicle(g, 'rickshaw', 50, 350, Math.PI, { route, driver: true });
      v.cruise = 6.2;
      m.track({ isVehicle: true, v });
      m.data.target = v;
      m.data.far = 0;
      m.setTimer(120);
      m.objective('একটা রিকশা নিয়ে ওই রিকশাওয়ালাকে অনুসরণ করুন — stay within 30m, never closer than 5m!');
    },
    update(g, m, dt) {
      const t = m.data.target;
      const tp = t.group.position;
      const inRickshaw = g.player.inVehicle && g.player.inVehicle.type === 'rickshaw';
      const pp = inRickshaw ? g.player.inVehicle.group.position : g.player.group.position;
      const d = dist(tp.x, tp.z, pp.x, pp.z);

      if (!inRickshaw) {
        m.data.far += dt;
        if (m.data.far > 12) { m.fail('রিকশা ছাড়া অনুসরণ করা যায় না! You need a rickshaw!'); return; }
      } else if (d < 5) {
        m.fail('খুব কাছে গিয়ে ধরা পড়েছেন! Too close — he spotted you!');
        return;
      } else if (d > 30) {
        m.data.far += dt;
        m.objective(`⚠️ পিছিয়ে পড়ছেন! Closing distance... ${Math.round(d)}m (lose him in ${Math.ceil(8 - m.data.far)}s)`);
        if (m.data.far > 8) { m.fail('টার্গেট হারিয়ে গেছে! You lost him!'); return; }
      } else {
        m.data.far = Math.max(0, m.data.far - dt * 2);
        m.objective(`রিকশাওয়ালাকে অনুসরণ করুন — ${Math.round(d)}m behind. শাপলা চত্বরের দিকে যাচ্ছে...`);
      }
      // target reached Shapla Chattar
      if (dist2(tp.x, tp.z, 100, 108) < 36) m.complete(800);
    }
  },

  // ---------------------------------------------- M3: Gulshan Grab
  m3: {
    start: [330, -195],
    onStart(g, m) {
      const v = makeVehicle(g, 'prado', 352, -208, 0.4, { color: '#1A1A1A' });
      m.track({ isVehicle: true, v });
      m.data.prado = v;
      m.data.stolen = false;
      m.setObjBeacon(352, -208, 'কালো প্রাডো');
      m.objective('কূটনীতিকের কালো প্রাডোটা চুরি করুন — Steal the black Prado (E).');
    },
    update(g, m) {
      const v = m.data.prado;
      if (v.exploded) { m.fail('প্রাডো ধ্বংস হয়ে গেছে! The Prado was destroyed!'); return; }
      if (!m.data.stolen && g.player.inVehicle === v) {
        m.data.stolen = true;
        setWanted(g, 2);
        m.setObjBeacon(-400, 66, 'চপ শপ');
        m.objective('মিরপুরের চপ শপে পৌঁছে দিন — পুলিশ পিছনে! Deliver it to the Mirpur chop shop!');
      }
      if (m.data.stolen && g.player.inVehicle === v) {
        const vp = v.group.position;
        if (dist2(vp.x, vp.z, -400, 66) < 100) {
          setWanted(g, 0);
          m.complete(2000);
        }
      }
    }
  },

  // ---------------------------------------------- M4: Buriganga Run
  m4: {
    start: [92, 472],
    onStart(g, m) {
      const v = makeVehicle(g, 'boat', 85, 502, -Math.PI / 2);
      m.track({ isVehicle: true, v });
      m.data.boat = v;
      m.data.chasers = [];
      m.data.debris = [];
      // floating debris field to weave through
      for (let i = 0; i < 10; i++) {
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(rand(1.5, 3), 1, rand(1.5, 3)),
          new THREE.MeshLambertMaterial({ color: 0x6e5a40 })
        );
        crate.position.set(-80 - i * 48 + rand(-15, 15), -0.1, rand(495, 590));
        g.scene.add(crate);
        m.track({ isObj: true, mesh: crate });
        m.data.debris.push(crate);
      }
      m.setObjBeacon(85, 502, 'স্পিডবোট');
      m.objective('ঘাটের স্পিডবোটে উঠুন — Get in the speedboat (E).');
    },
    update(g, m, dt) {
      const d = m.data;
      const boat = d.boat;
      if (boat.exploded) { m.fail('বোট ডুবে গেছে! The boat went down!'); return; }
      const inBoat = g.player.inVehicle === boat;
      const bp = boat.group.position;

      if (inBoat && d.step === 0) {
        d.step = 1;
        m.setObjBeacon(-600, 520, 'নারায়ণগঞ্জ সীমানা');
        m.objective('পশ্চিমে চালাও! Reach the Narayanganj border marker — dodge the debris!');
      }
      if (d.step >= 1) {
        // river police join the chase once you pass x=200
        if (bp.x < 200 && !d.chase) {
          d.chase = true;
          for (const off of [[70, 525], [80, 560]]) {
            const pb = makeVehicle(g, 'policeBoat', bp.x + off[0], off[1], -Math.PI / 2, { driver: true, cop: true });
            pb.missionSiren = true;
            m.track({ isVehicle: true, v: pb });
            d.chasers.push(pb);
          }
          g.toast('🚨 নৌ-পুলিশ ধাওয়া করছে! River police on your tail!');
        }
        // drive the chase boats (mission AI, runs before vehicle integration)
        for (const pb of d.chasers) {
          if (pb.exploded) continue;
          const cp = pb.group.position;
          const dx = bp.x - cp.x, dz = bp.z - cp.z;
          const L = Math.hypot(dx, dz) || 1;
          pb.heading = smoothAngle(pb.heading, Math.atan2(dx / L, dz / L), 1.8, dt);
          pb.speed += (pb.spec.maxSpeed * 0.92 - pb.speed) * Math.min(1, dt * 1.2);
          if (inBoat && L < 5) {
            boat.hp -= dt * 18;
            if (Math.random() < dt * 6) g.fx.burst(bp.x, 1, bp.z, '#e8e2d0', 4, 3, 0.4);
            if (boat.hp <= 0) { m.fail('নৌ-পুলিশ ধরে ফেলেছে! The river police got you!'); return; }
          }
        }
        // debris collisions
        if (inBoat && Math.abs(boat.speed) > 3) {
          for (const crate of d.debris) {
            if (dist2(crate.position.x, crate.position.z, bp.x, bp.z) < 7) {
              boat.speed *= 0.35;
              boat.hp -= 7;
              g.audio.playSplash();
              g.fx.burst(bp.x, 0.6, bp.z, '#9a8a6a', 8, 4, 0.5);
              crate.position.z += 18; // knocked clear
            }
          }
        }
        if (inBoat && bp.x < -590) {
          for (const pb of d.chasers) pb.missionSiren = false;
          m.complete(1500);
        }
      }
    }
  },

  // ---------------------------------------------- M5: Jamuna Heist
  m5: {
    start: [22, 318],
    onStart(g, m) {
      const d = m.data;
      d.phase = 'cutscene';
      d.cutT = 7;
      d.crew = [];
      d.recruited = 0;
      d.guards = [];
      d.loot = [];
      d.lootGot = 0;
      g.state.busy = true;
      g.store.set({
        cutscene: {
          title: 'যমুনা হাইস্ট',
          lines: [
            'রাত নামছে ঢাকায়। শহরের সবচেয়ে বড় দাও — যমুনা ফিউচার পার্কের ইলেকট্রনিক্স ভল্ট।',
            'Two crew, one Prado, five crates of gold-plated phones.',
            'ক্রু জোগাড় করো। মলে ঢোকো। মাল নিয়ে পালাও। সহজ... তাই না?'
          ]
        }
      });
      // crew members waiting in Old Dhaka
      for (const [cx, cz] of [[60, 302], [118, 262]]) {
        const h = makeHuman({ shirt: '#1a1a22', pants: '#16161a' });
        h.group.position.set(cx, 0, cz);
        g.scene.add(h.group);
        m.track({ isObj: true, mesh: h.group });
        d.crew.push({ group: h.group, parts: h.parts, joined: false, phase: rand(0, 9) });
        const glow = new THREE.Mesh(
          new THREE.CylinderGeometry(1.4, 1.4, 0.3, 16),
          new THREE.MeshBasicMaterial({ color: 0xffd25e, transparent: true, opacity: 0.4 })
        );
        glow.position.set(cx, 0.15, cz);
        g.scene.add(glow);
        m.track({ isObj: true, mesh: glow });
      }
    },
    interact(g, m) {
      const d = m.data;
      if (d.phase !== 'recruit') return false;
      const pp = g.player.group.position;
      for (const c of d.crew) {
        if (!c.joined && dist2(c.group.position.x, c.group.position.z, pp.x, pp.z) < 9) {
          c.joined = true;
          d.recruited++;
          g.toast(d.recruited === 1 ? '১ম ক্রু যোগ দিল! Crew member joined.' : 'ক্রু সম্পূর্ণ! Crew complete!');
          if (d.recruited === 2) {
            d.phase = 'drive';
            m.setObjBeacon(-300, -610, 'যমুনা ফিউচার পার্ক');
            m.objective('মলে যাও — Drive the crew to Jamuna Future Park.');
          }
          return true;
        }
      }
      return false;
    },
    update(g, m, dt) {
      const d = m.data;
      const pp = g.player.group.position;

      if (d.phase === 'cutscene') {
        d.cutT -= dt;
        if (d.cutT <= 0) {
          g.store.set({ cutscene: null });
          g.state.busy = false;
          d.phase = 'recruit';
          m.setObjBeacon(60, 302, 'ক্রু সদস্য');
          m.objective('দুইজন ক্রু সদস্যকে নাও — Walk up to each crew member and press E. (0/2)');
        }
        return;
      }

      // crew followers: trail the player on foot, vanish into the vehicle with you
      for (let i = 0; i < d.crew.length; i++) {
        const c = d.crew[i];
        if (!c.joined) continue;
        if (g.player.inVehicle) { c.group.visible = false; continue; }
        c.group.visible = true;
        const tx = pp.x - Math.sin(g.player.heading) * (2.2 + i * 1.4) + (i ? 1.2 : -1.2);
        const tz = pp.z - Math.cos(g.player.heading) * (2.2 + i * 1.4);
        const dx = tx - c.group.position.x, dz = tz - c.group.position.z;
        const L = Math.hypot(dx, dz);
        if (L > 40) { c.group.position.set(tx, 0, tz); }
        else if (L > 1.2) {
          c.group.rotation.y = Math.atan2(dx / L, dz / L);
          c.group.position.x += (dx / L) * Math.min(8, L * 2) * dt;
          c.group.position.z += (dz / L) * Math.min(8, L * 2) * dt;
          animateHumanoid(c.parts, g.elapsed + c.phase, 1, true, dt);
        } else {
          animateHumanoid(c.parts, g.elapsed + c.phase, 0, false, dt);
        }
        // crew assist: rough up nearby cops
        for (const cop of g.cops) {
          if (cop.state !== 'dead' && dist2(cop.group.position.x, cop.group.position.z, c.group.position.x, c.group.position.z) < 9) {
            cop.hp -= dt * 16;
            if (cop.hp <= 0) { cop.state = 'dead'; cop.group.rotation.x = -Math.PI / 2; cop.group.position.y = 0.4; cop.deadT = 0; }
          }
        }
      }

      if (d.phase === 'recruit') {
        const next = d.crew.find((c) => !c.joined);
        if (next) m.setObjBeacon(next.group.position.x, next.group.position.z, 'ক্রু সদস্য');
        m.objective(`দুইজন ক্রু সদস্যকে নাও — press E next to them. (${d.recruited}/2)`);
        return;
      }

      if (d.phase === 'drive') {
        if (dist2(pp.x, pp.z, -300, -610) < 144) {
          d.phase = 'guards';
          g.suppressHeat = true;
          m.clearObjBeacon();
          m.objective('গেটের গার্ডদের পরাস্ত করো! Take out the 3 guards! (0/3)');
          for (const [gx, gz] of [[-314, -616], [-300, -622], [-286, -616]]) {
            const h = makeHuman({ shirt: '#3d3d46', pants: '#2c2c34', cap: '#1a1a22' });
            h.group.position.set(gx, 0, gz);
            g.scene.add(h.group);
            m.track({ isObj: true, mesh: h.group });
            const guard = {
              group: h.group, parts: h.parts, kind: 'guard',
              home: { x: gx, z: gz }, tgt: { x: gx, z: gz },
              state: 'idle', t: 0, speed: 5, hp: 80,
              phase: rand(0, 9), bumpCd: 0, deadT: 0, meleeCd: 0
            };
            g.npcs.push(guard); // joins npc list so player attacks can hit them
            d.guards.push(guard);
          }
        }
        return;
      }

      if (d.phase === 'guards') {
        let down = 0;
        for (const guard of d.guards) {
          if (guard.state === 'dead') { down++; continue; }
          // guards rush the player
          const gp = guard.group.position;
          const dx = pp.x - gp.x, dz = pp.z - gp.z;
          const L = Math.hypot(dx, dz) || 1;
          if (L < 35) {
            guard.state = 'idle'; // pin their NPC AI; mission drives them
            guard.group.rotation.y = smoothAngle(guard.group.rotation.y, Math.atan2(dx / L, dz / L), 7, dt);
            if (L > 1.8) {
              gp.x += (dx / L) * 5.2 * dt;
              gp.z += (dz / L) * 5.2 * dt;
              animateHumanoid(guard.parts, g.elapsed + guard.phase, 1, true, dt);
            }
            guard.meleeCd -= dt;
            if (L < 2.2 && guard.meleeCd <= 0 && !g.player.inVehicle) {
              guard.meleeCd = 1.0;
              g.damagePlayer(7, 'guard');
            }
          }
        }
        m.objective(`গেটের গার্ডদের পরাস্ত করো! Take out the guards! (${down}/3)`);
        if (down === 3) {
          d.phase = 'loot';
          m.objective('৫টা লুটের বাক্স সংগ্রহ করো — Grab the 5 glowing crates! (0/5)');
          for (let i = 0; i < 5; i++) {
            const crate = new THREE.Mesh(
              new THREE.BoxGeometry(1.1, 1.1, 1.1),
              new THREE.MeshLambertMaterial({ color: 0xffd25e, emissive: 0xcc9a20, emissiveIntensity: 0.7 })
            );
            crate.position.set(-300 + (i - 2) * 9, 0.7, -636 + (i % 2) * 8);
            g.scene.add(crate);
            m.track({ isObj: true, mesh: crate });
            d.loot.push(crate);
          }
        }
        return;
      }

      if (d.phase === 'loot') {
        for (const crate of d.loot) {
          if (!crate.visible) continue;
          crate.rotation.y += dt * 2;
          if (dist2(crate.position.x, crate.position.z, pp.x, pp.z) < 4.5) {
            crate.visible = false;
            d.lootGot++;
            g.audio.playPickup();
            m.objective(`লুট সংগ্রহ করো! Grab the crates! (${d.lootGot}/5)`);
          }
        }
        if (d.lootGot === 5) {
          d.phase = 'escape';
          g.suppressHeat = false;
          setWanted(g, 4);
          m.setTimer(240);
          m.setObjBeacon(22, 318, 'আস্তানা');
          m.objective('🚨 পালাও!! Get back to the Old Dhaka safehouse before the city locks down!');
        }
        return;
      }

      if (d.phase === 'escape') {
        if (dist2(pp.x, pp.z, 22, 318) < 36) {
          setWanted(g, 0);
          m.complete(10000);
          g.toast('🏆 শহর এখন তোমার! THE CITY IS YOURS. সব মিশন শেষ — free roam unlocked.');
        }
      }
    }
  }
};
