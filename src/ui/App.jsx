import React, { useEffect, useRef } from 'react';
import { createGame } from '../game/Game.js';
import { useGame } from '../state/store.js';
import { uiRefs } from '../state/uiRefs.js';
import LoadingScreen from './LoadingScreen.jsx';
import HUD from './HUD.jsx';
import PauseMenu from './PauseMenu.jsx';
import MapOverlay from './MapOverlay.jsx';
import TouchControls from './TouchControls.jsx';

export default function App() {
  const containerRef = useRef(null);

  useEffect(() => {
    uiRefs.container = containerRef.current;
    createGame(containerRef.current);
    // The game lives for the lifetime of the page (singleton); no teardown.
  }, []);

  const phase = useGame((s) => s.phase);
  const paused = useGame((s) => s.paused);
  const mapOpen = useGame((s) => s.mapOpen);
  const touch = useGame((s) => s.touch);

  return (
    <div id="app">
      <div id="game-container" ref={containerRef} />
      {phase === 'playing' && <HUD />}
      {phase === 'playing' && touch && !paused && <TouchControls />}
      {phase === 'playing' && mapOpen && <MapOverlay />}
      {phase === 'playing' && paused && <PauseMenu />}
      {phase !== 'playing' && <LoadingScreen />}
    </div>
  );
}
