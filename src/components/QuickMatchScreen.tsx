import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Play,
  Shield,
  Shuffle,
  Star,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { LEAGUES } from '../data/teams2027';
import {
  ActiveMatchConfig,
  AIDifficulty,
  LeagueId,
  MatchFormat,
  MatchSettings,
  Team,
  TournamentType,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

interface QuickMatchScreenProps {
  teams: Team[];
  settings: MatchSettings;
  initialFormat?: '1v1' | '2v2' | 'local_2p';
  onUpdateSettings: (patch: Partial<MatchSettings>) => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

interface RegionInfo {
  id: LeagueId;
  country: string;
  leagueLabel: string;
}

const REGION_LIST: RegionInfo[] = [
  { id: 'brasileirao', country: 'BRASIL', leagueLabel: 'BRASILEIRÃO SÉRIE A' },
  { id: 'argentina', country: 'ARGENTINA', leagueLabel: 'LIGA PROFISSIONAL ARG' },
  { id: 'ecuador', country: 'EQUADOR', leagueLabel: 'LIGAPRO EQUADOR' },
  { id: 'colombia', country: 'COLÔMBIA', leagueLabel: 'LIGA BETPLAY COLÔMBIA' },
  { id: 'laliga', country: 'ESPANHA', leagueLabel: 'LALIGA EA SPORTS' },
  { id: 'premier', country: 'INGLATERRA', leagueLabel: 'PREMIER LEAGUE' },
  { id: 'bundesliga', country: 'ALEMANHA', leagueLabel: 'BUNDESLIGA' },
  { id: 'selecoes', country: 'MUNDO · FIFA', leagueLabel: 'SELEÇÕES COPA DO MUNDO' },
];

function computeTeamSectorRatings(team: Team): { ata: number; mei: number; def: number; stars: number } {
  const ataPlayers = team.players.filter((p) => p.position === 'ATA');
  const meiPlayers = team.players.filter((p) => p.position === 'MEI');
  const defPlayers = team.players.filter((p) => p.position === 'ZAG');

  const avg = (arr: typeof team.players, field: 'ovr' | 'shot' | 'pass', fallback: number) =>
    arr.length > 0
      ? Math.round(arr.reduce((sum, item) => sum + item[field], 0) / arr.length)
      : fallback;

  const ata = avg(ataPlayers, 'ovr', Math.min(99, team.ovr + 1));
  const mei = avg(meiPlayers, 'ovr', team.ovr);
  const def = avg(defPlayers, 'ovr', Math.max(60, team.ovr - 1));

  const stars =
    team.ovr >= 88 ? 5 : team.ovr >= 84 ? 4.5 : team.ovr >= 80 ? 4 : team.ovr >= 76 ? 3.5 : 3;

  return { ata, mei, def, stars };
}

const RegionFlagSVG: React.FC<{ leagueId: LeagueId }> = ({ leagueId }) => {
  switch (leagueId) {
    case 'brasileirao':
      return (
        <svg viewBox="0 0 36 24" className="w-8 h-5 rounded-[2px] border border-white/20 shrink-0">
          <rect width="36" height="24" fill="#009C3B" />
          <polygon points="18,3 32,12 18,21 4,12" fill="#FFDF00" />
          <circle cx="18" cy="12" r="5" fill="#002776" />
        </svg>
      );
    case 'argentina':
      return (
        <svg viewBox="0 0 36 24" className="w-8 h-5 rounded-[2px] border border-white/20 shrink-0">
          <rect width="36" height="8" y="0" fill="#74ACDF" />
          <rect width="36" height="8" y="8" fill="#FFFFFF" />
          <rect width="36" height="8" y="16" fill="#74ACDF" />
          <circle cx="18" cy="12" r="2.6" fill="#F6B40E" />
        </svg>
      );
    case 'ecuador':
      return (
        <svg viewBox="0 0 36 24" className="w-8 h-5 rounded-[2px] border border-white/20 shrink-0">
          <rect width="36" height="12" y="0" fill="#FFD100" />
          <rect width="36" height="6" y="12" fill="#0033A0" />
          <rect width="36" height="6" y="18" fill="#EF3340" />
        </svg>
      );
    case 'colombia':
      return (
        <svg viewBox="0 0 36 24" className="w-8 h-5 rounded-[2px] border border-white/20 shrink-0">
          <rect width="36" height="12" y="0" fill="#FCD116" />
          <rect width="36" height="6" y="12" fill="#003893" />
          <rect width="36" height="6" y="18" fill="#CE1126" />
        </svg>
      );
    case 'laliga':
      return (
        <svg viewBox="0 0 36 24" className="w-8 h-5 rounded-[2px] border border-white/20 shrink-0">
          <rect width="36" height="6" y="0" fill="#AA151B" />
          <rect width="36" height="12" y="6" fill="#F1BF00" />
          <rect width="36" height="6" y="18" fill="#AA151B" />
          <rect width="5" height="7" x="8" y="8.5" rx="1" fill="#AA151B" />
        </svg>
      );
    case 'premier':
      return (
        <svg viewBox="0 0 36 24" className="w-8 h-5 rounded-[2px] border border-white/20 shrink-0">
          <rect width="36" height="24" fill="#FFFFFF" />
          <rect width="36" height="4.5" y="9.75" fill="#CE1124" />
          <rect width="5" height="24" x="15.5" fill="#CE1124" />
        </svg>
      );
    case 'bundesliga':
      return (
        <svg viewBox="0 0 36 24" className="w-8 h-5 rounded-[2px] border border-white/20 shrink-0">
          <rect width="36" height="8" y="0" fill="#111111" />
          <rect width="36" height="8" y="8" fill="#DD0000" />
          <rect width="36" height="8" y="16" fill="#FFCE00" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 36 24" className="w-8 h-5 rounded-[2px] border border-white/20 shrink-0">
          <rect width="36" height="24" fill="#0F2D6B" />
          <circle cx="18" cy="12" r="6.5" fill="none" stroke="#FACC15" strokeWidth="1.6" />
          <line x1="11.5" y1="12" x2="24.5" y2="12" stroke="#FACC15" strokeWidth="1.2" />
          <ellipse cx="18" cy="12" rx="3" ry="6.5" fill="none" stroke="#FACC15" strokeWidth="1.2" />
        </svg>
      );
  }
};

export const QuickMatchScreen: React.FC<QuickMatchScreenProps> = ({
  teams,
  settings,
  initialFormat = '1v1',
  onUpdateSettings,
  onStartMatch,
  onBack,
}) => {
  const [selectedCup, setSelectedCup] = useState<'libertadores' | 'sulamericana' | 'friendly' | 'penalties'>(
    initialFormat === 'local_2p' ? 'friendly' : 'friendly'
  );
  const [finalConfirmed, setFinalConfirmed] = useState<
    'libertadores_final' | 'sulamericana_final' | 'friendly' | 'penalty_shootout'
  >('friendly');
  const [playMode, setPlayMode] = useState<'1v1' | '2v2' | 'local_2p'>(initialFormat);
  const [player1Name, setPlayer1Name] = useState('Jogador 1');
  const [player2Name, setPlayer2Name] = useState('Jogador 2');
  const [homeLeague, setHomeLeague] = useState<LeagueId>('brasileirao');
  const [awayLeague, setAwayLeague] = useState<LeagueId>('brasileirao');
  const [homeTeamId, setHomeTeamId] = useState<string>('fla');
  const [awayTeamId, setAwayTeamId] = useState<string>('pal');
  const [focusedSide, setFocusedSide] = useState<'home' | 'away'>('home');
  const [gridDrawerSide, setGridDrawerSide] = useState<'home' | 'away' | null>(null);

  const homeTeam = teams.find((t) => t.id === homeTeamId) || teams[0];
  const awayTeam = teams.find((t) => t.id === awayTeamId) || teams[1];
  const currentArenaSize = settings.arenaSize === 'compact_stadium' ? 'compact_stadium' : 'standard';

  const handleSelectCup = (cup: 'libertadores' | 'sulamericana' | 'friendly' | 'penalties') => {
    soundEngine.playClick();
    setSelectedCup(cup);
    if (cup === 'libertadores') {
      setFinalConfirmed('libertadores_final');
      setHomeLeague('brasileirao');
      setAwayLeague('brasileirao');
      setHomeTeamId('fla');
      setAwayTeamId('pal');
    } else if (cup === 'sulamericana') {
      setFinalConfirmed('sulamericana_final');
      setHomeLeague('brasileirao');
      setAwayLeague('brasileirao');
      setHomeTeamId('cru');
      setAwayTeamId('cor');
    } else if (cup === 'penalties') {
      setFinalConfirmed('penalty_shootout');
    } else {
      setFinalConfirmed('friendly');
    }
  };

  const handleSwapTeams = () => {
    soundEngine.playClick();
    setHomeTeamId(awayTeam.id);
    setAwayTeamId(homeTeam.id);
    setHomeLeague(awayTeam.leagueId);
    setAwayLeague(homeTeam.leagueId);
  };

  const handleRandomTeams = () => {
    soundEngine.playClick();
    if (teams.length < 2) return;
    const hIdx = Math.floor(Math.random() * teams.length);
    let aIdx = Math.floor(Math.random() * teams.length);
    if (aIdx === hIdx) aIdx = (hIdx + 1) % teams.length;
    const nextHome = teams[hIdx];
    const nextAway = teams[aIdx];
    setHomeLeague(nextHome.leagueId);
    setAwayLeague(nextAway.leagueId);
    setHomeTeamId(nextHome.id);
    setAwayTeamId(nextAway.id);
  };

  const cycleLeague = (side: 'home' | 'away', dir: 1 | -1) => {
    soundEngine.playClick();
    const curLeague = side === 'home' ? homeLeague : awayLeague;
    const idx = REGION_LIST.findIndex((r) => r.id === curLeague);
    const nextRegion = REGION_LIST[(idx + dir + REGION_LIST.length) % REGION_LIST.length];
    const leagueClubs = teams.filter((t) => t.leagueId === nextRegion.id);
    const firstTeam = leagueClubs[0];
    if (side === 'home') {
      setFocusedSide('home');
      setHomeLeague(nextRegion.id);
      if (firstTeam) setHomeTeamId(firstTeam.id);
    } else {
      setFocusedSide('away');
      setAwayLeague(nextRegion.id);
      if (firstTeam) setAwayTeamId(firstTeam.id);
    }
  };

  const cycleTeam = (side: 'home' | 'away', dir: 1 | -1) => {
    soundEngine.playClick();
    const leagueId = side === 'home' ? homeLeague : awayLeague;
    const currentId = side === 'home' ? homeTeam.id : awayTeam.id;
    const leagueClubs = teams.filter((t) => t.leagueId === leagueId);
    if (leagueClubs.length === 0) return;
    const idx = Math.max(0, leagueClubs.findIndex((t) => t.id === currentId));
    const nextTeam = leagueClubs[(idx + dir + leagueClubs.length) % leagueClubs.length];
    if (side === 'home') {
      setFocusedSide('home');
      setHomeTeamId(nextTeam.id);
    } else {
      setFocusedSide('away');
      setAwayTeamId(nextTeam.id);
    }
  };

  const handleStart = () => {
    soundEngine.playClick();
    const isPenalties = finalConfirmed === 'penalty_shootout';
    const isLocal2P = !isPenalties && playMode === 'local_2p';
    const is2v2 = !isPenalties && playMode === '2v2';
    const tournament: TournamentType = finalConfirmed;
    const baseLabel =
      tournament === 'libertadores_final'
        ? 'Final da Libertadores 2027'
        : tournament === 'sulamericana_final'
          ? 'Final da Sul-Americana 2027'
          : tournament === 'penalty_shootout'
            ? 'Disputa de Pênaltis 2027'
            : 'Partida Clássica 2027';

    const format: MatchFormat = isPenalties
      ? 'penalty_shootout'
      : isLocal2P
        ? 'local_2p'
        : is2v2
          ? '2v2'
          : '1v1';

    onStartMatch({
      tournament,
      tournamentLabel: isLocal2P
        ? `Duelo Local 2P · ${baseLabel}`
        : is2v2
          ? `2v2 (4 em Campo) · ${baseLabel}`
          : baseLabel,
      homeTeam,
      awayTeam,
      humanSide: 'home',
      player1Name: isLocal2P ? player1Name.trim() || 'Jogador 1' : undefined,
      player2Name: isLocal2P ? player2Name.trim() || 'Jogador 2' : undefined,
      settings: {
        ...settings,
        format,
        arenaSize: currentArenaSize,
        withGoalkeeper: false,
      },
    });
  };

  const difficulties: { id: AIDifficulty; label: string }[] = [
    { id: 'facil', label: 'Amador' },
    { id: 'medio', label: 'Profissional' },
    { id: 'dificil', label: 'Lendário' },
  ];

  const activeDifficultyLabel =
    difficulties.find((d) => d.id === settings.difficulty)?.label.toUpperCase() || 'PROFISSIONAL';
  const isLocal2P = selectedCup !== 'penalties' && playMode === 'local_2p';
  const is2v2 = selectedCup !== 'penalties' && playMode === '2v2';

  const headerTitle =
    selectedCup === 'libertadores'
      ? 'FINAL DA LIBERTADORES'
      : selectedCup === 'sulamericana'
        ? 'FINAL DA SUL-AMERICANA'
        : selectedCup === 'penalties'
          ? 'DISPUTA DE PÊNALTIS'
          : 'PARTIDA CLÁSSICA';

  const drawerLeagueId = gridDrawerSide === 'home' ? homeLeague : awayLeague;
  const drawerTeams = useMemo(
    () => teams.filter((t) => t.leagueId === drawerLeagueId),
    [teams, drawerLeagueId]
  );

  return (
    <div className="relative min-h-[100dvh] w-full bg-gradient-to-b from-[#0E1642] via-[#131E58] to-[#080C24] text-slate-100 flex flex-col justify-between overflow-x-hidden safe-area-hud">
      {/* Subtle stadium horizon reflection glow matching FIFA Classic Match backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-[#050817] via-[#0B1236]/80 to-transparent border-t border-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(124,58,237,0.18),transparent_60%)]"
      />

      {/* TOP HEADER BAR */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8 py-3.5 border-b border-white/10 bg-[#0A0F2E]/70 backdrop-blur-md">
        <button
          onClick={() => {
            soundEngine.playClick();
            onBack();
          }}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-wider text-white uppercase text-center">
          {headerTitle}
        </h1>

        <button
          onClick={handleStart}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <Play className="w-4 h-4 fill-current" />
          {selectedCup === 'penalties'
            ? 'Ir para os Pênaltis'
            : isLocal2P
              ? 'Ver Escalação 2P'
              : is2v2
                ? 'Ver Escalação 2v2'
                : 'Ver Escalação'}
        </button>
      </header>

      {/* COMPACT MATCH SETTINGS BAR (Competição · Formato · Estádio · Tempo · IA) */}
      <div className="relative z-10 max-w-6xl w-full mx-auto px-4 pt-3">
        <div className="bg-[#0B1033]/85 border border-white/15 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm">
          {/* Competição */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'friendly' as const, label: 'Clássica', icon: Swords },
              { id: 'libertadores' as const, label: 'Libertadores', icon: Trophy },
              { id: 'sulamericana' as const, label: 'Sul-Americana', icon: Shield },
              { id: 'penalties' as const, label: 'Pênaltis', icon: Crosshair },
            ].map((comp) => {
              const Icon = comp.icon;
              const active = selectedCup === comp.id;
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => handleSelectCup(comp.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#7C3AED] text-white shadow'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{comp.label}</span>
                </button>
              );
            })}
          </div>

          {/* Formato (1v1 / 2v2 / 2P Local) */}
          {selectedCup !== 'penalties' && (
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
              {[
                { id: '1v1' as const, label: '1v1' },
                { id: '2v2' as const, label: '2v2 (4 em Campo)' },
                { id: 'local_2p' as const, label: '2P Local' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setPlayMode(m.id);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    playMode === m.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Estádio (Oficial vs Compacto Drible+) */}
          {selectedCup !== 'penalties' && (
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onUpdateSettings({ arenaSize: 'standard' });
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  currentArenaSize === 'standard'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                <span>{is2v2 ? 'Estádio 2v2 Maior' : 'Estádio Oficial'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onUpdateSettings({ arenaSize: 'compact_stadium' });
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  currentArenaSize === 'compact_stadium'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Minimize2 className="w-3 h-3" />
                <span>Compacto · Drible+</span>
              </button>
            </div>
          )}

          {/* Duração + Dificuldade */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
              {[120, 180, 300].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onUpdateSettings({ durationSeconds: sec });
                  }}
                  className={`px-2 py-1 rounded text-xs font-mono-tabular font-bold cursor-pointer ${
                    settings.durationSeconds === sec
                      ? 'bg-white text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {sec / 60}m
                </button>
              ))}
            </div>

            {!isLocal2P && (
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
                {difficulties.map((diff) => (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateSettings({ difficulty: diff.id });
                    }}
                    className={`px-2 py-1 rounded text-xs font-bold cursor-pointer ${
                      settings.difficulty === diff.id
                        ? 'bg-white text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Local 2P player name inputs when 2P Local is active */}
        {isLocal2P && (
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#0B1033]/80 border border-amber-400/35 rounded-xl p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-emerald-300 whitespace-nowrap">
                J1 (WASD):
              </span>
              <input
                type="text"
                value={player1Name}
                onChange={(e) => setPlayer1Name(e.target.value)}
                placeholder="Jogador 1"
                maxLength={18}
                className="flex-1 px-2.5 py-1 rounded bg-black/40 border border-white/15 text-xs text-white focus:border-emerald-400 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-amber-300 whitespace-nowrap">
                J2 (Setas):
              </span>
              <input
                type="text"
                value={player2Name}
                onChange={(e) => setPlayer2Name(e.target.value)}
                placeholder="Jogador 2"
                maxLength={18}
                className="flex-1 px-2.5 py-1 rounded bg-black/40 border border-white/15 text-xs text-white focus:border-amber-400 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* MAIN FIFA 2-COLUMN MATCHUP SHOWCASE */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-5 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_140px_1fr] items-stretch gap-4 lg:gap-5">
          {/* LEFT: HOME TEAM */}
          <FifaTeamColumn
            roleLabel={
              isLocal2P
                ? `${(player1Name.trim() || 'Jogador 1').toUpperCase()} · CASA`
                : 'VOCÊ CONTROLA · CASA'
            }
            leagueId={homeLeague}
            team={homeTeam}
            highlighted={focusedSide === 'home'}
            onFocus={() => setFocusedSide('home')}
            onPrevRegion={() => cycleLeague('home', -1)}
            onNextRegion={() => cycleLeague('home', 1)}
            onPrevTeam={() => cycleTeam('home', -1)}
            onNextTeam={() => cycleTeam('home', 1)}
            onOpenList={() => {
              soundEngine.playClick();
              setFocusedSide('home');
              setGridDrawerSide('home');
            }}
          />

          {/* CENTER FIFA VS / MATCH OPTIONS COLUMN */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-lg px-3 py-4 flex lg:flex-col items-center justify-between gap-4 text-center">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                ESTÁDIO
              </div>
              <button
                type="button"
                disabled={selectedCup === 'penalties'}
                onClick={() => {
                  soundEngine.playClick();
                  onUpdateSettings({
                    arenaSize: currentArenaSize === 'compact_stadium' ? 'standard' : 'compact_stadium',
                  });
                }}
                className="px-2.5 py-1 rounded bg-black/45 hover:bg-black/65 border border-white/15 text-[11px] font-bold text-white cursor-pointer disabled:opacity-50"
              >
                {currentArenaSize === 'compact_stadium'
                  ? 'COMPACTO'
                  : is2v2
                    ? 'OFICIAL 2v2'
                    : 'OFICIAL'}
              </button>
              <div className="text-[10px] font-semibold text-emerald-300">
                {currentArenaSize === 'compact_stadium'
                  ? 'Drible+ Ativo'
                  : is2v2
                    ? 'Campo Maior'
                    : 'Padrão'}
              </div>
            </div>

            <div className="font-display text-4xl font-black text-white leading-none select-none">
              X
            </div>

            <div className="flex lg:flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleSwapTeams}
                title="Inverter Casa e Visitante"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Inverter</span>
              </button>

              <button
                type="button"
                onClick={handleRandomTeams}
                title="Sortear Clubes"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Aleatório</span>
              </button>
            </div>
          </div>

          {/* RIGHT: AWAY TEAM */}
          <FifaTeamColumn
            roleLabel={
              isLocal2P
                ? `${(player2Name.trim() || 'Jogador 2').toUpperCase()} · FORA`
                : `IA - ${activeDifficultyLabel}`
            }
            leagueId={awayLeague}
            team={awayTeam}
            highlighted={focusedSide === 'away'}
            onFocus={() => setFocusedSide('away')}
            onPrevRegion={() => cycleLeague('away', -1)}
            onNextRegion={() => cycleLeague('away', 1)}
            onPrevTeam={() => cycleTeam('away', -1)}
            onNextTeam={() => cycleTeam('away', 1)}
            onOpenList={() => {
              soundEngine.playClick();
              setFocusedSide('away');
              setGridDrawerSide('away');
            }}
          />
        </div>
      </main>

      {/* BOTTOM FIFA CONSOLE ACTION BAR */}
      <footer className="relative z-10 max-w-5xl w-full mx-auto px-4 pb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center gap-1.5 hover:text-white font-semibold cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
              X
            </span>
            <span>Selecionar / Escalação</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 hover:text-white font-semibold cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center">
              O
            </span>
            <span>Voltar</span>
          </button>

          <button
            type="button"
            onClick={handleRandomTeams}
            className="inline-flex items-center gap-1.5 hover:text-white font-semibold cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-fuchsia-500 text-white font-black text-[10px] flex items-center justify-center">
              □
            </span>
            <span>Aleatório</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-300 font-medium">
          Use as setas <strong className="text-white">&lt; &gt;</strong> nos painéis ou clique em{' '}
          <strong className="text-white">Ver Lista</strong> para escolher qualquer clube
        </div>
      </footer>

      {/* QUICK CLUB GRID MODAL (when user clicks "Ver Lista" or Club Crest) */}
      {gridDrawerSide && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-3xl w-full bg-[#0E1542] border border-white/20 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {gridDrawerSide === 'home' ? 'Selecionar Clube da Casa' : 'Selecionar Clube Visitante'}
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white">
                  {REGION_LIST.find((r) => r.id === drawerLeagueId)?.leagueLabel || 'Clubes'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGridDrawerSide(null)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* League tabs */}
            <div className="flex flex-wrap gap-1.5">
              {REGION_LIST.map((reg) => (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    if (gridDrawerSide === 'home') {
                      setHomeLeague(reg.id);
                    } else {
                      setAwayLeague(reg.id);
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    drawerLeagueId === reg.id
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-black/30 text-slate-300 hover:text-white'
                  }`}
                >
                  {reg.country}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[52vh] overflow-y-auto pr-1">
              {drawerTeams.map((team) => {
                const isSelected =
                  gridDrawerSide === 'home' ? team.id === homeTeam.id : team.id === awayTeam.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      if (gridDrawerSide === 'home') {
                        setHomeTeamId(team.id);
                      } else {
                        setAwayTeamId(team.id);
                      }
                      setGridDrawerSide(null);
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#7C3AED]/40 border-[#A78BFA] text-white'
                        : 'bg-black/30 border-white/10 text-slate-200 hover:border-white/30'
                    }`}
                  >
                    <ClubCrest team={team} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{team.name}</div>
                      <div className="text-[11px] font-mono-tabular text-amber-300">OVR {team.ovr}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FifaTeamColumnProps {
  roleLabel: string;
  leagueId: LeagueId;
  team: Team;
  highlighted: boolean;
  onFocus: () => void;
  onPrevRegion: () => void;
  onNextRegion: () => void;
  onPrevTeam: () => void;
  onNextTeam: () => void;
  onOpenList: () => void;
}

const FifaTeamColumn: React.FC<FifaTeamColumnProps> = ({
  roleLabel,
  leagueId,
  team,
  highlighted,
  onFocus,
  onPrevRegion,
  onNextRegion,
  onPrevTeam,
  onNextTeam,
  onOpenList,
}) => {
  const region =
    REGION_LIST.find((r) => r.id === leagueId) ||
    ({
      id: leagueId,
      country: LEAGUES.find((l) => l.id === leagueId)?.country.toUpperCase() || 'LIGA',
      leagueLabel: LEAGUES.find((l) => l.id === leagueId)?.name.toUpperCase() || 'LIGA 2027',
    } as RegionInfo);

  const stats = computeTeamSectorRatings(team);

  return (
    <div onClick={onFocus} className="flex flex-col gap-1.5 cursor-pointer">
      {/* Top Role Caption (e.g. IA - AMADOR / VOCÊ CONTROLA) */}
      <div className="text-center text-[11px] font-bold tracking-wider uppercase text-sky-300">
        {roleLabel}
      </div>

      {/* Block 1: Country / Region Selector Bar */}
      <div className="bg-[#0B1035]/95 border border-white/25 px-3 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrevRegion();
          }}
          aria-label="País anterior"
          className="p-1 rounded hover:bg-white/15 text-slate-200 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-center gap-3 flex-1 min-w-0">
          <span className="font-display text-lg font-bold tracking-wider text-white uppercase truncate">
            {region.country}
          </span>
          <RegionFlagSVG leagueId={leagueId} />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNextRegion();
          }}
          aria-label="Próximo país"
          className="p-1 rounded hover:bg-white/15 text-slate-200 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Block 2: Main Club Showcase Panel (Electric Purple when active, Royal Navy when secondary) */}
      <div
        className={`relative border px-5 py-5 flex flex-col items-center justify-between gap-4 transition-all duration-150 ${
          highlighted
            ? 'bg-gradient-to-b from-[#7C3AED] to-[#5B21B6] border-[#C4B5FD] shadow-[0_0_40px_rgba(124,58,237,0.38)]'
            : 'bg-[#0F1544]/95 border-white/25 hover:border-white/45'
        }`}
      >
        {/* Club Name Title */}
        <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide text-white uppercase text-center leading-none">
          {team.name}
        </div>

        {/* Crest Carousel */}
        <div className="w-full flex items-center justify-between gap-2 py-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrevTeam();
            }}
            aria-label="Clube anterior"
            className="p-2 rounded-full hover:bg-white/15 text-emerald-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenList();
            }}
            title="Clique para abrir lista de clubes"
            className="p-2 rounded-2xl hover:scale-105 transition-transform cursor-pointer"
          >
            <ClubCrest team={team} size={114} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextTeam();
            }}
            aria-label="Próximo clube"
            className="p-2 rounded-full hover:bg-white/15 text-emerald-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* 5-Star Rating Row */}
        <div className="flex items-center justify-center gap-1" aria-label={`Avaliação ${stats.stars} estrelas`}>
          {[1, 2, 3, 4, 5].map((i) => {
            const filled = stats.stars >= i;
            const half = !filled && stats.stars >= i - 0.5;
            return (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  filled
                    ? 'text-amber-400 fill-amber-400'
                    : half
                      ? 'text-amber-400 fill-amber-400/50'
                      : 'text-white/25 fill-white/15'
                }`}
              />
            );
          })}
        </div>

        {/* ATA · MEI · DEF 3-Column Metrics */}
        <div className="w-full max-w-[240px] grid grid-cols-3 gap-3 pt-1 text-center">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-slate-200/80 uppercase">ATA</div>
            <div className="font-display text-3xl font-extrabold text-white tabular-nums leading-none mt-0.5">
              {stats.ata}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-widest text-slate-200/80 uppercase">MEI</div>
            <div className="font-display text-3xl font-extrabold text-white tabular-nums leading-none mt-0.5">
              {stats.mei}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-widest text-slate-200/80 uppercase">DEF</div>
            <div className="font-display text-3xl font-extrabold text-white tabular-nums leading-none mt-0.5">
              {stats.def}
            </div>
          </div>
        </div>
      </div>

      {/* Block 3: League Footer Bar + Ver Lista trigger */}
      <div className="bg-[#0B1035]/95 border border-white/25 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="text-xs font-bold tracking-wider text-white uppercase truncate">
          {region.leagueLabel}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenList();
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <LayoutGrid className="w-3 h-3" />
          <span>Ver Lista</span>
        </button>
      </div>
    </div>
  );
};
