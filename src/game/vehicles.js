// Vehicle factories (CNG, rickshaw, bus, moto, Prado, trucks, boats, police,
// helicopter), traffic AI, player driving physics, and enter/exit logic.
import * as THREE from 'three';
import { VEHICLE_SPECS } from './constants.js';
import { resolveCircle } from './colliders.js';
import { canopyTexture, busDestTexture, signTexture } from './textures.js';
import { rand, pick, clamp, dist2, smoothAngle, smoothTo } from './utils.js';
import { makeHuman, killNPC, bumpNPC } from './characters.js';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
const POLICE_TYPES = new Set(['police', 'policeMoto', 'rab', 'policeBoat']);

function wheelMesh(r, w, color = 0x16161a) {
  const geo = new THREE.CylinderGeometry(r, r, w, 12);
  geo.rotateZ(Math.PI / 2); // axle along local X so rotation.x rolls it
  const m = new THREE.Mesh(geo, lambert(color));
  m.castShadow = true;
  return m;
}

function headlight(group, x, y, z, color = 0xfff2c0) {
  const s = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x665c33, emissive: 0x000000 })
  );
  s.position.set(x, y, z);
  s.userData.lightColor = color;
  group.add(s);
  return s;
}

// ----------------------------------------------------------------- builders
function buildCNG(parts) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 3.4), lambert('#00A550'));
  body.position.y = 1.35;
  body.castShadow = true;
  g.add(body);
  parts.body = body;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 2.9), lambert('#FFD700'));
  roof.position.set(0, 2.32, -0.2);
  g.add(roof);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.7), lambert('#00914a'));
  hood.position.set(0, 0.95, 1.95);
  g.add(hood);
  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.1),
    new THREE.MeshPhongMaterial({ color: 0x9cc8e8, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  shield.position.set(0, 1.85, 1.45);
  shield.rotation.x = -0.18;
  g.add(shield);
  // cage grills on the sides (CNGs in Dhaka have caged passenger cabins)
  for (const side of [-1, 1]) {
    const grill = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x1d4a32, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    grill.rotation.y = Math.PI / 2;
    grill.position.set(side * 1.21, 1.5, -0.3);
    g.add(grill);
  }
  const fw = wheelMesh(0.45, 0.35);
  fw.position.set(0, 0.45, 1.75);
  const steer = new THREE.Group();
  steer.position.copy(fw.position);
  fw.position.set(0, 0, 0);
  steer.add(fw);
  g.add(steer);
  parts.steers = [steer];
  parts.wheels = [fw];
  for (const side of [-1, 1]) {
    const w = wheelMesh(0.45, 0.35);
    w.position.set(side * 1.0, 0.45, -1.25);
    g.add(w);
    parts.wheels.push(w);
  }
  parts.lights = [headlight(g, -0.5, 1.2, 2.32), headlight(g, 0.5, 1.2, 2.32)];
  parts.exhaust = new THREE.Vector3(0.6, 0.45, -1.8);
  return g;
}

function buildRickshaw(parts) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.4), lambert('#8a8f98'));
  frame.position.y = 0.7;
  g.add(frame);
  parts.body = frame;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.35, 0.95), lambert('#c0392b'));
  seat.position.set(0, 1.05, -0.55);
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.95, 0.16), lambert('#a93226'));
  back.position.set(0, 1.6, -1.0);
  g.add(back);
  // colorful floral art panel on the back — classic Dhaka rickshaw
  const art = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.85), new THREE.MeshBasicMaterial({ map: canopyTexture() }));
  art.position.set(0, 1.6, -1.09);
  art.rotation.y = Math.PI;
  g.add(art);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.9), new THREE.MeshLambertMaterial({ map: canopyTexture() }));
  canopy.position.set(0, 2.5, -0.5);
  canopy.castShadow = true;
  g.add(canopy);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), lambert('#8a8f98'));
    strut.position.set(side * 0.72, 1.8, -1.0);
    g.add(strut);
  }
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.5), lambert('#241f1a'));
  saddle.position.set(0, 1.15, 0.45);
  g.add(saddle);
  const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), lambert('#8a8f98'));
  hb.rotation.z = Math.PI / 2;
  hb.position.set(0, 1.35, 1.05);
  g.add(hb);
  const fw = wheelMesh(0.5, 0.12, 0x2c2c30);
  const steer = new THREE.Group();
  steer.position.set(0, 0.5, 1.1);
  steer.add(fw);
  g.add(steer);
  parts.steers = [steer];
  parts.wheels = [fw];
  for (const side of [-1, 1]) {
    const w = wheelMesh(0.55, 0.12, 0x2c2c30);
    w.position.set(side * 0.78, 0.55, -0.55);
    g.add(w);
    parts.wheels.push(w);
  }
  parts.lights = [];
  return g;
}

