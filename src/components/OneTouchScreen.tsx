import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Heart,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Smartphone,
  Trophy,
  Volume2,
  VolumeX,
  AlertOctagon,
  Gamepad2,
} from 'lucide-react';
import { AIDifficulty, LeagueId, MatchSettings, Team } from '../types/game';
import { LEAGUES } from '../data/teams2027';
import { drawPlayerDisc, drawSoccerBall } from '../utils/canvasDraw';
import { soundEngine } from '../utils/audio';
import { pollGamepadInput } from '../utils/gamepad';
import { ClubCrest } from './ClubCrest';

interface OneTouchScreenProps {
  teams: Team[];
  settings: MatchSettings;
  onUpdateSettings: (patch: Partial<MatchSettings>) => void;
  onBack: () => void;
}

interface OneTouchActor {
  id: string;
  name: string;
  number: string;
  team: Team;
  isHuman: boolean;
  isGoalkeeper: boolean;
  lives: number;
  eliminated: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kickGlow: number;
  kickAngle: number;
  touchGraceTimer: number;
  targetX: number;
  targetY: number;
}

interface OneTouchAlert {
  badge: string;
  title: string;
  detail: string;
  kind: 'foul' | 'save' | 'goal' | 'rebound' | 'victory';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface SimState {
  phase: 'playing' | 'swap' | 'goal_reset' | 'finished';
  phaseTimer: number;
  swapInfo: {
    fromId: string;
    toId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    reason: string;
  } | null;
  actors: OneTouchActor[];
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  ballSpin: number;
  lastLineTouchId: string | null;
  gkDeflectedSinceLastLineTouch: boolean;
  ballStoppedTimer: number;
  roundCount: number;
  paused: boolean;
  cameraZoom: number;
  cameraFocusX: number;
  cameraFocusY: number;
  particles: Particle[];
  winnerId: string | null;
}

const ARENA_W = 1200;
const ARENA_H = 680;
// Half-court layout: midfield line on left (x=130), goal on right (x=1090)
const PITCH_X = 130;
const PITCH_Y = 85;
const PITCH_W = 960;
const PITCH_H = 510;
const PITCH_RIGHT = PITCH_X + PITCH_W; // 1090
const PITCH_BOT = PITCH_Y + PITCH_H; // 595
const GOAL_W = 54;
const GOAL_H = 196;
const GOAL_TOP = PITCH_Y + (PITCH_H - GOAL_H) / 2;
const GOAL_BOT = GOAL_TOP + GOAL_H;
const POST_R = 9;
const PLAYER_R = 20;
const GK_R = 20;
const BALL_R = 11.5;
const MAX_LIVES = 5;

const LINE_SLOTS: { x: number; y: number }[] = [
  { x: 430, y: 340 },
  { x: 560, y: 195 },
  { x: 560, y: 485 },
  { x: 700, y: 270 },
  { x: 700, y: 410 },
];

export const OneTouchScreen: React.FC<OneTouchScreenProps> = ({
  teams,
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const [setupLeague, setSetupLeague] = useState<LeagueId>('brasileirao');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('fla');
  const [lineCount, setLineCount] = useState<2 | 3 | 4 | 5>(3);
  const [startInGoal, setStartInGoal] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<AIDifficulty>(settings.difficulty || 'medio');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [hudActors, setHudActors] = useState<
    {
      id: string;
      name: string;
      number: string;
      shortCode: string;
      primaryColor: string;
      secondaryColor: string;
      isHuman: boolean;
      isGoalkeeper: boolean;
      lives: number;
      eliminated: boolean;
    }[]
  >([]);
  const [commentaryText, setCommentaryText] = useState<string>(
    'Regra de 1 toque! Passe ou chute de primeira — dois toques vai pro gol!'
  );
  const [alertBanner, setAlertBanner] = useState<OneTouchAlert | null>(null);
  const [ballStopWarning, setBallStopWarning] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [humanIsGkHud, setHumanIsGkHud] = useState<boolean>(false);
  const [winnerActor, setWinnerActor] = useState<OneTouchActor | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<SimState | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const kickJustPressedRef = useRef<boolean>(false);
  const touchStickRef = useRef<{ active: boolean; dx: number; dy: number; id: number | null }>({
    active: false,
    dx: 0,
    dy: 0,
    id: null,
  });
  const [stickVisual, setStickVisual] = useState({ x: 0, y: 0 });
  const alertTimerRef = useRef<number | null>(null);

  const filteredTeams = useMemo(
    () => teams.filter((t) => t.leagueId === setupLeague),
    [teams, setupLeague]
  );

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) || filteredTeams[0] || teams[0],
    [teams, selectedTeamId, filteredTeams]
  );

  const showVisualAlert = useCallback((alert: OneTouchAlert, durationMs = 1800) => {
    setAlertBanner(alert);
    if (alertTimerRef.current !== null) {
      window.clearTimeout(alertTimerRef.current);
    }
    if (durationMs > 0) {
      alertTimerRef.current = window.setTimeout(() => {
        setAlertBanner(null);
      }, durationMs);
    }
  }, []);

  const announce = useCallback((text: string, speak = true, emotion: 'normal' | 'tension' | 'goal' | 'dramatic' = 'normal') => {
    setCommentaryText(text);
    if (speak) {
      soundEngine.speakNarration(text, { priority: emotion !== 'normal', emotion });
    }
  }, []);

  const syncHudFromSim = useCallback((sim: SimState) => {
    setHudActors(
      sim.actors.map((a) => ({
        id: a.id,
        name: a.name,
        number: a.number,
        shortCode: a.team.shortCode,
        primaryColor: a.team.kit.primaryColor,
        secondaryColor: a.team.kit.secondaryColor,
        isHuman: a.isHuman,
        isGoalkeeper: a.isGoalkeeper,
        lives: a.lives,
        eliminated: a.eliminated,
      }))
    );
    const human = sim.actors.find((a) => a.isHuman);
    setHumanIsGkHud(Boolean(human?.isGoalkeeper));
  }, []);

