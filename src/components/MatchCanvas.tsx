import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  LogOut,
  Smartphone,
  Trophy,
  Mic,
  Sparkles,
  Gamepad2,
} from 'lucide-react';
import { ActiveMatchConfig, MatchResult, Player, Team } from '../types/game';
import { drawPlayerDisc, drawSoccerBall } from '../utils/canvasDraw';
import { NarrationEmotion, soundEngine } from '../utils/audio';
import { pollGamepadInput } from '../utils/gamepad';
import { ClubCrest } from './ClubCrest';
import { PenaltyShootoutCanvas } from './PenaltyShootoutCanvas';

interface SimDisc {
  id: string;
  teamSide: 'home' | 'away';
  isHuman: boolean;
  isHuman2?: boolean;
  isGoalkeeper: boolean;
  player: Player;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kickGlow: number;
  kickAngle: number;
  kickCooldown: number;
  kickBuffer: number;
  desiredKickPowerScale: number;
  mass: number;
  stamina: number;
  role: 'attacker' | 'support' | 'gk';
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

interface ReplayFrame {
  discs: {
    x: number;
    y: number;
    radius: number;
    teamSide: 'home' | 'away';
    isHuman: boolean;
    isGoalkeeper: boolean;
    label: string;
    name: string;
    kickGlow: number;
    kickAngle: number;
  }[];
  ballX: number;
  ballY: number;
  ballSpin: number;
}

interface MatchCanvasProps {
  config: ActiveMatchConfig;
  isBackgroundDemo?: boolean;
  onExit?: () => void;
  onMatchComplete?: (result: MatchResult) => void;
  onToggleMute?: () => void;
  onToggleMobileControls?: () => void;
  onToggleGamepad?: () => void;
}

const ARENA_W = 1200;
const ARENA_H = 680;
const PITCH_X = 110;
const PITCH_Y = 90;
const PITCH_W = 980;
const PITCH_H = 500;
const GOAL_W = 46;
const GOAL_H = 166;
const GOAL_TOP = PITCH_Y + (PITCH_H - GOAL_H) / 2;
const GOAL_BOT = GOAL_TOP + GOAL_H;
const POST_R = 9;
const PLAYER_R = 19;
const GK_R = 18;
const BALL_R = 11.5;

export const MatchCanvas: React.FC<MatchCanvasProps> = ({
  config,
  isBackgroundDemo = false,
  onExit,
  onMatchComplete,
  onToggleMute,
  onToggleMobileControls,
  onToggleGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [elapsedSecDisplay, setElapsedSecDisplay] = useState(0);
  const [addedMinutes, setAddedMinutes] = useState(0);
  const [inAddedTime, setInAddedTime] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [goalBanner, setGoalBanner] = useState<{
    side: 'home' | 'away';
    scorer: string;
    teamName: string;
    color: string;
  } | null>(null);
  const [replayBanner, setReplayBanner] = useState<string | null>(null);
  const [commentaryText, setCommentaryText] = useState<string>(
    `Bola rolando para ${config.homeTeam.name} x ${config.awayTeam.name}!`
  );
  const [matchFinished, setMatchFinished] = useState<MatchResult | null>(null);
  const [showPenaltyShootout, setShowPenaltyShootout] = useState(
    config.settings.format === 'penalty_shootout'
  );
  const [lastShotSpeed, setLastShotSpeed] = useState<number>(0);

  // AI Match Report State
  const [aiReport, setAiReport] = useState<{
    headline?: string;
    summary?: string;
    coachQuote?: string;
    error?: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const touchStickRef = useRef<{ active: boolean; dx: number; dy: number; id: number | null }>({
    active: false,
    dx: 0,
    dy: 0,
    id: null,
  });
  const [stickVisual, setStickVisual] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchKickPendingRef = useRef(false);

  const touchStick2Ref = useRef<{ active: boolean; dx: number; dy: number; id: number | null }>({
    active: false,
    dx: 0,
    dy: 0,
    id: null,
  });
  const [stick2Visual, setStick2Visual] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchKick2PendingRef = useRef(false);

  const replayBufferRef = useRef<ReplayFrame[]>([]);
  const lastSpokenAtRef = useRef<number>(Date.now());
  const lastAiCallAtRef = useRef<number>(0);
  const matchSessionIdRef = useRef<number>(0);
  const recentCommentaryRef = useRef<string[]>([]);
  const lastIdleIdxRef = useRef<number>(-1);
  const lastKickCallIdxRef = useRef<number>(-1);
  const prevGamepadKickRef = useRef<boolean>(false);
  const prevGamepad2KickRef = useRef<boolean>(false);
  const prevGamepadPauseRef = useRef<boolean>(false);
  const onlineWsRef = useRef<WebSocket | null>(null);
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null);

  const simRef = useRef<{
    discs: SimDisc[];
    ball: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      spin: number;
      lastTouchedSide: 'home' | 'away';
      lastTouchedName: string;
    };
    particles: Particle[];
    homeGoals: number;
    awayGoals: number;
    elapsed: number;
    addedMinutesTotal: number;
    inAddedTime: boolean;
    addedSecondsLeft: number;
    paused: boolean;
    finished: boolean;
    goalPhase: 'none' | 'celebration' | 'replay';
    goalFreezeTimer: number;
    celebrationScorerId: string | null;
    replayFrames: ReplayFrame[];
    replayIndex: number;
    hitstopTimer: number;
    shakeTime: number;
    shakeIntensity: number;
    netRippleLeft: number;
    netRippleRight: number;
    scorers: { teamSide: 'home' | 'away'; playerName: string; timeSec: number }[];
    heldKeys: Set<string>;
    kickJustPressed: boolean;
    kick2JustPressed: boolean;
    resetJustPressed: boolean;
  } | null>(null);

  const announce = useCallback(
    (text: string, priority = false, emotion: NarrationEmotion = 'normal') => {
      if (isBackgroundDemo) return;
      lastSpokenAtRef.current = Date.now();
      setCommentaryText(text);
      recentCommentaryRef.current = [...recentCommentaryRef.current.slice(-4), text];
      soundEngine.speakNarration(text, { priority, emotion });
    },
    [isBackgroundDemo]
  );

  useEffect(() => {
    return () => {
      if (!isBackgroundDemo) {
        soundEngine.stopNarration();
      }
    };
  }, [isBackgroundDemo]);

  const requestAiNarration = useCallback(
    async (opts: {
      eventType: string;
      actorTeam?: string;
      actorPlayer?: string;
      fallbackLine: string;
      priority?: boolean;
      emotion?: NarrationEmotion;
    }) => {
      if (isBackgroundDemo) return;
      const sim = simRef.current;
      if (!sim) return;

      const sessionId = matchSessionIdRef.current;
      const now = Date.now();
      const emotion: NarrationEmotion = opts.emotion || 'normal';

      // Immediate local broadcast line for instant responsiveness on priority events
      if (opts.priority) {
        announce(opts.fallbackLine, true, emotion);
      }

      if (now - lastAiCallAtRef.current < 8500 && !opts.priority) {
        announce(opts.fallbackLine, false, emotion);
        return;
      }

      lastAiCallAtRef.current = now;
      lastSpokenAtRef.current = now;

      const regDuration = config.settings.durationSeconds || 120;
      const halfDur = Math.max(1, Math.floor(regDuration / 2));
      const clampedSec = Math.min(regDuration, Math.floor(sim.elapsed));
      const period = clampedSec >= halfDur ? '2T' : '1T';
      const secInHalf = clampedSec >= halfDur ? clampedSec - halfDur : clampedSec;
      const mm = String(Math.floor(secInHalf / 60)).padStart(2, '0');
      const ss = String(secInHalf % 60).padStart(2, '0');

      try {
        const res = await fetch('/api/ai/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeTeam: config.homeTeam.name,
            awayTeam: config.awayTeam.name,
            homePlayer: config.homeTeam.players[0]?.shortName,
            awayPlayer: config.awayTeam.players[0]?.shortName,
            homeGoals: sim.homeGoals,
            awayGoals: sim.awayGoals,
            halfPeriod: period,
            clockLabel: `${mm}:${ss}`,
            tournamentLabel: config.tournamentLabel,
            eventType: opts.eventType,
            actorTeam: opts.actorTeam,
            actorPlayer: opts.actorPlayer,
            recentLines: recentCommentaryRef.current,
          }),
        });
        if (!res.ok) throw new Error('AI narrate unavailable');
        const data = (await res.json()) as { line?: string };
        const aiLine = data.line?.trim();
        if (aiLine && matchSessionIdRef.current === sessionId && !simRef.current?.paused && !simRef.current?.finished) {
          announce(aiLine, Boolean(opts.priority), emotion);
          return;
        }
      } catch {
        // Fallback strictly grounded to current match state
      }

