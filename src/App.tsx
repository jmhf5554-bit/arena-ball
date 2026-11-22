import React, { useState, useMemo, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import {
  Volume2,
  VolumeX,
  Smartphone,
  ArrowLeft,
  Music,
  Mic,
  Gamepad2,
} from 'lucide-react';
import { getTeamsWithCustomKits, saveCustomKitToStorage } from './data/teams2027';
import { WORLD_CUP_TEAMS } from './data/worldCupTeams';
import {
  ActiveMatchConfig,
  AIDifficulty,
  AppScreen,
  CareerState,
  JogadorProfile,
  KitConfig,
  MatchResult,
  MatchSettings,
  PlayerCareerState,
  ProfileTrophy,
  Team,
  UltimateClubState,
  WorldCupState,
} from './types/game';
import { MatchCanvas } from './components/MatchCanvas';
import { TitleMenuFC } from './components/TitleMenuFC';
import { QuickMatchScreen } from './components/QuickMatchScreen';
import { PreMatchLineupModal } from './components/PreMatchLineupModal';
import { TrainingScreen } from './components/TrainingScreen';
import { KitCustomizerScreen } from './components/KitCustomizerScreen';
import { CareerModeScreen } from './components/CareerModeScreen';
import { PlayerCareerScreen } from './components/PlayerCareerScreen';
import { UltimateCardsScreen } from './components/UltimateCardsScreen';
import { Multiplayer2PScreen } from './components/Multiplayer2PScreen';
import { WorldCupScreen } from './components/WorldCupScreen';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { AuthGateScreen } from './components/AuthGateScreen';
import { AdminPanelModal } from './components/AdminPanelModal';
import { ClubCrest } from './components/ClubCrest';
import {
  TournamentsScreen,
  StandaloneCupState,
  loadStandaloneCup,
  saveStandaloneCup,
} from './components/TournamentsScreen';
import {
  applyCupMatchResult,
  applyRoundResultsToCareer,
  loadCareerSave,
  saveCareerState,
} from './utils/careerEngine';
import {
  applyProMatchResult,
  applyStreetMatchResult,
  applyTrialMatchResult,
  loadPlayerCareer,
  savePlayerCareer,
} from './utils/playerCareerEngine';
import {
  applyWorldCupUserMatchResult,
  loadWorldCupLocal,
  saveWorldCupLocal,
} from './utils/worldCupEngine';
import {
  buildUpdatedCarreira,
  checkHasAnySuperAdmin,
  getCurrentAuthSession,
  getSupabaseClient,
  isSupabaseConfigured,
  loadOrCreateProfileForAuthUser,
  recordSupabaseTwoPlayerMatch,
  signOutSupabase,
  updateJogadorInSupabase,
} from './utils/supabaseClient';
import { soundEngine } from './utils/audio';
import { getConnectedGamepad } from './utils/gamepad';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Erro inesperado' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Arena Bola 2027 UI Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex items-center justify-center p-4 sm:p-6 safe-area-hud">
          <div className="max-w-md w-full bg-[#111D16] border border-rose-400/40 rounded-2xl p-6 text-center space-y-4">
            <h2 className="font-display text-3xl font-extrabold text-white">Ops! Algo travou na tela</h2>
            <p className="text-xs text-slate-300">{this.state.message}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, message: '' });
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Voltar ao Jogo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_SETTINGS: MatchSettings = {
  format: '1v1',
  arenaSize: 'standard',
  withGoalkeeper: false,
  durationSeconds: 120,
  goalLimit: 0,
  difficulty: 'medio',
  mobileControls: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  gamepadEnabled: true,
  muted: false,
  musicEnabled: true,
  narrationEnabled: true,
};

const ULTIMATE_STORAGE_PREFIX = 'arenabola_ultimate_v2';

function getUltimateStorageKey(userId?: string) {
  return userId ? `${ULTIMATE_STORAGE_PREFIX}_${userId}` : ULTIMATE_STORAGE_PREFIX;
}

function createDefaultUltimate(teams: Team[], clubName = 'Arena FC 2027', coins = 100): UltimateClubState {
  const defaultIds = [
    teams.find((t) => t.id === 'fla')?.players[0]?.id,
    teams.find((t) => t.id === 'pal')?.players[0]?.id,
    teams.find((t) => t.id === 'rma')?.players[2]?.id,
    teams.find((t) => t.id === 'bay')?.players[2]?.id,
  ].filter((id): id is string => Boolean(id));

  return {
    clubName,
    coins,
    ownedPlayerIds: defaultIds,
    activeStarterId: defaultIds[0] || teams[0].players[0].id,
    wins: 0,
  };
}

