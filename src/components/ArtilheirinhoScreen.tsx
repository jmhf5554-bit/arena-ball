import React, { useState } from 'react';
import { ArrowLeft, Play, RotateCw, Shield, Target, Users } from 'lucide-react';
import {
  ActiveMatchConfig,
  ArtilheirinhoConfig,
  MatchSettings,
  Team,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

interface ArtilheirinhoScreenProps {
  teams: Team[];
  settings: MatchSettings;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

export const ArtilheirinhoScreen: React.FC<ArtilheirinhoScreenProps> = ({
  teams,
  settings,
  onStartMatch,
  onBack,
}) => {
  const [homeTeamId, setHomeTeamId] = useState(teams[0]?.id || 'fla');
  const [awayTeamId, setAwayTeamId] = useState(teams[1]?.id || 'pal');
  const [mode, setMode] = useState<ArtilheirinhoConfig['mode']>('1p_cpu');
  const [targetPoints, setTargetPoints] = useState<ArtilheirinhoConfig['targetPoints']>(3);
  const [rotateOnScore, setRotateOnScore] = useState<boolean>(true);
  const [extraTouchOnReboundOrIntercept, setExtraTouchOnReboundOrIntercept] =
    useState<boolean>(true);
  const [counterAttackOnIntercept, setCounterAttackOnIntercept] = useState<boolean>(true);
  const [penaltyOnPostHits, setPenaltyOnPostHits] =
    useState<ArtilheirinhoConfig['penaltyOnPostHits']>(2);
  const [allowGoalkeeperGoal, setAllowGoalkeeperGoal] = useState<boolean>(false);

  const homeTeam = teams.find((t) => t.id === homeTeamId) || teams[0];
  const awayTeam = teams.find((t) => t.id === awayTeamId) || teams[1] || teams[0];

  const handlePlay = () => {
    soundEngine.playWhistle(false);
    const artConfig: ArtilheirinhoConfig = {
      mode,
      targetPoints,
      rotateOnScore,
      extraTouchOnReboundOrIntercept,
      counterAttackOnIntercept,
      penaltyOnPostHits,
      allowGoalkeeperGoal,
    };
    onStartMatch({
      tournament: 'artilheirinho',
      tournamentLabel: `Artilheirinho · Até ${targetPoints} ${targetPoints === 12 ? 'Pontos' : 'Gols'}`,
      homeTeam,
      awayTeam,
      humanSide: 'home',
      player1Name: 'Dupla 1',
      player2Name: mode === 'local_2p' ? 'Dupla 2' : `CPU (${awayTeam.shortCode})`,
      artilheirinhoConfig: artConfig,
      settings: {
        ...settings,
        format: 'artilheirinho',
        withGoalkeeper: true,
        durationSeconds: 300,
        goalLimit: targetPoints,
      },
    });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
      <header className="border-b border-white/10 bg-[#0D1812] px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onBack();
              }}
              className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <div className="h-5 w-px bg-white/15" />
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
                Modo Artilheirinho · Duplas de 1 Toque
              </h1>
            </div>
          </div>

          <div className="text-xs font-semibold text-emerald-300">
            1 Goleiro na área · 1 Atacante no ataque
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Match & Rules Configuration */}
        <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-5">
          {/* Jogadores */}
          <div>
            <h2 className="text-sm font-bold text-white mb-2.5 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> Modo de Disputa
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setMode('1p_cpu');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                  mode === '1p_cpu'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-black/30 text-slate-300 border-white/10 hover:text-white'
                }`}
              >
                1 Jogador vs CPU
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setMode('local_2p');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                  mode === 'local_2p'
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-black/30 text-slate-300 border-white/10 hover:text-white'
                }`}
              >
                2 Jogadores Local (WASD x Setas)
              </button>
            </div>
          </div>

          {/* Seleção das Duplas / Clubes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">Dupla 1 (Esquerda)</span>
                <ClubCrest team={homeTeam} size={30} />
              </div>
              <select
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B140F] border border-white/15 text-xs text-white"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">
                  {mode === 'local_2p' ? 'Dupla 2 (Direita)' : 'Dupla CPU (Direita)'}
                </span>
                <ClubCrest team={awayTeam} size={30} />
              </div>
              <select
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B140F] border border-white/15 text-xs text-white"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Placar e Trocas */}
          <div>
            <h2 className="text-sm font-bold text-white mb-2">Placar para Vencer / Trocar Dupla</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {([3, 6, 12] as const).map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTargetPoints(pts);
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold font-mono-tabular cursor-pointer ${
                    targetPoints === pts
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-black/30 text-slate-300 border-white/10'
                  }`}
                >
                  {pts === 12 ? '12 Pontos' : `${pts} Gols`}
                </button>
              ))}
            </div>
          </div>

          {/* Variações das Regras */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-amber-400" /> Variações de Regra
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setRotateOnScore((v) => !v);
                }}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  rotateOnScore
                    ? 'bg-emerald-500/15 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Rotação Goleiro ↔ Atacante</span>
                  <span className="text-emerald-300">{rotateOnScore ? 'SIM' : 'NÃO'}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Troca quem vai pro gol e quem vai pro ataque a cada gol
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setExtraTouchOnReboundOrIntercept((v) => !v);
                }}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  extraTouchOnReboundOrIntercept
                    ? 'bg-emerald-500/15 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Toque Extra (Trave / Intercept.)</span>
                  <span className="text-emerald-300">
                    {extraTouchOnReboundOrIntercept ? 'SIM' : 'NÃO'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Ganha +1 toque no rebote da trave ou ao interceptar o passe
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setCounterAttackOnIntercept((v) => !v);
                }}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  counterAttackOnIntercept
                    ? 'bg-emerald-500/15 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Contra-ataque Direto</span>
                  <span className="text-emerald-300">
                    {counterAttackOnIntercept ? 'SIM' : 'NÃO'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Ao interceptar o lançamento, o atacante finaliza direto no contra-ataque
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setAllowGoalkeeperGoal((v) => !v);
                }}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  allowGoalkeeperGoal
                    ? 'bg-emerald-500/15 border-emerald-400 text-white'
                    : 'bg-black/30 border-white/10 text-slate-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Gol Direto de Goleiro</span>
                  <span className="text-emerald-300">
                    {allowGoalkeeperGoal ? 'VALE' : 'SÓ COM ATACANTE'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Define se o chute direto da área do goleiro pode entrar sem desvio
                </div>
              </button>
            </div>

            <div className="pt-1">
              <div className="text-xs font-bold text-slate-300 mb-1.5">
                Pênalti por Bolas na Trave
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([0, 2, 3] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setPenaltyOnPostHits(cnt);
                    }}
                    className={`py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                      penaltyOnPostHits === cnt
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-black/30 text-slate-300 border-white/10'
                    }`}
                  >
                    {cnt === 0 ? 'Desligado' : `${cnt} Traves = Pênalti`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePlay}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-2xl font-extrabold tracking-wide flex items-center justify-center gap-2.5 shadow-xl cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" /> JOGAR ARTILHEIRINHO
          </button>
        </div>

        {/* Right: Clear Visual Rules Breakdown */}
        <div className="lg:col-span-5 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="font-display text-2xl font-extrabold text-white">
              Como Funciona o Artilheirinho
            </h2>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="p-3.5 rounded-xl bg-black/30 border border-white/10">
              <div className="font-bold text-emerald-300 mb-1">1. Formação e Zonas Travadas</div>
              Cada dupla tem um <strong>Goleiro</strong> (fica preso dentro da própria área) e um{' '}
              <strong>Atacante</strong> (atua apenas no campo de ataque, sem voltar além do
              meio-campo e sem invadir a área adversária).
            </div>

            <div className="p-3.5 rounded-xl bg-black/30 border border-white/10">
              <div className="font-bold text-emerald-300 mb-1">2. Lançamento e Troca Automática</div>
              O goleiro lança a bola para o companheiro tentando evitar a interceptação do atacante
              rival. Quando a bola cruza o meio-campo, o controle passa automaticamente para o seu
              atacante!
            </div>

            <div className="p-3.5 rounded-xl bg-black/30 border border-white/10">
              <div className="font-bold text-amber-300 mb-1">3. Finalização de 1 Toque</div>
              Em regra padrão, o atacante tem apenas <strong>1 toque</strong> para tentar marcar o
              gol. Se der 2 toques sem regra de toque extra, o juiz apita e devolve a bola para o
              goleiro adversário.
            </div>

            <div className="p-3.5 rounded-xl bg-black/30 border border-white/10">
              <div className="font-bold text-amber-300 mb-1">4. Interceptação, Trave e Pênalti</div>
              Bater na trave ou interceptar um lançamento libera o toque extra ou o contra-ataque
              direto. Completando {penaltyOnPostHits === 0 ? 'traves (se ativado)' : `${penaltyOnPostHits} bolas na trave`}, sai um <strong>pênalti imediato</strong>!
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
