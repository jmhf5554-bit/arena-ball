import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles, Mic } from 'lucide-react';
import { ActiveMatchConfig } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { PlayerCard } from './PlayerCard';
import { soundEngine } from '../utils/audio';

interface PreMatchLineupModalProps {
  config: ActiveMatchConfig;
  onConfirmKickoff: (finalConfig: ActiveMatchConfig) => void;
  onBack: () => void;
}

export const PreMatchLineupModal: React.FC<PreMatchLineupModalProps> = ({
  config,
  onConfirmKickoff,
  onBack,
}) => {
  const isLocal2P = config.settings.format === 'local_2p';
  const humanTeam = config.humanSide === 'home' ? config.homeTeam : config.awayTeam;
  const aiTeam = config.humanSide === 'home' ? config.awayTeam : config.homeTeam;

  const [selectedStarterIdx, setSelectedStarterIdx] = useState<number>(config.homeStarterIndex ?? 0);
  const [selectedAwayStarterIdx, setSelectedAwayStarterIdx] = useState<number>(0);
  const [hypeLine, setHypeLine] = useState<string | null>(null);
  const [hypeLoading, setHypeLoading] = useState(false);
  const [hypeError, setHypeError] = useState<string | null>(null);

  const selectedPlayer = humanTeam.players[selectedStarterIdx] || humanTeam.players[0];
  const aiStarter = aiTeam.players[isLocal2P ? selectedAwayStarterIdx : 0] || aiTeam.players[0];

  const handleFetchHype = async () => {
    setHypeLoading(true);
    setHypeError(null);
    try {
      const homeStarter = config.humanSide === 'home' ? selectedPlayer : aiStarter;
      const awayStarter = config.humanSide === 'away' ? selectedPlayer : aiStarter;
      const res = await fetch('/api/ai/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: config.homeTeam.name,
          awayTeam: config.awayTeam.name,
          homePlayer: homeStarter?.shortName,
          awayPlayer: awayStarter?.shortName,
          tournamentLabel: config.tournamentLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar chamada IA');
      }
      setHypeLine(data.line);
      if (data.line) {
        soundEngine.speakNarration(data.line, { priority: true, emotion: 'dramatic' });
      }
    } catch (err) {
      setHypeError(err instanceof Error ? err.message : 'Erro ao conectar com a narração IA.');
    } finally {
      setHypeLoading(false);
    }
  };

  const handleLaunch = () => {
    soundEngine.playWhistle(false);
    const reorderedPlayers = [
      humanTeam.players[selectedStarterIdx],
      ...humanTeam.players.filter((_, i) => i !== selectedStarterIdx),
    ].filter(Boolean);

    const updatedHumanTeam = {
      ...humanTeam,
      players: reorderedPlayers,
    };

    const reorderedAwayPlayers = isLocal2P
      ? [
          aiTeam.players[selectedAwayStarterIdx],
          ...aiTeam.players.filter((_, i) => i !== selectedAwayStarterIdx),
        ].filter(Boolean)
      : aiTeam.players;

    const updatedAiTeam = {
      ...aiTeam,
      players: reorderedAwayPlayers,
    };

    onConfirmKickoff({
      ...config,
      homeTeam: config.humanSide === 'home' ? updatedHumanTeam : updatedAiTeam,
      awayTeam: config.humanSide === 'away' ? updatedHumanTeam : updatedAiTeam,
      homeStarterIndex: 0,
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
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              {isLocal2P ? 'Pré-Jogo · 2 Jogadores Local' : 'Pré-Jogo · Escalação 1v1'}
            </div>
            <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white leading-none">
              {config.tournamentLabel}
            </h1>
          </div>
        </div>

        <button
          onClick={handleLaunch}
          className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" /> Entrar em Campo
        </button>
      </header>

      <main className="flex-1 max-w-6xl 2xl:max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Escudos & Overall Banner */}
        <section className="bg-[#111D16] border border-white/15 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-6">
          <div className="flex items-center justify-center md:justify-end gap-4 text-right">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                {isLocal2P
                  ? `${(config.player1Name || 'JOGADOR 1').toUpperCase()} (CASA · WASD)`
                  : config.humanSide === 'home'
                    ? 'SEU TIME (CASA)'
                    : 'ADVERSÁRIO (CASA)'}
              </div>
              <div className="font-display text-3xl font-extrabold text-white">{config.homeTeam.name}</div>
              <div className="text-xs font-mono-tabular text-amber-300 font-bold">
                OVR GERAL {config.homeTeam.ovr} · 1v1:{' '}
                {(config.humanSide === 'home' ? selectedPlayer : aiStarter)?.shortName} (
                {(config.humanSide === 'home' ? selectedPlayer : aiStarter)?.ovr})
              </div>
            </div>
            <ClubCrest team={config.homeTeam} size={74} />
          </div>

          <div className="flex flex-col items-center justify-center">
            <span className="font-display text-5xl font-extrabold text-slate-500">VS</span>
            <span className="text-[11px] font-mono-tabular text-slate-400 mt-1">
              {config.settings.format === 'penalty_shootout'
                ? 'PÊNALTIS'
                : isLocal2P
                  ? '2P LOCAL · MESMO PC / TELA'
                  : '1v1 · 1 JOGADOR VS 1 JOGADOR'}
            </span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-4 text-left">
            <ClubCrest team={config.awayTeam} size={74} />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                {isLocal2P
                  ? `${(config.player2Name || 'JOGADOR 2').toUpperCase()} (FORA · SETAS)`
                  : config.humanSide === 'away'
                    ? 'SEU TIME (FORA)'
                    : 'ADVERSÁRIO (FORA)'}
              </div>
              <div className="font-display text-3xl font-extrabold text-white">{config.awayTeam.name}</div>
              <div className="text-xs font-mono-tabular text-amber-300 font-bold">
                OVR GERAL {config.awayTeam.ovr} · 1v1:{' '}
                {(config.humanSide === 'away' ? selectedPlayer : aiStarter)?.shortName} (
                {(config.humanSide === 'away' ? selectedPlayer : aiStarter)?.ovr})
              </div>
            </div>
          </div>
        </section>

        {/* AI Hype Narration Box */}
        <section className="bg-[#111D16] border border-emerald-500/25 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-[240px]">
            <Mic className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Narração Brasileira Pré-Jogo (IA)
              </div>
              {hypeLine ? (
                <p className="text-sm font-medium text-white mt-0.5">"{hypeLine}"</p>
              ) : hypeError ? (
                <p className="text-xs text-rose-300 mt-0.5">{hypeError}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">
                  Gere a abertura oficial do narrador brasileiro antes da bola rolar!
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleFetchHype}
            disabled={hypeLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-bold text-emerald-200 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {hypeLoading ? 'Gerando Chamada...' : 'Chamada do Narrador IA'}
          </button>
        </section>

        {/* Escalação 1v1 / 2P Local */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`${isLocal2P ? 'lg:col-span-6' : 'lg:col-span-8'} bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4`}>
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                {isLocal2P
                  ? `Escalação J1 (${config.player1Name || 'Jogador 1'}) · ${humanTeam.name}`
                  : `Sua Escalação 1v1 · ${humanTeam.name}`}
              </h2>
              <p className="text-xs text-slate-400">
                Clique em uma carta para escalar o titular (VEL e CHU afetam a física!).
              </p>
            </div>

            <div className={`grid grid-cols-1 ${isLocal2P ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
              {humanTeam.players.slice(0, 5).map((player, idx) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  team={humanTeam}
                  compact
                  selected={selectedStarterIdx === idx}
                  badgeLabel={selectedStarterIdx === idx ? 'ESCALADO J1' : 'CLIQUE P/ ESCALAR'}
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedStarterIdx(idx);
                  }}
                />
              ))}
            </div>
          </div>

          {isLocal2P ? (
            <div className="lg:col-span-6 bg-[#111D16] border border-amber-400/25 rounded-2xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Escalação J2 ({config.player2Name || 'Jogador 2'}) · {aiTeam.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Escolha a carta titular do Jogador 2 no duelo local.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aiTeam.players.slice(0, 5).map((player, idx) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      team={aiTeam}
                      compact
                      selected={selectedAwayStarterIdx === idx}
                      badgeLabel={selectedAwayStarterIdx === idx ? 'ESCALADO J2' : 'CLIQUE P/ ESCALAR'}
                      onClick={() => {
                        soundEngine.playClick();
                        setSelectedAwayStarterIdx(idx);
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleLaunch}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Começar Duelo 2 Jogadores Local
              </button>
            </div>
          ) : (
            <div className="lg:col-span-4 bg-[#111D16] border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white mb-1">
                  Titular Adversário
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Carta principal que você vai enfrentar no duelo 1v1.
                </p>
                {aiStarter && (
                  <PlayerCard
                    player={aiStarter}
                    team={aiTeam}
                    badgeLabel={`CRAQUE DE ${aiTeam.shortCode}`}
                  />
                )}
              </div>

              <button
                onClick={handleLaunch}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Começar Partida 1v1
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
