import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Crown,
  Play,
  Shield,
  Sliders,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import {
  ActiveMatchConfig,
  CareerTacticStyle,
  Player,
  TacticalFormation,
  Team,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { PixelPlayerSprite } from './PlayerDiscPreview';
import { soundEngine } from '../utils/audio';

interface PreMatchLineupModalProps {
  config: ActiveMatchConfig;
  onConfirmKickoff: (finalConfig: ActiveMatchConfig) => void;
  onBack: () => void;
}

const FORMATION_SLOTS: Record<
  TacticalFormation,
  {
    label: string;
    desc: string;
    coordsWithBall: { x: number; y: number; role: string }[];
    coordsWithoutBall: { x: number; y: number; role: string }[];
  }
> = {
  '1-2-1': {
    label: '1-2-1 Losango',
    desc: 'Equilíbrio total com 1 atacante central, 2 meias abertos e 1 zagueiro.',
    coordsWithBall: [
      { x: 50, y: 18, role: 'ATA' },
      { x: 24, y: 42, role: 'MEI' },
      { x: 76, y: 42, role: 'MEI' },
      { x: 50, y: 74, role: 'ZAG' },
    ],
    coordsWithoutBall: [
      { x: 50, y: 30, role: 'ATA' },
      { x: 28, y: 55, role: 'MEI' },
      { x: 72, y: 55, role: 'MEI' },
      { x: 50, y: 82, role: 'ZAG' },
    ],
  },
  '1-1-2': {
    label: '1-1-2 Ataque Total',
    desc: 'Dois atacantes pressionando a saída e 1 armador central.',
    coordsWithBall: [
      { x: 32, y: 18, role: 'ATA' },
      { x: 68, y: 18, role: 'ATA' },
      { x: 50, y: 46, role: 'MEI' },
      { x: 50, y: 76, role: 'ZAG' },
    ],
    coordsWithoutBall: [
      { x: 36, y: 32, role: 'ATA' },
      { x: 64, y: 32, role: 'ATA' },
      { x: 50, y: 58, role: 'MEI' },
      { x: 50, y: 82, role: 'ZAG' },
    ],
  },
  '2-1-1': {
    label: '2-1-1 Retranca & Saída',
    desc: 'Linha dupla de marcação para fechar espaços e sair no contra-ataque.',
    coordsWithBall: [
      { x: 50, y: 20, role: 'ATA' },
      { x: 50, y: 46, role: 'MEI' },
      { x: 30, y: 72, role: 'ZAG' },
      { x: 70, y: 72, role: 'ZAG' },
    ],
    coordsWithoutBall: [
      { x: 50, y: 36, role: 'ATA' },
      { x: 50, y: 60, role: 'MEI' },
      { x: 32, y: 82, role: 'ZAG' },
      { x: 68, y: 82, role: 'ZAG' },
    ],
  },
  '2-2': {
    label: '2-2 Clássica',
    desc: 'Dupla ofensiva fixa e dupla de cobertura para jogos de 2v2 intensos.',
    coordsWithBall: [
      { x: 32, y: 22, role: 'ATA' },
      { x: 68, y: 22, role: 'ATA' },
      { x: 32, y: 68, role: 'ZAG' },
      { x: 68, y: 68, role: 'ZAG' },
    ],
    coordsWithoutBall: [
      { x: 34, y: 36, role: 'ATA' },
      { x: 66, y: 36, role: 'ATA' },
      { x: 34, y: 78, role: 'ZAG' },
      { x: 66, y: 78, role: 'ZAG' },
    ],
  },
};

export const PreMatchLineupModal: React.FC<PreMatchLineupModalProps> = ({
  config,
  onConfirmKickoff,
  onBack,
}) => {
  const isLocal2P = config.settings.format === 'local_2p';
  const is2v2 = config.settings.format === '2v2';

  const initialHomeOrder = useMemo(() => {
    const startIdx = config.homeStarterIndex ?? 0;
    const list = [...config.homeTeam.players];
    if (startIdx > 0 && startIdx < list.length) {
      const [chosen] = list.splice(startIdx, 1);
      list.unshift(chosen);
    }
    return list;
  }, [config.homeTeam.players, config.homeStarterIndex]);

  const [homePlayers, setHomePlayers] = useState<Player[]>(initialHomeOrder);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>(config.awayTeam.players);
  const [editingSide, setEditingSide] = useState<'home' | 'away'>(
    config.humanSide === 'away' && !isLocal2P ? 'away' : 'home'
  );
  const [activeTab, setActiveTab] = useState<'squad' | 'tactics' | 'assignments'>('squad');
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(0);
  const [withBallView, setWithBallView] = useState<boolean>(false);
  const [formation, setFormation] = useState<TacticalFormation>(config.tacticalFormation || '1-2-1');
  const [tacticStyle, setTacticStyle] = useState<CareerTacticStyle>(
    config.tacticStyle || 'equilibrado'
  );
  const [captainId, setCaptainId] = useState<string>(initialHomeOrder[0]?.id || '');
  const [penaltyTakerId, setPenaltyTakerId] = useState<string>(initialHomeOrder[0]?.id || '');

  const currentTeam: Team = editingSide === 'home' ? config.homeTeam : config.awayTeam;
  const activeRoster = editingSide === 'home' ? homePlayers : awayPlayers;
  const setActiveRoster = editingSide === 'home' ? setHomePlayers : setAwayPlayers;

  const pitchCount = Math.min(4, activeRoster.length);
  const starters = activeRoster.slice(0, pitchCount);
  const substitutes = activeRoster.slice(pitchCount);

  const formSpec = FORMATION_SLOTS[formation];
  const pitchCoords = withBallView ? formSpec.coordsWithBall : formSpec.coordsWithoutBall;
  const tacticBonus = tacticStyle === 'ofensivo' ? 4 : tacticStyle === 'equilibrado' ? 3 : 2;

  const handlePlayerClick = (clickedIdx: number) => {
    soundEngine.playClick();
    if (selectedSlotIdx === null) {
      setSelectedSlotIdx(clickedIdx);
      return;
    }
    if (selectedSlotIdx === clickedIdx) {
      setSelectedSlotIdx(null);
      return;
    }
    const next = [...activeRoster];
    const temp = next[selectedSlotIdx];
    next[selectedSlotIdx] = next[clickedIdx];
    next[clickedIdx] = temp;
    setActiveRoster(next);
    setSelectedSlotIdx(clickedIdx);
  };

  const handleAutoBest = () => {
    soundEngine.playTransferSuccess();
    const sorted = [...activeRoster].sort((a, b) => b.ovr - a.ovr);
    setActiveRoster(sorted);
    if (sorted[0]) {
      setCaptainId(sorted[0].id);
      setPenaltyTakerId(sorted[0].id);
    }
    setSelectedSlotIdx(0);
  };

  const handleLaunch = () => {
    soundEngine.playWhistle(false);
    onConfirmKickoff({
      ...config,
      homeTeam: { ...config.homeTeam, players: homePlayers },
      awayTeam: { ...config.awayTeam, players: awayPlayers },
      homeStarterIndex: 0,
      tacticStyle,
      tacticalFormation: formation,
      captainPlayerId: captainId,
      penaltyTakerId,
    });
  };

  const tabList: { id: 'squad' | 'tactics' | 'assignments'; label: string }[] = [
    { id: 'squad', label: 'Elenco' },
    { id: 'tactics', label: 'Táticas' },
    { id: 'assignments', label: 'Funções' },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#06209E] via-[#0B2EBF] to-[#04104A] text-white flex flex-col justify-between overflow-x-hidden safe-area-hud">
      {/* TOP EA FC TEAM MANAGEMENT HEADER */}
      <header className="px-4 sm:px-7 py-3.5 border-b border-white/15 bg-[#041257]/75 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-semibold text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full border-2 border-white/75 bg-[#06186F] flex items-center justify-center p-1 shrink-0">
              <ClubCrest team={currentTeam} size={26} />
            </div>
            <div>
              <h1 className="font-sans text-lg sm:text-2xl font-extrabold tracking-tight leading-none">
                Gestão de Elenco
              </h1>
              <div className="text-[11px] text-sky-200 font-medium mt-0.5">
                {currentTeam.name} · {is2v2 ? 'Modo 2v2 (4 em Campo)' : isLocal2P ? 'Duelo Local 2P' : 'Modo 1v1'}
              </div>
            </div>
          </div>
        </div>

        {/* L1 / R1 Tabs matching image_b50900de */}
        <div className="flex items-center gap-2 sm:gap-5">
          <span className="hidden md:inline-flex items-center justify-center px-2 py-0.5 rounded bg-white text-[#061C7A] text-[10px] font-black">
            L1
          </span>
          <nav className="flex items-center gap-4 sm:gap-6">
            {tabList.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setActiveTab(t.id);
                  }}
                  className={`py-1 text-sm sm:text-base transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'font-extrabold text-white border-b-2 border-white'
                      : 'font-medium text-sky-200/75 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
          <span className="hidden md:inline-flex items-center justify-center px-2 py-0.5 rounded bg-white text-[#061C7A] text-[10px] font-black">
            R1
          </span>
        </div>

        <button
          type="button"
          onClick={handleLaunch}
          className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg cursor-pointer whitespace-nowrap"
        >
          <Play className="w-4 h-4 fill-current" /> Entrar em Campo
        </button>
      </header>

      {/* Optional 2P Side Switcher */}
      {isLocal2P && (
        <div className="max-w-5xl w-full mx-auto px-4 pt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingSide('home');
              setSelectedSlotIdx(0);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              editingSide === 'home'
                ? 'bg-white text-[#061C7A]'
                : 'bg-black/30 text-sky-200 border border-white/15'
            }`}
          >
            Escalar J1 · {config.homeTeam.shortCode}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingSide('away');
              setSelectedSlotIdx(0);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              editingSide === 'away'
                ? 'bg-white text-[#061C7A]'
                : 'bg-black/30 text-sky-200 border border-white/15'
            }`}
          >
            Escalar J2 · {config.awayTeam.shortCode}
          </button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 flex flex-col justify-center gap-4">
        {activeTab === 'squad' && (
          <>
            {/* Perspective Tactical Pitch (SVG Lines + Interactive Player Nodes) */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-white/20 bg-gradient-to-b from-[#0826AC] to-[#051873] shadow-2xl px-2 sm:px-6 pt-4 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-200">
                  Clique em 2 jogadores para trocar de posição · Slot #1 é seu titular em campo
                </span>
                <span className="text-xs font-bold text-amber-300">
                  Formação {formSpec.label}
                </span>
              </div>

              <div className="relative w-full h-[300px] sm:h-[360px]">
                {/* Crisp white SVG perspective pitch markings */}
                <svg
                  viewBox="0 0 800 380"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full pointer-events-none opacity-65"
                >
                  {/* Trapezoid outer pitch boundary */}
                  <polygon
                    points="95,12 705,12 785,368 15,368"
                    fill="none"
                    stroke="rgba(255,255,255,0.65)"
                    strokeWidth="2.5"
                  />
                  {/* Halfway line */}
                  <line x1="55" y1="190" x2="745" y2="190" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
                  {/* Center circle */}
                  <ellipse cx="400" cy="190" rx="74" ry="38" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
                  {/* Opponent Penalty Box (Top) */}
                  <polygon
                    points="265,12 535,12 555,76 245,76"
                    fill="none"
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth="2"
                  />
                  {/* Own Penalty Box (Bottom) */}
                  <polygon
                    points="230,295 570,295 600,368 200,368"
                    fill="none"
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth="2"
                  />
                </svg>

                {/* Pitch Player Tokens */}
                {starters.map((pl, idx) => {
                  const pos = pitchCoords[idx] || { x: 50, y: 50, role: pl.position };
                  const isSelected = selectedSlotIdx === idx;
                  const isCaptain = captainId === pl.id || (!captainId && idx === 0);
                  const isHeroSlot = idx === 0;
                  const isPartnerSlot = is2v2 && idx === 1;

                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => handlePlayerClick(idx)}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer focus:outline-none z-10"
                    >
                      <div className="flex items-center gap-1.5">
                        {/* Morale & Sharpness micro markers + Captain badge */}
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 text-[#051873] text-[9px] font-black flex items-center justify-center">
                            ☺
                          </span>
                          {isCaptain && (
                            <span className="px-1 rounded bg-white text-[#061C7A] text-[9px] font-black leading-tight">
                              C
                            </span>
                          )}
                        </div>

                        {/* Pixel-Art Player Token */}
                        <div
                          className={`relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-transform ${
                            isSelected
                              ? 'scale-115 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                              : 'group-hover:scale-105'
                          }`}
                        >
                          <PixelPlayerSprite
                            kit={currentTeam.kit}
                            label={String(pl.number)}
                            playerName={pl.shortName}
                            team={currentTeam}
                            isHuman={isHeroSlot}
                            size={54}
                          />
                          <span className="absolute -bottom-0.5 right-0 px-1 rounded bg-[#041257]/90 border border-white/30 text-[8px] font-black text-white uppercase">
                            {pos.role}
                          </span>
                        </div>

                        {/* Boost & OVR Numerals */}
                        <div className="text-left leading-none">
                          <div className="text-[11px] font-bold text-emerald-300 tabular-nums">
                            +{tacticBonus}
                          </div>
                          <div className="font-sans text-lg sm:text-xl font-black text-white tabular-nums">
                            {pl.ovr + tacticBonus}
                          </div>
                        </div>
                      </div>

                      {/* Name Capsule (White highlight if selected just like Raphinha) */}
                      <div
                        className={`mt-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors ${
                          isSelected
                            ? 'bg-white text-[#061C7A] shadow-md'
                            : 'bg-[#041257]/80 text-white'
                        }`}
                      >
                        {isHeroSlot ? `★ ${pl.shortName}` : isPartnerSlot ? `2P · ${pl.shortName}` : pl.shortName}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* With Ball / Without Ball View Switcher */}
              <div className="flex flex-col items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setWithBallView((v) => !v);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-sky-300" />
                  <span>{withBallView ? 'Com a Bola (Ofensivo)' : 'Sem a Bola (Compacto)'}</span>
                </button>
              </div>
            </div>

            {/* SUBSTITUTES / RESERVAS STRIP */}
            <section className="bg-[#04104A]/85 border border-white/15 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-white tracking-wide">
                  Substitutos & Reservas ({substitutes.length})
                </h2>
                <span className="text-[11px] text-sky-200">
                  {selectedSlotIdx !== null
                    ? `Selecionado: ${activeRoster[selectedSlotIdx]?.shortName} · Clique em outro para trocar`
                    : 'Clique em um jogador para selecionar'}
                </span>
              </div>

              {substitutes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {substitutes.map((sub, sIdx) => {
                    const realIdx = pitchCount + sIdx;
                    const isSelected = selectedSlotIdx === realIdx;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handlePlayerClick(realIdx)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-white text-[#061C7A] border-white shadow-lg'
                            : 'bg-[#081C7A]/70 hover:bg-[#0D2599] border-white/15 text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-8 h-8 rounded-full border border-white/50 flex items-center justify-center font-display text-sm font-black shrink-0"
                              style={{
                                backgroundColor: currentTeam.kit.primaryColor,
                                color: currentTeam.kit.textColor,
                              }}
                            >
                              {sub.number}
                            </span>
                            <div className="text-[10px] font-bold uppercase opacity-80">
                              {sub.position}
                            </div>
                          </div>
                          <div className="text-right leading-none">
                            <div
                              className={`text-[10px] font-bold ${
                                isSelected ? 'text-emerald-700' : 'text-emerald-300'
                              }`}
                            >
                              +{tacticBonus}
                            </div>
                            <div className="font-sans text-lg font-black tabular-nums">
                              {sub.ovr + tacticBonus}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`pt-1 border-t text-xs font-bold truncate ${
                            isSelected ? 'border-[#061C7A]/20' : 'border-white/25'
                          }`}
                        >
                          {sub.shortName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-sky-200/80 py-2">
                  Todo o elenco disponível já está em campo. Clique em 2 titulares no campo para trocar quem você controla!
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'tactics' && (
          <section className="bg-[#04104A]/85 border border-white/20 rounded-2xl p-5 sm:p-6 space-y-6">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-300" /> Formação Tática em Campo
              </h2>
              <p className="text-xs text-sky-200 mt-1">
                Escolha o desenho tático da equipe para posicionar atacantes, meias e defensores.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {(Object.keys(FORMATION_SLOTS) as TacticalFormation[]).map((fKey) => {
                  const item = FORMATION_SLOTS[fKey];
                  const active = formation === fKey;
                  return (
                    <button
                      key={fKey}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setFormation(fKey);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-[#061C7A] border-white shadow-xl'
                          : 'bg-[#081C7A]/70 hover:bg-[#0D2599] border-white/15 text-white'
                      }`}
                    >
                      <div className="font-display text-2xl font-extrabold leading-none">
                        {item.label}
                      </div>
                      <p className={`text-xs mt-1.5 ${active ? 'text-slate-700' : 'text-sky-100/80'}`}>
                        {item.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/15">
              <h2 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-300" /> Postura & Instruções da Equipe
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {(
                  [
                    {
                      id: 'equilibrado' as CareerTacticStyle,
                      label: 'Equilibrado · Posse',
                      desc: 'Ritmo balanceado entre ataque e cobertura defensiva (+3 OVR).',
                      icon: Sparkles,
                    },
                    {
                      id: 'ofensivo' as CareerTacticStyle,
                      label: 'Pressão Alta · Ofensivo',
                      desc: '+5% potência de chute e pressão intensa na saída (+4 OVR).',
                      icon: Zap,
                    },
                    {
                      id: 'retranqueiro' as CareerTacticStyle,
                      label: 'Retranca & Contra-Ataque',
                      desc: '+8% força física nas divididas e proteção da área (+2 OVR).',
                      icon: Shield,
                    },
                  ]
                ).map((st) => {
                  const Icon = st.icon;
                  const active = tacticStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setTacticStyle(st.id);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-xl'
                          : 'bg-[#081C7A]/70 hover:bg-[#0D2599] border-white/15 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-display text-xl font-extrabold">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{st.label}</span>
                      </div>
                      <p className={`text-xs mt-1.5 ${active ? 'text-slate-900' : 'text-sky-100/80'}`}>
                        {st.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'assignments' && (
          <section className="bg-[#04104A]/85 border border-white/20 rounded-2xl p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-300" /> Funções em Campo
              </h2>
              <p className="text-xs text-sky-200 mt-1">
                Defina o Capitão da equipe e o Batedor Oficial de pênaltis.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-[#081C7A]/70 border border-white/15 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  Capitão do Time (Braçadeira C)
                </div>
                {starters.map((pl) => (
                  <button
                    key={`cap-${pl.id}`}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setCaptainId(pl.id);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg border flex items-center justify-between text-xs font-bold cursor-pointer ${
                      captainId === pl.id
                        ? 'bg-white text-[#061C7A] border-white'
                        : 'bg-black/25 text-white border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span>
                      #{pl.number} {pl.name} ({pl.position})
                    </span>
                    <span className="font-mono-tabular">OVR {pl.ovr}</span>
                  </button>
                ))}
              </div>

              <div className="bg-[#081C7A]/70 border border-white/15 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  Batedor Oficial de Pênaltis
                </div>
                {starters.map((pl) => (
                  <button
                    key={`pen-${pl.id}`}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setPenaltyTakerId(pl.id);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg border flex items-center justify-between text-xs font-bold cursor-pointer ${
                      penaltyTakerId === pl.id
                        ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                        : 'bg-black/25 text-white border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span>
                      #{pl.number} {pl.name}
                    </span>
                    <span className="font-mono-tabular">CHU {pl.shot}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* BOTTOM FIFA CONSOLE ACTION BAR */}
      <footer className="px-4 sm:px-7 py-3 border-t border-white/15 bg-[#041257]/85 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white font-semibold cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
              O
            </span>
            <span>Voltar</span>
          </button>

          <button
            type="button"
            onClick={handleAutoBest}
            className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white font-semibold cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
              △
            </span>
            <span>Sugestão Automática (Melhor OVR)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setActiveTab(activeTab === 'tactics' ? 'squad' : 'tactics');
            }}
            className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white font-semibold cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-fuchsia-500 text-white text-[10px] font-black flex items-center justify-center">
              □
            </span>
            <span>{activeTab === 'tactics' ? 'Ver Elenco' : 'Editar Tática Ativa'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleLaunch}
          className="px-5 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" /> Iniciar Partida
        </button>
      </footer>
    </div>
  );
};
