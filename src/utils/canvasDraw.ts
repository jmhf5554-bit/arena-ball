import { KitConfig, Team } from '../types/game';
import { getPlayerFaceSpec } from '../data/playerFaces';

function drawMiniShieldPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, team: Team) {
  ctx.beginPath();
  if (team.id === 'spfc') {
    ctx.moveTo(x - r * 0.92, y - r * 0.85);
    ctx.lineTo(x + r * 0.92, y - r * 0.85);
    ctx.lineTo(x + r * 0.92, y - r * 0.15);
    ctx.lineTo(x, y + r * 0.98);
    ctx.lineTo(x - r * 0.92, y - r * 0.15);
    ctx.closePath();
    return;
  }
  if (
    team.isNationalTeam ||
    team.crestShape === 'circle' ||
    ['pal', 'cru', 'int', 'rma', 'bay', 'mci', 'bvb'].includes(team.id)
  ) {
    ctx.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  // Heraldic shield path
  ctx.moveTo(x - r * 0.85, y - r * 0.85);
  ctx.lineTo(x + r * 0.85, y - r * 0.85);
  ctx.lineTo(x + r * 0.85, y + r * 0.08);
  ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.72, x, y + r * 0.96);
  ctx.quadraticCurveTo(x - r * 0.85, y + r * 0.72, x - r * 0.85, y + r * 0.08);
  ctx.closePath();
}