  const createInitialSim = useCallback((): SimState => {
    const rivalPool = teams.filter((t) => t.id !== selectedTeam.id);
    const shuffledRivals = [...rivalPool].sort(() => Math.random() - 0.5);
    const totalPlayers = lineCount + 1;

    const actors: OneTouchActor[] = [];
    for (let i = 0; i < totalPlayers; i++) {
      const isHuman = i === 0;
      const team = isHuman ? selectedTeam : shuffledRivals[i % shuffledRivals.length];
      const rosterPlayer =
        team.players.find((p) => p.position === 'ATA') ||
        team.players[team.players.length - 1] ||
        team.players[0];

      const isGoalkeeper = startInGoal ? i === 0 : i === totalPlayers - 1;
      actors.push({
        id: isHuman ? 'human' : `bot_${i}`,
        name: isHuman ? 'Você' : rosterPlayer?.name?.split(' ')[0] || team.shortCode,
        number: isHuman ? String(rosterPlayer?.number || 9) : String(rosterPlayer?.number || i + 2),
        team,
        isHuman,
        isGoalkeeper,
        lives: MAX_LIVES,
        eliminated: false,
        x: isGoalkeeper ? PITCH_RIGHT - 36 : LINE_SLOTS[0].x,
        y: ARENA_H / 2,
        vx: 0,
        vy: 0,
        radius: isGoalkeeper ? GK_R : PLAYER_R,
        kickGlow: 0,
        kickAngle: isGoalkeeper ? Math.PI : 0,
        touchGraceTimer: 0,
        targetX: LINE_SLOTS[0].x,
        targetY: ARENA_H / 2,
      });
    }

    const sim: SimState = {
      phase: 'playing',
      phaseTimer: 0,
      swapInfo: null,
      actors,
      ballX: 350,
      ballY: ARENA_H / 2,
      ballVx: 0,
      ballVy: 0,
      ballSpin: 0,
      lastLineTouchId: null,
      gkDeflectedSinceLastLineTouch: false,
      ballStoppedTimer: 0,
      roundCount: 1,
      paused: false,
      cameraZoom: 1,
      cameraFocusX: ARENA_W / 2,
      cameraFocusY: ARENA_H / 2,
      particles: [],
      winnerId: null,
    };

    positionActorsForRound(sim, true);
    return sim;
  }, [lineCount, selectedTeam, startInGoal, teams]);

  const startMatch = () => {
    soundEngine.unlock();
    soundEngine.stopSoundtrack();
    soundEngine.playClick();
    soundEngine.playWhistle(false);
    const sim = createInitialSim();
    simRef.current = sim;
    setWinnerActor(null);
    setAlertBanner(null);
    setIsPaused(false);
    setBallStopWarning(0);
    syncHudFromSim(sim);
    setIsPlaying(true);
    announce(
      `Modo 1 Toque valendo! ${lineCount} na linha contra 1 goleiro. Cinco vidas pra cada um!`,
      true,
      'tension'
    );
  };

