import React from 'react';
import { useGame } from '../state/store.js';
import { getGame } from '../game/Game.js';

export default function LoadingScreen() {
  const phase = useGame((s) => s.phase);
  const pct = useGame((s) => s.loadPct);
  const label = useGame((s) => s.loadLabel);
  const hasSave = useGame((s) => s.hasSave);
  const webglError = useGame((s) => s.webglError);

  return (
    <div id="loading">
      <h1>ঢাকা সিটি আন্ডারওয়ার্ল্ড</h1>
      <h2>Dhaka City Underworld</h2>
      {webglError ? (
        <p id="webgl-error">{webglError}</p>
      ) : phase === 'ready' ? (
        <div className="menu-buttons">
          {hasSave && (
            <button className="btn" onClick={() => getGame().start(false)}>
              চালিয়ে যান — Continue
            </button>
          )}
          <button className={hasSave ? 'btn secondary' : 'btn'} onClick={() => getGame().start(true)}>
            নতুন খেলা — New Game
          </button>
        </div>
      ) : (
        <>
          <div className="load-bar-wrap">
            <div className="load-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="load-label">{label}</div>
        </>
      )}
      {!webglError && (
        <p className="load-tip">
          WASD চলাফেরা · Shift দৌড় · E গাড়িতে ওঠা/নামা · F/click আক্রমণ · 1/2 অস্ত্র · R রেডিও ·
          H হর্ন · C ক্যামেরা · M ম্যাপ · Esc পজ — সদরঘাট থেকে উত্তরা, পুরো ঢাকা আপনার।
        </p>
      )}
    </div>
  );
}