function buildBus(parts) {
  const g = new THREE.Group();
  const color = pick(['#D42B2B', '#1A5FA8']);
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 17), lambert(color));
  body.position.y = 2.4;
  body.castShadow = true;
  g.add(body);
  parts.body = body;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 17), lambert('#d8d4c8'));
  roof.position.y = 4.1;
  g.add(roof);
  for (const side of [-1, 1]) {
    const windows = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.0, 14),
      new THREE.MeshPhongMaterial({ color: 0x88aacc, transparent: true, opacity: 0.55 })
    );
    windows.position.set(side * 3.01, 3.1, 0.5);
    g.add(windows);
  }
  const dest = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.6), new THREE.MeshBasicMaterial({ map: busDestTexture() }));
  dest.position.set(0, 3.6, 8.56);
  g.add(dest);
  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.4),
    new THREE.MeshPhongMaterial({ color: 0x9cc8e8, transparent: true, opacity: 0.5 })
  );
  windshield.position.set(0, 2.9, 8.52);
  g.add(windshield);
  parts.wheels = [];
  parts.steers = [];
  for (const zz of [6, 0, -6]) {
    for (const side of [-1, 1]) {
      const w = wheelMesh(0.8, 0.5);
      if (zz === 6) {
        const steer = new THREE.Group();
        steer.position.set(side * 2.6, 0.8, zz);
        steer.add(w);
        g.add(steer);
        parts.steers.push(steer);
        parts.wheels.push(w);
      } else {
        w.position.set(side * 2.6, 0.8, zz);
        g.add(w);
        parts.wheels.push(w);
      }
    }
  }
  parts.lights = [headlight(g, -2, 1.4, 8.55), headlight(g, 2, 1.4, 8.55)];
  parts.exhaust = new THREE.Vector3(-2.4, 0.7, -8.6);
  return g;
}

function buildMoto(parts, color = null) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 1.9), lambert('#1a1a1e'));
  frame.position.y = 0.85;
  g.add(frame);
  parts.body = frame;
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.65), lambert(color || pick(['#c0392b', '#1a5fa8', '#1a1a1e', '#d4a017'])));
  tank.position.set(0, 1.1, 0.32);
  tank.castShadow = true;
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.8), lambert('#241f1a'));
  seat.position.set(0, 1.06, -0.42);
  g.add(seat);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 5), lambert('#55585e'));
  post.position.set(0, 1.25, 0.78);
  post.rotation.x = 0.3;
  g.add(post);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 5), lambert('#55585e'));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.5, 0.7);
  g.add(bar);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 6), lambert('#9aa0a8'));
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.22, 0.55, -0.6);
  g.add(exhaust);
  const fw = wheelMesh(0.42, 0.14);
  const steer = new THREE.Group();
  steer.position.set(0, 0.42, 0.85);
  steer.add(fw);
  g.add(steer);
  parts.steers = [steer];
  const rw = wheelMesh(0.42, 0.16);
  rw.position.set(0, 0.42, -0.85);
  g.add(rw);
  parts.wheels = [fw, rw];
  parts.lights = [headlight(g, 0, 1.3, 0.95)];
  parts.exhaust = new THREE.Vector3(0.22, 0.5, -1.1);
  return g;
}