  useEffect(() => {
    if (!isPlaying) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = true;
      if (k === ' ' || k === 'enter' || k === 'k') {
        e.preventDefault();
        soundEngine.unlock();
        kickJustPressedRef.current = true;
      }
      if (k === 'escape') {
        e.preventDefault();
        if (simRef.current && simRef.current.phase !== 'finished') {
          simRef.current.paused = !simRef.current.paused;
          setIsPaused(simRef.current.paused);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTime = performance.now();
    let prevPadKick = false;
    let prevPadPause = false;
    let hudTick = 0;

    const triggerSwap = (sim: SimState, offenderId: string | null, badge: string, title: string, detail: string) => {
      const gk = sim.actors.find((a) => a.isGoalkeeper && !a.eliminated);
      const aliveLine = sim.actors.filter((a) => !a.isGoalkeeper && !a.eliminated);
      let offender = aliveLine.find((a) => a.id === offenderId);
      if (!offender) {
        // Fallback: closest surviving line player to ball
        offender = [...aliveLine].sort(
          (a, b) => Math.hypot(a.x - sim.ballX, a.y - sim.ballY) - Math.hypot(b.x - sim.ballX, b.y - sim.ballY)
        )[0];
      }
      if (!gk || !offender) {
        positionActorsForRound(sim, false);
        return;
      }

      soundEngine.playWhistle(true);
      showVisualAlert({ badge, title, detail, kind: 'foul' }, 1750);
      announce(`${title}! ${offender.name} vai direto para o gol!`, true, 'dramatic');

      gk.isGoalkeeper = false;
      gk.radius = PLAYER_R;
      offender.isGoalkeeper = true;
      offender.radius = GK_R;

      sim.phase = 'swap';
      sim.phaseTimer = 0.78;
      sim.swapInfo = {
        fromId: gk.id,
        toId: offender.id,
        fromX: gk.x,
        fromY: gk.y,
        toX: offender.x,
        toY: offender.y,
        reason: title,
      };
      sim.cameraZoom = 1.12;
      sim.cameraFocusX = (gk.x + offender.x) / 2;
      sim.cameraFocusY = (gk.y + offender.y) / 2;
      sim.ballVx = 0;
      sim.ballVy = 0;
      sim.lastLineTouchId = null;
      sim.gkDeflectedSinceLastLineTouch = false;
      sim.ballStoppedTimer = 0;
      syncHudFromSim(sim);
    };

    const executeOneTouchLineStrike = (
      sim: SimState,
      actor: OneTouchActor,
      wantShot: boolean,
      aimDx: number,
      aimDy: number
    ) => {
      // Check strict 2-touch infraction!
      if (sim.lastLineTouchId === actor.id && actor.touchGraceTimer <= 0) {
        triggerSwap(
          sim,
          actor.id,
          '2 TOQUES!',
          'Infração: 2 Toques Seguidos!',
          `${actor.name} tocou duas vezes sem ninguém encostar na bola.`
        );
        return;
      }

      // Compute 1-touch pass or shot target (NO dribbling allowed!)
      const teammates = sim.actors.filter(
        (a) => !a.isGoalkeeper && !a.eliminated && a.id !== actor.id
      );

      let dirX = 1;
      let dirY = 0;
      let power = 760;

      if (wantShot || teammates.length === 0) {
        // Directed 1-touch shot toward goal mouth
        const goalAimX = PITCH_RIGHT + 14;
        let goalAimY = ARENA_H / 2 + aimDy * (GOAL_H * 0.42);
        if (Math.abs(aimDy) < 0.12 && !actor.isHuman) {
          const gk = sim.actors.find((a) => a.isGoalkeeper && !a.eliminated);
          const pickTop = gk ? gk.y > ARENA_H / 2 : Math.random() > 0.5;
          goalAimY = pickTop ? GOAL_TOP + 34 : GOAL_BOT - 34;
        }
        const dx = goalAimX - sim.ballX;
        const dy = goalAimY - sim.ballY;
        const dist = Math.hypot(dx, dy) || 1;
        dirX = dx / dist;
        dirY = dy / dist;
        power = 790 + (actor.isHuman ? 50 : difficulty === 'dificil' ? 60 : 15);
        announce(`${actor.name} bateu de primeira!`, false);
      } else {
        // Choose teammate best aligned with input direction (or best open teammate for AI)
        let chosen = teammates[0];
        let bestScore = -Infinity;
        for (const mate of teammates) {
          const tx = mate.x - actor.x;
          const ty = mate.y - actor.y;
          const dist = Math.hypot(tx, ty) || 1;
          const dot =
            Math.hypot(aimDx, aimDy) > 0.2
              ? (tx / dist) * aimDx + (ty / dist) * aimDy
              : 0.4;
          const forwardBonus = mate.x > actor.x ? 0.35 : 0;
          const score = dot * 2.2 + forwardBonus - dist / 900;
          if (score > bestScore) {
            bestScore = score;
            chosen = mate;
          }
        }
        const leadX = chosen.x + chosen.vx * 0.18;
        const leadY = chosen.y + chosen.vy * 0.18;
        const dx = leadX - sim.ballX;
        const dy = leadY - sim.ballY;
        const dist = Math.hypot(dx, dy) || 1;
        dirX = dx / dist;
        dirY = dy / dist;
        power = Math.min(720, Math.max(500, dist * 1.45));
      }

      sim.ballX = actor.x + dirX * (actor.radius + BALL_R + 3);
      sim.ballY = actor.y + dirY * (actor.radius + BALL_R + 3);
      sim.ballVx = dirX * power;
      sim.ballVy = dirY * power;
      sim.ballSpin = (Math.random() - 0.5) * 14;
      actor.kickAngle = Math.atan2(dirY, dirX);
      actor.kickGlow = 1;
      actor.touchGraceTimer = 0.22;
      sim.lastLineTouchId = actor.id;
      sim.gkDeflectedSinceLastLineTouch = false;
      sim.ballStoppedTimer = 0;
      soundEngine.playKick(wantShot ? 1.15 : 0.85, false);
    };

    const step = (now: number) => {
      const dt = Math.min(0.033, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;

      const sim = simRef.current;
      const canvas = canvasRef.current;
      if (!sim || !canvas) {
        rafId = requestAnimationFrame(step);
        return;
      }

      // Gamepad poll
      const pad = settings.gamepadEnabled ? pollGamepadInput() : null;
      if (pad?.kickDown && !prevPadKick) kickJustPressedRef.current = true;
      prevPadKick = Boolean(pad?.kickDown);
      if (pad?.pauseDown && !prevPadPause && sim.phase !== 'finished') {
        sim.paused = !sim.paused;
        setIsPaused(sim.paused);
      }
      prevPadPause = Boolean(pad?.pauseDown);

      if (!sim.paused) {
        // Particles
        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const p = sim.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) sim.particles.splice(i, 1);
        }

        // Smooth camera zoom return
        sim.cameraZoom += (1 - sim.cameraZoom) * Math.min(1, dt * 4.5);
        sim.cameraFocusX += (ARENA_W / 2 - sim.cameraFocusX) * Math.min(1, dt * 4.5);
        sim.cameraFocusY += (ARENA_H / 2 - sim.cameraFocusY) * Math.min(1, dt * 4.5);

        if (sim.phase === 'swap') {
          sim.phaseTimer -= dt;
          if (sim.phaseTimer <= 0) {
            sim.swapInfo = null;
            sim.phase = 'playing';
            positionActorsForRound(sim, false);
            syncHudFromSim(sim);
          }
        } else if (sim.phase === 'goal_reset') {
          sim.phaseTimer -= dt;
          if (sim.phaseTimer <= 0) {
            sim.phase = 'playing';
            positionActorsForRound(sim, false);
            syncHudFromSim(sim);
          }
        } else if (sim.phase === 'playing') {
          // Human input vector
          let hDx = 0;
          let hDy = 0;
          if (keysRef.current['w'] || keysRef.current['arrowup']) hDy -= 1;
          if (keysRef.current['s'] || keysRef.current['arrowdown']) hDy += 1;
          if (keysRef.current['a'] || keysRef.current['arrowleft']) hDx -= 1;
          if (keysRef.current['d'] || keysRef.current['arrowright']) hDx += 1;
          if (touchStickRef.current.active) {
            hDx += touchStickRef.current.dx;
            hDy += touchStickRef.current.dy;
          }
          if (pad && (Math.abs(pad.moveX) > 0.1 || Math.abs(pad.moveY) > 0.1)) {
            hDx = pad.moveX;
            hDy = pad.moveY;
          }
          const hMag = Math.hypot(hDx, hDy);
          if (hMag > 1) {
            hDx /= hMag;
            hDy /= hMag;
          }

          const diffSpeedMult = difficulty === 'facil' ? 0.85 : difficulty === 'dificil' ? 1.08 : 0.96;

          // Update actors movement
          const lineActors = sim.actors.filter((a) => !a.isGoalkeeper && !a.eliminated);
          const gk = sim.actors.find((a) => a.isGoalkeeper && !a.eliminated);

          // Closest AI line actor chases ball
          const chaser = [...lineActors].sort(
            (a, b) => Math.hypot(a.x - sim.ballX, a.y - sim.ballY) - Math.hypot(b.x - sim.ballX, b.y - sim.ballY)
          )[0];

          for (const actor of sim.actors) {
            if (actor.eliminated) continue;
            actor.kickGlow = Math.max(0, actor.kickGlow - dt * 3.8);
            actor.touchGraceTimer = Math.max(0, actor.touchGraceTimer - dt);

            let targetVx = 0;
            let targetVy = 0;
            const maxSpeed = actor.isGoalkeeper ? 295 : actor.isHuman ? 285 : 272 * diffSpeedMult;

            if (actor.isHuman) {
              targetVx = hDx * maxSpeed;
              targetVy = hDy * maxSpeed;
              if (hMag > 0.15) {
                actor.kickAngle = Math.atan2(hDy, hDx);
              }
            } else if (actor.isGoalkeeper) {
              // AI GK tracks ball Y inside goal box
              const guardX = Math.max(PITCH_RIGHT - 95, Math.min(PITCH_RIGHT - 28, sim.ballX + 42));
              const guardY = Math.max(GOAL_TOP + 22, Math.min(GOAL_BOT - 22, sim.ballY));
              const dx = (sim.ballX > PITCH_RIGHT - 190 ? guardX : PITCH_RIGHT - 38) - actor.x;
              const dy = guardY - actor.y;
              const dist = Math.hypot(dx, dy);
              if (dist > 4) {
                targetVx = (dx / dist) * maxSpeed * diffSpeedMult;
                targetVy = (dy / dist) * maxSpeed * diffSpeedMult;
              }
            } else {
              // AI Line Player: chaser runs toward ball (unless they are already lastLineTouchId, so they try to avoid 2 touches!)
              const mustAvoidDoubleTouch = sim.lastLineTouchId === actor.id;
              if (actor.id === chaser?.id && !mustAvoidDoubleTouch) {
                const dx = sim.ballX - actor.x;
                const dy = sim.ballY - actor.y;
                const dist = Math.hypot(dx, dy) || 1;
                targetVx = (dx / dist) * maxSpeed;
                targetVy = (dy / dist) * maxSpeed;
              } else {
                // Support positioning in offensive half
                const slotIdx = Math.max(0, lineActors.findIndex((x) => x.id === actor.id));
                const slot = LINE_SLOTS[slotIdx % LINE_SLOTS.length];
                const dynamicY = Math.max(
                  PITCH_Y + 50,
                  Math.min(PITCH_BOT - 50, slot.y + Math.sin(now * 0.0018 + slotIdx * 2) * 35)
                );
                const dx = slot.x - actor.x;
                const dy = dynamicY - actor.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 10) {
                  targetVx = (dx / dist) * maxSpeed * 0.72;
                  targetVy = (dy / dist) * maxSpeed * 0.72;
                }
              }
            }

            actor.vx += (targetVx - actor.vx) * Math.min(1, dt * 11);
            actor.vy += (targetVy - actor.vy) * Math.min(1, dt * 11);
            actor.x += actor.vx * dt;
            actor.y += actor.vy * dt;

            // Clamp actor bounds
            if (actor.isGoalkeeper) {
              actor.x = Math.max(PITCH_RIGHT - 165, Math.min(PITCH_RIGHT - actor.radius + 4, actor.x));
              actor.y = Math.max(PITCH_Y + 38, Math.min(PITCH_BOT - 38, actor.y));
            } else {
              actor.x = Math.max(PITCH_X + actor.radius, Math.min(PITCH_RIGHT - actor.radius - 6, actor.x));
              actor.y = Math.max(PITCH_Y + actor.radius, Math.min(PITCH_BOT - actor.radius, actor.y));
            }
          }

          // Human Kick Input (Space / CHUTAR / Gamepad)
          const human = sim.actors.find((a) => a.isHuman && !a.eliminated);
          const didPressKick = kickJustPressedRef.current;
          kickJustPressedRef.current = false;

          if (human && didPressKick) {
            const distBall = Math.hypot(sim.ballX - human.x, sim.ballY - human.y);
            if (!human.isGoalkeeper && distBall <= human.radius + BALL_R + 26) {
              executeOneTouchLineStrike(sim, human, true, hDx, hDy);
            } else if (human.isGoalkeeper && distBall <= human.radius + BALL_R + 30) {
              // Human GK clean catch ("Agarrar")
              const offenderId = sim.lastLineTouchId;
              triggerSwap(
                sim,
                offenderId,
                'AGARROU!',
                'Defesa Limpa do Goleiro!',
                `${human.name} encaixou a bola sem rebote!`
              );
            }
          }

          // Disc vs Disc collisions (plus Handball/GK interference foul check)
          for (let i = 0; i < sim.actors.length; i++) {
            const a = sim.actors[i];
            if (a.eliminated) continue;
            for (let j = i + 1; j < sim.actors.length; j++) {
              const b = sim.actors[j];
              if (b.eliminated) continue;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.hypot(dx, dy);
              const minD = a.radius + b.radius;
              if (dist > 0 && dist < minD) {
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minD - dist;
                a.x -= nx * overlap * 0.5;
                a.y -= ny * overlap * 0.5;
                b.x += nx * overlap * 0.5;
                b.y += ny * overlap * 0.5;

                // Condition 4: Interference inside tiny GK crease when ball is near GK
                const gkActor = a.isGoalkeeper ? a : b.isGoalkeeper ? b : null;
                const lineActor = a.isGoalkeeper ? b : b.isGoalkeeper ? a : null;
                if (
                  gkActor &&
                  lineActor &&
                  lineActor.x > PITCH_RIGHT - 95 &&
                  Math.hypot(sim.ballX - gkActor.x, sim.ballY - gkActor.y) < 75
                ) {
                  triggerSwap(
                    sim,
                    lineActor.id,
                    'FALTA / MÃO!',
                    'Infração na Área do Goleiro!',
                    `${lineActor.name} cometeu falta/mão dentro da pequena área.`
                  );
                }
              }
            }
          }

          if (sim.phase !== 'playing') {
            // Skip remaining ball physics if swap triggered
          } else {
            // Ball motion & turf friction
            sim.ballX += sim.ballVx * dt;
            sim.ballY += sim.ballVy * dt;
            const speed = Math.hypot(sim.ballVx, sim.ballVy);
            const drag = Math.pow(0.46, dt);
            sim.ballVx *= drag;
            sim.ballVy *= drag;
            sim.ballSpin += (speed / 60) * dt * 2.2;

            // Ball stopped > 3 seconds rule (Condition 4)
            if (speed < 18) {
              sim.ballStoppedTimer += dt;
              setBallStopWarning(sim.ballStoppedTimer);
              if (sim.ballStoppedTimer >= 3.0) {
                triggerSwap(
                  sim,
                  sim.lastLineTouchId,
                  'BOLA PARADA!',
                  'Mais de 3s com a Bola Parada!',
                  'Ninguém tocou na bola por 3 segundos — troca imediata no gol!'
                );
              }
            } else {
              if (sim.ballStoppedTimer > 0) {
                sim.ballStoppedTimer = 0;
                setBallStopWarning(0);
              }
            }

            // Actor vs Ball collisions (Strict 1-Touch / GK Save vs Parry)
            if (sim.phase === 'playing') {
              for (const actor of sim.actors) {
                if (actor.eliminated) continue;
                const dx = sim.ballX - actor.x;
                const dy = sim.ballY - actor.y;
                const dist = Math.hypot(dx, dy);
                const minD = actor.radius + BALL_R;
                if (dist > 0 && dist < minD) {
                  if (actor.isGoalkeeper) {
                    const shotSpeed = Math.hypot(sim.ballVx, sim.ballVy);
                    const centerHit = Math.abs(dy) <= actor.radius * 0.56;
                    const humanCatch = actor.isHuman && (didPressKick || keysRef.current[' ']);
                    const aiCatchChance =
                      difficulty === 'dificil' ? 0.68 : difficulty === 'medio' ? 0.5 : 0.32;

                    const caughtCleanly =
                      humanCatch ||
                      (shotSpeed > 150 &&
                        shotSpeed < 640 &&
                        centerHit &&
                        Math.random() < aiCatchChance);

                    if (caughtCleanly && sim.lastLineTouchId) {
                      triggerSwap(
                        sim,
                        sim.lastLineTouchId,
                        'AGARROU!',
                        'Defesa Encaixada Sem Rebote!',
                        `${actor.name} segurou firme a finalização!`
                      );
                      break;
                    } else {
                      // Espalmou (Rebound!)
                      const nx = dx / dist;
                      const ny = dy / dist;
                      sim.ballX = actor.x + nx * (minD + 3);
                      sim.ballY = actor.y + ny * (minD + 3);
                      const reboundSpeed = Math.max(390, Math.min(640, shotSpeed * 0.72));
                      sim.ballVx = -Math.abs(nx) * reboundSpeed - 120;
                      sim.ballVy = ny * reboundSpeed + (Math.random() - 0.5) * 140;
                      sim.gkDeflectedSinceLastLineTouch = true;
                      sim.lastLineTouchId = null;
                      sim.ballStoppedTimer = 0;
                      actor.kickGlow = 0.8;
                      soundEngine.playKick(0.8, false);
                      showVisualAlert(
                        {
                          badge: 'REBOTE!',
                          title: 'Goleiro Espalmou!',
                          detail: 'Bola viva na área — próximo jogador tem 1 toque de primeira!',
                          kind: 'rebound',
                        },
                        1150
                      );
                      announce('Espalmou o goleiro! Olha o rebote de primeira!', false);
                    }
                  } else {
                    // Line player touched ball: STRICT 1-TOUCH!
                    if (sim.lastLineTouchId === actor.id && actor.touchGraceTimer <= 0) {
                      triggerSwap(
                        sim,
                        actor.id,
                        '2 TOQUES!',
                        'Infração: 2 Toques Seguidos!',
                        `${actor.name} encostou duas vezes seguidas na bola!`
                      );
                      break;
                    }
                    if (actor.touchGraceTimer <= 0) {
                      if (actor.isHuman) {
                        // Human 1-touch: if aiming/moving strongly toward goal or near box -> shoot, else pass
                        const wantShoot =
                          didPressKick ||
                          keysRef.current[' '] ||
                          (actor.x > 640 && hDx >= 0.25) ||
                          (hDx > 0.72 && Math.abs(actor.y - ARENA_H / 2) < 160);
                        executeOneTouchLineStrike(sim, actor, wantShoot, hDx, hDy);
                      } else {
                        const distGoal = Math.hypot(PITCH_RIGHT - actor.x, ARENA_H / 2 - actor.y);
                        const wantShoot =
                          distGoal < 470 && (sim.gkDeflectedSinceLastLineTouch || Math.random() < 0.62);
                        executeOneTouchLineStrike(sim, actor, wantShoot, 1, 0);
                      }
                    }
                  }
                }
              }
            }

            // Goalposts collisions (top & bottom post at right goal)
            if (sim.phase === 'playing') {
              const posts = [
                { x: PITCH_RIGHT, y: GOAL_TOP },
                { x: PITCH_RIGHT, y: GOAL_BOT },
              ];
              for (const post of posts) {
                const dx = sim.ballX - post.x;
                const dy = sim.ballY - post.y;
                const dist = Math.hypot(dx, dy);
                const minD = POST_R + BALL_R;
                if (dist > 0 && dist < minD) {
                  const nx = dx / dist;
                  const ny = dy / dist;
                  sim.ballX = post.x + nx * (minD + 1);
                  sim.ballY = post.y + ny * (minD + 1);
                  const dot = sim.ballVx * nx + sim.ballVy * ny;
                  sim.ballVx = (sim.ballVx - 2 * dot * nx) * 0.85;
                  sim.ballVy = (sim.ballVy - 2 * dot * ny) * 0.85;
                  // Hitting goalpost clears double-touch lock (rule explicitly allows rebound play!)
                  sim.lastLineTouchId = null;
                  soundEngine.playPostClang();
                  showVisualAlert(
                    {
                      badge: 'NA TRAVE!',
                      title: 'Bateu na Trave!',
                      detail: 'Rebote liberado — vale 1 toque de primeira!',
                      kind: 'rebound',
                    },
                    1200
                  );
                  announce('Na trave! Segue o lance no rebote!', true, 'tension');
                }
              }
            }

            // Check Goal Scored vs Out-of-Bounds
            if (sim.phase === 'playing') {
              const inGoalMouthY = sim.ballY > GOAL_TOP + BALL_R * 0.35 && sim.ballY < GOAL_BOT - BALL_R * 0.35;

              if (sim.ballX - BALL_R >= PITCH_RIGHT && inGoalMouthY) {
                // GOAL SCORED! Current GK loses 1 life!
                if (gk) {
                  gk.lives = Math.max(0, gk.lives - 1);
                  if (gk.lives <= 0) gk.eliminated = true;
                }
                soundEngine.playGoalCheer();
                for (let i = 0; i < 42; i++) {
                  const ang = Math.random() * Math.PI * 2;
                  const spd = 80 + Math.random() * 260;
                  sim.particles.push({
                    x: PITCH_RIGHT,
                    y: sim.ballY,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd,
                    life: 0.9 + Math.random() * 0.5,
                    maxLife: 1.4,
                    size: 4 + Math.random() * 4,
                    color: ['#FACC15', '#34D399', '#FFFFFF', '#F87171'][i % 4],
                  });
                }

                const alive = sim.actors.filter((a) => !a.eliminated);
                if (alive.length <= 1) {
                  sim.phase = 'finished';
                  sim.winnerId = alive[0]?.id || null;
                  setWinnerActor(alive[0] || null);
                  showVisualAlert(
                    {
                      badge: 'CAMPEÃO!',
                      title: `${alive[0]?.name || 'Vencedor'} Venceu o 1 Toque!`,
                      detail: 'Último sobrevivente com vidas restantes!',
                      kind: 'victory',
                    },
                    0
                  );
                  announce(
                    `Fim de jogo! ${alive[0]?.name || 'O campeão'} venceu o desafio 1 Toque!`,
                    true,
                    'goal'
                  );
                  syncHudFromSim(sim);
                } else {
                  if (gk?.eliminated) {
                    // Rotate another surviving player into Goal
                    const nextGk = alive[Math.floor(Math.random() * alive.length)];
                    if (nextGk) {
                      nextGk.isGoalkeeper = true;
                      nextGk.radius = GK_R;
                    }
                    showVisualAlert(
                      {
                        badge: 'ELIMINADO!',
                        title: `GOOOOL! ${gk.name} perdeu todas as vidas!`,
                        detail: `${nextGk?.name || 'Outro jogador'} assume o gol.`,
                        kind: 'goal',
                      },
                      1900
                    );
                    announce(
                      `Gooool! ${gk.name} zerou as vidas e está eliminado!`,
                      true,
                      'goal'
                    );
                  } else {
                    showVisualAlert(
                      {
                        badge: 'GOOOOL!',
                        title: `${gk?.name || 'Goleiro'} perdeu 1 vida!`,
                        detail: `Restam ${gk?.lives ?? 0} vida(s) no placar.`,
                        kind: 'goal',
                      },
                      1650
                    );
                    announce(
                      `Gooool! ${gk?.name || 'O goleiro'} perde uma vida! Restam ${gk?.lives ?? 0}!`,
                      true,
                      'goal'
                    );
                  }
                  sim.roundCount += 1;
                  sim.phase = 'goal_reset';
                  sim.phaseTimer = 1.25;
                  sim.ballVx *= 0.25;
                  sim.ballVy *= 0.25;
                  syncHudFromSim(sim);
                }
              } else {
                // Out-of-bounds check: sideline top/bot, left midfield line, or right goal-line outside posts
                const outLeft = sim.ballX - BALL_R < PITCH_X;
                const outTop = sim.ballY - BALL_R < PITCH_Y;
                const outBot = sim.ballY + BALL_R > PITCH_BOT;
                const outRightOutsideGoal = sim.ballX + BALL_R > PITCH_RIGHT && !inGoalMouthY;

                if (outLeft || outTop || outBot || outRightOutsideGoal) {
                  if (sim.gkDeflectedSinceLastLineTouch) {
                    showVisualAlert(
                      {
                        badge: 'DESVIO DO GOLEIRO',
                        title: 'Bola saiu após desvio!',
                        detail: 'Sem troca no gol — bola reiniciada na linha.',
                        kind: 'rebound',
                      },
                      1300
                    );
                    announce('Saiu com desvio do goleiro! Segue o mesmo goleiro.', false);
                    positionActorsForRound(sim, false);
                  } else {
                    triggerSwap(
                      sim,
                      sim.lastLineTouchId,
                      'BOLA FORA!',
                      'Chute ou Passe Para Fora!',
                      'Bola saiu da quadra sem desvio do goleiro — troca imediata!'
                    );
                  }
                }
              }
            }
          }
        }
      }

      // Render canvas
      renderOneTouchCanvas(canvas, sim, now);

      hudTick += 1;
      if (hudTick % 20 === 0) {
        syncHudFromSim(sim);
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [announce, difficulty, isPlaying, settings.gamepadEnabled, showVisualAlert, syncHudFromSim]);

  // Helper: stick controls
  const handleStickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    soundEngine.unlock();
    const touch = e.changedTouches[0];
    if (!touch) return;
    touchStickRef.current.active = true;
    touchStickRef.current.id = touch.identifier;
    updateStickPosition(touch, e.currentTarget);
  };

  const handleStickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchStickRef.current.id);
    if (!touch) return;
    updateStickPosition(touch, e.currentTarget);
  };

