import { KitConfig } from '../types/game';

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
    // Distinct Goalkeeper neon-lime or amber-orange jersey accented by team border
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

  // Center text (number / initial / GK)
  const centerText = options?.isGoalkeeper ? 'GL' : label;
  ctx.fillStyle = options?.isGoalkeeper ? '#FFFFFF' : kit.textColor;
  ctx.font = `800 ${Math.round(radius * (options?.isGoalkeeper ? 0.72 : 0.88))}px "Barlow Condensed", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = 'rgba(0,0,0,0.68)';
  ctx.strokeText(centerText, x, y + 1);
  ctx.fillText(centerText, x, y + 1);

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