export function drawMiniTeamCrest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  team: Team
) {
  ctx.save();

  ctx.save();
  drawMiniShieldPath(ctx, x, y, r, team);
  ctx.clip();

  const { primaryColor, secondaryColor, pattern } = team.kit;
  const fc = team.flagCode || team.shortCode;

  if (team.isNationalTeam) {
    switch (fc) {
      case 'BRA':
        ctx.fillStyle = '#009C3B';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#FFDF00';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.72);
        ctx.lineTo(x + r * 0.82, y);
        ctx.lineTo(x, y + r * 0.72);
        ctx.lineTo(x - r * 0.82, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#002776';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.32, y - r * 0.05);
        ctx.lineTo(x + r * 0.32, y + r * 0.07);
        ctx.stroke();
        break;
      case 'ARG':
        ctx.fillStyle = '#74ACDF';
        ctx.fillRect(x - r, y - r, r * 2, r * 0.68);
        ctx.fillRect(x - r, y + r * 0.32, r * 2, r * 0.68);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r * 0.32, r * 2, r * 0.64);
        ctx.fillStyle = '#F6B40E';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'FRA':
        ctx.fillStyle = '#002395';
        ctx.fillRect(x - r, y - r, r * 0.68, r * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r * 0.32, y - r, r * 0.64, r * 2);
        ctx.fillStyle = '#ED2939';
        ctx.fillRect(x + r * 0.32, y - r, r * 0.68, r * 2);
        break;
      case 'ITA':
        ctx.fillStyle = '#009246';
        ctx.fillRect(x - r, y - r, r * 0.68, r * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r * 0.32, y - r, r * 0.64, r * 2);
        ctx.fillStyle = '#CE2B37';
        ctx.fillRect(x + r * 0.32, y - r, r * 0.68, r * 2);
        break;
      case 'ESP':
        ctx.fillStyle = '#AA151B';
        ctx.fillRect(x - r, y - r, r * 2, r * 0.52);
        ctx.fillRect(x - r, y + r * 0.48, r * 2, r * 0.52);
        ctx.fillStyle = '#F1BF00';
        ctx.fillRect(x - r, y - r * 0.48, r * 2, r * 0.96);
        ctx.fillStyle = '#AA151B';
        ctx.fillRect(x - r * 0.34, y - r * 0.24, r * 0.34, r * 0.48);
        break;
      case 'GER':
        ctx.fillStyle = '#111111';
        ctx.fillRect(x - r, y - r, r * 2, r * 0.68);
        ctx.fillStyle = '#DD0000';
        ctx.fillRect(x - r, y - r * 0.32, r * 2, r * 0.64);
        ctx.fillStyle = '#FFCE00';
        ctx.fillRect(x - r, y + r * 0.32, r * 2, r * 0.68);
        break;
      case 'ENG':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#CE1124';
        ctx.fillRect(x - r * 0.18, y - r, r * 0.36, r * 2);
        ctx.fillRect(x - r, y - r * 0.18, r * 2, r * 0.36);
        break;
      case 'POR':
        ctx.fillStyle = '#006600';
        ctx.fillRect(x - r, y - r, r * 0.85, r * 2);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x - r * 0.15, y - r, r * 1.15, r * 2);
        ctx.fillStyle = '#FFCC00';
        ctx.beginPath();
        ctx.arc(x - r * 0.15, y, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'NED':
        ctx.fillStyle = '#AE1C28';
        ctx.fillRect(x - r, y - r, r * 2, r * 0.68);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r * 0.32, r * 2, r * 0.64);
        ctx.fillStyle = '#21468B';
        ctx.fillRect(x - r, y + r * 0.32, r * 2, r * 0.68);
        break;
      case 'CRO':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#FF0000';
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 4; col++) {
            if ((row + col) % 2 === 0) {
              ctx.fillRect(x - r + col * (r * 0.5), y - r + row * (r * 0.5), r * 0.5, r * 0.5);
            }
          }
        }
        break;
      case 'JPN':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#BC002D';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'MAR':
        ctx.fillStyle = '#C1272D';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = '#006233';
        ctx.lineWidth = Math.max(1.4, r * 0.16);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'URU':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#0038A8';
        ctx.fillRect(x - r, y - r * 0.4, r * 2, r * 0.25);
        ctx.fillRect(x - r, y + r * 0.1, r * 2, r * 0.25);
        ctx.fillRect(x - r, y + r * 0.6, r * 2, r * 0.25);
        ctx.fillStyle = '#FCD116';
        ctx.beginPath();
        ctx.arc(x - r * 0.32, y - r * 0.35, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'USA':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#B22234';
        ctx.fillRect(x - r, y - r * 0.7, r * 2, r * 0.25);
        ctx.fillRect(x - r, y - r * 0.1, r * 2, r * 0.25);
        ctx.fillRect(x - r, y + r * 0.5, r * 2, r * 0.25);
        ctx.fillStyle = '#3C3B6E';
        ctx.fillRect(x - r, y - r, r, r);
        break;
      case 'MEX':
        ctx.fillStyle = '#006847';
        ctx.fillRect(x - r, y - r, r * 0.68, r * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r * 0.32, y - r, r * 0.64, r * 2);
        ctx.fillStyle = '#CE1126';
        ctx.fillRect(x + r * 0.32, y - r, r * 0.68, r * 2);
        ctx.fillStyle = '#92400E';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'KOR':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#CD2E3A';
        ctx.beginPath();
        ctx.arc(x, y - r * 0.1, r * 0.38, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#0047A0';
        ctx.beginPath();
        ctx.arc(x, y + r * 0.1, r * 0.38, 0, Math.PI);
        ctx.fill();
        break;
      default:
        ctx.fillStyle = primaryColor;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(x - r, y + r * 0.15, r * 2, r * 0.85);
        break;
    }
  } else {
    // Clubs bespoke mini crest
    switch (team.id) {
      case 'fla':
        ctx.fillStyle = '#C8102E';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#111111';
        ctx.fillRect(x - r, y - r * 0.35, r * 2, r * 0.35);
        ctx.fillRect(x - r, y + r * 0.35, r * 2, r * 0.35);
        ctx.fillRect(x - r, y - r, r * 0.9, r * 0.9);
        break;
      case 'pal':
        ctx.fillStyle = '#006437';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1.5, r * 0.14);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 ${Math.round(r * 0.92)}px "Barlow Condensed", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', x, y + 0.5);
        break;
      case 'flu':
        ctx.fillStyle = '#8B1E2B';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#006437';
        ctx.beginPath();
        ctx.moveTo(x - r, y + r);
        ctx.lineTo(x + r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1.5, r * 0.22);
        ctx.beginPath();
        ctx.moveTo(x - r, y + r);
        ctx.lineTo(x + r, y - r);
        ctx.stroke();
        break;
      case 'spfc':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#111111';
        ctx.fillRect(x - r, y - r, r * 2, r * 0.52);
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.moveTo(x - r * 0.72, y - r * 0.35);
        ctx.lineTo(x - r * 0.05, y - r * 0.35);
        ctx.lineTo(x - r * 0.05, y + r * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.moveTo(x + r * 0.72, y - r * 0.35);
        ctx.lineTo(x + r * 0.05, y - r * 0.35);
        ctx.lineTo(x + r * 0.05, y + r * 0.75);
        ctx.closePath();
        ctx.fill();
        break;
      case 'bot':
        ctx.fillStyle = '#111111';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r * 0.5, y + r * 0.05, r * 0.28, r * 0.95);
        ctx.fillRect(x + r * 0.22, y + r * 0.05, r * 0.28, r * 0.95);
        ctx.beginPath();
        ctx.arc(x, y - r * 0.32, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'boc':
        ctx.fillStyle = '#0038A8';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(x - r, y - r * 0.25, r * 2, r * 0.5);
        break;
      case 'riv':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = Math.max(2.2, r * 0.38);
        ctx.beginPath();
        ctx.moveTo(x - r, y + r);
        ctx.lineTo(x + r, y - r);
        ctx.stroke();
        break;
      case 'rma':
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = '#1D4ED8';
        ctx.lineWidth = Math.max(2, r * 0.28);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.75, y + r * 0.75);
        ctx.lineTo(x + r * 0.75, y - r * 0.75);
        ctx.stroke();
        break;
      case 'fcb':
        ctx.fillStyle = '#004D98';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - r, y - r, r, r * 0.85);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(x, y - r, r, r * 0.85);
        ctx.fillStyle = '#A50044';
        ctx.fillRect(x - r * 0.5, y, r * 0.35, r);
        ctx.fillRect(x + r * 0.2, y, r * 0.35, r);
        break;
      case 'bay':
        ctx.fillStyle = '#DC052D';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0066B2';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.5);
        ctx.lineTo(x + r * 0.42, y);
        ctx.lineTo(x, y + r * 0.5);
        ctx.lineTo(x - r * 0.42, y);
        ctx.closePath();
        ctx.fill();
        break;
      default:
        ctx.fillStyle = primaryColor;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        if (pattern === 'vertical_stripes') {
          ctx.fillStyle = secondaryColor;
          ctx.fillRect(x - r * 0.22, y - r, r * 0.44, r * 2);
        } else if (pattern === 'horizontal_hoops') {
          ctx.fillStyle = secondaryColor;
          ctx.fillRect(x - r, y - r * 0.22, r * 2, r * 0.44);
        } else if (pattern === 'halves') {
          ctx.fillStyle = secondaryColor;
          ctx.fillRect(x, y - r, r, r * 2);
        } else if (pattern === 'sash') {
          ctx.strokeStyle = secondaryColor;
          ctx.lineWidth = Math.max(2, r * 0.34);
          ctx.beginPath();
          ctx.moveTo(x - r, y + r);
          ctx.lineTo(x + r, y - r);
          ctx.stroke();
        } else {
          ctx.strokeStyle = secondaryColor;
          ctx.lineWidth = Math.max(1.5, r * 0.2);
          ctx.beginPath();
          ctx.arc(x, y, r * 0.56, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
    }
  }

  ctx.restore();

  // Crisp gold/light shield outline around mini crest
  drawMiniShieldPath(ctx, x, y, r, team);
  ctx.strokeStyle = team.isNationalTeam ? '#FACC15' : 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1.2, r * 0.13);
  ctx.stroke();

  ctx.restore();
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colorBrightness(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 128;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

const SKIN_TONES: { base: string; shade: string }[] = [
  { base: '#F7CAA0', shade: '#DDA372' },
  { base: '#E8B182', shade: '#C68857' },
  { base: '#C68642', shade: '#9F6226' },
  { base: '#8D5524', shade: '#6A3B14' },
  { base: '#5E381E', shade: '#412310' },
];

export function drawPlayerDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  kit: KitConfig,
  label: string,
  options?: {
    isHuman?: boolean;
    isHuman2?: boolean;
    isGoalkeeper?: boolean;
    hasBall?: boolean;
    kickGlow?: number; // 0..1
    kickAngle?: number;
    vx?: number;
    vy?: number;
    animTime?: number;
    playerName?: string;
    showName?: boolean;
    team?: Team;
  }
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const isGK = Boolean(options?.isGoalkeeper);
  const isHuman1 = Boolean(options?.isHuman);
  const isHuman2 = Boolean(options?.isHuman2);
  const isControlled = isHuman1 || isHuman2;
  const hasBall = Boolean(options?.hasBall);
  const kickGlow = options?.kickGlow ?? 0;
  const isKicking = kickGlow > 0.16;
  const kickAngle = options?.kickAngle ?? 0;
  const vx = options?.vx ?? 0;
  const vy = options?.vy ?? 0;
  const speed = Math.hypot(vx, vy);
  const animTime = options?.animTime ?? performance.now() * 0.001;

  // Facing left (-1) or right (+1)
  const facing: 1 | -1 =
    Math.abs(vx) > 10 ? (vx >= 0 ? 1 : -1) : Math.cos(kickAngle) >= 0 ? 1 : -1;

  // Pixel grid scale tied cleanly to collision radius
  const p = Math.max(1.7, radius * 0.142);
  const ox = Math.round(x);
  const oy = Math.round(y);

  const px = (col: number, row: number, w: number, h: number, color: string) => {
    const cx = facing === 1 ? col : -(col + w);
    const x1 = Math.round(ox + cx * p);
    const y1 = Math.round(oy + row * p);
    const x2 = Math.round(ox + (cx + w) * p);
    const y2 = Math.round(oy + (row + h) * p);
    ctx.fillStyle = color;
    ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
  };

  // Researched real player face (or deterministic fallback)
  const seedKey = `${options?.team?.id || ''}:${options?.playerName || label}:${isGK ? 'gk' : 'fp'}`;
  const seed = hashString(seedKey);
  const face = getPlayerFaceSpec(options?.playerName, label, isGK, seedKey);
  const skin = SKIN_TONES[face.skin] || SKIN_TONES[1];
  const hairStyle = face.hairStyle;
  const hairColor = face.hairColor;

  // Ground diagonal pixel shadow (like Pixel Cup Soccer)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  const shY = Math.round(oy + 5.1 * p);
  ctx.fillRect(Math.round(ox - 3.6 * p), shY, Math.round(8.2 * p), Math.max(2, Math.round(2.1 * p)));
  ctx.fillRect(Math.round(ox - 2.4 * p), Math.round(shY - 0.7 * p), Math.round(5.6 * p), Math.max(2, Math.round(3.2 * p)));

  // Ball carrier / controlled player segmented turf ring
  if (isControlled || hasBall) {
    const ringColor = hasBall && !isControlled ? '#FACC15' : isHuman2 ? '#FACC15' : '#22D3EE';
    ctx.save();
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = Math.max(2.2, p * (hasBall ? 1.15 : 0.95));
    const rx = radius * (hasBall ? 1.02 : 0.92);
    const ry = radius * (hasBall ? 0.52 : 0.46);
    const ringY = oy + 4.8 * p;
    for (let s = 0; s < 4; s++) {
      const startA = s * (Math.PI / 2) + (hasBall ? 0.12 : 0.22);
      const endA = (s + 1) * (Math.PI / 2) - (hasBall ? 0.12 : 0.22);
      ctx.beginPath();
      ctx.ellipse(ox, ringY, rx, ry, 0, startA, endA);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Crisp kick flash arc in direction of kick
  if (kickGlow > 0.04) {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, 0.55 + kickGlow * 0.45)})`;
    ctx.lineWidth = Math.max(2.5, p * 1.15);
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.arc(ox, oy, radius + 3.5, kickAngle - 0.85, kickAngle + 0.85);
    ctx.stroke();
    ctx.restore();
  }

  // Run animation cycle
  const isMoving = speed > 14;
  const runCycle = isMoving ? Math.sin(animTime * 15 + (seed % 7)) : 0;
  const stride = isMoving ? (runCycle > 0.35 ? 1 : runCycle < -0.35 ? -1 : 0) : 0;
  const bob = isMoving && Math.abs(runCycle) > 0.55 ? -0.65 : isKicking ? -0.8 : 0;

  // Colors for jersey, shorts & socks
  const jerseyPrimary = isGK
    ? colorBrightness(kit.primaryColor) > 175
      ? '#16A34A'
      : '#FACC15'
    : kit.primaryColor;
  const jerseySecondary = isGK
    ? '#18181B'
    : kit.secondaryColor;
  const shortsColor = isGK
    ? '#18181B'
    : colorBrightness(kit.primaryColor) > 195
      ? '#1E293B'
      : kit.secondaryColor === kit.primaryColor
        ? '#F8FAFC'
        : colorBrightness(kit.secondaryColor) > 165
          ? '#F8FAFC'
          : '#0F172A';
  const sockColor = isGK ? '#FACC15' : kit.primaryColor;
  const handColor = isGK ? '#FDE047' : skin.base;
  const outline = '#0B0B0D';

  // ---------------- BACK LEG ----------------
  const backLegShiftX = isKicking ? -1.4 : -stride * 1.35;
  const backLegLiftY = isKicking ? 0.2 : stride < 0 ? -0.7 : 0;
  const bLx = -2.2 + backLegShiftX;
  const bLy = 1.6 + bob + backLegLiftY;
  // Outline
  px(bLx - 0.6, bLy - 0.5, 2.7, 4.8, outline);
  // Shorts leg
  px(bLx, bLy, 1.6, 1.4, shortsColor);
  // Calf + Sock + Cleat
  px(bLx, bLy + 1.4, 1.4, 0.7, skin.shade);
  px(bLx, bLy + 2.1, 1.4, 1.2, sockColor);
  px(bLx - 0.2, bLy + 3.2, 2.1, 0.9, '#111827');

  // ---------------- BACK ARM ----------------
  const armSwing = isKicking ? -1.5 : stride * 1.1;
  const bAx = -3.8 + armSwing * 0.6;
  const bAy = -3.0 + bob;
  px(bAx - 0.5, bAy - 0.5, 2.2, 4.0, outline);
  px(bAx, bAy, 1.2, 1.4, jerseyPrimary);
  px(bAx, bAy + 1.4, 1.1, 1.0, skin.shade);
  px(bAx - 0.1, bAy + 2.3, 1.3, 1.0, handColor);

  // ---------------- FRONT LEG (OR KICKING VOLLEY LEG) ----------------
  const fLx = isKicking ? 1.8 : 0.6 + stride * 1.35;
  const fLy = isKicking ? 0.3 + bob : 1.6 + bob + (stride > 0 ? -0.7 : 0);
  if (isKicking) {
    // Extended kicking leg (Pixel Cup volley pose!)
    px(fLx - 0.6, fLy - 0.5, 4.4, 3.0, outline);
    px(fLx, fLy, 1.6, 1.5, shortsColor);
    px(fLx + 1.5, fLy + 0.1, 0.8, 1.3, skin.base);
    px(fLx + 2.1, fLy, 1.1, 1.4, sockColor);
    px(fLx + 2.9, fLy - 0.3, 1.2, 1.8, '#FFFFFF');
  } else {
    px(fLx - 0.6, fLy - 0.5, 2.7, 4.8, outline);
    px(fLx, fLy, 1.6, 1.4, shortsColor);
    px(fLx, fLy + 1.4, 1.4, 0.7, skin.base);
    px(fLx, fLy + 2.1, 1.4, 1.2, sockColor);
    px(fLx - 0.1, fLy + 3.2, 2.2, 0.9, '#0F172A');
    px(fLx + 0.9, fLy + 3.3, 0.9, 0.5, '#F8FAFC');
  }

  // ---------------- TORSO / JERSEY ----------------
  const tx = -2.8 + (isKicking ? -0.4 : 0);
  const ty = -3.6 + bob;
  // Black pixel outline
  px(tx - 0.6, ty - 0.6, 6.8, 6.2, outline);
  // Base jersey fill
  px(tx, ty, 5.6, 5.0, jerseyPrimary);

  // Kit pattern pixel details
  if (!isGK) {
    if (kit.pattern === 'vertical_stripes') {
      px(tx + 0.9, ty, 1.2, 5.0, jerseySecondary);
      px(tx + 3.4, ty, 1.2, 5.0, jerseySecondary);
    } else if (kit.pattern === 'horizontal_hoops') {
      px(tx, ty + 1.3, 5.6, 1.2, jerseySecondary);
      px(tx, ty + 3.5, 5.6, 1.0, jerseySecondary);
    } else if (kit.pattern === 'halves') {
      px(tx + 2.8, ty, 2.8, 5.0, jerseySecondary);
    } else if (kit.pattern === 'sash') {
      px(tx + 0.2, ty + 0.2, 1.6, 1.5, jerseySecondary);
      px(tx + 1.5, ty + 1.5, 1.6, 1.5, jerseySecondary);
      px(tx + 2.8, ty + 2.8, 1.6, 1.5, jerseySecondary);
      px(tx + 4.0, ty + 3.8, 1.4, 1.2, jerseySecondary);
    } else if (kit.pattern === 'double_border') {
      px(tx, ty + 1.8, 5.6, 1.3, jerseySecondary);
    }
  } else {
    // GK chest stripe
    px(tx, ty + 1.6, 5.6, 1.3, jerseySecondary);
  }
  // Collar & subtle back shading
  px(tx + 1.8, ty, 2.0, 0.8, isGK ? '#FFFFFF' : jerseySecondary);
  px(tx, ty + 4.2, 5.6, 0.8, 'rgba(0,0,0,0.18)');

  // Shorts waistband
  px(tx, ty + 4.9, 5.6, 0.9, shortsColor);

  // ---------------- FRONT ARM ----------------
  const fAx = 2.0 - armSwing * 0.5 + (isKicking ? -0.4 : 0);
  const fAy = -3.1 + bob + (isKicking ? -0.7 : 0);
  px(fAx - 0.5, fAy - 0.5, 2.2, 4.1, outline);
  px(fAx, fAy, 1.3, 1.5, jerseyPrimary);
  px(fAx + 0.1, fAy + 1.5, 1.1, 1.0, skin.base);
  px(fAx, fAy + 2.4, 1.4, 1.1, handColor);

  // ---------------- CHIBI PIXEL HEAD ----------------
  const hx = -3.7 + (isKicking ? -0.5 : 0);
  const hy = -11.4 + bob;
  // Stepped rounded pixel outline
  px(hx + 0.6, hy - 0.7, 6.4, 8.8, outline);
  px(hx - 0.5, hy + 0.3, 8.6, 6.8, outline);

  // Face skin fill
  px(hx + 0.6, hy, 6.4, 7.4, skin.base);
  px(hx + 0.2, hy + 1.0, 7.2, 5.4, skin.base);
  // Subtle jaw / back-of-head shadow
  px(hx + 0.2, hy + 5.7, 6.8, 1.3, skin.shade);
  px(hx + 0.2, hy + 1.0, 1.1, 5.4, skin.shade);

  // Expressive pixel eyes & eyebrows
  px(hx + 2.8, hy + 2.3, 1.3, 0.6, '#18181B');
  px(hx + 5.2, hy + 2.3, 1.3, 0.6, '#18181B');
  px(hx + 2.9, hy + 3.2, 1.0, 1.9, '#111111');
  px(hx + 5.3, hy + 3.2, 1.0, 1.9, '#111111');
  px(hx + 3.6, hy + 3.4, 0.6, 0.8, '#FFFFFF');
  px(hx + 6.0, hy + 3.4, 0.6, 0.8, '#FFFFFF');

  // Facial Hair Layer (Beards / Goatees / Mustaches / Stubble)
  const facialHair = face.facialHair || 'none';
  const beardColor = face.beardColor || (hairColor === '#EAB308' || hairColor === '#FACC15' ? '#3E2312' : hairColor);
  if (facialHair === 'full_beard') {
    px(hx + 1.4, hy + 5.1, 5.4, 2.2, beardColor);
    px(hx + 1.8, hy + 4.6, 1.1, 1.2, beardColor);
    px(hx + 3.6, hy + 5.2, 1.8, 0.6, skin.base); // subtle mouth gap
  } else if (facialHair === 'goatee') {
    px(hx + 3.3, hy + 5.3, 2.3, 0.7, beardColor);
    px(hx + 3.6, hy + 6.1, 1.9, 1.1, beardColor);
  } else if (facialHair === 'mustache') {
    px(hx + 3.3, hy + 5.2, 2.4, 0.8, beardColor);
  } else if (facialHair === 'stubble') {
    px(hx + 2.0, hy + 5.6, 4.4, 1.4, 'rgba(24,24,27,0.34)');
  }

  // Hair layer
  if (hairStyle === 'bald') {
    px(hx + 2.2, hy + 0.5, 2.2, 0.8, '#FFF7ED');
  } else if (hairStyle === 'buzz') {
    px(hx + 0.4, hy - 0.3, 6.4, 1.4, outline);
    px(hx + 0.7, hy + 0.1, 5.8, 1.3, hairColor);
    px(hx + 0.3, hy + 1.2, 1.1, 2.1, hairColor);
  } else if (hairStyle === 'curly_afro') {
    px(hx - 0.6, hy - 1.2, 8.2, 2.6, outline);
    px(hx - 1.2, hy + 0.2, 2.8, 4.6, outline);
    px(hx - 0.1, hy - 0.7, 7.2, 2.3, hairColor);
    px(hx - 0.7, hy + 0.6, 2.1, 3.8, hairColor);
    if (face.hairHighlight) {
      px(hx + 1.2, hy - 0.8, 1.4, 1.0, face.hairHighlight);
      px(hx + 3.5, hy - 0.9, 1.5, 1.1, face.hairHighlight);
      px(hx + 5.4, hy - 0.5, 1.2, 0.9, face.hairHighlight);
    } else {
      px(hx + 1.6, hy - 0.4, 1.8, 0.7, 'rgba(255,255,255,0.22)');
    }
  } else if (hairStyle === 'braids') {
    px(hx - 0.4, hy - 0.9, 7.6, 2.2, outline);
    px(hx + 0.1, hy - 0.4, 6.6, 1.8, hairColor);
    px(hx - 1.0, hy + 1.0, 2.0, 4.4, outline);
    px(hx - 0.6, hy + 1.3, 1.2, 3.8, hairColor);
    px(hx - 1.3, hy + 3.2, 1.0, 2.2, face.hairHighlight || hairColor);
    if (face.hairHighlight) {
      px(hx + 2.2, hy - 0.4, 1.2, 0.9, face.hairHighlight);
      px(hx + 4.4, hy - 0.3, 1.2, 0.9, face.hairHighlight);
    }
  } else if (hairStyle === 'ponytail') {
    // Flowing top + tied ponytail in back
    px(hx - 0.2, hy - 0.8, 7.2, 2.2, outline);
    px(hx + 0.2, hy - 0.3, 6.4, 1.8, hairColor);
    px(hx - 2.3, hy + 1.0, 2.5, 3.4, outline);
    px(hx - 1.9, hy + 1.4, 1.9, 2.6, hairColor);
    px(hx - 0.5, hy + 1.4, 0.6, 1.2, '#18181B');
  } else if (hairStyle === 'spiky') {
    px(hx + 0.2, hy - 1.2, 6.8, 2.2, outline);
    px(hx + 0.8, hy - 1.7, 1.5, 1.2, outline);
    px(hx + 3.2, hy - 1.9, 1.6, 1.4, outline);
    px(hx + 5.4, hy - 1.4, 1.3, 1.1, outline);
    px(hx + 0.4, hy - 0.4, 6.4, 1.8, hairColor);
    px(hx + 1.0, hy - 1.1, 1.1, 1.0, face.hairHighlight || hairColor);
    px(hx + 3.4, hy - 1.3, 1.2, 1.2, face.hairHighlight || hairColor);
    px(hx + 0.2, hy + 0.8, 1.4, 2.8, hairColor);
  } else if (hairStyle === 'side_part') {
    px(hx + 0.2, hy - 0.7, 7.0, 2.1, outline);
    px(hx + 0.4, hy - 0.2, 6.6, 1.8, hairColor);
    px(hx + 0.2, hy + 1.0, 1.5, 3.2, hairColor);
    px(hx + 4.8, hy + 1.0, 2.1, 0.9, hairColor);
  } else {
    // Classic short cut
    px(hx + 0.2, hy - 0.6, 6.9, 2.0, outline);
    px(hx + 0.5, hy - 0.1, 6.3, 1.6, hairColor);
    px(hx + 0.2, hy + 1.1, 1.3, 2.9, hairColor);
  }

  // Headband accessory (e.g., Memphis Depay, Raphinha, Modric, Ronald Araujo)
  if (face.headband) {
    px(hx + 0.2, hy + 1.2, 6.9, 0.9, face.headband);
  }

  // ---------------- CAPTAIN CROWN (PIXEL) ----------------
  if (kit.showCrown && isHuman1 && !isGK) {
    const cy = hy - 3.6;
    px(-2.2, cy - 0.4, 4.4, 2.4, outline);
    px(-1.7, cy + 0.5, 3.4, 1.1, '#FACC15');
    px(-1.7, cy, 0.9, 0.8, '#FACC15');
    px(-0.4, cy - 0.2, 0.9, 1.0, '#FACC15');
    px(0.8, cy, 0.9, 0.8, '#FACC15');
  }

  // ---------------- CONTROLLED CYAN / GOLD PIXEL TRIANGLE (▼) ----------------
  let topOfSpriteY = Math.round(oy + (hy - 1.5) * p);
  if (isControlled) {
    const triColor = isHuman2 ? '#FACC15' : '#22D3EE';
    const triCenterY = Math.round(oy + (hy - (kit.showCrown && isHuman1 && !isGK ? 6.2 : 3.6)) * p);
    const triW = Math.max(4, Math.round(p * 2.2));
    const triH = Math.max(4, Math.round(p * 2.1));

    ctx.beginPath();
    ctx.moveTo(ox - triW, triCenterY - triH);
    ctx.lineTo(ox + triW, triCenterY - triH);
    ctx.lineTo(ox, triCenterY);
    ctx.closePath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#09090B';
    ctx.stroke();
    ctx.fillStyle = triColor;
    ctx.fill();
    topOfSpriteY = triCenterY - triH - 3;
  }

  // ---------------- PLAYER NAME LABEL ----------------
  if (options?.showName && options.playerName) {
    const nameY = topOfSpriteY - 3;
    ctx.font = `800 11px "Barlow Condensed", "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.strokeText(options.playerName, ox, nameY);
    ctx.fillStyle = isHuman1 ? '#67E8F9' : isHuman2 ? '#FDE047' : isGK ? '#FCD34D' : '#F8FAFC';
    ctx.fillText(options.playerName, ox, nameY);
  }

  ctx.restore();
}

