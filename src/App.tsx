/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { GameOverlays } from './components/GameOverlays';
import { TouchControls } from './components/TouchControls';
import { soundEngine } from './game/audio';
import { LEVELS } from './game/levels';
import { MysteryIslandEngine } from './game/MysteryIslandEngine';
import { GameHudState } from './game/types';

const INITIAL_HUD: GameHudState = {
  status: 'start',
  levelIndex: 0,
  levelName: LEVELS[0].name,
  levelSubtitle: LEVELS[0].subtitle,
  score: 0,
  highScore: 0,
  hearts: 3,
  maxHearts: 3,
  coinsCollected: 0,
  coinsTotal: LEVELS[0].coinCount,
  coinsRequired: LEVELS[0].coinsRequired,
  chestsCollected: 0,
  chestsTotal: LEVELS[0].chestCount,
  portalUnlocked: false,
  elapsedTime: 0,
  portalRelativeAngle: 0,
  portalDistance: 0,
  totalCoinsAllLevels: 0,
  totalChestsAllLevels: 0,
  damageFlash: 0,
  pickupToast: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MysteryIslandEngine | null>(null);

  const [hud, setHud] = useState<GameHudState>(INITIAL_HUD);
  const [selectedStartLevel, setSelectedStartLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)').matches ||
      window.innerWidth < 768
    );
  });

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new MysteryIslandEngine(
      mountEl,
      (nextHud) => setHud(nextHud),
      (lost) => setContextLost(lost),
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
      soundEngine.stopMusic();
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlock();
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        handleToggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleMute]);

  const handleStart = useCallback(() => {
    engineRef.current?.startGame(selectedStartLevel);
  }, [selectedStartLevel]);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleRestartLevel = useCallback(() => {
    engineRef.current?.restartLevel();
  }, []);

  const handleRestartAdventure = useCallback(() => {
    engineRef.current?.restartFullAdventure();
  }, []);

  const handleNextLevel = useCallback(() => {
    engineRef.current?.nextLevel();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleJoystick = useCallback((x: number, y: number, active: boolean) => {
    engineRef.current?.setJoystick(x, y, active);
  }, []);

  const handleJumpPress = useCallback(() => {
    engineRef.current?.triggerJumpFromTouch();
  }, []);

  const handleJumpRelease = useCallback(() => {
    engineRef.current?.releaseJumpFromTouch();
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Isolated WebGL mount container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full"
        aria-label="Mystery Island Adventure 3D World"
      />

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6">
            <h2 className="font-display text-xl font-bold text-white">
              Graphics Context Paused
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Your browser paused the 3D renderer. Reload or click below to
              resume your island expedition.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm"
            >
              Reload Game
            </button>
          </div>
        </div>
      )}

      {/* Active Gameplay HUD & Touch Controls */}
      {hud.status === 'playing' && (
        <>
          <GameHUD
            hud={hud}
            muted={muted}
            showTouchControls={showTouchControls}
            onToggleMute={handleToggleMute}
            onPause={handlePause}
            onRestart={handleRestartLevel}
            onToggleTouch={() => setShowTouchControls((prev) => !prev)}
          />

          {showTouchControls && (
            <TouchControls
              onJoystick={handleJoystick}
              onJumpPress={handleJumpPress}
              onJumpRelease={handleJumpRelease}
            />
          )}
        </>
      )}

      {/* Start, Pause, Level Complete, Game Over, and Victory Screens */}
      <GameOverlays
        hud={hud}
        selectedStartLevel={selectedStartLevel}
        muted={muted}
        onSelectStartLevel={setSelectedStartLevel}
        onStart={handleStart}
        onResume={handleResume}
        onRestartLevel={handleRestartLevel}
        onRestartAdventure={handleRestartAdventure}
        onNextLevel={handleNextLevel}
        onReturnTitle={handleReturnTitle}
        onToggleMute={handleToggleMute}
      />
    </main>
  );
}
