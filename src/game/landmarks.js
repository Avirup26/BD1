// Hand-built Dhaka landmarks assembled from Three.js primitives.
import * as THREE from 'three';
import { addCollider } from './colliders.js';
import { parliamentTexture, signTexture } from './textures.js';
import { rand } from './utils.js';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

function box(group, x, y, z, w, h, d, color, rotY = 0, collide = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  if (collide) {
    // conservative AABB for rotated boxes
    const ex = Math.abs(Math.cos(rotY)) * w + Math.abs(Math.sin(rotY)) * d;
    const ez = Math.abs(Math.sin(rotY)) * w + Math.abs(Math.cos(rotY)) * d;
    addCollider(x, z, ex, ez, y + h / 2);
  }
  return m;
}

function cyl(group, x, y, z, rTop, rBot, h, color, collide = true, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), lambert(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  if (collide) addCollider(x, z, rBot * 2, rBot * 2, y + h / 2);
  return m;
}

function dome(group, x, y, z, r, color) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    lambert(color)
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

function minaret(group, x, z, h, color = '#e8e2d4') {
  cyl(group, x, h / 2, z, 0.7, 1.1, h, color);
  dome(group, x, h, z, 1.2, '#cfc6b0');
}

// -------------------------------------------------- Lalbagh Fort (-50, 420)
function buildLalbagh(scene) {
  const g = new THREE.Group();
  const C = '#b06a48', cx = -50, cz = 420, hw = 38, hd = 30, wallH = 7;
  // four walls with a south gate gap
  box(g, cx, wallH / 2, cz - hd, hw * 2, wallH, 2.4, C);                    // north
  box(g, cx - hw, wallH / 2, cz, 2.4, wallH, hd * 2, C);                    // west
  box(g, cx + hw, wallH / 2, cz, 2.4, wallH, hd * 2, C);                    // east
  box(g, cx - hw / 2 - 7, wallH / 2, cz + hd, hw - 14, wallH, 2.4, C);      // south-left
  box(g, cx + hw / 2 + 7, wallH / 2, cz + hd, hw - 14, wallH, 2.4, C);      // south-right
  // octagonal corner bastions
  for (const [bx, bz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
    cyl(g, cx + bx, 5, cz + bz, 3.4, 3.8, 10, '#a35f40', true, 8);
    dome(g, cx + bx, 10, cz + bz, 3.2, '#8a4f36');
  }
  // ornate south gate: two pillars + arch lintel + dome
  cyl(g, cx - 7, 5.5, cz + hd, 1.6, 1.8, 11, '#a35f40');
  cyl(g, cx + 7, 5.5, cz + hd, 1.6, 1.8, 11, '#a35f40');
  box(g, cx, 10.5, cz + hd, 16, 3, 3.4, '#a35f40', 0, false);
  dome(g, cx, 12, cz + hd, 2.6, '#8a4f36');
  // Pari Bibi's tomb at center
  box(g, cx, 3, cz, 13, 6, 13, '#d8cfc0');
  dome(g, cx, 6, cz, 4.2, '#3a3a40');
  for (const [mx, mz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) minaret(g, cx + mx, cz + mz, 9);
  // lawn
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 - 6, hd * 2 - 6), lambert('#5d7a4a'));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(cx, 0.02, cz);
  lawn.receiveShadow = true;
  g.add(lawn);
  scene.add(g);
}

// -------------------------------------------------- Ahsan Manzil (150, 458)
function buildAhsanManzil(scene) {
  const g = new THREE.Group();
  const cx = 150, cz = 458, PINK = '#E8A0B0';
  box(g, cx, 1, cz, 44, 2, 22, '#cf8d9c');                   // plinth
  box(g, cx, 6, cz, 38, 8, 16, PINK);                        // main block
  box(g, cx, 11, cz, 14, 4, 14, PINK, 0, false);             // dome drum
  dome(g, cx, 13, cz, 6, '#c87890');                         // the famous dome
  for (let i = -3; i <= 3; i++) cyl(g, cx + i * 5, 4, cz - 8.5, 0.5, 0.5, 8, '#f5e8ec', false, 8);
  box(g, cx, 1.2, cz - 13, 16, 2.4, 8, '#cf8d9c');           // grand stairs toward river
  scene.add(g);
}

