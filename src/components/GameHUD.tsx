import React from 'react';
import {
  Compass,
  Coins,
  Gem,
  Heart,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Gamepad2,
} from 'lucide-react';
import { GameHudState } from '../game/types';
import { LEVELS } from '../game/levels';

interface GameHUDProps {
  hud: GameHudState;
  muted: boolean;
  showTouchControls: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onToggleTouch: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  showTouchControls,
  onToggleMute,
  onPause,
  onRestart,
  onToggleTouch,
}) => {
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.floor(sec % 60);
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Damage vignette flash */}
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none border-8 border-rose-500/70 bg-rose-600/20 transition-opacity"
          style={{ opacity: Math.min(1, hud.damageFlash) }}
        />
      )}

      {/* Top HUD Bar */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Status Cluster */}
        <div className="pointer-events-auto bg-slate-950/82 border border-white/15 rounded-xl px-3.5 py-2.5 shadow-lg max-w-[68vw] sm:max-w-none">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300">
            <span className="font-display font-bold text-sm text-amber-300 whitespace-nowrap">
              Level {hud.levelIndex + 1}/{LEVELS.length}
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="font-medium text-slate-100 truncate max-w-[140px] sm:max-w-none">
              {hud.levelName}
            </span>
            <span aria-hidden="true" className="hidden sm:inline text-slate-500">
              ·
            </span>
            <span className="hidden sm:inline font-mono-nums text-slate-300">
              {formatTime(hud.elapsedTime)}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {/* Hearts */}
            <div
              className="flex items-center gap-1"
              aria-label={`Health ${hud.hearts} of ${hud.maxHearts}`}
            >
              {Array.from({ length: hud.maxHearts }).map((_, idx) => (
                <Heart
                  key={idx}
                  className={`w-4 h-4 ${
                    idx < hud.hearts
                      ? 'text-rose-500 fill-rose-500'
                      : 'text-slate-600 fill-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* Coins */}
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-mono-nums font-bold text-white">
                {hud.coinsCollected}/{hud.coinsTotal}
              </span>
              <span className="hidden md:inline text-xs text-slate-400">
                ({hud.portalUnlocked
                  ? 'Shrine open'
                  : `${Math.max(0, hud.coinsRequired - hud.coinsCollected)} to unlock`}
                )
              </span>
            </div>

            {/* Chests */}
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Gem className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-mono-nums font-bold text-white">
                {hud.chestsCollected}/{hud.chestsTotal}
              </span>
            </div>

            {/* Score */}
            <div className="flex items-center gap-1.5 text-xs sm:text-sm border-l border-white/15 pl-3">
              <span className="text-slate-400">Score</span>
              <span className="font-mono-nums font-bold text-amber-300">
                {hud.score.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Top-Center Shrine Compass */}
        <div className="hidden lg:flex items-center gap-2.5 bg-slate-950/82 border border-white/15 rounded-xl px-3.5 py-2 shadow-lg">
          <Compass
            className={`w-5 h-5 transition-transform duration-100 ${
              hud.portalUnlocked ? 'text-cyan-300' : 'text-amber-300'
            }`}
            style={{
              transform: `rotate(${(hud.portalRelativeAngle * 180) / Math.PI}deg)`,
            }}
          />
          <div className="text-xs leading-tight">
            <div className="font-semibold text-slate-100 whitespace-nowrap">
              {hud.portalUnlocked ? 'Shrine Open' : 'Shrine Locked'}
            </div>
            <div className="font-mono-nums text-slate-400">
              {hud.portalDistance}m away
            </div>
          </div>
        </div>

        {/* Top-Right Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTouch();
            }}
            title="Toggle On-Screen Controls"
            aria-label="Toggle On-Screen Controls"
            className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${
              showTouchControls
                ? 'bg-emerald-500/90 border-emerald-300 text-slate-950'
                : 'bg-slate-950/82 border-white/15 text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            title={muted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
            className="h-10 w-10 rounded-xl bg-slate-950/82 border border-white/15 text-slate-200 hover:bg-slate-900 flex items-center justify-center transition-colors"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            title="Restart Level (R)"
            aria-label="Restart Level"
            className="h-10 px-3 rounded-xl bg-slate-950/82 border border-white/15 text-slate-100 hover:bg-slate-900 flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Restart</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            title="Pause Game (P)"
            aria-label="Pause Game"
            className="h-10 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 text-xs font-bold transition-colors whitespace-nowrap shadow-md"
          >
            <Pause className="w-4 h-4 fill-slate-950" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>

      {/* Pickup / Portal Notification Toast */}
      {hud.pickupToast && (
        <div className="self-center mt-2 bg-slate-950/88 border border-amber-400/40 text-amber-200 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold shadow-lg">
          {hud.pickupToast}
        </div>
      )}

      {/* Bottom Desktop Controls Guide (hidden when touch controls active) */}
      {!showTouchControls && (
        <div className="hidden md:flex self-center items-center gap-3 bg-slate-950/78 border border-white/12 rounded-xl px-4 py-1.5 text-xs text-slate-300">
          <span>WASD Move</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>Space Jump</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>Drag or Q/E Rotate Camera</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>Stomp enemies from above</span>
        </div>
      )}
    </div>
  );
};
