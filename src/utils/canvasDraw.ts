import { KitConfig, Team } from '../types/game';

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

export function drawPlayerDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  kit: KitConfig,
  label: string,
  options?: {
    isHuman?: boolean;
    isGoalkeeper?: boolean;
    kickGlow?: number; // 0..1
    kickAngle?: number;
    playerName?: string;
    showName?: boolean;
    team?: Team;
  }
) {
  ctx.save();

  // Subtle ground shadow
  ctx.beginPath();
  ctx.arc(x, y + 3, radius + 1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fill();

  // Human control highlight ring
  if (options?.isHuman) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // White kick arc / ring indicator
  if (options?.kickGlow && options.kickGlow > 0.01) {
    ctx.beginPath();
    const angle = options.kickAngle ?? 0;
    const arcSpan = Math.PI * 0.78;
    ctx.arc(x, y, radius + 4.5, angle - arcSpan / 2, angle + arcSpan / 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, 0.6 + options.kickGlow * 0.4)})`;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else if (options?.isHuman) {
    ctx.beginPath();
    const angle = options.kickAngle ?? 0;
    ctx.arc(x, y, radius + 4, angle - 0.52, angle + 0.52);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Clip circle for kit pattern
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();

  if (options?.isGoalkeeper) {
    // Distinct Goalkeeper amber-gold jersey accented by team border
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = '#111827';
    ctx.fillRect(x - radius, y - radius * 0.25, radius * 2, radius * 0.5);
  } else {
    ctx.fillStyle = kit.primaryColor;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    if (kit.pattern === 'vertical_stripes') {
      ctx.fillStyle = kit.secondaryColor;
      const stripeW = (radius * 2) / 5;
      for (let i = -2; i <= 2; i += 2) {
        ctx.fillRect(x + i * stripeW - stripeW / 2, y - radius, stripeW, radius * 2);
      }
    } else if (kit.pattern === 'horizontal_hoops') {
      ctx.fillStyle = kit.secondaryColor;
      const stripeH = (radius * 2) / 5;
      for (let i = -2; i <= 2; i += 2) {
        ctx.fillRect(x - radius, y + i * stripeH - stripeH / 2, radius * 2, stripeH);
      }
    } else if (kit.pattern === 'halves') {
      ctx.fillStyle = kit.secondaryColor;
      ctx.fillRect(x, y - radius, radius, radius * 2);
    } else if (kit.pattern === 'sash') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = kit.secondaryColor;
      ctx.fillRect(-radius * 1.4, -radius * 0.28, radius * 2.8, radius * 0.56);
      ctx.restore();
    } else if (kit.pattern === 'double_border') {
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
      ctx.strokeStyle = kit.secondaryColor;
      ctx.lineWidth = radius * 0.22;
      ctx.stroke();
    }
  }

  // Glossy arcade shading
  const grad = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.35,
    radius * 0.1,
    x,
    y,
    radius
  );
  grad.addColorStop(0, 'rgba(255,255,255,0.24)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  ctx.restore();

  // Outer thick border
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = options?.isGoalkeeper ? kit.primaryColor : kit.borderColor || '#09090B';
  ctx.lineWidth = Math.max(2.8, radius * 0.17);
  ctx.stroke();

  if (options?.team) {
    // Render crisp Team Crest / National Flag stamped cleanly in the center of the disc
    const crestRadius = options.isGoalkeeper ? radius * 0.42 : radius * 0.52;
    const crestY = options.isGoalkeeper ? y - radius * 0.14 : y - radius * 0.08;
    drawMiniTeamCrest(ctx, x, crestY, crestRadius, options.team);

    // Clean high-contrast number / GL badge at the bottom rim of the disc
    const badgeText = options?.isGoalkeeper ? 'GL' : label;
    const fontPx = Math.max(8.5, Math.round(radius * 0.46));
    ctx.font = `800 ${fontPx}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const badgeY = y + radius * 0.62;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.strokeText(badgeText, x, badgeY);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(badgeText, x, badgeY);
  } else {
    // Center text fallback (number / initial / GK)
    const centerText = options?.isGoalkeeper ? 'GL' : label;
    ctx.fillStyle = options?.isGoalkeeper ? '#FFFFFF' : kit.textColor;
    ctx.font = `800 ${Math.round(radius * (options?.isGoalkeeper ? 0.72 : 0.88))}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = 'rgba(0,0,0,0.68)';
    ctx.strokeText(centerText, x, y + 1);
    ctx.fillText(centerText, x, y + 1);
  }

  // Optional Captain Crown
  if (kit.showCrown && options?.isHuman && !options?.isGoalkeeper) {
    ctx.fillStyle = '#FACC15';
    const cy = y - radius - 8;
    ctx.beginPath();
    ctx.moveTo(x - 6, cy + 4);
    ctx.lineTo(x - 7, cy - 3);
    ctx.lineTo(x - 2.5, cy + 0.5);
    ctx.lineTo(x, cy - 5);
    ctx.lineTo(x + 2.5, cy + 0.5);
    ctx.lineTo(x + 7, cy - 3);
    ctx.lineTo(x + 6, cy + 4);
    ctx.closePath();
    ctx.fill();
  }

  // Player name label above disc
  if (options?.showName && options.playerName) {
    const nameY = kit.showCrown && options?.isHuman ? y - radius - 18 : y - radius - 10;
    ctx.font = `700 11.5px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(options.playerName, x, nameY);
    ctx.fillStyle = options.isHuman ? '#FEF08A' : options.isGoalkeeper ? '#FCD34D' : '#F8FAFC';
    ctx.fillText(options.playerName, x, nameY);
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

  ctx.beginPath();
  ctx.arc(x + 1.5, y + 3, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(x, y);
  ctx.rotate(spinAngle);

  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const px = Math.cos(a) * radius * 0.42;
    const py = Math.sin(a) * radius * 0.42;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const px = Math.cos(a) * radius * 0.98;
    const py = Math.sin(a) * radius * 0.98;
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#09090B';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}
