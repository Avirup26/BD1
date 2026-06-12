// Tiny pub/sub store bridging the imperative Three.js game loop and React HUD.
// The game throttles writes; components subscribe to primitive selectors.
import { useSyncExternalStore } from 'react';

const state = {
  phase: 'boot',          // boot | loading | ready | playing
  loadPct: 0,
  loadLabel: '',
  hasSave: false,
  webglError: null,

  health: 100,
  armor: 0,
  money: 500,
  wanted: 0,
  timeStr: '08:00',
  timeIcon: '☀️',
  weather: 'clear',
  weapon: 'fists',
  ammo: '∞',
  speed: 0,
  inVehicle: null,        // vehicle type string or null

  districtBn: '',
  districtEn: '',
  districtTick: 0,        // bumped to retrigger the popup animation

  objective: null,
  missionTitle: null,
  missionTimer: null,     // seconds remaining or null

  radio: null,            // station name or null
  hint: null,             // contextual "press E" hint

  toast: null,
  toastTick: 0,

  cutscene: null,         // { title, lines } or null
  deathMsg: null,         // { bn, en } or null

  paused: false,
  mapOpen: false,
  quality: 'high',
  volume: 0.7,
  touch: false,
  controlsOpen: false
};

const subs = new Set();
let notifying = false;

export const store = {
  get: () => state,
  set(patch) {
    let changed = false;
    for (const k in patch) {
      if (state[k] !== patch[k]) { state[k] = patch[k]; changed = true; }
    }
    if (changed && !notifying) {
      notifying = true;
      // microtask batch so a burst of game writes causes one render pass
      queueMicrotask(() => {
        notifying = false;
        subs.forEach((f) => f());
      });
    }
  },
  subscribe(f) {
    subs.add(f);
    return () => subs.delete(f);
  }
};

export function useGame(selector) {
  return useSyncExternalStore(store.subscribe, () => selector(state));
}