  const handleStickEnd = () => {
    touchStickRef.current = { active: false, dx: 0, dy: 0, id: null };
    setStickVisual({ x: 0, y: 0 });
  };

  const updateStickPosition = (touch: React.Touch, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setStickVisual({ x: dx, y: dy });
    touchStickRef.current.dx = dx / maxR;
    touchStickRef.current.dy = dy / maxR;
  };

  // ================= SETUP SCREEN =================
  if (!isPlaying) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#0D1812]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundEngine.playClick();
                onBack();
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-none">
                Modo 1 Toque · Gol a Gol
              </h1>
              <p className="text-[11px] text-emerald-300 mt-0.5">
                5 Vidas · Meia Quadra · Regra Estrita de 1 Toque (Sem Domínio)
              </p>
            </div>
          </div>

          <button
            onClick={() => onUpdateSettings({ mobileControls: !settings.mobileControls })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              settings.mobileControls
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-black/40 border-white/15 text-slate-300'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Touch Mobile: {settings.mobileControls ? 'ON' : 'OFF'}
          </button>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto">
          <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">1. Escolha seu Clube</h2>
              <span className="text-[11px] text-slate-400">70 clubes licenciados</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {LEAGUES.map((lg) => (
                <button
                  key={lg.id}
                  onClick={() => {
                    soundEngine.playClick();
                    setSetupLeague(lg.id);
                    const first = teams.find((t) => t.leagueId === lg.id);
                    if (first) setSelectedTeamId(first.id);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    setupLeague === lg.id
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/25'
                  }`}
                >
                  {lg.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredTeams.map((team) => {
                const active = selectedTeam.id === team.id;
                return (
                  <button
                    key={team.id}
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedTeamId(team.id);
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow'
                        : 'bg-black/30 border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <ClubCrest team={team} size={30} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{team.name}</div>
                      <div className="text-[10px] text-slate-400">{team.shortCode}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white mb-2">2. Jogadores de Linha (vs 1 Goleiro)</h2>
                <div className="grid grid-cols-4 gap-2">
                  {([2, 3, 4, 5] as const).map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => {
                        soundEngine.playClick();
                        setLineCount(cnt);
                      }}
                      className={`py-2.5 rounded-xl border font-display text-lg font-extrabold cursor-pointer ${
                        lineCount === cnt
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-black/30 text-slate-200 border-white/10'
                      }`}
                    >
                      {cnt} + 1
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {lineCount} na linha tentando marcar vs 1 goleiro defendendo suas 5 vidas.
                </p>
              </div>

              <div>
                <h2 className="text-sm font-bold text-white mb-2">3. Começar Como</h2>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setStartInGoal(false);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      !startInGoal
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-black/30 text-slate-300 border-white/10'
                    }`}
                  >
                    Na Linha (Ataque)
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setStartInGoal(true);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      startInGoal
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-black/30 text-slate-300 border-white/10'
                    }`}
                  >
                    No Gol (Goleiro)
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold text-white mb-2">4. Dificuldade</h2>
                <div className="grid grid-cols-3 gap-2">
                  {(['facil', 'medio', 'dificil'] as AIDifficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        soundEngine.playClick();
                        setDifficulty(d);
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold capitalize cursor-pointer ${
                        difficulty === d
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-black/30 text-slate-300 border-white/10'
                      }`}
                    >
                      {d === 'facil' ? 'Amador' : d === 'medio' ? 'Profissional' : 'Lendário'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-black/35 border border-amber-400/25 p-3 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-amber-300">Regras do Desafio 1 Toque:</div>
                <div>• Proibido dominar/conduzir: todo contato já sai passe ou chute de primeira!</div>
                <div>• Vai para o gol quem: der <strong>2 toques</strong>, chutar <strong>para fora</strong> sem desvio, tiver o chute <strong>agarrado</strong> sem rebote, fizer falta na área ou deixar a bola <strong>parar por +3s</strong>.</div>
                <div>• Rebote na trave ou espalmada do goleiro libera 1 toque para o próximo!</div>
              </div>

              <button
                onClick={startMatch}
                className="w-full py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-2xl font-extrabold flex items-center justify-center gap-2 shadow-xl cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" /> Iniciar Desafio 1 Toque
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ================= LIVE HALF-COURT GAMEPLAY =================
  const renderTouchDeck = (compact = false) => (
    <div className={`w-full flex items-center justify-between pointer-events-auto ${compact ? 'px-4 py-2' : 'px-3 pb-2'}`}>
      <div
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
        onTouchCancel={handleStickEnd}
        className={`relative rounded-full bg-white/10 border-2 border-white/25 flex items-center justify-center touch-none ${
          compact ? 'w-24 h-24' : 'w-24 h-24 sm:w-28 sm:h-28'
        }`}
      >
        <div
          className={`rounded-full bg-emerald-400/85 border-2 border-white shadow-lg ${
            compact ? 'w-10 h-10' : 'w-10 h-10 sm:w-12 sm:h-12'
          }`}
          style={{ transform: `translate(${stickVisual.x}px, ${stickVisual.y}px)` }}
        />
      </div>

      <button
        onTouchStart={(e) => {
          e.preventDefault();
          soundEngine.unlock();
          kickJustPressedRef.current = true;
        }}
        onClick={() => {
          soundEngine.unlock();
          kickJustPressedRef.current = true;
        }}
        className={`rounded-full active:scale-95 border-4 border-white/85 font-display font-extrabold text-slate-950 shadow-xl touch-none ${
          humanIsGkHud ? 'bg-sky-400/90' : 'bg-amber-500/90'
        } ${compact ? 'w-20 h-20 text-base' : 'w-20 h-20 sm:w-24 sm:h-24 text-lg sm:text-xl'}`}
      >
        {humanIsGkHud ? 'AGARRAR' : 'CHUTAR'}
      </button>
    </div>
  );

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-[#09150E] select-none overflow-hidden touch-none">
      {/* Top HUD: Player Avatars + 5 Lives + Action Buttons + Slim Commentary */}
      <div className="shrink-0 z-20 flex flex-col gap-1.5 px-2 sm:px-3 pt-1.5 pb-1.5 bg-[#07110B]/95 border-b border-white/10 safe-area-hud">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => {
              soundEngine.stopNarration();
              setIsPlaying(false);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Sair
          </button>

          {/* Players Lives Strip */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            {hudActors.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] transition-all ${
                  a.eliminated
                    ? 'bg-black/40 border-white/10 opacity-45 grayscale'
                    : a.isGoalkeeper
                      ? 'bg-amber-500/20 border-amber-400 shadow'
                      : a.isHuman
                        ? 'bg-emerald-500/20 border-emerald-400'
                        : 'bg-[#101C15] border-white/15'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-display text-[11px] font-extrabold shrink-0"
                  style={{
                    backgroundColor: a.isGoalkeeper ? '#F59E0B' : a.primaryColor,
                    borderColor: a.isGoalkeeper ? '#FEF3C7' : a.secondaryColor,
                    color: a.isGoalkeeper ? '#111827' : '#FFFFFF',
                  }}
                >
                  {a.isGoalkeeper ? 'GL' : a.number}
                </div>

                <div className="leading-tight min-w-0">
                  <div className="flex items-center gap-1 font-bold text-white truncate max-w-[74px]">
                    <span>{a.name}</span>
                    {a.isGoalkeeper && <Shield className="w-3 h-3 text-amber-300 shrink-0" />}
                    {a.eliminated && <Skull className="w-3 h-3 text-rose-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {Array.from({ length: MAX_LIVES }).map((_, idx) => (
                      <Heart
                        key={idx}
                        className={`w-2.5 h-2.5 ${
                          idx < a.lives
                            ? 'text-rose-500 fill-rose-500'
                            : 'text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                soundEngine.unlock();
                onUpdateSettings({ gamepadEnabled: !settings.gamepadEnabled });
              }}
              className={`p-1.5 rounded-lg border cursor-pointer ${
                settings.gamepadEnabled
                  ? 'bg-emerald-600/80 border-emerald-400 text-white'
                  : 'bg-[#0D1612] border-white/15 text-slate-300'
              }`}
              title="Gamepad"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                soundEngine.unlock();
                onUpdateSettings({ mobileControls: !settings.mobileControls });
              }}
              className={`p-1.5 rounded-lg border cursor-pointer ${
                settings.mobileControls
                  ? 'bg-emerald-600/80 border-emerald-400 text-white'
                  : 'bg-[#0D1612] border-white/15 text-slate-300'
              }`}
              title="Controles Touch"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                soundEngine.unlock();
                onUpdateSettings({ muted: !settings.muted });
              }}
              className="p-1.5 rounded-lg bg-[#0D1612] border border-white/15 text-slate-200 cursor-pointer"
              title="Áudio"
            >
              {settings.muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => {
                soundEngine.unlock();
                if (simRef.current && simRef.current.phase !== 'finished') {
                  simRef.current.paused = !simRef.current.paused;
                  setIsPaused(simRef.current.paused);
                }
              }}
              className="p-1.5 rounded-lg bg-[#0D1612] border border-white/15 text-slate-200 cursor-pointer"
              title="Pausar"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Slim Commentary Ticker & 3s Ball-Stop Timer */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#0C1912] border border-emerald-500/25 rounded-md px-2.5 py-0.5 text-[10px] sm:text-xs text-emerald-200 max-w-full">
            <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[82vw] sm:max-w-xl">{commentaryText}</span>
          </div>

          {ballStopWarning >= 1.0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-600/90 border border-rose-300 text-[11px] font-bold text-white animate-pulse">
              Bola parada: {(3.0 - ballStopWarning).toFixed(1)}s
            </div>
          )}
        </div>
      </div>

      {/* Unobstructed Pitch Stage */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full max-w-full max-h-full object-contain shadow-2xl"
          style={{ aspectRatio: `${ARENA_W} / ${ARENA_H}` }}
        />

        {/* Visual Infraction / Foul / Goal / Swap Alert */}
        {alertBanner && !winnerActor && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-20 max-w-[92vw]">
            <div
              className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 shadow-2xl ${
                alertBanner.kind === 'foul'
                  ? 'bg-rose-950/95 border-rose-400 text-white'
                  : alertBanner.kind === 'goal'
                    ? 'bg-emerald-950/95 border-amber-300 text-white'
                    : 'bg-sky-950/95 border-sky-300 text-white'
              }`}
            >
              {alertBanner.kind === 'foul' ? (
                <div className="flex items-center gap-1 bg-rose-600 rounded-xl px-2.5 py-1.5 shrink-0">
                  <AlertOctagon className="w-5 h-5 text-white" />
                  {/* Whistle SVG icon */}
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-amber-200" aria-hidden="true">
                    <path d="M2 10h11a5 5 0 1 1-4.58 7H6a4 4 0 0 1-4-4v-3zm11 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM9 6h3v2H9V6zm5-2h2v3h-2V4z" />
                  </svg>
                </div>
              ) : (
                <Trophy className="w-6 h-6 text-amber-300 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/40 text-amber-300">
                    {alertBanner.badge}
                  </span>
                  <span className="font-display text-lg sm:text-xl font-extrabold leading-none truncate">
                    {alertBanner.title}
                  </span>
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5 truncate">{alertBanner.detail}</div>
              </div>
            </div>
          </div>
        )}

        {/* Landscape/Desktop Touch Overlay or Shortcuts */}
        {!winnerActor && (
          <div className="absolute inset-x-0 bottom-1 pointer-events-none flex justify-center">
            {settings.mobileControls ? (
              <div className="hidden sm:block w-full">{renderTouchDeck(false)}</div>
            ) : (
              <div className="hidden sm:block bg-black/70 border border-white/10 rounded-lg px-3.5 py-0.5 text-[11px] text-slate-300">
                W, A, S, D Mover · Espaço {humanIsGkHud ? 'Agarrar' : 'Chutar de Primeira'} · Regra estrita de 1 toque · Esc Pausar
              </div>
            )}
          </div>
        )}

        {/* Pause Modal */}
        {isPaused && !winnerActor && (
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-30">
            <div className="w-full max-w-sm bg-[#111C16] border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
              <h2 className="font-display text-3xl font-extrabold text-white">Desafio Pausado</h2>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    if (simRef.current) simRef.current.paused = false;
                    setIsPaused(false);
                  }}
                  className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  Continuar
                </button>
                <button
                  onClick={startMatch}
                  className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Reiniciar Desafio
                </button>
                <button
                  onClick={() => {
                    soundEngine.stopNarration();
                    setIsPlaying(false);
                  }}
                  className="py-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 font-bold text-sm cursor-pointer"
                >
                  Voltar ao Menu 1 Toque
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory Modal */}
        {winnerActor && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
            <div className="w-full max-w-md bg-[#111C16] border-2 border-amber-400/60 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-400/20 border border-amber-300 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-amber-300" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-amber-300">
                  Último Sobrevivente · Modo 1 Toque
                </div>
                <h2 className="font-display text-4xl font-extrabold text-white mt-1">
                  {winnerActor.name} Venceu!
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Restou com {winnerActor.lives} vida(s) — Clube: {winnerActor.team.name}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={startMatch}
                  className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  Jogar Novamente
                </button>
                <button
                  onClick={() => {
                    soundEngine.stopNarration();
                    setIsPlaying(false);
                  }}
                  className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm cursor-pointer"
                >
                  Configurar Novo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Portrait Mobile Touch Deck */}
      {settings.mobileControls && !winnerActor && (
        <div className="sm:hidden shrink-0 bg-[#060E09]/95 border-t border-white/10 safe-area-hud">
          {renderTouchDeck(true)}
        </div>
      )}
    </div>
  );
};

function positionActorsForRound(sim: SimState, firstKickoff: boolean) {
  const line = sim.actors.filter((a) => !a.isGoalkeeper && !a.eliminated);
  const gk = sim.actors.find((a) => a.isGoalkeeper && !a.eliminated);

  if (gk) {
    gk.x = PITCH_RIGHT - 36;
    gk.y = ARENA_H / 2;
    gk.vx = 0;
    gk.vy = 0;
    gk.kickAngle = Math.PI;
  }

  line.forEach((a, idx) => {
    const slot = LINE_SLOTS[idx % LINE_SLOTS.length];
    a.x = slot.x;
    a.y = slot.y;
    a.vx = 0;
    a.vy = 0;
    a.kickAngle = 0;
    a.touchGraceTimer = 0;
  });

  // Start ball on feet / path of first surviving line player (or gentle serve)
  const receiver = line[0];
  if (receiver) {
    sim.ballX = firstKickoff ? receiver.x - 95 : receiver.x - 85;
    sim.ballY = receiver.y;
    sim.ballVx = 210;
    sim.ballVy = 0;
  } else {
    sim.ballX = 360;
    sim.ballY = ARENA_H / 2;
    sim.ballVx = 0;
    sim.ballVy = 0;
  }
  sim.lastLineTouchId = null;
  sim.gkDeflectedSinceLastLineTouch = false;
  sim.ballStoppedTimer = 0;
}

function renderOneTouchCanvas(canvas: HTMLCanvasElement, sim: SimState, nowMs: number) {
  if (canvas.width !== ARENA_W || canvas.height !== ARENA_H) {
    canvas.width = ARENA_W;
    canvas.height = ARENA_H;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, ARENA_W, ARENA_H);
  ctx.fillStyle = '#0A1910';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  ctx.save();
  // Quick camera zoom/pan during GK Swap
  if (sim.cameraZoom > 1.005) {
    ctx.translate(ARENA_W / 2, ARENA_H / 2);
    ctx.scale(sim.cameraZoom, sim.cameraZoom);
    ctx.translate(-sim.cameraFocusX, -sim.cameraFocusY);
  }

  // Alternating half-court grass stripes
  const stripeW = PITCH_W / 10;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#165E31' : '#1A6B38';
    ctx.fillRect(PITCH_X + i * stripeW, PITCH_Y, stripeW + 1, PITCH_H);
  }

  // Pitch lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.84)';
  ctx.lineWidth = 3;
  ctx.strokeRect(PITCH_X, PITCH_Y, PITCH_W, PITCH_H);

  // Midfield center arc on left boundary
  ctx.beginPath();
  ctx.arc(PITCH_X, ARENA_H / 2, 78, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Large Penalty Box on right
  const penW = 240;
  const penH = 340;
  const penY = ARENA_H / 2 - penH / 2;
  ctx.strokeRect(PITCH_RIGHT - penW, penY, penW, penH);

  // 6-yard GK Box
  const smallW = 88;
  const smallH = 220;
  const smallY = ARENA_H / 2 - smallH / 2;
  ctx.strokeRect(PITCH_RIGHT - smallW, smallY, smallW, smallH);

  // Penalty arc
  ctx.beginPath();
  ctx.arc(PITCH_RIGHT - 165, ARENA_H / 2, 72, Math.PI * 0.68, Math.PI * 1.32);
  ctx.stroke();

  // Penalty spot
  ctx.beginPath();
  ctx.arc(PITCH_RIGHT - 165, ARENA_H / 2, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // Right Goal Net
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(PITCH_RIGHT, GOAL_TOP, GOAL_W, GOAL_H);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let gx = PITCH_RIGHT; gx <= PITCH_RIGHT + GOAL_W; gx += 12) {
    ctx.beginPath();
    ctx.moveTo(gx, GOAL_TOP);
    ctx.lineTo(gx, GOAL_BOT);
    ctx.stroke();
  }
  for (let gy = GOAL_TOP; gy <= GOAL_BOT; gy += 14) {
    ctx.beginPath();
    ctx.moveTo(PITCH_RIGHT, gy);
    ctx.lineTo(PITCH_RIGHT + GOAL_W, gy);
    ctx.stroke();
  }
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(PITCH_RIGHT, GOAL_TOP);
  ctx.lineTo(PITCH_RIGHT + GOAL_W, GOAL_TOP);
  ctx.lineTo(PITCH_RIGHT + GOAL_W, GOAL_BOT);
  ctx.lineTo(PITCH_RIGHT, GOAL_BOT);
  ctx.stroke();
  ctx.restore();

  // Goalposts
  [GOAL_TOP, GOAL_BOT].forEach((py) => {
    ctx.beginPath();
    ctx.arc(PITCH_RIGHT, py, POST_R, 0, Math.PI * 2);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Swap trajectory line during quick GK swap
  if (sim.phase === 'swap' && sim.swapInfo) {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sim.swapInfo.fromX, sim.swapInfo.fromY);
    ctx.lineTo(sim.swapInfo.toX, sim.swapInfo.toY);
    ctx.stroke();
    ctx.restore();
  }

  // Draw actors
  for (const actor of sim.actors) {
    if (actor.eliminated) continue;
    drawPlayerDisc(ctx, actor.x, actor.y, actor.radius, actor.team.kit, actor.number, {
      isHuman: actor.isHuman,
      isGoalkeeper: actor.isGoalkeeper,
      kickGlow: actor.kickGlow,
      kickAngle: actor.kickAngle,
      playerName: actor.name,
      showName: true,
    });

    // Subtle "JÁ TOCOU (1/1)" warning halo if this player cannot touch twice!
    if (!actor.isGoalkeeper && sim.lastLineTouchId === actor.id && actor.touchGraceTimer <= 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(actor.x, actor.y, actor.radius + 9, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(248, 113, 113, ${0.55 + Math.sin(nowMs * 0.015) * 0.35})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3s Ball-Stopped warning ring around ball
  if (sim.ballStoppedTimer >= 1.0 && sim.phase === 'playing') {
    const pct = Math.min(1, sim.ballStoppedTimer / 3.0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(
      sim.ballX,
      sim.ballY,
      BALL_R + 10,
      -Math.PI / 2,
      -Math.PI / 2 + pct * Math.PI * 2
    );
    ctx.strokeStyle = pct > 0.72 ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  // Ball
  drawSoccerBall(ctx, sim.ballX, sim.ballY, BALL_R, sim.ballSpin);

  // Particles
  for (const p of sim.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
