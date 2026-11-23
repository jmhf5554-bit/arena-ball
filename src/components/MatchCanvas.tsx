import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  Flame,
  Tv,
} from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ActiveMatchConfig, ArenaSize, MatchFormat, MatchResult, Player, RocketCarConfig, ScoreboardStyle, Team, TournamentType } from '../types/game';
import { drawPlayerDisc, drawSoccerBall } from '../utils/canvasDraw';
import {
  BOOST_PALETTE,
  CHASSIS_SPECS,
  DEFAULT_ROCKET_CAR,
  drawRocketBall,
  drawTopDownCar,
} from '../utils/rocketCarStorage';
import { NarrationEmotion, soundEngine } from '../utils/audio';
import { pollGamepadInput } from '../utils/gamepad';
import { getSupabaseClient } from '../utils/supabaseClient';
import { ClubCrest } from './ClubCrest';
import { PenaltyShootoutCanvas } from './PenaltyShootoutCanvas';

interface SimDisc {
  id: string;
  teamSide: 'home' | 'away';
  isHuman: boolean;
  isHuman2?: boolean;
  isRemoteHuman?: boolean;
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
  angle: number;
  nitro: number;
  rocketCar?: RocketCarConfig;
  isBoosting?: boolean;
  flipBoostTimer?: number;
  artRole?: 'gk' | 'atk';
}

interface BoostPad {
  x: number;
  y: number;
  amount: number;
  radius: number;
  cooldown: number;
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
    vx: number;
    vy: number;
    radius: number;
    teamSide: 'home' | 'away';
    isHuman: boolean;
    isHuman2?: boolean;
    isGoalkeeper: boolean;
    label: string;
    name: string;
    kickGlow: number;
    kickAngle: number;
    angle: number;
    isBoosting?: boolean;
    rocketCar?: RocketCarConfig;
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
  onCycleScoreboardStyle?: () => void;
}

interface ArenaGeometry {
  arenaW: number;
  arenaH: number;
  pitchX: number;
  pitchY: number;
  pitchW: number;
  pitchH: number;
  goalW: number;
  goalH: number;
  goalTop: number;
  goalBot: number;
  dribbleBoost: number;
  cornerCut: number;
  surface: 'standard' | 'rocket';
}

function getArenaGeometry(
  format: MatchFormat,
  _arenaSize: ArenaSize | undefined,
  _tournament: TournamentType,
  rocketMatchMode?: '1v1' | '2v2' | 'local_2p'
): ArenaGeometry {
  const isRocket = format === 'rocket_cars';
  const is3v3 = format === '3v3';
  const isArtilheirinho = format === 'artilheirinho';
  const is2v2 = format === '2v2' || (isRocket && rocketMatchMode === '2v2');

  let arenaW = 1200;
  let arenaH = 680;
  let pitchW = 980;
  let pitchH = 500;
  let goalW = 46;
  let goalH = 166;
  let dribbleBoost = 1.0;
  let cornerCut = 0;
  let surface: ArenaGeometry['surface'] = 'standard';

  if (isRocket) {
    surface = 'rocket';
    arenaW = is2v2 ? 1360 : 1240;
    arenaH = is2v2 ? 760 : 690;
    pitchW = is2v2 ? 1140 : 1020;
    pitchH = is2v2 ? 580 : 520;
    goalW = 54;
    goalH = is2v2 ? 196 : 176;
    cornerCut = 58;
    dribbleBoost = 1.05;
  } else if (isArtilheirinho) {
    arenaW = 1280;
    arenaH = 720;
    pitchW = 1080;
    pitchH = 540;
    goalW = 48;
    goalH = 178;
  } else if (is3v3) {
    // 3v3: estádio oficial ampliado para 6 jogadores em campo
    arenaW = 1420;
    arenaH = 800;
    pitchW = 1220;
    pitchH = 620;
    goalW = 50;
    goalH = 194;
  } else if (is2v2) {
    // 2v2: campo um pouco maior para 4 jogadores
    arenaW = 1360;
    arenaH = 760;
    pitchW = 1160;
    pitchH = 590;
    goalW = 48;
    goalH = 184;
  }

  const pitchX = Math.round((arenaW - pitchW) / 2);
  const pitchY = Math.round((arenaH - pitchH) / 2);
  const goalTop = pitchY + Math.round((pitchH - goalH) / 2);
  const goalBot = goalTop + goalH;

  return {
    arenaW,
    arenaH,
    pitchX,
    pitchY,
    pitchW,
    pitchH,
    goalW,
    goalH,
    goalTop,
    goalBot,
    dribbleBoost,
    cornerCut,
    surface,
  };
}

const POST_R = 9;
const PLAYER_R = 19;
const BALL_R = 11.5;

