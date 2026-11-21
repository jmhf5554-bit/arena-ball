import React from 'react';
import { Team } from '../types/game';

interface ClubCrestProps {
  team: Team;
  size?: number;
  className?: string;
}

export const ClubCrest: React.FC<ClubCrestProps> = ({ team, size = 36, className = '' }) => {
  const { primaryColor, secondaryColor, pattern } = team.kit;
  const uid = `${team.id}-${size}`.replace(/[^a-zA-Z0-9_-]/g, '');

  const renderShapePath = () => {
    // Specific real-world silhouettes for iconic Brazilian clubs & national flags
    if (team.id === 'spfc') {
      return <path d="M12,18 L88,18 L88,38 L50,94 L12,38 Z" />;
    }
    if (team.id === 'pal' || team.id === 'cru' || team.id === 'int' || team.id === 'rma' || team.id === 'bay' || team.isNationalTeam) {
      return <circle cx="50" cy="52" r="41" />;
    }
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

  const hasRoyalCrown = ['rma', 'cru', 'san', 'wc-esp', 'wc-eng'].includes(team.id);
  const starCount =
    team.id === 'wc-bra'
      ? 5
      : team.id === 'wc-ita' || team.id === 'wc-ger'
        ? 4
        : team.id === 'wc-arg'
          ? 3
          : team.id === 'wc-fra' || team.id === 'wc-uru'
            ? 2
            : team.ovr >= 89
              ? 3
              : team.ovr >= 83
                ? 2
                : 1;

  const renderNationalFlagBody = () => {
    const fc = team.flagCode || team.shortCode;
    switch (fc) {
      case 'BRA':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#009C3B" />
            <polygon points="50,20 86,52 50,84 14,52" fill="#FFDF00" />
            <circle cx="50" cy="52" r="18" fill="#002776" />
            <path d="M33,49 Q50,43 67,54" fill="none" stroke="#FFFFFF" strokeWidth="3.5" />
          </>
        );
      case 'ARG':
        return (
          <>
            <rect x="0" y="0" width="100" height="36" fill="#74ACDF" />
            <rect x="0" y="36" width="100" height="32" fill="#FFFFFF" />
            <rect x="0" y="68" width="100" height="32" fill="#74ACDF" />
            <circle cx="50" cy="52" r="11" fill="#F6B40E" stroke="#92400E" strokeWidth="1.2" />
          </>
        );
      case 'FRA':
        return (
          <>
            <rect x="0" y="0" width="37" height="100" fill="#002395" />
            <rect x="37" y="0" width="26" height="100" fill="#FFFFFF" />
            <rect x="63" y="0" width="37" height="100" fill="#ED2939" />
          </>
        );
      case 'ESP':
        return (
          <>
            <rect x="0" y="0" width="100" height="30" fill="#AA151B" />
            <rect x="0" y="30" width="100" height="44" fill="#F1BF00" />
            <rect x="0" y="74" width="100" height="26" fill="#AA151B" />
            <rect x="30" y="40" width="16" height="24" rx="4" fill="#AA151B" stroke="#92400E" strokeWidth="1.5" />
          </>
        );
      case 'GER':
        return (
          <>
            <rect x="0" y="0" width="100" height="37" fill="#111111" />
            <rect x="0" y="37" width="100" height="30" fill="#DD0000" />
            <rect x="0" y="67" width="100" height="33" fill="#FFCE00" />
          </>
        );
      case 'ENG':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <rect x="42" y="0" width="16" height="100" fill="#CE1124" />
            <rect x="0" y="44" width="100" height="16" fill="#CE1124" />
          </>
        );
      case 'POR':
        return (
          <>
            <rect x="0" y="0" width="42" height="100" fill="#006600" />
            <rect x="42" y="0" width="58" height="100" fill="#FF0000" />
            <circle cx="42" cy="52" r="14" fill="#FFCC00" />
            <rect x="36" y="45" width="12" height="14" rx="2" fill="#FFFFFF" stroke="#003399" strokeWidth="2.5" />
          </>
        );
      case 'ITA':
        return (
          <>
            <rect x="0" y="0" width="37" height="100" fill="#009246" />
            <rect x="37" y="0" width="26" height="100" fill="#FFFFFF" />
            <rect x="63" y="0" width="37" height="100" fill="#CE2B37" />
          </>
        );
      case 'NED':
        return (
          <>
            <rect x="0" y="0" width="100" height="37" fill="#AE1C28" />
            <rect x="0" y="37" width="100" height="30" fill="#FFFFFF" />
            <rect x="0" y="67" width="100" height="33" fill="#21468B" />
            <circle cx="50" cy="52" r="10" fill="#FF6B00" opacity="0.9" />
          </>
        );
      case 'URU':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <rect x="0" y="22" width="100" height="12" fill="#0038A8" />
            <rect x="0" y="46" width="100" height="12" fill="#0038A8" />
            <rect x="0" y="70" width="100" height="12" fill="#0038A8" />
            <rect x="0" y="0" width="46" height="46" fill="#FFFFFF" />
            <circle cx="30" cy="30" r="10" fill="#FCD116" />
          </>
        );
      case 'CRO':
        return (
          <>
            <rect x="0" y="0" width="100" height="34" fill="#FF0000" />
            <rect x="0" y="34" width="100" height="34" fill="#FFFFFF" />
            <rect x="0" y="68" width="100" height="32" fill="#171796" />
            {[0, 1, 2, 3].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={28 + c * 11}
                  y={30 + r * 11}
                  width="11"
                  height="11"
                  fill={(r + c) % 2 === 0 ? '#FF0000' : '#FFFFFF'}
                />
              ))
            )}
          </>
        );
      case 'MAR':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#C1272D" />
            <polygon
              points="50,30 56,47 73,47 59,57 64,74 50,64 36,74 41,57 27,47 44,47"
              fill="none"
              stroke="#006233"
              strokeWidth="4"
            />
          </>
        );
      case 'JPN':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <circle cx="50" cy="52" r="21" fill="#BC002D" />
          </>
        );
      case 'KOR':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <circle cx="50" cy="52" r="20" fill="#CD2E3A" />
            <path d="M30,52 A20,20 0 0,0 70,52 A10,10 0 0,0 50,52 A10,10 0 0,1 30,52 Z" fill="#0047A0" />
            <rect x="20" y="23" width="14" height="4" transform="rotate(-35 27 25)" fill="#111111" />
            <rect x="66" y="23" width="14" height="4" transform="rotate(35 73 25)" fill="#111111" />
          </>
        );
      case 'USA':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            {[12, 28, 44, 60, 76, 92].map((y) => (
              <rect key={y} x="0" y={y} width="100" height="8" fill="#B22234" />
            ))}
            <rect x="0" y="0" width="50" height="52" fill="#3C3B6E" />
            <circle cx="24" cy="26" r="3" fill="#FFFFFF" />
            <circle cx="38" cy="26" r="3" fill="#FFFFFF" />
            <circle cx="31" cy="38" r="3" fill="#FFFFFF" />
            <circle cx="24" cy="42" r="2.5" fill="#FFFFFF" />
            <circle cx="38" cy="42" r="2.5" fill="#FFFFFF" />
          </>
        );
      case 'MEX':
        return (
          <>
            <rect x="0" y="0" width="37" height="100" fill="#006847" />
            <rect x="37" y="0" width="26" height="100" fill="#FFFFFF" />
            <rect x="63" y="0" width="37" height="100" fill="#CE1126" />
            <circle cx="50" cy="52" r="9" fill="#92400E" />
          </>
        );
      case 'COL':
        return (
          <>
            <rect x="0" y="0" width="100" height="54" fill="#FCD116" />
            <rect x="0" y="54" width="100" height="23" fill="#003893" />
            <rect x="0" y="77" width="100" height="23" fill="#CE1126" />
          </>
        );
      case 'ECU':
        return (
          <>
            <rect x="0" y="0" width="100" height="54" fill="#FFDD00" />
            <rect x="0" y="54" width="100" height="23" fill="#034EA2" />
            <rect x="0" y="77" width="100" height="23" fill="#ED1C24" />
            <circle cx="50" cy="52" r="9" fill="#FFFFFF" stroke="#92400E" strokeWidth="2" />
          </>
        );
      case 'BEL':
        return (
          <>
            <rect x="0" y="0" width="37" height="100" fill="#111111" />
            <rect x="37" y="0" width="26" height="100" fill="#FAE042" />
            <rect x="63" y="0" width="37" height="100" fill="#ED2939" />
          </>
        );
      case 'SEN':
        return (
          <>
            <rect x="0" y="0" width="37" height="100" fill="#00853F" />
            <rect x="37" y="0" width="26" height="100" fill="#FDEF42" />
            <rect x="63" y="0" width="37" height="100" fill="#E31B23" />
            <polygon points="50,41 53,49 61,49 55,54 57,62 50,57 43,62 45,54 39,49 47,49" fill="#00853F" />
          </>
        );
      case 'SUI':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#DA291C" />
            <rect x="42" y="28" width="16" height="48" fill="#FFFFFF" />
            <rect x="26" y="44" width="48" height="16" fill="#FFFFFF" />
          </>
        );
      case 'DEN':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#C8102E" />
            <rect x="34" y="0" width="13" height="100" fill="#FFFFFF" />
            <rect x="0" y="45" width="100" height="13" fill="#FFFFFF" />
          </>
        );
      case 'TUR':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#E30A17" />
            <circle cx="44" cy="52" r="16" fill="#FFFFFF" />
            <circle cx="49" cy="52" r="13" fill="#E30A17" />
            <polygon points="64,43 66,49 72,49 67,53 69,59 64,55 59,59 61,53 56,49 62,49" fill="#FFFFFF" />
          </>
        );
      case 'NGA':
        return (
          <>
            <rect x="0" y="0" width="37" height="100" fill="#008751" />
            <rect x="37" y="0" width="26" height="100" fill="#FFFFFF" />
            <rect x="63" y="0" width="37" height="100" fill="#008751" />
          </>
        );
      case 'EGY':
        return (
          <>
            <rect x="0" y="0" width="100" height="37" fill="#CE1126" />
            <rect x="0" y="37" width="100" height="30" fill="#FFFFFF" />
            <rect x="0" y="67" width="100" height="33" fill="#111111" />
            <circle cx="50" cy="52" r="7" fill="#C09300" />
          </>
        );
      case 'CHI':
        return (
          <>
            <rect x="0" y="0" width="100" height="52" fill="#FFFFFF" />
            <rect x="0" y="52" width="100" height="48" fill="#D52B1E" />
            <rect x="0" y="0" width="48" height="52" fill="#0039A6" />
            <polygon points="31,20 34,28 42,28 36,33 38,41 31,36 24,41 26,33 20,28 28,28" fill="#FFFFFF" />
          </>
        );
      case 'PAR':
        return (
          <>
            <rect x="0" y="0" width="100" height="37" fill="#D52B1E" />
            <rect x="0" y="37" width="100" height="30" fill="#FFFFFF" />
            <rect x="0" y="67" width="100" height="33" fill="#0038A8" />
            <circle cx="50" cy="52" r="8" fill="#FACC15" />
          </>
        );
      case 'POL':
        return (
          <>
            <rect x="0" y="0" width="100" height="52" fill="#FFFFFF" />
            <rect x="0" y="52" width="100" height="48" fill="#DC143C" />
          </>
        );
      case 'SRB':
        return (
          <>
            <rect x="0" y="0" width="100" height="37" fill="#C6363C" />
            <rect x="0" y="37" width="100" height="30" fill="#0C4076" />
            <rect x="0" y="67" width="100" height="33" fill="#FFFFFF" />
            <circle cx="42" cy="48" r="8" fill="#FACC15" />
          </>
        );
      case 'AUS':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#00008B" />
            <rect x="0" y="0" width="46" height="46" fill="#012169" />
            <rect x="20" y="0" width="8" height="46" fill="#E4002B" />
            <rect x="0" y="20" width="46" height="8" fill="#E4002B" />
            <circle cx="70" cy="36" r="4" fill="#FFFFFF" />
            <circle cx="74" cy="60" r="4" fill="#FFFFFF" />
            <circle cx="58" cy="70" r="4" fill="#FFFFFF" />
          </>
        );
      case 'CAN':
        return (
          <>
            <rect x="0" y="0" width="32" height="100" fill="#D80621" />
            <rect x="32" y="0" width="36" height="100" fill="#FFFFFF" />
            <rect x="68" y="0" width="32" height="100" fill="#D80621" />
            <polygon points="50,32 55,45 64,43 58,53 63,60 52,58 50,69 48,58 37,60 42,53 36,43 45,45" fill="#D80621" />
          </>
        );
      case 'KSA':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#006C35" />
            <rect x="24" y="58" width="52" height="5" rx="2" fill="#FFFFFF" />
            <rect x="30" y="38" width="40" height="12" rx="4" fill="#FFFFFF" />
          </>
        );
      default:
        return <rect x="0" y="0" width="100" height="100" fill={primaryColor} />;
    }
  };

  const renderCustomClubBody = () => {
    switch (team.id) {
      case 'fla':
        return (
          <>
            <rect x="0" y="14" width="100" height="16" fill="#C8102E" />
            <rect x="0" y="30" width="100" height="16" fill="#111111" />
            <rect x="0" y="46" width="100" height="16" fill="#C8102E" />
            <rect x="0" y="62" width="100" height="16" fill="#111111" />
            <rect x="0" y="78" width="100" height="22" fill="#C8102E" />
            <rect x="15" y="15" width="33" height="31" fill="#111111" />
            <text x="31.5" y="35" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800" fontFamily="Barlow Condensed, sans-serif">
              CRF
            </text>
          </>
        );
      case 'pal':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#006437" />
            <circle cx="50" cy="52" r="32" fill="none" stroke="#FFFFFF" strokeWidth="4" />
            <circle cx="50" cy="52" r="24" fill="#FFFFFF" />
            <circle cx="50" cy="52" r="20" fill="#006437" />
            <text x="50" y="61" textAnchor="middle" fill="#FFFFFF" fontSize="29" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              P
            </text>
          </>
        );
      case 'flu':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#8B1E2B" />
            <polygon points="-5,70 70,-5 100,-5 100,100 20,100" fill="#006437" />
            <polygon points="-5,82 82,-5 96,9 9,96" fill="#FFFFFF" />
          </>
        );
      case 'spfc':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <rect x="10" y="18" width="80" height="20" fill="#111111" />
            <text x="50" y="33" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="800" fontFamily="Barlow Condensed, sans-serif" letterSpacing="1">
              SPFC
            </text>
            <polygon points="15,42 46,42 46,85" fill="#DC2626" />
            <polygon points="54,42 85,42 54,85" fill="#111111" />
          </>
        );
      case 'bot':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#111111" />
            <rect x="25" y="45" width="12" height="55" fill="#FFFFFF" />
            <rect x="44" y="45" width="12" height="55" fill="#FFFFFF" />
            <rect x="63" y="45" width="12" height="55" fill="#FFFFFF" />
            <rect x="10" y="14" width="80" height="32" fill="#111111" />
            <polygon points="50,18 53,27 63,27 55,33 58,42 50,37 42,42 45,33 37,27 47,27" fill="#FFFFFF" />
          </>
        );
      case 'cor':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <circle cx="50" cy="52" r="29" fill="#111111" stroke="#FFFFFF" strokeWidth="3" />
            <path d="M50,28 L50,76 M38,62 Q50,74 62,62" fill="none" stroke="#DC2626" strokeWidth="4" strokeLinecap="round" />
          </>
        );
      case 'cam':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#111111" />
            <rect x="24" y="38" width="13" height="62" fill="#FFFFFF" />
            <rect x="44" y="38" width="12" height="62" fill="#FFFFFF" />
            <rect x="63" y="38" width="13" height="62" fill="#FFFFFF" />
            <rect x="10" y="14" width="80" height="24" fill="#111111" />
            <text x="50" y="31" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="800" fontFamily="Barlow Condensed, sans-serif">
              CAM
            </text>
          </>
        );
      case 'cru':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#0038A8" />
            <circle cx="50" cy="52" r="30" fill="none" stroke="#FFFFFF" strokeWidth="4" />
            <circle cx="50" cy="36" r="3" fill="#FFFFFF" />
            <circle cx="50" cy="68" r="3" fill="#FFFFFF" />
            <circle cx="38" cy="50" r="3" fill="#FFFFFF" />
            <circle cx="62" cy="50" r="3" fill="#FFFFFF" />
            <circle cx="57" cy="58" r="2.5" fill="#FFFFFF" />
          </>
        );
      case 'int':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#C8102E" />
            <circle cx="50" cy="52" r="31" fill="none" stroke="#FFFFFF" strokeWidth="5" />
            <circle cx="50" cy="52" r="22" fill="#FFFFFF" />
            <text x="50" y="58" textAnchor="middle" fill="#C8102E" fontSize="20" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              SCI
            </text>
          </>
        );
      case 'gre':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#0D80BF" />
            <rect x="0" y="38" width="100" height="26" fill="#111111" />
            <rect x="0" y="35" width="100" height="4" fill="#FFFFFF" />
            <rect x="0" y="63" width="100" height="4" fill="#FFFFFF" />
          </>
        );
      case 'san':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <rect x="14" y="15" width="35" height="28" fill="#111111" />
            <polygon points="10,75 80,12 95,24 22,90" fill="#111111" />
          </>
        );
      case 'bah':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#0038A8" />
            <rect x="0" y="38" width="100" height="26" fill="#FFFFFF" />
            <rect x="0" y="64" width="100" height="36" fill="#DC2626" />
          </>
        );
      case 'boc':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#0038A8" />
            <rect x="0" y="39" width="100" height="24" fill="#FACC15" />
            <text x="50" y="56" textAnchor="middle" fill="#002366" fontSize="15" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              CABJ
            </text>
          </>
        );
      case 'riv':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <polygon points="-5,82 82,-5 98,11 11,98" fill="#DC2626" />
            <circle cx="50" cy="52" r="14" fill="#FFFFFF" stroke="#111111" strokeWidth="2.5" />
          </>
        );
      case 'rma':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <polygon points="15,82 82,15 92,25 25,92" fill="#1D4ED8" />
            <circle cx="50" cy="52" r="24" fill="none" stroke="#D97706" strokeWidth="5" />
          </>
        );
      case 'fcb':
        return (
          <>
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
        );
      case 'bay':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#DC052D" />
            <circle cx="50" cy="52" r="28" fill="#FFFFFF" />
            <polygon points="50,24 68,52 50,80 32,52" fill="#0066B2" />
            <polygon points="32,52 50,24 50,52" fill="#FFFFFF" />
            <polygon points="68,52 50,80 50,52" fill="#FFFFFF" />
          </>
        );
      case 'atm':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
            <rect x="18" y="42" width="14" height="58" fill="#CE1126" />
            <rect x="43" y="42" width="14" height="58" fill="#CE1126" />
            <rect x="68" y="42" width="14" height="58" fill="#CE1126" />
            <polygon points="15,15 55,15 15,52" fill="#1D3C8B" />
          </>
        );
      case 'mci':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#6CABDD" />
            <circle cx="50" cy="52" r="28" fill="#FFFFFF" stroke="#1C2C5B" strokeWidth="4" />
            <polygon points="34,70 66,34 72,40 40,76" fill="#D97706" />
          </>
        );
      case 'ars':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#EF0107" />
            <rect x="14" y="15" width="12" height="80" fill="#FFFFFF" opacity="0.2" />
            <rect x="74" y="15" width="12" height="80" fill="#FFFFFF" opacity="0.2" />
            <rect x="30" y="44" width="40" height="10" rx="3" fill="#FACC15" />
            <circle cx="38" cy="56" r="7" fill="#FACC15" />
          </>
        );
      case 'bvb':
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill="#FDE100" />
            <circle cx="50" cy="52" r="32" fill="#FDE100" stroke="#111111" strokeWidth="6" />
            <text x="50" y="59" textAnchor="middle" fill="#111111" fontSize="22" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              BVB
            </text>
          </>
        );
      default:
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill={primaryColor} />
            {pattern === 'vertical_stripes' && (
              <>
                <rect x="20" y="0" width="16" height="100" fill={secondaryColor} />
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
        );
    }
  };

  // Clubs whose monogram is already drawn cleanly inside the crest don't need a heavy center box covering the art
  const skipCenterRibbon =
    team.isNationalTeam || ['pal', 'spfc', 'cam', 'int', 'boc', 'bvb', 'fla'].includes(team.id);

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
            const cx = 50 + (idx - (starCount - 1) / 2) * 12;
            return (
              <polygon
                key={idx}
                points={`${cx},2 ${cx + 1.8},5.5 ${cx + 5.5},5.5 ${cx + 2.6},8.2 ${cx + 3.6},12 ${cx},9.8 ${cx - 3.6},12 ${cx - 2.6},8.2 ${cx - 5.5},5.5 ${cx - 1.8},5.5`}
              />
            );
          })}
        </g>
      )}

      {/* Main Heraldic Body */}
      <g clipPath={`url(#clip-${uid})`}>
        {team.isNationalTeam ? renderNationalFlagBody() : renderCustomClubBody()}
        <rect x="0" y="0" width="100" height="100" fill={`url(#gloss-${uid})`} />
      </g>

      {/* Gold/Metallic Outer Trim */}
      <g
        fill="none"
        stroke={
          team.isNationalTeam || ['pal', 'rma', 'spfc', 'fla', 'flu'].includes(team.id)
            ? '#FACC15'
            : secondaryColor === primaryColor
              ? '#FACC15'
              : '#E2E8F0'
        }
        strokeWidth="4.5"
      >
        {renderShapePath()}
      </g>
      <g fill="none" stroke="rgba(0,0,0,0.65)" strokeWidth="1.6">
        {renderShapePath()}
      </g>

      {/* Monogram Ribbon (compact footer ribbon for flags/special crests, center ribbon for standard clubs) */}
      {skipCenterRibbon ? (
        <>
          <rect
            x="24"
            y="68"
            width="52"
            height="17"
            rx="4"
            fill="rgba(7, 13, 10, 0.88)"
            stroke="#FACC15"
            strokeWidth="1.1"
          />
          <text
            x="50"
            y="80.5"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="12.5"
            fontWeight="800"
            fontFamily="Barlow Condensed, sans-serif"
            letterSpacing="1"
          >
            {team.shortCode}
          </text>
        </>
      ) : (
        <>
          <rect
            x="20"
            y="41"
            width="60"
            height="23"
            rx="5"
            fill="rgba(7, 13, 10, 0.86)"
            stroke="#FACC15"
            strokeWidth="1.2"
          />
          <text
            x="50"
            y="57.5"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="17"
            fontWeight="800"
            fontFamily="Barlow Condensed, sans-serif"
            letterSpacing="1.2"
          >
            {team.shortCode}
          </text>
        </>
      )}
    </svg>
  );
};
