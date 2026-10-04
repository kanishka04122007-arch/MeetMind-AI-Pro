import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showSubtitle = true }) => {
  const iconDimensions = {
    sm: { width: 32, height: 32, fontSize: '1.25rem', subSize: '0.75rem' },
    md: { width: 42, height: 42, fontSize: '1.65rem', subSize: '0.85rem' },
    lg: { width: 52, height: 52, fontSize: '2.1rem', subSize: '0.95rem' },
  }[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      {/* SVG Twin Wave 'M' Logo Mark */}
      <svg
        width={iconDimensions.width}
        height={iconDimensions.height}
        viewBox="0 0 54 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.35))' }}
      >
        <defs>
          <linearGradient id="meetMindGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="45%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
          <linearGradient id="meetMindBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EDE9FE" />
            <stop offset="100%" stopColor="#E0F2FE" />
          </linearGradient>
        </defs>
        <rect width="54" height="54" rx="16" fill="url(#meetMindBg)" />
        <path
          d="M13 36 C13 26, 18 17, 23 24 C25.5 27.5, 27.5 32, 29 24 C33.5 16, 41 26, 41 36"
          stroke="url(#meetMindGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: iconDimensions.fontSize,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          MeetMind <span style={{ color: '#6366F1', WebkitTextFillColor: '#6366F1' }}>AI</span>
        </span>
        {showSubtitle && (
          <span
            style={{
              fontSize: iconDimensions.subSize,
              color: '#64748B',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              marginTop: '2px',
            }}
          >
            Smarter Meetings. Better Decisions.
          </span>
        )}
      </div>
    </div>
  );
};
