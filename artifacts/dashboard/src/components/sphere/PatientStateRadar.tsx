// ─── PatientStateRadar ────────────────────────────────────────────────────────
//
// 13-axis SVG radar / spider chart for the 360° Clinical Intelligence Sphere.
//
// Three concentric polygons:
//   1. Target state (dashed, inside — where we want the patient to be)
//   2. Risk threshold ring (amber, subtle fill)
//   3. Current state (solid, coloured by overall burden)
//
// Geometric read: each axis is a spoke on a bicycle wheel. The honeycomb
// template determines where each spoke lives; the scorer places the bead
// on each spoke; the radar is the shape those beads form.

import React, { useState } from 'react';
import type { PatientStateVector, AxisScore } from '@workspace/patient-state';

interface Props {
  vector: PatientStateVector;
  axes: { id: number; name: string; subtitle: string; color: string }[];
  size?: number;
}

const AXIS_COUNT = 13;
const TAU = 2 * Math.PI;
// Start at top (-90°) so axis 1 (ANATOMY) is at the top
const startAngle = -Math.PI / 2;

function polarToXY(cx: number, cy: number, r: number, angleIndex: number): [number, number] {
  const angle = startAngle + (TAU * angleIndex) / AXIS_COUNT;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function polygonPoints(
  cx: number, cy: number, maxR: number,
  values: number[],      // 0–100
): string {
  return values
    .map((v, i) => {
      const r = (v / 100) * maxR;
      const [x, y] = polarToXY(cx, cy, r, i);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function PatientStateRadar({ vector, axes, size = 420 }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;

  // Ring radii for grid circles (25 / 50 / 75 / 100)
  const rings = [25, 50, 75, 100];

  // Sorted by axis id so index aligns with spoke position
  const sorted = [...vector].sort((a, b) => a.axisId - b.axisId);
  const scores  = sorted.map(a => a.score);
  const targets = sorted.map(a => a.target);
  const thresholds = sorted.map(a => a.riskThreshold);

  // Overall burden colour
  const mean = scores.length
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : 0;
  const fillColor =
    mean < 30 ? '#34d399'
    : mean < 55 ? '#fbbf24'
    : mean < 75 ? '#f97316'
    : '#ef4444';

  const hoveredAxis = hovered !== null ? sorted[hovered] : null;
  const hoveredDef  = hovered !== null ? axes[hovered] : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        {/* ── Background grid rings ────────────────────────────────────────── */}
        {rings.map(pct => {
          const r = (pct / 100) * maxR;
          return (
            <circle
              key={pct}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={pct === 100 ? '#e5e7eb' : '#f3f4f6'}
              strokeWidth={pct === 100 ? 1.5 : 0.8}
              strokeDasharray={pct < 100 ? '3 3' : undefined}
            />
          );
        })}

        {/* ── Spokes ──────────────────────────────────────────────────────── */}
        {axes.map((ax, i) => {
          const [x, y] = polarToXY(cx, cy, maxR, i);
          return (
            <line
              key={ax.id}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke="#e5e7eb" strokeWidth={0.8}
            />
          );
        })}

        {/* ── Risk threshold polygon (amber, subtle) ─────────────────────── */}
        <polygon
          points={polygonPoints(cx, cy, maxR, thresholds)}
          fill="#fef3c730"
          stroke="#f59e0b"
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* ── Target state polygon (dashed, grey) ─────────────────────────── */}
        <polygon
          points={polygonPoints(cx, cy, maxR, targets)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.2}
          strokeDasharray="5 3"
        />

        {/* ── Current state polygon ────────────────────────────────────────── */}
        <polygon
          points={polygonPoints(cx, cy, maxR, scores)}
          fill={fillColor + '35'}
          stroke={fillColor}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* ── Axis dots + labels ──────────────────────────────────────────── */}
        {axes.map((ax, i) => {
          const score = sorted[i]?.score ?? 0;
          const r = (score / 100) * maxR;
          const [dotX, dotY] = polarToXY(cx, cy, r, i);
          const [lblX, lblY] = polarToXY(cx, cy, maxR + 18, i);
          const [subX, subY] = polarToXY(cx, cy, maxR + 30, i);

          const isHov = hovered === i;
          const atRisk = (sorted[i]?.score ?? 0) >= (sorted[i]?.riskThreshold ?? 50);

          return (
            <g
              key={ax.id}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* dot at patient score */}
              <circle
                cx={dotX} cy={dotY} r={isHov ? 5 : 4}
                fill={atRisk ? '#ef4444' : ax.color}
                stroke="#fff"
                strokeWidth={1.5}
              />

              {/* axis label */}
              <text
                x={lblX} y={lblY}
                fontSize={isHov ? 9 : 8}
                fontWeight={isHov ? 700 : 500}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={atRisk ? '#ef4444' : '#374151'}
              >
                {ax.name}
              </text>
              <text
                x={subX} y={subY}
                fontSize={6.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#9ca3af"
              >
                {ax.subtitle}
              </text>
            </g>
          );
        })}

        {/* ── Centre burden text ──────────────────────────────────────────── */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={28} fontWeight={700} fill={fillColor}
        >
          {mean}
        </text>
        <text
          x={cx} y={cy + 14}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fill="#6b7280" letterSpacing={1}
        >
          BURDEN
        </text>
      </svg>

      {/* ── Hover tooltip ─────────────────────────────────────────────────── */}
      {hoveredAxis && hoveredDef && (
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          background: '#1f2937', color: '#f9fafb', borderRadius: 8,
          padding: '8px 12px', fontSize: 11, minWidth: 200, maxWidth: 280,
          pointerEvents: 'none', zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, color: hoveredDef.color, marginBottom: 4 }}>
            {hoveredDef.name} — {hoveredAxis.label} ({hoveredAxis.score})
          </div>
          {hoveredAxis.evidence.map((e, i) => (
            <div key={i} style={{ opacity: 0.85, marginTop: 2 }}>• {e}</div>
          ))}
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4, fontSize: 10, color: '#6b7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke={fillColor} strokeWidth={2} /></svg>
          Patient state
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="5 3" /></svg>
          Target
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" /></svg>
          Risk threshold
        </span>
      </div>
    </div>
  );
}
