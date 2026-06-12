import React, { useEffect, useRef } from 'react';
import { useGame } from '../state/store.js';
import { uiRefs } from '../state/uiRefs.js';

function Wanted() {
  const wanted = useGame((s) => s.wanted);
  return (
    <div id="hud-wanted" className={wanted >= 4 ? 'flashing' : ''}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`star${i <= wanted ? ' on' : ''}`}>{'☸︎'}</span>
      ))}
    </div>
  );
}

function TopRight() {
  const money = useGame((s) => s.money);
  const timeStr = useGame((s) => s.timeStr);
  const timeIcon = useGame((s) => s.timeIcon);
  const weapon = useGame((s) => s.weapon);
  const ammo = useGame((s) => s.ammo);
  const radio = useGame((s) => s.radio);
  const speed = useGame((s) => s.speed);
  const inVehicle = useGame((s) => s.inVehicle);
  return (
    <div id="hud-topright">
      <div id="hud-money">৳ {money.toLocaleString('en-IN')}</div>
      <div id="hud-clock">{timeStr} {timeIcon}</div>
      <Wanted />
      <div id="hud-weapon">
        {weapon === 'pistol' ? '🔫 Pistol' : '👊 Fists'} | {ammo}
      </div>
      {inVehicle && (
        <div id="hud-weapon">🚗 {inVehicle.toUpperCase()} · {speed} km/h</div>
      )}
      {radio && <div id="radio-hud">📻 {radio}</div>}
    </div>
  );
}

function BottomLeft() {
  const health = useGame((s) => s.health);
  const armor = useGame((s) => s.armor);
  const canvasRef = useRef(null);
  useEffect(() => {
    uiRefs.minimap = canvasRef.current;
    return () => { uiRefs.minimap = null; };
  }, []);
  return (
    <div id="hud-bottomleft">
      <div id="minimap-wrap">
        <canvas ref={canvasRef} id="minimap" width={188} height={188} />
      </div>
      <div className="vital">
        <span className="ico">❤️</span>
        <div className="bar-wrap"><div className="bar" id="health-bar" style={{ width: `${health}%` }} /></div>
      </div>
      <div className="vital">
        <span className="ico">🛡️</span>
        <div className="bar-wrap"><div className="bar" id="armor-bar" style={{ width: `${armor}%` }} /></div>
      </div>
    </div>
  );
}

function MissionRibbon() {
  const objective = useGame((s) => s.objective);
  const title = useGame((s) => s.missionTitle);
  const timer = useGame((s) => s.missionTimer);
  if (!objective && !title) return null;
  return (
    <div id="mission-ribbon">
      {title && <div className="mtitle">{title}</div>}
      {objective && <div className="mobj bn">{objective}</div>}
      {timer !== null && timer !== undefined && (
        <div className="mtimer">
          ⏱ {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
        </div>
      )}
    </div>
  );
}

function DistrictPopup() {
  const tick = useGame((s) => s.districtTick);
  const bn = useGame((s) => s.districtBn);
  const en = useGame((s) => s.districtEn);
  if (!tick || !bn) return null;
  return (
    <div id="district-popup" key={tick}>
      <div className="d-bn">{bn}</div>
      <div className="d-en">{en}</div>
    </div>
  );
}

function Toast() {
  const toast = useGame((s) => s.toast);
  const tick = useGame((s) => s.toastTick);
  if (!toast) return null;
  return <div id="toast" className="bn" key={tick}>{toast}</div>;
}

function DeathOverlay() {
  const msg = useGame((s) => s.deathMsg);
  if (!msg) return null;
  return (
    <div id="death-overlay">
      <div className="d-bn">{msg.bn}</div>
      <div className="d-en">{msg.en}</div>
    </div>
  );
}

function Cutscene() {
  const cut = useGame((s) => s.cutscene);
  if (!cut) return null;
  return (
    <div id="cutscene">
      <div className="c-title">{cut.title}</div>
      {cut.lines.map((l, i) => (
        <p className="c-line bn" key={i}>{l}</p>
      ))}
    </div>
  );
}

function ImperativeLayers() {
  const floatRef = useRef(null);
  const labelRef = useRef(null);
  const flashRef = useRef(null);
  useEffect(() => {
    uiRefs.floatLayer = floatRef.current;
    uiRefs.beaconLabel = labelRef.current;
    uiRefs.damageFlash = flashRef.current;
    return () => {
      uiRefs.floatLayer = null;
      uiRefs.beaconLabel = null;
      uiRefs.damageFlash = null;
    };
  }, []);
  return (
    <>
      <div id="float-layer" ref={floatRef} />
      <div id="beacon-label" ref={labelRef} style={{ display: 'none' }} />
      <div id="damage-flash" ref={flashRef} />
    </>
  );
}

export default function HUD() {
  return (
    <>
      <ImperativeLayers />
      <TopRight />
      <BottomLeft />
      <MissionRibbon />
      <DistrictPopup />
      <Toast />
      <Cutscene />
      <DeathOverlay />
    </>
  );
}