function loadUltimateSave(teams: Team[], userId?: string): UltimateClubState {
  const fallback = createDefaultUltimate(teams);
  if (!userId) return fallback;
  try {
    const raw = localStorage.getItem(getUltimateStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UltimateClubState>;
      if (parsed && Array.isArray(parsed.ownedPlayerIds) && parsed.ownedPlayerIds.length > 0) {
        return {
          clubName: parsed.clubName || fallback.clubName,
          coins: typeof parsed.coins === 'number' ? parsed.coins : fallback.coins,
          ownedPlayerIds: parsed.ownedPlayerIds,
          activeStarterId: parsed.activeStarterId || parsed.ownedPlayerIds[0],
          wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
        };
      }
    }
  } catch {
    // ignore
  }
  return fallback;
}

function normalizeDifficulty(raw: string | undefined): AIDifficulty {
  if (raw === 'facil' || raw === 'amador') return 'facil';
  if (raw === 'dificil' || raw === 'lendario') return 'dificil';
  return 'medio';
}

function ArenaBolaApp() {
  const [teams, setTeams] = useState<Team[]>(() => getTeamsWithCustomKits());
  const [screen, setScreen] = useState<AppScreen>('TITLE');
  const [settings, setSettings] = useState<MatchSettings>(() => {
    try {
      const raw = localStorage.getItem('arenabola_settings_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          format: '1v1',
          arenaSize: parsed.arenaSize === 'compact_stadium' ? 'compact_stadium' : 'standard',
          withGoalkeeper: false,
          difficulty: normalizeDifficulty(parsed.difficulty),
          gamepadEnabled: parsed.gamepadEnabled ?? true,
          musicEnabled: parsed.musicEnabled ?? true,
          narrationEnabled: parsed.narrationEnabled ?? true,
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [career, setCareer] = useState<CareerState | null>(null);
  const [playerCareer, setPlayerCareer] = useState<PlayerCareerState | null>(null);
  const [worldCup, setWorldCup] = useState<WorldCupState | null>(null);
  const [ultimate, setUltimate] = useState<UltimateClubState>(() => createDefaultUltimate(getTeamsWithCustomKits()));
  const [standaloneCup, setStandaloneCup] = useState<StandaloneCupState | null>(null);
  const [connectedGamepadName, setConnectedGamepadName] = useState<string | null>(() =>
    getConnectedGamepad()?.id || null
  );
  const [gamepadScanMessage, setGamepadScanMessage] = useState<string | null>(null);

  const [pendingMatch, setPendingMatch] = useState<ActiveMatchConfig | null>(null);
  const [preMatchReturnScreen, setPreMatchReturnScreen] = useState<AppScreen>('QUICK_MATCH');
  const [quickMatchInitialFormat, setQuickMatchInitialFormat] = useState<'1v1' | '2v2' | 'local_2p'>('1v1');
  const [activeMatch, setActiveMatch] = useState<ActiveMatchConfig | null>(null);
  const [kitTargetTeamId, setKitTargetTeamId] = useState<string>('fla');
  const [kitReturnScreen, setKitReturnScreen] = useState<AppScreen>('TITLE');

  const [authChecking, setAuthChecking] = useState<boolean>(() => isSupabaseConfigured());
  const [profile, setProfile] = useState<JogadorProfile | null>(null);
  const [isProfileOnline, setIsProfileOnline] = useState<boolean>(() => isSupabaseConfigured());
  const [hasAnySuperAdmin, setHasAnySuperAdmin] = useState<boolean>(true);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  const allTeamsAndNations = useMemo(() => [...teams, ...WORLD_CUP_TEAMS], [teams]);

  const hydrateFromProfile = (loaded: JogadorProfile) => {
    const uid = loaded.user_id;
    setProfile(loaded);

    const nextCareer = loaded.carreira?.career ?? loadCareerSave(uid) ?? null;
    if (nextCareer) saveCareerState(nextCareer, uid);
    setCareer(nextCareer);

    const nextPlayerCareer = loaded.carreira?.playerCareer ?? loadPlayerCareer(uid) ?? null;
    if (nextPlayerCareer) savePlayerCareer(nextPlayerCareer, uid);
    setPlayerCareer(nextPlayerCareer);

    const nextWc = loaded.carreira?.worldCup ?? loadWorldCupLocal(uid) ?? null;
    if (nextWc) saveWorldCupLocal(nextWc, uid);
    setWorldCup(nextWc);

    setStandaloneCup(loadStandaloneCup(uid));

    const ultBase = loaded.carreira?.ultimate || loadUltimateSave(teams, uid);
    const nextUlt: UltimateClubState = {
      ...ultBase,
      clubName: ultBase.clubName || `Clube de ${loaded.nome}`,
      coins: loaded.moedas,
      wins: loaded.vitorias,
    };
    setUltimate(nextUlt);
    if (uid) {
      try {
        localStorage.setItem(getUltimateStorageKey(uid), JSON.stringify(nextUlt));
      } catch {
        // ignore
      }
    }
  };

  const resetUserSessionState = () => {
    setProfile(null);
    setCareer(null);
    setPlayerCareer(null);
    setWorldCup(null);
    setStandaloneCup(null);
    setUltimate(createDefaultUltimate(teams));
    setActiveMatch(null);
    setPendingMatch(null);
    setShowProfileModal(false);
    setShowAdminModal(false);
    setScreen('TITLE');
  };

  const handleSignOut = async () => {
    await signOutSupabase();
    resetUserSessionState();
  };

  const persistProfileUpdate = (nextProfile: JogadorProfile) => {
    setProfile(nextProfile);
    void updateJogadorInSupabase(nextProfile).then((res) => {
      setIsProfileOnline(res.isOnline);
      if (res.profile && res.profile.user_id) {
        setProfile(res.profile);
      }
    });
  };

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setAuthChecking(false);
      setIsProfileOnline(false);
      return;
    }

    let active = true;
    void getCurrentAuthSession().then(async (session) => {
      if (!active) return;
      if (session?.user) {
        const res = await loadOrCreateProfileForAuthUser(session.user);
        if (!active) return;
        if (res.profile) {
          hydrateFromProfile(res.profile);
          setIsProfileOnline(true);
        }
      }
      setAuthChecking(false);
    });

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        resetUserSessionState();
        setAuthChecking(false);
      } else if (event === 'SIGNED_IN') {
        void loadOrCreateProfileForAuthUser(session.user).then((res) => {
          if (!active || !res.profile) return;
          setProfile((prev) => {
            if (prev?.user_id === res.profile?.user_id) return prev;
            hydrateFromProfile(res.profile!);
            return res.profile;
          });
          setIsProfileOnline(true);
          setAuthChecking(false);
        });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile?.user_id) return;
    let active = true;
    void checkHasAnySuperAdmin().then((has) => {
      if (active) setHasAnySuperAdmin(has);
    });
    return () => {
      active = false;
    };
  }, [profile?.user_id, profile?.role]);

  // Listen for USB / Bluetooth Gamepad connect & disconnect events
  useEffect(() => {
    const syncPad = () => {
      const pad = getConnectedGamepad();
      setConnectedGamepadName(pad ? pad.id : null);
      if (pad) {
        setGamepadScanMessage(`Controle conectado: ${pad.id}`);
      }
    };
    window.addEventListener('gamepadconnected', syncPad);
    window.addEventListener('gamepaddisconnected', syncPad);
    return () => {
      window.removeEventListener('gamepadconnected', syncPad);
      window.removeEventListener('gamepaddisconnected', syncPad);
    };
  }, []);

  // Sync audio & settings
  useEffect(() => {
    soundEngine.muted = settings.muted;
    soundEngine.musicEnabled = settings.musicEnabled;
    soundEngine.narrationEnabled = settings.narrationEnabled;

    if (settings.muted || !settings.narrationEnabled) {
      soundEngine.stopNarration();
    }

    if (settings.muted || !settings.musicEnabled || screen === 'PLAYING') {
      soundEngine.stopSoundtrack();
    } else {
      soundEngine.startSoundtrack();
    }

    try {
      localStorage.setItem('arenabola_settings_v2', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings, screen]);

  // Unlock browser AudioContext & SpeechSynthesis on first user interaction
  useEffect(() => {
    const unlock = () => {
      soundEngine.unlock();
      if (!settings.muted && settings.musicEnabled && screen !== 'PLAYING') {
        soundEngine.startSoundtrack();
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [settings.muted, settings.musicEnabled, screen]);

  const updateSettings = (patch: Partial<MatchSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateUltimate = (next: UltimateClubState) => {
    setUltimate(next);
    if (profile?.user_id) {
      try {
        localStorage.setItem(getUltimateStorageKey(profile.user_id), JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    if (profile) {
      persistProfileUpdate({
        ...profile,
        moedas: next.coins,
        carreira: buildUpdatedCarreira(profile.carreira, { ultimate: next }),
      });
    }
  };

  const handleSaveKit = (teamId: string, kit: KitConfig) => {
    saveCustomKitToStorage(teamId, kit);
    setTeams(getTeamsWithCustomKits());
  };

  const handleOpenPreMatch = (config: ActiveMatchConfig, returnTo: AppScreen) => {
    if (config.settings.format === 'penalty_shootout') {
      setActiveMatch(config);
      setScreen('PLAYING');
      return;
    }
    setPendingMatch(config);
    setPreMatchReturnScreen(returnTo);
    setScreen('PRE_MATCH');
  };

  const handleStartMatchDirect = (config: ActiveMatchConfig) => {
    soundEngine.stopSoundtrack();
    setActiveMatch(config);
    setScreen('PLAYING');
  };

  const handleClaimWorldCupChampion = (championTeam: Team, wcId: string) => {
    if (!worldCup || worldCup.rewardClaimed) return;
    const rewardedWc: WorldCupState = { ...worldCup, rewardClaimed: true };
    saveWorldCupLocal(rewardedWc, profile?.user_id);
    setWorldCup(rewardedWc);

    const bonusCoins = 1500;
    const nextUlt: UltimateClubState = {
      ...ultimate,
      coins: ultimate.coins + bonusCoins,
    };
    setUltimate(nextUlt);
    if (profile?.user_id) {
      try {
        localStorage.setItem(getUltimateStorageKey(profile.user_id), JSON.stringify(nextUlt));
      } catch {
        // ignore
      }
    }

    if (profile) {
      const trophy: ProfileTrophy = {
        id: `trophy-wc-${wcId}`,
        title: 'Campeão da Copa do Mundo 2027',
        teamId: championTeam.id,
        teamName: championTeam.name,
        type: 'world_cup',
        wonAt: new Date().toISOString(),
      };
      persistProfileUpdate({
        ...profile,
        moedas: profile.moedas + bonusCoins,
        carreira: buildUpdatedCarreira(profile.carreira, {
          worldCup: rewardedWc,
          ultimate: nextUlt,
          addTrophy: trophy,
        }),
      });
    }
  };

  const handleMatchComplete = (result: MatchResult) => {
    const userSide = activeMatch?.humanSide || 'home';
    const userWon = result.winnerSide === userSide;
    const userDrew = result.winnerSide === 'draw';
    const userLost = !userWon && !userDrew;
    const goalsScored = userSide === 'home' ? result.homeGoals : result.awayGoals;
    const goalsConceded = userSide === 'home' ? result.awayGoals : result.homeGoals;
    const coinsReward = userWon ? 250 : userDrew ? 150 : 100;

    // Reward Arena Coins for Ultimate Cards mode on every completed match
    const nextUlt: UltimateClubState = {
      ...ultimate,
      coins: ultimate.coins + coinsReward,
      wins: ultimate.wins + (userWon ? 1 : 0),
    };
    setUltimate(nextUlt);
    if (profile?.user_id) {
      try {
        localStorage.setItem(getUltimateStorageKey(profile.user_id), JSON.stringify(nextUlt));
      } catch {
        // ignore
      }
    }

    let nextCareerState = career;
    let nextPlayerCareerState = playerCareer;
    let nextWorldCupState = worldCup;
    let earnedTrophy: ProfileTrophy | undefined;

    if (result.tournament === 'career_league' && career) {
      nextCareerState = applyRoundResultsToCareer(career, teams, result);
      saveCareerState(nextCareerState, profile?.user_id);
      setCareer(nextCareerState);
    } else if (result.tournament === 'career_continental_cup' && career) {
      nextCareerState = applyCupMatchResult(career, result);
      saveCareerState(nextCareerState, profile?.user_id);
      setCareer(nextCareerState);
    } else if (result.tournament === 'career_continental_final' && career) {
      const won = result.winnerSide === 'home';
      const cupTitle =
        career.continentalQualified === 'libertadores_final'
          ? `Campeão da Libertadores ${career.season}`
          : `Campeão da Sul-Americana ${career.season}`;
      nextCareerState = {
        ...career,
        continentalPlayed: true,
        continentalWon: won,
        trophies: won ? [...career.trophies, cupTitle] : career.trophies,
        budgetMillions: won ? career.budgetMillions + 35 : career.budgetMillions + 10,
      };
      saveCareerState(nextCareerState, profile?.user_id);
      setCareer(nextCareerState);
      if (won) {
        const cTeam = teams.find((t) => t.id === career.teamId);
        earnedTrophy = {
          id: `trophy-career-${career.id}-${career.season}-${career.continentalQualified}`,
          title: cupTitle,
          teamId: career.teamId,
          teamName: cTeam?.name || career.teamId,
          type: career.continentalQualified === 'libertadores_final' ? 'libertadores' : 'sulamericana',
          wonAt: new Date().toISOString(),
        };
      }
    } else if (result.tournament === 'player_career_street' && playerCareer) {
      nextPlayerCareerState = applyStreetMatchResult(playerCareer, result);
      savePlayerCareer(nextPlayerCareerState, profile?.user_id);
      setPlayerCareer(nextPlayerCareerState);
    } else if (result.tournament === 'player_career_trial' && playerCareer) {
      nextPlayerCareerState = applyTrialMatchResult(playerCareer, result, teams);
      savePlayerCareer(nextPlayerCareerState, profile?.user_id);
      setPlayerCareer(nextPlayerCareerState);
    } else if (result.tournament === 'player_career_pro' && playerCareer) {
      nextPlayerCareerState = applyProMatchResult(playerCareer, result, teams);
      savePlayerCareer(nextPlayerCareerState, profile?.user_id);
      setPlayerCareer(nextPlayerCareerState);
    } else if ((result.tournament === 'world_cup_group' || result.tournament === 'world_cup_knockout') && worldCup) {
      nextWorldCupState = applyWorldCupUserMatchResult(worldCup, result);
      saveWorldCupLocal(nextWorldCupState, profile?.user_id);
      setWorldCup(nextWorldCupState);
    }

    // Auto-save coins, wins, draws, losses, goals, goals conceded, and carreira JSONB to Supabase
    if (profile) {
      persistProfileUpdate({
        ...profile,
        moedas: profile.moedas + coinsReward,
        vitorias: profile.vitorias + (userWon ? 1 : 0),
        empates: (profile.empates || 0) + (userDrew ? 1 : 0),
        derrotas: (profile.derrotas || 0) + (userLost ? 1 : 0),
        gols: profile.gols + goalsScored,
        gols_sofridos: (profile.gols_sofridos || 0) + goalsConceded,
        carreira: buildUpdatedCarreira(profile.carreira, {
          career: nextCareerState,
          playerCareer: nextPlayerCareerState,
          worldCup: nextWorldCupState,
          ultimate: nextUlt,
          addTrophy: earnedTrophy,
        }),
      });
    }

    if (
      result.tournament === 'career_league' ||
      result.tournament === 'career_continental_cup' ||
      result.tournament === 'career_continental_final'
    ) {
      setActiveMatch(null);
      setScreen('CAREER_HUB');
      return;
    }

    if (
      result.tournament === 'player_career_street' ||
      result.tournament === 'player_career_trial' ||
      result.tournament === 'player_career_pro'
    ) {
      setActiveMatch(null);
      setScreen('PLAYER_CAREER');
      return;
    }

    if (result.tournament === 'world_cup_group' || result.tournament === 'world_cup_knockout') {
      setActiveMatch(null);
      setScreen('WORLD_CUP');
      return;
    }

    if (result.tournament === 'tournament_cup' && standaloneCup) {
      const nextMatches = standaloneCup.matches.map((m) => ({ ...m }));
      const idx = nextMatches.findIndex((m) => !m.played);
      if (idx !== -1) {
        nextMatches[idx] = {
          ...nextMatches[idx],
          played: true,
          won: userWon,
          userGoals: result.homeGoals,
          oppGoals: result.awayGoals,
        };
      }
      const nextCup: StandaloneCupState = { ...standaloneCup, matches: nextMatches };
      saveStandaloneCup(nextCup, profile?.user_id);
      setStandaloneCup(nextCup);
      setActiveMatch(null);
      setScreen('TOURNAMENTS');
      return;
    }

    if (activeMatch?.settings.format === 'local_2p') {
      void recordSupabaseTwoPlayerMatch({
        mode: 'local_2p',
        player1UserId: typeof activeMatch.player1UserId === 'string' ? activeMatch.player1UserId : profile?.user_id || null,
        player2UserId: typeof activeMatch.player2UserId === 'string' ? activeMatch.player2UserId : null,
        player1Name: activeMatch.player1Name || profile?.nome || 'Jogador 1',
        player2Name: activeMatch.player2Name || 'Jogador 2',
        homeTeamId: activeMatch.homeTeam.id,
        awayTeamId: activeMatch.awayTeam.id,
        homeTeamName: activeMatch.homeTeam.name,
        awayTeamName: activeMatch.awayTeam.name,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
      });
      setActiveMatch(null);
      setScreen(preMatchReturnScreen === 'QUICK_MATCH' ? 'QUICK_MATCH' : 'MULTIPLAYER_2P');
      return;
    }

    if (activeMatch?.settings.format === 'online_2p') {
      if (!activeMatch.onlineRoom || activeMatch.onlineRoom.side === 'home') {
        void recordSupabaseTwoPlayerMatch({
          mode: 'online_2p',
          roomCode: activeMatch.onlineRoom?.roomCode || null,
          player1UserId: typeof activeMatch.player1UserId === 'string' ? activeMatch.player1UserId : profile?.user_id || null,
          player2UserId: typeof activeMatch.player2UserId === 'string' ? activeMatch.player2UserId : null,
          player1Name: activeMatch.player1Name || 'Anfitrião',
          player2Name: activeMatch.player2Name || 'Visitante',
          homeTeamId: activeMatch.homeTeam.id,
          awayTeamId: activeMatch.awayTeam.id,
          homeTeamName: activeMatch.homeTeam.name,
          awayTeamName: activeMatch.awayTeam.name,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
        });
      }
      setActiveMatch(null);
      setScreen('MULTIPLAYER_2P');
      return;
    }

    setActiveMatch(null);
    setScreen('TITLE');
  };

  // ================= MANDATORY SUPABASE AUTH GATE =================
  if (authChecking) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#07100A] text-slate-100 flex items-center justify-center p-6 safe-area-hud">
        <div className="bg-[#111D16] border border-emerald-500/35 rounded-2xl px-8 py-6 text-center space-y-3 shadow-2xl">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-display text-2xl font-extrabold text-white">Arena Bola 2027</div>
          <p className="text-xs text-slate-400">Verificando sessão no Supabase...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <AuthGateScreen
        allTeamsAndNations={allTeamsAndNations}
        onAuthenticated={(loaded) => {
          hydrateFromProfile(loaded);
          setIsProfileOnline(true);
          setScreen('TITLE');
        }}
      />
    );
  }

  // ================= PLAYING VIEW =================
  if (screen === 'PLAYING' && activeMatch) {
    return (
      <div className="w-full h-[100dvh] overflow-hidden bg-[#09150E] safe-area-hud touch-none">
        <MatchCanvas
          config={{
            ...activeMatch,
            settings: {
              ...activeMatch.settings,
              muted: settings.muted,
              mobileControls: settings.mobileControls,
              gamepadEnabled: settings.gamepadEnabled,
              musicEnabled: settings.musicEnabled,
              narrationEnabled: settings.narrationEnabled,
            },
          }}
          onToggleMute={() => updateSettings({ muted: !settings.muted })}
          onToggleMobileControls={() => updateSettings({ mobileControls: !settings.mobileControls })}
          onToggleGamepad={() => updateSettings({ gamepadEnabled: !settings.gamepadEnabled })}
          onExit={() => {
            const wasCareer =
              activeMatch.tournament === 'career_league' ||
              activeMatch.tournament === 'career_continental_cup' ||
              activeMatch.tournament === 'career_continental_final';
            const wasPlayerCareer =
              activeMatch.tournament === 'player_career_street' ||
              activeMatch.tournament === 'player_career_trial' ||
              activeMatch.tournament === 'player_career_pro';
            const wasWorldCup =
              activeMatch.tournament === 'world_cup_group' ||
              activeMatch.tournament === 'world_cup_knockout';
            const wasCup = activeMatch.tournament === 'tournament_cup';
            const wasOnline2P = activeMatch.settings.format === 'online_2p';
            const wasLocal2P = activeMatch.settings.format === 'local_2p';
            setActiveMatch(null);
            setScreen(
              wasCareer
                ? 'CAREER_HUB'
                : wasPlayerCareer
                  ? 'PLAYER_CAREER'
                  : wasWorldCup
                    ? 'WORLD_CUP'
                    : wasCup
                      ? 'TOURNAMENTS'
                      : wasOnline2P
                        ? 'MULTIPLAYER_2P'
                        : wasLocal2P
                          ? preMatchReturnScreen === 'QUICK_MATCH'
                            ? 'QUICK_MATCH'
                            : 'MULTIPLAYER_2P'
                          : 'TITLE'
            );
          }}
          onMatchComplete={handleMatchComplete}
        />
      </div>
    );
  }

  // ================= SUB-SCREENS =================
  if (screen === 'PRE_MATCH' && pendingMatch) {
    return (
      <PreMatchLineupModal
        config={pendingMatch}
        onConfirmKickoff={(finalCfg) => {
          setPendingMatch(null);
          handleStartMatchDirect(finalCfg);
        }}
        onBack={() => setScreen(preMatchReturnScreen)}
      />
    );
  }

  if (screen === 'MULTIPLAYER_2P') {
    return (
      <Multiplayer2PScreen
        teams={teams}
        settings={settings}
        jogadorProfile={profile}
        onStartMatch={(cfg) => {
          setPreMatchReturnScreen('MULTIPLAYER_2P');
          handleStartMatchDirect(cfg);
        }}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'QUICK_MATCH') {
    return (
      <QuickMatchScreen
        teams={allTeamsAndNations}
        settings={settings}
        initialFormat={quickMatchInitialFormat}
        onUpdateSettings={updateSettings}
        onStartMatch={(cfg) => handleOpenPreMatch(cfg, 'QUICK_MATCH')}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'WORLD_CUP') {
    return (
      <WorldCupScreen
        worldCup={worldCup}
        settings={settings}
        onUpdateWorldCup={(nextWc) => {
          saveWorldCupLocal(nextWc, profile.user_id);
          setWorldCup(nextWc);
          persistProfileUpdate({
            ...profile,
            carreira: buildUpdatedCarreira(profile.carreira, { worldCup: nextWc }),
          });
        }}
        onClaimChampionReward={handleClaimWorldCupChampion}
        onStartMatch={(cfg) => handleOpenPreMatch(cfg, 'WORLD_CUP')}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'ULTIMATE_CARDS') {
    return (
      <UltimateCardsScreen
        teams={teams}
        ultimate={ultimate}
        settings={settings}
        onUpdateUltimate={handleUpdateUltimate}
        onStartMatch={(cfg) => handleOpenPreMatch(cfg, 'ULTIMATE_CARDS')}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'TOURNAMENTS') {
    return (
      <TournamentsScreen
        teams={teams}
        cup={standaloneCup}
        settings={settings}
        onUpdateCup={(nextCup) => {
          saveStandaloneCup(nextCup, profile.user_id);
          setStandaloneCup(nextCup);
        }}
        onStartMatch={(cfg) => handleOpenPreMatch(cfg, 'TOURNAMENTS')}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'TRAINING_SETUP') {
    return (
      <TrainingScreen
        teams={teams}
        settings={settings}
        onStartMatch={handleStartMatchDirect}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'PLAYER_CAREER') {
    return (
      <PlayerCareerScreen
        teams={teams}
        playerCareer={playerCareer}
        settings={settings}
        onUpdatePlayerCareer={(next) => {
          savePlayerCareer(next, profile.user_id);
          setPlayerCareer(next);
          persistProfileUpdate({
            ...profile,
            carreira: buildUpdatedCarreira(profile.carreira, { playerCareer: next }),
          });
        }}
        onStartMatch={handleStartMatchDirect}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'KIT_CUSTOMIZER') {
    return (
      <KitCustomizerScreen
        teams={allTeamsAndNations}
        initialTeamId={kitTargetTeamId}
        onSaveKit={handleSaveKit}
        onBack={() => setScreen(kitReturnScreen)}
      />
    );
  }

  if (screen === 'CAREER_SELECT' || screen === 'CAREER_HUB') {
    return (
      <CareerModeScreen
        teams={teams}
        career={career}
        settings={settings}
        onUpdateSettings={updateSettings}
        onSetCareer={(c) => {
          if (c) saveCareerState(c, profile.user_id);
          setCareer(c);
          persistProfileUpdate({
            ...profile,
            carreira: buildUpdatedCarreira(profile.carreira, { career: c }),
          });
          setScreen(c ? 'CAREER_HUB' : 'CAREER_SELECT');
        }}
        onPlayMatch={(cfg) => handleOpenPreMatch(cfg, 'CAREER_HUB')}
        onOpenKitCustomizer={(teamId) => {
          setKitTargetTeamId(teamId);
          setKitReturnScreen('CAREER_HUB');
          setScreen('KIT_CUSTOMIZER');
        }}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'SETTINGS') {
    return (
      <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-[#0D1812]">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                soundEngine.playClick();
                setScreen('TITLE');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Configurações de Jogo
            </h1>
          </div>
        </header>

        <main className="flex-1 max-w-3xl 2xl:max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-5">
          <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white mb-2">Estádio Padrão da Arena</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    updateSettings({ arenaSize: 'standard' });
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-left text-xs font-bold cursor-pointer ${
                    settings.arenaSize !== 'compact_stadium'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-black/30 text-slate-300 border-white/10'
                  }`}
                >
                  Estádio Oficial (Padrão · 2v2 Ampliado)
                </button>
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    updateSettings({ arenaSize: 'compact_stadium' });
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-left text-xs font-bold cursor-pointer ${
                    settings.arenaSize === 'compact_stadium'
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-black/30 text-slate-300 border-white/10'
                  }`}
                >
                  Estádio Compacto (Menor · Drible+)
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-white mb-2">Duração da Partida (90' + Acréscimos)</h2>
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {[120, 180, 300].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => {
                      soundEngine.playClick();
                      updateSettings({ durationSeconds: sec });
                    }}
                    className={`py-2.5 rounded-xl border text-xs font-mono-tabular font-bold cursor-pointer ${
                      settings.durationSeconds === sec
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-black/30 text-slate-300 border-white/10'
                    }`}
                  >
                    {sec / 60} Minutos
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-white mb-2">Dificuldade dos Bots</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                {[
                  { id: 'facil' as AIDifficulty, label: 'Amador (Iniciante)' },
                  { id: 'medio' as AIDifficulty, label: 'Profissional (Equilibrado)' },
                  { id: 'dificil' as AIDifficulty, label: 'Lendário (Tático)' },
                ].map((diff) => (
                  <button
                    key={diff.id}
                    onClick={() => {
                      soundEngine.playClick();
                      updateSettings({ difficulty: diff.id });
                    }}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold cursor-pointer ${
                      settings.difficulty === diff.id
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-black/30 text-slate-300 border-white/10'
                    }`}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  updateSettings({ musicEnabled: !settings.musicEnabled });
                }}
                className={`py-3 px-4 rounded-xl border flex items-center justify-between text-xs font-bold cursor-pointer ${
                  settings.musicEnabled
                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-emerald-400" /> Trilha Sonora Inicial
                </span>
                <span>{settings.musicEnabled ? 'LIGADA' : 'DESLIGADA'}</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick();
                  updateSettings({ narrationEnabled: !settings.narrationEnabled });
                }}
                className={`py-3 px-4 rounded-xl border flex items-center justify-between text-xs font-bold cursor-pointer ${
                  settings.narrationEnabled
                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" /> Narração Brasileira (Voz)
                </span>
                <span>{settings.narrationEnabled ? 'ATIVADA' : 'DESATIVADA'}</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick();
                  updateSettings({ mobileControls: !settings.mobileControls });
                }}
                className={`py-3 px-4 rounded-xl border flex items-center justify-between text-xs font-bold cursor-pointer ${
                  settings.mobileControls
                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" /> Controles Touch (Mobile)
                </span>
                <span>{settings.mobileControls ? 'ATIVADO' : 'DESATIVADO'}</span>
              </button>

              <button
                onClick={() => updateSettings({ muted: !settings.muted })}
                className={`py-3 px-4 rounded-xl border flex items-center justify-between text-xs font-bold cursor-pointer ${
                  !settings.muted
                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  {settings.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  Áudio Geral
                </span>
                <span>{settings.muted ? 'MUDO' : 'LIGADO'}</span>
              </button>
            </div>

            {/* Conectar Controle (USB / Bluetooth Gamepad) */}
            <div className="p-4 rounded-xl bg-black/35 border border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Gamepad2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Conectar Controle (Xbox / PlayStation / USB)</div>
                    <div className="text-[11px] text-slate-400">
                      {connectedGamepadName
                        ? `Detectado: ${connectedGamepadName}`
                        : 'Analógico / D-Pad move · Botões A, X ou R2 chutam · Start pausa'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      const pad = getConnectedGamepad();
                      if (pad) {
                        setConnectedGamepadName(pad.id);
                        updateSettings({ gamepadEnabled: true });
                        setGamepadScanMessage(`Controle conectado e pronto: ${pad.id}`);
                      } else {
                        setGamepadScanMessage(
                          'Nenhum controle detectado ainda. Conecte via USB/Bluetooth e aperte qualquer botão no controle!'
                        );
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Detectar Controle
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      updateSettings({ gamepadEnabled: !settings.gamepadEnabled });
                    }}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer ${
                      settings.gamepadEnabled
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-white/5 border-white/15 text-slate-300'
                    }`}
                  >
                    {settings.gamepadEnabled ? 'ATIVADO' : 'DESATIVADO'}
                  </button>
                </div>
              </div>
              {gamepadScanMessage && (
                <div className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
                  {gamepadScanMessage}
                </div>
              )}
            </div>
            <PWAInstallButton variant="card" />
          </div>
        </main>
      </div>
    );
  }

  // ================= TITLE SCREEN =================
  const careerTeam = career ? teams.find((t) => t.id === career.teamId) || null : null;
  const favTeam =
    allTeamsAndNations.find((t) => t.id === (profile?.time_favorito || 'fla')) ||
    allTeamsAndNations[0];

  return (
    <>
      <TitleMenuFC
        profile={profile}
        favTeam={favTeam}
        career={career}
        careerTeam={careerTeam}
        playerCareer={playerCareer}
        worldCup={worldCup}
        ultimate={ultimate}
        settings={settings}
        connectedGamepadName={connectedGamepadName}
        hasAnySuperAdmin={hasAnySuperAdmin}
        onUpdateSettings={updateSettings}
        onNavigate={(nextScreen, quickFormat) => {
          if (quickFormat) setQuickMatchInitialFormat(quickFormat);
          if (nextScreen === 'KIT_CUSTOMIZER') setKitReturnScreen('TITLE');
          setScreen(nextScreen);
        }}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenAdmin={() => setShowAdminModal(true)}
        onSyncGamepad={(name) => setConnectedGamepadName(name)}
      />

      <PlayerProfileModal
        isOpen={showProfileModal}
        currentProfile={profile}
        allTeamsAndNations={allTeamsAndNations}
        isOnline={isProfileOnline}
        onUpdateProfile={async ({ nome, timeFavoritoId }) => {
          const updated: JogadorProfile = {
            ...profile,
            nome,
            time_favorito: timeFavoritoId,
          };
          persistProfileUpdate(updated);
        }}
        onSignOut={handleSignOut}
        onClose={() => setShowProfileModal(false)}
      />

      <AdminPanelModal
        isOpen={showAdminModal}
        currentProfile={profile}
        hasAnySuperAdmin={hasAnySuperAdmin}
        allTeamsAndNations={allTeamsAndNations}
        onProfileUpdated={(updated) => setProfile(updated)}
        onSuperAdminClaimed={() => setHasAnySuperAdmin(true)}
        onClose={() => setShowAdminModal(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ArenaBolaApp />
      <OfflineIndicator />
    </AppErrorBoundary>
  );
}
