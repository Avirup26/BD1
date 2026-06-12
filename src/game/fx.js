// Pooled particle system: exhaust smoke, dust, splashes, muzzle flash,
// explosions — one THREE.Points buffer, per-particle velocity/color/life.
import * as THREE from 'three';
import { rand } from './utils.js';

const MAX = 1500;

export class FX {
  constructor(scene) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -9999;
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.65,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    // particle state: vx, vy, vz, life, maxLife, gravity
    this.data = new Float32Array(MAX * 6);
    this.cursor = 0;
    this.tmpColor = new THREE.Color();
  }

  emit(x, y, z, vx, vy, vz, life, color, gravity = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.tmpColor.set(color);
    this.col[i * 3] = this.tmpColor.r; this.col[i * 3 + 1] = this.tmpColor.g; this.col[i * 3 + 2] = this.tmpColor.b;
    const d = i * 6;
    this.data[d] = vx; this.data[d + 1] = vy; this.data[d + 2] = vz;
    this.data[d + 3] = life; this.data[d + 4] = life; this.data[d + 5] = gravity;
  }

  burst(x, y, z, color, count, speed, life = 1, gravity = -4) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), e = rand(-0.4, 1);
      const s = rand(speed * 0.3, speed);
      this.emit(
        x, y, z,
        Math.cos(a) * s, Math.abs(e) * s, Math.sin(a) * s,
        rand(life * 0.5, life), color, gravity
      );
    }
  }

  explosion(x, y, z) {
    this.burst(x, y + 1, z, '#ff8a30', 60, 14, 0.8, -2);
    this.burst(x, y + 1, z, '#ffd25e', 30, 10, 0.5, -2);
    this.burst(x, y + 2, z, '#33302c', 50, 5, 2.4, 1.5); // rising black smoke
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      const d = i * 6;
      if (this.data[d + 3] <= 0) continue;
      this.data[d + 3] -= dt;
      if (this.data[d + 3] <= 0) {
        this.pos[i * 3 + 1] = -9999;
        continue;
      }
      this.data[d + 1] += this.data[d + 5] * dt; // gravity on vy
      this.pos[i * 3] += this.data[d] * dt;
      this.pos[i * 3 + 1] += this.data[d + 1] * dt;
      this.pos[i * 3 + 2] += this.data[d + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