export const MatchCanvas: React.FC<MatchCanvasProps> = ({
  config,
  isBackgroundDemo = false,
  onExit,
  onMatchComplete,
  onToggleMute,
  onToggleMobileControls,
  onToggleGamepad,
  onCycleScoreboardStyle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localScoreboardStyle, setLocalScoreboardStyle] = useState<ScoreboardStyle>(
    config.settings.scoreboardStyle || 'brasileirao_tv'
  );
  const activeScoreboardStyle: ScoreboardStyle =
    config.settings.scoreboardStyle || localScoreboardStyle;

  const geom = useMemo(
    () =>
      getArenaGeometry(
        config.settings.format,
        config.settings.arenaSize,
        config.tournament,
        config.rocketMatchMode
      ),
    [config.settings.format, config.settings.arenaSize, config.tournament, config.rocketMatchMode]
  );

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [elapsedSecDisplay, setElapsedSecDisplay] = useState(0);
  const [addedMinutes, setAddedMinutes] = useState(0);
  const [inAddedTime, setInAddedTime] = useState(false);
  const [rocketNitroDisplay, setRocketNitroDisplay] = useState(65);
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
  const [artHud, setArtHud] = useState<{
    touchesUsed: number;
    maxTouches: number;
    postHitsHome: number;
    postHitsAway: number;
    phaseLabel: string;
    notice: string | null;
  }>({
    touchesUsed: 0,
    maxTouches: 1,
    postHitsHome: 0,
    postHitsAway: 0,
    phaseLabel: 'Lançamento do Goleiro',
    notice: null,
  });

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
  const touchBoostActiveRef = useRef(false);

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
  const supabaseMatchChannelRef = useRef<RealtimeChannel | null>(null);
  const remoteGuestInputRef = useRef<{ ax: number; ay: number; kick: boolean; updatedAt: number }>({
    ax: 0,
    ay: 0,
    kick: false,
    updatedAt: 0,
  });
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null);

  const simRef = useRef<{
    discs: SimDisc[];
    boostPads: BoostPad[];
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
    humanTouches: number;
    humanShots: number;
    humanDribbles: number;
    lastDribbleAt: number;
    heldKeys: Set<string>;
    kickJustPressed: boolean;
    kick2JustPressed: boolean;
    resetJustPressed: boolean;
    artState?: {
      possessionSide: 'home' | 'away';
      phase: 'gk_launch' | 'attack_play' | 'penalty_kick';
      attackerTouchesUsed: number;
      maxAttackerTouches: number;
      lastTouchTime: number;
      postHitsHome: number;
      postHitsAway: number;
      penaltySide: 'home' | 'away' | null;
      lastTouchedRole: 'gk' | 'atk' | null;
      swapPositionsCount: number;
      noticeText: string;
      noticeTimer: number;
    };
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

  const buildBoostPads = useCallback((): BoostPad[] => {
    if (config.settings.format !== 'rocket_cars') return [];
    const midX = geom.pitchX + geom.pitchW / 2;
    return [
      { x: midX, y: geom.pitchY + 54, amount: 100, radius: 16, cooldown: 0 },
      { x: midX, y: geom.pitchY + geom.pitchH - 54, amount: 100, radius: 16, cooldown: 0 },
      { x: geom.pitchX + geom.pitchW * 0.27, y: geom.pitchY + geom.pitchH * 0.25, amount: 35, radius: 12, cooldown: 0 },
      { x: geom.pitchX + geom.pitchW * 0.27, y: geom.pitchY + geom.pitchH * 0.75, amount: 35, radius: 12, cooldown: 0 },
      { x: geom.pitchX + geom.pitchW * 0.73, y: geom.pitchY + geom.pitchH * 0.25, amount: 35, radius: 12, cooldown: 0 },
      { x: geom.pitchX + geom.pitchW * 0.73, y: geom.pitchY + geom.pitchH * 0.75, amount: 35, radius: 12, cooldown: 0 },
    ];
  }, [config.settings.format, geom]);

  const buildDiscs = useCallback((): SimDisc[] => {
    const { format } = config.settings;
    const isRocket = format === 'rocket_cars';
    const rocketMode = config.rocketMatchMode || '1v1';
    const homePlayers = config.homeTeam.players;
    const awayPlayers = config.awayTeam.players;
    const discs: SimDisc[] = [];
    const humanSide = config.humanSide || 'home';

    const cx = geom.pitchX + geom.pitchW / 2;
    const cy = geom.pitchY + geom.pitchH / 2;
    const offsetX = Math.round(geom.pitchW * 0.17);
    const offsetX2 = Math.round(geom.pitchW * 0.27);
    const is3v3 = format === '3v3';
    const is2v2Layout = format === '2v2' || (isRocket && rocketMode === '2v2');
    const spreadY = is3v3
      ? Math.round(geom.pitchH * 0.24)
      : is2v2Layout
        ? Math.round(geom.pitchH * 0.19)
        : 0;

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

    const makeDisc = (
      id: string,
      teamSide: 'home' | 'away',
      pl: Player,
      opts: {
        isHuman: boolean;
        isHuman2?: boolean;
        isRemoteHuman?: boolean;
        x: number;
        y: number;
        kickAngle: number;
        role: 'attacker' | 'support';
        rocketCar?: RocketCarConfig;
      }
    ): SimDisc => {
      const def = getPlayerDef(pl);
      const tacticMassMult = opts.isHuman && config.tacticStyle === 'retranqueiro' ? 1.08 : 1;
      return {
        id,
        teamSide,
        isHuman: opts.isHuman,
        isHuman2: opts.isHuman2,
        isRemoteHuman: opts.isRemoteHuman,
        isGoalkeeper: false,
        player: pl,
        x: opts.x,
        y: opts.y,
        vx: 0,
        vy: 0,
        radius: isRocket ? 21 : PLAYER_R,
        kickGlow: 0,
        kickAngle: opts.kickAngle,
        kickCooldown: 0,
        kickBuffer: 0,
        desiredKickPowerScale: 1,
        mass: isRocket ? 1.24 : (0.88 + (def / 100) * 0.36) * tacticMassMult,
        stamina: typeof pl.stamina === 'number' ? pl.stamina : 100,
        role: opts.role,
        angle: opts.kickAngle,
        nitro: 65,
        rocketCar: opts.rocketCar,
        isBoosting: false,
        flipBoostTimer: 0,
      };
    };

    const isLocal2P = format === 'local_2p' || (isRocket && rocketMode === 'local_2p');
    const isOnline2P = format === 'online_2p';
    const is2v2 = is2v2Layout;

    const userCar = config.rocketCar || DEFAULT_ROCKET_CAR;
    const partnerCar: RocketCarConfig = {
      chassis: 'fennec',
      primaryColor: '#0EA5E9',
      secondaryColor: '#34D399',
      decal: 'flames',
      wheels: 'neon_sport',
      boostTrail: 'cyan_plasma',
      topper: 'none',
      carName: 'PARCEIRO',
    };
    const oppCar1: RocketCarConfig = {
      chassis: 'dominus',
      primaryColor: '#EA580C',
      secondaryColor: '#FACC15',
      decal: 'bolt',
      wheels: 'gold_pro',
      boostTrail: 'fire',
      topper: 'crown',
      carName: 'RIVAL 01',
    };
    const oppCar2: RocketCarConfig = {
      chassis: 'breakout',
      primaryColor: '#E11D48',
      secondaryColor: '#FFFFFF',
      decal: 'racing_stripes',
      wheels: 'carbon',
      boostTrail: 'violet_hyper',
      topper: 'wing',
      carName: 'RIVAL 02',
    };

    if (format === 'artilheirinho') {
      const boxW = Math.round(geom.pitchW * 0.13);
      const isLocalArt = config.artilheirinhoConfig?.mode === 'local_2p';
      const swapCount = simRef.current?.artState?.swapPositionsCount || 0;
      const rotated = Boolean(config.artilheirinhoConfig?.rotateOnScore) && swapCount % 2 === 1;
      const hGkPlayer = rotated ? homePlayers[0] : homePlayers[3] || homePlayers[1] || homePlayers[0];
      const hAtkPlayer = rotated ? homePlayers[3] || homePlayers[1] || homePlayers[0] : homePlayers[0];
      const aGkPlayer = rotated ? awayPlayers[0] : awayPlayers[3] || awayPlayers[1] || awayPlayers[0];
      const aAtkPlayer = rotated ? awayPlayers[3] || awayPlayers[1] || awayPlayers[0] : awayPlayers[0];

      discs.push({
        ...makeDisc('home-gk', 'home', hGkPlayer, {
          isHuman: !isBackgroundDemo,
          isHuman2: false,
          x: geom.pitchX + Math.max(30, boxW * 0.45),
          y: cy,
          kickAngle: 0,
          role: 'support',
        }),
        isGoalkeeper: true,
        artRole: 'gk',
      });
      discs.push({
        ...makeDisc('home-atk', 'home', hAtkPlayer, {
          isHuman: false,
          isHuman2: false,
          x: cx + Math.round(geom.pitchW * 0.16),
          y: cy,
          kickAngle: 0,
          role: 'attacker',
        }),
        artRole: 'atk',
      });
      discs.push({
        ...makeDisc('away-gk', 'away', aGkPlayer, {
          isHuman: false,
          isHuman2: false,
          x: geom.pitchX + geom.pitchW - Math.max(30, boxW * 0.45),
          y: cy,
          kickAngle: Math.PI,
          role: 'support',
        }),
        isGoalkeeper: true,
        artRole: 'gk',
      });
      discs.push({
        ...makeDisc('away-atk', 'away', aAtkPlayer, {
          isHuman: false,
          isHuman2: !isBackgroundDemo && isLocalArt,
          x: cx - Math.round(geom.pitchW * 0.16),
          y: cy,
          kickAngle: Math.PI,
          role: 'attacker',
        }),
        artRole: 'atk',
      });
      return discs;
    }

    const homePl0 = homePlayers[0];
    const homeIsHuman = !isBackgroundDemo && (isLocal2P || humanSide === 'home');
    discs.push(
      makeDisc('home-0', 'home', homePl0, {
        isHuman: homeIsHuman,
        isHuman2: false,
        x: cx - offsetX,
        y: is3v3 ? cy : cy - spreadY,
        kickAngle: 0,
        role: 'attacker',
        rocketCar: isRocket ? userCar : undefined,
      })
    );

    if (is2v2 || is3v3) {
      const homePl1 = homePlayers[1] || homePl0;
      discs.push(
        makeDisc('home-1', 'home', homePl1, {
          isHuman: false,
          isHuman2: false,
          x: cx - offsetX2,
          y: is3v3 ? cy - spreadY : cy + spreadY,
          kickAngle: 0,
          role: 'support',
          rocketCar: isRocket ? partnerCar : undefined,
        })
      );
    }

    if (is3v3) {
      const homePl2 = homePlayers[2] || homePlayers[1] || homePl0;
      discs.push(
        makeDisc('home-2', 'home', homePl2, {
          isHuman: false,
          isHuman2: false,
          x: cx - offsetX2,
          y: cy + spreadY,
          kickAngle: 0,
          role: 'support',
        })
      );
    }

    if (format !== 'training_solo') {
      const awayPl0 = awayPlayers[0];
      const awayIsHuman = !isBackgroundDemo && !isLocal2P && humanSide === 'away';
      const awayIsRemoteHuman =
        !isBackgroundDemo &&
        isOnline2P &&
        config.onlineRoom?.transport !== 'ws' &&
        config.onlineRoom?.side === 'home';

      discs.push(
        makeDisc('away-0', 'away', awayPl0, {
          isHuman: awayIsHuman,
          isHuman2: !isBackgroundDemo && isLocal2P,
          isRemoteHuman: awayIsRemoteHuman,
          x: cx + offsetX,
          y: is3v3 ? cy : cy - spreadY,
          kickAngle: Math.PI,
          role: 'attacker',
          rocketCar: isRocket ? oppCar1 : undefined,
        })
      );

      if (is2v2 || is3v3) {
        const awayPl1 = awayPlayers[1] || awayPl0;
        discs.push(
          makeDisc('away-1', 'away', awayPl1, {
            isHuman: false,
            isHuman2: false,
            x: cx + offsetX2,
            y: is3v3 ? cy - spreadY : cy + spreadY,
            kickAngle: Math.PI,
            role: 'support',
            rocketCar: isRocket ? oppCar2 : undefined,
          })
        );
      }

      if (is3v3) {
        const awayPl2 = awayPlayers[2] || awayPlayers[1] || awayPl0;
        discs.push(
          makeDisc('away-2', 'away', awayPl2, {
            isHuman: false,
            isHuman2: false,
            x: cx + offsetX2,
            y: cy + spreadY,
            kickAngle: Math.PI,
            role: 'support',
          })
        );
      }
    }

    return discs;
  }, [config, geom, isBackgroundDemo]);

  const resetPositions = useCallback(
    (launchSide: 'home' | 'away' = 'home') => {
      const sim = simRef.current;
      if (!sim) return;
      const humanTeam = config.humanSide === 'away' ? config.awayTeam : config.homeTeam;
      sim.discs = buildDiscs();
      sim.boostPads = buildBoostPads();
      const isArt = config.settings.format === 'artilheirinho';
      const boxW = Math.round(geom.pitchW * 0.13);
      sim.ball = {
        x: isArt
          ? launchSide === 'home'
            ? geom.pitchX + Math.min(boxW - 18, 72)
            : geom.pitchX + geom.pitchW - Math.min(boxW - 18, 72)
          : geom.pitchX + geom.pitchW / 2,
        y: geom.pitchY + geom.pitchH / 2,
        vx: 0,
        vy: 0,
        spin: 0,
        lastTouchedSide: isArt ? launchSide : config.humanSide || 'home',
        lastTouchedName: humanTeam.players[0]?.shortName || 'Jogador',
      };
      if (isArt && sim.artState) {
        sim.artState.possessionSide = launchSide;
        sim.artState.phase = 'gk_launch';
        sim.artState.attackerTouchesUsed = 0;
        sim.artState.maxAttackerTouches = 1;
        sim.artState.penaltySide = null;
        sim.artState.lastTouchedRole = null;
      }
      setRocketNitroDisplay(65);
      replayBufferRef.current = [];
    },
    [buildBoostPads, buildDiscs, config.awayTeam, config.homeTeam, config.humanSide, config.settings.format, geom]
  );

  const initMatch = useCallback(() => {
    if (config.settings.format === 'penalty_shootout') {
      setShowPenaltyShootout(true);
      return;
    }
    setShowPenaltyShootout(false);
    const humanTeam = config.humanSide === 'away' ? config.awayTeam : config.homeTeam;
    const isArt = config.settings.format === 'artilheirinho';
    const boxW = Math.round(geom.pitchW * 0.13);
    simRef.current = {
      discs: buildDiscs(),
      boostPads: buildBoostPads(),
      ball: {
        x: isArt ? geom.pitchX + Math.min(boxW - 18, 72) : geom.pitchX + geom.pitchW / 2,
        y: geom.pitchY + geom.pitchH / 2,
        vx: 0,
        vy: 0,
        spin: 0,
        lastTouchedSide: isArt ? 'home' : config.humanSide || 'home',
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
      humanTouches: 0,
      humanShots: 0,
      humanDribbles: 0,
      lastDribbleAt: -1,
      heldKeys: new Set<string>(),
      kickJustPressed: false,
      kick2JustPressed: false,
      resetJustPressed: false,
      artState: isArt
        ? {
            possessionSide: 'home',
            phase: 'gk_launch',
            attackerTouchesUsed: 0,
            maxAttackerTouches: 1,
            lastTouchTime: -1,
            postHitsHome: 0,
            postHitsAway: 0,
            penaltySide: null,
            lastTouchedRole: null,
            swapPositionsCount: 0,
            noticeText: 'Goleiro lança para o Atacante finalizar de 1 toque!',
            noticeTimer: 3.5,
          }
        : undefined,
    };
    if (isArt) {
      setArtHud({
        touchesUsed: 0,
        maxTouches: 1,
        postHitsHome: 0,
        postHitsAway: 0,
        phaseLabel: 'Lançamento do Goleiro',
        notice: 'Goleiro lança para o Atacante finalizar de 1 toque!',
      });
    }
    replayBufferRef.current = [];
    recentCommentaryRef.current = [];
    matchSessionIdRef.current += 1;
    lastAiCallAtRef.current = 0;
    setHomeScore(0);
    setAwayScore(0);
    setElapsedSecDisplay(0);
    setAddedMinutes(0);
    setInAddedTime(false);
    setRocketNitroDisplay(65);
    setIsPaused(false);
    setGoalBanner(null);
    setReplayBanner(null);
    setMatchFinished(null);
    setAiReport(null);
    setLastShotSpeed(0);
    if (!isBackgroundDemo) {
      soundEngine.playWhistle(false);
      const isRocket = config.settings.format === 'rocket_cars';
      const kickoffs = isRocket
        ? [
            `Motores roncando na Arena Rocket! Vai começar a velocidade máxima entre ${config.homeTeam.name} e ${config.awayTeam.name}!`,
            `Nitro carregado! Carros alinhados para a disputa eletrizante de Rocket Cars!`,
          ]
        : [
            `Apita o árbitro! Coração acelerado, bola rolando para ${config.homeTeam.name} e ${config.awayTeam.name}!`,
            `Começa o espetáculo! A bola já rola entre ${config.homeTeam.name} e ${config.awayTeam.name}!`,
            `Autoriza o juiz! Vamos juntos nessa emoção de ${config.homeTeam.name} contra ${config.awayTeam.name}!`,
          ];
      announce(kickoffs[Math.floor(Math.random() * kickoffs.length)], true, 'dramatic');
    }
  }, [announce, buildBoostPads, buildDiscs, config.awayTeam, config.homeTeam, config.humanSide, config.settings.format, geom, isBackgroundDemo]);

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
          if (
            config.settings.goalLimit > 0 &&
            (sim.homeGoals >= config.settings.goalLimit || sim.awayGoals >= config.settings.goalLimit)
          ) {
            sim.finished = true;
            soundEngine.playWhistle(true);
            setMatchFinished({
              homeGoals: sim.homeGoals,
              awayGoals: sim.awayGoals,
              scorers: sim.scorers,
              winnerSide: sim.homeGoals > sim.awayGoals ? 'home' : 'away',
              tournament: config.tournament,
              careerFixtureId: config.careerFixtureId,
              worldCupMatchId: config.worldCupMatchId,
              onlineLeagueId: config.onlineLeagueId,
            });
            return;
          }
          const lastScoringSide = sim.scorers[sim.scorers.length - 1]?.teamSide;
          const nextLaunchSide: 'home' | 'away' =
            config.settings.format === 'artilheirinho' && lastScoringSide === 'home' ? 'away' : 'home';
          resetPositions(nextLaunchSide);
          soundEngine.playWhistle(false);
          return;
        }
        sim.kickJustPressed = true;
      }

      if (
        (config.settings.format === 'local_2p' ||
          (config.settings.format === 'rocket_cars' && config.rocketMatchMode === 'local_2p') ||
          (config.settings.format === 'artilheirinho' && config.artilheirinhoConfig?.mode === 'local_2p')) &&
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
        onlineLeagueId: config.onlineLeagueId,
        starterStaminaRemaining: humanDisc ? Math.round(humanDisc.stamina) : undefined,
        matchStats: {
          humanTouches: sim.humanTouches,
          humanShots: sim.humanShots,
          humanDribbles: sim.humanDribbles,
        },
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
      if (
        config.settings.format === 'online_2p' &&
        config.onlineRoom?.transport !== 'ws' &&
        config.onlineRoom?.side === 'home' &&
        supabaseMatchChannelRef.current
      ) {
        void supabaseMatchChannelRef.current.send({
          type: 'broadcast',
          event: 'match_finished',
          payload: { result },
        });
      }
      setMatchFinished(result);
    };

    const stepPhysics = (dt: number) => {
      const sim = simRef.current;
      if (!sim || sim.paused || sim.finished) return;
      if (
        config.settings.format === 'online_2p' &&
        !(config.onlineRoom?.transport !== 'ws' && config.onlineRoom?.side === 'home')
      ) {
        return;
      }

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

      const isTrainingSolo = config.settings.format === 'training_solo';
      const isRocketMode = config.settings.format === 'rocket_cars';
      const isArtilheirinho = config.settings.format === 'artilheirinho';
      const artCfg = config.artilheirinhoConfig;
      const ballR = isRocketMode ? 15 : BALL_R;

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
            const cx = geom.pitchX + geom.pitchW / 2;
            const cy = geom.pitchY + geom.pitchH / 2;
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
            if (
              config.settings.goalLimit > 0 &&
              (sim.homeGoals >= config.settings.goalLimit || sim.awayGoals >= config.settings.goalLimit)
            ) {
              finishRegulation(sim);
              return;
            }
            const lastScoringSide = sim.scorers[sim.scorers.length - 1]?.teamSide;
            const nextLaunchSide: 'home' | 'away' =
              isArtilheirinho && lastScoringSide === 'home' ? 'away' : 'home';
            resetPositions(nextLaunchSide);
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
          const lastScoringSide = sim.scorers[sim.scorers.length - 1]?.teamSide;
          const nextLaunchSide: 'home' | 'away' =
            isArtilheirinho && lastScoringSide === 'home' ? 'away' : 'home';
          resetPositions(nextLaunchSide);
          soundEngine.playWhistle(false);
        }
        return;
      }

      if (isArtilheirinho && sim.artState) {
        if (sim.artState.noticeTimer > 0) {
          sim.artState.noticeTimer = Math.max(0, sim.artState.noticeTimer - dt);
        }
        const midX = geom.pitchX + geom.pitchW / 2;
        const hGk = sim.discs.find((d) => d.id === 'home-gk');
        const hAtk = sim.discs.find((d) => d.id === 'home-atk');
        const aGk = sim.discs.find((d) => d.id === 'away-gk');
        const aAtk = sim.discs.find((d) => d.id === 'away-atk');
        const isLocalArt = artCfg?.mode === 'local_2p';

        if (!isBackgroundDemo) {
          if (sim.artState.phase === 'penalty_kick' && sim.artState.penaltySide) {
            if (sim.artState.penaltySide === 'home') {
              if (hGk) hGk.isHuman = false;
              if (hAtk) hAtk.isHuman = true;
              if (aGk) aGk.isHuman2 = isLocalArt;
              if (aAtk) aAtk.isHuman2 = false;
            } else {
              if (hGk) hGk.isHuman = true;
              if (hAtk) hAtk.isHuman = false;
              if (aGk) aGk.isHuman2 = false;
              if (aAtk) aAtk.isHuman2 = isLocalArt;
            }
          } else {
            const ballInHomeHalf = sim.ball.x < midX;
            if (hGk) hGk.isHuman = ballInHomeHalf;
            if (hAtk) hAtk.isHuman = !ballInHomeHalf;
            if (isLocalArt) {
              if (aGk) aGk.isHuman2 = !ballInHomeHalf;
              if (aAtk) aAtk.isHuman2 = ballInHomeHalf;
            } else {
              if (aGk) aGk.isHuman2 = false;
              if (aAtk) aAtk.isHuman2 = false;
            }
          }
        }
      }

      if (isRocketMode) {
        for (const pad of sim.boostPads) {
          if (pad.cooldown > 0) pad.cooldown = Math.max(0, pad.cooldown - dt);
        }
      }

      // Match Clock (2 minutes default, 1T / 2T + Added Time)
      if (!isBackgroundDemo && !isTrainingSolo) {
        sim.elapsed += dt;
        const regDuration = config.settings.durationSeconds;

        if (!sim.inAddedTime) {
          hudTimerTick += dt;
          if (hudTimerTick >= 0.2) {
            hudTimerTick = 0;
            setElapsedSecDisplay(Math.min(regDuration, Math.floor(sim.elapsed)));
            if (isRocketMode) {
              const pCar = sim.discs.find((d) => d.isHuman);
              if (pCar) setRocketNitroDisplay(Math.round(pCar.nitro));
            }
            if (isArtilheirinho && sim.artState) {
              setArtHud({
                touchesUsed: sim.artState.attackerTouchesUsed,
                maxTouches: sim.artState.maxAttackerTouches,
                postHitsHome: sim.artState.postHitsHome,
                postHitsAway: sim.artState.postHitsAway,
                phaseLabel:
                  sim.artState.phase === 'penalty_kick'
                    ? 'Cobrança de Pênalti!'
                    : sim.artState.phase === 'gk_launch'
                      ? 'Lançamento do Goleiro'
                      : 'Finalização de Atacante',
                notice: sim.artState.noticeTimer > 0 ? sim.artState.noticeText : null,
              });
            }
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
          const inHomeAttack = sim.ball.x > geom.pitchX + geom.pitchW * 0.65;
          const inAwayAttack = sim.ball.x < geom.pitchX + geom.pitchW * 0.35;
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
      const goalLeftX = geom.pitchX;
      const goalRightX = geom.pitchX + geom.pitchW;
      const goalMidY = geom.pitchY + geom.pitchH / 2;

      for (const disc of sim.discs) {
        if (disc.kickCooldown > 0) disc.kickCooldown = Math.max(0, disc.kickCooldown - dt);
        if (disc.kickGlow > 0) disc.kickGlow = Math.max(0, disc.kickGlow - dt * 4.5);
        if (disc.kickBuffer > 0) disc.kickBuffer = Math.max(0, disc.kickBuffer - dt);
        if (disc.flipBoostTimer && disc.flipBoostTimer > 0) {
          disc.flipBoostTimer = Math.max(0, disc.flipBoostTimer - dt);
        }
        disc.isBoosting = false;

        const fisStat =
          typeof disc.player.fis === 'number'
            ? disc.player.fis
            : Math.min(97, Math.round(disc.player.ovr * 0.86 + 5));
        const currentSpd = Math.hypot(disc.vx, disc.vy);
        const tacticDrain = disc.isHuman && config.tacticStyle === 'ofensivo' ? 1.15 : 1;
        const drainResistance = 1.25 - (fisStat - 60) * 0.012; // Higher FIS drains slower

        const staminaFactor = disc.stamina >= 45 ? 1 : 0.88 + ((disc.stamina - 15) / 30) * 0.12;
        const paceFactor = isRocketMode
          ? 1
          : (0.90 + ((disc.player.pace - 70) / 30) * 0.24) * staminaFactor;
        const agilityBoost = disc.isHuman || disc.isHuman2 ? geom.dribbleBoost : 1;
        const maxAccel =
          (disc.isHuman || disc.isHuman2 || disc.isRemoteHuman
            ? (isRocketMode ? 1480 : 1320 * agilityBoost)
            : (isRocketMode ? 1280 * diffProfile.accelMult : 1140 * diffProfile.accelMult)) *
          paceFactor;

        let ax = 0;
        let ay = 0;
        let wantsNitro = false;

        if (disc.isHuman) {
          disc.desiredKickPowerScale = 1;
          const k = sim.heldKeys;
          const isLocal2P =
            config.settings.format === 'local_2p' ||
            (isRocketMode && config.rocketMatchMode === 'local_2p') ||
            (isArtilheirinho && artCfg?.mode === 'local_2p');
          if (k.has('KeyW') || (!isLocal2P && k.has('ArrowUp'))) ay -= 1;
          if (k.has('KeyS') || (!isLocal2P && k.has('ArrowDown'))) ay += 1;
          if (k.has('KeyA') || (!isLocal2P && k.has('ArrowLeft'))) ax -= 1;
          if (k.has('KeyD') || (!isLocal2P && k.has('ArrowRight'))) ax += 1;
          if (isRocketMode) {
            wantsNitro =
              k.has('ShiftLeft') ||
              k.has('KeyK') ||
              (!isLocal2P && k.has('ShiftRight')) ||
              touchBoostActiveRef.current;
          }

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
          if (isRocketMode) {
            wantsNitro = k.has('ShiftRight') || k.has('KeyM') || k.has('Numpad1');
          }

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
        } else if (disc.isRemoteHuman) {
          disc.desiredKickPowerScale = 1;
          const r = remoteGuestInputRef.current;
          const stale = Date.now() - r.updatedAt > 1200;
          let rx = stale ? 0 : Number(r.ax) || 0;
          let ry = stale ? 0 : Number(r.ay) || 0;
          const mag = Math.hypot(rx, ry);
          if (mag > 1) {
            rx /= mag;
            ry /= mag;
          }
          ax = rx;
          ay = ry;
          if (!stale && r.kick && disc.kickCooldown <= 0) {
            disc.kickBuffer = 0.16;
            disc.kickGlow = 1;
            r.kick = false;
          }
        } else if (disc.isGoalkeeper) {
          disc.desiredKickPowerScale = 1;
          const isLeftGk = disc.teamSide === 'home';
          const gkHomeX = isLeftGk ? geom.pitchX + 26 : geom.pitchX + geom.pitchW - 26;
          const boxThreat = isLeftGk ? ball.x < geom.pitchX + 150 : ball.x > geom.pitchX + geom.pitchW - 150;

          if (
            isArtilheirinho &&
            sim.artState &&
            sim.artState.phase === 'gk_launch' &&
            sim.artState.possessionSide === disc.teamSide
          ) {
            // Artilheirinho CPU GK: move behind the ball and launch to open teammate away from opponent!
            const mateAtk = sim.discs.find((d) => d.teamSide === disc.teamSide && d.artRole === 'atk');
            const oppAtk = sim.discs.find((d) => d.teamSide !== disc.teamSide && d.artRole === 'atk');
            const passY = mateAtk
              ? oppAtk && Math.abs(oppAtk.y - mateAtk.y) < 75
                ? mateAtk.y < goalMidY
                  ? goalMidY + 95
                  : goalMidY - 95
                : mateAtk.y
              : goalMidY;
            const passX = mateAtk ? mateAtk.x : geom.pitchX + geom.pitchW / 2;
            const toMateLen = Math.hypot(passX - ball.x, passY - ball.y) || 1;
            const behindX = ball.x - ((passX - ball.x) / toMateLen) * (disc.radius + BALL_R - 2);
            const behindY = ball.y - ((passY - ball.y) / toMateLen) * (disc.radius + BALL_R - 2);
            const dx = behindX - disc.x;
            const dy = behindY - disc.y;
            const d = Math.hypot(dx, dy);
            if (d > 2) {
              ax = (dx / d) * diffProfile.gkSpeed;
              ay = (dy / d) * diffProfile.gkSpeed;
            }
            if (Math.hypot(ball.x - disc.x, ball.y - disc.y) <= disc.radius + BALL_R + 13 && disc.kickCooldown <= 0) {
              disc.desiredKickPowerScale = 0.85;
              disc.kickBuffer = 0.1;
              disc.kickGlow = 1;
            }
          } else {
            let targetY = ball.y;
            const movingTowardGoal = isLeftGk ? ball.vx < -40 : ball.vx > 40;
            if (movingTowardGoal) {
              const timeToLine = Math.min(0.45, Math.abs(gkHomeX - ball.x) / Math.max(80, Math.abs(ball.vx)));
              targetY = ball.y + ball.vy * timeToLine;
            }
            targetY = Math.max(geom.goalTop + 16, Math.min(geom.goalBot - 16, targetY));

            let targetX = gkHomeX;
            if (boxThreat && Math.abs(ball.y - goalMidY) < 110) {
              targetX = isLeftGk
                ? Math.min(geom.pitchX + 75, Math.max(geom.pitchX + 18, ball.x - 10))
                : Math.max(geom.pitchX + geom.pitchW - 75, Math.min(geom.pitchX + geom.pitchW - 18, ball.x + 10));
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
          }
        } else {
          const ownGoalX = disc.teamSide === 'home' ? goalLeftX : goalRightX;
          const targetGoalX = disc.teamSide === 'home' ? goalRightX : goalLeftX;
          const attackDir = disc.teamSide === 'home' ? 1 : -1;
          const oppOutfielders = sim.discs.filter((d) => d.teamSide !== disc.teamSide && !d.isGoalkeeper);
          const opponent = oppOutfielders.reduce<SimDisc | undefined>((best, cur) => {
            if (!best) return cur;
            return Math.hypot(cur.x - ball.x, cur.y - ball.y) < Math.hypot(best.x - ball.x, best.y - ball.y)
              ? cur
              : best;
          }, undefined);

          // Predict short-term ball position for Profissional / Lendário interception
          const predTime = diff === 'dificil' ? 0.16 : diff === 'medio' ? 0.08 : 0;
          const predBallX = Math.max(
            geom.pitchX + BALL_R,
            Math.min(geom.pitchX + geom.pitchW - BALL_R, ball.x + ball.vx * predTime)
          );
          const predBallY = Math.max(
            geom.pitchY + BALL_R,
            Math.min(geom.pitchY + geom.pitchH - BALL_R, ball.y + ball.vy * predTime)
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
              Math.abs(predBallX - ownGoalX) < geom.pitchW * 0.66;

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
                const wallTopY = geom.pitchY + BALL_R;
                const wallBotY = geom.pitchY + geom.pitchH - BALL_R;
                const targetCornerY = opponent.y < goalMidY ? goalMidY + 32 : goalMidY - 32;
                const candidates: { bx: number; by: number }[] = [];

                // Top wall bank shot
                const mirrorTopY = 2 * wallTopY - targetCornerY;
                if (Math.abs(mirrorTopY - ball.y) > 10) {
                  const tTop = (wallTopY - ball.y) / (mirrorTopY - ball.y);
                  if (tTop > 0.08 && tTop < 0.92) {
                    const bx = ball.x + (targetGoalX - ball.x) * tTop;
                    if (bx > geom.pitchX + 75 && bx < geom.pitchX + geom.pitchW - 75) {
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
                    if (bx > geom.pitchX + 75 && bx < geom.pitchX + geom.pitchW - 75) {
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

          const outfieldTeammates = sim.discs.filter(
            (d) => d.teamSide === disc.teamSide && !d.isGoalkeeper
          );
          const closestToBall = outfieldTeammates.reduce((best, cur) => {
            const db = Math.hypot(best.x - ball.x, best.y - ball.y);
            const dc = Math.hypot(cur.x - ball.x, cur.y - ball.y);
            return dc < db ? cur : best;
          }, outfieldTeammates[0]);
          const otherTeammates = outfieldTeammates.filter((t) => t.id !== disc.id);
          const humanPartner = otherTeammates.find((t) => t.isHuman);
          const forwardPartner = otherTeammates.reduce<SimDisc | undefined>((best, cur) => {
            const curAdv = (cur.x - disc.x) * attackDir;
            const bestAdv = best ? (best.x - disc.x) * attackDir : -9999;
            return curAdv > bestAdv ? cur : best;
          }, undefined);

          // In 2v2 / 3v3, if this AI has the ball in midfield/defense and a teammate is open ahead, pass forward!
          if (
            forwardPartner &&
            closestToBall.id === disc.id &&
            !blockGoalMode &&
            (forwardPartner.x - disc.x) * attackDir > 65 &&
            Math.abs(ball.x - targetGoalX) > 280
          ) {
            aimTargetX = forwardPartner.x + attackDir * 24;
            aimTargetY = forwardPartner.y;
            disc.desiredKickPowerScale = 0.62;
          }

          const toTargetX = aimTargetX - ball.x;
          const toTargetY = aimTargetY - ball.y;
          const toTargetLen = Math.hypot(toTargetX, toTargetY) || 1;
          const dirGoalX = toTargetX / toTargetLen;
          const dirGoalY = toTargetY / toTargetLen;

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
              geom.goalTop + 16,
              Math.min(geom.goalBot - 16, goalMidY + (rayY / rayLen) * blockDepth)
            );
          } else if (closestToBall.id === disc.id) {
            if (!isBehindBall) {
              const offsetSign =
                ball.y < geom.pitchY + 60
                  ? 1
                  : ball.y > geom.pitchY + geom.pitchH - 60
                    ? -1
                    : disc.y < ball.y
                      ? -1
                      : 1;
              desiredX = Math.max(
                geom.pitchX + 20,
                Math.min(geom.pitchX + geom.pitchW - 20, ball.x - attackDir * 44)
              );
              desiredY = Math.max(
                geom.pitchY + 24,
                Math.min(geom.pitchY + geom.pitchH - 24, ball.y + offsetSign * 44)
              );
            }
          } else if (humanPartner && outfieldTeammates.length <= 2) {
            // Smart 2v2 AI partner: offer wide forward passing lane on opposite vertical flank
            const oppFlankY =
              humanPartner.y < goalMidY
                ? Math.min(geom.pitchY + geom.pitchH - 68, goalMidY + geom.pitchH * 0.24)
                : Math.max(geom.pitchY + 68, goalMidY - geom.pitchH * 0.24);
            const partnerNearBall = Math.hypot(humanPartner.x - ball.x, humanPartner.y - ball.y) < 165;
            desiredX = partnerNearBall
              ? Math.max(
                  geom.pitchX + 75,
                  Math.min(geom.pitchX + geom.pitchW - 75, ball.x + attackDir * 145)
                )
              : (ownGoalX + ball.x) * 0.56;
            desiredY = oppFlankY;
          } else if (humanPartner && outfieldTeammates.length >= 3) {
            // Smart 3v3 AI teammates: disc-1 pushes opposite flank for passes, disc-2 anchors midfield/defense
            const isSweeper = disc.id.endsWith('2');
            const partnerNearBall = Math.hypot(humanPartner.x - ball.x, humanPartner.y - ball.y) < 175;
            if (isSweeper) {
              desiredX = (ownGoalX + ball.x) * 0.44;
              desiredY = Math.max(
                geom.pitchY + 72,
                Math.min(
                  geom.pitchY + geom.pitchH - 72,
                  goalMidY + (humanPartner.y < goalMidY ? 90 : -90)
                )
              );
            } else {
              const oppFlankY =
                humanPartner.y < goalMidY
                  ? Math.min(geom.pitchY + geom.pitchH - 68, goalMidY + geom.pitchH * 0.26)
                  : Math.max(geom.pitchY + 68, goalMidY - geom.pitchH * 0.26);
              desiredX = partnerNearBall
                ? Math.max(
                    geom.pitchX + 85,
                    Math.min(geom.pitchX + geom.pitchW - 85, ball.x + attackDir * 165)
                  )
                : (ownGoalX + ball.x) * 0.6;
              desiredY = oppFlankY;
            }
          } else {
            const laneOffset = disc.id.endsWith('1') ? -115 : disc.id.endsWith('2') ? 115 : 0;
            desiredX = (ownGoalX + ball.x) * (disc.id.endsWith('2') ? 0.42 : 0.56) - attackDir * 40;
            desiredY = Math.max(
              geom.pitchY + 60,
              Math.min(geom.pitchY + geom.pitchH - 60, goalMidY + laneOffset * 0.68 + (ball.y - goalMidY) * 0.32)
            );
          }

          const dx = desiredX - disc.x;
          const dy = desiredY - disc.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 3) {
            ax = dx / dist;
            ay = dy / dist;
          }

          if (isRocketMode && disc.nitro > 22 && dist > 90 && (isBehindBall || blockGoalMode)) {
            wantsNitro = true;
          }

          const distToBall = Math.hypot(ball.x - disc.x, ball.y - disc.y);
          const safeForwardKick =
            isBehindBall ||
            (distToBall <= disc.radius + ballR + 5 &&
              Math.abs(ball.x - ownGoalX) < 95);
          // In Lendário, also intercept/clear immediately if blocking in front of goal & ball touches
          const blockInterceptKick =
            diff === 'dificil' &&
            blockGoalMode &&
            distToBall <= disc.radius + ballR + 12 &&
            isBehindBall;

          if (
            distToBall <= disc.radius + ballR + 14 &&
            disc.kickCooldown <= 0 &&
            (safeForwardKick || blockInterceptKick)
          ) {
            disc.kickBuffer = 0.12;
            disc.kickGlow = 1;
          }
        }

        if (!isBackgroundDemo && !isRocketMode) {
          if (currentSpd > 140) {
            disc.stamina = Math.max(15, disc.stamina - dt * 0.38 * drainResistance * tacticDrain);
          } else {
            disc.stamina = Math.min(100, disc.stamina + dt * 0.22);
          }
        }

        if (isRocketMode) {
          const carSpec = CHASSIS_SPECS[disc.rocketCar?.chassis || 'octane'] || CHASSIS_SPECS.octane;
          const turnRate = 7.6 * carSpec.turnBonus;
          const boostPower = carSpec.speedBonus;
          const topSpeed = 320 * carSpec.speedBonus;
          const inputMag = Math.hypot(ax, ay);
          if (inputMag > 0.12) {
            const targetAngle = Math.atan2(ay, ax);
            let angleDiff = targetAngle - disc.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            const maxTurn = turnRate * dt;
            if (Math.abs(angleDiff) <= maxTurn) {
              disc.angle = targetAngle;
            } else {
              disc.angle += Math.sign(angleDiff) * maxTurn;
            }
          }

          // Power-Flip lunge when player presses Impulso / Espaço
          if (disc.kickBuffer > 0 && disc.kickCooldown <= 0 && Math.hypot(ball.x - disc.x, ball.y - disc.y) > disc.radius + ballR + 16) {
            const fx = inputMag > 0.12 ? ax : Math.cos(disc.angle);
            const fy = inputMag > 0.12 ? ay : Math.sin(disc.angle);
            disc.vx += fx * 270;
            disc.vy += fy * 270;
            disc.flipBoostTimer = 0.22;
            disc.kickCooldown = 0.62;
            disc.kickBuffer = 0;
            disc.kickGlow = 1;
            spawnParticles(disc.x, disc.y, 10, '#38BDF8', 0.9);
          }

          if (wantsNitro && disc.nitro > 0.5) {
            disc.isBoosting = true;
            disc.nitro = Math.max(0, disc.nitro - dt * 33);
            const boostFx = inputMag > 0.12 ? ax : Math.cos(disc.angle);
            const boostFy = inputMag > 0.12 ? ay : Math.sin(disc.angle);
            disc.vx += boostFx * maxAccel * 1.55 * boostPower * dt;
            disc.vy += boostFy * maxAccel * 1.55 * boostPower * dt;
            if (Math.random() < 0.85) {
              const boostPalette = BOOST_PALETTE[disc.rocketCar?.boostTrail || 'fire'] || BOOST_PALETTE.fire;
              const backX = disc.x - Math.cos(disc.angle) * (disc.radius + 4);
              const backY = disc.y - Math.sin(disc.angle) * (disc.radius + 4);
              sim.particles.push({
                x: backX + (Math.random() - 0.5) * 6,
                y: backY + (Math.random() - 0.5) * 6,
                vx: -Math.cos(disc.angle) * 180 + (Math.random() - 0.5) * 40,
                vy: -Math.sin(disc.angle) * 180 + (Math.random() - 0.5) * 40,
                life: 0.24,
                maxLife: 0.24,
                size: 3.5 + Math.random() * 3,
                color: Math.random() < 0.5 ? boostPalette.outer : boostPalette.inner,
              });
            }
          } else {
            disc.nitro = Math.min(100, disc.nitro + dt * 4.2);
          }

          disc.vx += ax * maxAccel * dt;
          disc.vy += ay * maxAccel * dt;
          const carDamping = Math.pow(0.03, dt);
          disc.vx *= carDamping;
          disc.vy *= carDamping;

          const baseCarSpeed =
            disc.isHuman || disc.isHuman2 || disc.isRemoteHuman
              ? topSpeed
              : topSpeed * (0.8 + diffProfile.speedMult * 0.2);
          const effectiveTop =
            baseCarSpeed * (disc.isBoosting ? 1.52 * boostPower : 1) * (disc.flipBoostTimer && disc.flipBoostTimer > 0 ? 1.25 : 1);
          const spd = Math.hypot(disc.vx, disc.vy);
          if (spd > effectiveTop) {
            disc.vx = (disc.vx / spd) * effectiveTop;
            disc.vy = (disc.vy / spd) * effectiveTop;
          }

          // Collect boost pads
          for (const pad of sim.boostPads) {
            if (pad.cooldown <= 0 && Math.hypot(disc.x - pad.x, disc.y - pad.y) <= disc.radius + pad.radius + 4) {
              disc.nitro = Math.min(100, disc.nitro + pad.amount);
              pad.cooldown = pad.amount >= 100 ? 7.5 : 4.5;
              spawnParticles(pad.x, pad.y, 12, '#FB923C', 1.1);
            }
          }
        } else {
          disc.vx += ax * maxAccel * dt;
          disc.vy += ay * maxAccel * dt;
          const damping = Math.pow(0.015, dt);
          disc.vx *= damping;
          disc.vy *= damping;

          const baseMaxSpeed =
            disc.isHuman || disc.isHuman2 || disc.isRemoteHuman
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
        }

        disc.x += disc.vx * dt;
        disc.y += disc.vy * dt;
        disc.kickAngle = isRocketMode ? disc.angle : Math.atan2(ball.y - disc.y, ball.x - disc.x);

        const minX = geom.pitchX - 38 + disc.radius;
        const maxX = geom.pitchX + geom.pitchW + 38 - disc.radius;
        const minY = geom.pitchY - 38 + disc.radius;
        const maxY = geom.pitchY + geom.pitchH + 38 - disc.radius;
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

        // Artilheirinho Strict Zone Rules:
        // - Goalkeeper stays strictly inside their own penalty box
        // - Attacker stays strictly in the attacking half (never crossing midfield) and outside opponent penalty box
        if (isArtilheirinho && disc.artRole) {
          const midX = geom.pitchX + geom.pitchW / 2;
          const midY = geom.pitchY + geom.pitchH / 2;
          const boxW = Math.round(geom.pitchW * 0.13);
          const boxH = Math.round(geom.pitchH * 0.54);
          const boxTop = midY - boxH / 2;
          const boxBot = midY + boxH / 2;

          if (disc.artRole === 'gk') {
            const gkMinX =
              disc.teamSide === 'home'
                ? geom.pitchX + disc.radius
                : geom.pitchX + geom.pitchW - boxW + disc.radius;
            const gkMaxX =
              disc.teamSide === 'home'
                ? geom.pitchX + boxW - disc.radius
                : geom.pitchX + geom.pitchW - disc.radius;
            const gkMinY = boxTop + disc.radius;
            const gkMaxY = boxBot - disc.radius;
            if (disc.x < gkMinX) {
              disc.x = gkMinX;
              disc.vx = Math.max(0, disc.vx);
            }
            if (disc.x > gkMaxX) {
              disc.x = gkMaxX;
              disc.vx = Math.min(0, disc.vx);
            }
            if (disc.y < gkMinY) {
              disc.y = gkMinY;
              disc.vy = Math.max(0, disc.vy);
            }
            if (disc.y > gkMaxY) {
              disc.y = gkMaxY;
              disc.vy = Math.min(0, disc.vy);
            }
          } else {
            // Attacker cannot cross back past midfield
            if (disc.teamSide === 'home') {
              const minAtkX = midX + disc.radius;
              if (disc.x < minAtkX) {
                disc.x = minAtkX;
                disc.vx = Math.max(0, disc.vx);
              }
              const isPenaltyForHome =
                sim.artState?.phase === 'penalty_kick' && sim.artState?.penaltySide === 'home';
              if (!isPenaltyForHome) {
                const oppBoxLeft = geom.pitchX + geom.pitchW - boxW - disc.radius;
                if (
                  disc.x > oppBoxLeft &&
                  disc.y > boxTop - disc.radius &&
                  disc.y < boxBot + disc.radius
                ) {
                  const penLeft = disc.x - oppBoxLeft;
                  const penTop = disc.y - (boxTop - disc.radius);
                  const penBot = boxBot + disc.radius - disc.y;
                  if (penLeft <= penTop && penLeft <= penBot) {
                    disc.x = oppBoxLeft;
                    disc.vx = Math.min(0, disc.vx);
                  } else if (penTop <= penBot) {
                    disc.y = boxTop - disc.radius;
                    disc.vy = Math.min(0, disc.vy);
                  } else {
                    disc.y = boxBot + disc.radius;
                    disc.vy = Math.max(0, disc.vy);
                  }
                }
              }
            } else {
              const maxAtkX = midX - disc.radius;
              if (disc.x > maxAtkX) {
                disc.x = maxAtkX;
                disc.vx = Math.min(0, disc.vx);
              }
              const isPenaltyForAway =
                sim.artState?.phase === 'penalty_kick' && sim.artState?.penaltySide === 'away';
              if (!isPenaltyForAway) {
                const oppBoxRight = geom.pitchX + boxW + disc.radius;
                if (
                  disc.x < oppBoxRight &&
                  disc.y > boxTop - disc.radius &&
                  disc.y < boxBot + disc.radius
                ) {
                  const penRight = oppBoxRight - disc.x;
                  const penTop = disc.y - (boxTop - disc.radius);
                  const penBot = boxBot + disc.radius - disc.y;
                  if (penRight <= penTop && penRight <= penBot) {
                    disc.x = oppBoxRight;
                    disc.vx = Math.max(0, disc.vx);
                  } else if (penTop <= penBot) {
                    disc.y = boxTop - disc.radius;
                    disc.vy = Math.min(0, disc.vy);
                  } else {
                    disc.y = boxBot + disc.radius;
                    disc.vy = Math.max(0, disc.vy);
                  }
                }
              }
            }
          }
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
      const ballFriction = Math.pow(isRocketMode ? 0.56 : 0.45, dt);
      ball.vx *= ballFriction;
      ball.vy *= ballFriction;
      ball.spin += (Math.hypot(ball.vx, ball.vy) * dt) / ballR;

      const ballSpd = Math.hypot(ball.vx, ball.vy);
      if (ballSpd > 310 && Math.random() < 0.72) {
        const trailCol = isRocketMode
          ? ball.lastTouchedSide === 'home'
            ? '#38BDF8'
            : '#FB923C'
          : ball.lastTouchedSide === 'home'
            ? config.homeTeam.kit.trailColor
            : config.awayTeam.kit.trailColor;
        sim.particles.push({
          x: ball.x + (Math.random() - 0.5) * 6,
          y: ball.y + (Math.random() - 0.5) * 6,
          vx: -ball.vx * 0.08,
          vy: -ball.vy * 0.08,
          life: 0.25,
          maxLife: 0.35,
          size: isRocketMode ? 5 : 4,
          color: trailCol,
        });
      }

      // Disc-to-ball collisions + Direct Kick
      for (const disc of sim.discs) {
        const dx = ball.x - disc.x;
        const dy = ball.y - disc.y;
        const dist = Math.hypot(dx, dy);
        const touchDist = disc.radius + ballR;

        if (dist < touchDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = touchDist - dist;
          ball.x += nx * overlap;
          ball.y += ny * overlap;

          const rvx = ball.vx - disc.vx;
          const rvy = ball.vy - disc.vy;
          const relNormal = rvx * nx + rvy * ny;
          const closeDribble = disc.isHuman && geom.dribbleBoost > 1;
          if (relNormal < 0) {
            const bounce = isRocketMode
              ? disc.isBoosting
                ? 0.92
                : 0.78
              : disc.isGoalkeeper
                ? 0.78
                : closeDribble
                  ? 0.36
                  : 0.65;
            const carryMult = isRocketMode ? 0.52 : closeDribble ? 0.45 : 0.32;
            ball.vx -= (1 + bounce) * relNormal * nx;
            ball.vy -= (1 + bounce) * relNormal * ny;
            ball.vx += disc.vx * carryMult;
            ball.vy += disc.vy * carryMult;
          }
          if (disc.isHuman) {
            sim.humanTouches += 1;
            if (sim.elapsed - sim.lastDribbleAt > 0.35) {
              sim.humanDribbles += 1;
              sim.lastDribbleAt = sim.elapsed;
            }
          }
          ball.lastTouchedSide = disc.teamSide;
          ball.lastTouchedName = isRocketMode && disc.rocketCar ? disc.rocketCar.carName : disc.player.shortName;

          if (isArtilheirinho && sim.artState && disc.artRole) {
            const art = sim.artState;
            art.lastTouchedRole = disc.artRole;
            if (disc.artRole === 'gk') {
              if (art.possessionSide !== disc.teamSide) {
                art.possessionSide = disc.teamSide;
                art.phase = 'gk_launch';
                art.attackerTouchesUsed = 0;
                art.maxAttackerTouches = 1;
              }
            } else if (sim.elapsed - art.lastTouchTime > 0.22) {
              art.lastTouchTime = sim.elapsed;
              if (art.possessionSide !== disc.teamSide) {
                art.possessionSide = disc.teamSide;
                art.phase = 'attack_play';
                if (artCfg?.counterAttackOnIntercept) {
                  art.attackerTouchesUsed = 1;
                  art.maxAttackerTouches = artCfg.extraTouchOnReboundOrIntercept ? 2 : 1;
                  art.noticeText = 'INTERCEPTAÇÃO! Contra-ataque direto!';
                  art.noticeTimer = 2.4;
                } else {
                  art.attackerTouchesUsed = 1;
                  art.maxAttackerTouches = artCfg?.extraTouchOnReboundOrIntercept ? 2 : 1;
                  art.noticeText = 'INTERCEPTAÇÃO! Finalize!';
                  art.noticeTimer = 2.4;
                }
              } else {
                art.phase = 'attack_play';
                art.attackerTouchesUsed += 1;
                if (art.attackerTouchesUsed > art.maxAttackerTouches) {
                  const nextSide: 'home' | 'away' = disc.teamSide === 'home' ? 'away' : 'home';
                  art.noticeText = `Passou de ${art.maxAttackerTouches} toque! Bola do goleiro adversário.`;
                  art.noticeTimer = 2.6;
                  if (!isBackgroundDemo) {
                    soundEngine.playWhistle(false);
                    announce('Passou do limite de toque! Posse devolvida para o goleiro adversário.', true);
                  }
                  resetPositions(nextSide);
                  break;
                }
              }
            }
          }
        }

        const kdx = ball.x - disc.x;
        const kdy = ball.y - disc.y;
        const kdist = Math.hypot(kdx, kdy);
        const kickReach = disc.radius + ballR + 15;
        if (disc.kickBuffer > 0 && disc.kickCooldown <= 0 && kdist <= kickReach && kdist > 0.001) {
          const nx = kdx / kdist;
          const ny = kdy / kdist;
          const shotFactor = isRocketMode ? 1.12 : 0.9 + ((disc.player.shot - 70) / 30) * 0.26;
          const tacticShotMult = disc.isHuman && config.tacticStyle === 'ofensivo' ? 1.05 : 1;
          const powerScale = disc.isHuman ? 1 : disc.desiredKickPowerScale;
          const kickPower =
            (disc.isHuman ? (isRocketMode ? 690 : 625) : (isRocketMode ? 640 : 590) * (0.85 + diffProfile.speedMult * 0.15)) *
            shotFactor *
            tacticShotMult *
            powerScale;

          ball.vx = nx * kickPower + disc.vx * (isRocketMode ? 0.4 : 0.28);
          ball.vy = ny * kickPower + disc.vy * (isRocketMode ? 0.4 : 0.28);

          if (disc.isHuman) {
            sim.humanShots += 1;
          }
          ball.lastTouchedSide = disc.teamSide;
          ball.lastTouchedName = isRocketMode && disc.rocketCar ? disc.rocketCar.carName : disc.player.shortName;

          if (isArtilheirinho && sim.artState && disc.artRole) {
            const art = sim.artState;
            art.lastTouchedRole = disc.artRole;
            if (disc.artRole === 'gk') {
              art.possessionSide = disc.teamSide;
              art.phase = 'attack_play';
              art.attackerTouchesUsed = 0;
              art.maxAttackerTouches = 1;
              art.noticeText = 'Lançamento do goleiro! 1 toque para finalizar!';
              art.noticeTimer = 2.0;
            } else if (sim.elapsed - art.lastTouchTime > 0.22) {
              art.lastTouchTime = sim.elapsed;
              if (art.possessionSide !== disc.teamSide) {
                art.possessionSide = disc.teamSide;
                art.phase = 'attack_play';
                art.attackerTouchesUsed = 1;
                art.maxAttackerTouches = artCfg?.extraTouchOnReboundOrIntercept ? 2 : 1;
                art.noticeText = artCfg?.counterAttackOnIntercept
                  ? 'Contra-ataque direto na interceptação!'
                  : 'Interceptou! Chute de 1 toque!';
                art.noticeTimer = 2.2;
              } else {
                art.phase = 'attack_play';
                art.attackerTouchesUsed += 1;
              }
            }
          }

          disc.kickCooldown = disc.isHuman
            ? 0.2
            : powerScale < 0.55
              ? 0.24
              : Math.max(0.22, diffProfile.kickInterval);
          disc.kickBuffer = 0;
          disc.kickGlow = 1;

          const trailCol = isRocketMode
            ? disc.teamSide === 'home'
              ? '#38BDF8'
              : '#FB923C'
            : disc.teamSide === 'home'
              ? config.homeTeam.kit.trailColor
              : config.awayTeam.kit.trailColor;
          spawnParticles(ball.x, ball.y, 10, trailCol, 1.15);

          if (!isBackgroundDemo) {
            soundEngine.playKick(shotFactor, false);
            sim.hitstopTimer = 0.025;
            sim.shakeTime = 0.1;
            sim.shakeIntensity = isRocketMode ? 4.8 : 3.5;
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
        { x: geom.pitchX, y: geom.goalTop },
        { x: geom.pitchX, y: geom.goalBot },
        { x: geom.pitchX + geom.pitchW, y: geom.goalTop },
        { x: geom.pitchX + geom.pitchW, y: geom.goalBot },
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
            if (isArtilheirinho && sim.artState) {
              const art = sim.artState;
              const shooterSide = ball.lastTouchedSide;
              if (artCfg?.extraTouchOnReboundOrIntercept) {
                art.maxAttackerTouches = Math.min(2, art.maxAttackerTouches + 1);
                art.noticeText = 'NA TRAVE! +1 toque extra liberado no rebote!';
                art.noticeTimer = 2.6;
              }
              if (artCfg && artCfg.penaltyOnPostHits > 0) {
                if (shooterSide === 'home') art.postHitsHome += 1;
                else art.postHitsAway += 1;
                const hitCount = shooterSide === 'home' ? art.postHitsHome : art.postHitsAway;
                if (hitCount >= artCfg.penaltyOnPostHits) {
                  if (shooterSide === 'home') art.postHitsHome = 0;
                  else art.postHitsAway = 0;
                  art.phase = 'penalty_kick';
                  art.penaltySide = shooterSide;
                  art.possessionSide = shooterSide;
                  art.attackerTouchesUsed = 0;
                  art.maxAttackerTouches = 1;
                  art.noticeText = `${artCfg.penaltyOnPostHits} TRAVES! Pênalti direto no Artilheirinho!`;
                  art.noticeTimer = 3.2;

                  const penDist = Math.round(geom.pitchW * 0.095);
                  const penX = shooterSide === 'home' ? geom.pitchX + geom.pitchW - penDist : geom.pitchX + penDist;
                  const penY = geom.pitchY + geom.pitchH / 2;
                  ball.x = penX;
                  ball.y = penY;
                  ball.vx = 0;
                  ball.vy = 0;

                  const taker = sim.discs.find((d) => d.teamSide === shooterSide && d.artRole === 'atk');
                  const keeper = sim.discs.find((d) => d.teamSide !== shooterSide && d.artRole === 'gk');
                  if (taker) {
                    taker.x = shooterSide === 'home' ? penX - 36 : penX + 36;
                    taker.y = penY;
                    taker.vx = 0;
                    taker.vy = 0;
                  }
                  if (keeper) {
                    keeper.x = shooterSide === 'home' ? geom.pitchX + geom.pitchW - 22 : geom.pitchX + 22;
                    keeper.y = penY;
                    keeper.vx = 0;
                    keeper.vy = 0;
                  }
                  if (!isBackgroundDemo) {
                    soundEngine.playWhistle(false);
                    announce(`Bateu ${artCfg.penaltyOnPostHits} vezes na trave! É pênalti direto no Artilheirinho!`, true, 'dramatic');
                  }
                }
              }
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
              vx: d.vx,
              vy: d.vy,
              radius: d.radius,
              teamSide: d.teamSide,
              isHuman: d.isHuman,
              isHuman2: d.isHuman2,
              isGoalkeeper: d.isGoalkeeper,
              label:
                t.kit.displayMode === 'initial'
                  ? d.player.shortName.charAt(0).toUpperCase()
                  : String(d.player.number),
              name: isRocketMode && d.rocketCar
                ? d.rocketCar.carName
                : d.isHuman
                  ? `VOCÊ · ${d.player.shortName}`
                  : d.isGoalkeeper
                    ? `GL · ${t.shortCode}`
                    : d.player.shortName,
              kickGlow: d.kickGlow,
              kickAngle: d.kickAngle,
              angle: d.angle,
              isBoosting: d.isBoosting,
              rocketCar: d.rocketCar,
            };
          }),
          ballX: ball.x,
          ballY: ball.y,
          ballSpin: ball.spin,
        });
        if (buf.length > 200) buf.shift();
      }

      // Chamfered diagonal corners in Rocket Arena so the ball rolls around corners!
      if (geom.cornerCut > 0) {
        const cut = geom.cornerCut;
        const corners: { cx: number; cy: number; nx: number; ny: number }[] = [
          { cx: geom.pitchX, cy: geom.pitchY + cut, nx: Math.SQRT1_2, ny: Math.SQRT1_2 },
          { cx: geom.pitchX + geom.pitchW - cut, cy: geom.pitchY, nx: -Math.SQRT1_2, ny: Math.SQRT1_2 },
          { cx: geom.pitchX + geom.pitchW, cy: geom.pitchY + geom.pitchH - cut, nx: -Math.SQRT1_2, ny: -Math.SQRT1_2 },
          { cx: geom.pitchX + cut, cy: geom.pitchY + geom.pitchH, nx: Math.SQRT1_2, ny: -Math.SQRT1_2 },
        ];
        for (const c of corners) {
          const distSigned = (ball.x - c.cx) * c.nx + (ball.y - c.cy) * c.ny;
          if (distSigned < ballR) {
            ball.x += c.nx * (ballR - distSigned);
            ball.y += c.ny * (ballR - distSigned);
            const vn = ball.vx * c.nx + ball.vy * c.ny;
            if (vn < 0) {
              ball.vx -= 1.85 * vn * c.nx;
              ball.vy -= 1.85 * vn * c.ny;
              if (!isBackgroundDemo && Math.abs(vn) > 70) soundEngine.playWallBounce(0.6);
            }
          }
        }
      }

      const inGoalMouthY = ball.y > geom.goalTop + ballR * 0.35 && ball.y < geom.goalBot - ballR * 0.35;

      if (ball.y - ballR < geom.pitchY) {
        ball.y = geom.pitchY + ballR;
        ball.vy = Math.abs(ball.vy) * 0.84;
        if (!isBackgroundDemo && Math.abs(ball.vy) > 60) soundEngine.playWallBounce(0.6);
      } else if (ball.y + ballR > geom.pitchY + geom.pitchH) {
        ball.y = geom.pitchY + geom.pitchH - ballR;
        ball.vy = -Math.abs(ball.vy) * 0.84;
        if (!isBackgroundDemo && Math.abs(ball.vy) > 60) soundEngine.playWallBounce(0.6);
      }

      if (!inGoalMouthY) {
        if (ball.x - ballR < geom.pitchX) {
          ball.x = geom.pitchX + ballR;
          ball.vx = Math.abs(ball.vx) * 0.84;
          if (!isBackgroundDemo && Math.abs(ball.vx) > 60) soundEngine.playWallBounce(0.6);
        } else if (ball.x + ballR > geom.pitchX + geom.pitchW) {
          ball.x = geom.pitchX + geom.pitchW - ballR;
          ball.vx = -Math.abs(ball.vx) * 0.84;
          if (!isBackgroundDemo && Math.abs(ball.vx) > 60) soundEngine.playWallBounce(0.6);
        }
      } else {
        const triggerGoal = (scoringSide: 'home' | 'away') => {
          if (
            isArtilheirinho &&
            artCfg &&
            !artCfg.allowGoalkeeperGoal &&
            ball.lastTouchedSide === scoringSide &&
            sim.artState?.lastTouchedRole === 'gk'
          ) {
            const nextLaunchSide: 'home' | 'away' = scoringSide === 'home' ? 'away' : 'home';
            if (sim.artState) {
              sim.artState.noticeText = 'Gol direto de goleiro não vale nesta regra!';
              sim.artState.noticeTimer = 2.8;
            }
            if (!isBackgroundDemo) {
              soundEngine.playWhistle(false);
              announce('Gol direto de goleiro não vale nesta regra! Bola devolvida para o goleiro.', true);
            }
            resetPositions(nextLaunchSide);
            return;
          }

          if (isArtilheirinho && sim.artState && artCfg?.rotateOnScore) {
            sim.artState.swapPositionsCount += 1;
            sim.artState.noticeText = 'Gol! Rotação Goleiro ↔ Atacante ativada!';
            sim.artState.noticeTimer = 2.5;
          }

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

          const goalX = scoringSide === 'home' ? geom.pitchX + geom.pitchW : geom.pitchX;
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

          if (
            config.settings.format === 'online_2p' &&
            config.onlineRoom?.transport !== 'ws' &&
            config.onlineRoom?.side === 'home' &&
            supabaseMatchChannelRef.current
          ) {
            void supabaseMatchChannelRef.current.send({
              type: 'broadcast',
              event: 'goal',
              payload: { scoringSide, scorer },
            });
          }
        };

        if (ball.x + BALL_R * 0.3 < geom.pitchX) {
          triggerGoal('away');
        } else if (ball.x - BALL_R * 0.3 > geom.pitchX + geom.pitchW) {
          triggerGoal('home');
        }

        if (ball.x - BALL_R < geom.pitchX - geom.goalW) {
          ball.x = geom.pitchX - geom.goalW + BALL_R;
          ball.vx *= -0.35;
        }
        if (ball.x + BALL_R > geom.pitchX + geom.pitchW + geom.goalW) {
          ball.x = geom.pitchX + geom.pitchW + geom.goalW - BALL_R;
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

      const {
        arenaW,
        arenaH,
        pitchX,
        pitchY,
        pitchW,
        pitchH,
        goalW,
        goalH,
        goalTop,
        goalBot,
        surface,
      } = geom;

      const dpr = window.devicePixelRatio || 1;
      const targetW = arenaW * dpr;
      const targetH = arenaH * dpr;
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
      const isRocketArena = surface === 'rocket';
      const ballRenderR = isRocketArena ? 15 : BALL_R;

      // Outer backdrop
      if (isRocketArena) {
        const bgGrad = ctx.createRadialGradient(arenaW / 2, arenaH / 2, 100, arenaW / 2, arenaH / 2, arenaW * 0.72);
        bgGrad.addColorStop(0, '#0B1738');
        bgGrad.addColorStop(1, '#040814');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, arenaW, arenaH);
      } else {
        ctx.fillStyle = isLib ? '#153620' : isSul ? '#113034' : '#184225';
        ctx.fillRect(0, 0, arenaW, arenaH);
      }

      if (!isRocketArena) {
        // Customized Team Perimeter Boards
        ctx.save();
        ctx.fillStyle = config.homeTeam.kit.primaryColor;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(pitchX, pitchY - 16, pitchW / 2, 7);
        ctx.fillRect(pitchX, pitchY + pitchH + 9, pitchW / 2, 7);
        ctx.fillStyle = config.homeTeam.kit.secondaryColor;
        ctx.fillRect(pitchX, pitchY - 9, pitchW / 2, 3);
        ctx.fillRect(pitchX, pitchY + pitchH + 6, pitchW / 2, 3);

        ctx.fillStyle = config.awayTeam.kit.primaryColor;
        ctx.fillRect(pitchX + pitchW / 2, pitchY - 16, pitchW / 2, 7);
        ctx.fillRect(pitchX + pitchW / 2, pitchY + pitchH + 9, pitchW / 2, 7);
        ctx.fillStyle = config.awayTeam.kit.secondaryColor;
        ctx.fillRect(pitchX + pitchW / 2, pitchY - 9, pitchW / 2, 3);
        ctx.fillRect(pitchX + pitchW / 2, pitchY + pitchH + 6, pitchW / 2, 3);

        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 12px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(config.homeTeam.name.toUpperCase(), pitchX + 8, pitchY - 22);
        ctx.textAlign = 'right';
        ctx.fillText(config.awayTeam.name.toUpperCase(), pitchX + pitchW - 8, pitchY - 22);
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(pitchX, pitchY - 14, pitchW / 2, 5);
        ctx.fillRect(pitchX, pitchY + pitchH + 9, pitchW / 2, 5);
        ctx.fillStyle = '#FB923C';
        ctx.fillRect(pitchX + pitchW / 2, pitchY - 14, pitchW / 2, 5);
        ctx.fillRect(pitchX + pitchW / 2, pitchY + pitchH + 9, pitchW / 2, 5);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
        ctx.font = '800 13px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ROCKET ARENA · BOOST & IMPULSO ATIVOS', arenaW / 2, pitchY - 22);
        ctx.restore();
      }

      // Playing Surface
      if (isRocketArena) {
        const cut = geom.cornerCut;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pitchX + cut, pitchY);
        ctx.lineTo(pitchX + pitchW - cut, pitchY);
        ctx.lineTo(pitchX + pitchW, pitchY + cut);
        ctx.lineTo(pitchX + pitchW, pitchY + pitchH - cut);
        ctx.lineTo(pitchX + pitchW - cut, pitchY + pitchH);
        ctx.lineTo(pitchX + cut, pitchY + pitchH);
        ctx.lineTo(pitchX, pitchY + pitchH - cut);
        ctx.lineTo(pitchX, pitchY + cut);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = '#0A1736';
        ctx.fillRect(pitchX, pitchY, pitchW, pitchH);

        // Futuristic cyber grid
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
        ctx.lineWidth = 1;
        for (let gx = pitchX; gx <= pitchX + pitchW; gx += 46) {
          ctx.beginPath();
          ctx.moveTo(gx, pitchY);
          ctx.lineTo(gx, pitchY + pitchH);
          ctx.stroke();
        }
        for (let gy = pitchY; gy <= pitchY + pitchH; gy += 46) {
          ctx.beginPath();
          ctx.moveTo(pitchX, gy);
          ctx.lineTo(pitchX + pitchW, gy);
          ctx.stroke();
        }

        // Subtle left-cyan / right-orange side glow
        const leftGlow = ctx.createLinearGradient(pitchX, 0, pitchX + pitchW * 0.4, 0);
        leftGlow.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
        leftGlow.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = leftGlow;
        ctx.fillRect(pitchX, pitchY, pitchW * 0.4, pitchH);

        const rightGlow = ctx.createLinearGradient(pitchX + pitchW, 0, pitchX + pitchW * 0.6, 0);
        rightGlow.addColorStop(0, 'rgba(249, 115, 22, 0.16)');
        rightGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = rightGlow;
        ctx.fillRect(pitchX + pitchW * 0.6, pitchY, pitchW * 0.4, pitchH);

        ctx.restore();
      } else {
        const stripeCount = 10;
        const stripeW = pitchW / stripeCount;
        for (let i = 0; i < stripeCount; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#2E8037' : '#266E2E';
          ctx.fillRect(pitchX + i * stripeW, pitchY, stripeW + 0.5, pitchH);
        }

        ctx.save();
        ctx.globalAlpha = 0.045;
        ctx.fillStyle = '#FFFFFF';
        for (let r = 0; r < 6; r += 2) {
          ctx.fillRect(pitchX, pitchY + r * (pitchH / 6), pitchW, pitchH / 6);
        }
        ctx.restore();

        drawPitchWatermark(ctx, config.homeTeam, pitchX + pitchW * 0.25, pitchY + pitchH * 0.5);
        if (config.settings.format !== 'training_solo') {
          drawPitchWatermark(ctx, config.awayTeam, pitchX + pitchW * 0.75, pitchY + pitchH * 0.5);
        }
      }

      // Label abaixo do campo
      if (
        isLib ||
        isSul ||
        config.tournament === 'career_continental_cup' ||
        config.tournament === 'tournament_cup'
      ) {
        ctx.save();
        ctx.fillStyle = isSul ? 'rgba(56, 189, 248, 0.28)' : 'rgba(250, 204, 21, 0.28)';
        ctx.font = '800 22px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(config.tournamentLabel.toUpperCase(), arenaW / 2, pitchY + pitchH + 46);
        ctx.restore();
      }

      const drawGoalNet = (gx: number, color: string, ripple: number, isLeft: boolean) => {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const wobble = Math.sin(ripple * 24) * ripple * 4;
        ctx.fillStyle = isRocketArena ? (isLeft ? '#0EA5E9' : '#F97316') : 'rgba(15, 23, 42, 0.36)';
        ctx.globalAlpha = isRocketArena ? 0.32 : 0.72;
        ctx.fillRect(gx + (isLeft ? wobble : 0), goalTop, goalW, goalH);

        // Crisscross pixel net mesh
        ctx.globalAlpha = isRocketArena ? 0.32 : 0.42;
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.4;
        for (let ny = goalTop + 10; ny < goalBot; ny += 12) {
          ctx.beginPath();
          ctx.moveTo(gx, ny);
          ctx.lineTo(gx + goalW, ny);
          ctx.stroke();
        }
        for (let nx = gx + 10; nx < gx + goalW; nx += 10) {
          ctx.beginPath();
          ctx.moveTo(nx, goalTop);
          ctx.lineTo(nx, goalBot);
          ctx.stroke();
        }

        // Team-colored outer net support strip
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = isRocketArena ? (isLeft ? '#0EA5E9' : '#F97316') : color;
        ctx.fillRect(isLeft ? gx : gx + goalW - 5, goalTop, 5, goalH);

        ctx.globalAlpha = 0.96;
        ctx.strokeStyle = isRocketArena ? (isLeft ? '#38BDF8' : '#FB923C') : '#F8FAFC';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(gx, goalTop, goalW, goalH);
        ctx.restore();
      };

      drawGoalNet(pitchX - goalW, config.homeTeam.kit.primaryColor, sim.netRippleLeft, true);
      drawGoalNet(pitchX + pitchW, config.awayTeam.kit.primaryColor, sim.netRippleRight, false);

      if (isRocketArena) {
        const cut = geom.cornerCut;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(pitchX + cut, pitchY);
        ctx.lineTo(pitchX + pitchW - cut, pitchY);
        ctx.lineTo(pitchX + pitchW, pitchY + cut);
        ctx.lineTo(pitchX + pitchW, pitchY + pitchH - cut);
        ctx.lineTo(pitchX + pitchW - cut, pitchY + pitchH);
        ctx.lineTo(pitchX + cut, pitchY + pitchH);
        ctx.lineTo(pitchX, pitchY + pitchH - cut);
        ctx.lineTo(pitchX, pitchY + cut);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
        ctx.lineWidth = 3;
        ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);
      }

      const midX = pitchX + pitchW / 2;
      const midY = pitchY + pitchH / 2;
      ctx.beginPath();
      ctx.moveTo(midX, pitchY);
      ctx.lineTo(midX, pitchY + pitchH);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(midX, midY, Math.min(78, pitchH * 0.16), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(midX, midY, 5, 0, Math.PI * 2);
      ctx.fillStyle = isRocketArena ? '#38BDF8' : '#FFFFFF';
      ctx.fill();

      const boxW = Math.round(pitchW * 0.13);
      const boxH = Math.round(pitchH * 0.54);
      const smallW = Math.round(pitchW * 0.055);
      const smallH = Math.round(pitchH * 0.35);

      ctx.strokeRect(pitchX, midY - boxH / 2, boxW, boxH);
      ctx.strokeRect(pitchX + pitchW - boxW, midY - boxH / 2, boxW, boxH);
      ctx.strokeRect(pitchX, midY - smallH / 2, smallW, smallH);
      ctx.strokeRect(pitchX + pitchW - smallW, midY - smallH / 2, smallW, smallH);

      const penDist = Math.round(pitchW * 0.095);
      if (isRocketArena) {
        ctx.beginPath();
        ctx.arc(pitchX + penDist, midY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pitchX + pitchW - penDist, midY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Pixel Cup style crisp X penalty spots
        const drawPixelPenaltyX = (px: number, py: number) => {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(px - 4, py - 4, 3, 3);
          ctx.fillRect(px + 1, py - 4, 3, 3);
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
          ctx.fillRect(px - 4, py + 1, 3, 3);
          ctx.fillRect(px + 1, py + 1, 3, 3);
        };
        drawPixelPenaltyX(pitchX + penDist, midY);
        drawPixelPenaltyX(pitchX + pitchW - penDist, midY);
      }

      ctx.beginPath();
      ctx.arc(pitchX + penDist, midY, Math.min(58, pitchH * 0.12), -0.92, 0.92);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pitchX + pitchW - penDist, midY, Math.min(58, pitchH * 0.12), Math.PI - 0.92, Math.PI + 0.92);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(pitchX, goalTop);
      ctx.lineTo(pitchX, goalBot);
      ctx.moveTo(pitchX + pitchW, goalTop);
      ctx.lineTo(pitchX + pitchW, goalBot);
      ctx.stroke();
      ctx.restore();

      if (config.settings.format === 'artilheirinho') {
        ctx.save();
        ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.font = '800 11px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ÁREA GOLEIRO', pitchX + boxW / 2, midY - boxH / 2 - 8);
        ctx.fillText('ÁREA GOLEIRO', pitchX + pitchW - boxW / 2, midY - boxH / 2 - 8);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.85)';
        ctx.fillText('LIMITE DO ATACANTE · MEIO-CAMPO', midX, pitchY + 18);
        ctx.restore();
      }

      if (!isRocketArena) {
        const cR = 18;
        ctx.beginPath();
        ctx.arc(pitchX, pitchY, cR, 0, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pitchX + pitchW, pitchY, cR, Math.PI / 2, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pitchX + pitchW, pitchY + pitchH, cR, Math.PI, Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pitchX, pitchY + pitchH, cR, Math.PI * 1.5, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Rocket Boost Pads
      if (isRocketArena && sim.boostPads.length > 0) {
        const pulse = 0.75 + Math.sin(performance.now() * 0.008) * 0.25;
        for (const pad of sim.boostPads) {
          ctx.save();
          if (pad.cooldown <= 0) {
            const g = ctx.createRadialGradient(pad.x, pad.y, 2, pad.x, pad.y, pad.radius * 1.7);
            g.addColorStop(0, `rgba(251, 146, 60, ${0.75 * pulse})`);
            g.addColorStop(1, 'rgba(251, 146, 60, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, pad.radius * 1.7, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(pad.x, pad.y, pad.radius * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = pad.amount >= 100 ? '#FACC15' : '#FB923C';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, pad.radius * 0.75, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      const posts = [
        { x: pitchX, y: goalTop },
        { x: pitchX, y: goalBot },
        { x: pitchX + pitchW, y: goalTop },
        { x: pitchX + pitchW, y: goalBot },
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

      const nowSec = performance.now() * 0.001;

      // If in Slow-Motion Replay phase, render recorded frame!
      if (sim.goalPhase === 'replay' && sim.replayFrames.length > 0) {
        const fIdx = Math.min(sim.replayFrames.length - 1, Math.floor(sim.replayIndex));
        const rf = sim.replayFrames[fIdx];
        const sortedReplayDiscs = [...rf.discs].sort((a, b) => a.y - b.y);

        for (const d of sortedReplayDiscs) {
          if (isRocketArena && d.rocketCar) {
            drawTopDownCar(ctx, d.x, d.y, d.angle, d.rocketCar, {
              isBoosting: d.isBoosting,
              flipGlow: d.kickGlow,
              isHuman: d.isHuman,
              label: d.name,
              showLabel: true,
              scale: 0.92,
            });
          } else {
            const team = d.teamSide === 'home' ? config.homeTeam : config.awayTeam;
            drawPlayerDisc(ctx, d.x, d.y, d.radius, team.kit, d.label, {
              isHuman: d.isHuman,
              isHuman2: d.isHuman2,
              isGoalkeeper: d.isGoalkeeper,
              kickGlow: d.kickGlow,
              kickAngle: d.kickAngle,
              vx: d.vx,
              vy: d.vy,
              animTime: fIdx * 0.014,
              playerName: d.name,
              showName: true,
              team,
            });
          }
        }
        if (isRocketArena) {
          drawRocketBall(ctx, rf.ballX, rf.ballY, ballRenderR, rf.ballSpin);
        } else {
          drawSoccerBall(ctx, rf.ballX, rf.ballY, ballRenderR, rf.ballSpin);
        }

        // Broadcast replay border tint
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, arenaW - 8, arenaH - 8);
      } else {
        for (const pt of sim.particles) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
          ctx.fillStyle = pt.color;
          ctx.fillRect(Math.round(pt.x - pt.size), Math.round(pt.y - pt.size), Math.max(2, Math.round(pt.size * 2)), Math.max(2, Math.round(pt.size * 2)));
          ctx.restore();
        }

        // Depth-sort sprites top-to-bottom so lower players overlap naturally
        const sortedDiscs = [...sim.discs].sort((a, b) => a.y - b.y);
        for (const disc of sortedDiscs) {
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

          if (isRocketArena && disc.rocketCar) {
            drawTopDownCar(ctx, disc.x, disc.y, disc.angle, disc.rocketCar, {
              isBoosting: disc.isBoosting,
              flipGlow: disc.kickGlow,
              nitro: disc.nitro,
              isHuman: disc.isHuman || Boolean(disc.isHuman2),
              label: !isBackgroundDemo
                ? config.rocketMatchMode === 'local_2p'
                  ? disc.teamSide === 'home'
                    ? `J1 · ${disc.rocketCar.carName}`
                    : `J2 · ${disc.rocketCar.carName}`
                  : disc.isHuman
                    ? `VOCÊ · ${disc.rocketCar.carName}`
                    : disc.rocketCar.carName
                : undefined,
              showLabel: !isBackgroundDemo,
              scale: 0.92,
            });
          } else {
            drawPlayerDisc(ctx, disc.x, disc.y, disc.radius, team.kit, label, {
              isHuman: disc.isHuman,
              isHuman2: disc.isHuman2,
              isGoalkeeper: disc.isGoalkeeper,
              kickGlow: disc.kickGlow,
              kickAngle: disc.kickAngle,
              vx: disc.vx,
              vy: disc.vy,
              animTime: nowSec,
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
        }

        if (isRocketArena) {
          drawRocketBall(ctx, sim.ball.x, sim.ball.y, ballRenderR, sim.ball.spin);
        } else {
          drawSoccerBall(ctx, sim.ball.x, sim.ball.y, ballRenderR, sim.ball.spin);
        }

        // Compact pixel radar minimap (matches Pixel Cup bottom-center radar)
        if (!isBackgroundDemo && !isRocketArena) {
          const mapW = 112;
          const mapH = 56;
          const mapX = Math.round(arenaW / 2 - mapW / 2);
          const mapY = Math.round(pitchY + pitchH + 10);
          if (mapY + mapH <= arenaH - 4) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = 'rgba(13, 34, 21, 0.78)';
            ctx.fillRect(mapX, mapY, mapW, mapH);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(mapX, mapY, mapW, mapH);
            ctx.beginPath();
            ctx.moveTo(mapX + mapW / 2, mapY);
            ctx.lineTo(mapX + mapW / 2, mapY + mapH);
            ctx.stroke();
            ctx.strokeRect(mapX, mapY + 13, 14, mapH - 26);
            ctx.strokeRect(mapX + mapW - 14, mapY + 13, 14, mapH - 26);

            for (const d of sim.discs) {
              const mx = mapX + ((d.x - pitchX) / pitchW) * mapW;
              const my = mapY + ((d.y - pitchY) / pitchH) * mapH;
              ctx.fillStyle = d.teamSide === 'home' ? '#38BDF8' : '#F43F5E';
              ctx.fillRect(Math.round(mx - 2), Math.round(my - 2), 4, 4);
            }
            const bx = mapX + ((sim.ball.x - pitchX) / pitchW) * mapW;
            const by = mapY + ((sim.ball.y - pitchY) / pitchH) * mapH;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(Math.round(bx - 2), Math.round(by - 2), 4, 4);
            ctx.restore();
          }
        }
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
  }, [announce, config, geom, isBackgroundDemo, resetPositions, showPenaltyShootout]);

  // Online 2P authoritative match synchronization (Supabase Realtime primary, WS fallback if specified)
  useEffect(() => {
    if (isBackgroundDemo || config.settings.format !== 'online_2p' || !config.onlineRoom) return;

    const room = config.onlineRoom;
    const isHost = room.side === 'home';

    if (room.transport !== 'ws') {
      const client = getSupabaseClient();
      if (!client) {
        setOnlineNotice('Supabase não configurado neste dispositivo.');
        return;
      }

      const channel = client.channel(`arena-match-${room.roomCode}`, {
        config: { broadcast: { self: false } },
      });
      supabaseMatchChannelRef.current = channel;

      if (isHost) {
        channel.on('broadcast', { event: 'input' }, ({ payload }) => {
          const p = (payload || {}) as { ax?: number; ay?: number; kick?: boolean };
          remoteGuestInputRef.current = {
            ax: Math.max(-1, Math.min(1, Number(p.ax) || 0)),
            ay: Math.max(-1, Math.min(1, Number(p.ay) || 0)),
            kick: Boolean(p.kick) || remoteGuestInputRef.current.kick,
            updatedAt: Date.now(),
          };
        });
      } else {
        channel
          .on('broadcast', { event: 'state' }, ({ payload }) => {
            const msg = (payload || {}) as Record<string, unknown>;
            const sim = simRef.current;
            if (!sim) return;

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
          })
          .on('broadcast', { event: 'goal' }, ({ payload }) => {
            const p = (payload || {}) as { scoringSide?: 'home' | 'away'; scorer?: string };
            soundEngine.playGoalCheer();
            const side = p.scoringSide === 'away' ? 'away' : 'home';
            const t = side === 'home' ? config.homeTeam : config.awayTeam;
            const scorerName = String(p.scorer || t.shortCode);
            setGoalBanner({
              side,
              scorer: scorerName,
              teamName: t.name,
              color: t.kit.primaryColor,
            });
            announce(`GOOOOL de ${scorerName}! ${t.name} balança as redes!`, true, 'goal');
          })
          .on('broadcast', { event: 'match_finished' }, ({ payload }) => {
            const p = (payload || {}) as { result?: MatchResult };
            if (!p.result) return;
            const sim = simRef.current;
            if (sim) sim.finished = true;
            soundEngine.playWhistle(true);
            setMatchFinished(p.result);
          })
          .on('broadcast', { event: 'opponent_left' }, () => {
            setOnlineNotice('O anfitrião encerrou a partida online.');
          });
      }

      let subscribed = false;
      channel.subscribe((status) => {
        subscribed = status === 'SUBSCRIBED';
      });

      const syncTimer = setInterval(() => {
        const sim = simRef.current;
        if (!subscribed || !sim || sim.finished) return;

        if (isHost) {
          void channel.send({
            type: 'broadcast',
            event: 'state',
            payload: {
              ball: {
                x: Math.round(sim.ball.x * 10) / 10,
                y: Math.round(sim.ball.y * 10) / 10,
                spin: Math.round(sim.ball.spin * 100) / 100,
              },
              discs: sim.discs.map((d) => ({
                side: d.teamSide,
                x: Math.round(d.x * 10) / 10,
                y: Math.round(d.y * 10) / 10,
                kickGlow: Math.round(d.kickGlow * 100) / 100,
                kickAngle: Math.round(d.kickAngle * 100) / 100,
                stamina: Math.round(d.stamina),
              })),
              homeGoals: sim.homeGoals,
              awayGoals: sim.awayGoals,
              elapsed: sim.elapsed,
              inAddedTime: sim.inAddedTime,
              addedMinutesTotal: sim.addedMinutesTotal,
              addedSecondsLeft: sim.addedSecondsLeft,
              netRippleLeft: sim.netRippleLeft,
              netRippleRight: sim.netRippleRight,
              goalPhase: sim.goalPhase,
            },
          });
        } else {
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

          void channel.send({
            type: 'broadcast',
            event: 'input',
            payload: { ax, ay, kick },
          });
        }
      }, 33);

      return () => {
        clearInterval(syncTimer);
        if (isHost && simRef.current && !simRef.current.finished && subscribed) {
          void channel.send({ type: 'broadcast', event: 'opponent_left', payload: {} });
        }
        supabaseMatchChannelRef.current = null;
        void client.removeChannel(channel);
      };
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    onlineWsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'join_room',
          token: room.token,
          roomCode: room.roomCode,
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
            onlineLeagueId: config.onlineLeagueId,
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

  const isRocketMode = config.settings.format === 'rocket_cars';
  const isArtilheirinhoMode = config.settings.format === 'artilheirinho';
  const isLocal2P =
    config.settings.format === 'local_2p' ||
    (isRocketMode && config.rocketMatchMode === 'local_2p') ||
    (isArtilheirinhoMode && config.artilheirinhoConfig?.mode === 'local_2p');

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

        <div className="flex items-center gap-2.5">
          {isRocketMode && (
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                soundEngine.unlock();
                touchBoostActiveRef.current = true;
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                touchBoostActiveRef.current = false;
              }}
              onTouchCancel={() => {
                touchBoostActiveRef.current = false;
              }}
              onMouseDown={() => {
                touchBoostActiveRef.current = true;
              }}
              onMouseUp={() => {
                touchBoostActiveRef.current = false;
              }}
              className={`rounded-full bg-orange-500/90 active:scale-95 border-3 border-white/85 font-display font-extrabold text-slate-950 shadow-xl touch-none flex flex-col items-center justify-center ${
                compact ? 'w-16 h-16 text-xs' : 'w-18 h-18 sm:w-20 sm:h-20 text-xs sm:text-sm'
              }`}
            >
              <Flame className="w-4 h-4 mb-0.5" />
              NITRO
            </button>
          )}
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
              compact ? 'w-20 h-20 text-base' : 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-lg sm:text-xl md:text-2xl'
            }`}
          >
            {isRocketMode ? 'IMPULSO' : 'CHUTAR'}
          </button>
        </div>
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
            {/* Broadcast Scoreboard Variants */}
            {activeScoreboardStyle === 'brasileirao_tv' ? (
              <div className="flex flex-col items-start sm:items-center shrink-0">
                <div className="flex items-center">
                  {/* Main White Pill Container */}
                  <div className="flex items-center bg-white text-[#0F172A] rounded-full shadow-[0_6px_22px_rgba(0,0,0,0.45)] border border-slate-200/90 h-8 sm:h-10 px-1.5 sm:px-2 gap-1.5 sm:gap-2">
                    {/* Home Wing */}
                    <div className="flex items-center gap-1 sm:gap-1.5 pl-0.5">
                      <ClubCrest team={config.homeTeam} size={22} className="hidden sm:block" />
                      <ClubCrest team={config.homeTeam} size={17} className="sm:hidden" />
                      <span className="font-sans text-[11px] sm:text-base font-black tracking-tight uppercase text-[#0F172A]">
                        {config.homeTeam.shortCode}
                      </span>
                      <span
                        className="w-2 sm:w-2.5 h-5 sm:h-7 rounded-sm shrink-0"
                        style={{ backgroundColor: homeBg }}
                      />
                    </div>

                    {/* Center Score Box */}
                    <div className="flex items-center justify-center gap-2 sm:gap-2.5 bg-white rounded-xl shadow-[0_2px_8px_rgba(15,23,42,0.18)] border border-slate-200 px-2.5 sm:px-3.5 py-0.5 sm:py-1 mx-0.5">
                      <span className="font-sans text-lg sm:text-2xl font-black leading-none tabular-nums text-[#0F172A]">
                        {homeScore}
                      </span>
                      {!isTrainingSolo && (
                        <>
                          <span className="w-[2px] h-4 sm:h-5 bg-indigo-600/80 rounded-full" />
                          <span className="font-sans text-lg sm:text-2xl font-black leading-none tabular-nums text-[#0F172A]">
                            {awayScore}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Away Wing */}
                    {!isTrainingSolo && (
                      <div className="flex items-center gap-1 sm:gap-1.5 pr-0.5">
                        <span
                          className="w-2 sm:w-2.5 h-5 sm:h-7 rounded-sm shrink-0"
                          style={{ backgroundColor: awayBg }}
                        />
                        <span className="font-sans text-[11px] sm:text-base font-black tracking-tight uppercase text-[#0F172A]">
                          {config.awayTeam.shortCode}
                        </span>
                        <ClubCrest team={config.awayTeam} size={22} className="hidden sm:block" />
                        <ClubCrest team={config.awayTeam} size={17} className="sm:hidden" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Neon Lime Clock Pill Attached Underneath */}
                <div className="ml-6 sm:ml-0 -mt-[2px] bg-[#D4F828] text-[#111827] font-mono-tabular text-[10px] sm:text-xs font-extrabold tracking-wide px-3 sm:px-4 py-[2px] rounded-b-lg shadow-md leading-tight">
                  {isTrainingSolo ? 'TREINO LIVRE' : `${halfPeriod} ${displayClock}`}
                </div>
              </div>
            ) : activeScoreboardStyle === 'transmissao_2026' ? (
              <div className="shrink-0 p-[1.5px] rounded-full bg-gradient-to-r from-cyan-400 via-amber-300 to-fuchsia-500 shadow-[0_6px_22px_rgba(0,0,0,0.55)]">
                <div className="flex items-center bg-[#090B12] text-white rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 gap-2 sm:gap-3">
                  {/* Left Clock */}
                  <div className="font-mono-tabular text-[11px] sm:text-sm font-extrabold tracking-wide text-slate-100 border-r border-white/15 pr-2 sm:pr-2.5">
                    {isTrainingSolo ? 'TR' : `${halfPeriod} ${displayClock}`}
                  </div>

                  {/* Home Side */}
                  <div className="flex items-center gap-1.5">
                    <ClubCrest team={config.homeTeam} size={20} className="hidden sm:block" />
                    <ClubCrest team={config.homeTeam} size={15} className="sm:hidden" />
                    <span
                      className="w-2 h-2 rounded-full border border-white/60 shrink-0"
                      style={{ backgroundColor: homeBg }}
                    />
                    <span className="font-sans text-[11px] sm:text-sm font-black uppercase tracking-wider">
                      {config.homeTeam.shortCode}
                    </span>
                    <span className="font-sans text-base sm:text-xl font-black tabular-nums ml-0.5">
                      {homeScore}
                    </span>
                  </div>

                  {/* Center Tournament Badge */}
                  <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-gradient-to-b from-amber-300/25 to-emerald-500/20 border border-amber-300/45 shrink-0">
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                  </div>

                  {/* Away Side */}
                  {!isTrainingSolo && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-sans text-base sm:text-xl font-black tabular-nums mr-0.5">
                        {awayScore}
                      </span>
                      <span className="font-sans text-[11px] sm:text-sm font-black uppercase tracking-wider">
                        {config.awayTeam.shortCode}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full border border-white/60 shrink-0"
                        style={{ backgroundColor: awayBg }}
                      />
                      <ClubCrest team={config.awayTeam} size={20} className="hidden sm:block" />
                      <ClubCrest team={config.awayTeam} size={15} className="sm:hidden" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Classic Globo-style TV Broadcast Scoreboard */
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
            )}

            <div className="sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0">
              <button
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playClick();
                  if (onCycleScoreboardStyle) {
                    onCycleScoreboardStyle();
                  } else {
                    setLocalScoreboardStyle((prev) =>
                      prev === 'brasileirao_tv'
                        ? 'transmissao_2026'
                        : prev === 'transmissao_2026'
                          ? 'classic'
                          : 'brasileirao_tv'
                    );
                  }
                }}
                title="Trocar Estilo do Placar (Brasileirão TV / Transmissão 2026 / Clássico)"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#0D1612]/90 border border-white/15 text-[10px] font-bold text-slate-200 hover:border-emerald-400/60 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <Tv className="w-3.5 h-3.5" />
                <span className="hidden md:inline">
                  {activeScoreboardStyle === 'brasileirao_tv'
                    ? 'Placar BR'
                    : activeScoreboardStyle === 'transmissao_2026'
                      ? 'Placar 26'
                      : 'Clássico'}
                </span>
              </button>
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

          {/* Slim Broadcast Commentary Bar + Rocket Nitro Meter pinned to top header */}
          <div className="mx-auto flex flex-wrap items-center justify-center gap-2 max-w-full">
            <div className="flex items-center gap-2 bg-[#0C1912] border border-emerald-500/25 rounded-md px-2.5 py-0.5 text-[10px] sm:text-xs text-emerald-200 max-w-full">
              <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
              {(config.settings.format === '3v3' ||
                config.settings.format === '2v2' ||
                isArtilheirinhoMode ||
                isRocketMode) && (
                <span className="font-mono-tabular text-[10px] font-bold uppercase text-amber-300 shrink-0">
                  {isRocketMode
                    ? 'ROCKET CARS · NITRO'
                    : isArtilheirinhoMode
                      ? `ARTILHEIRINHO · TOQUES ${artHud.touchesUsed}/${artHud.maxTouches} · TRAVES ${artHud.postHitsHome}-${artHud.postHitsAway}`
                      : config.tournament === 'player_career_pro'
                        ? 'CARREIRA FIFA · 2v2'
                        : config.settings.format === '3v3'
                          ? '3v3'
                          : '2v2'}
                </span>
              )}
              <span className="truncate max-w-[75vw] sm:max-w-xl xl:max-w-2xl">
                {isArtilheirinhoMode && artHud.notice ? artHud.notice : commentaryText}
              </span>
            </div>

            {isRocketMode && (
              <div className="flex items-center gap-2 bg-[#0A1328] border border-orange-400/40 rounded-md px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-orange-300">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>NITRO</span>
                <div className="w-20 sm:w-24 h-2 rounded-full bg-black/60 overflow-hidden border border-white/15">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-yellow-300 transition-all duration-100"
                    style={{ width: `${rocketNitroDisplay}%` }}
                  />
                </div>
                <span className="font-mono-tabular text-white">{rocketNitroDisplay}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unobstructed Pitch Stage */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full max-w-full max-h-full object-contain shadow-2xl"
          style={{ aspectRatio: `${geom.arenaW} / ${geom.arenaH}` }}
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
                {isRocketMode
                  ? isLocal2P
                    ? 'J1: WASD + Shift (Nitro) + Espaço (Impulso) · J2: Setas + ShiftDir/M (Nitro) + Enter (Impulso)'
                    : 'W, A, S, D Dirigir · Shift / K Nitro · Espaço Impulso · Esc Pausar'
                  : config.settings.format === 'local_2p'
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
                config.tournament !== 'world_cup_knockout' &&
                config.tournament !== 'player_career_pro' && (
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
