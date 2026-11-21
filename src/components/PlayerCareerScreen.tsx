import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Briefcase,
  CheckCircle2,
  Eye,
  Flame,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
} from 'lucide-react';
import {
  ActiveMatchConfig,
  ArenaSize,
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
  const [trialClubId, setTrialClubId] = useState('fla');

  const [tab, setTab] = useState<'overview' | 'training' | 'table' | 'offers'>('overview');
  const [matchFormat, setMatchFormat] = useState<'1v1' | '2v2'>('2v2');
  const [arenaChoice, setArenaChoice] = useState<ArenaSize>('standard');
  const [confirmReset, setConfirmReset] = useState(false);

  const candidateClubs = useMemo(
    () => teams.filter((t) => !t.isNationalTeam).slice(0, 24),
    [teams]
  );

  // ================= CREATE PLAYER BASE =================
  if (!playerCareer) {
    const selectedClub =
      candidateClubs.find((c) => c.id === trialClubId) || candidateClubs[0];

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
                Modo Base · Carreira de Jogador
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Da rua no asfalto com olheiro observando até a peneira e o futebol profissional estilo FIFA.
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
                    Crie Seu Garoto da Base
                  </h2>
                  <p className="text-xs text-slate-400">
                    Você começa com 17 anos e OVR 62 jogando na rua do bairro.
                  </p>
                </div>
              </div>
              <span className="font-mono-tabular text-sm font-bold text-amber-300">
                OVR Inicial 62
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
                Clube do Olheiro (Peneira Alvo)
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
                        setTrialClubId(club.id);
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
              <Play className="w-4 h-4 fill-current" /> Começar na Rua (Asfalto)
            </button>
          </form>
        </main>
      </div>
    );
  }

  // ================= ACTIVE PLAYER CAREER =================
  const targetClub =
    teams.find((t) => t.id === (playerCareer.stage === 'pro' ? playerCareer.clubId : playerCareer.trialClubId)) ||
    teams[0];

  const heroPlayer = {
    ...playerCareer.player,
    stamina: 100,
  };

  const launchStreetMatch = () => {
    soundEngine.playWhistle(false);
    const streetPartner = {
      ...heroPlayer,
      id: 'street-mate',
      name: 'Juninho da Vila',
      shortName: 'Juninho',
      number: 7,
      ovr: 64,
      pace: 66,
      shot: 62,
      pass: 65,
      def: 58,
      fis: 66,
    };

    const streetHome: Team = {
      id: 'street-home',
      name: 'Time da Rua',
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
      players: [heroPlayer, streetPartner],
    };

    const streetAway: Team = {
      id: 'street-away',
      name: 'Rivais do Asfalto',
      shortCode: 'ASF',
      leagueId: 'brasileirao',
      ovr: 63 + Math.min(6, playerCareer.streetMatchesPlayed * 2),
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
          id: 'asf-1',
          name: 'Léo do Morro',
          shortName: 'Léo',
          number: 9,
          position: 'ATA',
          ovr: 64,
          pace: 65,
          shot: 63,
          pass: 60,
          def: 56,
          fis: 64,
          age: 19,
          nationality: 'BRA',
          valueMillions: 1,
        },
        {
          id: 'asf-2',
          name: 'Biel Asfalto',
          shortName: 'Biel',
          number: 5,
          position: 'ZAG',
          ovr: 62,
          pace: 62,
          shot: 56,
          pass: 61,
          def: 65,
          fis: 66,
          age: 19,
          nationality: 'BRA',
          valueMillions: 1,
        },
      ],
    };

    onStartMatch({
      tournament: 'player_career_street',
      tournamentLabel: `Pelada na Rua · ${playerCareer.scoutName} Observando`,
      homeTeam: streetHome,
      awayTeam: streetAway,
      humanSide: 'home',
      settings: {
        ...settings,
        format: matchFormat,
        arenaSize: 'street_asphalt',
        withGoalkeeper: false,
        durationSeconds: 120,
      },
    });
  };

  const launchTrialMatch = () => {
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
        primaryColor: targetClub.kit.secondaryColor === targetClub.kit.primaryColor ? '#334155' : targetClub.kit.secondaryColor,
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
        arenaSize: arenaChoice,
        withGoalkeeper: false,
        durationSeconds: 120,
      },
    });
  };

  const nextFixture = playerCareer.fixtures.find((f) => !f.played);

  const launchProMatch = () => {
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
        arenaSize: arenaChoice,
        withGoalkeeper: false,
      },
    });
  };

  const handleUpgrade = (attr: 'pace' | 'shot' | 'pass' | 'def' | 'fis') => {
    if (playerCareer.skillPoints <= 0) return;
    soundEngine.playTransferSuccess();
    onUpdatePlayerCareer(upgradePlayerAttribute(playerCareer, attr));
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

  // ================= STAGE 1: RUA (ASFALTO COM OLHEIRO) =================
  if (playerCareer.stage === 'street') {
    const scoutReady = playerCareer.scoutInterest >= 100;
    return (
      <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10 bg-[#0D1812]">
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
                Etapa 1 · Futebol de Rua (Asfalto)
              </h1>
              <p className="text-xs text-amber-300 mt-0.5">
                {playerCareer.scoutName} está assistindo seu futebol na quadra do bairro.
              </p>
            </div>
          </div>
          {renderResetButton()}
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <PlayerCard player={heroPlayer} team={targetClub} badgeLabel="CRIA DA RUA" />

            <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Pontos de Evolução
                </span>
                <span className="font-mono-tabular text-sm font-extrabold text-emerald-400">
                  {playerCareer.skillPoints} pts
                </span>
              </div>
              <div className="space-y-2">
                {(
                  [
                    { key: 'pace' as const, label: 'Velocidade (VEL)', val: heroPlayer.pace },
                    { key: 'shot' as const, label: 'Chute (CHU)', val: heroPlayer.shot },
                    { key: 'pass' as const, label: 'Passe (PAS)', val: heroPlayer.pass },
                    { key: 'def' as const, label: 'Marcação (DEF)', val: heroPlayer.def ?? 55 },
                    { key: 'fis' as const, label: 'Físico (FIS)', val: heroPlayer.fis ?? 65 },
                  ]
                ).map((item) => (
                  <div key={item.key} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-bold text-white">{item.val}</span>
                      <button
                        disabled={playerCareer.skillPoints <= 0 || item.val >= 99}
                        onClick={() => handleUpgrade(item.key)}
                        className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-slate-950 font-extrabold text-[11px] cursor-pointer"
                      >
                        +2
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            <div className="bg-[#111D16] border border-amber-400/35 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Eye className="w-7 h-7 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                      Olheiro na Beira da Quadra
                    </div>
                    <h2 className="font-display text-3xl font-extrabold text-white leading-tight">
                      {playerCareer.scoutName} · {targetClub.name}
                    </h2>
                  </div>
                </div>
                <ClubCrest team={targetClub} size={52} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Interesse do Olheiro</span>
                  <span className="font-mono-tabular text-amber-300">
                    {playerCareer.scoutInterest}% / 100%
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-black/50 overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
                    style={{ width: `${playerCareer.scoutInterest}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  {scoutReady
                    ? `"Você destruiu no asfalto! Já conversei com a diretoria do ${targetClub.name} e agendei seu Teste Oficial (Peneira) no CT!"`
                    : `"Mostre talento nas peladas de rua no asfalto: drible, marque gols e vença jogos até o interesse chegar em 100% para ganhar o convite para a peneira."`}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-black/35 rounded-xl p-3">
                  <div className="font-mono-tabular text-xl font-extrabold text-white">
                    {playerCareer.streetMatchesPlayed}
                  </div>
                  <div className="text-[11px] text-slate-400">Peladas</div>
                </div>
                <div className="bg-black/35 rounded-xl p-3">
                  <div className="font-mono-tabular text-xl font-extrabold text-emerald-400">
                    {playerCareer.streetWins}
                  </div>
                  <div className="text-[11px] text-slate-400">Vitórias</div>
                </div>
                <div className="bg-black/35 rounded-xl p-3">
                  <div className="font-mono-tabular text-xl font-extrabold text-amber-300">
                    {playerCareer.streetGoals}
                  </div>
                  <div className="text-[11px] text-slate-400">Gols na Rua</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Formato:</span>
                  {(['2v2', '1v1'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        soundEngine.playClick();
                        setMatchFormat(fmt);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        matchFormat === fmt
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-black/30 text-slate-300 border-white/10'
                      }`}
                    >
                      {fmt.toUpperCase()} de Rua
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={launchStreetMatch}
                    className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Flame className="w-4 h-4" /> Jogar Pelada no Asfalto
                  </button>

                  {scoutReady && (
                    <button
                      onClick={() => {
                        soundEngine.playTransferSuccess();
                        onUpdatePlayerCareer({
                          ...playerCareer,
                          stage: 'trial',
                        });
                      }}
                      className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Ir para o Teste Oficial (Peneira)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ================= STAGE 2: TESTE / PENEIRA NO CLUBE =================
  if (playerCareer.stage === 'trial') {
    return (
      <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10 bg-[#0D1812]">
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
                Etapa 2 · Peneira Oficial ({targetClub.name})
              </h1>
              <p className="text-xs text-emerald-300 mt-0.5">
                Passe no teste em campo para assinar contrato profissional estilo FIFA!
              </p>
            </div>
          </div>
          {renderResetButton()}
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <PlayerCard player={heroPlayer} team={targetClub} badgeLabel="EM TESTE NO CT" />
            {playerCareer.skillPoints > 0 && (
              <div className="bg-[#111D16] border border-emerald-400/35 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-emerald-300">Evoluir Antes do Teste</span>
                  <span className="font-mono-tabular text-white">{playerCareer.skillPoints} pts</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: 'pace' as const, label: 'VEL', val: heroPlayer.pace },
                      { key: 'shot' as const, label: 'CHU', val: heroPlayer.shot },
                      { key: 'pass' as const, label: 'PAS', val: heroPlayer.pass },
                      { key: 'def' as const, label: 'DEF', val: heroPlayer.def ?? 55 },
                    ]
                  ).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => handleUpgrade(item.key)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/35 hover:bg-emerald-500/20 border border-white/10 text-xs font-bold cursor-pointer"
                    >
                      <span>{item.label} {item.val}</span>
                      <span className="text-emerald-400">+2</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 bg-[#111D16] border border-emerald-500/30 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-4">
              <ClubCrest team={targetClub} size={64} />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Avaliação Final da Comissão Técnica
                </div>
                <h2 className="font-display text-3xl font-extrabold text-white">
                  Jogo-Treino Decisivo · {targetClub.name}
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Tentativas realizadas: <span className="font-mono-tabular font-bold">{playerCareer.trialAttempts}</span>
                </p>
              </div>
            </div>

            {playerCareer.lastTrialFeedback && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-400/35 text-xs text-rose-200">
                {playerCareer.lastTrialFeedback}
              </div>
            )}

            <div className="bg-black/35 border border-white/10 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Critérios para Aprovação
              </div>
              <ul className="text-sm text-slate-200 space-y-1.5 list-disc list-inside">
                <li><strong>Vencer</strong> o jogo-treino contra o time Sub-20, OU</li>
                <li>Alcançar <strong>Nota de Atuação 7.0+</strong> marcando pelo menos <strong>{playerCareer.trialTargetGoals} gol</strong>.</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Formato do Teste</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['2v2', '1v1'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        soundEngine.playClick();
                        setMatchFormat(fmt);
                      }}
                      className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
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

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Arena do CT</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setArenaChoice('standard')}
                    className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                      arenaChoice === 'standard'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-black/30 text-slate-300 border-white/10'
                    }`}
                  >
                    Campo Oficial
                  </button>
                  <button
                    onClick={() => setArenaChoice('compact_stadium')}
                    className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                      arenaChoice === 'compact_stadium'
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-black/30 text-slate-300 border-white/10'
                    }`}
                  >
                    Compacto (Drible+)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={launchTrialMatch}
                className="flex-1 min-w-[220px] py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Fazer Teste Oficial em Campo
              </button>
              <button
                onClick={launchStreetMatch}
                className="py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Aquecer na Rua (Asfalto)
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ================= STAGE 3: CARREIRA DE JOGADOR PROFISSIONAL (ESTILO FIFA) =================
  const sortedStandings = [...playerCareer.standings].sort((a, b) => {
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
              Carreira de Jogador · Temporada {playerCareer.season} · {playerCareer.squadStatus}
            </div>
            <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white leading-none">
              {heroPlayer.name} #{heroPlayer.number} · {targetClub.name}
            </h1>
          </div>
        </div>
        {renderResetButton()}
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4">
        <div className="flex flex-wrap gap-1.5 bg-[#0D1812] p-1 rounded-xl border border-white/10 w-fit">
          {(
            [
              { id: 'overview' as const, label: 'Próximo Jogo & Status' },
              { id: 'training' as const, label: `Evoluir Craque (${playerCareer.skillPoints} pts)` },
              { id: 'table' as const, label: 'Tabela da Liga' },
              { id: 'offers' as const, label: `Propostas (${playerCareer.offers.length})` },
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
        {playerCareer.lastTrialFeedback && playerCareer.totalMatches <= 2 && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{playerCareer.lastTrialFeedback}</span>
          </div>
        )}

        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <PlayerCard
                player={heroPlayer}
                team={targetClub}
                badgeLabel={playerCareer.squadStatus.toUpperCase()}
              />
              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-4 grid grid-cols-2 gap-3 text-center">
                <div className="bg-black/30 rounded-xl p-2.5">
                  <div className="font-mono-tabular text-lg font-extrabold text-white">
                    {playerCareer.totalMatches}
                  </div>
                  <div className="text-[11px] text-slate-400">Jogos</div>
                </div>
                <div className="bg-black/30 rounded-xl p-2.5">
                  <div className="font-mono-tabular text-lg font-extrabold text-emerald-400">
                    {playerCareer.totalGoals}
                  </div>
                  <div className="text-[11px] text-slate-400">Gols</div>
                </div>
                <div className="bg-black/30 rounded-xl p-2.5">
                  <div className="font-mono-tabular text-lg font-extrabold text-amber-300">
                    {playerCareer.avgRating.toFixed(1)}
                  </div>
                  <div className="text-[11px] text-slate-400">Nota Média</div>
                </div>
                <div className="bg-black/30 rounded-xl p-2.5">
                  <div className="font-mono-tabular text-lg font-extrabold text-sky-300">
                    {playerCareer.managerTrust}%
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
                        Fim da Temporada {playerCareer.season}!
                      </h2>
                      <p className="text-xs text-slate-300">
                        Você completou todas as {playerCareer.totalRounds} rodadas. Renove para a próxima temporada ou aceite uma proposta na aba Propostas.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      soundEngine.playTransferSuccess();
                      onUpdatePlayerCareer(startNextPlayerSeason(playerCareer, teams));
                    }}
                    className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm cursor-pointer"
                  >
                    Iniciar Temporada {playerCareer.season + 1} no {targetClub.name}
                  </button>
                </div>
              ) : (
                <div className="bg-[#111D16] border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Rodada {nextFixture?.round} de {playerCareer.totalRounds}
                      </div>
                      <h2 className="font-display text-3xl font-extrabold text-white mt-0.5">
                        {targetClub.name} vs {nextFixture?.opponentName}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Você controla exclusivamente {heroPlayer.shortName} dentro de campo!
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
                      <div className="grid grid-cols-2 gap-2">
                        {(['2v2', '1v1'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => {
                              soundEngine.playClick();
                              setMatchFormat(fmt);
                            }}
                            className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                              matchFormat === fmt
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-black/30 text-slate-300 border-white/10'
                            }`}
                          >
                            {fmt === '2v2' ? '2v2 (Com Parceiro)' : '1v1 (Duelo)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1.5">Estádio</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setArenaChoice('standard')}
                          className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                            arenaChoice === 'standard'
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-black/30 text-slate-300 border-white/10'
                          }`}
                        >
                          Estádio Oficial
                        </button>
                        <button
                          onClick={() => setArenaChoice('compact_stadium')}
                          className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                            arenaChoice === 'compact_stadium'
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-black/30 text-slate-300 border-white/10'
                          }`}
                        >
                          Compacto (Drible+)
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={launchProMatch}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" /> Jogar Rodada {nextFixture?.round}
                  </button>
                </div>
              )}

              {playerCareer.trophies.length > 0 && (
                <div className="bg-[#111D16] border border-amber-400/25 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                  <Award className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-amber-200">
                    Troféus Conquistados: {playerCareer.trophies.join(' · ')}
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
                {playerCareer.skillPoints} Pontos Disponíveis
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
                    disabled={playerCareer.skillPoints <= 0 || stat.val >= 99}
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
              Classificação da Liga · Temporada {playerCareer.season}
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
                  const isMine = row.teamId === playerCareer.clubId;
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
              {playerCareer.offers.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Continue jogando e marcando gols para atrair propostas de clubes maiores a cada 3 rodadas ou ao fim da temporada.
                </p>
              ) : (
                <div className="space-y-3">
                  {playerCareer.offers.map((offer) => {
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
                            onUpdatePlayerCareer(acceptPlayerOffer(playerCareer, offer.id, teams));
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
                {playerCareer.history.map((h) => (
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
