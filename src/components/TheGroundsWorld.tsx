import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Car,
  CheckCircle2,
  Compass,
  Eye,
  Flame,
  MapPin,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  CELEBRITY_BY_ID,
  GROUNDS_CELEBRITIES,
  GROUNDS_WORLD_H,
  GROUNDS_WORLD_W,
  GROUNDS_ZONES,
  GroundsCelebrity,
  GroundsZone,
  buildCelebrityOpponentTeam,
  celebrityToPlayer,
} from '../data/theGroundsData';
import {
  ActiveMatchConfig,
  MatchSettings,
  Player,
  PlayerCareerState,
  Team,
} from '../types/game';
import { soundEngine } from '../utils/audio';
import {
  acceptPlayerOffer,
  createDefaultGroundsState,
  interactWithGroundsCelebrity,
  startNextPlayerSeason,
  upgradePlayerAttribute,
} from '../utils/playerCareerEngine';
import { ClubCrest } from './ClubCrest';
import { PlayerCard } from './PlayerCard';

interface TheGroundsWorldProps {
  teams: Team[];
  playerCareer: PlayerCareerState;
  settings: MatchSettings;
  onUpdatePlayerCareer: (next: PlayerCareerState | null) => void;
  onSwitchToClassicView: () => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

interface TrafficCar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  accent: string;
  kind: 'sedan' | 'sport' | 'taxi' | 'van';
}

interface AmbientNpc {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
  color: string;
  number: number;
}