      if (!opts.priority && matchSessionIdRef.current === sessionId) {
        announce(opts.fallbackLine, false, emotion);
      }
    },
    [
      announce,
      config.awayTeam.name,
      config.awayTeam.players,
      config.homeTeam.name,
      config.homeTeam.players,
      config.settings.durationSeconds,
      config.tournamentLabel,
      isBackgroundDemo,
    ]
  );

  const buildDiscs = useCallback((): SimDisc[] => {
    const { format } = config.settings;
    const homePlayers = config.homeTeam.players;
    const awayPlayers = config.awayTeam.players;
    const discs: SimDisc[] = [];
    const humanSide = config.humanSide || 'home';

    const cx = PITCH_X + PITCH_W / 2;
    const cy = PITCH_Y + PITCH_H / 2;

    const getPlayerDef = (pl: Player) =>
      typeof pl.def === 'number'
        ? pl.def
        : pl.position === 'GOL'
          ? Math.min(99, pl.ovr + 4)
          : pl.position === 'ZAG'
            ? Math.min(99, pl.ovr + 2)
            : pl.position === 'MEI'
              ? Math.max(60, pl.ovr - 10)
              : Math.max(55, pl.ovr - 20);

    const homePl = homePlayers[0];
    const isLocal2P = format === 'local_2p';
    const isOnline2P = format === 'online_2p';
    const homeIsHuman = !isBackgroundDemo && (isLocal2P || humanSide === 'home');
    const homeDef = getPlayerDef(homePl);
    const homeTacticMassMult = homeIsHuman && config.tacticStyle === 'retranqueiro' ? 1.08 : 1;
    discs.push({
      id: 'home-0',
      teamSide: 'home',
      isHuman: homeIsHuman,
      isHuman2: false,
      isGoalkeeper: false,
      player: homePl,
      x: cx - 165,
      y: cy,
      vx: 0,
      vy: 0,
      radius: PLAYER_R,
      kickGlow: 0,
      kickAngle: 0,
      kickCooldown: 0,
      kickBuffer: 0,
      desiredKickPowerScale: 1,
      mass: (0.88 + (homeDef / 100) * 0.36) * homeTacticMassMult,
      stamina: typeof homePl.stamina === 'number' ? homePl.stamina : 100,
      role: 'attacker',
    });

    if (format !== 'training_solo') {
      const awayPl = awayPlayers[0];
      const awayIsHuman = !isBackgroundDemo && !isLocal2P && (isOnline2P ? humanSide === 'away' : humanSide === 'away');
      const awayDef = getPlayerDef(awayPl);
      const awayTacticMassMult = awayIsHuman && config.tacticStyle === 'retranqueiro' ? 1.08 : 1;
      discs.push({
        id: 'away-0',
        teamSide: 'away',
        isHuman: awayIsHuman,
        isHuman2: !isBackgroundDemo && isLocal2P,
        isGoalkeeper: false,
        player: awayPl,
        x: cx + 165,
        y: cy,
        vx: 0,
        vy: 0,
        radius: PLAYER_R,
        kickGlow: 0,
        kickAngle: Math.PI,
        kickCooldown: 0,
        kickBuffer: 0,
        desiredKickPowerScale: 1,
        mass: (0.88 + (awayDef / 100) * 0.36) * awayTacticMassMult,
        stamina: typeof awayPl.stamina === 'number' ? awayPl.stamina : 100,
        role: 'attacker',
      });
    }

    return discs;
  }, [config, isBackgroundDemo]);

  const resetPositions = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    const humanTeam = config.humanSide === 'away' ? config.awayTeam : config.homeTeam;
    sim.discs = buildDiscs();
    sim.ball = {
      x: PITCH_X + PITCH_W / 2,
      y: PITCH_Y + PITCH_H / 2,
      vx: 0,
      vy: 0,
      spin: 0,
      lastTouchedSide: config.humanSide || 'home',
      lastTouchedName: humanTeam.players[0]?.shortName || 'Jogador',
    };
    replayBufferRef.current = [];
  }, [buildDiscs, config.awayTeam, config.homeTeam, config.humanSide]);

  const initMatch = useCallback(() => {
    if (config.settings.format === 'penalty_shootout') {
      setShowPenaltyShootout(true);
      return;
    }
    setShowPenaltyShootout(false);
    const humanTeam = config.humanSide === 'away' ? config.awayTeam : config.homeTeam;
    simRef.current = {
      discs: buildDiscs(),
      ball: {
        x: PITCH_X + PITCH_W / 2,
        y: PITCH_Y + PITCH_H / 2,
        vx: 0,
        vy: 0,
        spin: 0,
        lastTouchedSide: config.humanSide || 'home',
        lastTouchedName: humanTeam.players[0]?.shortName || 'Jogador',
      },
      particles: [],
      homeGoals: 0,
      awayGoals: 0,
      elapsed: 0,
      addedMinutesTotal: 3,
      inAddedTime: false,
      addedSecondsLeft: 0,
      paused: false,
      finished: false,
      goalPhase: 'none',
      goalFreezeTimer: 0,
      celebrationScorerId: null,
      replayFrames: [],
      replayIndex: 0,
      hitstopTimer: 0,
      shakeTime: 0,
      shakeIntensity: 0,
      netRippleLeft: 0,
      netRippleRight: 0,
      scorers: [],
      heldKeys: new Set<string>(),
      kickJustPressed: false,
      kick2JustPressed: false,
      resetJustPressed: false,
    };
    replayBufferRef.current = [];
    recentCommentaryRef.current = [];
    matchSessionIdRef.current += 1;
    lastAiCallAtRef.current = 0;
    setHomeScore(0);
    setAwayScore(0);
    setElapsedSecDisplay(0);
    setAddedMinutes(0);
    setInAddedTime(false);
    setIsPaused(false);
    setGoalBanner(null);
    setReplayBanner(null);
    setMatchFinished(null);
    setAiReport(null);
    setLastShotSpeed(0);
    if (!isBackgroundDemo) {
      soundEngine.playWhistle(false);
      const kickoffs = [
        `Apita o árbitro! Coração acelerado, bola rolando para ${config.homeTeam.name} e ${config.awayTeam.name}!`,
        `Começa o espetáculo! A bola já rola entre ${config.homeTeam.name} e ${config.awayTeam.name}!`,
        `Autoriza o juiz! Vamos juntos nessa emoção de ${config.homeTeam.name} contra ${config.awayTeam.name}!`,
      ];
      announce(kickoffs[Math.floor(Math.random() * kickoffs.length)], true, 'dramatic');
    }
  }, [announce, buildDiscs, config.awayTeam, config.homeTeam, config.humanSide, config.settings.format, isBackgroundDemo]);

  useEffect(() => {
    initMatch();
  }, [initMatch]);

  useEffect(() => {
    if (isBackgroundDemo || showPenaltyShootout) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(
          code
        )
      ) {
        e.preventDefault();
      }
      const sim = simRef.current;
      if (!sim) return;

      if (code === 'Escape') {
        if (!sim.finished && config.settings.format !== 'online_2p') {
          sim.paused = !sim.paused;
          setIsPaused(sim.paused);
          soundEngine.playClick();
        }
        return;
      }

      if (code === 'KeyR' && (config.settings.format === 'training_solo' || config.settings.format === 'training_1v1')) {
        sim.resetJustPressed = true;
      }

      if (code === 'Space' && !e.repeat) {
        if (sim.goalPhase === 'replay') {
          // Allow skipping replay immediately
          sim.goalPhase = 'none';
          sim.goalFreezeTimer = 0;
          setReplayBanner(null);
          setGoalBanner(null);
          resetPositions();
          soundEngine.playWhistle(false);
          return;
        }
        sim.kickJustPressed = true;
      }

      if (
        config.settings.format === 'local_2p' &&
        (code === 'Enter' || code === 'KeyL' || code === 'Numpad0') &&
        !e.repeat
      ) {
        sim.kick2JustPressed = true;
      }

      sim.heldKeys.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.heldKeys.delete(e.code);
    };

    const handleBlur = () => {
      simRef.current?.heldKeys.clear();
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [config.settings.format, isBackgroundDemo, resetPositions, showPenaltyShootout]);

  useEffect(() => {
    if (showPenaltyShootout) return;
    let rafId = 0;
    let lastTime = performance.now();
    let hudTimerTick = 0;

    const spawnParticles = (x: number, y: number, count: number, color: string, speedScale = 1) => {
      const sim = simRef.current;
      if (!sim) return;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (45 + Math.random() * 170) * speedScale;
        sim.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.45 + Math.random() * 0.45,
          maxLife: 0.9,
          size: 2.5 + Math.random() * 4,
          color,
        });
      }
    };

    const spawnCelebrationConfetti = (x: number, y: number, teamColor: string) => {
      const palette = [teamColor, '#FACC15', '#FFFFFF', '#34D399'];
      for (let i = 0; i < 48; i++) {
        const col = palette[i % palette.length];
        spawnParticles(x, y, 1, col, 1.45);
      }
    };

    const finishRegulation = (sim: NonNullable<typeof simRef.current>) => {
      sim.finished = true;
      if (!isBackgroundDemo) soundEngine.playWhistle(true);

      const isKnockoutFinal =
        config.tournament === 'libertadores_final' ||
        config.tournament === 'sulamericana_final' ||
        config.tournament === 'tournament_cup' ||
        config.tournament === 'career_continental_cup' ||
        config.tournament === 'career_continental_final' ||
        config.tournament === 'world_cup_knockout';

      if (isKnockoutFinal && sim.homeGoals === sim.awayGoals && !isBackgroundDemo) {
        announce(
          `Fim do tempo normal em ${sim.homeGoals} a ${sim.awayGoals}! Haja coração, vamos para os pênaltis!`,
          true,
          'dramatic'
        );
        setShowPenaltyShootout(true);
        return;
      }

      const humanDisc = sim.discs.find((d) => d.isHuman);
      const winnerSide: 'home' | 'away' | 'draw' =
        sim.homeGoals > sim.awayGoals ? 'home' : sim.awayGoals > sim.homeGoals ? 'away' : 'draw';
      const result: MatchResult = {
        homeGoals: sim.homeGoals,
        awayGoals: sim.awayGoals,
        scorers: sim.scorers,
        winnerSide,
        tournament: config.tournament,
        careerFixtureId: config.careerFixtureId,
        worldCupMatchId: config.worldCupMatchId,
        starterStaminaRemaining: humanDisc ? Math.round(humanDisc.stamina) : undefined,
      };
      if (!isBackgroundDemo) {
        const winnerName = winnerSide === 'home' ? config.homeTeam.name : config.awayTeam.name;
        const diffGoals = Math.abs(sim.homeGoals - sim.awayGoals);
        const endLine =
          winnerSide === 'draw'
            ? `Apita o árbitro pela última vez! Tudo igual entre ${config.homeTeam.name} e ${config.awayTeam.name}, ${sim.homeGoals} a ${sim.awayGoals}!`
            : diffGoals === 1
              ? `Fim de jogo dramático! Vitória suada do ${winnerName}, por ${sim.homeGoals} a ${sim.awayGoals}!`
              : `Fim de papo em campo! Grande vitória do ${winnerName}, fechando em ${sim.homeGoals} a ${sim.awayGoals}!`;
        announce(endLine, true, 'dramatic');
      }
      setMatchFinished(result);
    };

    const stepPhysics = (dt: number) => {
      const sim = simRef.current;
      if (!sim || sim.paused || sim.finished) return;
      if (config.settings.format === 'online_2p') return;

      if (sim.hitstopTimer > 0) {
        sim.hitstopTimer -= dt;
        return;
      }

      if (sim.shakeTime > 0) sim.shakeTime = Math.max(0, sim.shakeTime - dt);
      if (sim.netRippleLeft > 0) sim.netRippleLeft = Math.max(0, sim.netRippleLeft - dt * 2.4);
      if (sim.netRippleRight > 0) sim.netRippleRight = Math.max(0, sim.netRippleRight - dt * 2.4);

      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const pt = sim.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
        pt.life -= dt;
        if (pt.life <= 0) sim.particles.splice(i, 1);
      }

      if (sim.resetJustPressed) {
        sim.resetJustPressed = false;
        resetPositions();
        if (!isBackgroundDemo) soundEngine.playWhistle(false);
        return;
      }

      // Goal Celebration + Instant Slow-Motion Replay State Machine
      if (sim.goalPhase === 'celebration') {
        sim.goalFreezeTimer -= dt;
        sim.ball.x += sim.ball.vx * dt;
        sim.ball.y += sim.ball.vy * dt;
        sim.ball.vx *= 0.9;
        sim.ball.vy *= 0.9;

        // Animate celebration run of scorer toward center
        if (sim.celebrationScorerId) {
          const scorerDisc = sim.discs.find((d) => d.id === sim.celebrationScorerId);
          if (scorerDisc) {
            const cx = PITCH_X + PITCH_W / 2;
            const cy = PITCH_Y + PITCH_H / 2;
            const dx = cx - scorerDisc.x;
            const dy = cy - scorerDisc.y;
            const dist = Math.hypot(dx, dy) || 1;
            scorerDisc.x += (dx / dist) * 140 * dt;
            scorerDisc.y += (dy / dist) * 140 * dt;
            scorerDisc.kickGlow = 1;
            scorerDisc.kickAngle += 8 * dt;
          }
        }

        if (sim.goalFreezeTimer <= 0) {
          setGoalBanner(null);
          if (!isBackgroundDemo && sim.replayFrames.length > 20) {
            sim.goalPhase = 'replay';
            sim.replayIndex = 0;
            setReplayBanner(
              `REPLAY DO GOL · ${sim.scorers[sim.scorers.length - 1]?.playerName || 'Golaço'}`
            );
          } else {
            sim.goalPhase = 'none';
            resetPositions();
            if (!isBackgroundDemo) soundEngine.playWhistle(false);
          }
        }
        return;
      }

      if (sim.goalPhase === 'replay') {
        sim.replayIndex += 0.55; // Smooth 0.55x Slow-Motion Replay!
        if (sim.replayIndex >= sim.replayFrames.length) {
          sim.goalPhase = 'none';
          setReplayBanner(null);
          if (
            config.settings.goalLimit > 0 &&
            (sim.homeGoals >= config.settings.goalLimit || sim.awayGoals >= config.settings.goalLimit)
          ) {
            finishRegulation(sim);
            return;
          }
          resetPositions();
          soundEngine.playWhistle(false);
        }
        return;
      }

      const isTrainingSolo = config.settings.format === 'training_solo';

      // Match Clock (2 minutes default, 1T / 2T + Added Time)
      if (!isBackgroundDemo && !isTrainingSolo) {
        sim.elapsed += dt;
        const regDuration = config.settings.durationSeconds;

        if (!sim.inAddedTime) {
          hudTimerTick += dt;
          if (hudTimerTick >= 0.2) {
            hudTimerTick = 0;
            setElapsedSecDisplay(Math.min(regDuration, Math.floor(sim.elapsed)));
          }

          if (sim.elapsed >= regDuration) {
            const extraMins = Math.min(5, 2 + Math.floor((sim.homeGoals + sim.awayGoals) * 0.6));
            sim.inAddedTime = true;
            sim.addedMinutesTotal = extraMins;
            sim.addedSecondsLeft = Math.max(8, extraMins * 3.5);
            setElapsedSecDisplay(regDuration);
            setAddedMinutes(extraMins);
            setInAddedTime(true);
            const addedCalls = [
              `Sobe a placa! Mais ${extraMins} minutos de acréscimo, e o coração vai a mil nessa reta final!`,
              `Atenção! O quarto árbitro mostra mais ${extraMins} minutos de acréscimo até o apito final!`,
            ];
            announce(addedCalls[Math.floor(Math.random() * addedCalls.length)], true, 'dramatic');
          }
        } else {
          sim.addedSecondsLeft = Math.max(0, sim.addedSecondsLeft - dt);
          const totalExtraTime = Math.max(8, sim.addedMinutesTotal * 3.5);
          const extraElapsed = Math.floor(totalExtraTime - sim.addedSecondsLeft);
          hudTimerTick += dt;
          if (hudTimerTick >= 0.2) {
            hudTimerTick = 0;
            setElapsedSecDisplay(regDuration + extraElapsed);
          }
          if (sim.addedSecondsLeft <= 0) {
            finishRegulation(sim);
            return;
          }
        }

        // Varied, humanized live Brazilian commentary strictly grounded in current match facts
        if (Date.now() - lastSpokenAtRef.current >= 9500) {
          const homeName = config.homeTeam.name;
          const awayName = config.awayTeam.name;
          const homePlayer = config.homeTeam.players[0]?.shortName || homeName;
          const awayPlayer = config.awayTeam.players[0]?.shortName || awayName;
          const inHomeAttack = sim.ball.x > PITCH_X + PITCH_W * 0.65;
          const inAwayAttack = sim.ball.x < PITCH_X + PITCH_W * 0.35;
          const closeLate = sim.elapsed > regDuration * 0.7 && Math.abs(sim.homeGoals - sim.awayGoals) <= 1;

          const contextualPool: string[] = [
            `Olha como ${homePlayer} e ${awayPlayer} dividem cada centímetro do gramado, ninguém tira o pé!`,
            `Que duelo equilibrado entre ${homeName} e ${awayName}! O placar marca ${sim.homeGoals} a ${sim.awayGoals} até aqui.`,
            `Respira o torcedor! ${homeName} e ${awayName} mantêm a intensidade lá no alto!`,
            inHomeAttack
              ? `Olha o perigo! ${homePlayer} ronda a área com a bola dominada e ameaça o gol do ${awayName}!`
              : inAwayAttack
                ? `Atenção na defesa! ${awayPlayer} chega com perigo pelo ${awayName} e preocupa o ${homeName}!`
                : `Bola trabalhada no meio-campo entre ${homePlayer} e ${awayPlayer}, todo mundo ligado no lance!`,
            closeLate
              ? `Reta final emocionante! Com ${sim.homeGoals} a ${sim.awayGoals} no placar, qualquer descuido pode decidir tudo!`
              : sim.homeGoals === sim.awayGoals
                ? `Tudo igual no placar, ${sim.homeGoals} a ${sim.awayGoals}! Quem será que encontra o caminho das redes agora?`
                : sim.homeGoals > sim.awayGoals
                  ? `${homeName} vai segurando a vantagem de ${sim.homeGoals} a ${sim.awayGoals}, mas o ${awayName} não desiste!`
                  : `${awayName} está na frente por ${sim.awayGoals} a ${sim.homeGoals}, enquanto o ${homeName} busca a reação!`,
          ];

          let nextIdx = Math.floor(Math.random() * contextualPool.length);
          if (nextIdx === lastIdleIdxRef.current) {
            nextIdx = (nextIdx + 1) % contextualPool.length;
          }
          lastIdleIdxRef.current = nextIdx;

          const eventDesc = inHomeAttack
            ? `${homeName} pressiona perto da área adversária com ${homePlayer}`
            : inAwayAttack
              ? `${awayName} pressiona perto da área do ${homeName} com ${awayPlayer}`
              : closeLate
                ? 'reta final tensa e disputada no meio-campo'
                : 'disputa intensa de posse de bola no meio-campo';

          void requestAiNarration({
            eventType: eventDesc,
            fallbackLine: contextualPool[nextIdx],
            priority: false,
            emotion: inHomeAttack || inAwayAttack || closeLate ? 'tension' : 'normal',
          });
        }
      }

      const gpState = config.settings.gamepadEnabled ? pollGamepadInput() : null;
      if (gpState?.connected) {
        if (gpState.pauseDown && !prevGamepadPauseRef.current && !isBackgroundDemo && !sim.finished) {
          sim.paused = !sim.paused;
          setIsPaused(sim.paused);
          soundEngine.playClick();
        }
        prevGamepadPauseRef.current = gpState.pauseDown;
      }

      const diff = config.settings.difficulty;
      const diffProfile =
        diff === 'facil'
          ? { speedMult: 0.62, accelMult: 0.58, kickInterval: 0.72, gkSpeed: 0.65, aimNoise: 28 }
          : diff === 'medio'
            ? { speedMult: 0.90, accelMult: 0.90, kickInterval: 0.34, gkSpeed: 0.92, aimNoise: 10 }
            : { speedMult: 1.14, accelMult: 1.22, kickInterval: 0.16, gkSpeed: 1.18, aimNoise: 0 };

      const isSegmentClear = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        ox: number,
        oy: number,
        clearance: number
      ) => {
        const vx = x2 - x1;
        const vy = y2 - y1;
        const lenSq = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((ox - x1) * vx + (oy - y1) * vy) / lenSq));
        const px = x1 + vx * t;
        const py = y1 + vy * t;
        return Math.hypot(ox - px, oy - py) > clearance;
      };

      const ball = sim.ball;
      const goalLeftX = PITCH_X;
      const goalRightX = PITCH_X + PITCH_W;
      const goalMidY = PITCH_Y + PITCH_H / 2;

      for (const disc of sim.discs) {
        if (disc.kickCooldown > 0) disc.kickCooldown = Math.max(0, disc.kickCooldown - dt);
        if (disc.kickGlow > 0) disc.kickGlow = Math.max(0, disc.kickGlow - dt * 4.5);
        if (disc.kickBuffer > 0) disc.kickBuffer = Math.max(0, disc.kickBuffer - dt);

        const fisStat =
          typeof disc.player.fis === 'number'
            ? disc.player.fis
            : Math.min(97, Math.round(disc.player.ovr * 0.86 + 5));
        const currentSpd = Math.hypot(disc.vx, disc.vy);
        const tacticDrain = disc.isHuman && config.tacticStyle === 'ofensivo' ? 1.15 : 1;
        const drainResistance = 1.25 - (fisStat - 60) * 0.012; // Higher FIS drains slower

        const staminaFactor = disc.stamina >= 45 ? 1 : 0.88 + ((disc.stamina - 15) / 30) * 0.12;
        const paceFactor = (0.90 + ((disc.player.pace - 70) / 30) * 0.24) * staminaFactor;
        const maxAccel = (disc.isHuman || disc.isHuman2 ? 1320 : 1140 * diffProfile.accelMult) * paceFactor;

        let ax = 0;
        let ay = 0;

        if (disc.isHuman) {
          disc.desiredKickPowerScale = 1;
          const k = sim.heldKeys;
          const isLocal2P = config.settings.format === 'local_2p';
          if (k.has('KeyW') || (!isLocal2P && k.has('ArrowUp'))) ay -= 1;
          if (k.has('KeyS') || (!isLocal2P && k.has('ArrowDown'))) ay += 1;
          if (k.has('KeyA') || (!isLocal2P && k.has('ArrowLeft'))) ax -= 1;
          if (k.has('KeyD') || (!isLocal2P && k.has('ArrowRight'))) ax += 1;

          if (touchStickRef.current.active) {
            ax += touchStickRef.current.dx;
            ay += touchStickRef.current.dy;
          }

          if (gpState?.connected) {
            ax += gpState.moveX;
            ay += gpState.moveY;
            if (gpState.kickDown && !prevGamepadKickRef.current) {
              sim.kickJustPressed = true;
            }
            prevGamepadKickRef.current = gpState.kickDown;
          }

          const mag = Math.hypot(ax, ay);
          if (mag > 1) {
            ax /= mag;
            ay /= mag;
          }

          const holdingKick = k.has('Space') || Boolean(gpState?.connected && gpState.kickDown);
          if (sim.kickJustPressed || touchKickPendingRef.current) {
            disc.kickBuffer = 0.18;
            disc.kickGlow = 1;
            sim.kickJustPressed = false;
            touchKickPendingRef.current = false;
          } else if (holdingKick && disc.kickCooldown <= 0) {
            disc.kickBuffer = Math.max(disc.kickBuffer, 0.06);
            disc.kickGlow = Math.max(disc.kickGlow, 0.8);
          }
        } else if (disc.isHuman2) {
          disc.desiredKickPowerScale = 1;
          const k = sim.heldKeys;
          if (k.has('ArrowUp')) ay -= 1;
          if (k.has('ArrowDown')) ay += 1;
          if (k.has('ArrowLeft')) ax -= 1;
          if (k.has('ArrowRight')) ax += 1;

          if (touchStick2Ref.current.active) {
            ax += touchStick2Ref.current.dx;
            ay += touchStick2Ref.current.dy;
          }

          const gp2State = config.settings.gamepadEnabled ? pollGamepadInput(1) : null;
          if (gp2State?.connected) {
            ax += gp2State.moveX;
            ay += gp2State.moveY;
            if (gp2State.kickDown && !prevGamepad2KickRef.current) {
              sim.kick2JustPressed = true;
            }
            prevGamepad2KickRef.current = gp2State.kickDown;
          }

          const mag = Math.hypot(ax, ay);
          if (mag > 1) {
            ax /= mag;
            ay /= mag;
          }

          const holdingKick2 =
            k.has('Enter') ||
            k.has('KeyL') ||
            k.has('Numpad0') ||
            Boolean(gp2State?.connected && gp2State.kickDown);
          if (sim.kick2JustPressed || touchKick2PendingRef.current) {
            disc.kickBuffer = 0.18;
            disc.kickGlow = 1;
            sim.kick2JustPressed = false;
            touchKick2PendingRef.current = false;
          } else if (holdingKick2 && disc.kickCooldown <= 0) {
            disc.kickBuffer = Math.max(disc.kickBuffer, 0.06);
            disc.kickGlow = Math.max(disc.kickGlow, 0.8);
          }
        } else if (disc.isGoalkeeper) {
          disc.desiredKickPowerScale = 1;
          const isLeftGk = disc.teamSide === 'home';
          const gkHomeX = isLeftGk ? PITCH_X + 26 : PITCH_X + PITCH_W - 26;
          const boxThreat = isLeftGk ? ball.x < PITCH_X + 150 : ball.x > PITCH_X + PITCH_W - 150;

          let targetY = ball.y;
          const movingTowardGoal = isLeftGk ? ball.vx < -40 : ball.vx > 40;
          if (movingTowardGoal) {
            const timeToLine = Math.min(0.45, Math.abs(gkHomeX - ball.x) / Math.max(80, Math.abs(ball.vx)));
            targetY = ball.y + ball.vy * timeToLine;
          }
          targetY = Math.max(GOAL_TOP + 16, Math.min(GOAL_BOT - 16, targetY));

          let targetX = gkHomeX;
          if (boxThreat && Math.abs(ball.y - goalMidY) < 110) {
            targetX = isLeftGk
              ? Math.min(PITCH_X + 75, Math.max(PITCH_X + 18, ball.x - 10))
              : Math.max(PITCH_X + PITCH_W - 75, Math.min(PITCH_X + PITCH_W - 18, ball.x + 10));
          }

          const dx = targetX - disc.x;
          const dy = targetY - disc.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 3) {
            ax = (dx / dist) * diffProfile.gkSpeed;
            ay = (dy / dist) * diffProfile.gkSpeed;
          }

          const distToBall = Math.hypot(ball.x - disc.x, ball.y - disc.y);
          const isBallInFront = isLeftGk ? ball.x > disc.x - 4 : ball.x < disc.x + 4;
          if (distToBall < disc.radius + BALL_R + 12 && disc.kickCooldown <= 0 && isBallInFront) {
            disc.kickBuffer = 0.08;
            disc.kickGlow = 0.9;
            if (!isBackgroundDemo && Math.hypot(ball.vx, ball.vy) > 360) {
              announce('Defendeu o goleiro! Que defesa espetacular!');
            }
          }
        } else {
          const ownGoalX = disc.teamSide === 'home' ? goalLeftX : goalRightX;
          const targetGoalX = disc.teamSide === 'home' ? goalRightX : goalLeftX;
          const attackDir = disc.teamSide === 'home' ? 1 : -1;
          const opponent = sim.discs.find((d) => d.teamSide !== disc.teamSide && !d.isGoalkeeper);

          // Predict short-term ball position for Profissional / Lendário interception
          const predTime = diff === 'dificil' ? 0.16 : diff === 'medio' ? 0.08 : 0;
          const predBallX = Math.max(
            PITCH_X + BALL_R,
            Math.min(PITCH_X + PITCH_W - BALL_R, ball.x + ball.vx * predTime)
          );
          const predBallY = Math.max(
            PITCH_Y + BALL_R,
            Math.min(PITCH_Y + PITCH_H - BALL_R, ball.y + ball.vy * predTime)
          );

          const isBehindBall =
            disc.teamSide === 'home' ? disc.x < ball.x + 8 : disc.x > ball.x - 8;

          let aimTargetX = targetGoalX;
          let aimTargetY =
            goalMidY +
            (diffProfile.aimNoise > 0
              ? Math.sin(sim.elapsed * 2.1 + disc.x * 0.02) * diffProfile.aimNoise
              : 0);
          let isBankShot = false;
          let blockGoalMode = false;

          // Default kick power scale by difficulty
          disc.desiredKickPowerScale = diff === 'facil' ? 1.0 : diff === 'medio' ? 0.88 : 0.72;

          // PROFISSIONAL: pick open goal corner away from opponent
          if (diff === 'medio' && opponent) {
            const openY = opponent.y < goalMidY ? goalMidY + 38 : goalMidY - 38;
            aimTargetY = openY + Math.sin(sim.elapsed * 2.1) * diffProfile.aimNoise;
          }

          // LENDÁRIO: Real tactical AI (Shot-Angle Goal Blocking, Wall-Bounce Tables, Calibrated Power)
          if (diff === 'dificil') {
            const distSelfToBall = Math.hypot(predBallX - disc.x, predBallY - disc.y);
            const distOppToBall = opponent
              ? Math.hypot(predBallX - opponent.x, predBallY - opponent.y)
              : 999;
            const oppAttackingSide = opponent
              ? disc.teamSide === 'home'
                ? opponent.x > predBallX - 18
                : opponent.x < predBallX + 18
              : false;
            const ballHeadingToOwnGoal =
              disc.teamSide === 'home' ? ball.vx < -140 : ball.vx > 140;
            const ballThreatZone =
              Math.abs(predBallX - ownGoalX) < PITCH_W * 0.66;

            // 1. Block shooting angle by positioning disc directly in front of own goal
            if (
              (ballHeadingToOwnGoal && !isBehindBall) ||
              (oppAttackingSide &&
                distOppToBall + 24 < distSelfToBall &&
                ballThreatZone)
            ) {
              blockGoalMode = true;
            }

            // 2. Calculate direct open corners vs wall-bounce ("tabela") around defender
            if (!blockGoalMode) {
              const corners = [goalMidY - 46, goalMidY + 46, goalMidY];
              const oppClearance = opponent ? opponent.radius + BALL_R + 14 : 0;

              let bestDirectY: number | null = null;
              let bestDirectScore = -1;
              if (opponent) {
                for (const cy of corners) {
                  const clear = isSegmentClear(
                    ball.x,
                    ball.y,
                    targetGoalX,
                    cy,
                    opponent.x,
                    opponent.y,
                    oppClearance
                  );
                  if (clear) {
                    const edgeDist = Math.abs(cy - opponent.y);
                    if (edgeDist > bestDirectScore) {
                      bestDirectScore = edgeDist;
                      bestDirectY = cy;
                    }
                  }
                }
              } else {
                bestDirectY = goalMidY;
              }

              if (bestDirectY !== null) {
                aimTargetX = targetGoalX;
                aimTargetY = bestDirectY;
              } else if (opponent) {
                // Direct shot blocked -> compute real mirror-reflection tabela off top or bottom wall
                const wallTopY = PITCH_Y + BALL_R;
                const wallBotY = PITCH_Y + PITCH_H - BALL_R;
                const targetCornerY = opponent.y < goalMidY ? goalMidY + 32 : goalMidY - 32;
                const candidates: { bx: number; by: number }[] = [];

                // Top wall bank shot
                const mirrorTopY = 2 * wallTopY - targetCornerY;
                if (Math.abs(mirrorTopY - ball.y) > 10) {
                  const tTop = (wallTopY - ball.y) / (mirrorTopY - ball.y);
                  if (tTop > 0.08 && tTop < 0.92) {
                    const bx = ball.x + (targetGoalX - ball.x) * tTop;
                    if (bx > PITCH_X + 75 && bx < PITCH_X + PITCH_W - 75) {
                      candidates.push({ bx, by: wallTopY });
                    }
                  }
                }

                // Bottom wall bank shot
                const mirrorBotY = 2 * wallBotY - targetCornerY;
                if (Math.abs(mirrorBotY - ball.y) > 10) {
                  const tBot = (wallBotY - ball.y) / (mirrorBotY - ball.y);
                  if (tBot > 0.08 && tBot < 0.92) {
                    const bx = ball.x + (targetGoalX - ball.x) * tBot;
                    if (bx > PITCH_X + 75 && bx < PITCH_X + PITCH_W - 75) {
                      candidates.push({ bx, by: wallBotY });
                    }
                  }
                }

                for (const c of candidates) {
                  const seg1Clear = isSegmentClear(
                    ball.x,
                    ball.y,
                    c.bx,
                    c.by,
                    opponent.x,
                    opponent.y,
                    opponent.radius + BALL_R + 8
                  );
                  const seg2Clear = isSegmentClear(
                    c.bx,
                    c.by,
                    targetGoalX,
                    targetCornerY,
                    opponent.x,
                    opponent.y,
                    opponent.radius + BALL_R + 8
                  );
                  if (seg1Clear && seg2Clear) {
                    aimTargetX = c.bx;
                    aimTargetY = c.by;
                    isBankShot = true;
                    break;
                  }
                }

                // If even bank shots are crowded, aim away from defender toward open flank
                if (!isBankShot) {
                  aimTargetX = targetGoalX;
                  aimTargetY = opponent.y < goalMidY ? goalMidY + 52 : goalMidY - 52;
                }
              }

              // 3. Modulate kick power so Lendário dribbles cleanly without blasting ("isolar") the ball
              const distToTargetGoal = Math.hypot(targetGoalX - ball.x, goalMidY - ball.y);
              const urgentBoxClearance = Math.abs(ball.x - ownGoalX) < 125 && oppAttackingSide;
              if (urgentBoxClearance) {
                disc.desiredKickPowerScale = 0.86;
              } else if (isBankShot) {
                disc.desiredKickPowerScale = 0.78;
              } else if (distToTargetGoal > 420) {
                // Controlled dribble / progression touch in own half / midfield
                disc.desiredKickPowerScale = 0.45;
              } else if (distToTargetGoal > 250) {
                disc.desiredKickPowerScale = 0.68;
              } else {
                // Clinical finishing power inside attacking zone
                disc.desiredKickPowerScale = 0.9;
              }
            }
          }

          const toTargetX = aimTargetX - ball.x;
          const toTargetY = aimTargetY - ball.y;
          const toTargetLen = Math.hypot(toTargetX, toTargetY) || 1;
          const dirGoalX = toTargetX / toTargetLen;
          const dirGoalY = toTargetY / toTargetLen;

          const outfieldTeammates = sim.discs.filter(
            (d) => d.teamSide === disc.teamSide && !d.isGoalkeeper
          );
          const closestToBall = outfieldTeammates.reduce((best, cur) => {
            const db = Math.hypot(best.x - ball.x, best.y - ball.y);
            const dc = Math.hypot(cur.x - ball.x, cur.y - ball.y);
            return dc < db ? cur : best;
          }, outfieldTeammates[0]);

          const strikeDist =
            disc.kickCooldown <= 0 ? BALL_R + disc.radius - 2 : BALL_R + disc.radius + 4;
          let desiredX = predBallX - dirGoalX * strikeDist;
          let desiredY = predBallY - dirGoalY * strikeDist;

          if (blockGoalMode) {
            // Position directly on the shot corridor between ball and own goalmouth
            const gx = ownGoalX + attackDir * 32;
            const rayX = predBallX - gx;
            const rayY = predBallY - goalMidY;
            const rayLen = Math.hypot(rayX, rayY) || 1;
            const blockDepth = Math.min(Math.max(24, rayLen * 0.34), 108);
            desiredX = gx + (rayX / rayLen) * blockDepth;
            desiredY = Math.max(
              GOAL_TOP + 16,
              Math.min(GOAL_BOT - 16, goalMidY + (rayY / rayLen) * blockDepth)
            );
          } else if (closestToBall.id === disc.id) {
            if (!isBehindBall) {
              const offsetSign =
                ball.y < PITCH_Y + 60
                  ? 1
                  : ball.y > PITCH_Y + PITCH_H - 60
                    ? -1
                    : disc.y < ball.y
                      ? -1
                      : 1;
              desiredX = Math.max(
                PITCH_X + 20,
                Math.min(PITCH_X + PITCH_W - 20, ball.x - attackDir * 44)
              );
              desiredY = Math.max(
                PITCH_Y + 24,
                Math.min(PITCH_Y + PITCH_H - 24, ball.y + offsetSign * 44)
              );
            }
          } else {
            const laneOffset = disc.id.endsWith('1') ? -85 : 85;
            desiredX = (ownGoalX + ball.x) * 0.52 - attackDir * 50;
            desiredY = Math.max(
              PITCH_Y + 60,
              Math.min(PITCH_Y + PITCH_H - 60, goalMidY + laneOffset * 0.6 + (ball.y - goalMidY) * 0.35)
            );
          }

          const dx = desiredX - disc.x;
          const dy = desiredY - disc.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 3) {
            ax = dx / dist;
            ay = dy / dist;
          }

          const distToBall = Math.hypot(ball.x - disc.x, ball.y - disc.y);
          const safeForwardKick =
            isBehindBall ||
            (distToBall <= disc.radius + BALL_R + 5 &&
              Math.abs(ball.x - ownGoalX) < 95);
          // In Lendário, also intercept/clear immediately if blocking in front of goal & ball touches
          const blockInterceptKick =
            diff === 'dificil' &&
            blockGoalMode &&
            distToBall <= disc.radius + BALL_R + 12 &&
            isBehindBall;

          if (
            distToBall <= disc.radius + BALL_R + 14 &&
            disc.kickCooldown <= 0 &&
            (safeForwardKick || blockInterceptKick)
          ) {
            disc.kickBuffer = 0.12;
            disc.kickGlow = 1;
          }
        }

        if (!isBackgroundDemo) {
          if (currentSpd > 140) {
            disc.stamina = Math.max(15, disc.stamina - dt * 0.38 * drainResistance * tacticDrain);
          } else {
            disc.stamina = Math.min(100, disc.stamina + dt * 0.22);
          }
        }

        disc.vx += ax * maxAccel * dt;
        disc.vy += ay * maxAccel * dt;
        const damping = Math.pow(0.015, dt);
        disc.vx *= damping;
        disc.vy *= damping;

        const baseMaxSpeed =
          disc.isHuman || disc.isHuman2
            ? 280
            : disc.isGoalkeeper
              ? 245 * diffProfile.gkSpeed
              : 252 * diffProfile.speedMult;
        const maxSpeed = baseMaxSpeed * paceFactor;
        const spd = Math.hypot(disc.vx, disc.vy);
        if (spd > maxSpeed) {
          disc.vx = (disc.vx / spd) * maxSpeed;
          disc.vy = (disc.vy / spd) * maxSpeed;
        }

        disc.x += disc.vx * dt;
        disc.y += disc.vy * dt;
        disc.kickAngle = Math.atan2(ball.y - disc.y, ball.x - disc.x);

        const minX = PITCH_X - 38 + disc.radius;
        const maxX = PITCH_X + PITCH_W + 38 - disc.radius;
        const minY = PITCH_Y - 38 + disc.radius;
        const maxY = PITCH_Y + PITCH_H + 38 - disc.radius;
        if (disc.x < minX) {
          disc.x = minX;
          disc.vx = Math.max(0, disc.vx);
        }
        if (disc.x > maxX) {
          disc.x = maxX;
          disc.vx = Math.min(0, disc.vx);
        }
        if (disc.y < minY) {
          disc.y = minY;
          disc.vy = Math.max(0, disc.vy);
        }
        if (disc.y > maxY) {
          disc.y = maxY;
          disc.vy = Math.min(0, disc.vy);
        }
      }

      // Disc-to-disc collisions (DEF attribute determines disc mass & tackle push)
      for (let i = 0; i < sim.discs.length; i++) {
        for (let j = i + 1; j < sim.discs.length; j++) {
          const a = sim.discs[i];
          const b = sim.discs[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.radius + b.radius;
          if (dist < minDist && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            const invMassA = 1 / (a.mass || 1);
            const invMassB = 1 / (b.mass || 1);
            const invMassSum = invMassA + invMassB;

            a.x -= nx * overlap * (invMassA / invMassSum);
            a.y -= ny * overlap * (invMassA / invMassSum);
            b.x += nx * overlap * (invMassB / invMassSum);
            b.y += ny * overlap * (invMassB / invMassSum);

            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const velAlongNormal = rvx * nx + rvy * ny;
            if (velAlongNormal < 0) {
              const restitution = 0.58;
              const jImpulse = (-(1 + restitution) * velAlongNormal) / invMassSum;
              a.vx -= jImpulse * invMassA * nx;
              a.vy -= jImpulse * invMassA * ny;
              b.vx += jImpulse * invMassB * nx;
              b.vy += jImpulse * invMassB * ny;
            }
          }
        }
      }

      // Move Ball
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      const ballFriction = Math.pow(0.45, dt);
      ball.vx *= ballFriction;
      ball.vy *= ballFriction;
      ball.spin += (Math.hypot(ball.vx, ball.vy) * dt) / BALL_R;

      const ballSpd = Math.hypot(ball.vx, ball.vy);
      if (ballSpd > 310 && Math.random() < 0.72) {
        const trailCol =
          ball.lastTouchedSide === 'home'
            ? config.homeTeam.kit.trailColor
            : config.awayTeam.kit.trailColor;
        sim.particles.push({
          x: ball.x + (Math.random() - 0.5) * 6,
          y: ball.y + (Math.random() - 0.5) * 6,
          vx: -ball.vx * 0.08,
          vy: -ball.vy * 0.08,
          life: 0.25,
          maxLife: 0.35,
          size: 4,
          color: trailCol,
        });
      }

      // Disc-to-ball collisions + Direct Kick
      for (const disc of sim.discs) {
        const dx = ball.x - disc.x;
        const dy = ball.y - disc.y;
        const dist = Math.hypot(dx, dy);
        const touchDist = disc.radius + BALL_R;

        if (dist < touchDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = touchDist - dist;
          ball.x += nx * overlap;
          ball.y += ny * overlap;

          const rvx = ball.vx - disc.vx;
          const rvy = ball.vy - disc.vy;
          const relNormal = rvx * nx + rvy * ny;
          if (relNormal < 0) {
            const bounce = disc.isGoalkeeper ? 0.78 : 0.65;
            ball.vx -= (1 + bounce) * relNormal * nx;
            ball.vy -= (1 + bounce) * relNormal * ny;
            ball.vx += disc.vx * 0.32;
            ball.vy += disc.vy * 0.32;
          }
          ball.lastTouchedSide = disc.teamSide;
          ball.lastTouchedName = disc.player.shortName;
        }

        const kdx = ball.x - disc.x;
        const kdy = ball.y - disc.y;
        const kdist = Math.hypot(kdx, kdy);
        const kickReach = disc.radius + BALL_R + 14;
        if (disc.kickBuffer > 0 && disc.kickCooldown <= 0 && kdist <= kickReach && kdist > 0.001) {
          const nx = kdx / kdist;
          const ny = kdy / kdist;
          const shotFactor = 0.9 + ((disc.player.shot - 70) / 30) * 0.26;
          const tacticShotMult = disc.isHuman && config.tacticStyle === 'ofensivo' ? 1.05 : 1;
          const powerScale = disc.isHuman ? 1 : disc.desiredKickPowerScale;
          const kickPower =
            (disc.isHuman ? 625 : 590 * (0.85 + diffProfile.speedMult * 0.15)) *
            shotFactor *
            tacticShotMult *
            powerScale;

          ball.vx = nx * kickPower + disc.vx * 0.28;
          ball.vy = ny * kickPower + disc.vy * 0.28;

          ball.lastTouchedSide = disc.teamSide;
          ball.lastTouchedName = disc.player.shortName;

          disc.kickCooldown = disc.isHuman
            ? 0.2
            : powerScale < 0.55
              ? 0.24
              : Math.max(0.22, diffProfile.kickInterval);
          disc.kickBuffer = 0;
          disc.kickGlow = 1;

          const trailCol =
            disc.teamSide === 'home'
              ? config.homeTeam.kit.trailColor
              : config.awayTeam.kit.trailColor;
          spawnParticles(ball.x, ball.y, 10, trailCol, 1.15);

          if (!isBackgroundDemo) {
            soundEngine.playKick(shotFactor, false);
            sim.hitstopTimer = 0.025;
            sim.shakeTime = 0.1;
            sim.shakeIntensity = 3.5;
            if (isTrainingSolo) {
              setLastShotSpeed(Math.round((Math.hypot(ball.vx, ball.vy) / 625) * 116));
            } else if (Date.now() - lastSpokenAtRef.current >= 5500) {
              const actorTeam = disc.teamSide === 'home' ? config.homeTeam.name : config.awayTeam.name;
              const oppTeam = disc.teamSide === 'home' ? config.awayTeam.name : config.homeTeam.name;
              const kickLines = [
                `Olha a batida de ${disc.player.shortName}, vai tentando surpreender o ${oppTeam}!`,
                `Soltou a bomba ${disc.player.shortName} pelo ${actorTeam}!`,
                `Caprichou no chute o ${disc.player.shortName}, olha o perigo!`,
                `Arriscou pro gol ${disc.player.shortName}, buscando o canto do ${oppTeam}!`,
              ];
              let kIdx = Math.floor(Math.random() * kickLines.length);
              if (kIdx === lastKickCallIdxRef.current) {
                kIdx = (kIdx + 1) % kickLines.length;
              }
              lastKickCallIdxRef.current = kIdx;
              announce(kickLines[kIdx], false, 'tension');
            }
          }
        }
      }

      // Goalposts
      const posts = [
        { x: PITCH_X, y: GOAL_TOP },
        { x: PITCH_X, y: GOAL_BOT },
        { x: PITCH_X + PITCH_W, y: GOAL_TOP },
        { x: PITCH_X + PITCH_W, y: GOAL_BOT },
      ];
      for (const post of posts) {
        const dx = ball.x - post.x;
        const dy = ball.y - post.y;
        const dist = Math.hypot(dx, dy);
        const minDist = BALL_R + POST_R;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          ball.x = post.x + nx * minDist;
          ball.y = post.y + ny * minDist;
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx -= 1.85 * dot * nx;
            ball.vy -= 1.85 * dot * ny;
            if (!isBackgroundDemo) {
              soundEngine.playPostClang();
              sim.shakeTime = 0.16;
              sim.shakeIntensity = 5.5;
              const postLines = [
                `NO FERRO! Que susto enorme! Por centímetros ${config.homeTeam.name} e ${config.awayTeam.name} não mudam o placar!`,
                `NA TRAVE! Meu Deus, a bola explode no poste e faz o estádio prender a respiração!`,
                `EXPLODE NA TRAVE! Faltou um detalhezinho para sair o gol agora!`,
              ];
              announce(postLines[Math.floor(Math.random() * postLines.length)], true, 'tension');
            }
          }
        }
      }

      // Record frame for Instant Slow-Motion Replay!
      if (!isBackgroundDemo) {
        const buf = replayBufferRef.current;
        buf.push({
          discs: sim.discs.map((d) => {
            const t = d.teamSide === 'home' ? config.homeTeam : config.awayTeam;
            return {
              x: d.x,
              y: d.y,
              radius: d.radius,
              teamSide: d.teamSide,
              isHuman: d.isHuman,
              isGoalkeeper: d.isGoalkeeper,
              label:
                t.kit.displayMode === 'initial'
                  ? d.player.shortName.charAt(0).toUpperCase()
                  : String(d.player.number),
              name: d.isHuman ? `VOCÊ · ${d.player.shortName}` : d.isGoalkeeper ? `GL · ${t.shortCode}` : d.player.shortName,
              kickGlow: d.kickGlow,
              kickAngle: d.kickAngle,
            };
          }),
          ballX: ball.x,
          ballY: ball.y,
          ballSpin: ball.spin,
        });
        if (buf.length > 200) buf.shift();
      }

      const inGoalMouthY = ball.y > GOAL_TOP + BALL_R * 0.35 && ball.y < GOAL_BOT - BALL_R * 0.35;

      if (ball.y - BALL_R < PITCH_Y) {
        ball.y = PITCH_Y + BALL_R;
        ball.vy = Math.abs(ball.vy) * 0.84;
        if (!isBackgroundDemo && Math.abs(ball.vy) > 60) soundEngine.playWallBounce(0.6);
      } else if (ball.y + BALL_R > PITCH_Y + PITCH_H) {
        ball.y = PITCH_Y + PITCH_H - BALL_R;
        ball.vy = -Math.abs(ball.vy) * 0.84;
        if (!isBackgroundDemo && Math.abs(ball.vy) > 60) soundEngine.playWallBounce(0.6);
      }

      if (!inGoalMouthY) {
        if (ball.x - BALL_R < PITCH_X) {
          ball.x = PITCH_X + BALL_R;
          ball.vx = Math.abs(ball.vx) * 0.84;
          if (!isBackgroundDemo && Math.abs(ball.vx) > 60) soundEngine.playWallBounce(0.6);
        } else if (ball.x + BALL_R > PITCH_X + PITCH_W) {
          ball.x = PITCH_X + PITCH_W - BALL_R;
          ball.vx = -Math.abs(ball.vx) * 0.84;
          if (!isBackgroundDemo && Math.abs(ball.vx) > 60) soundEngine.playWallBounce(0.6);
        }
      } else {
        const triggerGoal = (scoringSide: 'home' | 'away') => {
          const team = scoringSide === 'home' ? config.homeTeam : config.awayTeam;
          if (scoringSide === 'home') {
            sim.homeGoals += 1;
            sim.netRippleRight = 1;
            setHomeScore(sim.homeGoals);
          } else {
            sim.awayGoals += 1;
            sim.netRippleLeft = 1;
            setAwayScore(sim.awayGoals);
          }

          const scorer =
            ball.lastTouchedSide === scoringSide
              ? ball.lastTouchedName
              : team.players[0]?.shortName || 'Artilheiro';
          sim.scorers.push({ teamSide: scoringSide, playerName: scorer, timeSec: Math.round(sim.elapsed) });

          const scorerDisc = sim.discs.find((d) => d.teamSide === scoringSide && !d.isGoalkeeper);
          sim.celebrationScorerId = scorerDisc?.id || null;
          sim.goalPhase = 'celebration';
          sim.goalFreezeTimer = 1.65;
          sim.replayFrames = replayBufferRef.current.slice(-135);
          sim.hitstopTimer = 0.055;
          sim.shakeTime = 0.3;
          sim.shakeIntensity = 8.5;

          const goalX = scoringSide === 'home' ? PITCH_X + PITCH_W : PITCH_X;
          spawnCelebrationConfetti(goalX, ball.y, team.kit.primaryColor);

          if (!isBackgroundDemo) {
            soundEngine.playGoalCheer();
            setGoalBanner({
              side: scoringSide,
              scorer,
              teamName: team.name,
              color: team.kit.primaryColor,
            });

            const totalGoals = sim.homeGoals + sim.awayGoals;
            const isEqualizer = sim.homeGoals === sim.awayGoals;
            const isGoAhead =
              (scoringSide === 'home' && sim.homeGoals === sim.awayGoals + 1) ||
              (scoringSide === 'away' && sim.awayGoals === sim.homeGoals + 1);

            const goalLines =
              totalGoals === 1
                ? [
                    `GOOOOL! É rede! ${scorer} abre o placar para o ${team.name}! ${config.homeTeam.name} ${sim.homeGoals}, ${config.awayTeam.name} ${sim.awayGoals}!`,
                    `TA LÁ DENTRO! Golaço de ${scorer} pra fazer a festa do ${team.name}! Um a zero no placar!`,
                  ]
                : isEqualizer
                  ? [
                      `GOOOOL DE EMPATE! ${scorer} deixa tudo igual outra vez para o ${team.name}! ${sim.homeGoals} a ${sim.awayGoals}!`,
                      `RESPONDE NA HORA! ${scorer} empata o jogo pelo ${team.name}, que emoção!`,
                    ]
                  : isGoAhead
                    ? [
                        `GOOOOL DA VIRADA NA FRENTE! ${scorer} coloca o ${team.name} em vantagem! ${config.homeTeam.name} ${sim.homeGoals} x ${sim.awayGoals} ${config.awayTeam.name}!`,
                        `QUE MOMENTO! ${scorer} marca pro ${team.name} e explode o estádio!`,
                      ]
                    : [
                        `É REDE DE NOVO! GOOOOL do ${team.name}! ${scorer} amplia e faz ${config.homeTeam.name} ${sim.homeGoals} x ${sim.awayGoals} ${config.awayTeam.name}!`,
                        `GOLAÇO! ${scorer} não perdoa e anota mais um para o ${team.name}!`,
                      ];

            announce(goalLines[Math.floor(Math.random() * goalLines.length)], true, 'goal');
          }
        };

        if (ball.x + BALL_R * 0.3 < PITCH_X) {
          triggerGoal('away');
        } else if (ball.x - BALL_R * 0.3 > PITCH_X + PITCH_W) {
          triggerGoal('home');
        }

        if (ball.x - BALL_R < PITCH_X - GOAL_W) {
          ball.x = PITCH_X - GOAL_W + BALL_R;
          ball.vx *= -0.35;
        }
        if (ball.x + BALL_R > PITCH_X + PITCH_W + GOAL_W) {
          ball.x = PITCH_X + PITCH_W + GOAL_W - BALL_R;
          ball.vx *= -0.35;
        }
      }
    };

    const drawPitchWatermark = (ctx: CanvasRenderingContext2D, team: Team, cx: number, cy: number) => {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(cx, cy, 58, 0, Math.PI * 2);
      ctx.fillStyle = team.kit.primaryColor;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = team.kit.secondaryColor;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 28px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(team.shortCode, cx, cy + 2);
      ctx.restore();
    };

    const render = () => {
      const canvas = canvasRef.current;
      const sim = simRef.current;
      if (!canvas || !sim) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const targetW = ARENA_W * dpr;
      const targetH = ARENA_H * dpr;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      if (sim.shakeTime > 0) {
        const mag = sim.shakeIntensity * (sim.shakeTime / 0.3);
        ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
      }

      const isLib =
        config.tournament === 'libertadores_final' || config.tournament === 'career_continental_final';
      const isSul = config.tournament === 'sulamericana_final';
      ctx.fillStyle = isLib ? '#153620' : isSul ? '#113034' : '#184225';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // Customized Team Perimeter Boards
      ctx.save();
      ctx.fillStyle = config.homeTeam.kit.primaryColor;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(PITCH_X, PITCH_Y - 16, PITCH_W / 2, 7);
      ctx.fillRect(PITCH_X, PITCH_Y + PITCH_H + 9, PITCH_W / 2, 7);
      ctx.fillStyle = config.homeTeam.kit.secondaryColor;
      ctx.fillRect(PITCH_X, PITCH_Y - 9, PITCH_W / 2, 3);
      ctx.fillRect(PITCH_X, PITCH_Y + PITCH_H + 6, PITCH_W / 2, 3);

      ctx.fillStyle = config.awayTeam.kit.primaryColor;
      ctx.fillRect(PITCH_X + PITCH_W / 2, PITCH_Y - 16, PITCH_W / 2, 7);
      ctx.fillRect(PITCH_X + PITCH_W / 2, PITCH_Y + PITCH_H + 9, PITCH_W / 2, 7);
      ctx.fillStyle = config.awayTeam.kit.secondaryColor;
      ctx.fillRect(PITCH_X + PITCH_W / 2, PITCH_Y - 9, PITCH_W / 2, 3);
      ctx.fillRect(PITCH_X + PITCH_W / 2, PITCH_Y + PITCH_H + 6, PITCH_W / 2, 3);

      ctx.globalAlpha = 0.72;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 12px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(config.homeTeam.name.toUpperCase(), PITCH_X + 8, PITCH_Y - 22);
      ctx.textAlign = 'right';
      ctx.fillText(config.awayTeam.name.toUpperCase(), PITCH_X + PITCH_W - 8, PITCH_Y - 22);
      ctx.restore();

      const stripeCount = 10;
      const stripeW = PITCH_W / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#2E8037' : '#266E2E';
        ctx.fillRect(PITCH_X + i * stripeW, PITCH_Y, stripeW + 0.5, PITCH_H);
      }

      ctx.save();
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = '#FFFFFF';
      for (let r = 0; r < 6; r += 2) {
        ctx.fillRect(PITCH_X, PITCH_Y + r * (PITCH_H / 6), PITCH_W, PITCH_H / 6);
      }
      ctx.restore();

      drawPitchWatermark(ctx, config.homeTeam, PITCH_X + PITCH_W * 0.25, PITCH_Y + PITCH_H * 0.5);
      if (config.settings.format !== 'training_solo') {
        drawPitchWatermark(ctx, config.awayTeam, PITCH_X + PITCH_W * 0.75, PITCH_Y + PITCH_H * 0.5);
      }

      if (isLib || isSul || config.tournament === 'career_continental_cup' || config.tournament === 'tournament_cup') {
        ctx.save();
        ctx.fillStyle = isSul ? 'rgba(56, 189, 248, 0.28)' : 'rgba(250, 204, 21, 0.28)';
        ctx.font = '800 22px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(config.tournamentLabel.toUpperCase(), ARENA_W / 2, PITCH_Y + PITCH_H + 46);
        ctx.restore();
      }

      const drawGoalNet = (gx: number, color: string, ripple: number, isLeft: boolean) => {
        ctx.save();
        const wobble = Math.sin(ripple * 24) * ripple * 4;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(gx + (isLeft ? wobble : 0), GOAL_TOP, GOAL_W, GOAL_H);

        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        for (let ny = GOAL_TOP + 14; ny < GOAL_BOT; ny += 16) {
          ctx.beginPath();
          ctx.moveTo(gx, ny);
          ctx.lineTo(gx + GOAL_W, ny);
          ctx.stroke();
        }
        for (let nx = gx + 12; nx < gx + GOAL_W; nx += 12) {
          ctx.beginPath();
          ctx.moveTo(nx, GOAL_TOP);
          ctx.lineTo(nx, GOAL_BOT);
          ctx.stroke();
        }

        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 3;
        ctx.strokeRect(gx, GOAL_TOP, GOAL_W, GOAL_H);
        ctx.restore();
      };

      drawGoalNet(PITCH_X - GOAL_W, config.homeTeam.kit.primaryColor, sim.netRippleLeft, true);
      drawGoalNet(PITCH_X + PITCH_W, config.awayTeam.kit.primaryColor, sim.netRippleRight, false);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
      ctx.lineWidth = 3;
      ctx.strokeRect(PITCH_X, PITCH_Y, PITCH_W, PITCH_H);

      const midX = PITCH_X + PITCH_W / 2;
      const midY = PITCH_Y + PITCH_H / 2;
      ctx.beginPath();
      ctx.moveTo(midX, PITCH_Y);
      ctx.lineTo(midX, PITCH_Y + PITCH_H);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(midX, midY, 78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(midX, midY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.strokeRect(PITCH_X, midY - 135, 130, 270);
      ctx.strokeRect(PITCH_X + PITCH_W - 130, midY - 135, 130, 270);
      ctx.strokeRect(PITCH_X, midY - 88, 52, 176);
      ctx.strokeRect(PITCH_X + PITCH_W - 52, midY - 88, 52, 176);

      ctx.beginPath();
      ctx.arc(PITCH_X + 95, midY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(PITCH_X + PITCH_W - 95, midY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(PITCH_X + 95, midY, 58, -0.92, 0.92);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(PITCH_X + PITCH_W - 95, midY, 58, Math.PI - 0.92, Math.PI + 0.92);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(PITCH_X, GOAL_TOP);
      ctx.lineTo(PITCH_X, GOAL_BOT);
      ctx.moveTo(PITCH_X + PITCH_W, GOAL_TOP);
      ctx.lineTo(PITCH_X + PITCH_W, GOAL_BOT);
      ctx.stroke();
      ctx.restore();

      const cR = 18;
      ctx.beginPath();
      ctx.arc(PITCH_X, PITCH_Y, cR, 0, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(PITCH_X + PITCH_W, PITCH_Y, cR, Math.PI / 2, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(PITCH_X + PITCH_W, PITCH_Y + PITCH_H, cR, Math.PI, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(PITCH_X, PITCH_Y + PITCH_H, cR, Math.PI * 1.5, Math.PI * 2);
      ctx.stroke();

      const posts = [
        { x: PITCH_X, y: GOAL_TOP },
        { x: PITCH_X, y: GOAL_BOT },
        { x: PITCH_X + PITCH_W, y: GOAL_TOP },
        { x: PITCH_X + PITCH_W, y: GOAL_BOT },
      ];
      for (const pt of posts) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, POST_R, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#09090B';
        ctx.stroke();
      }

      // If in Slow-Motion Replay phase, render recorded frame!
      if (sim.goalPhase === 'replay' && sim.replayFrames.length > 0) {
        const fIdx = Math.min(sim.replayFrames.length - 1, Math.floor(sim.replayIndex));
        const rf = sim.replayFrames[fIdx];

        for (const d of rf.discs) {
          const team = d.teamSide === 'home' ? config.homeTeam : config.awayTeam;
          drawPlayerDisc(ctx, d.x, d.y, d.radius, team.kit, d.label, {
            isHuman: d.isHuman,
            isGoalkeeper: d.isGoalkeeper,
            kickGlow: d.kickGlow,
            kickAngle: d.kickAngle,
            playerName: d.name,
            showName: true,
            team,
          });
        }
        drawSoccerBall(ctx, rf.ballX, rf.ballY, BALL_R, rf.ballSpin);

        // Broadcast replay border tint
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, ARENA_W - 8, ARENA_H - 8);
      } else {
        for (const pt of sim.particles) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        for (const disc of sim.discs) {
          const team = disc.teamSide === 'home' ? config.homeTeam : config.awayTeam;
          const label =
            team.kit.displayMode === 'initial'
              ? disc.player.shortName.charAt(0).toUpperCase()
              : String(disc.player.number);

          // Pulsing Celebration Aura when celebrating a goal
          if (sim.goalPhase === 'celebration' && sim.celebrationScorerId === disc.id) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(disc.x, disc.y, disc.radius + 14 + Math.sin(performance.now() * 0.02) * 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#FACC15';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
          }

          drawPlayerDisc(ctx, disc.x, disc.y, disc.radius, team.kit, label, {
            isHuman: disc.isHuman || Boolean(disc.isHuman2),
            isGoalkeeper: disc.isGoalkeeper,
            kickGlow: disc.kickGlow,
            kickAngle: disc.kickAngle,
            team,
            playerName:
              config.settings.format === 'local_2p' || config.settings.format === 'online_2p'
                ? disc.teamSide === 'home'
                  ? `J1 · ${config.player1Name || disc.player.shortName}`
                  : `J2 · ${config.player2Name || disc.player.shortName}`
                : disc.isHuman
                  ? `VOCÊ · ${disc.player.shortName}`
                  : disc.isGoalkeeper
                    ? `GL · ${team.shortCode}`
                    : disc.player.shortName,
            showName: !isBackgroundDemo,
          });
        }

        drawSoccerBall(ctx, sim.ball.x, sim.ball.y, BALL_R, sim.ball.spin);
      }

      ctx.restore();
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      stepPhysics(dt);
      render();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [announce, config, isBackgroundDemo, resetPositions, showPenaltyShootout]);

  // Online 2P WebSocket authoritative match synchronization
  useEffect(() => {
    if (isBackgroundDemo || config.settings.format !== 'online_2p' || !config.onlineRoom) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    onlineWsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'join_room',
          token: config.onlineRoom!.token,
          roomCode: config.onlineRoom!.roomCode,
          homeTeamName: config.homeTeam.name,
          awayTeamName: config.awayTeam.name,
        })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data || '{}')) as Record<string, unknown>;
        const sim = simRef.current;

        if (msg.type === 'state' && sim) {
          const b = msg.ball as { x: number; y: number; spin: number } | undefined;
          if (b) {
            sim.ball.x = b.x;
            sim.ball.y = b.y;
            sim.ball.spin = b.spin;
          }
          const discs = msg.discs as
            | {
                side: 'home' | 'away';
                x: number;
                y: number;
                kickGlow: number;
                kickAngle: number;
                stamina: number;
              }[]
            | undefined;
          if (Array.isArray(discs)) {
            for (const rd of discs) {
              const target = sim.discs.find((d) => d.teamSide === rd.side);
              if (target) {
                target.x = rd.x;
                target.y = rd.y;
                target.kickGlow = rd.kickGlow;
                target.kickAngle = rd.kickAngle;
                target.stamina = rd.stamina;
              }
            }
          }

          sim.homeGoals = Number(msg.homeGoals) || 0;
          sim.awayGoals = Number(msg.awayGoals) || 0;
          sim.elapsed = Number(msg.elapsed) || 0;
          sim.inAddedTime = Boolean(msg.inAddedTime);
          sim.addedMinutesTotal = Number(msg.addedMinutesTotal) || 0;
          sim.addedSecondsLeft = Number(msg.addedSecondsLeft) || 0;
          sim.netRippleLeft = Number(msg.netRippleLeft) || 0;
          sim.netRippleRight = Number(msg.netRippleRight) || 0;
          if (msg.goalPhase === 'none') {
            setGoalBanner(null);
          }

          setHomeScore(sim.homeGoals);
          setAwayScore(sim.awayGoals);
          setInAddedTime(sim.inAddedTime);
          setAddedMinutes(sim.addedMinutesTotal);
          const regDur = config.settings.durationSeconds || 120;
          if (!sim.inAddedTime) {
            setElapsedSecDisplay(Math.min(regDur, Math.floor(sim.elapsed)));
          } else {
            const totalExtra = Math.max(8, sim.addedMinutesTotal * 3.5);
            const extraElapsed = Math.floor(totalExtra - sim.addedSecondsLeft);
            setElapsedSecDisplay(regDur + Math.max(0, extraElapsed));
          }
        } else if (msg.type === 'sound_event') {
          if (msg.event === 'kick') soundEngine.playKick();
          else if (msg.event === 'post') soundEngine.playPostClang();
          else if (msg.event === 'whistle') soundEngine.playWhistle(false);
        } else if (msg.type === 'commentary' && typeof msg.text === 'string') {
          announce(msg.text, Boolean(msg.priority), (msg.emotion as NarrationEmotion) || 'normal');
        } else if (msg.type === 'goal') {
          soundEngine.playGoalCheer();
          const side = msg.scoringSide === 'away' ? 'away' : 'home';
          const t = side === 'home' ? config.homeTeam : config.awayTeam;
          setGoalBanner({
            side,
            scorer: String(msg.scorer || t.shortCode),
            teamName: t.name,
            color: t.kit.primaryColor,
          });
          announce(`GOOOOL de ${String(msg.scorer || t.name)}! ${t.name} balança as redes!`, true, 'goal');
        } else if (msg.type === 'match_finished') {
          const r = msg.result as {
            homeGoals: number;
            awayGoals: number;
            winnerSide: 'home' | 'away' | 'draw';
            scorers: { teamSide: 'home' | 'away'; playerName: string; timeSec: number }[];
          };
          if (sim) sim.finished = true;
          soundEngine.playWhistle(true);
          setMatchFinished({
            homeGoals: r.homeGoals,
            awayGoals: r.awayGoals,
            winnerSide: r.winnerSide,
            scorers: r.scorers || [],
            tournament: config.tournament,
          });
        } else if (msg.type === 'opponent_disconnected') {
          setOnlineNotice(String(msg.message || 'O outro jogador desconectou da sala.'));
        }
      } catch {
        // ignore invalid WS frames
      }
    };

    const inputTimer = setInterval(() => {
      const sim = simRef.current;
      if (!sim || ws.readyState !== WebSocket.OPEN || sim.finished) return;
      const k = sim.heldKeys;
      let ax = 0;
      let ay = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) ay -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) ay += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) ax -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) ax += 1;
      if (touchStickRef.current.active) {
        ax += touchStickRef.current.dx;
        ay += touchStickRef.current.dy;
      }
      const gp = config.settings.gamepadEnabled ? pollGamepadInput(0) : null;
      if (gp?.connected) {
        ax += gp.moveX;
        ay += gp.moveY;
      }
      const mag = Math.hypot(ax, ay);
      if (mag > 1) {
        ax /= mag;
        ay /= mag;
      }
      const kick =
        k.has('Space') ||
        sim.kickJustPressed ||
        touchKickPendingRef.current ||
        Boolean(gp?.connected && gp.kickDown);
      sim.kickJustPressed = false;
      touchKickPendingRef.current = false;

      ws.send(JSON.stringify({ type: 'input', ax, ay, kick }));
    }, 1000 / 60);

    return () => {
      clearInterval(inputTimer);
      ws.close();
      onlineWsRef.current = null;
    };
  }, [announce, config, isBackgroundDemo]);

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

  const handleStick2Start = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    soundEngine.unlock();
    const touch = e.changedTouches[0];
    if (!touch) return;
    touchStick2Ref.current.active = true;
    touchStick2Ref.current.id = touch.identifier;
    updateStick2Position(touch, e.currentTarget);
  };

  const handleStick2Move = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchStick2Ref.current.id);
    if (!touch) return;
    updateStick2Position(touch, e.currentTarget);
  };

  const handleStick2End = () => {
    touchStick2Ref.current = { active: false, dx: 0, dy: 0, id: null };
    setStick2Visual({ x: 0, y: 0 });
  };

  const updateStick2Position = (touch: React.Touch, el: HTMLDivElement) => {
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
    setStick2Visual({ x: dx, y: dy });
    touchStick2Ref.current.dx = dx / maxR;
    touchStick2Ref.current.dy = dy / maxR;
  };

  const handleFetchAiReport = async () => {
    if (!matchFinished || aiLoading) return;
    setAiLoading(true);
    try {
      const userTeam = config.humanSide === 'away' ? config.awayTeam : config.homeTeam;
      const res = await fetch('/api/ai/match-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: config.homeTeam.name,
          awayTeam: config.awayTeam.name,
          homeGoals: matchFinished.homeGoals,
          awayGoals: matchFinished.awayGoals,
          tournamentLabel: config.tournamentLabel,
          scorers: matchFinished.scorers,
          userTeamName: userTeam.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiReport({ error: data.error || 'Falha ao consultar a IA.' });
      } else {
        setAiReport(data);
      }
    } catch {
      setAiReport({ error: 'Não foi possível conectar ao serviço de IA.' });
    } finally {
      setAiLoading(false);
    }
  };

  if (showPenaltyShootout) {
    return (
      <PenaltyShootoutCanvas
        config={config}
        initialHomeGoals={simRef.current?.homeGoals || 0}
        initialAwayGoals={simRef.current?.awayGoals || 0}
        onComplete={(res) => {
          if (onMatchComplete) onMatchComplete(res);
          else if (onExit) onExit();
        }}
        onExit={() => {
          if (onExit) onExit();
        }}
      />
    );
  }

  const isTrainingSolo = config.settings.format === 'training_solo';
  const humanSide = config.humanSide || 'home';
  const userWon =
    matchFinished &&
    ((humanSide === 'home' && matchFinished.winnerSide === 'home') ||
      (humanSide === 'away' && matchFinished.winnerSide === 'away'));

  const regSec = config.settings.durationSeconds || 120;
  const halfPeriod = inAddedTime
    ? `+${addedMinutes}'`
    : elapsedSecDisplay < regSec / 2
      ? '1T'
      : '2T';
  const mm = String(Math.floor(elapsedSecDisplay / 60)).padStart(2, '0');
  const ss = String(elapsedSecDisplay % 60).padStart(2, '0');
  const displayClock = `${mm}:${ss}`;

  const isLightHex = (hex: string) => {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return false;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 185;
  };

  const homeBg = config.homeTeam.kit.primaryColor;
  const homeText = isLightHex(homeBg) ? '#111827' : '#FFFFFF';
  const homeAccent =
    config.homeTeam.kit.secondaryColor.toLowerCase() === homeBg.toLowerCase()
      ? '#FFFFFF'
      : config.homeTeam.kit.secondaryColor;

  const awayBg = config.awayTeam.kit.primaryColor;
  const awayText = isLightHex(awayBg) ? '#111827' : '#FFFFFF';
  const awayAccent =
    config.awayTeam.kit.secondaryColor.toLowerCase() === awayBg.toLowerCase()
      ? '#FFFFFF'
      : config.awayTeam.kit.secondaryColor;

  const isLocal2P = config.settings.format === 'local_2p';

  const renderTouchPad = (compact = false) => {
    if (isLocal2P) {
      return (
        <div
          className={`w-full flex items-center justify-between gap-2 pointer-events-auto ${
            compact ? 'px-2 py-1.5' : 'px-3 pb-2'
          }`}
        >
          {/* JOGADOR 1 (ESQUERDA) */}
          <div className="flex items-center gap-2">
            <div
              onTouchStart={handleStickStart}
              onTouchMove={handleStickMove}
              onTouchEnd={handleStickEnd}
              onTouchCancel={handleStickEnd}
              className={`relative rounded-full bg-emerald-500/15 border-2 border-emerald-400/60 flex items-center justify-center touch-none ${
                compact ? 'w-20 h-20' : 'w-22 h-22 sm:w-24 sm:h-24'
              }`}
            >
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-400/90 border-2 border-white shadow-lg"
                style={{ transform: `translate(${stickVisual.x}px, ${stickVisual.y}px)` }}
              />
            </div>
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                soundEngine.unlock();
                touchKickPendingRef.current = true;
              }}
              onClick={() => {
                soundEngine.unlock();
                touchKickPendingRef.current = true;
              }}
              className={`rounded-full bg-emerald-500/90 active:scale-95 border-2 border-white/85 font-display font-extrabold text-slate-950 shadow-xl touch-none ${
                compact ? 'w-14 h-14 text-xs' : 'w-16 h-16 sm:w-18 sm:h-18 text-sm'
              }`}
            >
              J1
            </button>
          </div>

          {/* JOGADOR 2 (DIREITA) */}
          <div className="flex items-center gap-2">
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                soundEngine.unlock();
                touchKick2PendingRef.current = true;
              }}
              onClick={() => {
                soundEngine.unlock();
                touchKick2PendingRef.current = true;
              }}
              className={`rounded-full bg-amber-500/90 active:scale-95 border-2 border-white/85 font-display font-extrabold text-slate-950 shadow-xl touch-none ${
                compact ? 'w-14 h-14 text-xs' : 'w-16 h-16 sm:w-18 sm:h-18 text-sm'
              }`}
            >
              J2
            </button>
            <div
              onTouchStart={handleStick2Start}
              onTouchMove={handleStick2Move}
              onTouchEnd={handleStick2End}
              onTouchCancel={handleStick2End}
              className={`relative rounded-full bg-amber-500/15 border-2 border-amber-400/60 flex items-center justify-center touch-none ${
                compact ? 'w-20 h-20' : 'w-22 h-22 sm:w-24 sm:h-24'
              }`}
            >
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-400/90 border-2 border-white shadow-lg"
                style={{ transform: `translate(${stick2Visual.x}px, ${stick2Visual.y}px)` }}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`w-full flex items-center justify-between pointer-events-auto ${
          compact ? 'px-4 py-2' : 'px-3 pb-2'
        }`}
      >
        <div
          onTouchStart={handleStickStart}
          onTouchMove={handleStickMove}
          onTouchEnd={handleStickEnd}
          onTouchCancel={handleStickEnd}
          className={`relative rounded-full bg-white/10 border-2 border-white/25 flex items-center justify-center touch-none ${
            compact ? 'w-24 h-24' : 'w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32'
          }`}
        >
          <div
            className={`rounded-full bg-emerald-400/85 border-2 border-white shadow-lg ${
              compact ? 'w-10 h-10' : 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14'
            }`}
            style={{ transform: `translate(${stickVisual.x}px, ${stickVisual.y}px)` }}
          />
        </div>

        <button
          onTouchStart={(e) => {
            e.preventDefault();
            soundEngine.unlock();
            touchKickPendingRef.current = true;
          }}
          onClick={() => {
            soundEngine.unlock();
            touchKickPendingRef.current = true;
          }}
          className={`rounded-full bg-amber-500/90 active:scale-95 border-4 border-white/85 font-display font-extrabold text-slate-950 shadow-xl touch-none ${
            compact ? 'w-20 h-20 text-lg' : 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-lg sm:text-xl md:text-2xl'
          }`}
        >
          CHUTAR
        </button>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col bg-[#09150E] select-none overflow-hidden touch-none"
    >
      {!isBackgroundDemo && (
        <div className="shrink-0 z-20 flex flex-col gap-1 px-2 sm:px-3 pt-1 pb-1 bg-[#07110B]/95 border-b border-white/10 safe-area-hud">
          <div className="relative flex items-center justify-between sm:justify-center w-full gap-2">
            {/* Compact Globo-style TV Broadcast Scoreboard */}
            <div className="flex flex-col items-start sm:items-center shrink-0">
              <div className="flex items-stretch shadow-md font-mono-tabular text-[10px] sm:text-xs font-bold tracking-wide text-white leading-none">
                <span className="bg-[#36383E] px-2 py-[2px] flex items-center justify-center">
                  {isTrainingSolo ? 'TR' : halfPeriod}
                </span>
                <span className="bg-[#1C1D21] px-2 py-[2px] flex items-center justify-center">
                  {isTrainingSolo ? 'LIVRE' : displayClock}
                </span>
              </div>

              <div className="mt-[2px] flex items-stretch gap-[2px] sm:gap-[3px] shadow-xl">
                <div className="flex flex-col min-w-[84px] sm:min-w-[138px] xl:min-w-[158px]">
                  <div
                    className="flex items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-0.5 sm:py-1"
                    style={{ backgroundColor: homeBg, color: homeText }}
                  >
                    <div className="flex items-center gap-1.5">
                      <ClubCrest team={config.homeTeam} size={20} className="hidden sm:block" />
                      <ClubCrest team={config.homeTeam} size={15} className="sm:hidden" />
                      <span className="font-sans text-[11px] sm:text-base font-extrabold tracking-wide uppercase">
                        {config.homeTeam.shortCode}
                      </span>
                    </div>
                    <span className="font-sans text-base sm:text-2xl font-black leading-none tabular-nums">
                      {homeScore}
                    </span>
                  </div>
                  <div className="h-[3px] w-full" style={{ backgroundColor: homeAccent }} />
                </div>

                {!isTrainingSolo && (
                  <div className="flex flex-col min-w-[84px] sm:min-w-[138px] xl:min-w-[158px]">
                    <div
                      className="flex items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-0.5 sm:py-1"
                      style={{ backgroundColor: awayBg, color: awayText }}
                    >
                      <span className="font-sans text-base sm:text-2xl font-black leading-none tabular-nums">
                        {awayScore}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-sans text-[11px] sm:text-base font-extrabold tracking-wide uppercase">
                          {config.awayTeam.shortCode}
                        </span>
                        <ClubCrest team={config.awayTeam} size={20} className="hidden sm:block" />
                        <ClubCrest team={config.awayTeam} size={15} className="sm:hidden" />
                      </div>
                    </div>
                    <div className="h-[3px] w-full" style={{ backgroundColor: awayAccent }} />
                  </div>
                )}
              </div>
            </div>

            <div className="sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0">
              {(config.settings.format === 'training_solo' || config.settings.format === 'training_1v1') && (
                <button
                  onClick={() => {
                    soundEngine.unlock();
                    if (simRef.current) simRef.current.resetJustPressed = true;
                  }}
                  title="Resetar Bola (R)"
                  className="p-1.5 sm:p-2 rounded-lg bg-[#0D1612]/90 border border-white/15 text-slate-200 hover:bg-emerald-600/30 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
              {onToggleGamepad && (
                <button
                  onClick={() => {
                    soundEngine.unlock();
                    onToggleGamepad();
                  }}
                  title="Conectar / Alternar Controle (Gamepad)"
                  className={`p-1.5 sm:p-2 rounded-lg border transition-colors cursor-pointer ${
                    config.settings.gamepadEnabled
                      ? 'bg-emerald-600/80 border-emerald-400 text-white'
                      : 'bg-[#0D1612]/90 border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
              {onToggleMobileControls && (
                <button
                  onClick={() => {
                    soundEngine.unlock();
                    onToggleMobileControls();
                  }}
                  title="Controles Touch (Mobile)"
                  className={`p-1.5 sm:p-2 rounded-lg border transition-colors cursor-pointer ${
                    config.settings.mobileControls
                      ? 'bg-emerald-600/80 border-emerald-400 text-white'
                      : 'bg-[#0D1612]/90 border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
              {onToggleMute && (
                <button
                  onClick={() => {
                    soundEngine.unlock();
                    onToggleMute();
                  }}
                  title={config.settings.muted ? 'Ativar Som' : 'Silenciar'}
                  className="p-1.5 sm:p-2 rounded-lg bg-[#0D1612]/90 border border-white/15 text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {config.settings.muted ? (
                    <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  soundEngine.unlock();
                  if (simRef.current && !simRef.current.finished) {
                    simRef.current.paused = !simRef.current.paused;
                    setIsPaused(simRef.current.paused);
                    soundEngine.playClick();
                  }
                }}
                title="Pausar (Esc)"
                className="p-1.5 sm:p-2 rounded-lg bg-[#0D1612]/90 border border-white/15 text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {isPaused ? (
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                ) : (
                  <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Slim Broadcast Commentary Bar pinned to top header (never blocks the pitch!) */}
          <div className="mx-auto flex items-center gap-1.5 bg-[#0C1912] border border-emerald-500/25 rounded-md px-2.5 py-0.5 text-[10px] sm:text-xs text-emerald-200 max-w-full">
            <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[85vw] sm:max-w-xl xl:max-w-2xl">{commentaryText}</span>
          </div>
        </div>
      )}

      {/* Unobstructed Pitch Stage */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full max-w-full max-h-full object-contain shadow-2xl"
          style={{ aspectRatio: `${ARENA_W} / ${ARENA_H}` }}
        />

        {!isBackgroundDemo && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-3">
            <div className="flex-1 flex flex-col items-center justify-center">
              {goalBanner && (
                <div className="flex flex-col items-center animate-bounce">
                  <div
                    className="px-7 sm:px-9 py-3 sm:py-4 rounded-2xl border-2 border-amber-300/80 shadow-2xl text-center"
                    style={{ backgroundColor: `${goalBanner.color}EE` }}
                  >
                    <div className="font-display text-4xl sm:text-6xl font-extrabold tracking-wider text-white drop-shadow">
                      GOOOOL!
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-amber-200 mt-0.5">
                      Comemoração · {goalBanner.scorer} ({goalBanner.teamName})
                    </div>
                  </div>
                </div>
              )}
            </div>

            {replayBanner && (
              <div className="self-start mb-2 ml-1 bg-black/85 border border-amber-400/60 rounded-xl px-3.5 py-1.5 shadow-xl">
                <div className="text-[11px] sm:text-xs font-extrabold tracking-wider text-amber-400 uppercase">
                  Câmera Lenta · {replayBanner}
                </div>
                <div className="text-[10px] text-slate-300">Pressione Espaço para pular replay</div>
              </div>
            )}

            {/* Landscape / Tablet corner touch controls or desktop shortcut hint */}
            {config.settings.mobileControls ? (
              <div className="hidden sm:block w-full">{renderTouchPad(false)}</div>
            ) : (
              <div className="hidden sm:block mx-auto bg-black/70 border border-white/10 rounded-lg px-3.5 py-0.5 text-[11px] text-slate-300 text-center">
                {config.settings.format === 'local_2p'
                  ? 'J1: WASD + Espaço · J2: Setas + Enter/L · Esc Pausar'
                  : `W, A, S, D Mover · Espaço Chutar${
                      isTrainingSolo || config.settings.format === 'training_1v1' ? ' · R Resetar Bola' : ''
                    } · Esc Pausar`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dedicated Portrait Mobile Touch Deck (below pitch so pitch stays 100% clear) */}
      {!isBackgroundDemo && config.settings.mobileControls && (
        <div className="sm:hidden shrink-0 bg-[#060E09]/95 border-t border-white/10 safe-area-hud">
          {renderTouchPad(true)}
        </div>
      )}

      {!isBackgroundDemo && onlineNotice && !matchFinished && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
          <div className="w-full max-w-sm bg-[#111C16] border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <h2 className="font-display text-2xl font-bold text-white">Partida Online Encerrada</h2>
            <p className="text-xs text-slate-300">{onlineNotice}</p>
            {onExit && (
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onExit();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Voltar ao Lobby 2P
              </button>
            )}
          </div>
        </div>
      )}

      {!isBackgroundDemo && isPaused && !matchFinished && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-30 overflow-y-auto">
          <div className="w-full max-w-sm bg-[#111C16] border border-emerald-500/25 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto">
            <h2 className="font-display text-3xl font-bold text-white text-center">Jogo Pausado</h2>
            <p className="text-xs text-slate-400 text-center mt-1">{config.tournamentLabel}</p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (simRef.current) simRef.current.paused = false;
                  setIsPaused(false);
                  soundEngine.playClick();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" /> Continuar Partida
              </button>
              {config.settings.format !== 'online_2p' && (
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    initMatch();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Reiniciar Partida
                </button>
              )}
              {onExit && (
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    onExit();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Sair para o Menu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isBackgroundDemo && matchFinished && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-4 z-30 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#111C16] border border-emerald-500/30 rounded-2xl p-4 sm:p-6 shadow-2xl text-center max-h-[92dvh] overflow-y-auto">
            {(config.tournament === 'libertadores_final' ||
              config.tournament === 'sulamericana_final' ||
              config.tournament === 'tournament_cup' ||
              config.tournament === 'career_continental_cup' ||
              config.tournament === 'career_continental_final' ||
              config.tournament === 'world_cup_group' ||
              config.tournament === 'world_cup_knockout') && (
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mb-3">
                <Trophy className="w-6 h-6" />
              </div>
            )}

            <div className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
              {config.tournamentLabel}
            </div>
            <h2 className="font-display text-3xl font-extrabold text-white mt-1">
              {matchFinished.winnerSide === 'draw'
                ? 'Empate'
                : userWon
                  ? 'Vitória!'
                  : `${matchFinished.winnerSide === 'home' ? config.homeTeam.name : config.awayTeam.name} Venceu`}
            </h2>

            <div className="mt-4 flex items-center justify-center gap-5 py-4 bg-black/35 rounded-xl border border-white/10">
              <div className="flex flex-col items-center gap-1.5 w-28">
                <ClubCrest team={config.homeTeam} size={46} />
                <span className="text-xs font-semibold text-slate-200 truncate w-full">
                  {config.homeTeam.name}
                </span>
              </div>

              <div className="font-display text-4xl font-extrabold text-white tabular-nums">
                {matchFinished.homeGoals} - {matchFinished.awayGoals}
              </div>

              <div className="flex flex-col items-center gap-1.5 w-28">
                <ClubCrest team={config.awayTeam} size={46} />
                <span className="text-xs font-semibold text-slate-200 truncate w-full">
                  {config.awayTeam.name}
                </span>
              </div>
            </div>

            {matchFinished.scorers.length > 0 && (
              <div className="mt-3 text-xs text-slate-400 max-h-20 overflow-y-auto space-y-1">
                {matchFinished.scorers.map((s, idx) => (
                  <div key={idx}>
                    Gol: <span className="text-slate-200 font-medium">{s.playerName}</span> (
                    {s.teamSide === 'home' ? config.homeTeam.shortCode : config.awayTeam.shortCode})
                  </div>
                ))}
              </div>
            )}

            {/* Gemini AI Post-Match Chronicle */}
            <div className="mt-4">
              {!aiReport ? (
                <button
                  onClick={handleFetchAiReport}
                  disabled={aiLoading}
                  className="w-full py-2 px-4 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? 'Gerando Crônica Pós-Jogo com IA...' : 'Gerar Crônica & Coletiva Pós-Jogo (IA)'}
                </button>
              ) : aiReport.error ? (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-200 text-left">
                  {aiReport.error}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-black/40 border border-amber-400/30 text-left space-y-1.5">
                  <div className="text-xs font-extrabold text-amber-300">{aiReport.headline}</div>
                  <p className="text-xs text-slate-200 leading-relaxed">{aiReport.summary}</p>
                  <p className="text-[11px] italic text-emerald-300">"{aiReport.coachQuote}"</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              {config.tournament !== 'career_league' &&
                config.tournament !== 'career_continental_cup' &&
                config.tournament !== 'career_continental_final' &&
                config.tournament !== 'world_cup_group' &&
                config.tournament !== 'world_cup_knockout' && (
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      initMatch();
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors cursor-pointer"
                  >
                    Jogar Novamente
                  </button>
                )}
              <button
                onClick={() => {
                  soundEngine.playClick();
                  if (onMatchComplete) {
                    onMatchComplete(matchFinished);
                  } else if (onExit) {
                    onExit();
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition-colors cursor-pointer"
              >
                {config.tournament === 'world_cup_group' || config.tournament === 'world_cup_knockout'
                  ? 'Avançar na Copa'
                  : onMatchComplete
                    ? 'Avançar Carreira'
                    : 'Voltar ao Menu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
