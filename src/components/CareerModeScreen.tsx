import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Trophy,
  Users,
  ShoppingBag,
  BarChart3,
  Play,
  FastForward,
  Search,
  Shirt,
  ArrowUpCircle,
  DollarSign,
  PlusCircle,
  Sparkles,
  Newspaper,
  Calendar,
  Building2,
  HeartHandshake,
  Zap,
  Shield,
} from 'lucide-react';
import { LEAGUES } from '../data/teams2027';
import {
  ActiveMatchConfig,
  AIDifficulty,
  CareerFormation,
  CareerState,
  CareerTacticStyle,
  CareerTrainingFocus,
  LeagueId,
  Player,
  Team,
} from '../types/game';
import {
  applyRoundResultsToCareer,
  clearCareerSave,
  createNewCareer,
  getSquadOrderedForPitch,
  runRecoveryTraining,
  saveCareerState,
  sortStandings,
  upgradeStadium,
} from '../utils/careerEngine';
import { ClubCrest } from './ClubCrest';
import { PlayerCard } from './PlayerCard';
import { soundEngine } from '../utils/audio';

interface CareerModeScreenProps {
  teams: Team[];
  career: CareerState | null;
  settings: ActiveMatchConfig['settings'];
  onUpdateSettings: (patch: Partial<ActiveMatchConfig['settings']>) => void;
  onSetCareer: (c: CareerState | null) => void;
  onPlayMatch: (config: ActiveMatchConfig) => void;
  onOpenKitCustomizer: (teamId: string) => void;
  onBack: () => void;
}

type CareerTab = 'central' | 'squad' | 'market' | 'table' | 'finances';

const FORMATIONS: { id: CareerFormation; label: string; desc: string; dots: [number, number][] }[] = [
  {
    id: '1-2-2',
    label: '1-2-2 Equilibrado',
    desc: 'Base sólida para rodar titulares e reservas com equilíbrio entre defesa e ataque.',
    dots: [
      [12, 50],
      [34, 30],
      [34, 70],
      [68, 34],
      [68, 66],
    ],
  },
  {
    id: '1-2-1',
    label: '1-2-1 Pressão Alta',
    desc: 'Losango dinâmico focado em posse rápida e triangulações no meio.',
    dots: [
      [12, 50],
      [32, 50],
      [54, 26],
      [54, 74],
      [78, 50],
    ],
  },
  {
    id: '1-1-1',
    label: '1-1-1 Duelo Direto',
    desc: 'Estrutura enxuta e vertical pensada especialmente para duelos 1v1 intensos.',
    dots: [
      [12, 50],
      [44, 50],
      [76, 50],
    ],
  },
  {
    id: '1-3-1',
    label: '1-3-1 Retranca',
    desc: 'Linha defensiva fechada que protege o gol e aproveita contra-ataques.',
    dots: [
      [12, 50],
      [32, 22],
      [30, 50],
      [32, 78],
      [72, 50],
    ],
  },
];

