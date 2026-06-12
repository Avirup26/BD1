import React from 'react';
import { useGame, store } from '../state/store.js';
import { getGame } from '../game/Game.js';
import { SAVE_KEY } from '../game/constants.js';

export default function PauseMenu() {
  const volume = useGame((s) => s.volume);
  const quality = useGame((s) => s.quality);
  const controlsOpen = useGame((s) => s.controlsOpen);
  const game = getGame();

  return (
    <div id="pause-menu">
      <div className="pause-panel">
        <h2>বিরতি</h2>
        <h3>PAUSED — Dhaka City Underworld</h3>
        <button className="btn" onClick={() => store.set({ paused: false })}>চালিয়ে যান — Resume</button>
        <button className="btn secondary" onClick={() => store.set({ paused: false, mapOpen: true })}>পূর্ণ ম্যাপ — Full Map (M)</button>
        <button
          className="btn secondary"
          onClick={() => { game.save(); game.toast('💾 সেভ হয়েছে! Game saved.'); store.set({ paused: false }); }}
        >
          সেভ করুন — Save Game
        </button>
        <button className="btn secondary" onClick={() => store.set({ controlsOpen: !controlsOpen })}>
          কন্ট্রোল — Controls
        </button>
        {controlsOpen && (
          <div className="controls-list bn">
            <div><b>WASD</b> চলাফেরা / drive</div>
            <div><b>Shift</b> দৌড়</div>
            <div><b>E</b> গাড়ি / interact</div>
            <div><b>F / click</b> আক্রমণ</div>
            <div><b>1 / 2</b> অস্ত্র বদল</div>
            <div><b>Space</b> ব্রেক</div>
            <div><b>R</b> রেডিও</div>
            <div><b>H</b> হর্ন</div>
            <div><b>C</b> ক্যামেরা</div>
            <div><b>M</b> ম্যাপ</div>
          </div>
        )}
        <div className="setting-row">
          <label>VOLUME</label>
          <input
            type="range" min="0" max="1" step="0.05" value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              store.set({ volume: v });
              game.audio.setVolume(v);
            }}
          />
        </div>
        <div className="setting-row">
          <label>GRAPHICS</label>
          <select value={quality} onChange={(e) => game.applyQuality(e.target.value)}>
            <option value="low">Low — no shadows</option>
            <option value="medium">Medium</option>
            <option value="high">High — full shadows</option>
          </select>
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            if (window.confirm('নতুন খেলা শুরু করবেন? Save মুছে যাবে! Start over and wipe the save?')) {
              localStorage.removeItem(SAVE_KEY);
              window.location.reload();
            }
          }}
        >
          নতুন খেলা — Restart
        </button>
      </div>
    </div>
  );
}
