import React, { useState } from 'react';
import { ArrowLeft, Target, Swords, Play, Shield } from 'lucide-react';
import { LEAGUES } from '../data/teams2027';
import { ActiveMatchConfig, LeagueId, MatchSettings, Team } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

interface TrainingScreenProps {
  teams: Team[];
  settings: MatchSettings;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

export const TrainingScreen: React.FC<TrainingScreenProps> = ({
  teams,
  settings,
  onStartMatch,
  onBack,
}) => {
  const [trainingMode, setTrainingMode] = useState<'training_1v1' | 'training_solo'>('training_1v1');
  const [selectedLeague, setSelectedLeague] = useState<LeagueId>('brasileirao');
  const [teamId, setTeamId] = useState<string>('fla');
  const [opponentId, setOpponentId] = useState<string>('rma');

  const homeTeam = teams.find((t) => t.id === teamId) || teams[0];
  const awayTeam = teams.find((t) => t.id === opponentId) || teams[1];
  const leagueTeams = teams.filter((t) => t.leagueId === selectedLeague);

  const handleStart = () => {
    soundEngine.playWhistle(false);
    onStartMatch({
      tournament: 'friendly',
      tournamentLabel:
        trainingMode === 'training_solo'
          ? 'Modo Treino · Livre Solo'
          : 'Modo Treino · 1v1',
      homeTeam,
      awayTeam,
      humanSide: 'home',
      settings: {
        ...settings,
        format: trainingMode,
        withGoalkeeper: false,
        durationSeconds: 300,
      },
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
            Modo Treino
          </h1>
        </div>
        <button
          onClick={handleStart}
          className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" /> Entrar em Campo
        </button>
      </header>

      <main className="flex-1 max-w-5xl 2xl:max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              soundEngine.playClick();
              setTrainingMode('training_1v1');
            }}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              trainingMode === 'training_1v1'
                ? 'bg-emerald-500/15 border-emerald-400 shadow-lg'
                : 'bg-[#111D16] border-white/10 hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-extrabold text-white">Treino 1v1 (Sozinho vs Bot)</span>
              <Swords className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-300 mt-1.5">
              Treine marcação, drible e finalização em um duelo 1v1 (2 jogadores em campo) contra o bot de sparring. Pressione R para resetar a bola.
            </p>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setTrainingMode('training_solo');
            }}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              trainingMode === 'training_solo'
                ? 'bg-amber-500/15 border-amber-400 shadow-lg'
                : 'bg-[#111D16] border-white/10 hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-extrabold text-white">Treino Livre Solo</span>
              <Target className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-xs text-slate-300 mt-1.5">
              Campo livre apenas com você e a bola. Pratique tabelas na parede, precisão de chute no Espaço e velocidade (km/h).
            </p>
          </button>
        </div>

        <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white">Escolha seu Time para Treinar</h2>
            <div className="flex items-center gap-2">
              <ClubCrest team={homeTeam} size={28} />
              <span className="text-sm font-semibold text-emerald-400">{homeTeam.name}</span>
              {trainingMode === 'training_1v1' && (
                <>
                  <span className="text-xs text-slate-500">vs</span>
                  <ClubCrest team={awayTeam} size={28} />
                  <span className="text-sm font-semibold text-slate-200">{awayTeam.name}</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 bg-black/35 p-1 rounded-xl">
            {LEAGUES.map((lg) => (
              <button
                key={lg.id}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedLeague(lg.id);
                }}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedLeague === lg.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {lg.shortName}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {leagueTeams.map((team) => {
              const isMine = team.id === teamId;
              return (
                <div
                  key={team.id}
                  className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
                    isMine ? 'bg-emerald-500/15 border-emerald-400' : 'bg-black/25 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ClubCrest team={team} size={26} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{team.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono-tabular">OVR {team.ovr}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        setTeamId(team.id);
                      }}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        isMine ? 'bg-emerald-500 text-slate-950' : 'bg-white/10 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      Meu Time
                    </button>
                    {trainingMode === 'training_1v1' && (
                      <button
                        onClick={() => {
                          soundEngine.playClick();
                          setOpponentId(team.id);
                        }}
                        className={`flex-1 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          opponentId === team.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-slate-200 hover:bg-white/15'
                        }`}
                      >
                        Sparring
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
