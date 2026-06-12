import * as THREE from 'three';
import { rand, randi, pick } from './utils.js';

export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Facade texture drawn near-white so InstancedMesh per-instance colors tint it
 * to the district palette. Returns { day, night }.
 * style: 'weathered' adds moss/rust streaks (Old Dhaka, Mirpur), 'office' adds
 * glass bands + AC units (Motijheel, Gulshan, Uttara).
 */
export function facadeTextures(style) {
  const make = (night) => canvasTex(128, 256, (g) => {
    g.fillStyle = '#f2efe9';
    g.fillRect(0, 0, 128, 256);
    // subtle plaster noise
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(60,50,40,${rand(0.02, 0.08)})`;
      g.fillRect(randi(0, 127), randi(0, 255), randi(1, 3), randi(1, 3));
    }
    const cols = 5, rows = 11;
    const cw = 128 / cols, rh = 256 / (rows + 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.22, y = r * rh + rh * 0.28 + 8;
        const ww = cw * 0.56, wh = rh * 0.5;
        if (night) {
          if (Math.random() < 0.68) {
            g.fillStyle = pick(['#ffd988', '#ffc868', '#e8e0a8']);
            g.shadowColor = '#ffcf70'; g.shadowBlur = 6;
          } else {
            g.fillStyle = '#1a1d26'; g.shadowBlur = 0;
          }
        } else {
          g.fillStyle = style === 'office' ? pick(['#3d4b5c', '#4a5a6e', '#2f3b49']) : pick(['#3a3630', '#46413a', '#2e2b26']);
          g.shadowBlur = 0;
        }
        g.fillRect(x, y, ww, wh);
        g.shadowBlur = 0;
        // window frame
        g.strokeStyle = 'rgba(40,36,30,0.55)';
        g.strokeRect(x, y, ww, wh);
        // AC unit boxes on some office windows
        if (style === 'office' && !night && Math.random() < 0.18) {
          g.fillStyle = '#b9b9b4';
          g.fillRect(x + ww * 0.55, y + wh * 0.6, ww * 0.38, wh * 0.34);
        }
      }
    }
    if (style === 'weathered') {
      // rust + moss streaks running down from window sills
      for (let i = 0; i < 14; i++) {
        const x = randi(4, 124);
        const grad = g.createLinearGradient(0, 0, 0, 256);
        const tone = Math.random() < 0.5 ? '92,72,40' : '58,82,48';
        grad.addColorStop(0, `rgba(${tone},0)`);
        grad.addColorStop(1, `rgba(${tone},${rand(0.18, 0.4)})`);
        g.fillStyle = grad;
        g.fillRect(x, randi(0, 60), randi(2, 5), 256);
      }
      // exposed brick patch
      if (Math.random() < 0.8) {
        const bx = randi(0, 80), by = randi(120, 200);
        g.fillStyle = 'rgba(140,80,55,0.5)';
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 5; c++)
            g.fillRect(bx + c * 8 + (r % 2) * 4, by + r * 4, 6, 3);
      }
    }
    // ground floor shutter band
    g.fillStyle = night ? '#2a2622' : '#5c554a';
    g.fillRect(0, 238, 128, 18);
  });
  return { day: make(false), night: make(true) };
}

export function roadTexture() {
  const t = canvasTex(64, 256, (g) => {
    g.fillStyle = '#2A2A2A';
    g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 320; i++) {
      g.fillStyle = `rgba(255,255,255,${rand(0.01, 0.05)})`;
      g.fillRect(randi(0, 63), randi(0, 255), 1, 1);
    }
    // patched asphalt blotches
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(0,0,0,${rand(0.1, 0.25)})`;
      g.beginPath();
      g.ellipse(randi(8, 56), randi(10, 246), randi(4, 10), randi(6, 16), 0, 0, Math.PI * 2);
      g.fill();
    }
    // dashed center line
    g.fillStyle = '#d8d8d0';
    for (let y = 0; y < 256; y += 44) g.fillRect(30, y, 4, 24);
    // edge lines
    g.fillStyle = 'rgba(216,216,208,0.7)';
    g.fillRect(2, 0, 2, 256);
    g.fillRect(60, 0, 2, 256);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function signTexture(bn, en, bg, fg) {
  return canvasTex(256, 64, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3;
    g.strokeRect(2, 2, 252, 60);
    g.fillStyle = fg;
    g.font = 'bold 26px "Noto Sans Bengali", sans-serif';
    g.textAlign = 'center';
    g.fillText(bn, 128, 33);
    g.font = '600 14px Rajdhani, Arial, sans-serif';
    g.fillText(en.toUpperCase(), 128, 54);
  });
}

export function billboardTexture(text) {
  return canvasTex(512, 256, (g) => {
    const bg = pick(['#0a3d62', '#7d1d1d', '#0e5e36', '#5d2a7a']);
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.beginPath(); g.arc(420, 50, 90, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 44px "Noto Sans Bengali", sans-serif';
    g.textAlign = 'center';
    const parts = text.split(' — ');
    g.fillText(parts[0], 256, 110);
    if (parts[1]) {
      g.font = '600 32px "Noto Sans Bengali", sans-serif';
      g.fillStyle = '#ffd25e';
      g.fillText(parts[1], 256, 170);
    }
  });
}

export function canopyTexture() {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = pick(['#c0392b', '#1e6f9f', '#1d7a4f', '#b06010', '#7d3c98']);
    g.fillRect(0, 0, 64, 64);
    // floral rickshaw-art motif: petal rosettes + dots
    for (let i = 0; i < 4; i++) {
      const cx = randi(10, 54), cy = randi(10, 54);
      const petal = pick(['#ffd25e', '#ff8fab', '#9be8a8', '#8fd8ff']);
      g.fillStyle = petal;
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 4, 2.4, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#ffd25e';
    g.lineWidth = 4;
    g.strokeRect(0, 0, 64, 64);
  });
}

export function parliamentTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#8d9092'; // Louis Kahn raw concrete
    g.fillRect(0, 0, 256, 256);
    // shutter lines of poured concrete
    g.strokeStyle = 'rgba(60,60,62,0.35)';
    for (let y = 0; y < 256; y += 22) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    }
    g.fillStyle = '#24262e';
    // the iconic giant circle
    g.beginPath(); g.arc(128, 92, 54, 0, Math.PI * 2); g.fill();
    // giant triangle
    g.beginPath();
    g.moveTo(128, 168); g.lineTo(196, 244); g.lineTo(60, 244); g.closePath(); g.fill();
    // vertical slot windows
    g.fillRect(18, 40, 14, 200);
    g.fillRect(224, 40, 14, 200);
  });
}

export function busDestTexture() {
  return canvasTex(256, 48, (g) => {
    g.fillStyle = '#101418';
    g.fillRect(0, 0, 256, 48);
    g.fillStyle = '#ffd25e';
    g.font = 'bold 24px "Noto Sans Bengali", sans-serif';
    g.textAlign = 'center';
    g.fillText('গুলিস্তান ⇌ মিরপুর ১০', 128, 33);
  });
}

export function groundTexture() {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#85795f';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${randi(40, 90)},${randi(35, 75)},${randi(20, 50)},${rand(0.05, 0.2)})`;
      g.fillRect(randi(0, 255), randi(0, 255), randi(1, 4), randi(1, 4));
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  return t;
}
