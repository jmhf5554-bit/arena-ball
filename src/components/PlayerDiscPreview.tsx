import React, { useEffect, useRef } from 'react';
import { KitConfig } from '../types/game';
import { drawPlayerDisc } from '../utils/canvasDraw';

interface PlayerDiscPreviewProps {
  kit: KitConfig;
  label?: string;
  playerName?: string;
  size?: number;
}

export const PlayerDiscPreview: React.FC<PlayerDiscPreviewProps> = ({
  kit,
  label = '10',
  playerName = 'Você',
  size = 160,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Draw mini striped grass pitch preview
    ctx.fillStyle = '#256B2A';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(0, 0, size / 2, size);

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
    ctx.stroke();

    drawPlayerDisc(ctx, size / 2, size / 2 + 4, size * 0.19, kit, label, {
      isHuman: true,
      kickGlow: 0.85,
      kickAngle: -0.35,
      playerName,
      showName: true,
    });
  }, [kit, label, playerName, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="rounded-xl border border-emerald-500/25 shadow-inner"
    />
  );
};
