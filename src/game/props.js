// Street furniture: instanced trees & streetlamps, market stalls, shop signs,
// neon, billboards, embassy flags, moored boats and the moving ferry.
import * as THREE from 'three';
import { ROADS, SIGNS, BILLBOARD_ADS } from './constants.js';
import { addCollider, onRoad } from './colliders.js';
import { signTexture, billboardTexture } from './textures.js';
import { rand, randi, pick } from './utils.js';
import { offsetPolyline } from './world.js';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

// ------------------------------------------------------------ trees & lamps
export function buildTreesAndLamps(scene, world) {
  const treeSpots = [];
  const lampSpots = [];

  const treeRoads = ['Gulshan Avenue', 'Gulshan Road 27', 'Manik Mia Avenue', 'Sonargaon Janapath'];
  for (const rd of ROADS) {
    const isTreeRoad = treeRoads.includes(rd.name);
    const isMajor = rd.w >= 18;
    for (const side of [-1, 1]) {
      const line = offsetPolyline(rd.pts, (rd.w / 2 + 4) * side);
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i], [bx, bz] = line[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const step = isTreeRoad ? 15 : 24;
        for (let t = step / 2; t < len; t += step) {
          const x = ax + ((bx - ax) * t) / len;
          const z = az + ((bz - az) * t) / len;
          if (onRoad(x, z, -1)) continue;
          if (z > 460) continue; // not in the river
          if (isTreeRoad && Math.random() < 0.8) treeSpots.push([x, z]);
          else if (isMajor && Math.random() < 0.55) lampSpots.push([x, z]);
        }
      }
    }
  }
  // park clusters: Ramna near Shahbag, Chandrima by Parliament
  for (let i = 0; i < 60; i++) treeSpots.push([rand(-60, 80), rand(180, 245)]);
  for (let i = 0; i < 40; i++) treeSpots.push([rand(-540, -360), rand(-115, -60)]);

  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 4, 6);
  trunkGeo.translate(0, 2, 0);
  const canopyGeo = new THREE.SphereGeometry(2.6, 8, 6);
  canopyGeo.translate(0, 5.6, 0);
  const trunkIM = new THREE.InstancedMesh(trunkGeo, lambert('#5a4632'), treeSpots.length);
  const canopyIM = new THREE.InstancedMesh(canopyGeo, lambert('#2D6A4F'), treeSpots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const c = new THREE.Color();
  treeSpots.forEach(([x, z], i) => {
    p.set(x, 0, z);
    s.setScalar(rand(0.7, 1.5));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, Math.PI));
    m.compose(p, q, s);
    trunkIM.setMatrixAt(i, m);
    canopyIM.setMatrixAt(i, m);
    c.set('#2D6A4F').offsetHSL(rand(-0.04, 0.06), rand(-0.1, 0.1), rand(-0.06, 0.06));
    canopyIM.setColorAt(i, c);
  });
  canopyIM.castShadow = true;
  scene.add(trunkIM, canopyIM);

  const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 7.5, 6);
  poleGeo.translate(0, 3.75, 0);
  const headGeo = new THREE.SphereGeometry(0.4, 8, 6);
  headGeo.translate(0, 7.6, 0);
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: '#888478', emissive: '#000000' });
  const poleIM = new THREE.InstancedMesh(poleGeo, lambert('#3c3f44'), lampSpots.length);
  const headIM = new THREE.InstancedMesh(headGeo, lampHeadMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    p.set(x, 0, z);
    s.setScalar(1);
    q.identity();
    m.compose(p, q, s);
    poleIM.setMatrixAt(i, m);
    headIM.setMatrixAt(i, m);
  });
  scene.add(poleIM, headIM);

  world.lampSpots = lampSpots;
  world.lampHeadMat = lampHeadMat;
  // pooled real lights, repositioned each frame to the nearest lamps at night
  world.lampLights = [];
  for (let i = 0; i < 8; i++) {
    const L = new THREE.PointLight(0xffa050, 0, 32, 1.8);
    L.position.y = 7.4;
    scene.add(L);
    world.lampLights.push(L);
  }
}

// ------------------------------------------------------------ market stalls
export function buildStalls(scene) {
  const g = new THREE.Group();
  const zones = [
    { x1: -560, x2: -440, z1: -95, z2: -75, n: 14 },  // Mirpur 10
    { x1: -90, x2: 180, z1: 338, z2: 344, n: 18 },    // Islampur Road
    { x1: 60, x2: 140, z1: 458, z2: 466, n: 8 }       // Sadarghat approach
  ];
  for (const zn of zones) {
    for (let i = 0; i < zn.n; i++) {
      const x = rand(zn.x1, zn.x2), z = rand(zn.z1, zn.z2);
      if (onRoad(x, z, 0)) continue;
      const stall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2), lambert(pick(['#7a5c3e', '#6e5236', '#83664a'])));
      stall.position.set(x, 1, z);
      stall.castShadow = true;
      g.add(stall);
      const awning = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 2.4),
        new THREE.MeshLambertMaterial({ color: pick(['#c0392b', '#1e6f9f', '#d4a017', '#1d7a4f']), side: THREE.DoubleSide })
      );
      awning.position.set(x, 2.6, z + 0.8);
      awning.rotation.x = -0.5;
      g.add(awning);
      addCollider(x, z, 2.4, 2.2, 3);
    }
  }
  scene.add(g);
}