function buildPrado(parts, bodyColor = null) {
  const g = new THREE.Group();
  const color = bodyColor || pick(['#f0f0f0', '#c8ccd2', '#1A1A1A']);
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 7.4), lambert(color));
  body.position.y = 1.35;
  body.castShadow = true;
  g.add(body);
  parts.body = body;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.15, 4.4), lambert(color));
  cabin.position.set(0, 2.6, -0.5);
  cabin.castShadow = true;
  g.add(cabin);
  for (const side of [-1, 1]) {
    const tinted = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.85, 4.0),
      new THREE.MeshPhongMaterial({ color: 0x1a2a44, transparent: true, opacity: 0.8, shininess: 90 })
    );
    tinted.position.set(side * 1.62, 2.65, -0.5);
    g.add(tinted);
  }
  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.9),
    new THREE.MeshPhongMaterial({ color: 0x223a5c, transparent: true, opacity: 0.75 })
  );
  windshield.position.set(0, 2.6, 1.76);
  windshield.rotation.x = -0.25;
  g.add(windshield);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 0.15), lambert('#3a3d42'));
  grille.position.set(0, 1.3, 3.72);
  g.add(grille);
  parts.wheels = [];
  parts.steers = [];
  for (const zz of [2.4, -2.4]) {
    for (const side of [-1, 1]) {
      const w = wheelMesh(0.62, 0.5);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.52, 8), lambert('#b8bcc4'));
      rim.rotation.z = Math.PI / 2;
      w.add(rim);
      if (zz > 0) {
        const steer = new THREE.Group();
        steer.position.set(side * 1.55, 0.62, zz);
        steer.add(w);
        g.add(steer);
        parts.steers.push(steer);
        parts.wheels.push(w);
      } else {
        w.position.set(side * 1.55, 0.62, zz);
        g.add(w);
        parts.wheels.push(w);
      }
    }
  }
  parts.lights = [headlight(g, -1.1, 1.5, 3.74), headlight(g, 1.1, 1.5, 3.74)];
  parts.exhaust = new THREE.Vector3(1.2, 0.5, -3.8);
  return g;
}

function buildTruck(parts, army = false) {
  const g = new THREE.Group();
  const cabColor = army ? '#4a5536' : pick(['#1a5fa8', '#c0392b', '#d4a017']);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 2.4), lambert(cabColor));
  cab.position.set(0, 2.05, 2.9);
  cab.castShadow = true;
  g.add(cab);
  parts.body = cab;
  const bed = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.6, 5.6), lambert(army ? '#3d472c' : '#7a5c3e'));
  bed.position.set(0, 2.2, -1.2);
  bed.castShadow = true;
  g.add(bed);
  if (!army) {
    // truck-art style painted panel
    const art = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.0), new THREE.MeshBasicMaterial({ map: canopyTexture() }));
    art.position.set(0, 2.2, -4.01);
    art.rotation.y = Math.PI;
    g.add(art);
  }
  parts.wheels = [];
  parts.steers = [];
  for (const zz of [2.6, -0.4, -2.6]) {
    for (const side of [-1, 1]) {
      const w = wheelMesh(0.75, 0.5);
      if (zz === 2.6) {
        const steer = new THREE.Group();
        steer.position.set(side * 1.45, 0.75, zz);
        steer.add(w);
        g.add(steer);
        parts.steers.push(steer);
        parts.wheels.push(w);
      } else {
        w.position.set(side * 1.45, 0.75, zz);
        g.add(w);
        parts.wheels.push(w);
      }
    }
  }
  parts.lights = [headlight(g, -1, 1.2, 4.12), headlight(g, 1, 1.2, 4.12)];
  parts.exhaust = new THREE.Vector3(-1.4, 1.0, -4.2);
  return g;
}

