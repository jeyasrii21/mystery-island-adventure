import React, { useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface TouchControlsProps {
  onJoystick: (x: number, y: number, active: boolean) => void;
  onJumpPress: () => void;
  onJumpRelease: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onJoystick,
  onJumpPress,
  onJumpRelease,
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const maxRadius = 38;

  const updateStick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobPos({ x: dx, y: dy });
    onJoystick(dx / maxRadius, dy / maxRadius, true);
  };

  const handlePadDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (activePointerRef.current !== null) return;
    activePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateStick(e.clientX, e.clientY);
  };

  const handlePadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerRef.current) return;
    e.stopPropagation();
    updateStick(e.clientX, e.clientY);
  };

  const handlePadUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerRef.current) return;
    e.stopPropagation();
    activePointerRef.current = null;
    setKnobPos({ x: 0, y: 0 });
    onJoystick(0, 0, false);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-20 flex items-end justify-between px-5 pointer-events-none select-none">
      {/* Virtual Analog Thumbstick */}
      <div
        ref={padRef}
        onPointerDown={handlePadDown}
        onPointerMove={handlePadMove}
        onPointerUp={handlePadUp}
        onPointerCancel={handlePadUp}
        aria-label="Movement joystick"
        className="pointer-events-auto relative w-28 h-28 rounded-full bg-slate-950/70 border border-white/20 flex items-center justify-center touch-none shadow-lg"
      >
        <div className="w-12 h-12 rounded-full border border-white/15 pointer-events-none" />
        <div
          className="absolute w-12 h-12 rounded-full bg-amber-400/90 border-2 border-white shadow-md pointer-events-none"
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
        />
      </div>

      {/* Jump Action Button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          onJumpPress();
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          onJumpRelease();
        }}
        onPointerCancel={(e) => {
          e.stopPropagation();
          onJumpRelease();
        }}
        aria-label="Jump"
        className="pointer-events-auto w-20 h-20 rounded-full bg-emerald-500/90 active:bg-emerald-400 text-slate-950 font-display font-bold text-sm border-2 border-white/80 shadow-lg flex flex-col items-center justify-center gap-0.5 touch-none transition-transform active:scale-95"
      >
        <ArrowUp className="w-6 h-6 stroke-[2.5]" />
        <span>Jump</span>
      </button>
    </div>
  );
};
