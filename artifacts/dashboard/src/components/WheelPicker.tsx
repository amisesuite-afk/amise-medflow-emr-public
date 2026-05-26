import { useRef } from 'react';

const ITEM_H = 44;
const VISIBLE = 5; // must be odd

interface WheelPickerProps {
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  defaultVal?: number;
  normalRange?: [number, number];
}

export default function WheelPicker({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  defaultVal,
  normalRange,
}: WheelPickerProps) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);
  const half = Math.floor(VISIBLE / 2);

  const parsed = parseFloat(value);
  const hasValue = value.trim() !== '' && Number.isFinite(parsed);
  const midpoint = defaultVal ?? (min + max) / 2;
  const current = hasValue ? Math.min(max, Math.max(min, parsed)) : midpoint;

  const isAbnormal = hasValue && normalRange
    ? current < normalRange[0] || current > normalRange[1]
    : false;

  function fmt(v: number): string {
    const stepped = Math.round((v - min) / step) * step + min;
    const clamped = Math.min(max, Math.max(min, stepped));
    return decimals > 0 ? clamped.toFixed(decimals) : String(Math.round(clamped));
  }

  function onMove(clientY: number) {
    if (!dragRef.current) return;
    const deltaY = dragRef.current.startY - clientY; // up = positive = value increases
    const deltaVal = (deltaY / ITEM_H) * step;
    const raw = dragRef.current.startVal + deltaVal;
    const stepped = Math.round((raw - min) / step) * step + min;
    const clamped = Math.min(max, Math.max(min, stepped));
    onChange(fmt(clamped));
  }

  const items = Array.from({ length: VISIBLE }, (_, i) => {
    const offset = i - half;
    const v = current + offset * step;
    const inRange = v >= min - step * 0.5 && v <= max + step * 0.5;
    return { offset, label: inRange ? fmt(Math.min(max, Math.max(min, v))) : '' };
  });

  const accentColor = isAbnormal ? '#dc2626' : 'var(--accent, #0b8278)';

  return (
    <div
      style={{
        position: 'relative',
        height: VISIBLE * ITEM_H,
        width: 82,
        overflow: 'hidden',
        cursor: 'ns-resize',
        userSelect: 'none',
        touchAction: 'none',
        borderRadius: 10,
      }}
      onMouseDown={e => {
        dragRef.current = { startY: e.clientY, startVal: current };
        e.preventDefault();
      }}
      onMouseMove={e => { if (dragRef.current) onMove(e.clientY); }}
      onMouseUp={() => { dragRef.current = null; }}
      onMouseLeave={() => { dragRef.current = null; }}
      onTouchStart={e => {
        dragRef.current = { startY: e.touches[0].clientY, startVal: current };
      }}
      onTouchMove={e => {
        onMove(e.touches[0].clientY);
        e.preventDefault();
      }}
      onTouchEnd={() => { dragRef.current = null; }}
    >
      {/* Selection ring */}
      <div style={{
        position: 'absolute',
        top: half * ITEM_H,
        height: ITEM_H,
        left: 4, right: 4,
        border: `2px solid ${accentColor}`,
        borderRadius: 7,
        pointerEvents: 'none',
        zIndex: 2,
        background: isAbnormal
          ? 'rgba(220,38,38,.07)'
          : hasValue
            ? 'rgba(11,130,120,.07)'
            : 'transparent',
        transition: 'border-color .15s, background .15s',
      }} />

      {/* Top fade */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: half * ITEM_H + 10,
        background: 'linear-gradient(to bottom, var(--bg,#fff) 35%, transparent)',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: half * ITEM_H + 10,
        background: 'linear-gradient(to top, var(--bg,#fff) 35%, transparent)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {items.map(({ offset, label }) => {
        const isCenter = offset === 0;
        const dist = Math.abs(offset);
        return (
          <div
            key={offset}
            style={{
              position: 'absolute',
              top: (half + offset) * ITEM_H,
              left: 0, right: 0,
              height: ITEM_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isCenter ? 22 : dist === 1 ? 15 : 12,
              fontWeight: isCenter ? 800 : 400,
              fontVariantNumeric: 'tabular-nums',
              color: isCenter
                ? (hasValue ? accentColor : '#9ca3af')
                : '#9ca3af',
              opacity: dist === 2 ? 0.4 : 1,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
