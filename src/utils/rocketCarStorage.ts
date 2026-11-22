import {
  RocketCarBoost,
  RocketCarChassis,
  RocketCarConfig,
} from '../types/game';

const ROCKET_CAR_KEY_PREFIX = 'arenabola_rocket_car_v1';

export const DEFAULT_ROCKET_CAR: RocketCarConfig = {
  chassis: 'octane',
  primaryColor: '#0EA5E9',
  secondaryColor: '#FACC15',
  decal: 'racing_stripes',
  wheels: 'neon_sport',
  boostTrail: 'cyan_plasma',
  topper: 'wing',
  carName: 'TURBO-10',
};

export const CHASSIS_SPECS: Record<
  RocketCarChassis,
  {
    label: string;
    subtitle: string;
    speedBonus: number;
    shotBonus: number;
    turnBonus: number;
    length: number;
    width: number;
  }
> = {
  octane: {
    label: 'Octane Turbo',
    subtitle: 'Equilíbrio perfeito para dribles, aéreos e finalização.',
    speedBonus: 1.0,
    shotBonus: 1.0,
    turnBonus: 1.04,
    length: 50,
    width: 32,
  },
  dominus: {
    label: 'Dominus Muscle',
    subtitle: 'Capô longo e chassi largo para bombas de longa distância.',
    speedBonus: 0.98,
    shotBonus: 1.12,
    turnBonus: 0.96,
    length: 56,
    width: 33,
  },
  fennec: {
    label: 'Fennec Rally',
    subtitle: 'Compacto e ágil com curvas rápidas e domínio firme.',
    speedBonus: 1.02,
    shotBonus: 1.03,
    turnBonus: 1.12,
    length: 48,
    width: 34,
  },
  breakout: {
    label: 'Breakout Aero',
    subtitle: 'Supercarro esportivo com máxima aceleração no nitro.',
    speedBonus: 1.08,
    shotBonus: 0.98,
    turnBonus: 1.02,
    length: 55,
    width: 30,
  },
};

export const BOOST_PALETTE: Record<
  RocketCarBoost,
  { label: string; outer: string; inner: string }
> = {
  fire: { label: 'Fogo Laranja', outer: '#F97316', inner: '#FEF08A' },
  cyan_plasma: { label: 'Plasma Ciano', outer: '#06B6D4', inner: '#E0F2FE' },
  emerald_nitro: { label: 'Nitro Esmeralda', outer: '#10B981', inner: '#D1FAE5' },
  violet_hyper: { label: 'Hiper Violeta', outer: '#A855F7', inner: '#F3E8FF' },
};

function getKey(userId?: string) {
  return userId ? `${ROCKET_CAR_KEY_PREFIX}_${userId}` : ROCKET_CAR_KEY_PREFIX;
}

