import type React from 'react';

// Shared tier-colored pill used in the docs page (tier definitions) and the
// welcome modal (tier legend). Padding standardized at 0.125rem 0.625rem.
export default function TierBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0.125rem 0.625rem', borderRadius: '0.75rem',
      backgroundColor: color, color: '#fff', fontSize: '0.75rem', fontWeight: 600,
    }}>
      {children}
    </span>
  );
}
