import React, { useState, useMemo, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import {
  Play,
  Trophy,
  Target,
  Shirt,
  Settings as SettingsIcon,
  Briefcase,
  Volume2,
  VolumeX,
  Smartphone,
  ArrowLeft,
  Music,
  Mic,
  Sparkles,
  Award,
  Gamepad2,
  Users,
  Database,
  Flame,
} from 'lucide-react';
import { getTeamsWithCustomKits, saveCustomKitToStorage } from './data/teams2027';
import {
  ActiveMatchConfig,
  AIDifficulty,
  AppScreen,
  CareerState,
  KitConfig,
  MatchFormat,
  MatchResult,
  MatchSettings,
  PublicUser,
  Team,
  UltimateClubState,
} from './types/game';
import { MatchCanvas } from './components/MatchCanvas';
import { QuickMatchScreen } from './components/QuickMatchScreen';
import { PreMatchLineupModal } from './components/PreMatchLineupModal';
import { TrainingScreen } from './components/TrainingScreen';
import { KitCustomizerScreen } from './components/KitCustomizerScreen';
import { CareerModeScreen } from './components/CareerModeScreen';
import { UltimateCardsScreen } from './components/UltimateCardsScreen';
import { Multiplayer2PScreen } from './components/Multiplayer2PScreen';
import { OneTouchScreen } from './components/OneTouchScreen';
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
import { soundEngine } from './utils/audio';
import { getConnectedGamepad } from './utils/gamepad';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import bolasDeFogoCover from './assets/images/bolas_de_fogo_cover_1795176962899.jpg';

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

const ULTIMATE_STORAGE_KEY = 'arenabola_ultimate_v1';

function loadUltimateSave(teams: Team[]): UltimateClubState {
  const defaultIds = [
    teams.find((t) => t.id === 'fla')?.players[0]?.id,
    teams.find((t) => t.id === 'pal')?.players[0]?.id,
    teams.find((t) => t.id === 'rma')?.players[2]?.id,
    teams.find((t) => t.id === 'bay')?.players[2]?.id,
  ].filter((id): id is string => Boolean(id));

  try {
    const raw = localStorage.getItem(ULTIMATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UltimateClubState>;
      if (parsed && Array.isArray(parsed.ownedPlayerIds) && parsed.ownedPlayerIds.length > 0) {
        return {
          clubName: parsed.clubName || 'Arena FC 2027',
          coins: typeof parsed.coins === 'number' ? parsed.coins : 700,
          ownedPlayerIds: parsed.ownedPlayerIds,
          activeStarterId: parsed.activeStarterId || parsed.ownedPlayerIds[0],
          wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
        };
      }
    }
  } catch {
    // ignore
  }

  return {
    clubName: 'Arena FC 2027',
    coins: 750,
    ownedPlayerIds: defaultIds,
    activeStarterId: defaultIds[0] || teams[0].players[0].id,
    wins: 0,
  };
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

  const [career, setCareer] = useState<CareerState | null>(() => loadCareerSave());
  const [ultimate, setUltimate] = useState<UltimateClubState>(() => loadUltimateSave(getTeamsWithCustomKits()));
  const [standaloneCup, setStandaloneCup] = useState<StandaloneCupState | null>(() => loadStandaloneCup());
  const [connectedGamepadName, setConnectedGamepadName] = useState<string | null>(() =>
    getConnectedGamepad()?.id || null
  );
  const [gamepadScanMessage, setGamepadScanMessage] = useState<string | null>(null);

  const [pendingMatch, setPendingMatch] = useState<ActiveMatchConfig | null>(null);
  const [preMatchReturnScreen, setPreMatchReturnScreen] = useState<AppScreen>('QUICK_MATCH');
  const [activeMatch, setActiveMatch] = useState<ActiveMatchConfig | null>(null);
  const [kitTargetTeamId, setKitTargetTeamId] = useState<string>('fla');
  const [kitReturnScreen, setKitReturnScreen] = useState<AppScreen>('TITLE');
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('arena_bola_auth_token_v1');
    } catch {
      return null;
    }
  });
  const [authUser, setAuthUser] = useState<PublicUser | null>(null);

  const handleAuthChange = (user: PublicUser | null, token: string | null) => {
    setAuthUser(user);
    setAuthToken(token);
    try {
      if (token) localStorage.setItem('arena_bola_auth_token_v1', token);
      else localStorage.removeItem('arena_bola_auth_token_v1');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!authToken) return;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: PublicUser } | null) => {
        if (data?.user) setAuthUser(data.user);
        else handleAuthChange(null, null);
      })
      .catch(() => {
        // ignore transient network errors
      });
  }, [authToken]);

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
      if (!settings.muted && settings.musicEnabled && screen !== 'PLAYING' && screen !== 'ONE_TOUCH') {
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
    try {
      localStorage.setItem(ULTIMATE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
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

  const handleMatchComplete = (result: MatchResult) => {
    const userSide = activeMatch?.humanSide || 'home';
    const userWon = result.winnerSide === userSide;

    // Reward Arena Coins for Ultimate Cards mode on every completed match
    handleUpdateUltimate({
      ...ultimate,
      coins: ultimate.coins + (userWon ? 250 : 100),
      wins: ultimate.wins + (userWon ? 1 : 0),
    });

    if (result.tournament === 'career_league' && career) {
      const updated = applyRoundResultsToCareer(career, teams, result);
      setCareer(updated);
      setActiveMatch(null);
      setScreen('CAREER_HUB');
      return;
    }

    if (result.tournament === 'career_continental_cup' && career) {
      const updated = applyCupMatchResult(career, result);
      setCareer(updated);
      setActiveMatch(null);
      setScreen('CAREER_HUB');
      return;
    }

    if (result.tournament === 'career_continental_final' && career) {
      const won = result.winnerSide === 'home';
      const cupTitle =
        career.continentalQualified === 'libertadores_final'
          ? `Campeão da Libertadores ${career.season}`
          : `Campeão da Sul-Americana ${career.season}`;
      const updated: CareerState = {
        ...career,
        continentalPlayed: true,
        continentalWon: won,
        trophies: won ? [...career.trophies, cupTitle] : career.trophies,
        budgetMillions: won ? career.budgetMillions + 35 : career.budgetMillions + 10,
      };
      saveCareerState(updated);
      setCareer(updated);
      setActiveMatch(null);
      setScreen('CAREER_HUB');
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
      saveStandaloneCup(nextCup);
      setStandaloneCup(nextCup);
      setActiveMatch(null);
      setScreen('TOURNAMENTS');
      return;
    }

    if (activeMatch?.settings.format === 'local_2p') {
      void fetch('/api/matches/local-2p', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1UserId: activeMatch.player1UserId || null,
          player2UserId: activeMatch.player2UserId || null,
          player1Name: activeMatch.player1Name || 'Jogador 1',
          player2Name: activeMatch.player2Name || 'Jogador 2',
          homeTeamId: activeMatch.homeTeam.id,
          awayTeamId: activeMatch.awayTeam.id,
          homeTeamName: activeMatch.homeTeam.name,
          awayTeamName: activeMatch.awayTeam.name,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
        }),
      }).then(() => {
        if (authToken) {
          fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
            .then((r) => (r.ok ? r.json() : null))
            .then((d: { user?: PublicUser } | null) => {
              if (d?.user) setAuthUser(d.user);
            })
            .catch(() => {});
        }
      });
      setActiveMatch(null);
      setScreen('MULTIPLAYER_2P');
      return;
    }

    if (activeMatch?.settings.format === 'online_2p') {
      if (authToken) {
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { user?: PublicUser } | null) => {
            if (d?.user) setAuthUser(d.user);
          })
          .catch(() => {});
      }
      setActiveMatch(null);
      setScreen('MULTIPLAYER_2P');
      return;
    }

    setActiveMatch(null);
    setScreen('TITLE');
  };

  const demoMatchConfig: ActiveMatchConfig = useMemo(
    () => ({
      tournament: 'libertadores_final',
      tournamentLabel: 'Final da Libertadores 2027',
      homeTeam: teams.find((t) => t.id === 'fla') || teams[0],
      awayTeam: teams.find((t) => t.id === 'fcb') || teams[1],
      humanSide: 'home',
      settings: {
        ...settings,
        format: '1v1',
        withGoalkeeper: false,
        durationSeconds: 999,
        difficulty: 'medio',
      },
    }),
    [teams, settings]
  );

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
            const wasCup = activeMatch.tournament === 'tournament_cup';
            const was2P =
              activeMatch.settings.format === 'local_2p' ||
              activeMatch.settings.format === 'online_2p';
            setActiveMatch(null);
            setScreen(
              wasCareer ? 'CAREER_HUB' : wasCup ? 'TOURNAMENTS' : was2P ? 'MULTIPLAYER_2P' : 'TITLE'
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
        authUser={authUser}
        authToken={authToken}
        onAuthChange={handleAuthChange}
        onStartMatch={handleStartMatchDirect}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'QUICK_MATCH') {
    return (
      <QuickMatchScreen
        teams={teams}
        settings={settings}
        onUpdateSettings={updateSettings}
        onStartMatch={(cfg) => handleOpenPreMatch(cfg, 'QUICK_MATCH')}
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
        onUpdateCup={setStandaloneCup}
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

  if (screen === 'ONE_TOUCH') {
    return (
      <OneTouchScreen
        teams={teams}
        settings={settings}
        onUpdateSettings={updateSettings}
        onBack={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'KIT_CUSTOMIZER') {
    return (
      <KitCustomizerScreen
        teams={teams}
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
          setCareer(c);
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
    const activeFormat: MatchFormat =
      settings.format === 'training_solo' ||
      settings.format === 'training_1v1' ||
      settings.format === 'penalty_shootout'
        ? '1v1'
        : settings.format;

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
              <h2 className="text-sm font-bold text-white mb-1">Formato em Campo</h2>
              <p className="text-xs text-slate-400">
                Modo 1v1 puro: apenas 2 jogadores em campo (1 jogador seu contra 1 adversário).
              </p>
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
  const careerTeam = career ? teams.find((t) => t.id === career.teamId) : null;

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#07100A] text-slate-100 safe-area-hud">
      <div className="absolute inset-0 opacity-65 pointer-events-none scale-105">
        <MatchCanvas config={demoMatchConfig} isBackgroundDemo />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-[#060F09]/95 via-[#07130C]/85 to-[#07130C]/65 pointer-events-none" />

      <div className="relative z-10 h-full max-w-7xl 2xl:max-w-[1480px] mx-auto px-4 sm:px-8 lg:px-10 py-3.5 sm:py-5 flex flex-col justify-between overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] sm:text-xs font-medium text-slate-300 tracking-wide">
            Temporada Licenciada 2027 · Brasileirão · Argentina · Equador · Colômbia · La Liga · Premier · Bundesliga
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                soundEngine.playClick();
                setScreen('MULTIPLAYER_2P');
              }}
              title="Contas SQLite e Modo 2 Jogadores"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                authUser
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-black/50 border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{authUser ? authUser.displayName : 'Entrar (SQLite)'}</span>
            </button>
            <PWAInstallButton variant="compact" />
            <button
              onClick={() => {
                soundEngine.playClick();
                const pad = getConnectedGamepad();
                if (pad) {
                  setConnectedGamepadName(pad.id);
                  updateSettings({ gamepadEnabled: true });
                } else {
                  setScreen('SETTINGS');
                }
              }}
              title="Conectar Controle"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                connectedGamepadName && settings.gamepadEnabled
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-black/50 border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {connectedGamepadName ? 'Controle ON' : 'Conectar Controle'}
              </span>
            </button>
            <button
              onClick={() => updateSettings({ musicEnabled: !settings.musicEnabled })}
              title="Trilha Sonora"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                settings.musicEnabled && !settings.muted
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-black/50 border-white/15 text-slate-300'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Música</span>
            </button>
            <button
              onClick={() => updateSettings({ narrationEnabled: !settings.narrationEnabled })}
              title="Narração Brasileira"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                settings.narrationEnabled && !settings.muted
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                  : 'bg-black/50 border-white/15 text-slate-300'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Narração</span>
            </button>
            <button
              onClick={() => updateSettings({ mobileControls: !settings.mobileControls })}
              title="Alternar Controles Mobile"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                settings.mobileControls
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-black/50 border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Touch {settings.mobileControls ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => updateSettings({ muted: !settings.muted })}
              title={settings.muted ? 'Ativar Som' : 'Silenciar'}
              className="p-2 rounded-lg bg-black/50 border border-white/15 text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
            >
              {settings.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="my-auto grid grid-cols-1 lg:grid-cols-12 items-center gap-5 lg:gap-8 py-3 sm:py-4">
          <div className="lg:col-span-6 space-y-4 sm:space-y-5">
            <div>
              <svg
                viewBox="0 0 420 92"
                className="w-full max-w-[270px] sm:max-w-[350px] 2xl:max-w-[400px] h-auto drop-shadow-lg"
                aria-label="Arena Bola 2027"
              >
                <g transform="translate(8, 10)">
                  <circle cx="34" cy="36" r="30" fill="#10B981" stroke="#F8FAFC" strokeWidth="4" />
                  <polygon points="34,19 46,28 41,43 27,43 22,28" fill="#09120D" />
                  <circle cx="34" cy="6" r="5" fill="#FACC15" />
                </g>
                <text
                  x="88"
                  y="48"
                  fill="#FFFFFF"
                  fontFamily="Barlow Condensed, sans-serif"
                  fontWeight="800"
                  fontSize="48"
                  letterSpacing="1.5"
                >
                  ARENA BOLA
                </text>
                <text
                  x="90"
                  y="76"
                  fill="#34D399"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  fontSize="15"
                  letterSpacing="3.5"
                >
                  EDIÇÃO 2027 · BOLAS DE FOGO
                </text>
              </svg>
              <p className="text-sm text-slate-300 mt-1.5 max-w-lg leading-relaxed">
                Futebol 1v1 estilo FIFA & EA FC com Modo Carreira completo, narração de TV em português, replay do gol, pênaltis e física real por atributos.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setScreen('QUICK_MATCH');
                }}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <Trophy className="w-6 h-6 shrink-0" />
                  <div className="text-left">
                    <div className="font-display text-2xl font-extrabold leading-none">Jogo Rápido (1v1 & Pênaltis)</div>
                    <div className="text-xs font-semibold text-slate-900/80 mt-0.5">
                      Libertadores · Sul-Americana · Amistoso 2027 · Disputa de Pênaltis
                    </div>
                  </div>
                </div>
                <Play className="w-5 h-5 fill-current group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playClick();
                    setScreen('MULTIPLAYER_2P');
                  }}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#12261B] hover:bg-[#173223] border border-emerald-400/45 text-white shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <div className="font-display text-xl font-extrabold leading-none">
                        Jogar de Dois (2P)
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Online · Local · SQLite
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-300">2P</span>
                </button>

                <button
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playClick();
                    setScreen('ONE_TOUCH');
                  }}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#221411] hover:bg-[#2E1A15] border border-rose-400/50 text-white shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Flame className="w-5 h-5 text-rose-400 shrink-0" />
                    <div className="text-left">
                      <div className="font-display text-xl font-extrabold leading-none">
                        1 Toque (Gol a Gol)
                      </div>
                      <div className="text-[11px] text-rose-200/80 mt-0.5">
                        5 Vidas · Sem Domínio
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-rose-300">NOVO</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setScreen(career ? 'CAREER_HUB' : 'CAREER_SELECT');
                  }}
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#111D16]/95 hover:bg-[#16271D] border border-white/15 hover:border-emerald-400/50 text-white transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-amber-400 shrink-0" />
                    <div className="text-left">
                      <div className="font-display text-xl font-bold leading-none">
                        {career ? `Carreira (${careerTeam?.shortCode || 'Clube'})` : 'Modo Carreira'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Elenco · Tática · Mercado
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-300">
                    {career ? `R${Math.min(career.currentRound, career.totalRounds)}` : 'Novo'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setScreen('ULTIMATE_CARDS');
                  }}
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#111D16]/95 hover:bg-[#16271D] border border-amber-400/30 hover:border-amber-400 text-white transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                    <div className="text-left">
                      <div className="font-display text-xl font-bold leading-none">Time de Cartas 2027</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        OVR · Pacotes · Atributos
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono-tabular font-bold text-amber-300">
                    {ultimate.coins}c
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setScreen('TOURNAMENTS');
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#111D16]/90 hover:bg-[#16271D] border border-white/15 text-left transition-colors cursor-pointer"
                >
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Torneios</div>
                    <div className="text-[11px] text-slate-400">Copas FIFA</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setScreen('TRAINING_SETUP');
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#111D16]/90 hover:bg-[#16271D] border border-white/15 text-left transition-colors cursor-pointer"
                >
                  <Target className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Modo Treino</div>
                    <div className="text-[11px] text-slate-400">Solo & 1v1</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setKitReturnScreen('TITLE');
                    setScreen('KIT_CUSTOMIZER');
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#111D16]/90 hover:bg-[#16271D] border border-white/15 text-left transition-colors cursor-pointer"
                >
                  <Shirt className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Uniformes</div>
                    <div className="text-[11px] text-slate-400">Customizar</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setScreen('SETTINGS');
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#111D16]/90 hover:bg-[#16271D] border border-white/15 text-left transition-colors cursor-pointer"
                >
                  <SettingsIcon className="w-4 h-4 text-slate-300 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Configurações</div>
                    <div className="text-[11px] text-slate-400">Áudio & IA</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-2xl overflow-hidden border border-amber-400/35 bg-gradient-to-br from-[#0F2418] to-[#08120C] shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={bolasDeFogoCover}
                  alt="Capa oficial Bolas de Fogo: O Duelo das Esferas — Flamengo x Palmeiras"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover block"
                />
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#09120D]/95 border-t border-white/10 text-xs">
                <span className="font-display text-sm font-bold tracking-wide text-amber-300 uppercase">
                  Bolas de Fogo · O Duelo das Esferas
                </span>
                <span className="text-[11px] text-slate-400">
                  Transmissão Broadcast 2027
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>W, A, S, D Mover · Espaço Chutar · Esc Pausar</span>
          <span>Versão Web · Pronta para Mobile Touch</span>
        </div>
      </div>
    </div>
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
