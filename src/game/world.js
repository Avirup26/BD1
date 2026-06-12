// Procedural city generation: ground, Buriganga river, road network,
// per-district instanced buildings. Landmarks and street props live in
// landmarks.js / props.js and are orchestrated from Game.js.
import * as THREE from 'three';
import { ROADS, ROUNDABOUTS, DISTRICTS, DISTRICT_BUILD, EXCLUDES, WORLD } from './constants.js';
import { addCollider } from './colliders.js';
import { onRoad } from './colliders.js';
import { facadeTextures, roadTexture, groundTexture } from './textures.js';
import { rand, pick, inRect, segPointDist } from './utils.js';

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x1 && x <= d.x2 && z >= d.z1 && z <= d.z2) return d;
  }
  return null;
}

// ---------------------------------------------------------------- ground
export function buildGround(scene) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD * 2 + 400, WORLD * 2 + 400),
    new THREE.MeshLambertMaterial({ map: groundTexture() })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = -0.12;
  g.receiveShadow = true;
  scene.add(g);

  // Old Dhaka gets a continuous paved surface so the gaps between its packed
  // buildings read as alleys.
  const alley = new THREE.Mesh(
    new THREE.PlaneGeometry(310, 240),
    new THREE.MeshLambertMaterial({ color: 0x55504a })
  );
  alley.rotation.x = -Math.PI / 2;
  alley.position.set(50, -0.06, 365);
  alley.receiveShadow = true;
  scene.add(alley);

  // Gulshan green verge
  const verge = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0x5d6b4a, transparent: true, opacity: 0.55 })
  );
  verge.rotation.x = -Math.PI / 2;
  verge.position.set(400, -0.09, -200);
  scene.add(verge);
}

