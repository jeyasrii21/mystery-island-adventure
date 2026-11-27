import React from 'react';
import {
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  ArrowRight,
  Home,
  Compass,
  Coins,
  Gem,
  Skull,
} from 'lucide-react';
import { LEVELS } from '../game/levels';
import { GameHudState } from '../game/types';

interface GameOverlaysProps {
  hud: GameHudState;
  selectedStartLevel: number;
  muted: boolean;
  onSelectStartLevel: (idx: number) => void;
  onStart: () => void;
  onResume: () => void;
  onRestartLevel: () => void;
  onRestartAdventure: () => void;
  onNextLevel: () => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
}

export const GameOverlays: React.FC<GameOverlaysProps> = ({
  hud,
  selectedStartLevel,
  muted,
  onSelectStartLevel,
  onStart,
  onResume,
  onRestartLevel,
  onRestartAdventure,
  onNextLevel,
  onReturnTitle,
  onToggleMute,
}) => {
  if (hud.status === 'playing') return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/60">
      {/* START SCREEN */}
      {hud.status === 'start' && (
        <div className="w-full max-w-2xl bg-slate-950/92 border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
                <Compass className="w-4 h-4" />
                <span>3D Island Expedition</span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span>5 Levels</span>
                {hud.highScore > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-500">
                      ·
                    </span>
                    <span className="font-mono-nums text-emerald-300">
                      Best {hud.highScore.toLocaleString()}
                    </span>
                  </>
                )}
              </div>
              <h1 className="mt-2 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Mystery Island Adventure
              </h1>
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
              className="h-11 w-11 shrink-0 rounded-xl bg-slate-900 border border-white/15 hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              {muted ? (
                <VolumeX className="w-5 h-5 text-rose-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-emerald-400" />
              )}
            </button>
          </div>

          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
            Explore sunlit coves, dense forests, roaring waterfalls, and ancient
            mountain shrines. Collect golden coins and hidden chests, outsmart
            island guardians, and unlock the portal in each region.
          </p>

          {/* Level Selector */}
          <div className="mt-6">
            <div className="text-xs font-semibold text-slate-400 mb-2">
              Select Starting Region
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {LEVELS.map((lvl, idx) => {
                const active = selectedStartLevel === idx;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => onSelectStartLevel(idx)}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                        : 'bg-slate-900/90 text-slate-200 border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-[11px] opacity-80">Level {lvl.id}</div>
                    <div className="text-xs font-semibold truncate">
                      {lvl.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls Summary */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                <strong className="text-white">WASD</strong> Move
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <strong className="text-white">Space</strong> Jump
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <strong className="text-white">Drag / Q E</strong> Camera
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>Touch joystick on mobile</span>
            </div>

            <button
              type="button"
              onClick={onStart}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>Start Adventure</span>
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {hud.status === 'paused' && (
        <div className="w-full max-w-md bg-slate-950/95 border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-slate-100">
          <div className="text-xs text-amber-300 font-semibold">
            Level {hud.levelIndex + 1} · {hud.levelName}
          </div>
          <h2 className="mt-1 font-display text-3xl font-bold text-white">
            Game Paused
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Current Score:{' '}
            <span className="font-mono-nums font-bold text-amber-300">
              {hud.score.toLocaleString()}
            </span>
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Resume</span>
            </button>

            <button
              type="button"
              onClick={onRestartLevel}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart Level</span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {muted ? (
                <>
                  <VolumeX className="w-4 h-4 text-rose-400" />
                  <span>Unmute Audio</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>Mute Audio</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-3 px-4 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-white/10 text-slate-300 font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Back to Title</span>
            </button>
          </div>
        </div>
      )}

      {/* LEVEL COMPLETE MODAL */}
      {hud.status === 'levelComplete' && (
        <div className="w-full max-w-md bg-slate-950/95 border border-emerald-400/30 rounded-2xl p-6 sm:p-7 shadow-2xl text-slate-100">
          <div className="text-xs text-emerald-300 font-semibold">
            Level {hud.levelIndex + 1} Cleared
          </div>
          <h2 className="mt-1 font-display text-3xl font-bold text-white">
            {hud.levelName} Complete
          </h2>

          <div className="mt-5 space-y-2.5 text-sm border-y border-white/10 py-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                Coins Collected
              </span>
              <span className="font-mono-nums font-bold text-white">
                {hud.coinsCollected} / {hud.coinsTotal}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 flex items-center gap-2">
                <Gem className="w-4 h-4 text-emerald-400" />
                Treasure Chests
              </span>
              <span className="font-mono-nums font-bold text-white">
                {hud.chestsCollected} / {hud.chestsTotal}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-300">Total Score</span>
              <span className="font-mono-nums text-lg font-bold text-amber-300">
                {hud.score.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onRestartLevel}
              className="sm:flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Replay</span>
            </button>
            <button
              type="button"
              onClick={onNextLevel}
              className="sm:flex-[1.5] py-3 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <span>Next Level</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {hud.status === 'gameover' && (
        <div className="w-full max-w-md bg-slate-950/95 border border-rose-500/35 rounded-2xl p-6 sm:p-7 shadow-2xl text-slate-100">
          <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold">
            <Skull className="w-4 h-4" />
            <span>Expedition Ended</span>
          </div>
          <h2 className="mt-1 font-display text-3xl font-bold text-white">
            Game Over
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Reached Level {hud.levelIndex + 1} · {hud.levelName}
          </p>

          <div className="mt-5 space-y-2 text-sm border-y border-white/10 py-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Final Score</span>
              <span className="font-mono-nums text-lg font-bold text-amber-300">
                {hud.score.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Best Score</span>
              <span className="font-mono-nums font-bold text-emerald-300">
                {hud.highScore.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onRestartLevel}
              className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Try Level Again</span>
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Main Menu</span>
            </button>
          </div>
        </div>
      )}

      {/* VICTORY MODAL */}
      {hud.status === 'victory' && (
        <div className="w-full max-w-lg bg-slate-950/95 border border-amber-400/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-100">
          <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
            <Trophy className="w-4 h-4" />
            <span>All 5 Regions Conquered</span>
          </div>
          <h2 className="mt-1 font-display text-3xl sm:text-4xl font-extrabold text-white">
            Island Crown Claimed!
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            You mastered Mystery Island across every forest, river gorge, and
            volcanic summit.
          </p>

          <div className="mt-5 space-y-2.5 text-sm border-y border-white/10 py-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Final Score</span>
              <span className="font-mono-nums text-xl font-bold text-amber-300">
                {hud.score.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">High Score</span>
              <span className="font-mono-nums font-bold text-emerald-300">
                {hud.highScore.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Total Coins Found</span>
              <span className="font-mono-nums font-bold text-white">
                {hud.totalCoinsAllLevels}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Treasure Chests Opened</span>
              <span className="font-mono-nums font-bold text-white">
                {hud.totalChestsAllLevels}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onRestartAdventure}
              className="sm:flex-1 py-3 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again</span>
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="sm:flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Main Menu</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