export const TheGroundsWorld: React.FC<TheGroundsWorldProps> = ({
  teams,
  playerCareer,
  settings,
  onUpdatePlayerCareer,
  onSwitchToClassicView,
  onStartMatch,
  onBack,
}) => {
  const grounds = playerCareer.grounds || createDefaultGroundsState();
  const targetClub =
    teams.find((t) => t.id === (playerCareer.stage === 'pro' ? playerCareer.clubId : playerCareer.trialClubId)) ||
    teams[0];

  const heroPlayer: Player = useMemo(
    () => ({ ...playerCareer.player, stamina: 100 }),
    [playerCareer.player]
  );

  const [matchFormat, setMatchFormat] = useState<'1v1' | '2v2'>('2v2');
  const [nearbyZone, setNearbyZone] = useState<GroundsZone | null>(null);
  const [nearbyCeleb, setNearbyCeleb] = useState<GroundsCelebrity | null>(null);
  const [activeCelebModal, setActiveCelebModal] = useState<GroundsCelebrity | null>(null);
  const [sheetTab, setSheetTab] = useState<'card' | 'training' | 'celebrities' | 'league' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const joyRef = useRef<{ active: boolean; dx: number; dy: number; id: number | null; ox: number; oy: number }>({
    active: false,
    dx: 0,
    dy: 0,
    id: null,
    ox: 0,
    oy: 0,
  });
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const careerRef = useRef(playerCareer);
  careerRef.current = playerCareer;

  const worldSimRef = useRef<{
    px: number;
    py: number;
    vx: number;
    vy: number;
    angle: number;
    walkTarget: { x: number; y: number } | null;
    trail: { x: number; y: number; life: number }[];
    cars: TrafficCar[];
    ambient: AmbientNpc[];
    honkCooldown: number;
    lastSavedX: number;
    lastSavedY: number;
  }>({
    px: grounds.playerX,
    py: grounds.playerY,
    vx: 0,
    vy: 0,
    angle: 0,
    walkTarget: null,
    trail: [],
    honkCooldown: 0,
    lastSavedX: grounds.playerX,
    lastSavedY: grounds.playerY,
    cars: [
      // Top eastbound lane (y = 682)
      { x: 120, y: 682, vx: 215, vy: 0, w: 64, h: 30, color: '#EF4444', accent: '#FEE2E2', kind: 'sport' },
      { x: 640, y: 682, vx: 185, vy: 0, w: 68, h: 32, color: '#FACC15', accent: '#18181B', kind: 'taxi' },
      { x: 1280, y: 682, vx: 195, vy: 0, w: 72, h: 34, color: '#38BDF8', accent: '#E0F2FE', kind: 'sedan' },
      { x: 1840, y: 682, vx: 170, vy: 0, w: 78, h: 36, color: '#E2E8F0', accent: '#94A3B8', kind: 'van' },
      // Bottom westbound lane (y = 742)
      { x: 350, y: 742, vx: -195, vy: 0, w: 68, h: 32, color: '#10B981', accent: '#D1FAE5', kind: 'sedan' },
      { x: 960, y: 742, vx: -225, vy: 0, w: 64, h: 30, color: '#A855F7', accent: '#F3E8FF', kind: 'sport' },
      { x: 1580, y: 742, vx: -180, vy: 0, w: 70, h: 32, color: '#F59E0B', accent: '#1E293B', kind: 'taxi' },
      // Vertical avenue cars (x = 708 & x = 752)
      { x: 706, y: 120, vx: 0, vy: 155, w: 30, h: 64, color: '#FB7185', accent: '#FFE4E6', kind: 'sedan' },
      { x: 754, y: 1120, vx: 0, vy: -165, w: 32, h: 66, color: '#0EA5E9', accent: '#BAE6FD', kind: 'sport' },
    ],
    ambient: [
      { x: 340, y: 360, baseX: 340, baseY: 360, phase: 0.4, speed: 0.7, color: '#F97316', number: 11 },
      { x: 1160, y: 455, baseX: 1160, baseY: 455, phase: 1.8, speed: 0.85, color: '#06B6D4', number: 8 },
      { x: 950, y: 860, baseX: 950, baseY: 860, phase: 3.1, speed: 0.65, color: '#EC4899', number: 5 },
      { x: 1540, y: 610, baseX: 1540, baseY: 610, phase: 4.2, speed: 0.75, color: '#22C55E', number: 14 },
      { x: 1620, y: 1215, baseX: 1620, baseY: 1215, phase: 2.3, speed: 0.6, color: '#EAB308', number: 4 },
    ],
  });

  // Helper to get optional celebrity partner or street mate
  const buildPartnerPlayer = (): Player => {
    const partnerId = grounds.activePartnerCelebrityId;
    if (partnerId && CELEBRITY_BY_ID[partnerId]) {
      return celebrityToPlayer(CELEBRITY_BY_ID[partnerId]);
    }
    return {
      ...heroPlayer,
      id: 'grounds-mate',
      name: 'Juninho da Vila',
      shortName: 'Juninho',
      number: 7,
      ovr: Math.max(64, heroPlayer.ovr),
      pace: Math.max(66, heroPlayer.pace),
      shot: Math.max(63, heroPlayer.shot),
      pass: Math.max(66, heroPlayer.pass),
      def: 60,
      fis: 68,
    };
  };

  // Match Launchers from The Grounds
  const launchStreetWithCars = () => {
    soundEngine.playWhistle(false);
    const partner = buildPartnerPlayer();
    const streetHome: Team = {
      id: 'grounds-street-home',
      name: 'Time da Rua · The Grounds',
      shortCode: 'RUA',
      leagueId: 'brasileirao',
      ovr: heroPlayer.ovr,
      budgetMillions: 0,
      crestShape: 'circle',
      kit: {
        primaryColor: '#F59E0B',
        secondaryColor: '#18181B',
        textColor: '#09090B',
        borderColor: '#FFFFFF',
        pattern: 'halves',
        displayMode: 'number',
        trailColor: playerCareer.trailColor,
      },
      players: [heroPlayer, partner],
    };

    const streetAway: Team = {
      id: 'grounds-street-away',
      name: 'Rivais da Avenida',
      shortCode: 'AVE',
      leagueId: 'brasileirao',
      ovr: 65 + Math.min(8, playerCareer.streetMatchesPlayed * 2),
      budgetMillions: 0,
      crestShape: 'diamond',
      kit: {
        primaryColor: '#0EA5E9',
        secondaryColor: '#0F172A',
        textColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        pattern: 'vertical_stripes',
        displayMode: 'number',
        trailColor: '#38BDF8',
      },
      players: [
        {
          id: 'ave-1',
          name: 'Léo do Morro',
          shortName: 'Léo',
          number: 9,
          position: 'ATA',
          ovr: 65,
          pace: 67,
          shot: 64,
          pass: 62,
          def: 56,
          fis: 65,
          age: 19,
          nationality: 'BRA',
          valueMillions: 1,
        },
        {
          id: 'ave-2',
          name: 'Biel Asfalto',
          shortName: 'Biel',
          number: 5,
          position: 'ZAG',
          ovr: 64,
          pace: 64,
          shot: 58,
          pass: 62,
          def: 66,
          fis: 68,
          age: 20,
          nationality: 'BRA',
          valueMillions: 1,
        },
      ],
    };

    onStartMatch({
      tournament: 'the_grounds_street',
      tournamentLabel: 'The Grounds · Pelada na Rua (Carros Passando)',
      homeTeam: streetHome,
      awayTeam: streetAway,
      humanSide: 'home',
      hasStreetTraffic: true,
      settings: {
        ...settings,
        format: matchFormat,
        arenaSize: 'street_asphalt',
        withGoalkeeper: false,
        durationSeconds: 120,
      },
    });
  };

  const launchFutsalMatch = () => {
    soundEngine.playWhistle(false);
    const partner = buildPartnerPlayer();
    const futsalHome: Team = {
      id: 'grounds-futsal-home',
      name: 'Esquadrão Futsal',
      shortCode: 'FUT',
      leagueId: 'brasileirao',
      ovr: heroPlayer.ovr,
      budgetMillions: 0,
      crestShape: 'shield',
      kit: {
        primaryColor: '#0284C7',
        secondaryColor: '#FACC15',
        textColor: '#FFFFFF',
        borderColor: '#38BDF8',
        pattern: 'sash',
        displayMode: 'number',
        trailColor: playerCareer.trailColor,
      },
      players: [heroPlayer, partner],
    };

    const futsalAway: Team = {
      id: 'grounds-futsal-away',
      name: 'Quadra Pro City',
      shortCode: 'QPRO',
      leagueId: 'brasileirao',
      ovr: Math.max(67, Math.min(82, heroPlayer.ovr + 2)),
      budgetMillions: 0,
      crestShape: 'hexagon',
      kit: {
        primaryColor: '#F97316',
        secondaryColor: '#1E293B',
        textColor: '#FFFFFF',
        borderColor: '#FDBA74',
        pattern: 'solid',
        displayMode: 'number',
        trailColor: '#FB923C',
      },
      players: [
        {
          id: 'qpro-1',
          name: 'Falcãozinho',
          shortName: 'Falcão Jr',
          number: 12,
          position: 'ATA',
          ovr: 71,
          pace: 73,
          shot: 72,
          pass: 74,
          def: 58,
          fis: 68,
          age: 22,
          nationality: 'BRA',
          valueMillions: 3,
        },
        {
          id: 'qpro-2',
          name: 'Rodrigo Fixo',
          shortName: 'Rodrigo',
          number: 4,
          position: 'ZAG',
          ovr: 69,
          pace: 66,
          shot: 65,
          pass: 70,
          def: 73,
          fis: 74,
          age: 24,
          nationality: 'BRA',
          valueMillions: 3,
        },
      ],
    };

    onStartMatch({
      tournament: 'the_grounds_futsal',
      tournamentLabel: 'The Grounds · Arena Futsal Pro',
      homeTeam: futsalHome,
      awayTeam: futsalAway,
      humanSide: 'home',
      settings: {
        ...settings,
        format: matchFormat,
        arenaSize: 'futsal',
        withGoalkeeper: false,
        durationSeconds: 120,
      },
    });
  };

  const launchAcademyTrialMatch = () => {
    soundEngine.playWhistle(false);
    const youthMate = targetClub.players[1] || targetClub.players[0];
    const trialHome: Team = {
      ...targetClub,
      name: `${targetClub.name} (Peneira)`,
      players: [heroPlayer, youthMate],
    };
    const trialAway: Team = {
      id: `${targetClub.id}-u20`,
      name: `${targetClub.shortCode} Sub-20`,
      shortCode: 'SUB20',
      leagueId: targetClub.leagueId,
      ovr: Math.max(66, Math.min(76, targetClub.ovr - 7)),
      budgetMillions: 0,
      crestShape: targetClub.crestShape,
      kit: {
        ...targetClub.kit,
        primaryColor:
          targetClub.kit.secondaryColor === targetClub.kit.primaryColor
            ? '#334155'
            : targetClub.kit.secondaryColor,
        secondaryColor: targetClub.kit.primaryColor,
        textColor: '#FFFFFF',
      },
      players: targetClub.players.map((p) => ({
        ...p,
        ovr: Math.max(66, p.ovr - 9),
        pace: Math.max(65, p.pace - 9),
        shot: Math.max(64, p.shot - 9),
        pass: Math.max(65, p.pass - 8),
      })),
    };

    onStartMatch({
      tournament: 'player_career_trial',
      tournamentLabel: `Teste Oficial (Peneira) · ${targetClub.name}`,
      homeTeam: trialHome,
      awayTeam: trialAway,
      humanSide: 'home',
      settings: {
        ...settings,
        format: matchFormat,
        arenaSize: 'standard',
        withGoalkeeper: false,
        durationSeconds: 120,
      },
    });
  };

  const nextFixture = playerCareer.fixtures.find((f) => !f.played);

  const launchProStadiumMatch = () => {
    if (!nextFixture) return;
    soundEngine.playWhistle(false);
    const oppTeam =
      teams.find((t) => t.id === nextFixture.opponentId) ||
      teams.find((t) => t.id !== targetClub.id) ||
      teams[1];

    const clubTeammates = targetClub.players.filter((p) => p.id !== heroPlayer.id);
    const homeWithHero: Team = {
      ...targetClub,
      players: [heroPlayer, ...clubTeammates],
    };

    onStartMatch({
      tournament: 'player_career_pro',
      tournamentLabel: `Carreira FIFA · Rodada ${nextFixture.round} vs ${oppTeam.shortCode}`,
      homeTeam: homeWithHero,
      awayTeam: oppTeam,
      humanSide: 'home',
      settings: {
        ...settings,
        format: matchFormat,
        arenaSize: 'standard',
        withGoalkeeper: false,
      },
    });
  };

  const launchCelebrityChallenge = (celeb: GroundsCelebrity) => {
    soundEngine.playWhistle(false);
    const partner = buildPartnerPlayer();
    const homeTeam: Team = {
      id: 'grounds-celeb-home',
      name: `${heroPlayer.shortName} Squad`,
      shortCode: 'VOCÊ',
      leagueId: targetClub.leagueId,
      ovr: heroPlayer.ovr,
      budgetMillions: 0,
      crestShape: targetClub.crestShape,
      kit: {
        ...targetClub.kit,
        trailColor: playerCareer.trailColor,
      },
      players: [heroPlayer, partner],
    };
    const awayTeam = buildCelebrityOpponentTeam(celeb);

    onStartMatch({
      tournament: 'the_grounds_celebrity',
      tournamentLabel: celeb.challengeTitle,
      homeTeam,
      awayTeam,
      humanSide: 'home',
      groundsCelebrityId: celeb.id,
      hasStreetTraffic: celeb.hasStreetTraffic,
      settings: {
        ...settings,
        format: matchFormat,
        arenaSize: celeb.challengeArena,
        withGoalkeeper: false,
        durationSeconds: 120,
      },
    });
  };

  const openCelebrityInteraction = (celeb: GroundsCelebrity) => {
    soundEngine.playClick();
    const updated = interactWithGroundsCelebrity(careerRef.current, celeb.id);
    if (updated !== careerRef.current) {
      onUpdatePlayerCareer({
        ...updated,
        grounds: {
          ...(updated.grounds || createDefaultGroundsState()),
          playerX: Math.round(worldSimRef.current.px),
          playerY: Math.round(worldSimRef.current.py),
        },
      });
    }
    setActiveCelebModal(celeb);
  };

  const handleTriggerInteract = () => {
    if (activeCelebModal || sheetTab) return;
    if (nearbyCeleb) {
      openCelebrityInteraction(nearbyCeleb);
      return;
    }
    if (!nearbyZone) return;
    soundEngine.playClick();
    if (nearbyZone.id === 'street_pitch') {
      launchStreetWithCars();
    } else if (nearbyZone.id === 'futsal_arena') {
      launchFutsalMatch();
    } else if (nearbyZone.id === 'academy_stadium') {
      if (playerCareer.stage === 'street' && playerCareer.scoutInterest < 100) {
        onUpdatePlayerCareer({
          ...playerCareer,
          stage: 'trial',
          grounds: {
            ...grounds,
            playerX: Math.round(worldSimRef.current.px),
            playerY: Math.round(worldSimRef.current.py),
            lastNotice: `Você foi até o Estádio da Base! Pode fazer um treino ou encarar o Teste Oficial.`,
          },
        });
      }
      launchAcademyTrialMatch();
    } else if (nearbyZone.id === 'main_stadium') {
      if (playerCareer.stage === 'pro' && nextFixture) {
        launchProStadiumMatch();
      } else {
        setSheetTab('league');
      }
    } else if (nearbyZone.id === 'training_plaza') {
      setSheetTab('training');
    }
  };

  const walkToPoint = (tx: number, ty: number) => {
    soundEngine.playClick();
    worldSimRef.current.walkTarget = { x: tx, y: ty };
  };

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) &&
        !activeCelebModal &&
        !sheetTab
      ) {
        e.preventDefault();
      }
      if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        handleTriggerInteract();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  // Main Open-World 60fps Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let syncAccum = 0;
    let lastNearbyZoneId: string | null = null;
    let lastNearbyCelebId: string | null = null;

    const resize = () => {
      const parent = containerRef.current;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      resize();

      const sim = worldSimRef.current;
      const keys = keysRef.current;
      const modalOpen = Boolean(activeCelebModal || sheetTab);

      let ix = 0;
      let iy = 0;
      if (!modalOpen) {
        if (keys['KeyW'] || keys['ArrowUp']) iy -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) iy += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) ix += 1;

        if (joyRef.current.active) {
          ix += joyRef.current.dx;
          iy += joyRef.current.dy;
        }

        if (Math.hypot(ix, iy) > 0.1) {
          sim.walkTarget = null;
        } else if (sim.walkTarget) {
          const dx = sim.walkTarget.x - sim.px;
          const dy = sim.walkTarget.y - sim.py;
          const dist = Math.hypot(dx, dy);
          if (dist < 18) {
            sim.walkTarget = null;
          } else {
            ix = dx / dist;
            iy = dy / dist;
          }
        }
      }

      const mag = Math.hypot(ix, iy);
      if (mag > 1) {
        ix /= mag;
        iy /= mag;
      }

      const sprinting = keys['ShiftLeft'] || keys['ShiftRight'];
      const maxSpeed = sprinting ? 360 : 250;
      if (mag > 0.08) {
        sim.vx += (ix * maxSpeed - sim.vx) * Math.min(1, dt * 12);
        sim.vy += (iy * maxSpeed - sim.vy) * Math.min(1, dt * 12);
        sim.angle = Math.atan2(sim.vy, sim.vx);
        if (Math.random() < 0.6) {
          sim.trail.push({ x: sim.px, y: sim.py, life: 0.35 });
        }
      } else {
        sim.vx *= Math.pow(0.001, dt);
        sim.vy *= Math.pow(0.001, dt);
      }

      sim.px = Math.max(40, Math.min(GROUNDS_WORLD_W - 40, sim.px + sim.vx * dt));
      sim.py = Math.max(40, Math.min(GROUNDS_WORLD_H - 40, sim.py + sim.vy * dt));

      // Trail decay
      for (let i = sim.trail.length - 1; i >= 0; i--) {
        sim.trail[i].life -= dt;
        if (sim.trail[i].life <= 0) sim.trail.splice(i, 1);
      }

      // Cars traffic loop
      if (sim.honkCooldown > 0) sim.honkCooldown -= dt;
      for (const car of sim.cars) {
        // Slow down briefly if player is directly in front of car
        const dxP = sim.px - car.x;
        const dyP = sim.py - car.y;
        const distP = Math.hypot(dxP, dyP);
        let speedFactor = 1;
        if (distP < 95) {
          speedFactor = 0.28;
          if (distP < 56 && sim.honkCooldown <= 0) {
            sim.honkCooldown = 1.6;
            // Gentle nudge out of car bumper
            const pushLen = Math.max(1, distP);
            sim.vx += (dxP / pushLen) * 190;
            sim.vy += (dyP / pushLen) * 190;
          }
        }
        car.x += car.vx * speedFactor * dt;
        car.y += car.vy * speedFactor * dt;
        if (car.vx > 0 && car.x > GROUNDS_WORLD_W + 90) car.x = -90;
        if (car.vx < 0 && car.x < -90) car.x = GROUNDS_WORLD_W + 90;
        if (car.vy > 0 && car.y > GROUNDS_WORLD_H + 90) car.y = -90;
        if (car.vy < 0 && car.y < -90) car.y = GROUNDS_WORLD_H + 90;
      }

      // Ambient NPCs gentle stroll
      const tSec = now * 0.001;
      for (const npc of sim.ambient) {
        npc.x = npc.baseX + Math.cos(tSec * npc.speed + npc.phase) * 38;
        npc.y = npc.baseY + Math.sin(tSec * npc.speed * 1.2 + npc.phase) * 24;
      }

      // Proximity Detection for Landmarks & Celebrities
      let foundZone: GroundsZone | null = null;
      for (const z of GROUNDS_ZONES) {
        const inside =
          sim.px >= z.x - 24 &&
          sim.px <= z.x + z.w + 24 &&
          sim.py >= z.y - 24 &&
          sim.py <= z.y + z.h + 24;
        if (inside) {
          foundZone = z;
          break;
        }
      }
      if ((foundZone?.id || null) !== lastNearbyZoneId) {
        lastNearbyZoneId = foundZone?.id || null;
        setNearbyZone(foundZone);
      }

      let foundCeleb: GroundsCelebrity | null = null;
      let bestDist = 78;
      for (const c of GROUNDS_CELEBRITIES) {
        const d = Math.hypot(sim.px - c.x, sim.py - c.y);
        if (d < bestDist) {
          bestDist = d;
          foundCeleb = c;
        }
      }
      if ((foundCeleb?.id || null) !== lastNearbyCelebId) {
        lastNearbyCelebId = foundCeleb?.id || null;
        setNearbyCeleb(foundCeleb);
      }

      // Periodic position sync
      syncAccum += dt;
      if (syncAccum > 2.5) {
        syncAccum = 0;
        if (Math.hypot(sim.px - sim.lastSavedX, sim.py - sim.lastSavedY) > 65) {
          sim.lastSavedX = sim.px;
          sim.lastSavedY = sim.py;
          const cur = careerRef.current;
          onUpdatePlayerCareer({
            ...cur,
            grounds: {
              ...(cur.grounds || createDefaultGroundsState()),
              playerX: Math.round(sim.px),
              playerY: Math.round(sim.py),
            },
          });
        }
      }

      // ================= RENDER THE GROUNDS WORLD =================
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;

      const camX = Math.max(0, Math.min(GROUNDS_WORLD_W - viewW, sim.px - viewW / 2));
      const camY = Math.max(0, Math.min(GROUNDS_WORLD_H - viewH, sim.py - viewH / 2));

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#0F1B14';
      ctx.fillRect(0, 0, viewW, viewH);

      ctx.translate(-camX, -camY);

      // 1. District Grass & Park Ground
      ctx.fillStyle = '#14261B';
      ctx.fillRect(0, 0, GROUNDS_WORLD_W, GROUNDS_WORLD_H);

      // Subtle district grid blocks
      ctx.fillStyle = '#193123';
      ctx.fillRect(80, 80, 560, 520);
      ctx.fillRect(810, 80, 1280, 520);
      ctx.fillRect(80, 830, 560, 530);
      ctx.fillRect(810, 830, 1280, 530);

      // Cobblestone Plaza dos Campeões
      ctx.fillStyle = '#242A36';
      ctx.beginPath();
      ctx.roundRect(790, 850, 560, 350, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 2. Main Asphalt Boulevard (Horizontal & Vertical) with Sidewalks
      // Sidewalks
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 636, GROUNDS_WORLD_W, 152);
      ctx.fillRect(666, 0, 128, GROUNDS_WORLD_H);

      // Asphalt surface
      ctx.fillStyle = '#1E242B';
      ctx.fillRect(0, 654, GROUNDS_WORLD_W, 116);
      ctx.fillRect(682, 0, 96, GROUNDS_WORLD_H);

      // Center yellow dashed lane dividers
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.setLineDash([24, 18]);
      ctx.beginPath();
      ctx.moveTo(0, 712);
      ctx.lineTo(676, 712);
      ctx.moveTo(784, 712);
      ctx.lineTo(GROUNDS_WORLD_W, 712);
      ctx.moveTo(730, 0);
      ctx.lineTo(730, 650);
      ctx.moveTo(730, 774);
      ctx.lineTo(730, GROUNDS_WORLD_H);
      ctx.stroke();
      ctx.setLineDash([]);

      // White crosswalk zebra stripes near intersection
      ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
      for (let k = 0; k < 5; k++) {
        ctx.fillRect(646, 662 + k * 22, 22, 12);
        ctx.fillRect(792, 662 + k * 22, 22, 12);
        ctx.fillRect(690 + k * 19, 624, 10, 22);
        ctx.fillRect(690 + k * 19, 778, 10, 22);
      }

      // 3. Decorative District Trees & Lamps
      const trees = [
        [140, 160],
        [600, 150],
        [160, 1050],
        [560, 1220],
        [1340, 150],
        [2040, 170],
        [2050, 1250],
        [1290, 1300],
      ];
      for (const [tx, ty] of trees) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(tx + 5, ty + 8, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.arc(tx, ty, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(tx - 5, ty - 5, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Render All 5 Interactive Venues / Stadiums
      for (const z of GROUNDS_ZONES) {
        const isNear = foundZone?.id === z.id;
        ctx.save();

        if (z.id === 'street_pitch') {
          // Pelada de Rua no Asfalto (alongside avenue!)
          ctx.fillStyle = '#272C34';
          ctx.beginPath();
          ctx.roundRect(z.x, z.y, z.w, z.h, 14);
          ctx.fill();
          ctx.strokeStyle = isNear ? '#FACC15' : '#64748B';
          ctx.lineWidth = isNear ? 4 : 2.5;
          ctx.stroke();

          ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
          ctx.lineWidth = 2;
          ctx.strokeRect(z.x + 18, z.y + 18, z.w - 36, z.h - 36);
          ctx.beginPath();
          ctx.moveTo(z.x + z.w / 2, z.y + 18);
          ctx.lineTo(z.x + z.w / 2, z.y + z.h - 18);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(z.x + z.w / 2, z.y + z.h / 2, 28, 0, Math.PI * 2);
          ctx.stroke();
        } else if (z.id === 'futsal_arena') {
          // Arena Futsal Pro (Blue court inside warm wood border)
          ctx.fillStyle = '#B45309';
          ctx.beginPath();
          ctx.roundRect(z.x - 14, z.y - 14, z.w + 28, z.h + 28, 20);
          ctx.fill();
          ctx.fillStyle = '#0369A1';
          ctx.beginPath();
          ctx.roundRect(z.x, z.y, z.w, z.h, 12);
          ctx.fill();
          ctx.strokeStyle = isNear ? '#38BDF8' : '#E0F2FE';
          ctx.lineWidth = isNear ? 4 : 2;
          ctx.strokeRect(z.x + 14, z.y + 14, z.w - 28, z.h - 28);
          ctx.beginPath();
          ctx.moveTo(z.x + z.w / 2, z.y + 14);
          ctx.lineTo(z.x + z.w / 2, z.y + z.h - 14);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(z.x + z.w / 2, z.y + z.h / 2, 30, 0, Math.PI * 2);
          ctx.stroke();
          // Futsal penalty D-arcs
          ctx.beginPath();
          ctx.arc(z.x + 14, z.y + z.h / 2, 46, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(z.x + z.w - 14, z.y + z.h / 2, 46, Math.PI / 2, -Math.PI / 2);
          ctx.stroke();
        } else if (z.id === 'academy_stadium' || z.id === 'main_stadium') {
          // Real Football Stadium with oval roof ring & stands
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.roundRect(z.x - 24, z.y - 24, z.w + 48, z.h + 48, 36);
          ctx.fill();
          ctx.strokeStyle = isNear ? z.accentColor : 'rgba(255,255,255,0.22)';
          ctx.lineWidth = isNear ? 4 : 3;
          ctx.stroke();

          // Bleachers stripes
          ctx.fillStyle = z.id === 'main_stadium' ? '#1E293B' : '#1E3A2F';
          ctx.beginPath();
          ctx.roundRect(z.x - 10, z.y - 10, z.w + 20, z.h + 20, 22);
          ctx.fill();

          // Green pitch inside stadium
          const stripeW = z.w / 8;
          for (let s = 0; s < 8; s++) {
            ctx.fillStyle = s % 2 === 0 ? '#16A34A' : '#15803D';
            ctx.fillRect(z.x + s * stripeW, z.y, stripeW + 0.5, z.h);
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 2;
          ctx.strokeRect(z.x + 12, z.y + 12, z.w - 24, z.h - 24);
          ctx.beginPath();
          ctx.moveTo(z.x + z.w / 2, z.y + 12);
          ctx.lineTo(z.x + z.w / 2, z.y + z.h - 12);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(z.x + z.w / 2, z.y + z.h / 2, 34, 0, Math.PI * 2);
          ctx.stroke();

          // Floodlights at stadium corners
          const corners = [
            [z.x - 18, z.y - 18],
            [z.x + z.w + 18, z.y - 18],
            [z.x - 18, z.y + z.h + 18],
            [z.x + z.w + 18, z.y + z.h + 18],
          ];
          for (const [lx, ly] of corners) {
            ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
            ctx.beginPath();
            ctx.arc(lx, ly, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FEF08A';
            ctx.beginPath();
            ctx.arc(lx, ly, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Training Plaza
          ctx.fillStyle = '#1E1B4B';
          ctx.beginPath();
          ctx.roundRect(z.x, z.y, z.w, z.h, 24);
          ctx.fill();
          ctx.strokeStyle = isNear ? '#A78BFA' : 'rgba(167,139,250,0.4)';
          ctx.lineWidth = isNear ? 4 : 2.5;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(167,139,250,0.3)';
          ctx.beginPath();
          ctx.arc(z.x + z.w / 2, z.y + z.h / 2, 54, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Venue Name Tag
        ctx.fillStyle = 'rgba(9, 14, 20, 0.86)';
        const pillW = Math.min(280, Math.max(170, z.name.length * 8.4));
        ctx.beginPath();
        ctx.roundRect(z.x + z.w / 2 - pillW / 2, z.y - 36, pillW, 26, 8);
        ctx.fill();
        ctx.strokeStyle = z.accentColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 13px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(z.name.toUpperCase(), z.x + z.w / 2, z.y - 23);
        ctx.restore();
      }

      // 5. Render Passing Cars on the Avenue
      for (const car of sim.cars) {
        ctx.save();
        ctx.translate(car.x, car.y);
        const horizontal = Math.abs(car.vx) >= Math.abs(car.vy);
        const dir = horizontal ? (car.vx >= 0 ? 1 : -1) : car.vy >= 0 ? 1 : -1;
        if (!horizontal) ctx.rotate((Math.PI / 2) * dir);
        else if (dir < 0) ctx.rotate(Math.PI);

        const cw = horizontal ? car.w : car.h;
        const ch = horizontal ? car.h : car.w;

        // Car shadow
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath();
        ctx.roundRect(-cw / 2 + 2, -ch / 2 + 4, cw, ch, 7);
        ctx.fill();

        // Car body
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 7);
        ctx.fill();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Windshield + Roof
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(-cw * 0.16, -ch * 0.34, cw * 0.42, ch * 0.68, 4);
        ctx.fill();
        ctx.fillStyle = car.accent;
        ctx.beginPath();
        ctx.roundRect(-cw * 0.1, -ch * 0.28, cw * 0.22, ch * 0.56, 3);
        ctx.fill();

        // Headlight beams
        const beam = ctx.createLinearGradient(cw / 2, 0, cw / 2 + 42, 0);
        beam.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
        beam.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(cw / 2, -ch * 0.35);
        ctx.lineTo(cw / 2 + 42, -ch * 0.7);
        ctx.lineTo(cw / 2 + 42, ch * 0.7);
        ctx.lineTo(cw / 2, ch * 0.35);
        ctx.closePath();
        ctx.fill();

        // Brake lights
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-cw / 2, -ch * 0.36, 3, 6);
        ctx.fillRect(-cw / 2, ch * 0.36 - 6, 3, 6);
        ctx.restore();
      }

      // 6. Ambient Neighborhood Bolinhas
      for (const npc of sim.ambient) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(npc.x + 2, npc.y + 3, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = npc.color;
        ctx.beginPath();
        ctx.arc(npc.x, npc.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 10px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(npc.number), npc.x, npc.y + 0.5);
        ctx.restore();
      }

      // 7. Famous Celebrities (Bolinhas Estrelas)
      for (const c of GROUNDS_CELEBRITIES) {
        const isDone = grounds.completedCelebrityIds.includes(c.id);
        const isNearC = foundCeleb?.id === c.id;
        ctx.save();

        // Aura ring
        ctx.beginPath();
        ctx.arc(c.x, c.y, isNearC ? 27 : 22, 0, Math.PI * 2);
        ctx.strokeStyle = isNearC ? '#FFFFFF' : c.haloColor;
        ctx.lineWidth = isNearC ? 3 : 2;
        ctx.stroke();

        // Disc body
        ctx.fillStyle = c.primaryColor;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.clip();
        ctx.fillStyle = c.secondaryColor;
        ctx.fillRect(c.x, c.y - 18, 18, 36);
        ctx.restore();

        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = c.textColor;
        ctx.font = '900 13px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(c.number), c.x, c.y + 0.5);

        // Name & status tag
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        ctx.roundRect(c.x - 54, c.y - 42, 108, 18, 6);
        ctx.fill();
        ctx.strokeStyle = isDone ? '#34D399' : c.haloColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = isDone ? '#6EE7B7' : '#FDE047';
        ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${isDone ? '✓ ' : '★ '}${c.name}`, c.x, c.y - 33);
        ctx.restore();
      }

      // 8. Walk Target Marker
      if (sim.walkTarget) {
        ctx.save();
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sim.walkTarget.x, sim.walkTarget.y, 12 + Math.sin(now * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 9. Hero Trail & Hero Bolinha
      for (const pt of sim.trail) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.life / 0.35) * 0.45;
        ctx.fillStyle = playerCareer.trailColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 10 * (pt.life / 0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(sim.px + 2, sim.py + 4, 19, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sim.px, sim.py, 24, 0, Math.PI * 2);
      ctx.strokeStyle = playerCareer.trailColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = playerCareer.stage === 'pro' ? targetClub.kit.primaryColor : '#F59E0B';
      ctx.beginPath();
      ctx.arc(sim.px, sim.py, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.8;
      ctx.stroke();

      ctx.fillStyle = playerCareer.stage === 'pro' ? targetClub.kit.textColor : '#09090B';
      ctx.font = '900 15px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(heroPlayer.number), sim.px, sim.py + 0.5);

      ctx.fillStyle = 'rgba(9, 14, 20, 0.88)';
      ctx.beginPath();
      ctx.roundRect(sim.px - 44, sim.py + 26, 88, 17, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(heroPlayer.shortName, sim.px, sim.py + 34.5);
      ctx.restore();

      ctx.restore();
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [activeCelebModal, sheetTab, heroPlayer.number, heroPlayer.shortName, playerCareer.trailColor, playerCareer.stage, targetClub]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewW = canvas.width / dpr;
    const viewH = canvas.height / dpr;
    const sim = worldSimRef.current;
    const camX = Math.max(0, Math.min(GROUNDS_WORLD_W - viewW, sim.px - viewW / 2));
    const camY = Math.max(0, Math.min(GROUNDS_WORLD_H - viewH, sim.py - viewH / 2));

    const clickWorldX = camX + (e.clientX - rect.left);
    const clickWorldY = camY + (e.clientY - rect.top);

    // If user clicks directly on a celebrity nearby, open dialog immediately
    for (const c of GROUNDS_CELEBRITIES) {
      if (Math.hypot(clickWorldX - c.x, clickWorldY - c.y) < 34 && Math.hypot(sim.px - c.x, sim.py - c.y) < 120) {
        openCelebrityInteraction(c);
        return;
      }
    }
    sim.walkTarget = {
      x: Math.max(40, Math.min(GROUNDS_WORLD_W - 40, clickWorldX)),
      y: Math.max(40, Math.min(GROUNDS_WORLD_H - 40, clickWorldY)),
    };
  };

  // Virtual Joystick handlers (Mobile)
  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    joyRef.current = {
      active: true,
      dx: 0,
      dy: 0,
      id: t.identifier,
      ox: rect.left + rect.width / 2,
      oy: rect.top + rect.height / 2,
    };
  };
  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!joyRef.current.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyRef.current.id) {
        const dx = t.clientX - joyRef.current.ox;
        const dy = t.clientY - joyRef.current.oy;
        const maxR = 38;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(maxR, dist);
        const ang = Math.atan2(dy, dx);
        const nx = dist > 2 ? Math.cos(ang) * (clamped / maxR) : 0;
        const ny = dist > 2 ? Math.sin(ang) * (clamped / maxR) : 0;
        joyRef.current.dx = nx;
        joyRef.current.dy = ny;
        setJoyKnob({ x: nx * 24, y: ny * 24 });
      }
    }
  };
  const handleJoyEnd = () => {
    joyRef.current = { active: false, dx: 0, dy: 0, id: null, ox: 0, oy: 0 };
    setJoyKnob({ x: 0, y: 0 });
  };

  const handleUpgrade = (attr: 'pace' | 'shot' | 'pass' | 'def' | 'fis') => {
    if (playerCareer.skillPoints <= 0) return;
    soundEngine.playTransferSuccess();
    onUpdatePlayerCareer(upgradePlayerAttribute(playerCareer, attr));
  };

  const sortedStandings = [...playerCareer.standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const sgA = a.goalsFor - a.goalsAgainst;
    const sgB = b.goalsFor - b.goalsAgainst;
    return sgB !== sgA ? sgB - sgA : b.goalsFor - a.goalsFor;
  });

  const activePartnerName =
    grounds.activePartnerCelebrityId && CELEBRITY_BY_ID[grounds.activePartnerCelebrityId]
      ? CELEBRITY_BY_ID[grounds.activePartnerCelebrityId].shortName
      : 'Juninho';

  return (
    <div className="h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Compact Top HUD */}
      <header className="shrink-0 z-20 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#0D1812]/95 border-b border-white/10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Menu
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-bold truncate">
              <span>The Grounds · FC 27</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-amber-300">Fama {grounds.fame}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-slate-300">
                {playerCareer.stage === 'pro'
                  ? `Rodada ${Math.min(playerCareer.currentRound, playerCareer.totalRounds)}`
                  : `Olheiro ${playerCareer.scoutInterest}%`}
              </span>
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white truncate">
              {heroPlayer.name} · OVR {heroPlayer.ovr} · Dupla 2v2: {activePartnerName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            onClick={() => {
              soundEngine.playClick();
              setSheetTab('card');
            }}
            className="px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-xs font-bold text-emerald-300 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Ficha & Evolução ({playerCareer.skillPoints})
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setSheetTab('celebrities');
            }}
            className="px-3 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-xs font-bold text-amber-300 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Star className="w-3.5 h-3.5" /> Famosos ({grounds.metCelebrityIds.length}/{GROUNDS_CELEBRITIES.length})
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              onSwitchToClassicView();
            }}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 whitespace-nowrap cursor-pointer"
          >
            Carreira Normal
          </button>

          {confirmReset ? (
            <button
              onClick={() => {
                soundEngine.playClick();
                onUpdatePlayerCareer(null);
                setConfirmReset(false);
              }}
              className="px-3 py-2 rounded-lg bg-rose-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              Confirmar Reinício
            </button>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-xs text-slate-300 cursor-pointer"
              title="Reiniciar Carreira"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* GPS Quick Travel Bar */}
      <div className="shrink-0 z-20 flex items-center gap-2 px-3 sm:px-5 py-2 bg-[#0B140F] border-b border-white/10 overflow-x-auto">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 whitespace-nowrap shrink-0">
          <Compass className="w-3.5 h-3.5 text-emerald-400" /> GPS Rápido:
        </span>
        {GROUNDS_ZONES.map((z) => (
          <button
            key={z.id}
            onClick={() => walkToPoint(z.interactX, z.interactY)}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MapPin className="w-3 h-3" style={{ color: z.accentColor }} />
            <span>{z.shortLabel}</span>
          </button>
        ))}
        <span className="text-[11px] text-slate-500 ml-auto hidden lg:inline whitespace-nowrap">
          WASD / Setas ou clique no mapa para andar · E / Espaço para interagir
        </span>
      </div>

      {/* Main 2D Open World Viewport */}
      <div ref={containerRef} className="relative flex-1 w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-full block cursor-crosshair"
        />

        {/* Subtle Notice Banner */}
        {grounds.lastNotice && (
          <div className="pointer-events-none absolute top-3 left-3 max-w-md bg-[#09120D]/90 border border-emerald-400/35 rounded-xl px-3.5 py-2 text-xs text-emerald-100 shadow-lg">
            {grounds.lastNotice}
          </div>
        )}

        {/* Proximity Context Card (Zone or Celebrity) */}
        {(nearbyCeleb || nearbyZone) && !activeCelebModal && !sheetTab && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-lg bg-[#0D1812]/95 border border-emerald-400/50 rounded-2xl p-4 shadow-2xl space-y-3">
            {nearbyCeleb ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-amber-300">
                    Famoso por perto · OVR {nearbyCeleb.ovr}
                  </div>
                  <div className="font-display text-xl font-extrabold text-white truncate">
                    {nearbyCeleb.name} ({nearbyCeleb.title})
                  </div>
                  <p className="text-xs text-slate-300 truncate">{nearbyCeleb.challengeTitle}</p>
                </div>
                <button
                  onClick={() => openCelebrityInteraction(nearbyCeleb)}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Conversar / Desafiar
                </button>
              </div>
            ) : nearbyZone ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold" style={{ color: nearbyZone.accentColor }}>
                      {nearbyZone.shortLabel}
                    </div>
                    <div className="font-display text-xl font-extrabold text-white truncate">
                      {nearbyZone.name}
                    </div>
                    <p className="text-xs text-slate-300">{nearbyZone.subtitle}</p>
                  </div>
                  {(nearbyZone.id === 'street_pitch' ||
                    nearbyZone.id === 'futsal_arena' ||
                    nearbyZone.id === 'academy_stadium' ||
                    (nearbyZone.id === 'main_stadium' && playerCareer.stage === 'pro')) && (
                    <div className="flex items-center gap-1 shrink-0 bg-black/40 p-1 rounded-lg border border-white/10">
                      {(['2v2', '1v1'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setMatchFormat(fmt)}
                          className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            matchFormat === fmt ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {nearbyZone.id === 'street_pitch' && (
                    <button
                      onClick={launchStreetWithCars}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Car className="w-4 h-4" /> Jogar Pelada na Rua (Carros Passando)
                    </button>
                  )}

                  {nearbyZone.id === 'futsal_arena' && (
                    <button
                      onClick={launchFutsalMatch}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Flame className="w-4 h-4" /> Jogar Futsal na Quadra Azul
                    </button>
                  )}

                  {nearbyZone.id === 'academy_stadium' && (
                    <button
                      onClick={handleTriggerInteract}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {playerCareer.stage === 'pro'
                        ? `Jogar Treino no CT (${targetClub.shortCode})`
                        : `Fazer Teste Oficial (Peneira · ${targetClub.shortCode})`}
                    </button>
                  )}

                  {nearbyZone.id === 'main_stadium' && (
                    <>
                      {playerCareer.stage === 'pro' && nextFixture ? (
                        <button
                          onClick={launchProStadiumMatch}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" /> Jogar Rodada {nextFixture.round} vs {nextFixture.opponentName}
                        </button>
                      ) : (
                        <button
                          onClick={() => setSheetTab('league')}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
                        >
                          {playerCareer.stage === 'pro'
                            ? 'Temporada Completa · Abrir Tabela & Propostas'
                            : `Passe na Peneira do ${targetClub.shortCode} (Olheiro: ${playerCareer.scoutInterest}%) para jogar a Liga Pro`}
                        </button>
                      )}
                    </>
                  )}

                  {nearbyZone.id === 'training_plaza' && (
                    <button
                      onClick={() => setSheetTab('training')}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-violet-400 hover:bg-violet-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <TrendingUp className="w-4 h-4" /> Abrir Treino, Tabela & Agenda de Famosos
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Mobile Touch Joystick (Left) */}
        <div
          onTouchStart={handleJoyStart}
          onTouchMove={handleJoyMove}
          onTouchEnd={handleJoyEnd}
          onTouchCancel={handleJoyEnd}
          className="md:hidden absolute bottom-28 left-4 z-20 w-24 h-24 rounded-full bg-black/45 border border-white/20 flex items-center justify-center touch-none"
        >
          <div
            className="w-10 h-10 rounded-full bg-emerald-400/85 border-2 border-white shadow-lg"
            style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
          />
        </div>
      </div>

      {/* Celebrity Dialog & Challenge Modal */}
      {activeCelebModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111D16] border border-amber-400/40 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-amber-300">
                  {activeCelebModal.title} · OVR {activeCelebModal.ovr}
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white">
                  {activeCelebModal.name}
                </h2>
              </div>
              <button
                onClick={() => setActiveCelebModal(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black/35 border border-white/10 rounded-xl p-3.5 text-sm text-slate-200 leading-relaxed">
              {activeCelebModal.greeting}
            </div>

            <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-2">
              <div className="text-xs font-bold text-emerald-400">{activeCelebModal.challengeTitle}</div>
              <p className="text-xs text-slate-300">{activeCelebModal.challengeDesc}</p>
              <div className="text-[11px] text-amber-300 font-semibold">
                Recompensa: +{activeCelebModal.rewardFame} Fama · +{activeCelebModal.rewardSkillPoints} Pontos · +{activeCelebModal.rewardCoins} Moedas
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Formato:</span>
              <div className="flex gap-2">
                {(['2v2', '1v1'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setMatchFormat(fmt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      matchFormat === fmt
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-black/30 text-slate-300 border-white/10'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const c = activeCelebModal;
                  setActiveCelebModal(null);
                  launchCelebrityChallenge(c);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Aceitar Desafio em Campo
              </button>

              {grounds.completedCelebrityIds.includes(activeCelebModal.id) && (
                <button
                  onClick={() => {
                    soundEngine.playTransferSuccess();
                    onUpdatePlayerCareer({
                      ...playerCareer,
                      grounds: {
                        ...grounds,
                        activePartnerCelebrityId: activeCelebModal.id,
                        lastNotice: `${activeCelebModal.name} selecionado como seu parceiro 2v2!`,
                      },
                    });
                    setActiveCelebModal(null);
                  }}
                  className="py-3 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer"
                >
                  Chamar p/ Dupla 2v2
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Player Sheet / Evolution / Celebrities / League Modal */}
      {sheetTab && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-4xl max-h-[90dvh] bg-[#111D16] border border-white/15 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#0D1812]">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'card' as const, label: 'Minha Ficha' },
                    { id: 'training' as const, label: `Evoluir (${playerCareer.skillPoints} pts)` },
                    { id: 'celebrities' as const, label: 'Famosos' },
                    { id: 'league' as const, label: 'Liga & Propostas' },
                  ]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      soundEngine.playClick();
                      setSheetTab(t.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      sheetTab === t.id ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSheetTab(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {sheetTab === 'card' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-5">
                    <PlayerCard
                      player={heroPlayer}
                      team={targetClub}
                      badgeLabel={
                        playerCareer.stage === 'pro'
                          ? playerCareer.squadStatus.toUpperCase()
                          : 'THE GROUNDS'
                      }
                    />
                  </div>
                  <div className="md:col-span-7 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                      <div className="bg-black/35 rounded-xl p-3">
                        <div className="font-mono-tabular text-xl font-extrabold text-amber-300">
                          {grounds.fame}
                        </div>
                        <div className="text-[11px] text-slate-400">Fama nas Ruas</div>
                      </div>
                      <div className="bg-black/35 rounded-xl p-3">
                        <div className="font-mono-tabular text-xl font-extrabold text-emerald-400">
                          {playerCareer.totalGoals}
                        </div>
                        <div className="text-[11px] text-slate-400">Gols Totais</div>
                      </div>
                      <div className="bg-black/35 rounded-xl p-3">
                        <div className="font-mono-tabular text-xl font-extrabold text-sky-300">
                          {grounds.futsalWins}
                        </div>
                        <div className="text-[11px] text-slate-400">Vitórias Futsal</div>
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-amber-400" /> Olheiro {playerCareer.scoutName} ({targetClub.shortCode})
                        </span>
                        <span className="font-mono-tabular text-amber-300">{playerCareer.scoutInterest}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-black/50 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                          style={{ width: `${playerCareer.scoutInterest}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400">
                        {playerCareer.stage === 'pro'
                          ? `Você atua profissionalmente pelo ${targetClub.name}. Vá ao Estádio Monumental para jogar as rodadas!`
                          : playerCareer.scoutInterest >= 100
                            ? `Olheiro pronto! Caminhe até o Estádio da Base para fazer a Peneira Oficial do ${targetClub.name}!`
                            : `Jogue peladas na rua com carros, futsal e desafie famosos para atingir 100% e liberar a Peneira.`}
                      </p>
                    </div>

                    <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-400" /> Parceiro para jogos 2v2
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            onUpdatePlayerCareer({
                              ...playerCareer,
                              grounds: { ...grounds, activePartnerCelebrityId: null },
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            !grounds.activePartnerCelebrityId
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-black/30 text-slate-300 border-white/10'
                          }`}
                        >
                          Juninho da Vila
                        </button>
                        {grounds.completedCelebrityIds.map((cid) => {
                          const cel = CELEBRITY_BY_ID[cid];
                          if (!cel) return null;
                          const active = grounds.activePartnerCelebrityId === cid;
                          return (
                            <button
                              key={cid}
                              onClick={() =>
                                onUpdatePlayerCareer({
                                  ...playerCareer,
                                  grounds: { ...grounds, activePartnerCelebrityId: cid },
                                })
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                                active
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-black/30 text-slate-200 border-white/10'
                              }`}
                            >
                              {cel.name} ({cel.ovr})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sheetTab === 'training' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl font-bold text-white">
                      Evoluir Atributos · OVR {heroPlayer.ovr}
                    </h3>
                    <span className="font-mono-tabular text-sm font-extrabold text-emerald-400">
                      {playerCareer.skillPoints} Pontos Disponíveis
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(
                      [
                        { key: 'pace' as const, label: 'Velocidade (VEL)', val: heroPlayer.pace },
                        { key: 'shot' as const, label: 'Chute (CHU)', val: heroPlayer.shot },
                        { key: 'pass' as const, label: 'Passe (PAS)', val: heroPlayer.pass },
                        { key: 'def' as const, label: 'Defesa (DEF)', val: heroPlayer.def ?? 55 },
                        { key: 'fis' as const, label: 'Físico (FIS)', val: heroPlayer.fis ?? 65 },
                      ]
                    ).map((s) => (
                      <div key={s.key} className="bg-black/35 border border-white/10 rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{s.label}</span>
                          <span className="font-mono-tabular text-lg font-extrabold text-amber-300">
                            {s.val}
                          </span>
                        </div>
                        <button
                          disabled={playerCareer.skillPoints <= 0 || s.val >= 99}
                          onClick={() => handleUpgrade(s.key)}
                          className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-35 text-slate-950 font-extrabold text-xs cursor-pointer"
                        >
                          Treinar (+2)
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sheetTab === 'celebrities' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" /> Famosos em The Grounds
                    </h3>
                    <span className="text-xs text-slate-400">
                      {grounds.completedCelebrityIds.length} / {GROUNDS_CELEBRITIES.length} Desafios Vencidos
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {GROUNDS_CELEBRITIES.map((c) => {
                      const met = grounds.metCelebrityIds.includes(c.id);
                      const done = grounds.completedCelebrityIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className="bg-black/35 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border border-white/40"
                                style={{ backgroundColor: c.primaryColor, color: c.textColor }}
                              >
                                {c.number}
                              </span>
                              <span className="text-sm font-bold text-white truncate">{c.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              {c.title} · {done ? 'Desafio Vencido (Dupla liberada)' : met ? 'Conhecido' : 'Ainda não conhecido'}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSheetTab(null);
                              walkToPoint(c.x, c.y + 38);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Ir até lá
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sheetTab === 'league' && (
                <div className="space-y-5">
                  {playerCareer.stage !== 'pro' ? (
                    <div className="bg-black/35 border border-white/10 rounded-xl p-5 text-center space-y-2">
                      <Trophy className="w-8 h-8 text-amber-400 mx-auto" />
                      <h3 className="font-display text-2xl font-bold text-white">
                        Ainda na Base · {targetClub.name}
                      </h3>
                      <p className="text-xs text-slate-300">
                        Alcance 100% de interesse do olheiro na Rua ou Futsal e vença a Peneira no Estádio da Base para disputar a Liga Profissional!
                      </p>
                    </div>
                  ) : (
                    <>
                      {!nextFixture && (
                        <div className="bg-emerald-500/15 border border-emerald-400/35 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-emerald-200 font-semibold">
                            Temporada {playerCareer.season} concluída! Inicie a próxima temporada ou aceite uma proposta abaixo.
                          </div>
                          <button
                            onClick={() => {
                              soundEngine.playTransferSuccess();
                              onUpdatePlayerCareer(startNextPlayerSeason(playerCareer, teams));
                            }}
                            className="px-3.5 py-2 rounded-lg bg-emerald-500 text-slate-950 font-extrabold text-xs cursor-pointer"
                          >
                            Iniciar Temporada {playerCareer.season + 1}
                          </button>
                        </div>
                      )}

                      {playerCareer.offers.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-amber-300 uppercase">Propostas Recebidas</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {playerCareer.offers.map((offer) => {
                              const c = teams.find((t) => t.id === offer.clubId);
                              return (
                                <div
                                  key={offer.id}
                                  className="bg-black/35 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {c && <ClubCrest team={c} size={28} />}
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white truncate">{offer.clubName}</div>
                                      <div className="text-[11px] text-slate-400">OVR {offer.clubOvr}</div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      soundEngine.playTransferSuccess();
                                      onUpdatePlayerCareer(acceptPlayerOffer(playerCareer, offer.id, teams));
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
                                  >
                                    Assinar
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-white/10 text-slate-400">
                              <th className="py-2 px-2">#</th>
                              <th className="py-2 px-2">Clube</th>
                              <th className="py-2 px-2 text-center">J</th>
                              <th className="py-2 px-2 text-center">V</th>
                              <th className="py-2 px-2 text-center">SG</th>
                              <th className="py-2 px-2 text-right">PTS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedStandings.map((row, idx) => {
                              const t = teams.find((tm) => tm.id === row.teamId);
                              const isMine = row.teamId === playerCareer.clubId;
                              return (
                                <tr
                                  key={row.teamId}
                                  className={`border-b border-white/5 ${
                                    isMine ? 'bg-emerald-500/15 text-white font-bold' : 'text-slate-300'
                                  }`}
                                >
                                  <td className="py-2 px-2 font-mono-tabular">{idx + 1}</td>
                                  <td className="py-2 px-2 flex items-center gap-2">
                                    {t && <ClubCrest team={t} size={18} />}
                                    <span>{t?.name || row.teamId}</span>
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono-tabular">{row.played}</td>
                                  <td className="py-2 px-2 text-center font-mono-tabular">{row.won}</td>
                                  <td className="py-2 px-2 text-center font-mono-tabular">
                                    {row.goalsFor - row.goalsAgainst}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono-tabular text-emerald-300">
                                    {row.points}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {playerCareer.trophies.length > 0 && (
                    <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3 flex items-center gap-2 text-xs text-amber-200">
                      <Award className="w-4 h-4 shrink-0" />
                      <span>Troféus: {playerCareer.trophies.join(' · ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
