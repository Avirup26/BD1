import React, { useRef } from 'react';
import { getGame } from '../game/Game.js';

export default function TouchControls() {
  const baseRef = useRef(null);
  const knobRef = useRef(null);

  const handleJoy = (e) => {
    e.preventDefault();
    const game = getGame();
    const rect = baseRef.current.getBoundingClientRect();
    const t = e.touches[0];
    if (!t) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (t.clientX - cx) / (rect.width / 2);
    let dy = (t.clientY - cy) / (rect.height / 2);
    const L = Math.hypot(dx, dy);
    if (L > 1) { dx /= L; dy /= L; }
    knobRef.current.style.transform = `translate(calc(-50% + ${dx * 38}px), calc(-50% + ${dy * 38}px))`;
    game.setTouchVector(dx, dy);
  };
  const endJoy = (e) => {
    e.preventDefault();
    knobRef.current.style.transform = 'translate(-50%, -50%)';
    getGame().setTouchVector(0, 0);
  };
  const btn = (name) => ({
    onTouchStart: (e) => { e.preventDefault(); getGame().touchButton(name, true); },
    onTouchEnd: (e) => { e.preventDefault(); getGame().touchButton(name, false); }
  });

  return (
    <div id="touch-ui">
      <div
        id="joystick-zone" ref={baseRef}
        onTouchStart={handleJoy} onTouchMove={handleJoy} onTouchEnd={endJoy}
      >
        <div id="joystick-knob" ref={knobRef} />
      </div>
      <div className="touch-buttons">
        <button className="tbtn" {...btn('E')}>E</button>
        <button className="tbtn" {...btn('ATK')}>👊</button>
        <button className="tbtn" {...btn('RUN')}>🏃</button>
      </div>
    </div>
  );
}
