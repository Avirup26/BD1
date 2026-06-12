export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
}

// frame-rate independent exponential smoothing
export const smoothTo = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
export const smoothAngle = (cur, target, rate, dt) => lerpAngle(cur, target, 1 - Math.exp(-rate * dt));

export const dist2 = (x1, z1, x2, z2) => {
  const dx = x1 - x2, dz = z1 - z2;
  return dx * dx + dz * dz;
};
export const dist = (x1, z1, x2, z2) => Math.sqrt(dist2(x1, z1, x2, z2));

export function segPointDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const apx = px - ax, apz = pz - az;
  const len2v = abx * abx + abz * abz || 1e-9;
  const t = clamp((apx * abx + apz * abz) / len2v, 0, 1);
  const cx = ax + abx * t, cz = az + abz * t;
  return Math.sqrt((px - cx) * (px - cx) + (pz - cz) * (pz - cz));
}

export function inRect(x, z, r) {
  return x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2;
}

export function formatTaka(n) {
  return '৳ ' + Math.round(n).toLocaleString('en-IN');
}

export function formatClock(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
