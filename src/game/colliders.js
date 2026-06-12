// Static world collision: axis-aligned boxes + a uniform spatial hash.
import { ROADS, ROUNDABOUTS } from './constants.js';
import { segPointDist, clamp } from './utils.js';

export const colliders = []; // { x1, x2, z1, z2, h }
const CELL = 50;
const hash = new Map();

export function addCollider(cx, cz, w, d, h = 30) {
  colliders.push({ x1: cx - w / 2, x2: cx + w / 2, z1: cz - d / 2, z2: cz + d / 2, h });
}

export function resetColliders() {
  colliders.length = 0;
  hash.clear();
}

const key = (cx, cz) => cx * 10000 + cz;

export function buildColliderHash() {
  hash.clear();
  colliders.forEach((c, i) => {
    const cx1 = Math.floor(c.x1 / CELL), cx2 = Math.floor(c.x2 / CELL);
    const cz1 = Math.floor(c.z1 / CELL), cz2 = Math.floor(c.z2 / CELL);
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cz = cz1; cz <= cz2; cz++) {
        const k = key(cx, cz);
        if (!hash.has(k)) hash.set(k, []);
        hash.get(k).push(i);
      }
    }
  });
}

export function nearColliders(x, z) {
  const out = [];
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = hash.get(key(cx + i, cz + j));
      if (list) out.push(list);
    }
  }
  return out;
}

/**
 * Push a circle (x,z,r) out of any overlapping static box.
 * Returns { x, z, hit } with corrected position.
 */
export function resolveCircle(x, z, r) {
  let hit = false;
  const buckets = nearColliders(x, z);
  for (const list of buckets) {
    for (const idx of list) {
      const c = colliders[idx];
      const nx = clamp(x, c.x1, c.x2);
      const nz = clamp(z, c.z1, c.z2);
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // center inside box: push out through the nearest face
          const left = x - c.x1, right = c.x2 - x, top = z - c.z1, bot = c.z2 - z;
          const m = Math.min(left, right, top, bot);
          if (m === left) x = c.x1 - r;
          else if (m === right) x = c.x2 + r;
          else if (m === top) z = c.z1 - r;
          else z = c.z2 + r;
        }
      }
    }
  }
  return { x, z, hit };
}

export function pointBlocked(x, z) {
  const buckets = nearColliders(x, z);
  for (const list of buckets) {
    for (const idx of list) {
      const c = colliders[idx];
      if (x >= c.x1 && x <= c.x2 && z >= c.z1 && z <= c.z2) return true;
    }
  }
  return false;
}

// Sampled line-of-sight check used by police shooting and the camera.
export function lineOfSight(x1, z1, x2, z2) {
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlocked(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
  }
  return true;
}

export function onRoad(x, z, margin = 0) {
  for (const rd of ROADS) {
    const half = rd.w / 2 + margin;
    for (let i = 0; i < rd.pts.length - 1; i++) {
      const [ax, az] = rd.pts[i];
      const [bx, bz] = rd.pts[i + 1];
      if (segPointDist(x, z, ax, az, bx, bz) < half) return true;
    }
  }
  for (const rb of ROUNDABOUTS) {
    const dx = x - rb.x, dz = z - rb.z;
    if (dx * dx + dz * dz < (rb.r + margin) * (rb.r + margin)) return true;
  }
  return false;
}
