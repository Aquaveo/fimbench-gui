import React, { useEffect, useRef, useState } from 'react';
import { useColorMode, type ColorMode } from '../src/context/colorMode';
import { TIER_PALETTES, TIER_KEYS } from '../src/utils/tierColors';
import { pickContrastColor } from '../src/utils/contrast';
import { COLORS } from '../src/theme';

const EYE_FILL_COLORS: Record<ColorMode, string | null> = {
  default:    null,
  redGreen:   '#6274A7',
  blueYellow: '#BE714B',
  monochrome: '#C9C5C9',
};

// Slightly higher threshold (150 vs the default 128) tuned for the
// medium-saturation fill colors above — picks white strokes more aggressively.
const eyeStrokeFor = (hex: string) => pickContrastColor(hex, { threshold: 150 });

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
                  borderLeft: selected ? `0.1875rem solid ${COLORS.brand}` : '0.1875rem solid transparent',
                }}
              >
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
                  {TIER_KEYS.map(k => (
                    <span
                      key={k}
                      title={k}
                      style={{
                        display: 'inline-block', width: '0.75rem', height: '0.75rem', borderRadius: '50%',
                        backgroundColor: palette[k],
                        border: '0.0625rem solid rgba(0,0,0,0.18)',
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
                  <span style={{ fontWeight: selected ? 700 : 500, fontSize: '0.8125rem', color: COLORS.ink }}>
                    {m.name}
                  </span>
                  {m.sub && (
                    <span style={{ fontSize: '0.6875rem', color: '#888' }}>{m.sub}</span>
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
        <AccessibilityIcon color={EYE_FILL_COLORS[colorMode] ? eyeStrokeFor(EYE_FILL_COLORS[colorMode]!) : '#444'} />
      </button>
    </div>
  );
}

function AccessibilityIcon({ color }: { color: string }) {
  return (
    <svg width="1.125rem" height="1.125rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 6.50024C13.5 7.32867 12.8284 8.00024 12 8.00024C11.1716 8.00024 10.5 7.32867 10.5 6.50024C10.5 5.67182 11.1716 5.00024 12 5.00024C12.8284 5.00024 13.5 5.67182 13.5 6.50024Z" fill={color} />
      <path d="M6.05132 8.68402C5.87667 9.20796 6.15983 9.77428 6.68377 9.94893C6.85906 10.0071 7.03576 10.0613 7.21265 10.1143C7.5363 10.2114 7.98911 10.3408 8.50746 10.4704C9.08908 10.6158 9.78094 10.7687 10.4783 10.8727C10.4323 11.7654 10.3205 12.4059 10.2166 12.8309L8.10557 17.053C7.85858 17.547 8.05881 18.1477 8.55279 18.3947C9.04677 18.6417 9.64744 18.4414 9.89443 17.9475L12 13.7363L14.1056 17.9475C14.3526 18.4414 14.9532 18.6417 15.4472 18.3947C15.9412 18.1477 16.1414 17.547 15.8944 17.053L13.7834 12.8309C13.6795 12.4059 13.5677 11.7654 13.5217 10.8727C14.2191 10.7687 14.9109 10.6158 15.4925 10.4704C16.0109 10.3408 16.4637 10.2114 16.7873 10.1143C16.963 10.0616 17.1384 10.0077 17.3125 9.95015C17.8261 9.77972 18.1201 9.19822 17.9487 8.68402C17.7741 8.16012 17.2078 7.87697 16.6839 8.05151C16.5277 8.10318 16.3703 8.15138 16.2127 8.19867C15.9113 8.28907 15.4891 8.40969 15.0075 8.5301C14.0216 8.77657 12.8709 9.00024 12 9.00024C11.1291 9.00024 9.97843 8.77657 8.99254 8.5301C8.51089 8.40969 8.0887 8.28907 7.78735 8.19867C7.63167 8.15196 7.47632 8.10404 7.32186 8.05342C6.80235 7.88161 6.22544 8.16164 6.05132 8.68402Z" fill={color} />
      <path fillRule="evenodd" clipRule="evenodd" d="M23 12.0002C23 18.0754 18.0751 23.0002 12 23.0002C5.92487 23.0002 1 18.0754 1 12.0002C1 5.92511 5.92487 1.00024 12 1.00024C18.0751 1.00024 23 5.92511 23 12.0002ZM3.00683 12.0002C3.00683 16.967 7.03321 20.9934 12 20.9934C16.9668 20.9934 20.9932 16.967 20.9932 12.0002C20.9932 7.03345 16.9668 3.00707 12 3.00707C7.03321 3.00707 3.00683 7.03345 3.00683 12.0002Z" fill={color} />
    </svg>
  );
}

const wrapperStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '1.75rem',
  right: '1rem',
  zIndex: 8500,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '0.5rem',
};

const toggleBtnStyle: React.CSSProperties = {
  width: '2.375rem',
  height: '2.375rem',
  borderRadius: '50%',
  border: '0.0625rem solid rgba(0,0,0,0.15)',
  boxShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '0.5rem',
  boxShadow: '0 0.25rem 1.25rem rgba(0,0,0,0.18)',
  border: '0.0625rem solid #e0e0e0',
  overflow: 'hidden',
  minWidth: '14.375rem',
};

const panelHeaderStyle: React.CSSProperties = {
  background: COLORS.ink,
  color: COLORS.inkLight,
  padding: '0.5rem 0.875rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.025rem',
};

const optionStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5625rem 0.875rem',
  border: 'none',
  borderBottom: '0.0625rem solid #f0f0f0',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
