import React from 'react';
import { Team } from '../types/game';

interface ClubCrestProps {
  team: Team;
  size?: number;
  className?: string;
}

export const ClubCrest: React.FC<ClubCrestProps> = ({ team, size = 36, className = '' }) => {
  const { primaryColor, secondaryColor, textColor, pattern } = team.kit;
  const uid = `${team.id}-${size}`.replace(/[^a-zA-Z0-9_-]/g, '');

  const renderShapePath = () => {
    switch (team.crestShape) {
      case 'circle':
        return <circle cx="50" cy="52" r="41" />;
      case 'diamond':
        return <polygon points="50,6 92,52 50,96 8,52" />;
      case 'hexagon':
        return <polygon points="50,7 89,27 89,74 50,94 11,74 11,27" />;
      case 'shield':
      default:
        return <path d="M15,15 L85,15 L85,50 C85,76 50,94 50,94 C50,94 15,76 15,50 Z" />;
    }
  };

  const hasRoyalCrown = ['rma', 'cru', 'san'].includes(team.id);
  const starCount = team.ovr >= 89 ? 3 : team.ovr >= 83 ? 2 : 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 drop-shadow-md ${className}`}
      aria-label={`Escudo ${team.name}`}
    >
      <defs>
        <clipPath id={`clip-${uid}`}>{renderShapePath()}</clipPath>
        <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </linearGradient>
      </defs>

      {/* Top Championship Stars or Royal Crown */}
      {hasRoyalCrown ? (
        <path
          d="M34,13 L32,4 L41,9 L50,2 L59,9 L68,4 L66,13 Z"
          fill="#FACC15"
          stroke="#713F12"
          strokeWidth="1.5"
        />
      ) : (
        <g fill="#FACC15">
          {Array.from({ length: starCount }).map((_, idx) => {
            const cx = 50 + (idx - (starCount - 1) / 2) * 14;
            return (
              <polygon
                key={idx}
                points={`${cx},2 ${cx + 2},6 ${cx + 6},6 ${cx + 3},9 ${cx + 4},13 ${cx},10.5 ${cx - 4},13 ${cx - 3},9 ${cx - 6},6 ${cx - 2},6`}
              />
            );
          })}
        </g>
      )}

      {/* Main Heraldic Body */}
      <g clipPath={`url(#clip-${uid})`}>
        <rect x="0" y="0" width="100" height="100" fill={primaryColor} />

        {/* Custom Club Authentic Heraldry Accents */}
        {team.id === 'fcb' ? (
          <>
            {/* Blaugrana top quarters + St George Cross + Gold bar */}
            <rect x="0" y="15" width="50" height="33" fill="#FFFFFF" />
            <rect x="21" y="15" width="8" height="33" fill="#DC2626" />
            <rect x="0" y="27" width="50" height="8" fill="#DC2626" />
            <rect x="50" y="15" width="50" height="33" fill="#FACC15" />
            <rect x="58" y="15" width="8" height="33" fill="#DC2626" />
            <rect x="74" y="15" width="8" height="33" fill="#DC2626" />
            <rect x="0" y="55" width="100" height="45" fill="#004D98" />
            <rect x="18" y="55" width="16" height="45" fill="#A50044" />
            <rect x="44" y="55" width="14" height="45" fill="#A50044" />
            <rect x="70" y="55" width="16" height="45" fill="#A50044" />
          </>
        ) : team.id === 'bay' ? (
          <>
            <circle cx="50" cy="52" r="28" fill="#FFFFFF" />
            <polygon points="50,24 68,52 50,80 32,52" fill="#0066B2" />
            <polygon points="32,52 50,24 50,52" fill="#FFFFFF" />
            <polygon points="68,52 50,80 50,52" fill="#FFFFFF" />
          </>
        ) : team.id === 'fla' ? (
          <>
            <rect x="0" y="14" width="100" height="16" fill="#C8102E" />
            <rect x="0" y="30" width="100" height="16" fill="#111111" />
            <rect x="0" y="46" width="100" height="16" fill="#C8102E" />
            <rect x="0" y="62" width="100" height="16" fill="#111111" />
            <rect x="0" y="78" width="100" height="22" fill="#C8102E" />
            <rect x="15" y="15" width="32" height="30" fill="#111111" />
            <text x="31" y="35" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800" fontFamily="Barlow Condensed, sans-serif">
              CRF
            </text>
          </>
        ) : (
          <>
            {pattern === 'vertical_stripes' && (
              <>
                <rect x="20" y="0" width="16" height="100" fill={secondaryColor} />
                <rect x="64" y="0" width="16" height="16" fill={secondaryColor} />
                <rect x="64" y="0" width="16" height="100" fill={secondaryColor} />
              </>
            )}
            {pattern === 'horizontal_hoops' && (
              <>
                <rect x="0" y="24" width="100" height="16" fill={secondaryColor} />
                <rect x="0" y="62" width="100" height="16" fill={secondaryColor} />
              </>
            )}
            {pattern === 'halves' && <rect x="50" y="0" width="50" height="100" fill={secondaryColor} />}
            {pattern === 'sash' && (
              <polygon points="-10,75 75,-10 95,10 10,95" fill={secondaryColor} />
            )}
            {pattern === 'double_border' && (
              <circle cx="50" cy="52" r="26" fill="none" stroke={secondaryColor} strokeWidth="7" />
            )}
          </>
        )}

        <rect x="0" y="0" width="100" height="100" fill={`url(#gloss-${uid})`} />
      </g>

      {/* Gold/Metallic Outer Trim */}
      <g
        fill="none"
        stroke={secondaryColor === primaryColor ? '#FACC15' : '#E2E8F0'}
        strokeWidth="4.5"
      >
        {renderShapePath()}
      </g>
      <g fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.8">
        {renderShapePath()}
      </g>

      {/* Center Monogram Ribbon */}
      <rect x="20" y="41" width="60" height="23" rx="5" fill="rgba(7, 13, 10, 0.86)" stroke="#FACC15" strokeWidth="1.2" />
      <text
        x="50"
        y="57.5"
        textAnchor="middle"
        fill={textColor === '#111111' || textColor === '#111827' || textColor === '#0F172A' ? '#FFFFFF' : '#FFFFFF'}
        fontSize="17"
        fontWeight="800"
        fontFamily="Barlow Condensed, sans-serif"
        letterSpacing="1.2"
      >
        {team.shortCode}
      </text>
    </svg>
  );
};