// ---------------------------------------------------------------- water
function makeWaterMaterial(colorHex, opacity, uniformsRef) {
  const mat = new THREE.MeshPhongMaterial({
    color: colorHex,
    shininess: 80,
    specular: 0x665c44,
    transparent: true,
    opacity
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniformsRef;
    sh.vertexShader =
      'uniform float uTime;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.z += sin(position.x * 0.05 + uTime * 0.8) * 0.3
                        + sin(position.y * 0.08 + uTime * 1.2) * 0.2;`
      );
  };
  return mat;
}

export function buildWater(scene, world) {
  world.waterTime = { value: 0 };

  // Buriganga — polluted grey-brown, spans full width along the south
  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD * 2 + 400, 160, 96, 10),
    makeWaterMaterial(0x5c4a2a, 0.88, world.waterTime)
  );
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, -0.45, 555);
  scene.add(river);

  // muddy bank strip between embankment road and water
  const bank = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD * 2 + 400, 30),
    new THREE.MeshLambertMaterial({ color: 0x6b5a3e })
  );
  bank.rotation.x = -Math.PI / 2;
  bank.position.set(0, -0.1, 467);
  scene.add(bank);

  // Gulshan Lake
  const lake = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 95, 24, 16),
    makeWaterMaterial(0x44584c, 0.85, world.waterTime)
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(350, -0.35, -262);
  scene.add(lake);

  // Hatirjheel water band
  const jheel = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 110, 32, 12),
    makeWaterMaterial(0x3e5a52, 0.85, world.waterTime)
  );
  jheel.rotation.x = -Math.PI / 2;
  jheel.rotation.z = -0.35;
  jheel.position.set(280, -0.35, -80);
  scene.add(jheel);

  // Crescent Lake by Parliament
  const crescent = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 30, 24, 4),
    makeWaterMaterial(0x4a6258, 0.85, world.waterTime)
  );
  crescent.rotation.x = -Math.PI / 2;
  crescent.position.set(-450, -0.3, 28);
  scene.add(crescent);
}

// ---------------------------------------------------------------- roads
export function buildRoads(scene, world) {
  const baseTex = roadTexture();
  const group = new THREE.Group();
  world.routes = [];

  for (const rd of ROADS) {
    for (let i = 0; i < rd.pts.length - 1; i++) {
      const [ax, az] = rd.pts[i];
      const [bx, bz] = rd.pts[i + 1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz);
      const tex = baseTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, Math.max(1, Math.round(len / 18)));
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(rd.w, len + rd.w * 0.5),
        new THREE.MeshLambertMaterial({ map: tex })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.atan2(dx, dz);
      mesh.position.set((ax + bx) / 2, 0.02, (az + bz) / 2);
      mesh.receiveShadow = true;
      // PlaneGeometry rotated -90° about X maps its +Y (length) axis onto -Z;
      // rotation.z above (applied in the plane) realigns it with the segment.
      group.add(mesh);

      // sidewalks on wide roads
      if (rd.w >= 20) {
        for (const side of [-1, 1]) {
          const sw = new THREE.Mesh(
            new THREE.PlaneGeometry(3.4, len),
            new THREE.MeshLambertMaterial({ color: 0x8e8a80 })
          );
          sw.rotation.x = -Math.PI / 2;
          sw.rotation.z = Math.atan2(dx, dz);
          const nx = (dz / len) * (rd.w / 2 + 1.7) * side;
          const nz = (-dx / len) * (rd.w / 2 + 1.7) * side;
          sw.position.set((ax + bx) / 2 + nx, 0.04, (az + bz) / 2 + nz);
          sw.receiveShadow = true;
          group.add(sw);
        }
      }
    }
    // traffic routes: two lanes (one per direction), offset from centerline
    const off = rd.w * 0.22;
    world.routes.push({ pts: offsetPolyline(rd.pts, off), w: rd.w });
    world.routes.push({ pts: offsetPolyline([...rd.pts].reverse(), off), w: rd.w });
  }

  for (const rb of ROUNDABOUTS) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(rb.r, 28),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(rb.x, 0.025, rb.z);
    disc.receiveShadow = true;
    group.add(disc);
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(rb.r * 0.45, rb.r * 0.45, 0.5, 20),
      new THREE.MeshLambertMaterial({ color: 0x4a6741 })
    );
    island.position.set(rb.x, 0.25, rb.z);
    group.add(island);
    addCollider(rb.x, rb.z, rb.r * 0.9, rb.r * 0.9, 1);
  }
  scene.add(group);
}

export function offsetPolyline(pts, off) {
  return pts.map(([x, z], i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    return [x + (dz / len) * off, z + (-dx / len) * off];
  });
}

// ---------------------------------------------------------------- buildings
export function buildBuildings(scene, world) {
  world.buildingSets = [];
  world.signAnchors = []; // facades near roads, used by props.js for shop signs

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const tankGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.4, 8);
  const tankMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1e });
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpP = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const tmpC = new THREE.Color();

  for (const d of DISTRICTS) {
    const cfg = DISTRICT_BUILD[d.id];
    if (!cfg) continue;
    const spots = [];
    const tanks = [];

    for (let x = d.x1 + cfg.grid / 2; x < d.x2; x += cfg.grid) {
      for (let z = d.z1 + cfg.grid / 2; z < d.z2; z += cfg.grid) {
        if (Math.random() > cfg.fill) continue;
        const jx = x + rand(-cfg.grid * 0.12, cfg.grid * 0.12);
        const jz = z + rand(-cfg.grid * 0.12, cfg.grid * 0.12);
        const w = rand(cfg.minW, cfg.maxW);
        const dep = rand(cfg.minW, cfg.maxW);
        if (onRoad(jx, jz, Math.max(w, dep) * 0.62 + 2)) continue;
        if (EXCLUDES.some((r) => inRect(jx, jz, r))) continue;
        const h = rand(cfg.minH, cfg.maxH);
        spots.push({ x: jx, z: jz, w, d: dep, h, c: pick(cfg.colors) });
        if (Math.random() < cfg.tanks) tanks.push({ x: jx + rand(-w / 4, w / 4), z: jz + rand(-dep / 4, dep / 4), y: h });
        addCollider(jx, jz, w, dep, h);

        // facade anchor for shop signs if it faces a road
        if (h < 30 && Math.random() < 0.5) {
          for (const rd of ROADS) {
            for (let i = 0; i < rd.pts.length - 1; i++) {
              const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1];
              const dist = segPointDist(jx, jz, ax, az, bx, bz);
              if (dist < rd.w / 2 + Math.max(w, dep) * 0.62 + 6) {
                world.signAnchors.push({ x: jx, z: jz, w, d: dep, road: rd, segA: [ax, az], segB: [bx, bz] });
                i = rd.pts.length; break;
              }
            }
          }
        }
      }
    }

    if (!spots.length) continue;
    const style = (d.id === 'oldDhaka' || d.id === 'mirpur' || d.id === 'sherEBangla') ? 'weathered' : 'office';
    const texes = facadeTextures(style);
    const mat = new THREE.MeshLambertMaterial({ map: texes.day });
    const im = new THREE.InstancedMesh(boxGeo, mat, spots.length);
    spots.forEach((s, i) => {
      tmpP.set(s.x, 0, s.z);
      tmpS.set(s.w, s.h, s.d);
      tmpQ.identity();
      tmpM.compose(tmpP, tmpQ, tmpS);
      im.setMatrixAt(i, tmpM);
      tmpC.set(s.c).multiplyScalar(rand(0.72, 1.05));
      im.setColorAt(i, tmpC);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
    world.buildingSets.push({ im, day: texes.day, night: texes.night, mat });

    if (tanks.length) {
      const tim = new THREE.InstancedMesh(tankGeo, tankMat, tanks.length);
      tanks.forEach((t, i) => {
        tmpP.set(t.x, t.y + 0.7, t.z);
        tmpS.setScalar(rand(0.8, 1.3));
        tmpQ.identity();
        tmpM.compose(tmpP, tmpQ, tmpS);
        tim.setMatrixAt(i, tmpM);
      });
      tim.instanceMatrix.needsUpdate = true;
      scene.add(tim);
    }
  }
}
