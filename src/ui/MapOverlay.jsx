import React, { useEffect, useRef } from 'react';
import { store } from '../state/store.js';
import { uiRefs } from '../state/uiRefs.js';
import { getGame } from '../game/Game.js';

export default function MapOverlay() {
  const ref = useRef(null);
  useEffect(() => {
    uiRefs.bigmap = ref.current;
    getGame()?.drawBigMap();
    return () => { uiRefs.bigmap = null; };
  }, []);
  const size = Math.min(680, Math.min(window.innerWidth * 0.9, window.innerHeight * 0.76));
  return (
    <div id="map-overlay" onClick={() => store.set({ mapOpen: false })}>
      <div className="map-title bn">ঢাকা — DHAKA</div>
      <canvas ref={ref} id="bigmap" width={size} height={size} />
      <div className="map-hint">M / Esc / click to close · 🟡 mission · 🟢 you</div>
    </div>
  );
}