// ------------------------------------------------------------ signs & neon
export function buildSignsAndBillboards(scene, world) {
  world.neonSigns = [];
  const anchors = world.signAnchors || [];
  const used = anchors.length ? anchors : [];
  const count = Math.min(110, used.length);
  for (let i = 0; i < count; i++) {
    const a = used[Math.floor((i / count) * used.length)];
    const sg = SIGNS[i % SIGNS.length];
    const palette = pick([
      ['#0e5e36', '#ffffff'], ['#7d1d1d', '#ffd25e'], ['#0a3d62', '#ffffff'],
      ['#d4a017', '#1a1408'], ['#5d2a7a', '#ffffff']
    ]);
    const mat = new THREE.MeshBasicMaterial({ map: signTexture(sg.bn, sg.en, palette[0], palette[1]) });
    mat.color.setScalar(0.85);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.4), mat);
    // face the road: direction from building center toward the road segment
    const mx = (a.segA[0] + a.segB[0]) / 2, mz = (a.segA[1] + a.segB[1]) / 2;
    const dx = mx - a.x, dz = mz - a.z;
    const L = Math.hypot(dx, dz) || 1;
    const fw = Math.max(a.w, a.d) / 2 + 0.15;
    mesh.position.set(a.x + (dx / L) * fw, rand(3, 4.6), a.z + (dz / L) * fw);
    mesh.rotation.y = Math.atan2(dx, dz);
    scene.add(mesh);
    world.neonSigns.push({ mesh, mat, color: palette[0], phase: rand(0, Math.PI * 2) });
  }
  // pooled neon point lights
  world.neonLights = [];
  for (let i = 0; i < 6; i++) {
    const L = new THREE.PointLight(0xff4060, 0, 18, 2);
    scene.add(L);
    world.neonLights.push(L);
  }

  // billboards on poles along major roads
  const spots = [
    [-585, 120, 0.5], [-215, -350, 1.6], [115, 215, 3.1], [385, -120, 0.2],
    [-485, -250, 1.0], [-185, -585, 2.4]
  ];
  spots.forEach(([x, z, ry], i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 14, 8), lambert('#4a4d52'));
    pole.position.set(x, 7, z);
    pole.castShadow = true;
    scene.add(pole);
    const bb = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({ map: billboardTexture(BILLBOARD_ADS[i % BILLBOARD_ADS.length]), side: THREE.DoubleSide })
    );
    bb.position.set(x, 16, z);
    bb.rotation.y = ry;
    scene.add(bb);
    addCollider(x, z, 1.2, 1.2, 14);
  });
}

// ------------------------------------------------------------ embassy flags
export function buildEmbassyRow(scene) {
  const flags = ['#b22234', '#01411c', '#de2910', '#012169', '#ff9933', '#006a4e'];
  flags.forEach((color, i) => {
    const x = 455 + i * 14, z = -95;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 6), lambert('#d8d8d8'));
    pole.position.set(x, 4.5, z);
    scene.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.6),
      new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
    );
    flag.position.set(x + 1.35, 8, z);
    scene.add(flag);
  });
}

// ------------------------------------------------------------ tea stalls (heal spots)
export function buildTeaStalls(scene, world) {
  world.teaStalls = [];
  const spots = [[60, 332], [148, 62], [-478, -82]];
  for (const [x, z] of spots) {
    const hut = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), lambert('#6e5236'));
    hut.position.set(x, 1.2, z);
    hut.castShadow = true;
    scene.add(hut);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.9),
      new THREE.MeshBasicMaterial({ map: signTexture('চা স্টল', 'Tea Stall', '#d4a017', '#1a1408') })
    );
    sign.position.set(x, 2.9, z + 1.25);
    scene.add(sign);
    addCollider(x, z, 3.2, 2.6, 3);
    world.teaStalls.push({ x, z: z + 2.4 });
  }
}

// ------------------------------------------------------------ boats
export function buildBoats(scene, world) {
  world.boats = [];
  const g = new THREE.Group();

  // big launches (rocket ferries) moored at Sadarghat
  for (let i = 0; i < 3; i++) {
    const launch = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 34), lambert('#e8e6e0'));
    hull.position.y = 1.2;
    hull.castShadow = true;
    launch.add(hull);
    const deck2 = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 26), lambert('#dcd8d0'));
    deck2.position.y = 4.7;
    launch.add(deck2);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.1, 0.8, 34.1), lambert(pick(['#c0392b', '#1a5fa8', '#1d7a4f'])));
    stripe.position.y = 2.6;
    launch.add(stripe);
    // moored between the piers (piers sit at x = 70 / 100 / 130)
    const x = 85 + i * 30, z = 545;
    launch.position.set(x, 0, z);
    scene.add(launch);
    world.boats.push({ group: launch, phase: rand(0, 9), amp: 0.12 });
  }

  // small wooden dinghies scattered on the river
  for (let i = 0; i < 12; i++) {
    const dinghy = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 5), lambert('#5a4026'));
    hull.position.y = 0.2;
    dinghy.add(hull);
    const boatman = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.7, 3, 6), lambert(pick(['#c0392b', '#1e6f9f', '#e8e0d0'])));
    boatman.position.y = 1.1;
    dinghy.add(boatman);
    dinghy.position.set(rand(-700, 700), 0, rand(495, 595));
    dinghy.rotation.y = rand(0, Math.PI * 2);
    scene.add(dinghy);
    world.boats.push({ group: dinghy, phase: rand(0, 9), amp: 0.2, drift: rand(-0.4, 0.4) });
  }

  // one moving ferry crossing the map
  const ferry = new THREE.Group();
  const fh = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 26), lambert('#f0eee8'));
  fh.position.y = 1.4;
  fh.castShadow = true;
  ferry.add(fh);
  const fstripe = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.7, 26.1), lambert('#c0392b'));
  fstripe.position.y = 2.2;
  ferry.add(fstripe);
  ferry.position.set(-600, 0, 565);
  ferry.rotation.y = Math.PI / 2;
  scene.add(ferry);
  world.ferry = { group: ferry, dir: 1, phase: 0 };
  scene.add(g);
}