// -------------------------------------------------- Sadarghat terminal (100, 487)
function buildSadarghat(scene) {
  const g = new THREE.Group();
  const cx = 100, cz = 487;
  box(g, cx, 0.5, cz, 90, 1, 26, '#9a948a');                          // platform
  for (let i = -4; i <= 4; i++) cyl(g, cx + i * 10, 4, cz - 10, 0.5, 0.6, 8, '#7a766e', false, 8);
  for (let i = -4; i <= 4; i++) cyl(g, cx + i * 10, 4, cz + 10, 0.5, 0.6, 8, '#7a766e', false, 8);
  // arched shed roof: half-cylinders laid horizontally
  for (let i = -2; i <= 2; i++) {
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 17, 16, 1, true, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: '#c8473a', side: THREE.DoubleSide })
    );
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(cx + i * 18, 8, cz);
    arch.castShadow = true;
    g.add(arch);
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 6.5),
    new THREE.MeshBasicMaterial({ map: signTexture('সদরঘাট লঞ্চ টার্মিনাল', 'Sadarghat Launch Terminal', '#0e3a5c', '#ffffff') })
  );
  sign.position.set(cx, 13.5, cz - 13.1);
  sign.rotation.y = Math.PI;
  g.add(sign);
  // walkable piers out into the river (no colliders — player walks on them)
  for (const px of [70, 100, 130]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 38), lambert('#6e5a40'));
    pier.position.set(px, 0.35, 510);
    pier.receiveShadow = true;
    g.add(pier);
  }
  addCollider(cx, cz, 90, 4, 2); // back edge railing only
  scene.add(g);
}

// -------------------------------------------------- Parliament (-450, -40)
function buildParliament(scene) {
  const g = new THREE.Group();
  const cx = -450, cz = -40;
  const mat = new THREE.MeshLambertMaterial({ map: parliamentTexture() });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(180, 160), lambert('#5a7548'));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(cx, 0.02, cz);
  lawn.receiveShadow = true;
  g.add(lawn);
  // cruciform mass
  const a = new THREE.Mesh(new THREE.BoxGeometry(56, 30, 34), mat);
  a.position.set(cx, 15, cz); a.castShadow = true; a.receiveShadow = true; g.add(a);
  const b = new THREE.Mesh(new THREE.BoxGeometry(34, 30, 56), mat);
  b.position.set(cx, 15, cz); b.castShadow = true; b.receiveShadow = true; g.add(b);
  addCollider(cx, cz, 56, 56, 30);
  // corner drums + central chamber drum
  for (const [dx, dz] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 26, 18), mat);
    c.position.set(cx + dx, 13, cz + dz); c.castShadow = true; g.add(c);
    addCollider(cx + dx, cz + dz, 18, 18, 26);
  }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 10, 20), mat);
  drum.position.set(cx, 35, cz); drum.castShadow = true; g.add(drum);
  scene.add(g);
}

// -------------------------------------------------- Baitul Mukarram (182, 192)
function buildBaitul(scene) {
  const g = new THREE.Group();
  const cx = 182, cz = 192;
  box(g, cx, 1, cz, 34, 2, 34, '#cfcabc');
  box(g, cx, 11, cz, 26, 20, 26, '#f0ece2'); // the white cube
  box(g, cx, 21.6, cz, 27.5, 1.2, 27.5, '#d8d2c4', 0, false);
  minaret(g, cx + 17, cz + 12, 30, '#f0ece2');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshBasicMaterial({ map: signTexture('বায়তুল মোকাররম', 'National Mosque', '#0e5e36', '#ffffff') })
  );
  sign.position.set(cx, 4.5, cz - 17.2);
  sign.rotation.y = Math.PI;
  g.add(sign);
  scene.add(g);
}

// -------------------------------------------------- Shahbag museum (0, 232)
function buildMuseum(scene) {
  const g = new THREE.Group();
  box(g, 0, 5, 232, 26, 10, 16, '#c9b8a0');
  for (let i = -2; i <= 2; i++) cyl(g, i * 5, 4, 223.5, 0.6, 0.6, 8, '#e6dcc8', false, 8);
  box(g, 0, 10.8, 232, 28, 1.6, 18, '#a8987e', 0, false);
  scene.add(g);
}

// -------------------------------------------------- Shapla Chattar (100, 100)
function buildShapla(scene) {
  const g = new THREE.Group();
  const cx = 100, cz = 100;
  cyl(g, cx, 0.8, cz, 6.5, 7, 1.6, '#b8b2a4', false, 24);
  // water-lily petals: scaled spheres leaning outward
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), lambert('#e8e0d2'));
    petal.scale.set(1.1, 3.4, 0.5);
    petal.position.set(cx + Math.cos(a) * 2.6, 4, cz + Math.sin(a) * 2.6);
    petal.rotation.y = -a + Math.PI / 2;
    petal.rotation.x = 0.35;
    petal.castShadow = true;
    g.add(petal);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), lambert('#d4c870'));
  core.position.set(cx, 5.2, cz);
  g.add(core);
  scene.add(g);
}