export function loadRocketCar(userId?: string): RocketCarConfig {
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RocketCarConfig>;
      if (parsed && parsed.chassis) {
        return { ...DEFAULT_ROCKET_CAR, ...parsed };
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_ROCKET_CAR;
}

export function saveRocketCar(car: RocketCarConfig, userId?: string) {
  try {
    localStorage.setItem(getKey(userId), JSON.stringify(car));
  } catch {
    // ignore
  }
}

export function drawTopDownCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  car: RocketCarConfig,
  opts?: {
    isBoosting?: boolean;
    flipGlow?: number;
    label?: string;
    showLabel?: boolean;
    nitro?: number;
    isHuman?: boolean;
    scale?: number;
  }
) {
  const spec = CHASSIS_SPECS[car.chassis] || CHASSIS_SPECS.octane;
  const L = spec.length;
  const W = spec.width;
  const scale = opts?.scale ?? 1;
  const flipGlow = opts?.flipGlow ?? 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Subtle shadow beneath car
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(-L / 2 + 2, -W / 2 + 4, L, W, 8);
  ctx.fill();

  // Supersonic / Flip aura ring
  if (flipGlow > 0.05 || opts?.isHuman) {
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.62, W * 0.68, 0, 0, Math.PI * 2);
    ctx.strokeStyle =
      flipGlow > 0.05
        ? `rgba(250, 204, 21, ${Math.min(1, flipGlow)})`
        : 'rgba(52, 211, 153, 0.42)';
    ctx.lineWidth = flipGlow > 0.05 ? 3 : 1.8;
    ctx.stroke();
  }

  // Nitro boost exhaust flame behind rear bumper
  if (opts?.isBoosting) {
    const flameColors = BOOST_PALETTE[car.boostTrail] || BOOST_PALETTE.fire;
    const flicker = 0.82 + Math.random() * 0.45;
    const flameLen = 22 * flicker;

    const grad = ctx.createLinearGradient(-L / 2, 0, -L / 2 - flameLen, 0);
    grad.addColorStop(0, flameColors.inner);
    grad.addColorStop(0.45, flameColors.outer);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-L / 2 + 1, -6);
    ctx.lineTo(-L / 2 - flameLen, 0);
    ctx.lineTo(-L / 2 + 1, 6);
    ctx.closePath();
    ctx.fill();
  }

  // 4 Wheels protruding cleanly from fenders
  const wheelW = 11;
  const wheelH = 5;
  const wheelRim =
    car.wheels === 'neon_sport'
      ? '#38BDF8'
      : car.wheels === 'gold_pro'
        ? '#FACC15'
        : car.wheels === 'carbon'
          ? '#64748B'
          : '#E2E8F0';
  const wheelPositions = [
    { wx: L * 0.28, wy: -W / 2 - 2 },
    { wx: L * 0.28, wy: W / 2 - wheelH + 2 },
    { wx: -L * 0.3, wy: -W / 2 - 2 },
    { wx: -L * 0.3, wy: W / 2 - wheelH + 2 },
  ];
  for (const wp of wheelPositions) {
    ctx.fillStyle = '#090D14';
    ctx.beginPath();
    ctx.roundRect(wp.wx - wheelW / 2, wp.wy, wheelW, wheelH, 2);
    ctx.fill();
    ctx.fillStyle = wheelRim;
    ctx.fillRect(wp.wx - 2.5, wp.wy + 1, 5, wheelH - 2);
  }

  // Main Chassis Body
  ctx.fillStyle = car.primaryColor;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (car.chassis === 'breakout') {
    ctx.moveTo(-L / 2, -W / 2 + 3);
    ctx.lineTo(L * 0.25, -W / 2);
    ctx.lineTo(L / 2, -W * 0.26);
    ctx.lineTo(L / 2, W * 0.26);
    ctx.lineTo(L * 0.25, W / 2);
    ctx.lineTo(-L / 2, W / 2 - 3);
    ctx.closePath();
  } else if (car.chassis === 'dominus') {
    ctx.roundRect(-L / 2, -W / 2, L, W, 5);
  } else if (car.chassis === 'fennec') {
    ctx.roundRect(-L / 2, -W / 2, L, W, 8);
  } else {
    ctx.roundRect(-L / 2, -W / 2 + 1, L, W - 2, [7, 10, 10, 7]);
  }
  ctx.fill();
  ctx.stroke();

  // Decals clipped inside body
  ctx.save();
  ctx.clip();
  ctx.fillStyle = car.secondaryColor;
  if (car.decal === 'racing_stripes') {
    ctx.fillRect(-L / 2, -5.5, L, 3.5);
    ctx.fillRect(-L / 2, 2, L, 3.5);
  } else if (car.decal === 'flames') {
    ctx.beginPath();
    ctx.moveTo(L / 2, -W / 2);
    ctx.lineTo(0, -W * 0.22);
    ctx.lineTo(L * 0.16, 0);
    ctx.lineTo(0, W * 0.22);
    ctx.lineTo(L / 2, W / 2);
    ctx.closePath();
    ctx.fill();
  } else if (car.decal === 'bolt') {
    ctx.beginPath();
    ctx.moveTo(-L * 0.25, -W * 0.35);
    ctx.lineTo(L * 0.08, -2);
    ctx.lineTo(-L * 0.04, 2);
    ctx.lineTo(L * 0.32, W * 0.35);
    ctx.lineTo(-L * 0.06, 6);
    ctx.lineTo(L * 0.04, 1);
    ctx.closePath();
    ctx.fill();
  } else if (car.decal === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const a2 = a1 + Math.PI / 5;
      const r1 = 8;
      const r2 = 3.6;
      if (i === 0) ctx.moveTo(Math.cos(a1) * r1 + 8, Math.sin(a1) * r1);
      else ctx.lineTo(Math.cos(a1) * r1 + 8, Math.sin(a1) * r1);
      ctx.lineTo(Math.cos(a2) * r2 + 8, Math.sin(a2) * r2);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Cabin Windshield & Roof
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(-L * 0.16, -W * 0.32, L * 0.42, W * 0.64, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
  ctx.beginPath();
  ctx.roundRect(L * 0.08, -W * 0.27, L * 0.14, W * 0.54, 3);
  ctx.fill();

  // Headlights
  ctx.fillStyle = '#FEF9C3';
  ctx.fillRect(L / 2 - 3, -W * 0.34, 3, 5);
  ctx.fillRect(L / 2 - 3, W * 0.34 - 5, 3, 5);

  // Toppers / Spoilers
  if (car.topper === 'wing') {
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = car.secondaryColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-L / 2 - 2, -W * 0.46, 7, W * 0.92, 2);
    ctx.fill();
    ctx.stroke();
  } else if (car.topper === 'crown') {
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(3, -8);
    ctx.lineTo(1, -2);
    ctx.lineTo(6, 0);
    ctx.lineTo(1, 2);
    ctx.lineTo(3, 8);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
  } else if (car.topper === 'antenna_br') {
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-L * 0.36, -W * 0.3);
    ctx.lineTo(-L * 0.48, -W * 0.52);
    ctx.stroke();
    ctx.fillStyle = '#009C3B';
    ctx.fillRect(-L * 0.56, -W * 0.62, 7, 5);
    ctx.fillStyle = '#FFDF00';
    ctx.fillRect(-L * 0.54, -W * 0.59, 3, 2);
  }

  ctx.restore();

  // Floating Label + Nitro Bar (unrotated above car)
  if (opts?.showLabel && opts.label) {
    ctx.fillStyle = 'rgba(6, 12, 24, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-34, -36, 68, 15, 4);
    ctx.fill();
    ctx.fillStyle = opts.isHuman ? '#6EE7B7' : '#F8FAFC';
    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label, 0, -28.5);

    if (typeof opts.nitro === 'number') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(-20, 24, 40, 4);
      ctx.fillStyle = opts.nitro > 60 ? '#F97316' : '#FACC15';
      ctx.fillRect(-20, 24, (Math.max(0, Math.min(100, opts.nitro)) / 100) * 40, 4);
    }
  }

  ctx.restore();
}

export function drawRocketBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spin: number
) {
  ctx.save();
  // Ground shadow
  ctx.beginPath();
  ctx.arc(x + 3, y + 4, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  // Metallic Rocket Ball
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.15, x, y, r);
  grad.addColorStop(0, '#F8FAFC');
  grad.addColorStop(0.55, '#94A3B8');
  grad.addColorStop(1, '#334155');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#38BDF8';
  ctx.stroke();

  // Rotating glowing hexagon panels
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3;
    const px = Math.cos(ang) * (r * 0.55);
    const py = Math.sin(ang) * (r * 0.55);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}
