import { useRef, useEffect } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);

  // Keep mutable refs so native event handlers always see latest values without re-attachment
  const currentRef  = useRef(0);
  const onChangeRef = useRef(onChange);
  const fmtRef      = useRef<(v: number) => string>(() => '');
  const stepRef     = useRef(step);
  const minRef      = useRef(min);
  const maxRef      = useRef(max);

  const half    = Math.floor(VISIBLE / 2);
  const parsed  = parseFloat(value);
  const hasValue = value.trim() !== '' && Number.isFinite(parsed);
  const midpoint = defaultVal ?? (min + max) / 2;
  const current = hasValue ? Math.min(max, Math.max(min, parsed)) : midpoint;

  // Update refs every render
  currentRef.current  = current;
  onChangeRef.current = onChange;
  stepRef.current     = step;
  minRef.current      = min;
  maxRef.current      = max;
  fmtRef.current = (v: number) => {
    const s = stepRef.current, mn = minRef.current, mx = maxRef.current;
    const stepped = Math.round((v - mn) / s) * s + mn;
    const clamped = Math.min(mx, Math.max(mn, stepped));
    return decimals > 0 ? clamped.toFixed(decimals) : String(Math.round(clamped));
  };

  const isAbnormal = hasValue && normalRange
    ? current < normalRange[0] || current > normalRange[1]
    : false;

  function applyDelta(clientY: number) {
    if (!dragRef.current) return;
    const s = stepRef.current, mn = minRef.current, mx = maxRef.current;
    const deltaY  = dragRef.current.startY - clientY; // up = positive = increase
    const deltaVal = (deltaY / ITEM_H) * s;
    const raw    = dragRef.current.startVal + deltaVal;
    const stepped = Math.round((raw - mn) / s) * s + mn;
    const clamped = Math.min(mx, Math.max(mn, stepped));
    onChangeRef.current(fmtRef.current(clamped));
  }

  // Attach native listeners once — refs make them always see current values
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // ── Touch (non-passive so preventDefault works) ────────────────────────
    function onTouchStart(e: TouchEvent) {
      dragRef.current = { startY: e.touches[0].clientY, startVal: currentRef.current };
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragRef.current) return;
      e.preventDefault(); // stops page scroll — only works if listener is non-passive
      applyDelta(e.touches[0].clientY);
    }
    function onTouchEnd() { dragRef.current = null; }

    // ── Mouse wheel (non-passive so preventDefault works) ──────────────────
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const s = stepRef.current, mn = minRef.current, mx = maxRef.current;
      const delta = e.deltaY > 0 ? s : -s;
      const raw    = currentRef.current + delta;
      const stepped = Math.round((raw - mn) / s) * s + mn;
      const clamped = Math.min(mx, Math.max(mn, stepped));
      onChangeRef.current(fmtRef.current(clamped));
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    el.addEventListener('wheel',      onWheel,      { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
      el.removeEventListener('wheel',      onWheel);
    };
  }, []); // attach once; refs handle dynamic values

  // Mouse drag: document-level so drag continues outside the element boundary
  function handleMouseDown(e: React.MouseEvent) {
    dragRef.current = { startY: e.clientY, startVal: current };
    e.preventDefault();

    function handleMouseMove(ev: MouseEvent) { applyDelta(ev.clientY); }
    function handleMouseUp() {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup',   handleMouseUp);
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup',   handleMouseUp);
  }

  const fmt = fmtRef.current;
  const accentColor = isAbnormal ? '#dc2626' : 'var(--accent, #0b8278)';

  const items = Array.from({ length: VISIBLE }, (_, i) => {
    const offset = i - half;
    const v = current + offset * step;
    const inRange = v >= min - step * 0.5 && v <= max + step * 0.5;
    return { offset, label: inRange ? fmt(Math.min(max, Math.max(min, v))) : '' };
  });

  return (
    <div
      ref={containerRef}
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
      onMouseDown={handleMouseDown}
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
              color: isCenter ? (hasValue ? accentColor : '#9ca3af') : '#9ca3af',
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