// -------------------------------------------------- Jamuna Future Park (-300, -652)
function buildMall(scene) {
  const g = new THREE.Group();
  const cx = -300, cz = -652;
  box(g, cx, 9, cz, 84, 18, 54, '#ded6c8');
  box(g, cx, 19.5, cz, 60, 3, 40, '#c8bfae', 0, false);
  // glass entrance
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(30, 12, 2),
    new THREE.MeshPhongMaterial({ color: 0x6fa8d8, transparent: true, opacity: 0.55, shininess: 90 })
  );
  glass.position.set(cx, 6, cz + 28.2);
  g.add(glass);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 7),
    new THREE.MeshBasicMaterial({ map: signTexture('যমুনা ফিউচার পার্ক', 'Jamuna Future Park', '#5d2a7a', '#ffd25e') })
  );
  sign.position.set(cx, 15, cz + 27.3);
  g.add(sign);
  // gate pillars (heist breach point)
  cyl(g, cx - 14, 2.5, cz + 44, 0.8, 0.9, 5, '#8d8d92');
  cyl(g, cx + 14, 2.5, cz + 44, 0.8, 0.9, 5, '#8d8d92');
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), lambert('#3a3a3c'));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(cx, 0.03, cz + 44);
  lot.receiveShadow = true;
  g.add(lot);
  scene.add(g);
}

// -------------------------------------------------- Airport (-155, -712)
function buildAirport(scene) {
  const g = new THREE.Group();
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(360, 28), lambert('#2e2e30'));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-155, 0.03, -730);
  runway.receiveShadow = true;
  g.add(runway);
  for (let i = -8; i <= 8; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), lambert('#d8d8d0'));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-155 + i * 20, 0.04, -730);
    g.add(stripe);
  }
  box(g, -155, 6, -672, 70, 12, 18, '#bcc8d4'); // terminal
  cyl(g, -100, 11, -672, 1.6, 2.2, 22, '#9aa6b2'); // control tower
  box(g, -100, 23.5, -672, 7, 4, 7, '#3d4b5c');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 5),
    new THREE.MeshBasicMaterial({ map: signTexture('হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর', 'Intl Airport', '#103a5c', '#ffffff') })
  );
  sign.position.set(-155, 10, -662.8);
  g.add(sign);
  scene.add(g);
}

// -------------------------------------------------- Uttara overpass (decorative)
function buildOverpass(scene) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 190), lambert('#4a4a4e'));
  deck.position.set(-200, 8, -500);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);
  for (let z = -580; z <= -420; z += 32) {
    cyl(g, -206, 4, z, 1, 1.2, 8, '#5a5a5e');
    cyl(g, -194, 4, z, 1, 1.2, 8, '#5a5a5e');
  }
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 190), lambert('#6a6a70'));
    rail.position.set(-200 + side * 6.8, 9, -500);
    g.add(rail);
  }
  scene.add(g);
}

// -------------------------------------------------- gameplay buildings
function buildGameplaySpots(scene) {
  const g = new THREE.Group();
  // Mirpur chop shop
  box(g, -400, 4, 52, 26, 8, 20, '#7a5a42');
  const cs = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: signTexture('গ্যারেজ — চপ শপ', 'Chop Shop', '#5c1d1d', '#ffd25e') })
  );
  cs.position.set(-400, 7, 62.2);
  g.add(cs);
  // Old Dhaka safehouse
  box(g, 22, 4.5, 305, 16, 9, 14, '#C4935A');
  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({ map: signTexture('নিরাপদ আস্তানা', 'Safehouse', '#1d4a2a', '#ffffff') })
  );
  sh.position.set(22, 7.5, 312.2);
  g.add(sh);
  // Dhaka Medical (respawn point)
  box(g, 60, 9, 222, 30, 18, 18, '#e8e4da');
  const hp = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshBasicMaterial({ map: signTexture('ঢাকা মেডিকেল হাসপাতাল', 'Dhaka Medical', '#b01818', '#ffffff') })
  );
  hp.position.set(60, 13, 231.2);
  g.add(hp);
  // Motijheel police HQ (busted respawn)
  box(g, 160, 7, 60, 24, 14, 16, '#3d4b5c');
  const ps = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('পুলিশ', 'Police HQ', '#10325c', '#ffffff') })
  );
  ps.position.set(160, 10.5, 68.2);
  g.add(ps);
  scene.add(g);
}

export function buildLandmarks(scene) {
  buildLalbagh(scene);
  buildAhsanManzil(scene);
  buildSadarghat(scene);
  buildParliament(scene);
  buildBaitul(scene);
  buildMuseum(scene);
  buildShapla(scene);
  buildMall(scene);
  buildAirport(scene);
  buildOverpass(scene);
  buildGameplaySpots(scene);
}
