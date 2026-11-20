import React, { useState } from 'react';
import { ArrowLeft, Trophy, Shield, Play, RotateCcw } from 'lucide-react';
import { LEAGUES } from '../data/teams2027';
import { ActiveMatchConfig, LeagueId, MatchSettings, Team } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

export interface StandaloneCupState {
  cupId: 'libertadores' | 'sulamericana' | 'copa_ligas';
  userTeamId: string;
  matches: {
    stage: 'quartas' | 'semi' | 'final';
    opponentId: string;
    played: boolean;
    won?: boolean;
    userGoals?: number;
    oppGoals?: number;
  }[];
}

const TOURNAMENT_STORAGE_KEY = 'arenabola_standalone_cup_v1';

export function loadStandaloneCup(): StandaloneCupState | null {
  try {
    const raw = localStorage.getItem(TOURNAMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StandaloneCupState;
    if (!parsed || !Array.isArray(parsed.matches) || !parsed.userTeamId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStandaloneCup(cup: StandaloneCupState | null) {
  if (!cup) {
    localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
  } else {
    localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(cup));
  }
}

interface TournamentsScreenProps {
  teams: Team[];
  cup: StandaloneCupState | null;
  settings: MatchSettings;
  onUpdateCup: (cup: StandaloneCupState | null) => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

export const TournamentsScreen: React.FC<TournamentsScreenProps> = ({
  teams,
  cup,
  settings,
  onUpdateCup,
  onStartMatch,
  onBack,
}) => {
  const [selectedCupId, setSelectedCupId] = useState<'libertadores' | 'sulamericana' | 'copa_ligas'>(
    'libertadores'
  );
  const [selectedLeague, setSelectedLeague] = useState<LeagueId>('brasileirao');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('fla');

  const pickedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];
  const leagueTeams = teams.filter((t) => t.leagueId === selectedLeague);

  const handleCreateCup = () => {
    soundEngine.playTransferSuccess();
    const candidates = teams
      .filter((t) => t.id !== pickedTeam.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const newCup: StandaloneCupState = {
      cupId: selectedCupId,
      userTeamId: pickedTeam.id,
      matches: [
        { stage: 'quartas', opponentId: candidates[0].id, played: false },
        { stage: 'semi', opponentId: candidates[1].id, played: false },
        { stage: 'final', opponentId: candidates[2].id, played: false },
      ],
    };
    saveStandaloneCup(newCup);
    onUpdateCup(newCup);
  };

  if (!cup) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-[#0D1812]">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                soundEngine.playClick();
                onBack();
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white">
              Torneios & Copas 2027 (Estilo FIFA)
            </h1>
          </div>

          <button
            onClick={handleCreateCup}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" /> Iniciar Torneio
          </button>
        </header>

        <main className="flex-1 max-w-6xl 2xl:max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: 'libertadores' as const,
                title: 'CONMEBOL Libertadores 2027',
                desc: 'Chave eliminatória com Quartas, Semi e Final em 1v1.',
                accent: 'amber',
              },
              {
                id: 'sulamericana' as const,
                title: 'CONMEBOL Sul-Americana 2027',
                desc: 'Copa continental com disputa de pênaltis em empates.',
                accent: 'sky',
              },
              {
                id: 'copa_ligas' as const,
                title: 'Supercopa das Ligas 2027',
                desc: 'Enfrente campeões de Brasileirão, Argentina, Equador, Colômbia, La Liga, Premier e Bundesliga.',
                accent: 'emerald',
              },
            ].map((item) => {
              const active = selectedCupId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedCupId(item.id);
                  }}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-400 shadow-lg'
                      : 'bg-[#111D16] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-2xl font-extrabold text-white">{item.title}</span>
                    <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">{item.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Escolha seu Clube no Torneio</h2>
              <div className="flex items-center gap-2">
                <ClubCrest team={pickedTeam} size={30} />
                <span className="text-sm font-bold text-emerald-400">{pickedTeam.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 bg-black/35 p-1 rounded-xl">
              {LEAGUES.map((lg) => (
                <button
                  key={lg.id}
                  onClick={() => {
                    setSelectedLeague(lg.id);
                    const first = teams.find((t) => t.leagueId === lg.id);
                    if (first) setSelectedTeamId(first.id);
                  }}
                  className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    selectedLeague === lg.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
                  }`}
                >
                  {lg.shortName}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {leagueTeams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedTeamId(t.id);
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-left cursor-pointer ${
                    t.id === pickedTeam.id
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-black/25 border-white/10 text-slate-300'
                  }`}
                >
                  <ClubCrest team={t} size={28} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{t.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono-tabular">OVR {t.ovr}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const userTeam = teams.find((t) => t.id === cup.userTeamId) || teams[0];
  const cupTitle =
    cup.cupId === 'libertadores'
      ? 'CONMEBOL Libertadores 2027'
      : cup.cupId === 'sulamericana'
        ? 'CONMEBOL Sul-Americana 2027'
        : 'Supercopa das Ligas 2027';

  const eliminated = cup.matches.some((m) => m.played && !m.won);
  const champion = cup.matches.find((m) => m.stage === 'final' && m.played && m.won);
  const nextIdx = cup.matches.findIndex((m) => !m.played);

  const handlePlayStage = () => {
    if (nextIdx === -1 || eliminated) return;
    const m = cup.matches[nextIdx];
    const opp = teams.find((t) => t.id === m.opponentId) || teams[1];
    const stageName =
      m.stage === 'quartas' ? 'Quartas de Final' : m.stage === 'semi' ? 'Semifinal' : 'Grande Final';

    onStartMatch({
      tournament: 'tournament_cup',
      tournamentLabel: `${cupTitle} · ${stageName}`,
      homeTeam: userTeam,
      awayTeam: opp,
      humanSide: 'home',
      settings: { ...settings, format: '1v1', withGoalkeeper: false },
    });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-[#0D1812]">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-center gap-3">
            <ClubCrest team={userTeam} size={34} />
            <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white">{cupTitle}</h1>
          </div>
        </div>

        <button
          onClick={() => {
            soundEngine.playClick();
            saveStandaloneCup(null);
            onUpdateCup(null);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Novo Torneio
        </button>
      </header>

      <main className="flex-1 max-w-5xl 2xl:max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {champion && (
          <div className="p-6 rounded-2xl bg-amber-400/15 border border-amber-400/50 text-center space-y-2">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="font-display text-3xl font-extrabold text-white">
              {userTeam.name} Campeão de {cupTitle}!
            </h2>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cup.matches.map((m, idx) => {
            const opp = teams.find((t) => t.id === m.opponentId) || teams[1];
            const isNext = !eliminated && idx === nextIdx;
            const stageTitle =
              m.stage === 'quartas' ? 'Quartas de Final' : m.stage === 'semi' ? 'Semifinal' : 'Grande Final';

            return (
              <div
                key={m.stage}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${
                  isNext
                    ? 'bg-amber-500/10 border-amber-400'
                    : m.played && m.won
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-[#111D16] border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span>{stageTitle}</span>
                    <Shield className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClubCrest team={userTeam} size={32} />
                      <span className="text-xs font-bold text-white">{userTeam.shortCode}</span>
                    </div>
                    <span className="font-mono-tabular text-lg font-extrabold text-white">
                      {m.played ? `${m.userGoals} - ${m.oppGoals}` : 'VS'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{opp.shortCode}</span>
                      <ClubCrest team={opp} size={32} />
                    </div>
                  </div>
                  <div className="text-center text-[11px] text-slate-400 mt-2">
                    {opp.name} (OVR {opp.ovr})
                  </div>
                </div>

                {m.played ? (
                  <div
                    className={`py-2 rounded-lg text-center text-xs font-bold ${
                      m.won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {m.won ? 'Classificado!' : 'Eliminado'}
                  </div>
                ) : isNext ? (
                  <button
                    onClick={handlePlayStage}
                    className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Jogar {stageTitle}
                  </button>
                ) : (
                  <div className="text-center text-xs text-slate-500 py-2">
                    {eliminated ? 'Encerrado' : 'Aguardando fase anterior'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
