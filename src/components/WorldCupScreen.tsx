import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Trophy,
  Play,
  FastForward,
  RotateCcw,
  Sparkles,
  Globe,
  Shield,
  Coins,
} from 'lucide-react';
import { WORLD_CUP_TEAMS } from '../data/worldCupTeams';
import { ActiveMatchConfig, MatchSettings, Team, WorldCupState } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';
import {
  createNewWorldCup,
  getUserNextWorldCupMatch,
  getWorldCupTeamById,
  saveWorldCupLocal,
  simulateCurrentWorldCupRound,
} from '../utils/worldCupEngine';

interface WorldCupScreenProps {
  worldCup: WorldCupState | null;
  settings: MatchSettings;
  onUpdateWorldCup: (wc: WorldCupState | null) => void;
  onClaimChampionReward: (championTeam: Team, wcId: string) => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

const STAGE_LABELS: Record<WorldCupState['currentStage'], string> = {
  group: 'Fase de Grupos',
  round_of_16: 'Oitavas de Final',
  quarter: 'Quartas de Final',
  semi: 'Semifinal',
  final: 'Grande Final',
  completed: 'Copa Encerrada',
};

const CONFETTI_COLORS = ['#FACC15', '#10B981', '#38BDF8', '#F43F5E', '#FFFFFF'];

export const WorldCupScreen: React.FC<WorldCupScreenProps> = ({
  worldCup,
  settings,
  onUpdateWorldCup,
  onClaimChampionReward,
  onStartMatch,
  onBack,
}) => {
  const [selectedNationId, setSelectedNationId] = useState<string>('wc-bra');
  const [confedFilter, setConfedFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'bracket'>('overview');

  const filteredNations = useMemo(() => {
    if (confedFilter === 'ALL') return WORLD_CUP_TEAMS;
    if (confedFilter === 'OTHER') {
      return WORLD_CUP_TEAMS.filter(
        (t) => t.confederation !== 'CONMEBOL' && t.confederation !== 'UEFA'
      );
    }
    return WORLD_CUP_TEAMS.filter((t) => t.confederation === confedFilter);
  }, [confedFilter]);

  const pickedNation = getWorldCupTeamById(selectedNationId) || WORLD_CUP_TEAMS[0];

  // Trigger champion reward once when user wins the World Cup
  useEffect(() => {
    if (
      worldCup &&
      worldCup.currentStage === 'completed' &&
      worldCup.championTeamId === worldCup.userTeamId &&
      !worldCup.rewardClaimed
    ) {
      const champTeam = getWorldCupTeamById(worldCup.championTeamId);
      if (champTeam) {
        soundEngine.playGoalCheer();
        onClaimChampionReward(champTeam, worldCup.id);
      }
    }
  }, [worldCup, onClaimChampionReward]);

  const handleStartNewDraw = () => {
    soundEngine.playTransferSuccess();
    const fresh = createNewWorldCup(pickedNation.id);
    onUpdateWorldCup(fresh);
    setActiveTab('groups');
  };

  // ================= NATION PICKER (NO ACTIVE WORLD CUP) =================
  if (!worldCup) {
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
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-400" />
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Copa do Mundo 2027
              </h1>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            32 Seleções · 8 Grupos · Mata-Mata Completo
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bg-[#111D16] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-white">
                Escolha sua Seleção
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: 'Todas (32)' },
                  { id: 'CONMEBOL', label: 'América do Sul' },
                  { id: 'UEFA', label: 'Europa' },
                  { id: 'OTHER', label: 'África / Ásia / Am. Norte' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      soundEngine.playClick();
                      setConfedFilter(f.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      confedFilter === f.id
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-black/30 text-slate-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[58dvh] overflow-y-auto pr-1">
              {filteredNations.map((nation) => {
                const active = nation.id === selectedNationId;
                return (
                  <button
                    key={nation.id}
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedNationId(nation.id);
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 shadow-lg'
                        : 'bg-black/30 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <ClubCrest team={nation} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{nation.name}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {nation.confederation} · OVR {nation.ovr}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 bg-[#111D16] border border-amber-400/25 rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <ClubCrest team={pickedNation} size={64} />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Seleção Selecionada
                  </div>
                  <h3 className="font-display text-3xl font-extrabold text-white leading-tight">
                    {pickedNation.name}
                  </h3>
                  <div className="text-xs text-slate-300 tabular-nums">
                    {pickedNation.confederation} · Força Geral {pickedNation.ovr}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Convocados Principais
                </div>
                {pickedNation.players.map((pl) => (
                  <div
                    key={pl.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-none"
                  >
                    <span className="text-slate-100 font-medium">
                      <span className="font-mono-tabular text-slate-400 mr-1.5">#{pl.number}</span>
                      {pl.name}
                    </span>
                    <span className="font-mono-tabular font-bold text-emerald-300">{pl.ovr}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/25 text-xs text-amber-100 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Trophy className="w-4 h-4" /> Premiação de Campeão
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Conquiste a taça para registrar o troféu na Sala de Troféus do seu perfil e ganhar{' '}
                  <span className="text-amber-300 font-bold">+1.500 Moedas</span> no Supabase.
                </p>
              </div>
            </div>

            <button
              onClick={handleStartNewDraw}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-xl font-extrabold flex items-center justify-center gap-2 shadow-xl cursor-pointer"
            >
              <Sparkles className="w-5 h-5" /> Sortear Grupos e Iniciar
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ================= ACTIVE WORLD CUP HUB =================
  const userTeam = getWorldCupTeamById(worldCup.userTeamId) || WORLD_CUP_TEAMS[0];
  const userGroup = worldCup.groups.find((g) => g.teamIds.includes(worldCup.userTeamId)) || worldCup.groups[0];
  const nextMatch = getUserNextWorldCupMatch(worldCup);
  const nextHome = getWorldCupTeamById(nextMatch?.homeTeamId);
  const nextAway = getWorldCupTeamById(nextMatch?.awayTeamId);
  const championTeam = getWorldCupTeamById(worldCup.championTeamId);
  const userIsChampion =
    worldCup.currentStage === 'completed' && worldCup.championTeamId === worldCup.userTeamId;

  const handlePlayNextMatch = () => {
    if (!nextMatch || !nextHome || !nextAway) return;
    soundEngine.playClick();
    onStartMatch({
      tournament: nextMatch.kind === 'group' ? 'world_cup_group' : 'world_cup_knockout',
      tournamentLabel: nextMatch.label,
      homeTeam: nextHome,
      awayTeam: nextAway,
      humanSide: nextMatch.homeTeamId === worldCup.userTeamId ? 'home' : 'away',
      worldCupMatchId: nextMatch.matchId,
      settings: {
        ...settings,
        format: '1v1',
        withGoalkeeper: false,
      },
    });
  };

  const handleSimulateRound = () => {
    soundEngine.playClick();
    const updated = simulateCurrentWorldCupRound(worldCup);
    onUpdateWorldCup(updated);
  };

  const handleResetWorldCup = () => {
    soundEngine.playClick();
    saveWorldCupLocal(null);
    onUpdateWorldCup(null);
  };

  const renderKnockoutMatchCard = (matchId: string) => {
    const m = worldCup.knockoutMatches.find((x) => x.id === matchId);
    if (!m) return null;
    const h = getWorldCupTeamById(m.homeTeamId);
    const a = getWorldCupTeamById(m.awayTeamId);
    const involvesUser =
      m.homeTeamId === worldCup.userTeamId || m.awayTeamId === worldCup.userTeamId;

    return (
      <div
        key={m.id}
        className={`rounded-xl border p-2.5 space-y-1.5 text-xs ${
          involvesUser
            ? 'bg-emerald-500/15 border-emerald-400/50'
            : 'bg-black/35 border-white/10'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {h ? <ClubCrest team={h} size={20} /> : <Shield className="w-4 h-4 text-slate-600" />}
            <span
              className={`truncate font-semibold ${
                m.winnerId && m.winnerId === m.homeTeamId
                  ? 'text-emerald-300'
                  : 'text-slate-100'
              }`}
            >
              {h ? h.name : 'A definir'}
            </span>
          </div>
          <span className="font-mono-tabular font-bold text-white shrink-0">
            {m.played ? m.homeGoals : '-'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {a ? <ClubCrest team={a} size={20} /> : <Shield className="w-4 h-4 text-slate-600" />}
            <span
              className={`truncate font-semibold ${
                m.winnerId && m.winnerId === m.awayTeamId
                  ? 'text-emerald-300'
                  : 'text-slate-100'
              }`}
            >
              {a ? a.name : 'A definir'}
            </span>
          </div>
          <span className="font-mono-tabular font-bold text-white shrink-0">
            {m.played ? m.awayGoals : '-'}
          </span>
        </div>

        {m.played && m.decidedByPenalties && m.penaltySummary && (
          <div className="text-[10px] text-amber-300 font-semibold text-right">
            Pênaltis: {m.penaltySummary}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud relative overflow-x-hidden">
      {/* Confetti celebration overlay when user wins World Cup */}
      {userIsChampion && (
        <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
          {Array.from({ length: 34 }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 w-2.5 h-4 rounded-sm animate-bounce opacity-85"
              style={{
                left: `${(i * 3.1) % 100}%`,
                top: `${(i * 17) % 85}%`,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDuration: `${1.1 + (i % 5) * 0.35}s`,
              }}
            />
          ))}
        </div>
      )}

      <header className="relative z-30 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#0D1812]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Menu
          </button>
          <div className="flex items-center gap-2.5">
            <ClubCrest team={userTeam} size={34} />
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white leading-none">
                Copa do Mundo · {userTeam.name}
              </h1>
              <div className="text-xs text-emerald-300 mt-0.5">
                {STAGE_LABELS[worldCup.currentStage]}
                {worldCup.currentStage === 'group' ? ` · Rodada ${worldCup.currentGroupRound}/3` : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'overview' as const, label: 'Resumo' },
            { id: 'groups' as const, label: 'Grupos (A–H)' },
            { id: 'bracket' as const, label: 'Chaveamento' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundEngine.playClick();
                setActiveTab(tab.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-black/35 text-slate-300 border-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={handleResetWorldCup}
            className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Nova Copa
          </button>
        </div>
      </header>

      <main className="relative z-30 flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Champion Ceremony Banner */}
        {worldCup.currentStage === 'completed' && championTeam && (
          <div
            className={`rounded-2xl border p-6 text-center space-y-4 ${
              userIsChampion
                ? 'bg-gradient-to-br from-amber-500/25 via-[#14291C] to-emerald-500/20 border-amber-400/60'
                : 'bg-[#111D16] border-white/15'
            }`}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 mx-auto">
              <Trophy className="w-9 h-9" />
            </div>
            <div className="flex items-center justify-center gap-3">
              <ClubCrest team={championTeam} size={56} />
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {userIsChampion ? 'VOCÊ É CAMPEÃO MUNDIAL!' : 'Campeão da Copa do Mundo 2027'}
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
                  {championTeam.name}
                </h2>
              </div>
            </div>
            {userIsChampion ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
                <Coins className="w-4 h-4 text-amber-300" />
                Taça registrada na Sala de Troféus · +1.500 Moedas creditadas!
              </div>
            ) : (
              <p className="text-xs text-slate-300">
                Sua seleção caiu antes do título. Clique em "Nova Copa" para tentar outra conquista!
              </p>
            )}
            <div>
              <button
                onClick={handleResetWorldCup}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Iniciar Nova Copa do Mundo
              </button>
            </div>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-4">
              {nextMatch && nextHome && nextAway ? (
                <div className="bg-[#111D16] border border-emerald-400/35 rounded-2xl p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      {nextMatch.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {nextMatch.kind === 'knockout'
                        ? 'Empate vai para os Pênaltis'
                        : 'Vale 3 pontos no grupo'}
                    </span>
                  </div>

                  <div className="flex items-center justify-around py-4 bg-black/35 rounded-xl border border-white/10">
                    <div className="flex flex-col items-center gap-2 w-32 text-center">
                      <ClubCrest team={nextHome} size={58} />
                      <div className="font-display text-xl font-bold text-white">{nextHome.name}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">OVR {nextHome.ovr}</div>
                    </div>

                    <div className="font-display text-3xl font-extrabold text-amber-300">VS</div>

                    <div className="flex flex-col items-center gap-2 w-32 text-center">
                      <ClubCrest team={nextAway} size={58} />
                      <div className="font-display text-xl font-bold text-white">{nextAway.name}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">OVR {nextAway.ovr}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handlePlayNextMatch}
                      className="flex-1 min-w-[180px] py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-xl font-extrabold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-current" /> Jogar Partida
                    </button>
                    <button
                      onClick={handleSimulateRound}
                      className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FastForward className="w-4 h-4" /> Simular Rodada
                    </button>
                  </div>
                </div>
              ) : worldCup.currentStage !== 'completed' ? (
                <div className="bg-[#111D16] border border-rose-400/35 rounded-2xl p-5 space-y-4">
                  <h3 className="font-display text-2xl font-extrabold text-rose-300">
                    {userTeam.name} foi eliminada
                  </h3>
                  <p className="text-xs text-slate-300">
                    Você pode simular as próximas fases para acompanhar quem conquista a taça ou começar uma nova Copa.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSimulateRound}
                      className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <FastForward className="w-4 h-4" /> Simular Próxima Fase
                    </button>
                    <button
                      onClick={handleResetWorldCup}
                      className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer"
                    >
                      Recomeçar Copa
                    </button>
                  </div>
                </div>
              ) : null}

              {/* User Group Matches */}
              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
                <h3 className="font-display text-lg font-bold text-white">
                  Jogos do Grupo {userGroup.name}
                </h3>
                <div className="space-y-2">
                  {userGroup.matches.map((m) => {
                    const h = getWorldCupTeamById(m.homeTeamId);
                    const a = getWorldCupTeamById(m.awayTeamId);
                    if (!h || !a) return null;
                    const isUser = h.id === worldCup.userTeamId || a.id === worldCup.userTeamId;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                          isUser ? 'bg-emerald-500/10 border-emerald-400/35' : 'bg-black/25 border-white/5'
                        }`}
                      >
                        <span className="text-[11px] font-mono-tabular text-slate-400 w-10">R{m.round}</span>
                        <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                          <span className="truncate font-semibold text-white">{h.name}</span>
                          <ClubCrest team={h} size={20} />
                        </div>
                        <div className="px-3 font-mono-tabular font-bold text-amber-300">
                          {m.played ? `${m.homeGoals} - ${m.awayGoals}` : 'vs'}
                        </div>
                        <div className="flex-1 flex items-center justify-start gap-1.5 min-w-0">
                          <ClubCrest team={a} size={20} />
                          <span className="truncate font-semibold text-white">{a.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* User Group Standings */}
            <div className="lg:col-span-5 bg-[#111D16] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-white">
                  Classificação · Grupo {userGroup.name}
                </h3>
                <span className="text-[11px] text-emerald-300">Top 2 avançam</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-white/10 text-left">
                      <th className="py-2">#</th>
                      <th className="py-2">Seleção</th>
                      <th className="py-2 text-center">P</th>
                      <th className="py-2 text-center">J</th>
                      <th className="py-2 text-center">V</th>
                      <th className="py-2 text-center">E</th>
                      <th className="py-2 text-center">D</th>
                      <th className="py-2 text-center">GP</th>
                      <th className="py-2 text-center">GC</th>
                      <th className="py-2 text-center">SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userGroup.standings.map((row, idx) => {
                      const t = getWorldCupTeamById(row.teamId);
                      if (!t) return null;
                      const sg = row.goalsFor - row.goalsAgainst;
                      const isUser = t.id === worldCup.userTeamId;
                      return (
                        <tr
                          key={row.teamId}
                          className={`border-b border-white/5 tabular-nums ${
                            isUser ? 'bg-amber-400/15 font-bold text-white' : ''
                          }`}
                        >
                          <td className={`py-2 font-bold ${idx < 2 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {idx + 1}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <ClubCrest team={t} size={20} />
                              <span className="truncate max-w-[92px]">{t.shortCode}</span>
                            </div>
                          </td>
                          <td className="py-2 text-center font-extrabold text-white">{row.points}</td>
                          <td className="py-2 text-center text-slate-300">{row.played}</td>
                          <td className="py-2 text-center text-slate-300">{row.won}</td>
                          <td className="py-2 text-center text-slate-300">{row.drawn}</td>
                          <td className="py-2 text-center text-slate-300">{row.lost}</td>
                          <td className="py-2 text-center text-slate-300">{row.goalsFor}</td>
                          <td className="py-2 text-center text-slate-300">{row.goalsAgainst}</td>
                          <td className="py-2 text-center text-slate-200">{sg > 0 ? `+${sg}` : sg}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ALL 8 GROUPS TAB */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {worldCup.groups.map((g) => (
              <div key={g.name} className="bg-[#111D16] border border-white/10 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-extrabold text-white">Grupo {g.name}</h3>
                  <span className="text-[11px] text-slate-400">2 melhores classificam</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-white/10 text-left">
                        <th className="py-1.5">#</th>
                        <th className="py-1.5">Seleção</th>
                        <th className="py-1.5 text-center">P</th>
                        <th className="py-1.5 text-center">J</th>
                        <th className="py-1.5 text-center">V</th>
                        <th className="py-1.5 text-center">E</th>
                        <th className="py-1.5 text-center">D</th>
                        <th className="py-1.5 text-center">GP</th>
                        <th className="py-1.5 text-center">GC</th>
                        <th className="py-1.5 text-center">SG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.standings.map((row, idx) => {
                        const t = getWorldCupTeamById(row.teamId);
                        if (!t) return null;
                        const sg = row.goalsFor - row.goalsAgainst;
                        const isUser = t.id === worldCup.userTeamId;
                        return (
                          <tr
                            key={row.teamId}
                            className={`border-b border-white/5 tabular-nums ${
                              isUser ? 'bg-amber-400/15 font-bold text-white' : ''
                            }`}
                          >
                            <td className={`py-1.5 font-bold ${idx < 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {idx + 1}
                            </td>
                            <td className="py-1.5">
                              <div className="flex items-center gap-1.5">
                                <ClubCrest team={t} size={18} />
                                <span className="truncate max-w-[100px]">{t.name}</span>
                              </div>
                            </td>
                            <td className="py-1.5 text-center font-extrabold text-white">{row.points}</td>
                            <td className="py-1.5 text-center text-slate-300">{row.played}</td>
                            <td className="py-1.5 text-center text-slate-300">{row.won}</td>
                            <td className="py-1.5 text-center text-slate-300">{row.drawn}</td>
                            <td className="py-1.5 text-center text-slate-300">{row.lost}</td>
                            <td className="py-1.5 text-center text-slate-300">{row.goalsFor}</td>
                            <td className="py-1.5 text-center text-slate-300">{row.goalsAgainst}</td>
                            <td className="py-1.5 text-center text-slate-200">{sg > 0 ? `+${sg}` : sg}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KNOCKOUT BRACKET TAB */}
        {activeTab === 'bracket' && (
          <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-display text-xl font-extrabold text-white">
                Chaveamento Mata-Mata (Oitavas até a Final)
              </h3>
              {worldCup.currentStage === 'group' && (
                <span className="text-xs text-amber-300">
                  Os confrontos serão definidos ao final da Fase de Grupos
                </span>
              )}
            </div>

            {worldCup.knockoutMatches.length === 0 ? (
              <div className="p-8 rounded-xl bg-black/30 border border-white/10 text-center text-xs text-slate-400">
                Complete as 3 rodadas da Fase de Grupos para gerar o chaveamento oficial das Oitavas de Final.
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="min-w-[820px] grid grid-cols-4 gap-4 items-center">
                  {/* OITAVAS */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold uppercase text-emerald-300 text-center">
                      Oitavas de Final
                    </div>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => renderKnockoutMatchCard(`wc-r16-${i}`))}
                  </div>

                  {/* QUARTAS */}
                  <div className="space-y-12">
                    <div className="text-xs font-bold uppercase text-emerald-300 text-center">
                      Quartas de Final
                    </div>
                    {[0, 1, 2, 3].map((i) => renderKnockoutMatchCard(`wc-qf-${i}`))}
                  </div>

                  {/* SEMIFINAIS */}
                  <div className="space-y-28">
                    <div className="text-xs font-bold uppercase text-amber-300 text-center">
                      Semifinal
                    </div>
                    {[0, 1].map((i) => renderKnockoutMatchCard(`wc-sf-${i}`))}
                  </div>

                  {/* GRANDE FINAL */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase text-amber-300 text-center flex items-center justify-center gap-1">
                      <Trophy className="w-3.5 h-3.5" /> Grande Final
                    </div>
                    {renderKnockoutMatchCard('wc-final-0')}
                    {championTeam && (
                      <div className="p-3 rounded-xl bg-amber-400/15 border border-amber-400/40 text-center space-y-1.5">
                        <ClubCrest team={championTeam} size={36} className="mx-auto" />
                        <div className="text-[10px] font-bold uppercase text-amber-300">Campeão</div>
                        <div className="text-sm font-extrabold text-white">{championTeam.name}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
