import React, { useEffect, useRef, useState } from 'react';
import { useColorMode, type ColorMode } from '../src/context/colorMode';
import { TIER_PALETTES, TIER_KEYS } from '../src/utils/tierColors';

const EYE_FILL_COLORS: Record<ColorMode, string | null> = {
  default:    null,
  redGreen:   '#6274A7',
  blueYellow: '#BE714B',
  monochrome: '#C9C5C9',
};

function eyeStrokeFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#ffffff';
}

const MODES: { id: ColorMode; name: string; sub: string }[] = [
  { id: 'default',    name: 'Default',     sub: '' },
  { id: 'redGreen',   name: 'Red-Green',   sub: 'Deuteranopia / Protanopia' },
  { id: 'blueYellow', name: 'Blue-Yellow', sub: 'Tritanopia' },
  { id: 'monochrome', name: 'Monochrome',  sub: 'Achromatopsia' },
];

export default function ColorblindToggle() {
  const { colorMode, setColorMode } = useColorMode();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      {open && (
        <div style={panelStyle} role="dialog" aria-label="Color vision mode selector">
          <div style={panelHeaderStyle}>Color Vision Mode</div>
          {MODES.map(m => {
            const selected = colorMode === m.id;
            const palette = TIER_PALETTES[m.id];
            return (
              <button
                key={m.id}
                onClick={() => { setColorMode(m.id); setOpen(false); }}
                style={{
                  ...optionStyle,
                  background: selected ? '#e8f5f8' : '#fff',
                  borderLeft: selected ? '3px solid #25C2DF' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {TIER_KEYS.map(k => (
                    <span
                      key={k}
                      title={k}
                      style={{
                        display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                        backgroundColor: palette[k],
                        border: '1px solid rgba(0,0,0,0.18)',
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: selected ? 700 : 500, fontSize: 13, color: '#152428' }}>
                    {m.name}
                  </span>
                  {m.sub && (
                    <span style={{ fontSize: 11, color: '#888' }}>{m.sub}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...toggleBtnStyle,
          background: EYE_FILL_COLORS[colorMode] ?? 'rgba(255,255,255,0.92)',
        }}
        title="Color vision accessibility settings"
        aria-label="Color vision accessibility settings"
        aria-expanded={open}
      >
        <EyeIcon color={EYE_FILL_COLORS[colorMode] ? eyeStrokeFor(EYE_FILL_COLORS[colorMode]!) : '#444'} />
      </button>
    </div>
  );
}

function EyeIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.42 12.713C2.284 12.497 2.216 12.39 2.178 12.223C2.149 12.099 2.149 11.901 2.178 11.777C2.216 11.61 2.284 11.503 2.42 11.287C3.546 9.505 6.895 5 12 5C17.105 5 20.455 9.505 21.58 11.287C21.716 11.503 21.785 11.61 21.823 11.777C21.851 11.901 21.851 12.099 21.823 12.223C21.785 12.39 21.716 12.497 21.58 12.713C20.455 14.495 17.105 19 12 19C6.895 19 3.546 14.495 2.42 12.713Z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
    </svg>
  );
}

const wrapperStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 28,
  right: 16,
  zIndex: 8500,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
};

const toggleBtnStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: '50%',
  border: '1px solid rgba(0,0,0,0.15)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
  border: '1px solid #e0e0e0',
  overflow: 'hidden',
  minWidth: 230,
};

const panelHeaderStyle: React.CSSProperties = {
  background: '#152428',
  color: '#D1EFF6',
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.4,
};

const optionStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '9px 14px',
  border: 'none',
  borderBottom: '1px solid #f0f0f0',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
