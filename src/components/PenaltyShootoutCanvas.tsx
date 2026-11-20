import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Trophy, LogOut } from 'lucide-react';
import { ActiveMatchConfig, MatchResult } from '../types/game';
import { drawPlayerDisc, drawSoccerBall } from '../utils/canvasDraw';
import { soundEngine } from '../utils/audio';
import { pollGamepadInput } from '../utils/gamepad';
import { ClubCrest } from './ClubCrest';

interface PenaltyShootoutCanvasProps {
  config: ActiveMatchConfig;
  initialHomeGoals?: number;
  initialAwayGoals?: number;
  onComplete: (result: MatchResult) => void;
  onExit: () => void;
}

const ARENA_W = 1000;
const ARENA_H = 620;
const GOAL_LEFT = 290;
const GOAL_RIGHT = 710;
const GOAL_Y = 95;
const BALL_START_Y = 470;
const BALL_R = 13;
const GK_R = 23;
const KICKER_R = 21;

export const PenaltyShootoutCanvas: React.FC<PenaltyShootoutCanvasProps> = ({
  config,
  initialHomeGoals = 0,
  initialAwayGoals = 0,
  onComplete,
  onExit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const humanSide = config.humanSide || 'home';

  const [round, setRound] = useState(1);
  const [turn, setTurn] = useState<'user_kick' | 'user_save'>('user_kick');
  const [homeKicks, setHomeKicks] = useState<(boolean | null)[]>([null, null, null, null, null]);
  const [awayKicks, setAwayKicks] = useState<(boolean | null)[]>([null, null, null, null, null]);
  const [banner, setBanner] = useState<string>('Sua vez de bater! Use A/D para mirar e Espaço para chutar');
  const [finishedWinner, setFinishedWinner] = useState<'home' | 'away' | null>(null);

  const simRef = useRef({
    aimX: ARENA_W / 2,
    phase: 'aiming' as 'aiming' | 'flying' | 'resolving',
    ballX: ARENA_W / 2,
    ballY: BALL_START_Y,
    ballVx: 0,
    ballVy: 0,
    ballSpin: 0,
    gkX: ARENA_W / 2,
    gkTargetX: ARENA_W / 2,
    gkVx: 0,
    kickerY: BALL_START_Y + 46,
    resolveTimer: 0,
    held: new Set<string>(),
    shotTriggered: false,
    aiShootTimer: 0,
    aiTargetX: ARENA_W / 2,
    prevGpKick: false,
  });

  const homeScore = homeKicks.filter((x) => x === true).length;
  const awayScore = awayKicks.filter((x) => x === true).length;

  const checkWinner = useCallback(
    (hList: (boolean | null)[], aList: (boolean | null)[]) => {
      const hGoals = hList.filter((x) => x === true).length;
      const aGoals = aList.filter((x) => x === true).length;
      const hTaken = hList.filter((x) => x !== null).length;
      const aTaken = aList.filter((x) => x !== null).length;

      if (hTaken <= 5 && aTaken <= 5) {
        const hRem = 5 - hTaken;
        const aRem = 5 - aTaken;
        if (hGoals > aGoals + aRem) return 'home';
        if (aGoals > hGoals + hRem) return 'away';
        if (hTaken === 5 && aTaken === 5 && hGoals !== aGoals) {
          return hGoals > aGoals ? 'home' : 'away';
        }
        return null;
      }

      // Sudden death (both took equal kicks >= 6)
      if (hTaken === aTaken && hGoals !== aGoals) {
        return hGoals > aGoals ? 'home' : 'away';
      }
      return null;
    },
    []
  );

  const resetForNextKick = useCallback((nextTurn: 'user_kick' | 'user_save') => {
    const s = simRef.current;
    s.phase = 'aiming';
    s.aimX = ARENA_W / 2;
    s.ballX = ARENA_W / 2;
    s.ballY = BALL_START_Y;
    s.ballVx = 0;
    s.ballVy = 0;
    s.gkX = ARENA_W / 2;
    s.gkTargetX = ARENA_W / 2;
    s.gkVx = 0;
    s.kickerY = BALL_START_Y + 46;
    s.shotTriggered = false;
    s.aiShootTimer = 1.15;
    s.aiTargetX = GOAL_LEFT + 35 + Math.random() * (GOAL_RIGHT - GOAL_LEFT - 70);

    if (nextTurn === 'user_kick') {
      setBanner('Sua cobrança! Use A/D para mirar e Espaço para chutar!');
    } else {
      setBanner('Defenda o pênalti! Use A/D para posicionar seu goleiro!');
      const savePrompts = [
        'Coração na mão agora! Prepare o goleiro, lá vem a cobrança!',
        'Silêncio no estádio! Olho no batedor pra tentar a defesa!',
      ];
      soundEngine.speakNarration(savePrompts[Math.floor(Math.random() * savePrompts.length)], {
        priority: false,
        emotion: 'tension',
      });
    }
  }, []);

  useEffect(() => {
    soundEngine.playWhistle(false);
    soundEngine.speakNarration(
      `É decisão nos pênaltis entre ${config.homeTeam.name} e ${config.awayTeam.name}! Haja coração!`,
      { priority: true, emotion: 'dramatic' }
    );
    resetForNextKick('user_kick');
    return () => {
      soundEngine.stopNarration();
    };
  }, [config.awayTeam.name, config.homeTeam.name, resetForNextKick]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      simRef.current.held.add(e.code);
      if (e.code === 'Space' && !e.repeat) {
        simRef.current.shotTriggered = true;
      }
    };
    const onUp = (e: KeyboardEvent) => simRef.current.held.delete(e.code);
    const onBlur = () => simRef.current.held.clear();

    window.addEventListener('keydown', onDown, { passive: false });
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const recordKick = (scored: boolean) => {
      const isUserHome = humanSide === 'home';
      const kickingSide = turn === 'user_kick' ? humanSide : humanSide === 'home' ? 'away' : 'home';

      const kickingTeam = kickingSide === 'home' ? config.homeTeam.name : config.awayTeam.name;

      if (scored) {
        soundEngine.playGoalCheer();
        setBanner(`GOOOOL DE PÊNALTI · ${kickingTeam}!`);
        const scoredCalls = [
          `Lá dentro! Gol de pênalti do ${kickingTeam}, sem chance de defesa!`,
          `Frieza total! Bola na rede para o ${kickingTeam}!`,
        ];
        soundEngine.speakNarration(scoredCalls[Math.floor(Math.random() * scoredCalls.length)], {
          priority: true,
          emotion: 'goal',
        });
      } else {
        soundEngine.playPostClang();
        setBanner('DEFENDEU / PRA FORA!');
        const missCalls = [
          `Inacreditável! Perdeu a cobrança o ${kickingTeam}, explode a torcida!`,
          `Parou na hora H! Não entrou o pênalti do ${kickingTeam}!`,
        ];
        soundEngine.speakNarration(missCalls[Math.floor(Math.random() * missCalls.length)], {
          priority: true,
          emotion: 'tension',
        });
      }

      if (kickingSide === 'home') {
        setHomeKicks((prev) => {
          const next = [...prev];
          const idx = next.findIndex((v) => v === null);
          if (idx !== -1) next[idx] = scored;
          else next.push(scored);

          const win = checkWinner(next, awayKicks);
          if (win) setFinishedWinner(win);
          return next;
        });
      } else {
        setAwayKicks((prev) => {
          const next = [...prev];
          const idx = next.findIndex((v) => v === null);
          if (idx !== -1) next[idx] = scored;
          else next.push(scored);

          const win = checkWinner(homeKicks, next);
          if (win) setFinishedWinner(win);
          return next;
        });
      }

      void isUserHome;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const s = simRef.current;

      const gp = config.settings.gamepadEnabled ? pollGamepadInput() : null;
      if (gp?.connected) {
        if (gp.kickDown && !s.prevGpKick && s.phase === 'aiming' && turn === 'user_kick') {
          s.shotTriggered = true;
        }
        s.prevGpKick = gp.kickDown;
      }

      if (!finishedWinner) {
        if (s.phase === 'aiming') {
          if (turn === 'user_kick') {
            if (s.held.has('KeyA') || s.held.has('ArrowLeft')) s.aimX -= 320 * dt;
            if (s.held.has('KeyD') || s.held.has('ArrowRight')) s.aimX += 320 * dt;
            if (gp?.connected && Math.abs(gp.moveX) > 0.1) s.aimX += gp.moveX * 320 * dt;
            s.aimX = Math.max(GOAL_LEFT - 10, Math.min(GOAL_RIGHT + 10, s.aimX));

            if (s.shotTriggered) {
              s.shotTriggered = false;
              s.phase = 'flying';
              s.kickerY = BALL_START_Y + 12;
              const dx = s.aimX - s.ballX;
              const dy = GOAL_Y - s.ballY;
              const dist = Math.hypot(dx, dy) || 1;
              const speed = 720;
              s.ballVx = (dx / dist) * speed;
              s.ballVy = (dy / dist) * speed;
              // AI GK dives left/center/right
              const diffChoice =
                config.settings.difficulty === 'facil'
                  ? (Math.random() - 0.5) * 320
                  : config.settings.difficulty === 'medio'
                    ? (s.aimX - ARENA_W / 2) * 0.55 + (Math.random() - 0.5) * 180
                    : (s.aimX - ARENA_W / 2) * 0.85 + (Math.random() - 0.5) * 90;
              s.gkTargetX = Math.max(GOAL_LEFT + 26, Math.min(GOAL_RIGHT - 26, ARENA_W / 2 + diffChoice));
              soundEngine.playKick(1.15, false);
            }
          } else {
            // User defends as Goalkeeper
            if (s.held.has('KeyA') || s.held.has('ArrowLeft')) s.gkX -= 380 * dt;
            if (s.held.has('KeyD') || s.held.has('ArrowRight')) s.gkX += 380 * dt;
            if (gp?.connected && Math.abs(gp.moveX) > 0.1) s.gkX += gp.moveX * 380 * dt;
            s.gkX = Math.max(GOAL_LEFT + 22, Math.min(GOAL_RIGHT - 22, s.gkX));

            s.aiShootTimer -= dt;
            if (s.aiShootTimer <= 0) {
              s.phase = 'flying';
              s.kickerY = BALL_START_Y + 12;
              const dx = s.aiTargetX - s.ballX;
              const dy = GOAL_Y - s.ballY;
              const dist = Math.hypot(dx, dy) || 1;
              const speed = config.settings.difficulty === 'dificil' ? 760 : 660;
              s.ballVx = (dx / dist) * speed;
              s.ballVy = (dy / dist) * speed;
              soundEngine.playKick(1.1, false);
            }
          }
        } else if (s.phase === 'flying') {
          const spd = Math.hypot(s.ballVx, s.ballVy);
          s.ballX += s.ballVx * dt;
          s.ballY += s.ballVy * dt;
          s.ballSpin += (spd * dt) / BALL_R;

          // Move goalkeeper
          if (turn === 'user_kick') {
            const gDiff = s.gkTargetX - s.gkX;
            const gSpd = config.settings.difficulty === 'dificil' ? 520 : config.settings.difficulty === 'medio' ? 400 : 290;
            if (Math.abs(gDiff) > 4) {
              s.gkX += Math.sign(gDiff) * Math.min(Math.abs(gDiff), gSpd * dt);
            }
          } else {
            if (s.held.has('KeyA') || s.held.has('ArrowLeft')) s.gkX -= 460 * dt;
            if (s.held.has('KeyD') || s.held.has('ArrowRight')) s.gkX += 460 * dt;
            if (gp?.connected && Math.abs(gp.moveX) > 0.1) s.gkX += gp.moveX * 460 * dt;
            s.gkX = Math.max(GOAL_LEFT + 22, Math.min(GOAL_RIGHT - 22, s.gkX));
          }

          // Check GK Save collision
          const gkDist = Math.hypot(s.ballX - s.gkX, s.ballY - (GOAL_Y + 18));
          if (gkDist < GK_R + BALL_R) {
            s.phase = 'resolving';
            s.resolveTimer = 1.3;
            s.ballVy = Math.abs(s.ballVy) * 0.4;
            s.ballVx *= -0.4;
            recordKick(false);
          } else if (s.ballY <= GOAL_Y) {
            const insidePosts = s.ballX > GOAL_LEFT + BALL_R * 0.5 && s.ballX < GOAL_RIGHT - BALL_R * 0.5;
            s.phase = 'resolving';
            s.resolveTimer = 1.3;
            recordKick(insidePosts);
          }
        } else if (s.phase === 'resolving') {
          s.ballX += s.ballVx * dt * 0.3;
          s.ballY += s.ballVy * dt * 0.3;
          s.resolveTimer -= dt;
          if (s.resolveTimer <= 0) {
            const nextTurn = turn === 'user_kick' ? 'user_save' : 'user_kick';
            if (nextTurn === 'user_kick') {
              setRound((r) => r + 1);
            }
            setTurn(nextTurn);
            resetForNextKick(nextTurn);
          }
        }
      }

      // Render Penalty Arena
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          if (canvas.width !== ARENA_W * dpr || canvas.height !== ARENA_H * dpr) {
            canvas.width = ARENA_W * dpr;
            canvas.height = ARENA_H * dpr;
          }
          ctx.save();
          ctx.scale(dpr, dpr);

          // Grass stripes
          for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#2D7D36' : '#256B2A';
            ctx.fillRect(i * (ARENA_W / 8), 0, ARENA_W / 8 + 1, ARENA_H);
          }

          // Penalty Box Lines
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 3;
          ctx.strokeRect(140, GOAL_Y, ARENA_W - 280, 390);
          ctx.strokeRect(GOAL_LEFT - 45, GOAL_Y, GOAL_RIGHT - GOAL_LEFT + 90, 145);

          // Penalty spot & arc
          ctx.beginPath();
          ctx.arc(ARENA_W / 2, BALL_START_Y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ARENA_W / 2, BALL_START_Y, 95, 0.25, Math.PI - 0.25);
          ctx.stroke();

          // Goal Net
          ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
          ctx.fillRect(GOAL_LEFT, GOAL_Y - 56, GOAL_RIGHT - GOAL_LEFT, 56);
          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 4;
          ctx.strokeRect(GOAL_LEFT, GOAL_Y - 56, GOAL_RIGHT - GOAL_LEFT, 56);

          // Goalposts
          [GOAL_LEFT, GOAL_RIGHT].forEach((px) => {
            ctx.beginPath();
            ctx.arc(px, GOAL_Y, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.strokeStyle = '#09090B';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          });

          // Aim reticle when user kicks
          if (turn === 'user_kick' && s.phase === 'aiming') {
            ctx.save();
            ctx.setLineDash([7, 6]);
            ctx.strokeStyle = '#FACC15';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(s.ballX, s.ballY);
            ctx.lineTo(s.aimX, GOAL_Y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(s.aimX, GOAL_Y, 11, 0, Math.PI * 2);
            ctx.fillStyle = '#FACC15';
            ctx.fill();
            ctx.restore();
          }

          const kickingTeam =
            turn === 'user_kick'
              ? humanSide === 'home'
                ? config.homeTeam
                : config.awayTeam
              : humanSide === 'home'
                ? config.awayTeam
                : config.homeTeam;
          const defendingTeam =
            kickingTeam.id === config.homeTeam.id ? config.awayTeam : config.homeTeam;

          // Draw Goalkeeper
          drawPlayerDisc(ctx, s.gkX, GOAL_Y + 18, GK_R, defendingTeam.kit, 'GL', {
            isHuman: turn === 'user_save',
            isGoalkeeper: true,
            playerName: turn === 'user_save' ? `VOCÊ (GL · ${defendingTeam.shortCode})` : `GL ${defendingTeam.shortCode}`,
            showName: true,
          });

          // Draw Kicker
          const kicker = kickingTeam.players[0];
          drawPlayerDisc(ctx, ARENA_W / 2, s.kickerY, KICKER_R, kickingTeam.kit, String(kicker?.number || 10), {
            isHuman: turn === 'user_kick',
            playerName: kicker?.shortName || 'Batedor',
            showName: true,
            kickGlow: s.phase === 'flying' ? 1 : 0,
            kickAngle: -Math.PI / 2,
          });

          // Draw Ball
          drawSoccerBall(ctx, s.ballX, s.ballY, BALL_R, s.ballSpin);

          ctx.restore();
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [awayKicks, checkWinner, config, finishedWinner, homeKicks, humanSide, resetForNextKick, turn]);

  // Add sudden death slots if past 5 rounds
  const maxSlots = Math.max(5, homeKicks.length, awayKicks.length);

  return (
    <div className="relative w-full h-[100dvh] flex flex-col items-center justify-between bg-[#09150E] p-2 sm:p-4 safe-area-hud overflow-hidden">
      {/* Top Penalty Scoreboard */}
      <div className="w-full max-w-4xl shrink-0 bg-[#0D1612] border border-white/15 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 mb-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <ClubCrest team={config.homeTeam} size={28} />
            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs font-bold text-white truncate">
                {config.homeTeam.shortCode}
              </div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {Array.from({ length: maxSlots }).map((_, i) => {
                  const v = homeKicks[i] ?? null;
                  return (
                    <span
                      key={i}
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border ${
                        v === true
                          ? 'bg-emerald-400 border-emerald-200'
                          : v === false
                            ? 'bg-rose-500 border-rose-300'
                            : 'bg-black/40 border-white/25'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-white ml-auto sm:ml-2 tabular-nums">
              {homeScore}
            </span>
          </div>

          <div className="text-center px-1 sm:px-3">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Pênaltis · S{round}
            </div>
            <div className="hidden md:block text-xs text-slate-300 mt-0.5 max-w-[260px] truncate">
              {banner}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 justify-end min-w-0">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-white mr-auto sm:mr-2 tabular-nums">
              {awayScore}
            </span>
            <div className="text-right min-w-0">
              <div className="text-[11px] sm:text-xs font-bold text-white truncate">
                {config.awayTeam.shortCode}
              </div>
              <div className="flex gap-1 mt-1 justify-end flex-wrap">
                {Array.from({ length: maxSlots }).map((_, i) => {
                  const v = awayKicks[i] ?? null;
                  return (
                    <span
                      key={i}
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border ${
                        v === true
                          ? 'bg-emerald-400 border-emerald-200'
                          : v === false
                            ? 'bg-rose-500 border-rose-300'
                            : 'bg-black/40 border-white/25'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
            <ClubCrest team={config.awayTeam} size={28} />
          </div>
        </div>
        <div className="md:hidden text-[11px] text-slate-300 text-center mt-1 truncate">{banner}</div>
      </div>

      {/* Responsive Penalty Pitch Canvas (phones -> tablets -> 4K TVs) */}
      <div className="flex-1 w-full min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full max-w-full max-h-full object-contain rounded-2xl border border-white/15 shadow-2xl"
          style={{ aspectRatio: `${ARENA_W} / ${ARENA_H}` }}
        />
      </div>

      {/* Touch Controls for Mobile / Tablet + Exit Button */}
      <div className="w-full max-w-4xl shrink-0 mt-2 flex flex-wrap items-center justify-between gap-2">
        {config.settings.mobileControls ? (
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  simRef.current.held.add('KeyA');
                }}
                onTouchEnd={() => simRef.current.held.delete('KeyA')}
                onTouchCancel={() => simRef.current.held.delete('KeyA')}
                onMouseDown={() => simRef.current.held.add('KeyA')}
                onMouseUp={() => simRef.current.held.delete('KeyA')}
                onMouseLeave={() => simRef.current.held.delete('KeyA')}
                className="px-5 py-3 rounded-xl bg-white/15 active:bg-white/25 border border-white/25 font-bold text-white text-sm select-none touch-none cursor-pointer"
              >
                ◀ Esq
              </button>
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  simRef.current.held.add('KeyD');
                }}
                onTouchEnd={() => simRef.current.held.delete('KeyD')}
                onTouchCancel={() => simRef.current.held.delete('KeyD')}
                onMouseDown={() => simRef.current.held.add('KeyD')}
                onMouseUp={() => simRef.current.held.delete('KeyD')}
                onMouseLeave={() => simRef.current.held.delete('KeyD')}
                className="px-5 py-3 rounded-xl bg-white/15 active:bg-white/25 border border-white/25 font-bold text-white text-sm select-none touch-none cursor-pointer"
              >
                Dir ▶
              </button>
            </div>

            <div className="flex items-center gap-2">
              {turn === 'user_kick' && (
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    simRef.current.shotTriggered = true;
                  }}
                  onClick={() => {
                    simRef.current.shotTriggered = true;
                  }}
                  className="px-6 py-3 rounded-xl bg-amber-500 active:scale-95 border-2 border-white/80 font-display text-lg font-extrabold text-slate-950 shadow-lg touch-none cursor-pointer"
                >
                  CHUTAR
                </button>
              )}
              <button
                onClick={onExit}
                className="px-3 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 flex items-center gap-1 text-xs cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs text-slate-300">
            <span>A / D Mover Mira ou Goleiro · Espaço Bater</span>
            <button
              onClick={onExit}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        )}
      </div>

      {finishedWinner && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-40 overflow-y-auto">
          <div className="w-full max-w-md bg-[#111C16] border border-amber-400/40 rounded-2xl p-5 sm:p-6 text-center shadow-2xl max-h-[92dvh] overflow-y-auto">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
            <div className="text-xs font-bold uppercase text-amber-300">{config.tournamentLabel}</div>
            <h2 className="font-display text-3xl font-extrabold text-white mt-1">
              {finishedWinner === 'home' ? config.homeTeam.name : config.awayTeam.name} Venceu nos Pênaltis!
            </h2>
            <div className="mt-4 py-3 bg-black/35 rounded-xl border border-white/10 font-mono-tabular text-2xl font-extrabold text-white">
              {homeScore} x {awayScore} (Pênaltis)
            </div>
            <button
              onClick={() =>
                onComplete({
                  homeGoals: initialHomeGoals,
                  awayGoals: initialAwayGoals,
                  scorers: [],
                  winnerSide: finishedWinner,
                  tournament: config.tournament,
                  careerFixtureId: config.careerFixtureId,
                  penaltySummary: `${homeScore} x ${awayScore} nos pênaltis`,
                })
              }
              className="mt-5 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