function buildBoat(parts, police = false) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 7), lambert(police ? '#e8ecf0' : '#f0eee6'));
  hull.position.y = 0.55;
  hull.castShadow = true;
  g.add(hull);
  parts.body = hull;
  const bow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.6), lambert(police ? '#e8ecf0' : '#f0eee6'));
  bow.position.set(0, 0.55, 3.9);
  bow.scale.set(0.7, 0.8, 1);
  g.add(bow);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.25, 7.02), lambert(police ? '#10325c' : '#c0392b'));
  stripe.position.y = 0.85;
  g.add(stripe);
  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.8),
    new THREE.MeshPhongMaterial({ color: 0x9cc8e8, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  shield.position.set(0, 1.5, 1.6);
  shield.rotation.x = -0.4;
  g.add(shield);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.6), lambert('#2c2c30'));
  engine.position.set(0, 0.9, -3.4);
  g.add(engine);
  if (police) {
    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2244aa, emissive: 0x0000ff, emissiveIntensity: 0.6 })
    );
    beacon.position.set(0, 1.85, 0.5);
    g.add(beacon);
    parts.siren = [beacon];
  }
  parts.wheels = [];
  parts.steers = [];
  parts.lights = [headlight(g, 0, 1.0, 4.4)];
  return g;
}

function buildPoliceCar(parts) {
  const g = buildPrado(parts, '#f2f4f6');
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.4, 7.45), lambert('#10325c'));
  stripe.position.y = 1.5;
  g.add(stripe);
  for (const side of [-1, 1]) {
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.6),
      new THREE.MeshBasicMaterial({ map: signTexture('পুলিশ', 'POLICE', '#f2f4f6', '#10325c') })
    );
    tag.rotation.y = side * Math.PI / 2;
    tag.position.set(side * 1.74, 2.0, -0.2);
    g.add(tag);
  }
  const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.45), new THREE.MeshLambertMaterial({ color: 0xaa2222, emissive: 0xff0000, emissiveIntensity: 0 }));
  barR.position.set(-0.4, 3.3, -0.5);
  const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.45), new THREE.MeshLambertMaterial({ color: 0x2222aa, emissive: 0x0000ff, emissiveIntensity: 0 }));
  barB.position.set(0.4, 3.3, -0.5);
  g.add(barR, barB);
  parts.siren = [barR, barB];
  return g;
}

function buildRab(parts) {
  const g = buildPrado(parts, '#141414');
  for (const side of [-1, 1]) {
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.55),
      new THREE.MeshBasicMaterial({ map: signTexture('র‍্যাব', 'RAB', '#141414', '#ffd25e') })
    );
    tag.rotation.y = side * Math.PI / 2;
    tag.position.set(side * 1.74, 1.5, -0.2);
    g.add(tag);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, 0.45), new THREE.MeshLambertMaterial({ color: 0x2244aa, emissive: 0x0033ff, emissiveIntensity: 0 }));
  bar.position.set(0, 3.3, -0.5);
  g.add(bar);
  parts.siren = [bar];
  return g;
}

export function buildHelicopter(scene) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 5.4), lambert('#1c1f24'));
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 10, 8),
    new THREE.MeshPhongMaterial({ color: 0x4a6a8a, transparent: true, opacity: 0.7 })
  );
  nose.position.set(0, 0.2, 2.7);
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4.6), lambert('#1c1f24'));
  tail.position.set(0, 0.5, -4.6);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 1), lambert('#5c1d1d'));
  fin.position.set(0, 1.4, -6.6);
  g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.1, 0.55), lambert('#2c2c30'));
  rotor.position.y = 1.5;
  g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.3), lambert('#2c2c30'));
  tailRotor.position.set(0.4, 0.6, -6.6);
  g.add(tailRotor);
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4), lambert('#55585e'));
    skid.position.set(side * 1.1, -1.4, 0);
    g.add(skid);
  }
  const spot = new THREE.SpotLight(0xfff0c8, 0, 130, 0.32, 0.45, 1.2);
  spot.position.set(0, -1, 1);
  const spotTarget = new THREE.Object3D();
  g.add(spot, spotTarget);
  spot.target = spotTarget;
  g.position.set(0, 60, 0);
  scene.add(g);
  return { group: g, rotor, tailRotor, spot, spotTarget, fireCd: 0, angle: 0 };
}

const BUILDERS = {
  cng: buildCNG, rickshaw: buildRickshaw, bus: buildBus, moto: buildMoto,
  prado: buildPrado, truck: buildTruck, boat: buildBoat,
  policeBoat: (p) => buildBoat(p, true), police: buildPoliceCar,
  policeMoto: (p) => buildMoto(p, '#f2f4f6'), rab: buildRab
};

