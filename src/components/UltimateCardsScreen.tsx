import React, { useState, useMemo } from 'react';
import { ArrowLeft, Sparkles, Play, Trophy, Coins, PlusCircle, CheckCircle2 } from 'lucide-react';
import { LEAGUES } from '../data/teams2027';
import {
  ActiveMatchConfig,
  LeagueId,
  MatchSettings,
  Player,
  Team,
  UltimateClubState,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { PlayerCard } from './PlayerCard';
import { soundEngine } from '../utils/audio';

interface UltimateCardsScreenProps {
  teams: Team[];
  ultimate: UltimateClubState;
  settings: MatchSettings;
  onUpdateUltimate: (next: UltimateClubState) => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

export const UltimateCardsScreen: React.FC<UltimateCardsScreenProps> = ({
  teams,
  ultimate,
  settings,
  onUpdateUltimate,
  onStartMatch,
  onBack,
}) => {
  const [opponentLeague, setOpponentLeague] = useState<LeagueId>('laliga');
  const [opponentId, setOpponentId] = useState<string>('rma');
  const [packResult, setPackResult] = useState<{ player: Player; team: Team; isNew: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Build map of all 2027 players and their club
  const allCards = useMemo(() => {
    const list: { player: Player; team: Team }[] = [];
    for (const t of teams) {
      for (const p of t.players) {
        list.push({ player: p, team: t });
      }
    }
    return list.sort((a, b) => b.player.ovr - a.player.ovr);
  }, [teams]);

  const ownedCards = useMemo(() => {
    const set = new Set(ultimate.ownedPlayerIds);
    return allCards.filter((item) => set.has(item.player.id));
  }, [allCards, ultimate.ownedPlayerIds]);

  const activeStarter =
    ownedCards.find((c) => c.player.id === ultimate.activeStarterId) || ownedCards[0] || allCards[0];

  const opponentTeam = teams.find((t) => t.id === opponentId) || teams[1];
  const leagueTeams = teams.filter((t) => t.leagueId === opponentLeague);

  const handleOpenPack = () => {
    const cost = 500;
    if (ultimate.coins < cost) {
      setNotice('Moedas insuficientes! Jogue e vença partidas para ganhar mais Arena Coins.');
      return;
    }
    const unowned = allCards.filter((c) => !ultimate.ownedPlayerIds.includes(c.player.id));
    const pool = unowned.length > 0 ? unowned : allCards;
    // Weighted toward strong players
    const weightedPool = pool.filter((c) => c.player.ovr >= 82);
    const pickFrom = weightedPool.length > 0 && Math.random() < 0.7 ? weightedPool : pool;
    const picked = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    const isNew = !ultimate.ownedPlayerIds.includes(picked.player.id);

    soundEngine.playTransferSuccess();
    setPackResult({ player: picked.player, team: picked.team, isNew });
    onUpdateUltimate({
      ...ultimate,
      coins: ultimate.coins - cost + (isNew ? 0 : 150),
      ownedPlayerIds: isNew
        ? [picked.player.id, ...ultimate.ownedPlayerIds]
        : ultimate.ownedPlayerIds,
      activeStarterId: isNew ? picked.player.id : ultimate.activeStarterId,
    });
    setNotice(
      isNew
        ? `Carta desbloqueada: ${picked.player.name} (${picked.player.ovr} OVR)!`
        : `${picked.player.shortName} repetido — +150 moedas de reembolso!`
    );
  };

  const handleBuyDirectCard = (player: Player, team: Team) => {
    const coinPrice = player.valueMillions * 14;
    if (ultimate.coins < coinPrice) {
      setNotice(`Você precisa de ${coinPrice} moedas para contratar ${player.shortName}.`);
      return;
    }
    if (ultimate.ownedPlayerIds.includes(player.id)) return;
    soundEngine.playTransferSuccess();
    onUpdateUltimate({
      ...ultimate,
      coins: ultimate.coins - coinPrice,
      ownedPlayerIds: [player.id, ...ultimate.ownedPlayerIds],
      activeStarterId: player.id,
    });
    setNotice(`${player.name} entrou para o seu Time de Cartas como Titular 1v1!`);
  };

  const handlePlayCardsMatch = () => {
    soundEngine.playWhistle(false);
    const starterPlayers = ownedCards
      .sort((a, b) => (a.player.id === activeStarter.player.id ? -1 : b.player.ovr - a.player.ovr))
      .map((c) => c.player);

    const customCardTeam: Team = {
      ...activeStarter.team,
      id: 'ultimate_user_club',
      name: ultimate.clubName,
      shortCode: 'ULT',
      ovr: Math.round(
        starterPlayers.slice(0, 3).reduce((acc, p) => acc + p.ovr, 0) /
          Math.max(1, Math.min(3, starterPlayers.length))
      ),
      players: starterPlayers,
    };

    onStartMatch({
      tournament: 'friendly',
      tournamentLabel: `Time de Cartas 2027 · ${ultimate.clubName}`,
      homeTeam: customCardTeam,
      awayTeam: opponentTeam,
      humanSide: 'home',
      settings: {
        ...settings,
        format: '1v1',
        withGoalkeeper: false,
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div>
            <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white leading-none">
              Time de Cartas · Ultimate 2027
            </h1>
            <p className="text-[11px] text-slate-400">
              Colecione craques com OVR, Chute, Passe e Drible e enfrente clubes licenciados no 1v1
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400/15 border border-amber-400/40">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono-tabular text-sm font-extrabold text-amber-300">
              {ultimate.coins} Moedas
            </span>
          </div>
          <button
            onClick={handlePlayCardsMatch}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" /> Jogar 1v1
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {notice && (
          <div className="px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs font-semibold text-emerald-200">
            {notice}
          </div>
        )}

        {/* Top Hub: Active 1v1 Card + Pack Opener + Opponent */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-[#111D16] border border-amber-400/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Seu Titular 1v1 em Campo
              </span>
              <span className="text-xs font-mono-tabular text-slate-400">{ultimate.wins} Vitórias</span>
            </div>
            <PlayerCard
              player={activeStarter.player}
              team={activeStarter.team}
              selected
              badgeLabel="TITULAR ATIVO"
            />
          </div>

          <div className="lg:col-span-4 bg-[#111D16] border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> Pacote Ouro 2027
              </div>
              <h2 className="font-display text-2xl font-extrabold text-white mt-1">
                Sortear Craque Licenciado
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Abra pacotes para desbloquear jogadores melhores (Mbappé, Yamal, Pedro, Haaland, Kane e mais).
              </p>

              {packResult && (
                <div className="mt-3 p-3 rounded-xl bg-amber-400/10 border border-amber-400/40 flex items-center gap-3">
                  <ClubCrest team={packResult.team} size={34} />
                  <div>
                    <div className="text-sm font-bold text-white">{packResult.player.name}</div>
                    <div className="text-xs text-amber-300 font-mono-tabular">
                      OVR {packResult.player.ovr} · CHU {packResult.player.shot} · VEL {packResult.player.pace}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleOpenPack}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trophy className="w-4 h-4" /> Abrir Pacote Ouro (500 Moedas)
            </button>
          </div>

          <div className="lg:col-span-4 bg-[#111D16] border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Desafio 1v1
                </span>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  1v1 (2 Jogadores)
                </span>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-black/35 border border-white/10">
                <ClubCrest team={opponentTeam} size={42} />
                <div>
                  <div className="text-sm font-bold text-white">{opponentTeam.name}</div>
                  <div className="text-xs font-mono-tabular text-emerald-400">
                    OVR {opponentTeam.ovr} · Recompensa: +250 Moedas
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-black/35 p-1 rounded-xl">
                {LEAGUES.map((lg) => (
                  <button
                    key={lg.id}
                    onClick={() => {
                      setOpponentLeague(lg.id);
                      const first = teams.find((t) => t.leagueId === lg.id);
                      if (first) setOpponentId(first.id);
                    }}
                    className={`py-1.5 rounded-lg text-[10px] font-bold truncate cursor-pointer ${
                      opponentLeague === lg.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
                    }`}
                  >
                    {lg.shortName}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                {leagueTeams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setOpponentId(t.id)}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left text-xs cursor-pointer ${
                      t.id === opponentTeam.id
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-black/25 border-white/10 text-slate-300'
                    }`}
                  >
                    <ClubCrest team={t} size={20} />
                    <span className="truncate font-semibold">{t.shortCode}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePlayCardsMatch}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Jogar com {activeStarter.player.shortName}
            </button>
          </div>
        </section>

        {/* Owned Cards Collection */}
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-bold text-white">
            Suas Cartas Desbloqueadas ({ownedCards.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ownedCards.map(({ player, team }) => {
              const isActive = player.id === activeStarter.player.id;
              return (
                <div key={player.id} className="space-y-2">
                  <PlayerCard
                    player={player}
                    team={team}
                    compact
                    selected={isActive}
                    badgeLabel={isActive ? 'TITULAR 1v1' : undefined}
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateUltimate({ ...ultimate, activeStarterId: player.id });
                    }}
                  />
                  {!isActive && (
                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateUltimate({ ...ultimate, activeStarterId: player.id });
                      }}
                      className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Escalar no 1v1
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Direct Card Shop */}
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-bold text-white">
            Mercado Direto de Cartas 2027
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allCards
              .filter((c) => !ultimate.ownedPlayerIds.includes(c.player.id))
              .slice(0, 12)
              .map(({ player, team }) => {
                const price = player.valueMillions * 14;
                const canAfford = ultimate.coins >= price;
                return (
                  <div key={player.id} className="space-y-2">
                    <PlayerCard player={player} team={team} compact />
                    <button
                      onClick={() => handleBuyDirectCard(player, team)}
                      disabled={!canAfford}
                      className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
                        canAfford
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/5 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Comprar ({price} Moedas)
                    </button>
                  </div>
                );
              })}
          </div>
        </section>
      </main>
    </div>
  );
};