export function drawSoccerBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  spinAngle: number
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const p = Math.max(1.5, radius / 4.5);
  const ox = Math.round(x);
  const oy = Math.round(y);

  const bpx = (col: number, row: number, w: number, h: number, color: string) => {
    const x1 = Math.round(ox + col * p);
    const y1 = Math.round(oy + row * p);
    const x2 = Math.round(ox + (col + w) * p);
    const y2 = Math.round(oy + (row + h) * p);
    ctx.fillStyle = color;
    ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
  };

  // Ground pixel shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
  ctx.fillRect(Math.round(ox - 3.2 * p), Math.round(oy + 3.8 * p), Math.round(7.2 * p), Math.max(2, Math.round(1.6 * p)));

  // Pixelated stepped sphere outline (#09090B)
  bpx(-3.2, -4.4, 6.4, 8.8, '#09090B');
  bpx(-4.4, -3.2, 8.8, 6.4, '#09090B');

  // White ball body
  bpx(-2.6, -3.6, 5.2, 7.2, '#FFFFFF');
  bpx(-3.6, -2.6, 7.2, 5.2, '#FFFFFF');

  // Crisp pixel rim shading (bottom-right)
  bpx(-2.2, 2.2, 4.8, 1.3, '#CBD5E1');
  bpx(2.1, -1.8, 1.4, 4.2, '#CBD5E1');

  // Rotating pixel pentagon patches
  const shiftX = Math.cos(spinAngle) * 1.4;
  const shiftY = Math.sin(spinAngle) * 1.2;
  bpx(shiftX - 1.1, shiftY - 1.1, 2.2, 2.2, '#18181B');
  const patch2X = Math.cos(spinAngle + 2.3) * 2.4;
  const patch2Y = Math.sin(spinAngle + 2.3) * 2.2;
  bpx(patch2X - 0.8, patch2Y - 0.8, 1.6, 1.6, '#27272A');
  const patch3X = Math.cos(spinAngle - 2.1) * 2.4;
  const patch3Y = Math.sin(spinAngle - 2.1) * 2.2;
  bpx(patch3X - 0.8, patch3Y - 0.8, 1.6, 1.6, '#27272A');

  ctx.restore();
}