export function makeVehicle(game, type, x, z, heading = 0, opts = {}) {
  const parts = {};
  const group = BUILDERS[type](parts, opts.color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  game.scene.add(group);
  const spec = VEHICLE_SPECS[type];
  const v = {
    type, group, parts, spec,
    heading, speed: 0, steerVis: 0,
    hp: spec.hp, exploded: false,
    route: opts.route || null, routeIdx: 1, routeDir: 1,
    cruise: spec.maxSpeed * rand(0.32, 0.5),
    police: POLICE_TYPES.has(type),
    isBoat: !!spec.boat,
    driver: null, occupied: false,
    smokeT: rand(0, 0.4), sirenPhase: rand(0, 9),
    bodyBaseY: parts.body ? parts.body.position.y : 0
  };
  if (opts.driver) {
    const d = makeHuman(opts.cop ? { shirt: '#2c3e50', pants: '#10325c', cap: '#10325c' } : { lungi: type === 'rickshaw' });
    d.group.position.set(spec.seat[0] - (type === 'prado' || type === 'police' || type === 'rab' || type === 'bus' || type === 'truck' ? 1.6 : 0), spec.seat[1] - 0.95, spec.seat[2]);
    d.group.scale.setScalar(0.95);
    d.parts.legL.visible = false;
    d.parts.legR.visible = false;
    v.driver = d.group;
    group.add(d.group);
  }
  game.vehicles.push(v);
  return v;
}

// ----------------------------------------------------------------- traffic
export function spawnTraffic(game) {
  const routes = game.world.routes;
  const wide = routes.filter((r) => r.w >= 22);
  const mid = routes.filter((r) => r.w >= 14 && r.w < 22);
  const narrow = routes.filter((r) => r.w < 14);

  const plan = [
    ...Array(10).fill(['cng', wide]), ...Array(4).fill(['cng', mid]),
    ...Array(4).fill(['bus', wide]),
    ...Array(5).fill(['moto', wide]), ...Array(2).fill(['moto', mid]),
    ...Array(4).fill(['prado', wide]),
    ...Array(2).fill(['truck', wide]),
    ...Array(4).fill(['rickshaw', narrow.length ? narrow : mid]), ...Array(3).fill(['rickshaw', mid])
  ];
  for (const [type, pool] of plan) {
    if (!pool.length) continue;
    const route = pick(pool);
    const i = Math.floor(rand(0, route.pts.length - 1));
    const [ax, az] = route.pts[i];
    const [bx, bz] = route.pts[Math.min(i + 1, route.pts.length - 1)];
    const t = Math.random();
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const heading = Math.atan2(bx - ax, bz - az);
    const v = makeVehicle(game, type, x, z, heading, { route, driver: true });
    v.routeIdx = Math.min(i + 1, route.pts.length - 1);
  }

  // parked vehicles for the player to grab
  const parked = [
    ['cng', 62, 432, Math.PI], ['cng', -490, -122, 0], ['cng', 182, 202, Math.PI / 2],
    ['moto', 138, 118, 0], ['moto', 26, 332, Math.PI / 2], ['moto', -282, -588, 0],
    ['rickshaw', 58, 342, Math.PI], ['rickshaw', -22, 362, 0.4],
    ['prado', 422, -162, 0], ['boat', 92, 500, -Math.PI / 2]
  ];
  for (const [type, x, z, h] of parked) makeVehicle(game, type, x, z, h);
}

function obstacleAhead(game, v) {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  const px = v.group.position.x, pz = v.group.position.z;
  const look = 7 + v.spec.radius * 2;
  const check = (x, z, r) => {
    const dx = x - px, dz = z - pz;
    const d = Math.hypot(dx, dz);
    if (d > look + r || d < 0.01) return false;
    return (dx * fx + dz * fz) / d > 0.72;
  };
  const pp = game.player.group.position;
  if (!game.player.inVehicle && check(pp.x, pp.z, 1)) return true;
  for (const o of game.vehicles) {
    if (o === v || o.exploded) continue;
    if (check(o.group.position.x, o.group.position.z, o.spec.radius)) return true;
  }
  return false;
}

function followRoute(game, v, dt) {
  const pts = v.route.pts;
  let [tx, tz] = pts[v.routeIdx];
  const pos = v.group.position;
  let dx = tx - pos.x, dz = tz - pos.z;
  let d = Math.hypot(dx, dz);
  if (d < 9) {
    v.routeIdx += v.routeDir;
    if (v.routeIdx >= pts.length || v.routeIdx < 0) {
      v.routeDir *= -1;
      v.routeIdx += v.routeDir * 2;
      v.routeIdx = clamp(v.routeIdx, 0, pts.length - 1);
    }
    [tx, tz] = pts[v.routeIdx];
    dx = tx - pos.x; dz = tz - pos.z;
    d = Math.hypot(dx, dz) || 1;
  }
  const desired = Math.atan2(dx / d, dz / d);
  v.heading = smoothAngle(v.heading, desired, 2.2, dt);
  let headErr = Math.abs(((desired - v.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const blocked = obstacleAhead(game, v);
  const target = blocked ? 0 : v.cruise * (headErr > 0.8 ? 0.35 : 1);
  v.speed = smoothTo(v.speed, target, blocked ? 5 : 1.2, dt);
  if (blocked && Math.random() < dt * 0.25 && dist2(pos.x, pos.z, game.player.group.position.x, game.player.group.position.z) < 90 * 90) {
    game.audio.playHorn();
  }
  v.steerVis = clamp((desired - v.heading) * 2, -0.5, 0.5);
}

// --------------------------------------------------------- player driving
export function driveVehicle(game, v, dt) {
  const k = game.input;
  const spec = v.spec;
  const flooded = game.state.flood > 0.2 && !v.isBoat;
  const maxFwd = spec.maxSpeed * (flooded ? 0.55 : 1);

  let throttle = 0;
  if (k.fwd) throttle = 1;
  else if (k.back) throttle = v.speed > 0.5 ? -1.6 : -0.6; // brake harder than reverse
  v.speed += throttle * spec.accel * dt;
  v.speed *= 1 - (k.brake ? 2.4 : 0.45) * dt;
  v.speed = clamp(v.speed, -maxFwd * 0.35, maxFwd);

  const steer = (k.left ? 1 : 0) - (k.right ? 1 : 0);
  const speedFactor = clamp(v.speed / 9, -1, 1);
  v.heading += steer * spec.turn * speedFactor * dt;
  v.steerVis = smoothTo(v.steerVis, steer * 0.45, 8, dt);

  // lean on turns (CNG/moto charm)
  if (v.parts.body && (v.type === 'cng' || v.type === 'moto')) {
    v.parts.body.rotation.z = smoothTo(v.parts.body.rotation.z, -steer * 0.1 * Math.abs(speedFactor), 6, dt);
  }
  game.audio.engineUpdate(Math.abs(v.speed) / spec.maxSpeed);

  // run-over checks
  if (Math.abs(v.speed) > 3) {
    const pos = v.group.position;
    for (const npc of game.npcs) {
      if (npc.state === 'dead') continue;
      const np = npc.group.position;
      if (dist2(np.x, np.z, pos.x, pos.z) < (spec.radius + 0.9) * (spec.radius + 0.9)) {
        if (Math.abs(v.speed) > 8) {
          killNPC(game, npc);
          game.addHeat(1);
          game.toast('পথচারী আহত! Pedestrian down!');
          game.fx.burst(np.x, 1, np.z, '#8a1818', 12, 4, 0.6);
        } else {
          bumpNPC(game, npc, false);
        }
      }
    }
  }
}

// --------------------------------------------------------- shared update
export function updateVehicles(game, dt) {
  const playerV = game.player.inVehicle;
  const pp = game.player.group.position;
  const elapsed = game.elapsed;

  for (const v of game.vehicles) {
    const pos = v.group.position;
    if (v.exploded) {
      if (v.smokeT > 0) {
        v.smokeT -= dt;
        if (Math.random() < dt * 8) game.fx.emit(pos.x, pos.y + 1.5, pos.z, rand(-0.4, 0.4), rand(1.5, 3), rand(-0.4, 0.4), 2, '#2c2a28', 1);
      }
      continue;
    }

    const isPlayerV = v === playerV;
    if (isPlayerV) {
      driveVehicle(game, v, dt);
    } else if (v.police && !v.static && game.state.wanted > 0 && !v.isBoat) {
      // chase driving: steer straight at the player
      const dx = pp.x - pos.x, dz = pp.z - pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const desired = Math.atan2(dx / d, dz / d);
      v.heading = smoothAngle(v.heading, desired, 2.4, dt);
      const target = d < 11 ? 0 : v.spec.maxSpeed * 0.78;
      v.speed = smoothTo(v.speed, target, 1.6, dt);
    } else if (v.route) {
      followRoute(game, v, dt);
    } else {
      v.speed = smoothTo(v.speed, 0, 4, dt);
    }

    // integrate motion
    if (Math.abs(v.speed) > 0.05) {
      let nx = pos.x + Math.sin(v.heading) * v.speed * dt;
      let nz = pos.z + Math.cos(v.heading) * v.speed * dt;
      nx = clamp(nx, -985, 985);
      if (v.isBoat) {
        nz = clamp(nz, 482, 616);
        if (nz <= 483 || nz >= 615) v.speed *= 0.6;
        pos.x = nx; pos.z = nz;
        pos.y = Math.sin(elapsed * 2 + v.sirenPhase) * 0.12 - 0.1;
      } else {
        nz = clamp(nz, -985, 472);
        const r = resolveCircle(nx, nz, v.spec.radius);
        if (r.hit) {
          const impact = Math.abs(v.speed);
          if (impact > 13) {
            damageVehicle(game, v, (impact - 11) * 2.2);
            game.fx.burst(r.x, 1, r.z, '#c8b89a', 10, 5, 0.5);
            if (isPlayerV) game.shake = 0.4;
          }
          v.speed *= -0.25;
        }
        pos.x = r.x; pos.z = r.z;
        // flood splash
        if (game.state.flood > 0.15 && Math.abs(v.speed) > 6 && Math.random() < dt * 12) {
          game.fx.emit(pos.x + rand(-1, 1), 0.4, pos.z + rand(-1, 1), rand(-1, 1), rand(2, 4), rand(-1, 1), 0.5, '#8a9a8a', -8);
        }
        // driving into the river drowns the vehicle
        if (pos.z > 466 && pos.z <= 472 && Math.abs(v.speed) > 2 && Math.random() < dt * 4) {
          game.audio.playSplash();
        }
      }
    }

    // wheels & steering visuals
    if (v.parts.wheels) {
      for (const w of v.parts.wheels) w.rotation.x += v.speed * dt * 1.4;
    }
    if (v.parts.steers) {
      for (const s of v.parts.steers) s.rotation.y = v.steerVis;
    }
    // suspension bob
    if (v.parts.body && !v.isBoat) {
      v.parts.body.position.y = v.bodyBaseY + Math.sin(elapsed * 15 + v.sirenPhase) * 0.02 * Math.min(1, Math.abs(v.speed) / 10);
    }
    // siren flash
    if (v.parts.siren) {
      const on = game.state.wanted > 0 || v.missionSiren;
      v.sirenPhase += dt * 9;
      v.parts.siren.forEach((s, i) => {
        s.material.emissiveIntensity = on && Math.sin(v.sirenPhase + i * Math.PI) > 0 ? 1.4 : 0.05;
      });
    }
    // exhaust smoke near the player
    if ((v.type === 'cng' || v.type === 'bus' || v.type === 'truck') && Math.abs(v.speed) > 1) {
      v.smokeT -= dt;
      if (v.smokeT <= 0 && dist2(pos.x, pos.z, pp.x, pp.z) < 80 * 80) {
        v.smokeT = 0.12;
        const e = v.parts.exhaust;
        const ex = pos.x + Math.sin(v.heading) * e.z + Math.cos(v.heading) * e.x;
        const ez = pos.z + Math.cos(v.heading) * e.z - Math.sin(v.heading) * e.x;
        game.fx.emit(ex, e.y, ez, rand(-0.3, 0.3), rand(0.6, 1.4), rand(-0.3, 0.3), 1.1, v.type === 'cng' ? '#7a8278' : '#4a4a46', 0.6);
      }
    }
  }
}

export function damageVehicle(game, v, dmg) {
  if (v.exploded) return;
  v.hp -= dmg;
  if (v.hp <= 0) explodeVehicle(game, v);
}

export function explodeVehicle(game, v) {
  if (v.exploded) return;
  v.exploded = true;
  v.speed = 0;
  v.smokeT = 12;
  const pos = v.group.position;
  game.fx.explosion(pos.x, pos.y, pos.z);
  game.audio.playExplosion();
  v.group.traverse((o) => {
    if (o.isMesh && o.material && o.material.color) {
      o.material = o.material.clone();
      o.material.color.set('#1d1b19');
      if (o.material.emissive) o.material.emissive.set('#000000');
    }
  });
  if (v.driver) { v.group.remove(v.driver); v.driver = null; }
  if (game.player.inVehicle === v) {
    game.damagePlayer(55, 'explosion');
    exitVehicle(game);
  }
  game.addHeat(2);
  // splash damage to whoever is standing close
  const pp = game.player.group.position;
  if (!game.player.inVehicle && dist2(pp.x, pp.z, pos.x, pos.z) < 64) game.damagePlayer(35, 'explosion');
  for (const npc of game.npcs) {
    const np = npc.group.position;
    if (npc.state !== 'dead' && dist2(np.x, np.z, pos.x, pos.z) < 64) killNPC(game, npc);
  }
}

// --------------------------------------------------------- enter / exit
export function nearestVehicle(game, maxDist = 4.5) {
  const pp = game.player.group.position;
  let best = null, bestD = maxDist * maxDist;
  for (const v of game.vehicles) {
    if (v.exploded) continue;
    const d = dist2(v.group.position.x, v.group.position.z, pp.x, pp.z);
    const reach = bestD + v.spec.radius * v.spec.radius;
    if (d < reach && (!best || d < bestD)) { best = v; bestD = d; }
  }
  return best;
}

export function enterVehicle(game, v) {
  const p = game.player;
  if (v.driver) {
    // carjacking: driver bails and flees
    v.group.remove(v.driver);
    v.driver = null;
    v.route = null;
    game.addHeat(1);
    game.toast('গাড়ি ছিনতাই! Carjacked!');
  }
  v.route = null;
  v.occupied = true;
  p.inVehicle = v;
  v.group.add(p.group);
  p.group.position.set(v.spec.seat[0], v.spec.seat[1] - 0.95, v.spec.seat[2]);
  p.group.rotation.set(0, 0, 0);
  p.parts.legL.visible = false;
  p.parts.legR.visible = false;
  p.parts.armL.rotation.x = -0.7;
  p.parts.armR.rotation.x = -0.7;
  game.audio.engineStart(v.spec.engine);
  if (v.spec.engine === 0) game.audio.playBell();
  game.store.set({ inVehicle: v.type });
}

export function exitVehicle(game) {
  const p = game.player;
  const v = p.inVehicle;
  if (!v) return;
  const side = v.heading - Math.PI / 2;
  let ex = v.group.position.x + Math.sin(side) * (v.spec.radius + 1.4);
  let ez = v.group.position.z + Math.cos(side) * (v.spec.radius + 1.4);
  const r = resolveCircle(ex, ez, 0.6);
  v.group.remove(p.group);
  game.scene.add(p.group);
  p.group.position.set(r.x, 0, r.z);
  p.group.rotation.set(0, v.heading, 0);
  p.heading = v.heading;
  p.inVehicle = null;
  v.occupied = false;
  p.parts.legL.visible = !p.lungi;
  p.parts.legR.visible = !p.lungi;
  p.parts.armL.rotation.x = 0;
  p.parts.armR.rotation.x = 0;
  game.audio.engineStop();
  game.audio.radioToggle(false);
  game.store.set({ inVehicle: null, radio: null });
}