export const CareerModeScreen: React.FC<CareerModeScreenProps> = ({
  teams,
  career,
  settings,
  onUpdateSettings,
  onSetCareer,
  onPlayMatch,
  onOpenKitCustomizer,
  onBack,
}) => {
  const [selectLeague, setSelectLeague] = useState<LeagueId>('brasileirao');
  const [pickedTeamId, setPickedTeamId] = useState<string>('fla');
  const [pickedCup, setPickedCup] = useState<'libertadores' | 'sulamericana'>('libertadores');
  const [managerName, setManagerName] = useState<string>('Treinador 2027');

  const [activeTab, setActiveTab] = useState<CareerTab>('central');
  const [marketSearch, setMarketSearch] = useState('');
  const [marketLeague, setMarketLeague] = useState<LeagueId | 'all'>('all');
  const [marketPos, setMarketPos] = useState<'ALL' | 'ATA' | 'MEI' | 'ZAG' | 'GOL'>('ALL');
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [calendarRoundFilter, setCalendarRoundFilter] = useState<'current' | 'all'>('current');

  // Gemini AI Scout state (strictly top-level hook!)
  const [aiScoutLoading, setAiScoutLoading] = useState(false);
  const [aiScoutText, setAiScoutText] = useState<string | null>(null);
  const [aiScoutError, setAiScoutError] = useState<string | null>(null);

  const marketPlayers = useMemo(() => {
    if (!career) return [];
    const mySquadIds = new Set(career.squad.map((p) => p.id));
    const list: { player: Player; club: Team }[] = [];
    for (const club of teams) {
      if (club.id === career.teamId) continue;
      if (marketLeague !== 'all' && club.leagueId !== marketLeague) continue;
      for (const pl of club.players) {
        if (mySquadIds.has(pl.id)) continue;
        if (marketPos !== 'ALL' && pl.position !== marketPos) continue;
        if (
          marketSearch.trim() &&
          !pl.name.toLowerCase().includes(marketSearch.toLowerCase()) &&
          !club.name.toLowerCase().includes(marketSearch.toLowerCase())
        ) {
          continue;
        }
        list.push({ player: pl, club });
      }
    }
    return list.sort((a, b) => b.player.ovr - a.player.ovr);
  }, [teams, career, marketLeague, marketPos, marketSearch]);

  // ================= CLUB SELECTION ONBOARDING =================
  if (!career) {
    const leagueTeams = teams.filter((t) => t.leagueId === selectLeague);
    const pickedTeam = teams.find((t) => t.id === pickedTeamId) || leagueTeams[0] || teams[0];

    return (
      <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-[#0D1812]">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                soundEngine.playClick();
                onBack();
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-200 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white">
              Modo Carreira de Técnico 2027
            </h1>
          </div>

          <button
            onClick={() => {
              soundEngine.playTransferSuccess();
              const newCareer = createNewCareer(managerName, pickedTeam, teams, pickedCup);
              onSetCareer(newCareer);
            }}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" /> Assumir {pickedTeam.shortCode}
          </button>
        </header>

        <main className="flex-1 max-w-6xl 2xl:max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
          <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-5">
              <h2 className="font-display text-2xl font-bold text-white">Escolha seu Clube e Projeto</h2>
              <p className="text-xs text-slate-400 mt-1">
                Gerencie elenco, táticas, finanças, moral da torcida e mercado de transferências em busca dos títulos.
              </p>
            </div>
            <div className="md:col-span-4">
              <label className="text-xs text-slate-400 block mb-1">Copa Continental da Temporada</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPickedCup('libertadores')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                    pickedCup === 'libertadores'
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-black/30 text-slate-300 border-white/10'
                  }`}
                >
                  Libertadores
                </button>
                <button
                  onClick={() => setPickedCup('sulamericana')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                    pickedCup === 'sulamericana'
                      ? 'bg-sky-400 text-slate-950 border-sky-300'
                      : 'bg-black/30 text-slate-300 border-white/10'
                  }`}
                >
                  Sul-Americana
                </button>
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-slate-400 block mb-1">Nome do Técnico</label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                maxLength={24}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 bg-[#111D16] p-1.5 rounded-2xl border border-white/10">
            {LEAGUES.map((lg) => (
              <button
                key={lg.id}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectLeague(lg.id);
                  const first = teams.find((t) => t.leagueId === lg.id);
                  if (first) setPickedTeamId(first.id);
                }}
                className={`py-2.5 px-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  selectLeague === lg.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                {lg.shortName}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {leagueTeams.map((team) => {
                const active = team.id === pickedTeam.id;
                return (
                  <button
                    key={team.id}
                    onClick={() => {
                      soundEngine.playClick();
                      setPickedTeamId(team.id);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 shadow-lg'
                        : 'bg-[#111D16] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ClubCrest team={team} size={36} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{team.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular">
                          OVR {team.ovr} · €{team.budgetMillions}M
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-4 bg-[#111D16] border border-emerald-500/25 rounded-2xl p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                  <ClubCrest team={pickedTeam} size={50} />
                  <div>
                    <div className="font-display text-3xl font-extrabold text-white">{pickedTeam.name}</div>
                    <div className="text-xs text-emerald-400 font-mono-tabular">
                      OVR {pickedTeam.ovr} · Verba €{pickedTeam.budgetMillions}M
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Elenco Principal (2027)
                  </div>
                  <div className="space-y-2">
                    {pickedTeam.players.map((pl) => (
                      <div
                        key={pl.id}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-black/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular text-emerald-400 font-bold w-5">{pl.number}</span>
                          <span className="text-white font-medium">{pl.name}</span>
                        </div>
                        <span className="font-mono-tabular text-amber-300 font-bold">{pl.ovr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  soundEngine.playTransferSuccess();
                  const newCareer = createNewCareer(managerName, pickedTeam, teams, pickedCup);
                  onSetCareer(newCareer);
                }}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Iniciar Carreira com {pickedTeam.name}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ================= ACTIVE CAREER HUB =================
  const baseMyTeam = teams.find((t) => t.id === career.teamId) || teams[0];
  const myTeamWithCareerSquad: Team = {
    ...baseMyTeam,
    players: getSquadOrderedForPitch(career),
    ovr: Math.round(career.squad.reduce((acc, p) => acc + p.ovr, 0) / Math.max(1, career.squad.length)),
  };

  const sortedTable = sortStandings(career.standings, teams);
  const myPosition = sortedTable.findIndex((s) => s.teamId === career.teamId) + 1;

  const isSeasonOver = career.currentRound > career.totalRounds;
  const nextFixture = !isSeasonOver
    ? career.fixtures.find(
        (f) =>
          f.round === career.currentRound &&
          !f.played &&
          (f.homeTeamId === career.teamId || f.awayTeamId === career.teamId)
      )
    : undefined;

  const opponentId = nextFixture
    ? nextFixture.homeTeamId === career.teamId
      ? nextFixture.awayTeamId
      : nextFixture.homeTeamId
    : undefined;
  const opponentTeam = teams.find((t) => t.id === opponentId);

  const leagueInfo = LEAGUES.find((l) => l.id === career.leagueId);
  const moraleValue = Math.max(0, Math.min(100, Math.round(career.morale ?? 75)));
  const moraleLabel = moraleValue >= 72 ? 'Alta' : moraleValue >= 45 ? 'Estável' : 'Pressão';

  const handleRequestAiScout = async () => {
    setAiScoutLoading(true);
    setAiScoutError(null);
    try {
      const candidates = marketPlayers.slice(0, 8).map(({ player, club }) => ({
        name: player.name,
        pos: player.position,
        ovr: player.ovr,
        value: player.valueMillions,
        club: club.name,
      }));
      const res = await fetch('/api/ai/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myTeamName: myTeamWithCareerSquad.name,
          myOvr: myTeamWithCareerSquad.ovr,
          opponentName: opponentTeam?.name || 'Próximo Adversário',
          opponentOvr: opponentTeam?.ovr || 82,
          budgetMillions: career.budgetMillions,
          tournamentLabel: leagueInfo?.name || 'Temporada 2027',
          marketCandidates: candidates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao consultar Olheiro IA');
      }
      const signings = Array.isArray(data.recommendedSignings)
        ? data.recommendedSignings
            .map((s: { playerName?: string; reason?: string }) =>
              s.playerName ? `• ${s.playerName}: ${s.reason || ''}` : ''
            )
            .filter(Boolean)
            .join('\n')
        : '';
      const formatted = [
        data.tacticalAdvice,
        data.keyDanger ? `Alerta: ${data.keyDanger}` : '',
        signings ? `Alvos sugeridos:\n${signings}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      setAiScoutText(formatted || 'Análise tática concluída.');
    } catch (err) {
      setAiScoutError(err instanceof Error ? err.message : 'Falha na conexão com o Olheiro IA.');
    } finally {
      setAiScoutLoading(false);
    }
  };

  const handleBuyPlayer = (player: Player, fromClub: Team) => {
    if (career.budgetMillions < player.valueMillions) {
      setTransferNotice(`Verba insuficiente! ${player.shortName} custa €${player.valueMillions}M.`);
      return;
    }
    soundEngine.playTransferSuccess();
    const hydratedPlayer: Player = {
      ...player,
      stamina: 100,
    };
    const updated: CareerState = {
      ...career,
      budgetMillions: career.budgetMillions - player.valueMillions,
      morale: Math.min(100, moraleValue + 4),
      squad: [hydratedPlayer, ...career.squad],
      starterIds: [player.id, ...career.starterIds].slice(0, 3),
      staminaByPlayerId: {
        ...(career.staminaByPlayerId || {}),
        [player.id]: 100,
      },
      transfers: [
        {
          id: `tr-${Date.now()}`,
          type: 'buy',
          playerName: player.name,
          fromTeamName: fromClub.name,
          toTeamName: myTeamWithCareerSquad.name,
          amountMillions: player.valueMillions,
          round: Math.min(career.currentRound, career.totalRounds),
        },
        ...career.transfers,
      ],
      finances: [
        {
          id: `fin-buy-${Date.now()}`,
          round: Math.min(career.currentRound, career.totalRounds),
          label: `Compra de ${player.shortName} (${fromClub.shortCode})`,
          amountMillions: player.valueMillions,
          kind: 'expense' as const,
        },
        ...(career.finances || []),
      ].slice(0, 30),
      news: [
        {
          id: `news-buy-${Date.now()}`,
          round: Math.min(career.currentRound, career.totalRounds),
          title: `Reforço de peso: ${myTeamWithCareerSquad.name} contrata ${player.shortName}!`,
          body: `Negociação fechada por €${player.valueMillions}M junto ao ${fromClub.name}. Torcida comemora chegada do craque (OVR ${player.ovr}).`,
          tone: 'positive' as const,
        },
        ...(career.news || []),
      ].slice(0, 18),
    };
    saveCareerState(updated);
    onSetCareer(updated);
    setTransferNotice(`${player.name} contratado por €${player.valueMillions}M e escalado como titular #1 (1v1)!`);
  };

  const handleSellPlayer = (player: Player) => {
    if (career.squad.length <= 3) {
      setTransferNotice('Você precisa de pelo menos 3 jogadores no elenco.');
      return;
    }
    soundEngine.playTransferSuccess();
    const sellPrice = Math.max(2, Math.round(player.valueMillions * 0.9));
    const remaining = career.squad.filter((p) => p.id !== player.id);
    const updatedStarters = career.starterIds.filter((id) => id !== player.id);
    while (updatedStarters.length < 3 && remaining.length > updatedStarters.length) {
      const nextCand = remaining.find((p) => !updatedStarters.includes(p.id));
      if (nextCand) updatedStarters.push(nextCand.id);
      else break;
    }

    const updated: CareerState = {
      ...career,
      budgetMillions: career.budgetMillions + sellPrice,
      squad: remaining,
      starterIds: updatedStarters,
      transfers: [
        {
          id: `tr-${Date.now()}`,
          type: 'sell',
          playerName: player.name,
          fromTeamName: myTeamWithCareerSquad.name,
          toTeamName: 'Mercado Externo',
          amountMillions: sellPrice,
          round: Math.min(career.currentRound, career.totalRounds),
        },
        ...career.transfers,
      ],
      finances: [
        {
          id: `fin-sell-${Date.now()}`,
          round: Math.min(career.currentRound, career.totalRounds),
          label: `Venda de ${player.shortName}`,
          amountMillions: sellPrice,
          kind: 'income' as const,
        },
        ...(career.finances || []),
      ].slice(0, 30),
      news: [
        {
          id: `news-sell-${Date.now()}`,
          round: Math.min(career.currentRound, career.totalRounds),
          title: `${player.shortName} deixa o ${myTeamWithCareerSquad.name} por €${sellPrice}M`,
          body: 'Diretoria reforça o caixa do clube para buscar novos reforços na janela.',
          tone: 'neutral' as const,
        },
        ...(career.news || []),
      ].slice(0, 18),
    };
    saveCareerState(updated);
    onSetCareer(updated);
    setTransferNotice(`${player.shortName} vendido por €${sellPrice}M!`);
  };

  const handleMakeStarter = (playerId: string) => {
    soundEngine.playClick();
    const filtered = career.starterIds.filter((id) => id !== playerId);
    const nextStarters = [playerId, ...filtered].slice(0, 3);
    const updated: CareerState = { ...career, starterIds: nextStarters };
    saveCareerState(updated);
    onSetCareer(updated);
  };

  const handleUpdateTactics = (patch: Partial<Pick<CareerState, 'formation' | 'tacticStyle' | 'trainingFocus'>>) => {
    soundEngine.playClick();
    const updated: CareerState = { ...career, ...patch };
    saveCareerState(updated);
    onSetCareer(updated);
  };

  const handlePlayNextLeagueMatch = () => {
    if (!nextFixture || !opponentTeam) return;
    soundEngine.playWhistle(false);
    const isHome = nextFixture.homeTeamId === career.teamId;
    onPlayMatch({
      tournament: 'career_league',
      tournamentLabel: `${leagueInfo?.shortName || 'Liga'} ${career.season} · Rodada ${career.currentRound}/${career.totalRounds}`,
      homeTeam: isHome ? myTeamWithCareerSquad : opponentTeam,
      awayTeam: isHome ? opponentTeam : myTeamWithCareerSquad,
      humanSide: isHome ? 'home' : 'away',
      settings: { ...settings, format: '1v1', withGoalkeeper: false },
      careerFixtureId: nextFixture.id,
      tacticStyle: career.tacticStyle,
    });
  };

  const handleSimulateRound = () => {
    soundEngine.playClick();
    const updated = applyRoundResultsToCareer(career, teams);
    onSetCareer(updated);
  };

  const nextCupMatch = career.cupMatches.find((m) => !m.played);
  const cupEliminated = career.cupMatches.some((m) => m.played && !m.won);
  const cupWinner = career.cupMatches.find((m) => m.stage === 'final' && m.played && m.won);

  const handlePlayCupMatch = () => {
    if (!nextCupMatch || cupEliminated) return;
    const opp = teams.find((t) => t.id === nextCupMatch.opponentId) || teams[0];
    const cupName = career.cupType === 'libertadores' ? 'Libertadores' : 'Sul-Americana';
    const stageName =
      nextCupMatch.stage === 'quartas'
        ? 'Quartas de Final'
        : nextCupMatch.stage === 'semi'
          ? 'Semifinal'
          : 'Grande Final';

    soundEngine.playWhistle(false);
    onPlayMatch({
      tournament: 'career_continental_cup',
      tournamentLabel: `${cupName} ${career.season} · ${stageName}`,
      homeTeam: myTeamWithCareerSquad,
      awayTeam: opp,
      humanSide: 'home',
      settings: { ...settings, format: '1v1', withGoalkeeper: false },
      tacticStyle: career.tacticStyle,
    });
  };

  const handleStartNextSeason = () => {
    soundEngine.playTransferSuccess();
    const fresh = createNewCareer(career.managerName, myTeamWithCareerSquad, teams, career.cupType);
    const nextSeason: CareerState = {
      ...fresh,
      season: career.season + 1,
      budgetMillions: career.budgetMillions + 25,
      morale: Math.min(100, moraleValue + 10),
      stadiumLevel: career.stadiumLevel || 1,
      formation: career.formation || '1-2-2',
      tacticStyle: career.tacticStyle || 'equilibrado',
      trainingFocus: career.trainingFocus || 'equilibrado',
      squad: career.squad,
      starterIds: career.starterIds,
      transfers: career.transfers,
      trophies: career.trophies,
      finances: [
        {
          id: `fin-season-${Date.now()}`,
          round: 1,
          label: `Premiação Nova Temporada ${career.season + 1}`,
          amountMillions: 25,
          kind: 'income' as const,
        },
        ...(career.finances || []),
      ].slice(0, 30),
    };
    saveCareerState(nextSeason);
    onSetCareer(nextSeason);
  };

  const difficulties: { id: AIDifficulty; label: string }[] = [
    { id: 'facil', label: 'Amador' },
    { id: 'medio', label: 'Profissional' },
    { id: 'dificil', label: 'Lendário' },
  ];

  const myStarter = myTeamWithCareerSquad.players[0];
  const oppStarter = opponentTeam?.players[0];
  const activeFormationMeta = FORMATIONS.find((f) => f.id === career.formation) || FORMATIONS[0];

  return (
    <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
      {/* TOP MANAGER DASHBOARD BAR */}
      <header className="border-b border-white/10 bg-[#0D1812] px-4 sm:px-6 py-3">
        <div className="max-w-7xl 2xl:max-w-[1480px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                soundEngine.playClick();
                onBack();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Menu
            </button>
            <ClubCrest team={myTeamWithCareerSquad} size={38} />
            <div className="min-w-0">
              <div className="font-display text-xl sm:text-2xl font-extrabold text-white leading-none truncate">
                {myTeamWithCareerSquad.name}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                Téc. {career.managerName} · {leagueInfo?.shortName} {career.season} · {myPosition}º Lugar
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-4 text-xs tabular-nums">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Orçamento</div>
                <div className="font-mono-tabular text-sm sm:text-base font-bold text-emerald-400">
                  €{career.budgetMillions}M
                </div>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Moral</div>
                <div
                  className={`font-mono-tabular text-sm sm:text-base font-bold ${
                    moraleValue >= 72
                      ? 'text-emerald-400'
                      : moraleValue >= 45
                        ? 'text-amber-300'
                        : 'text-rose-400'
                  }`}
                >
                  {moraleValue}% · {moraleLabel}
                </div>
              </div>
              {opponentTeam && (
                <>
                  <div className="hidden md:block h-7 w-px bg-white/10" />
                  <div className="hidden md:flex items-center gap-2">
                    <ClubCrest team={opponentTeam} size={26} />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Próx. Adversário</div>
                      <div className="text-xs font-bold text-white whitespace-nowrap">
                        {opponentTeam.shortCode} (OVR {opponentTeam.ovr})
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isSeasonOver && nextFixture && opponentTeam && (
                <button
                  onClick={handlePlayNextLeagueMatch}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" /> JOGAR PARTIDA
                </button>
              )}
              <button
                onClick={() => {
                  soundEngine.playClick();
                  clearCareerSave();
                  onSetCareer(null);
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-300 cursor-pointer whitespace-nowrap"
              >
                Trocar Clube
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CLEAN 5-TAB MANAGER NAVIGATION */}
      <nav className="border-b border-white/10 bg-[#0B1510] px-4 sm:px-6 py-2 overflow-x-auto">
        <div className="max-w-7xl 2xl:max-w-[1480px] mx-auto flex items-center gap-1.5 sm:gap-2">
          {[
            { id: 'central', label: 'Central', icon: Play },
            { id: 'squad', label: 'Elenco & Tática', icon: Users },
            { id: 'market', label: 'Transferências', icon: ShoppingBag },
            { id: 'table', label: 'Tabela & Calendário', icon: BarChart3 },
            { id: 'finances', label: 'Finanças & Clube', icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundEngine.playClick();
                  setActiveTab(tab.id as CareerTab);
                }}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl 2xl:max-w-[1480px] w-full mx-auto p-4 sm:p-6">
        {/* ================= TAB 1: CENTRAL ================= */}
        {activeTab === 'central' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5">
                {!isSeasonOver && nextFixture && opponentTeam ? (
                  <>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-emerald-400">
                          Rodada {career.currentRound} de {career.totalRounds} ·{' '}
                          {nextFixture.homeTeamId === career.teamId ? 'Em Casa' : 'Fora de Casa'}
                        </span>
                        <span>{leagueInfo?.name}</span>
                      </div>

                      {/* Escudos + OVR + Escalação 1v1 Preview */}
                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-5 px-4 bg-black/35 rounded-2xl border border-white/10">
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <ClubCrest
                            team={nextFixture.homeTeamId === career.teamId ? myTeamWithCareerSquad : opponentTeam}
                            size={56}
                          />
                          <div className="text-sm font-bold text-white">
                            {nextFixture.homeTeamId === career.teamId ? myTeamWithCareerSquad.name : opponentTeam.name}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-amber-300">
                            OVR{' '}
                            {nextFixture.homeTeamId === career.teamId
                              ? myTeamWithCareerSquad.ovr
                              : opponentTeam.ovr}{' '}
                            · {nextFixture.homeTeamId === career.teamId ? 'VOCÊ' : 'BOT'}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            1v1:{' '}
                            {nextFixture.homeTeamId === career.teamId
                              ? myStarter?.shortName
                              : oppStarter?.shortName}
                          </div>
                        </div>

                        <div className="font-display text-4xl font-extrabold text-slate-500">VS</div>

                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <ClubCrest
                            team={nextFixture.awayTeamId === career.teamId ? myTeamWithCareerSquad : opponentTeam}
                            size={56}
                          />
                          <div className="text-sm font-bold text-white">
                            {nextFixture.awayTeamId === career.teamId ? myTeamWithCareerSquad.name : opponentTeam.name}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-amber-300">
                            OVR{' '}
                            {nextFixture.awayTeamId === career.teamId
                              ? myTeamWithCareerSquad.ovr
                              : opponentTeam.ovr}{' '}
                            · {nextFixture.awayTeamId === career.teamId ? 'VOCÊ' : 'BOT'}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            1v1:{' '}
                            {nextFixture.awayTeamId === career.teamId
                              ? myStarter?.shortName
                              : oppStarter?.shortName}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Match Difficulty & Active Tactic Summary */}
                    <div className="bg-black/25 border border-white/10 rounded-xl p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400">
                          Esquema: <strong className="text-white">{career.formation}</strong> · Postura:{' '}
                          <strong className="text-emerald-300 capitalize">{career.tacticStyle}</strong>
                        </span>
                        <span className="font-mono-tabular text-amber-300 font-semibold">
                          Energia Titular: {Math.round(myStarter?.stamina ?? 100)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {difficulties.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              soundEngine.playClick();
                              onUpdateSettings({ difficulty: d.id });
                            }}
                            className={`py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                              settings.difficulty === d.id
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-black/30 text-slate-300 border-white/10'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handlePlayNextLeagueMatch}
                        className="flex-1 py-3 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" /> Jogar Partida 1v1
                      </button>
                      <button
                        onClick={handleSimulateRound}
                        className="py-3 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FastForward className="w-4 h-4" /> Simular Rodada
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 space-y-4">
                    <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
                    <h2 className="font-display text-3xl font-extrabold text-white">
                      Fim da Liga {career.season}!
                    </h2>
                    <p className="text-sm text-slate-300">
                      Você terminou em <span className="text-emerald-400 font-bold">{myPosition}º lugar</span> na{' '}
                      {leagueInfo?.shortName}.
                    </p>
                    <button
                      onClick={handleStartNextSeason}
                      className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
                    >
                      Avançar para Temporada {career.season + 1} (+€25M Verba)
                    </button>
                  </div>
                )}
              </div>

              {/* Painel de Notícias / Imprensa */}
              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Painel de Notícias & Imprensa
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">Atualizado por rodada</span>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {(career.news || []).length === 0 ? (
                    <p className="text-xs text-slate-400">Jogue ou simule a primeira rodada para acompanhar a imprensa.</p>
                  ) : (
                    career.news.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold ${
                              item.tone === 'positive'
                                ? 'text-emerald-300'
                                : item.tone === 'warning'
                                  ? 'text-rose-300'
                                  : 'text-amber-200'
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono-tabular text-slate-400 shrink-0">
                            R{item.round}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{item.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              {/* Olheiro IA (Gemini) */}
              <div className="bg-[#111D16] border border-emerald-400/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Olheiro & Analista IA
                    </span>
                  </div>
                  <button
                    onClick={handleRequestAiScout}
                    disabled={aiScoutLoading}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-bold text-emerald-200 cursor-pointer disabled:opacity-60"
                  >
                    {aiScoutLoading ? 'Analisando...' : 'Consultar Olheiro IA'}
                  </button>
                </div>
                {aiScoutText ? (
                  <p className="text-xs text-slate-200 leading-relaxed bg-black/30 rounded-xl p-3 border border-white/10 whitespace-pre-line">
                    {aiScoutText}
                  </p>
                ) : aiScoutError ? (
                  <p className="text-xs text-rose-300 bg-rose-500/10 rounded-xl p-3 border border-rose-400/30">
                    {aiScoutError}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Peça ao Olheiro IA indicações de reforços do mercado 2027 e estratégia 1v1 para seu próximo duelo.
                  </p>
                )}
              </div>

              {/* Continental Cup Quick Card */}
              <div className="bg-[#111D16] border border-amber-400/25 rounded-2xl p-5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Copa Continental {career.season}
                  </div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {career.cupType === 'libertadores' ? 'CONMEBOL Libertadores' : 'CONMEBOL Sul-Americana'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {cupWinner
                      ? 'Campeão Continental!'
                      : cupEliminated
                        ? 'Eliminado no mata-mata'
                        : nextCupMatch
                          ? `Próxima fase: ${nextCupMatch.stage.toUpperCase()}`
                          : 'Concluída'}
                  </div>
                </div>
                {nextCupMatch && !cupEliminated ? (
                  <button
                    onClick={handlePlayCupMatch}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
                  >
                    Jogar Copa
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('table')}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
                  >
                    Ver Chave
                  </button>
                )}
              </div>

              {/* Active Starters Card */}
              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Titulares & Energia Atual
                  </h3>
                  <button
                    onClick={() => setActiveTab('squad')}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    Gerenciar Tática →
                  </button>
                </div>

                <div className="space-y-2">
                  {myTeamWithCareerSquad.players.slice(0, 3).map((pl, idx) => (
                    <div
                      key={pl.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 font-mono-tabular text-xs font-bold flex items-center justify-center">
                          {pl.number}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {pl.shortName}{' '}
                            {idx === 0 && <span className="text-amber-400 text-[11px]">(Em Campo 1v1)</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono-tabular">
                            {pl.position} · VEL {pl.pace} · CHU {pl.shot} · DEF {pl.def} · FIS {Math.round(pl.stamina ?? 100)}%
                          </div>
                        </div>
                      </div>
                      <span className="font-display text-xl font-extrabold text-amber-300 tabular-nums">
                        {pl.ovr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: ELENCO & TÁTICA ================= */}
        {activeTab === 'squad' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Formation + Style + Training Focus */}
              <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white">Formação & Tática do Clube</h2>
                    <p className="text-xs text-slate-400">
                      Atributos VEL, CHU, DEF (massa/roubada) e FIS (stamina) afetam a física real em campo.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      soundEngine.playTransferSuccess();
                      onSetCareer(runRecoveryTraining(career));
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-bold text-emerald-200 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" /> Treino Regenerativo (+30% Energia)
                  </button>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-2">Formação Tática</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FORMATIONS.map((fm) => (
                      <button
                        key={fm.id}
                        onClick={() => handleUpdateTactics({ formation: fm.id })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                          career.formation === fm.id
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {fm.id}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">{activeFormationMeta.desc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-2">Postura em Campo</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'ofensivo', label: 'Ofensivo (+Chute)' },
                          { id: 'equilibrado', label: 'Equilibrado' },
                          { id: 'retranqueiro', label: 'Retranca (+DEF)' },
                        ] as { id: CareerTacticStyle; label: string }[]
                      ).map((st) => (
                        <button
                          key={st.id}
                          onClick={() => handleUpdateTactics({ tacticStyle: st.id })}
                          className={`py-2 px-2 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            career.tacticStyle === st.id
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-black/30 text-slate-300 border-white/10'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-2">Foco de Treino Semanal</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'equilibrado', label: 'Equilibrado' },
                          { id: 'ataque', label: 'Finalização (CHU)' },
                          { id: 'defesa', label: 'Marcação (DEF)' },
                          { id: 'recuperacao', label: 'Físico (FIS)' },
                        ] as { id: CareerTrainingFocus; label: string }[]
                      ).map((tr) => (
                        <button
                          key={tr.id}
                          onClick={() => handleUpdateTactics({ trainingFocus: tr.id })}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            career.trainingFocus === tr.id
                              ? 'bg-sky-400 text-slate-950 border-sky-300'
                              : 'bg-black/30 text-slate-300 border-white/10'
                          }`}
                        >
                          {tr.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive 2D Tactical Pitch Preview */}
              <div className="lg:col-span-5 bg-[#111D16] border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Prancheta Tática · {activeFormationMeta.label}
                  </span>
                  <span className="text-[11px] font-mono-tabular text-slate-400">
                    Titular 1v1: {myStarter?.shortName}
                  </span>
                </div>

                <div className="relative w-full h-48 rounded-xl bg-gradient-to-r from-[#1D5E29] via-[#247032] to-[#1D5E29] border-2 border-white/30 overflow-hidden">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
                  <div className="absolute top-1/2 left-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
                  <div className="absolute inset-y-6 left-0 w-10 border-r border-y border-white/30" />
                  <div className="absolute inset-y-6 right-0 w-10 border-l border-y border-white/30" />

                  {activeFormationMeta.dots.map(([xPct, yPct], idx) => {
                    const slotPlayer =
                      idx === activeFormationMeta.dots.length - 1
                        ? myStarter
                        : myTeamWithCareerSquad.players[idx % myTeamWithCareerSquad.players.length];
                    const isMain = idx === activeFormationMeta.dots.length - 1;
                    return (
                      <div
                        key={idx}
                        style={{ left: `${xPct}%`, top: `${yPct}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                      >
                        <div
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shadow-lg ${
                            isMain ? 'ring-2 ring-amber-300 scale-110' : ''
                          }`}
                          style={{
                            backgroundColor: myTeamWithCareerSquad.kit.primaryColor,
                            borderColor: myTeamWithCareerSquad.kit.secondaryColor,
                            color:
                              myTeamWithCareerSquad.kit.textColor === '#111111'
                                ? '#FFFFFF'
                                : myTeamWithCareerSquad.kit.textColor,
                          }}
                        >
                          {slotPlayer?.number ?? idx + 1}
                        </div>
                        <span className="mt-0.5 px-1 rounded bg-black/70 text-[9px] text-white font-semibold whitespace-nowrap">
                          {slotPlayer?.shortName || `J${idx + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-400">
                  Dica: Alterne o Titular 1v1 abaixo sempre que a energia (FIS) cair abaixo de 50% entre jogos seguidos.
                </p>
              </div>
            </div>

            {transferNotice && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs font-semibold text-emerald-300">
                {transferNotice}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myTeamWithCareerSquad.players.map((pl, idx) => (
                <div key={pl.id} className="space-y-2">
                  <PlayerCard
                    player={pl}
                    team={myTeamWithCareerSquad}
                    selected={idx === 0}
                    badgeLabel={
                      idx === 0 ? 'TITULAR 1v1 (EM CAMPO)' : idx < 3 ? `ROTAÇÃO #${idx + 1}` : 'BANCO DE RESERVAS'
                    }
                  />
                  <div className="flex gap-2">
                    {idx !== 0 && (
                      <button
                        onClick={() => handleMakeStarter(pl.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-xs font-bold text-emerald-200 cursor-pointer"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" /> Escalar 1v1
                      </button>
                    )}
                    <button
                      onClick={() => handleSellPlayer(pl)}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-300 cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Vender
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: TRANSFERÊNCIAS ================= */}
        {activeTab === 'market' && (
          <div className="space-y-4">
            <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar craque ou clube (ex: Mbappé, Yamal, Pedro, Haaland)..."
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['all', ...LEAGUES.map((l) => l.id)] as const).map((lg) => (
                  <button
                    key={lg}
                    onClick={() => setMarketLeague(lg)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      marketLeague === lg
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-black/30 text-slate-300 hover:text-white'
                    }`}
                  >
                    {lg === 'all' ? 'Todas Ligas' : LEAGUES.find((l) => l.id === lg)?.shortName}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5">
                {(['ALL', 'ATA', 'MEI', 'ZAG', 'GOL'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setMarketPos(pos)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      marketPos === pos ? 'bg-amber-400 text-slate-950' : 'bg-black/30 text-slate-300'
                    }`}
                  >
                    {pos === 'ALL' ? 'Todos' : pos}
                  </button>
                ))}
              </div>
            </div>

            {transferNotice && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs font-semibold text-emerald-300">
                {transferNotice}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[620px] overflow-y-auto pr-1">
              {marketPlayers.slice(0, 48).map(({ player, club }) => {
                const canAfford = career.budgetMillions >= player.valueMillions;
                return (
                  <div key={player.id} className="space-y-2">
                    <PlayerCard player={player} team={club} compact />
                    <button
                      onClick={() => handleBuyPlayer(player, club)}
                      disabled={!canAfford}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                        canAfford
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/5 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Contratar por €{player.valueMillions}M
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 4: TABELA & CALENDÁRIO ================= */}
        {activeTab === 'table' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Standings Table */}
              <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="font-display text-2xl font-bold text-white">Classificação · {leagueInfo?.name}</h2>
                  <span className="text-[11px] text-slate-400">1º–3º Libertadores · 4º–6º Sul-Americana</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="py-2 px-2">#</th>
                        <th className="py-2 px-2">Clube</th>
                        <th className="py-2 px-2 text-center">J</th>
                        <th className="py-2 px-2 text-center">V</th>
                        <th className="py-2 px-2 text-center">E</th>
                        <th className="py-2 px-2 text-center">D</th>
                        <th className="py-2 px-2 text-center">SG</th>
                        <th className="py-2 px-2 text-right">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sortedTable.map((row, idx) => {
                        const club = teams.find((t) => t.id === row.teamId);
                        if (!club) return null;
                        const isMe = club.id === career.teamId;
                        const pos = idx + 1;
                        return (
                          <tr key={row.teamId} className={isMe ? 'bg-emerald-500/15 font-bold text-white' : 'text-slate-300'}>
                            <td className="py-2.5 px-2 font-mono-tabular">
                              <span className={pos <= 3 ? 'text-amber-400' : pos <= 6 ? 'text-sky-400' : 'text-slate-500'}>
                                {pos}
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <ClubCrest team={club} size={22} />
                                <span>{club.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">{row.played}</td>
                            <td className="py-2.5 px-2 text-center">{row.won}</td>
                            <td className="py-2.5 px-2 text-center">{row.drawn}</td>
                            <td className="py-2.5 px-2 text-center">{row.lost}</td>
                            <td className="py-2.5 px-2 text-center">{row.goalsFor - row.goalsAgainst}</td>
                            <td className="py-2.5 px-2 text-right font-mono-tabular text-white font-bold">{row.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Match Calendar & Top Scorers */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Calendário do Clube
                      </h3>
                    </div>
                    <div className="flex gap-1 bg-black/35 p-0.5 rounded-lg">
                      <button
                        onClick={() => setCalendarRoundFilter('current')}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          calendarRoundFilter === 'current' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
                        }`}
                      >
                        Rodada {Math.min(career.currentRound, career.totalRounds)}
                      </button>
                      <button
                        onClick={() => setCalendarRoundFilter('all')}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          calendarRoundFilter === 'all' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
                        }`}
                      >
                        Temporada
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {career.fixtures
                      .filter((f) =>
                        calendarRoundFilter === 'current'
                          ? f.round === Math.min(career.currentRound, career.totalRounds)
                          : f.homeTeamId === career.teamId || f.awayTeamId === career.teamId
                      )
                      .map((fx) => {
                        const ht = teams.find((t) => t.id === fx.homeTeamId);
                        const at = teams.find((t) => t.id === fx.awayTeamId);
                        const involvesMe = fx.homeTeamId === career.teamId || fx.awayTeamId === career.teamId;
                        return (
                          <div
                            key={fx.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                              involvesMe
                                ? 'bg-emerald-500/10 border-emerald-400/35 text-white'
                                : 'bg-black/25 border-white/5 text-slate-300'
                            }`}
                          >
                            <span className="text-[10px] font-mono-tabular text-slate-400 w-7">R{fx.round}</span>
                            <div className="flex-1 flex items-center justify-between gap-2">
                              <span className="truncate font-semibold">{ht?.shortCode}</span>
                              <span className="font-mono-tabular font-bold text-amber-300">
                                {fx.played ? `${fx.homeGoals} - ${fx.awayGoals}` : 'vs'}
                              </span>
                              <span className="truncate font-semibold text-right">{at?.shortCode}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Artilharia da Liga
                  </h3>
                  {Object.values(career.topScorers).length === 0 ? (
                    <p className="text-xs text-slate-500">Jogue ou simule partidas para registrar artilheiros.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.values(career.topScorers)
                        .sort((a, b) => b.goals - a.goals)
                        .slice(0, 6)
                        .map((sc, i) => {
                          const cl = teams.find((t) => t.id === sc.teamId);
                          return (
                            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                              <div>
                                <span className="text-white font-semibold">{sc.name}</span>{' '}
                                <span className="text-slate-400">({cl?.shortCode})</span>
                              </div>
                              <span className="font-mono-tabular font-bold text-amber-300">{sc.goals} gols</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Copa Continental Mata-Mata */}
            <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-extrabold text-white">
                    {career.cupType === 'libertadores'
                      ? `CONMEBOL Libertadores ${career.season}`
                      : `CONMEBOL Sul-Americana ${career.season}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mata-mata oficial com disputa de pênaltis em caso de empate (+€35M ao campeão).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Shield className="w-4 h-4" /> Título +€35M
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {career.cupMatches.map((cm, idx) => {
                  const opp = teams.find((t) => t.id === cm.opponentId) || teams[0];
                  const isNext = !cm.played && !cupEliminated && career.cupMatches.findIndex((m) => !m.played) === idx;
                  const stageTitle =
                    cm.stage === 'quartas' ? 'Quartas de Final' : cm.stage === 'semi' ? 'Semifinal' : 'Grande Final';
                  return (
                    <div
                      key={cm.stage}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                        isNext
                          ? 'bg-amber-500/10 border-amber-400'
                          : cm.played && cm.won
                            ? 'bg-emerald-500/10 border-emerald-500/35'
                            : 'bg-black/30 border-white/10'
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{stageTitle}</div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ClubCrest team={myTeamWithCareerSquad} size={28} />
                            <span className="text-xs font-bold text-white">{myTeamWithCareerSquad.shortCode}</span>
                          </div>
                          <span className="font-mono-tabular text-base font-extrabold text-white">
                            {cm.played ? `${cm.userGoals} - ${cm.oppGoals}` : 'VS'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{opp.shortCode}</span>
                            <ClubCrest team={opp} size={28} />
                          </div>
                        </div>
                      </div>
                      {cm.played ? (
                        <div
                          className={`text-center text-xs font-bold py-1.5 rounded-lg ${
                            cm.won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {cm.won ? 'Classificado / Campeão' : 'Eliminado'}
                        </div>
                      ) : isNext ? (
                        <button
                          onClick={handlePlayCupMatch}
                          className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Jogar {stageTitle}
                        </button>
                      ) : (
                        <div className="text-center text-xs text-slate-500 py-1.5">
                          {cupEliminated ? 'Encerrado' : 'Aguardando fase anterior'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: FINANÇAS & CLUBE ================= */}
        {activeTab === 'finances' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Caixa do Clube</div>
                    <div className="font-display text-4xl font-extrabold text-emerald-400 tabular-nums">
                      €{career.budgetMillions}M
                    </div>
                  </div>
                  <Building2 className="w-8 h-8 text-emerald-400/70" />
                </div>

                <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">
                      Estádio Nível {career.stadiumLevel || 1} / 5
                    </span>
                    <span className="font-mono-tabular text-amber-300 font-bold">
                      +€{Math.max(1, Math.round(1 + (career.stadiumLevel || 1) * 1.2))}M / jogo
                    </span>
                  </div>
                  {(career.stadiumLevel || 1) < 5 ? (
                    <button
                      onClick={() => {
                        const res = upgradeStadium(career);
                        if (res) {
                          soundEngine.playTransferSuccess();
                          onSetCareer(res.updated);
                        } else {
                          setTransferNotice(`Saldo insuficiente para expandir estádio (€${(career.stadiumLevel || 1) * 12}M).`);
                        }
                      }}
                      disabled={career.budgetMillions < (career.stadiumLevel || 1) * 12}
                      className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Expandir Estádio (€{(career.stadiumLevel || 1) * 12}M)
                    </button>
                  ) : (
                    <div className="text-xs text-emerald-400 font-semibold text-center py-1">
                      Arena no nível máximo!
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <HeartHandshake className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Moral da Torcida & Diretoria</div>
                      <div className="text-[11px] text-slate-400">
                        {moraleValue}% ({moraleLabel})
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenKitCustomizer(career.teamId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    <Shirt className="w-3.5 h-3.5 text-emerald-400" /> Uniforme
                  </button>
                </div>
              </div>

              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Sala de Troféus do Clube
                </h3>
                {career.trophies.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Conquiste a liga nacional ou a copa continental para exibir taças nesta sala.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {career.trophies.map((tr, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                        <Trophy className="w-4 h-4 shrink-0" />
                        <span>{tr}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
              <h2 className="font-display text-2xl font-bold text-white">Extrato Financeiro da Temporada</h2>
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 px-2">Rodada</th>
                      <th className="py-2 px-2">Movimentação</th>
                      <th className="py-2 px-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(career.finances || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-500">
                          Nenhuma movimentação registrada ainda.
                        </td>
                      </tr>
                    ) : (
                      career.finances.map((fin) => (
                        <tr key={fin.id} className="text-slate-200">
                          <td className="py-2.5 px-2 font-mono-tabular text-slate-400">R{fin.round}</td>
                          <td className="py-2.5 px-2">{fin.label}</td>
                          <td
                            className={`py-2.5 px-2 text-right font-mono-tabular font-bold ${
                              fin.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {fin.kind === 'income' ? '+' : '-'}€{fin.amountMillions}M
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
