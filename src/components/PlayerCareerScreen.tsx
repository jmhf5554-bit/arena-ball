import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Briefcase,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
} from 'lucide-react';
import {
  ActiveMatchConfig,
  MatchSettings,
  PlayerCareerState,
  PlayerPosition,
  Team,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { PlayerCard } from './PlayerCard';
import { soundEngine } from '../utils/audio';
import {
  acceptPlayerOffer,
  createPlayerCareer,
  promoteNormalCareerToPro,
  startNextPlayerSeason,
  upgradePlayerAttribute,
} from '../utils/playerCareerEngine';

interface PlayerCareerScreenProps {
  teams: Team[];
  playerCareer: PlayerCareerState | null;
  settings: MatchSettings;
  onUpdatePlayerCareer: (next: PlayerCareerState | null) => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

const TRAIL_COLORS = [
  { id: '#FACC15', label: 'Ouro' },
  { id: '#34D399', label: 'Esmeralda' },
  { id: '#38BDF8', label: 'Azul' },
  { id: '#FB7185', label: 'Fogo' },
];

export const PlayerCareerScreen: React.FC<PlayerCareerScreenProps> = ({
  teams,
  playerCareer,
  settings,
  onUpdatePlayerCareer,
  onStartMatch,
  onBack,
}) => {
  const [name, setName] = useState('Gabriel Silva');
  const [position, setPosition] = useState<PlayerPosition>('ATA');
  const [jerseyNumber, setJerseyNumber] = useState(10);
  const [nationality, setNationality] = useState('BRA');
  const [trailColor, setTrailColor] = useState('#FACC15');
  const [clubId, setClubId] = useState('fla');

  const [tab, setTab] = useState<'overview' | 'training' | 'table' | 'offers'>('overview');
  const [confirmReset, setConfirmReset] = useState(false);

  const candidateClubs = useMemo(
    () => teams.filter((t) => !t.isNationalTeam).slice(0, 24),
    [teams]
  );

  // ================= CREATE FIFA PLAYER CAREER (3v3) =================
  if (!playerCareer) {
    const selectedClub =
      candidateClubs.find((c) => c.id === clubId) || candidateClubs[0];

    const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      soundEngine.playTransferSuccess();
      const created = createPlayerCareer({
        name,
        nationality,
        position,
        number: jerseyNumber,
        trailColor,
        trialClubId: selectedClub.id,
        allTeams: teams,
      });
      onUpdatePlayerCareer(created);
    };

    return (
      <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10 bg-[#0D1812]">
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
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-none">
                Carreira de Jogador · FIFA 2v2
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Crie seu jogador profissional, entre no clube escolhido e dispute a temporada em partidas 2v2.
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
          <form
            onSubmit={handleCreate}
            className="bg-[#111D16] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-6"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <UserPlus className="w-6 h-6 text-amber-400" />
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Crie seu Craque Profissional
                  </h2>
                  <p className="text-xs text-slate-400">
                    Carreira estilo FIFA: controle exclusivamente seu jogador ao lado do parceiro em jogos 2v2.
                  </p>
                </div>
              </div>
              <span className="font-mono-tabular text-sm font-bold text-emerald-300">
                Modo 2v2 · Pro
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome do Jogador
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={22}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Camisa
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(Number(e.target.value) || 10)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm font-mono-tabular text-white focus:border-emerald-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    País
                  </label>
                  <select
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                  >
                    <option value="BRA">Brasil</option>
                    <option value="ARG">Argentina</option>
                    <option value="COL">Colômbia</option>
                    <option value="ECU">Equador</option>
                    <option value="URU">Uruguai</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Posição em Campo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'ATA' as PlayerPosition, label: 'Atacante' },
                      { id: 'MEI' as PlayerPosition, label: 'Meia' },
                      { id: 'ZAG' as PlayerPosition, label: 'Zagueiro' },
                    ]
                  ).map((pos) => (
                    <button
                      type="button"
                      key={pos.id}
                      onClick={() => {
                        soundEngine.playClick();
                        setPosition(pos.id);
                      }}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-bold cursor-pointer ${
                        position === pos.id
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-black/30 text-slate-300 border-white/10'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Rastro da Chuteira
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TRAIL_COLORS.map((tc) => (
                    <button
                      type="button"
                      key={tc.id}
                      onClick={() => {
                        soundEngine.playClick();
                        setTrailColor(tc.id);
                      }}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        trailColor === tc.id
                          ? 'bg-white/15 border-white text-white'
                          : 'bg-black/30 border-white/10 text-slate-400'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tc.id }}
                      />
                      <span>{tc.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Seu Clube Inicial (Carreira Profissional)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {candidateClubs.map((club) => {
                  const active = club.id === selectedClub.id;
                  return (
                    <button
                      type="button"
                      key={club.id}
                      onClick={() => {
                        soundEngine.playClick();
                        setClubId(club.id);
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-white'
                          : 'bg-black/25 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <ClubCrest team={club} size={26} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{club.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono-tabular">
                          OVR {club.ovr}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Iniciar Carreira Profissional (2v2)
            </button>
          </form>
        </main>
      </div>
    );
  }

  // ================= ACTIVE FIFA PLAYER CAREER (3v3 PRO HUB) =================
  const effectiveCareer = promoteNormalCareerToPro(playerCareer, teams);
  const targetClub =
    teams.find((t) => t.id === effectiveCareer.clubId) || teams[0];

  const heroPlayer = {
    ...effectiveCareer.player,
    stamina: 100,
  };

  const nextFixture = effectiveCareer.fixtures.find((f) => !f.played);

  const launchProMatch = () => {
    if (!nextFixture) return;
    soundEngine.playWhistle(false);
    const oppTeam =
      teams.find((t) => t.id === nextFixture.opponentId) ||
      teams.find((t) => t.id !== targetClub.id) ||
      teams[1];

    const clubTeammates = targetClub.players.filter((p) => p.id !== heroPlayer.id);
    const homeRoster = [heroPlayer, clubTeammates[0] || heroPlayer];

    const homeWithHero: Team = {
      ...targetClub,
      kit: {
        ...targetClub.kit,
        trailColor: effectiveCareer.trailColor || targetClub.kit.trailColor,
      },
      players: homeRoster,
    };

    const awayRoster = [oppTeam.players[0], oppTeam.players[1] || oppTeam.players[0]];
    const awayPrepared: Team = {
      ...oppTeam,
      players: awayRoster,
    };

    onStartMatch({
      tournament: 'player_career_pro',
      tournamentLabel: `Carreira FIFA 2v2 · Rodada ${nextFixture.round} vs ${oppTeam.shortCode}`,
      homeTeam: homeWithHero,
      awayTeam: awayPrepared,
      humanSide: 'home',
      settings: {
        ...settings,
        format: '2v2',
        arenaSize: 'standard',
        withGoalkeeper: false,
      },
    });
  };

  const handleUpgrade = (attr: 'pace' | 'shot' | 'pass' | 'def' | 'fis') => {
    if (effectiveCareer.skillPoints <= 0) return;
    soundEngine.playTransferSuccess();
    onUpdatePlayerCareer(upgradePlayerAttribute(effectiveCareer, attr));
  };

  const renderResetButton = () =>
    confirmReset ? (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            soundEngine.playClick();
            onUpdatePlayerCareer(null);
            setConfirmReset(false);
          }}
          className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold cursor-pointer"
        >
          Confirmar Reinício
        </button>
        <button
          onClick={() => setConfirmReset(false)}
          className="px-3 py-1.5 rounded-lg bg-white/10 text-slate-300 text-xs cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    ) : (
      <button
        onClick={() => setConfirmReset(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-xs text-slate-300 cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Nova Carreira
      </button>
    );

  const sortedStandings = [...effectiveCareer.standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const sgA = a.goalsFor - a.goalsAgainst;
    const sgB = b.goalsFor - b.goalsAgainst;
    return sgB !== sgA ? sgB - sgA : b.goalsFor - a.goalsFor;
  });
  const seasonCompleted = !nextFixture;

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
          <ClubCrest team={targetClub} size={36} />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Carreira FIFA 2v2 · Temporada {effectiveCareer.season} · {effectiveCareer.squadStatus}
            </div>
            <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white leading-none">
              {heroPlayer.name} #{heroPlayer.number} · {targetClub.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">{renderResetButton()}</div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4">
        <div className="flex flex-wrap gap-1.5 bg-[#0D1812] p-1 rounded-xl border border-white/10 w-fit">
          {(
            [
              { id: 'overview' as const, label: 'Próximo Jogo & Status' },
              { id: 'training' as const, label: `Evoluir Craque (${effectiveCareer.skillPoints} pts)` },
              { id: 'table' as const, label: 'Tabela da Liga' },
              { id: 'offers' as const, label: `Propostas (${effectiveCareer.offers.length})` },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                soundEngine.playClick();
                setTab(t.id);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                tab === t.id
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <PlayerCard
                player={heroPlayer}
                team={targetClub}
                badgeLabel={effectiveCareer.squadStatus.toUpperCase()}
              />
              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 grid grid-cols-2 gap-3 text-center">
                <div className="bg-black/30 rounded-xl p-2.5">
                  <div className="font-mono-tabular text-lg font-extrabold text-white">
                    {effectiveCareer.totalMatches}
                  </div>
                  <div className="text-[11px] text-slate-400">Jogos</div>
                </div>
                <div className="bg-black/30 rounded-xl p-2.5">
                  <div className="font-mono-tabular text-lg font-extrabold text-emerald-400">
                    {effectiveCareer.totalGoals}
                  </div>
                  <div className="text-[11px] text-slate-400">Gols</div>
                </div>
                <div className="bg-black/30 rounded-xl p-2.5">
                  <div className="font-mono-tabular text-lg font-extrabold text-amber-300">
                    {effectiveCareer.avgRating.toFixed(1)}
                  </div>
                  <div className="text-[11px] text-slate-400">Nota Média</div>
                </div>
                <div className="bg-black/30 rounded-xl p-2.5">
                  <div className="font-mono-tabular text-lg font-extrabold text-sky-300">
                    {effectiveCareer.managerTrust}%
                  </div>
                  <div className="text-[11px] text-slate-400">Confiança Técnico</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-5">
              {seasonCompleted ? (
                <div className="bg-[#111D16] border border-amber-400/40 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-7 h-7 text-amber-400" />
                    <div>
                      <h2 className="font-display text-3xl font-extrabold text-white">
                        Fim da Temporada {effectiveCareer.season}!
                      </h2>
                      <p className="text-xs text-slate-300">
                        Você completou todas as {effectiveCareer.totalRounds} rodadas. Renove para a próxima temporada ou aceite uma proposta na aba Propostas.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      soundEngine.playTransferSuccess();
                      onUpdatePlayerCareer(startNextPlayerSeason(effectiveCareer, teams));
                    }}
                    className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm cursor-pointer"
                  >
                    Iniciar Temporada {effectiveCareer.season + 1} no {targetClub.name}
                  </button>
                </div>
              ) : (
                <div className="bg-[#111D16] border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Rodada {nextFixture?.round} de {effectiveCareer.totalRounds}
                      </div>
                      <h2 className="font-display text-3xl font-extrabold text-white mt-0.5">
                        {targetClub.name} vs {nextFixture?.opponentName}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Você controla exclusivamente {heroPlayer.shortName} ao lado de seu parceiro do {targetClub.shortCode} em partidas 2v2!
                      </p>
                    </div>
                    <ClubCrest
                      team={
                        teams.find((t) => t.id === nextFixture?.opponentId) || targetClub
                      }
                      size={58}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1.5">Modo em Campo</label>
                      <div className="py-2 px-3 rounded-lg text-xs font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-center">
                        2v2 · 2 Jogadores por Time
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1.5">Estádio</label>
                      <div className="py-2 px-3 rounded-lg text-xs font-bold border bg-amber-500/15 text-amber-200 border-amber-400/35 text-center">
                        Estádio Oficial (Campo Ampliado 2v2)
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={launchProMatch}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" /> Jogar Rodada {nextFixture?.round} (2v2)
                  </button>
                </div>
              )}

              {effectiveCareer.trophies.length > 0 && (
                <div className="bg-[#111D16] border border-amber-400/25 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                  <Award className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-amber-200">
                    Troféus Conquistados: {effectiveCareer.trophies.join(' · ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'training' && (
          <div className="bg-[#111D16] border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" /> Evolução de Atributos (OVR {heroPlayer.ovr})
                </h2>
                <p className="text-xs text-slate-400">
                  Ganhe Pontos de Habilidade jogando bem e recebendo notas altas para subir seu OVR até 99.
                </p>
              </div>
              <span className="font-mono-tabular text-base font-extrabold text-emerald-400">
                {effectiveCareer.skillPoints} Pontos Disponíveis
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(
                [
                  { key: 'pace' as const, label: 'Velocidade (VEL)', desc: 'Aceleração e velocidade máxima da bolinha.', val: heroPlayer.pace },
                  { key: 'shot' as const, label: 'Chute (CHU)', desc: 'Potência e precisão das finalizações.', val: heroPlayer.shot },
                  { key: 'pass' as const, label: 'Passe (PAS)', desc: 'Controle e toque rápido no 2v2.', val: heroPlayer.pass },
                  { key: 'def' as const, label: 'Defesa (DEF)', desc: 'Massa corporal e força nos desarmes.', val: heroPlayer.def ?? 55 },
                  { key: 'fis' as const, label: 'Físico (FIS)', desc: 'Resistência para manter fôlego no 2º tempo.', val: heroPlayer.fis ?? 65 },
                ]
              ).map((stat) => (
                <div key={stat.key} className="bg-black/35 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{stat.label}</span>
                    <span className="font-mono-tabular text-xl font-extrabold text-amber-300">
                      {stat.val}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{stat.desc}</p>
                  <button
                    disabled={effectiveCareer.skillPoints <= 0 || stat.val >= 99}
                    onClick={() => handleUpgrade(stat.key)}
                    className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-35 text-slate-950 font-extrabold text-xs cursor-pointer"
                  >
                    Treinar (+2)
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'table' && (
          <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 overflow-x-auto">
            <h2 className="font-display text-2xl font-bold text-white mb-4">
              Classificação da Liga · Temporada {effectiveCareer.season}
            </h2>
            <table className="w-full text-xs text-left">
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
              <tbody>
                {sortedStandings.map((row, idx) => {
                  const t = teams.find((tm) => tm.id === row.teamId);
                  const isMine = row.teamId === effectiveCareer.clubId;
                  return (
                    <tr
                      key={row.teamId}
                      className={`border-b border-white/5 ${
                        isMine ? 'bg-emerald-500/15 text-white font-bold' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-2 font-mono-tabular">{idx + 1}</td>
                      <td className="py-2.5 px-2 flex items-center gap-2">
                        {t && <ClubCrest team={t} size={20} />}
                        <span>{t?.name || row.teamId}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono-tabular">{row.played}</td>
                      <td className="py-2.5 px-2 text-center font-mono-tabular">{row.won}</td>
                      <td className="py-2.5 px-2 text-center font-mono-tabular">{row.drawn}</td>
                      <td className="py-2.5 px-2 text-center font-mono-tabular">{row.lost}</td>
                      <td className="py-2.5 px-2 text-center font-mono-tabular">
                        {row.goalsFor - row.goalsAgainst}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono-tabular text-emerald-300">
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'offers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
              <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-400" /> Propostas de Transferência
              </h2>
              {effectiveCareer.offers.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Continue jogando e marcando gols para atrair propostas de clubes maiores a cada 3 rodadas ou ao fim da temporada.
                </p>
              ) : (
                <div className="space-y-3">
                  {effectiveCareer.offers.map((offer) => {
                    const c = teams.find((t) => t.id === offer.clubId);
                    return (
                      <div
                        key={offer.id}
                        className="bg-black/35 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          {c && <ClubCrest team={c} size={36} />}
                          <div>
                            <div className="text-sm font-bold text-white">{offer.clubName}</div>
                            <div className="text-[11px] text-slate-400">
                              OVR {offer.clubOvr} · {offer.roleLabel} · €{offer.weeklyWage}K/sem
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            soundEngine.playTransferSuccess();
                            onUpdatePlayerCareer(acceptPlayerOffer(effectiveCareer, offer.id, teams));
                            setTab('overview');
                          }}
                          className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Assinar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
              <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" /> Histórico de Partidas
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {effectiveCareer.history.map((h) => (
                  <div
                    key={h.id}
                    className="bg-black/30 border border-white/5 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{h.label}</div>
                      <div className="text-[11px] text-slate-400">
                        vs {h.opponentName} · {h.teamGoals}x{h.oppGoals} · {h.playerGoals} gol(s)
                      </div>
                    </div>
                    <span
                      className={`font-mono-tabular font-extrabold ${
                        h.rating >= 7.5
                          ? 'text-emerald-400'
                          : h.rating >= 6.5
                            ? 'text-amber-300'
                            : 'text-rose-300'
                      }`}
                    >
                      Nota {h.rating.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
