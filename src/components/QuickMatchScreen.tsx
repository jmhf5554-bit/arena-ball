import React, { useState } from 'react';
import { ArrowLeft, Trophy, Swords, Users, Shield, Play, ArrowLeftRight, Crosshair, Minimize2, Maximize2 } from 'lucide-react';
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

export const QuickMatchScreen: React.FC<QuickMatchScreenProps> = ({
  teams,
  settings,
  initialFormat = '1v1',
  onUpdateSettings,
  onStartMatch,
  onBack,
}) => {
  const [selectedCup, setSelectedCup] = useState<'libertadores' | 'sulamericana' | 'friendly' | 'penalties'>(
    initialFormat === 'local_2p' ? 'friendly' : 'libertadores'
  );
  const [finalConfirmed, setFinalConfirmed] = useState<
    'libertadores_final' | 'sulamericana_final' | 'friendly' | 'penalty_shootout'
  >(initialFormat === 'local_2p' ? 'friendly' : 'libertadores_final');
  const [playMode, setPlayMode] = useState<'1v1' | '2v2' | 'local_2p'>(initialFormat);
  const [player1Name, setPlayer1Name] = useState('Jogador 1');
  const [player2Name, setPlayer2Name] = useState('Jogador 2');
  const [homeLeague, setHomeLeague] = useState<LeagueId>('brasileirao');
  const [awayLeague, setAwayLeague] = useState<LeagueId>('brasileirao');
  const [homeTeamId, setHomeTeamId] = useState<string>('fla');
  const [awayTeamId, setAwayTeamId] = useState<string>('pal');

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
            : 'Amistoso 2027';

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

  const isLocal2P = selectedCup !== 'penalties' && playMode === 'local_2p';
  const is2v2 = selectedCup !== 'penalties' && playMode === '2v2';

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
          <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-wide text-white">
            {isLocal2P
              ? '2 Jogadores Local (Mesmo PC / Tela)'
              : is2v2
                ? 'Jogo Rápido · Modo 2v2 (4 Jogadores)'
                : 'Jogo Rápido'}
          </h1>
        </div>

        <button
          onClick={handleStart}
          className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <Play className="w-4 h-4 fill-current" />
          {selectedCup === 'penalties'
            ? 'Ir para os Pênaltis'
            : isLocal2P
              ? 'Ver Escalação 2P Local'
              : is2v2
                ? 'Ver Escalação 2v2'
                : 'Ver Escalação 1v1'}
        </button>
      </header>

      <main className="flex-1 max-w-6xl 2xl:max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            1. Escolha a Competição (Estilo FIFA)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <button
              onClick={() => handleSelectCup('libertadores')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedCup === 'libertadores'
                  ? 'bg-amber-500/15 border-amber-400 shadow-lg'
                  : 'bg-[#111D16] border-white/10 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-extrabold text-amber-300">
                  CONMEBOL Libertadores
                </span>
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-300 mt-1.5">
                Decisão continental com troféu dourado e pênaltis em caso de empate.
              </p>
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold">
                <span className="text-amber-200">Final da Libertadores</span>
                {selectedCup === 'libertadores' && <span className="text-emerald-400">Ativo</span>}
              </div>
            </button>

            <button
              onClick={() => handleSelectCup('sulamericana')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedCup === 'sulamericana'
                  ? 'bg-sky-500/15 border-sky-400 shadow-lg'
                  : 'bg-[#111D16] border-white/10 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-extrabold text-sky-300">
                  CONMEBOL Sul-Americana
                </span>
                <Shield className="w-5 h-5 text-sky-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-300 mt-1.5">
                Grande decisão sul-americana em campo especial com pênaltis.
              </p>
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold">
                <span className="text-sky-200">Final da Sul-Americana</span>
                {selectedCup === 'sulamericana' && <span className="text-emerald-400">Ativo</span>}
              </div>
            </button>

            <button
              onClick={() => handleSelectCup('friendly')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedCup === 'friendly'
                  ? 'bg-emerald-500/15 border-emerald-400 shadow-lg'
                  : 'bg-[#111D16] border-white/10 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-extrabold text-emerald-300">
                  Amistoso 2027
                </span>
                <Swords className="w-5 h-5 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-300 mt-1.5">
                Enfrente qualquer clube de Brasileirão, Argentina, Equador, Colômbia, La Liga, Premier ou Bundesliga.
              </p>
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold">
                <span className="text-emerald-200">90' + Acréscimos</span>
                {selectedCup === 'friendly' && <span className="text-emerald-400">Ativo</span>}
              </div>
            </button>

            <button
              onClick={() => handleSelectCup('penalties')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedCup === 'penalties'
                  ? 'bg-rose-500/15 border-rose-400 shadow-lg'
                  : 'bg-[#111D16] border-white/10 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-extrabold text-rose-300">
                  Disputa de Pênaltis
                </span>
                <Crosshair className="w-5 h-5 text-rose-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-300 mt-1.5">
                Cobranças alternadas! Mire no gol com A/D, chute no Espaço e defenda com seu goleiro.
              </p>
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold">
                <span className="text-rose-200">5 Cobranças + Morte Súbita</span>
                {selectedCup === 'penalties' && <span className="text-emerald-400">Ativo</span>}
              </div>
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> 2. Formato em Campo (1v1, 2v2 ou 2P Local)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setPlayMode('1v1');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  playMode === '1v1'
                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="font-display text-xl font-extrabold leading-none">
                  1v1 Clássico
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Seu craque contra 1 adversário da IA.
                </div>
              </button>

              <button
                type="button"
                disabled={selectedCup === 'penalties'}
                onClick={() => {
                  soundEngine.playClick();
                  setPlayMode('2v2');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-45 ${
                  playMode === '2v2' && selectedCup !== 'penalties'
                    ? 'bg-sky-500/20 border-sky-400 text-white shadow'
                    : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="font-display text-xl font-extrabold leading-none text-sky-300">
                  2v2 (4 em Campo)
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  2 contra 2 com parceiro de ataque e campo ampliado!
                </div>
              </button>

              <button
                type="button"
                disabled={selectedCup === 'penalties'}
                onClick={() => {
                  soundEngine.playClick();
                  setPlayMode('local_2p');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-45 ${
                  playMode === 'local_2p' && selectedCup !== 'penalties'
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow'
                    : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="font-display text-xl font-extrabold leading-none text-amber-300">
                  2 Jogadores Local
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  J1 (WASD + Espaço) vs J2 (Setas + Enter/L).
                </div>
              </button>
            </div>

            {isLocal2P && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-300 mb-1">
                    Nome do Jogador 1 (Esquerda)
                  </label>
                  <input
                    type="text"
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    placeholder="Jogador 1"
                    maxLength={18}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-white focus:border-emerald-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">
                    Nome do Jogador 2 (Direita)
                  </label>
                  <input
                    type="text"
                    value={player2Name}
                    onChange={(e) => setPlayer2Name(e.target.value)}
                    placeholder="Jogador 2"
                    maxLength={18}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-[#111D16] border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isLocal2P ? 'Duração & Controles 2P Local' : 'Duração & Dificuldade'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tempo</label>
                <div className="flex gap-1.5">
                  {[120, 180, 300].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateSettings({ durationSeconds: sec });
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono-tabular font-semibold border cursor-pointer ${
                        settings.durationSeconds === sec
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {sec / 60}m
                    </button>
                  ))}
                </div>
              </div>

              {isLocal2P ? (
                <div className="text-[11px] text-slate-300 bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 leading-snug">
                  <div><strong className="text-emerald-300">J1:</strong> WASD + Espaço / Pad 1</div>
                  <div><strong className="text-amber-300">J2:</strong> Setas + Enter/L / Pad 2</div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Dificuldade</label>
                  <div className="flex gap-1.5">
                    {difficulties.map((diff) => (
                      <button
                        key={diff.id}
                        onClick={() => {
                          soundEngine.playClick();
                          onUpdateSettings({ difficulty: diff.id });
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          settings.difficulty === diff.id
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {diff.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. Bloco de Estádio / Arena */}
        {selectedCup !== 'penalties' && (
          <section className="bg-[#111D16] border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Minimize2 className="w-3.5 h-3.5 text-emerald-400" /> 3. Escolha o Estádio / Tamanho da Arena
              </div>
              <span className="text-[11px] text-emerald-300 font-semibold">
                {currentArenaSize === 'compact_stadium'
                  ? 'Modo Drible+ ativado · Controle curto e tabelas rápidas'
                  : is2v2
                    ? 'Campo Oficial Ampliado automático para 2v2'
                    : 'Gramado Oficial padrão'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onUpdateSettings({ arenaSize: 'standard' });
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  currentArenaSize === 'standard'
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow'
                    : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <Maximize2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-display text-xl font-extrabold leading-none">
                    Estádio Oficial {is2v2 ? '(Campo Maior 2v2)' : '(Padrão)'}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    {is2v2
                      ? 'Gramado estendido para 4 jogadores (2v2) com espaço para lançamentos e corridas.'
                      : 'Mesma física clássica com bastante espaço para arrancadas e chutes de longe.'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onUpdateSettings({ arenaSize: 'compact_stadium' });
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  currentArenaSize === 'compact_stadium'
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow'
                    : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <Minimize2 className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-display text-xl font-extrabold leading-none text-amber-200">
                    Estádio Compacto (Drible+)
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Mesmas regras em um estádio um pouco menor, com toque curto e mais agilidade para driblar mais!
                  </div>
                </div>
              </button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          <TeamSelectorCard
            title={
              isLocal2P
                ? `${player1Name.trim() || 'Jogador 1'} (Casa · WASD)`
                : 'Seu Time (Você Controla)'
            }
            selectedLeague={homeLeague}
            onSelectLeague={setHomeLeague}
            selectedTeamId={homeTeam.id}
            onSelectTeam={(id) => {
              soundEngine.playClick();
              setHomeTeamId(id);
            }}
            teams={teams}
            selectedTeam={homeTeam}
          />

          <div className="flex lg:flex-col items-center justify-center gap-3 py-2">
            <span className="font-display text-3xl font-extrabold text-slate-400">VS</span>
            <button
              onClick={handleSwapTeams}
              title="Inverter Times"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <TeamSelectorCard
            title={
              isLocal2P
                ? `${player2Name.trim() || 'Jogador 2'} (Visitante · Setas)`
                : 'Adversário (Bot)'
            }
            selectedLeague={awayLeague}
            onSelectLeague={setAwayLeague}
            selectedTeamId={awayTeam.id}
            onSelectTeam={(id) => {
              soundEngine.playClick();
              setAwayTeamId(id);
            }}
            teams={teams}
            selectedTeam={awayTeam}
          />
        </section>
      </main>
    </div>
  );
};

interface TeamSelectorCardProps {
  title: string;
  selectedLeague: LeagueId;
  onSelectLeague: (l: LeagueId) => void;
  selectedTeamId: string;
  onSelectTeam: (id: string) => void;
  teams: Team[];
  selectedTeam: Team;
}

const TeamSelectorCard: React.FC<TeamSelectorCardProps> = ({
  title,
  selectedLeague,
  onSelectLeague,
  selectedTeamId,
  onSelectTeam,
  teams,
  selectedTeam,
}) => {
  const leagueTeams = teams.filter((t) => t.leagueId === selectedLeague);

  return (
    <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        <div className="flex items-center gap-2">
          <ClubCrest team={selectedTeam} size={32} />
          <div>
            <div className="text-sm font-bold text-white leading-tight">{selectedTeam.name}</div>
            <div className="text-[11px] text-emerald-400 font-mono-tabular">OVR {selectedTeam.ovr}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-black/35 p-1 rounded-xl">
        {[...LEAGUES, { id: 'selecoes' as LeagueId, shortName: 'Seleções WC' }].map((lg) => (
          <button
            key={lg.id}
            onClick={() => {
              soundEngine.playClick();
              onSelectLeague(lg.id);
              const first = teams.find((t) => t.leagueId === lg.id);
              if (first) onSelectTeam(first.id);
            }}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold truncate transition-colors cursor-pointer ${
              selectedLeague === lg.id
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {lg.shortName}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
        {leagueTeams.map((team) => {
          const active = team.id === selectedTeamId;
          return (
            <button
              key={team.id}
              onClick={() => onSelectTeam(team.id)}
              className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                active
                  ? 'bg-emerald-500/20 border-emerald-400 text-white'
                  : 'bg-black/25 border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <ClubCrest team={team} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate">{team.name}</div>
                <div className="text-[10px] text-slate-400 font-mono-tabular">OVR {team.ovr}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
