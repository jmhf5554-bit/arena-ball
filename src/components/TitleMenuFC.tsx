import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Smartphone,
  Volume2,
  VolumeX,
  Gamepad2,
  Music,
  Mic,
  Crown,
  Globe,
  Coins,
  Users,
  ArrowRight,
  Car,
} from 'lucide-react';
import {
  AppScreen,
  CareerState,
  JogadorProfile,
  MatchSettings,
  PlayerCareerState,
  Team,
  UltimateClubState,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { PWAInstallButton } from './PWAInstallButton';
import { soundEngine } from '../utils/audio';
import { getConnectedGamepad } from '../utils/gamepad';
import stadiumMenuBackdrop from '../assets/images/fc_night_stadium_menu_1795313600746.jpg';

interface TitleMenuFCProps {
  profile: JogadorProfile;
  favTeam: Team;
  career: CareerState | null;
  careerTeam: Team | null;
  playerCareer: PlayerCareerState | null;
  ultimate: UltimateClubState;
  settings: MatchSettings;
  connectedGamepadName: string | null;
  hasAnySuperAdmin: boolean;
  onUpdateSettings: (patch: Partial<MatchSettings>) => void;
  onNavigate: (screen: AppScreen, quickFormat?: '1v1' | '2v2' | 'local_2p') => void;
  onOpenProfile: () => void;
  onOpenAdmin: () => void;
  onOpenFriends: () => void;
  pendingFriendsCount?: number;
  onSyncGamepad: (name: string | null) => void;
}

interface MenuEntry {
  id: string;
  label: string;
  monogram: string;
  accentText: string;
  headline: string;
  meta: string;
  ctaLabel: string;
  highlightBadge?: string;
  onSelect: () => void;
}

export const TitleMenuFC: React.FC<TitleMenuFCProps> = ({
  profile,
  favTeam,
  career,
  careerTeam,
  playerCareer,
  ultimate,
  settings,
  connectedGamepadName,
  hasAnySuperAdmin,
  onUpdateSettings,
  onNavigate,
  onOpenProfile,
  onOpenAdmin,
  onOpenFriends,
  pendingFriendsCount = 0,
  onSyncGamepad,
}) => {
  const [activeId, setActiveId] = useState<string>('quick_match');
  const [imgFailed, setImgFailed] = useState(false);

  const playerCareerStageLabel = playerCareer
    ? `FIFA 2v2 · OVR ${playerCareer.player.ovr} · T${playerCareer.season}`
    : 'Carreira FIFA · 2v2';

  const entries: MenuEntry[] = [
    {
      id: 'quick_match',
      label: 'Jogo Rápido',
      monogram: 'KO',
      accentText: '1v1 · 2v2 · Estádio Oficial',
      headline: 'A rota mais curta entre você e os gramados.',
      meta: 'Partidas rápidas · 1v1 e 2v2 · Co-op local · Pênaltis',
      ctaLabel: 'Entrar em Jogo Rápido',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('QUICK_MATCH', '1v1');
      },
    },
    {
      id: 'artilheirinho',
      label: 'Artilheirinho',
      monogram: 'ART',
      accentText: 'Duplas · 1 Toque · Trave = Pênalti',
      headline: 'Goleiro na área, atacante no ataque e finalização de 1 toque!',
      meta: 'Goleiro lança · Rotação no gol · Pênalti por traves · 1P ou 2P Local',
      ctaLabel: 'Abrir Modo Artilheirinho',
      highlightBadge: 'NOVO',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('ARTILHEIRINHO');
      },
    },
    {
      id: 'rocket_league',
      label: 'Rocket Cars',
      monogram: 'NITRO',
      accentText: 'Carros · Garagem · Boost',
      headline: 'Acelere seu carro customizado com nitro e marque golaços!',
      meta: 'Customização completa · Nitro Pads · 1v1, 2v2 e 2P Local',
      ctaLabel: 'Abrir Garagem Rocket Cars',
      highlightBadge: 'NOVO',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('ROCKET_LEAGUE');
      },
    },
    {
      id: 'local_2p',
      label: '2 Jogadores Local',
      monogram: 'VS',
      accentText: 'Mesmo PC / Tela',
      headline: 'Duelo direto lado a lado no mesmo dispositivo.',
      meta: 'J1 (WASD + Espaço) · J2 (Setas + Enter) · Controles USB',
      ctaLabel: 'Abrir Duelo Local 2P',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('QUICK_MATCH', 'local_2p');
      },
    },
    {
      id: 'online_2p',
      label: 'FC ao Vivo · Online & Ligas',
      monogram: 'LIVE',
      accentText: 'Times Próprios · Ligas · Salas 2P',
      headline: 'Crie seu time customizado, dispute ligas online e salas 2P.',
      meta: 'Criador de Times · Ligas Online com Tabela · Salas Realtime',
      ctaLabel: 'Entrar no Modo Online',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('MULTIPLAYER_2P');
      },
    },
    {
      id: 'player_career',
      label: 'Carreira de Jogador',
      monogram: '2V2',
      accentText: playerCareerStageLabel,
      headline: 'Carreira profissional estilo FIFA disputada em partidas 2v2.',
      meta: 'Crie seu craque · Jogos 2v2 com 1 parceiro · Evolução OVR · Propostas',
      ctaLabel: playerCareer ? 'Continuar Carreira (2v2)' : 'Iniciar Carreira (2v2)',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('PLAYER_CAREER');
      },
    },
    {
      id: 'manager_career',
      label: 'Carreira de Manager',
      monogram: 'CM',
      accentText: career ? `${careerTeam?.shortCode || 'Clube'} · Rodada ${Math.min(career.currentRound, career.totalRounds)}` : 'Novo Clube',
      headline: 'Assuma o comando técnico, contratações e táticas.',
      meta: 'Elenco · Mercado · Libertadores · Sul-Americana',
      ctaLabel: career ? 'Continuar Carreira' : 'Iniciar Carreira',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate(career ? 'CAREER_HUB' : 'CAREER_SELECT');
      },
    },
    {
      id: 'ultimate',
      label: 'Ultimate Cards',
      monogram: 'UT',
      accentText: `${profile ? profile.moedas : ultimate.coins} moedas`,
      headline: 'Colecione craques e monte sua escalação dos sonhos.',
      meta: 'Pacotes especiais · Evolução OVR · Loja do Clube',
      ctaLabel: 'Abrir Ultimate Cards',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('ULTIMATE_CARDS');
      },
    },
    {
      id: 'tournaments',
      label: 'Torneios & Copas',
      monogram: 'CUP',
      accentText: 'Mata-Mata Rápido',
      headline: 'Dispute troféus eliminatórios em sequência.',
      meta: 'Copas Continentais · Chaveamento Direto',
      ctaLabel: 'Ver Torneios',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('TOURNAMENTS');
      },
    },
    {
      id: 'training',
      label: 'Aprenda a Jogar · Treino',
      monogram: 'TRN',
      accentText: 'Solo & 1v1 Livre',
      headline: 'Afie sua pontaria, dribles curtos e controle de bola.',
      meta: 'Treino livre · 1v1 Tático · Domínio no Estádio Oficial',
      ctaLabel: 'Ir para o Treino',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('TRAINING_SETUP');
      },
    },
    {
      id: 'kits',
      label: 'Uniformes do Clube',
      monogram: 'KIT',
      accentText: 'Editor de Mantos',
      headline: 'Personalize cores, listras e detalhes em campo.',
      meta: 'Todos os clubes e seleções · Rastro da bola',
      ctaLabel: 'Editar Uniformes',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('KIT_CUSTOMIZER');
      },
    },
    {
      id: 'settings',
      label: 'Configurações',
      monogram: 'CFG',
      accentText: 'Áudio · Gamepad · Arena',
      headline: 'Ajuste estádio oficial, narração e controles.',
      meta: 'Narração PT-BR · Controles Touch · Gamepad USB',
      ctaLabel: 'Abrir Configurações',
      onSelect: () => {
        soundEngine.unlock();
        soundEngine.playClick();
        onNavigate('SETTINGS');
      },
    },
  ];

  const activeEntry = entries.find((e) => e.id === activeId) || entries[0];

  // Keyboard navigation (Up / Down / Enter) like EA FC console menu
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveId((prev) => {
          const idx = entries.findIndex((x) => x.id === prev);
          return entries[(idx + 1) % entries.length].id;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveId((prev) => {
          const idx = entries.findIndex((x) => x.id === prev);
          return entries[(idx - 1 + entries.length) % entries.length].id;
        });
      } else if (e.key === 'Enter') {
        const current = entries.find((x) => x.id === activeId);
        if (current) {
          current.onSelect();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="relative w-full min-h-[100dvh] lg:h-[100dvh] overflow-x-hidden overflow-y-auto lg:overflow-hidden bg-[#060908] text-slate-100 select-none safe-area-hud">
      {/* Stadium Hero Image Backdrop */}
      {!imgFailed ? (
        <img
          src={stadiumMenuBackdrop}
          alt="Estádio iluminado à noite"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="fixed lg:absolute inset-0 w-full h-full object-cover object-center scale-[1.02] pointer-events-none"
        />
      ) : (
        <div className="fixed lg:absolute inset-0 bg-gradient-to-br from-[#07150E] via-[#050807] to-[#0A1F14]" />
      )}

      {/* Cinematic contrast scrim */}
      <div className="fixed lg:absolute inset-0 bg-gradient-to-r from-[#050807]/95 via-[#070B09]/75 to-[#060908]/55 pointer-events-none" />
      <div className="fixed lg:absolute inset-0 bg-gradient-to-t from-[#040706]/95 via-transparent to-[#050807]/75 pointer-events-none" />

      {/* Slanted dark diagonal navigation rail backdrop (EA FC silhouette - Desktop) */}
      <div
        aria-hidden="true"
        className="hidden lg:block absolute inset-y-0 left-0 w-[400px] xl:w-[440px] bg-[#0B0E0D]/82 backdrop-blur-md border-r border-white/10 pointer-events-none"
        style={{ clipPath: 'polygon(0 0, 100% 0, 82% 100%, 0% 100%)' }}
      />

      {/* Signature corner micro-triangle matrix accents */}
      <svg
        aria-hidden="true"
        viewBox="0 0 120 120"
        className="hidden lg:block absolute bottom-8 left-2 w-24 h-24 opacity-85 pointer-events-none"
      >
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1, 2, 3, 4]
            .filter((col) => col <= row)
            .map((col) => (
              <polygon
                key={`bl-${row}-${col}`}
                points={`${col * 18},${row * 18} ${col * 18 + 7},${row * 18} ${col * 18 + 3.5},${row * 18 + 6}`}
                fill="#10B981"
              />
            ))
        )}
      </svg>

      <svg
        aria-hidden="true"
        viewBox="0 0 160 44"
        className="hidden lg:block absolute bottom-12 right-5 w-32 h-9 opacity-75 pointer-events-none"
      >
        {[0, 1].map((row) =>
          [0, 1, 2, 3, 4, 5, 6].map((col) => (
            <polygon
              key={`br-${row}-${col}`}
              points={`${col * 20},${row * 16} ${col * 20 + 7},${row * 16} ${col * 20 + 3.5},${row * 16 + 6}`}
              fill="#F8FAFC"
            />
          ))
        )}
      </svg>

      {/* Main Layout Container */}
      <div className="relative z-10 min-h-[100dvh] lg:h-full w-full flex flex-col justify-between px-3 sm:px-6 lg:px-8 py-3 sm:py-5 gap-4 lg:gap-0">
        {/* TOP HEADER BAR */}
        <header className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Top-Left: Settings / Accessibility icons + Slanted AB/FC Logo */}
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div className="hidden sm:flex flex-col items-center gap-1.5">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onNavigate('SETTINGS');
                }}
                title="Configurações"
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onUpdateSettings({ mobileControls: !settings.mobileControls });
                }}
                title={settings.mobileControls ? 'Controles Touch: Ligado' : 'Controles Touch: Desligado'}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  settings.mobileControls
                    ? 'text-emerald-400 bg-emerald-500/15'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              {/* Geometric slanted FC-style emblem */}
              <svg viewBox="0 0 64 44" className="w-10 h-7 sm:w-12 sm:h-8 shrink-0" aria-label="Arena Bola 2027">
                <polygon points="8,4 44,4 38,13 18,13 15,20 33,20 29,28 11,28 5,40 0,40" fill="#FFFFFF" />
                <polygon points="48,4 62,4 54,18 44,18 49,10 44,10" fill="#10B981" />
                <polygon points="39,24 52,24 44,40 31,40" fill="#FFFFFF" />
              </svg>
              <div className="leading-none truncate">
                <div className="font-display text-base sm:text-lg font-extrabold tracking-wider text-white truncate">
                  ARENA BOLA 2027
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono-tabular text-emerald-400 tracking-widest">
                  FC &amp; ROCKET CARS
                </div>
              </div>
            </div>
          </div>

          {/* Top-Right: Audio/Controls + Profile + Founder Club Emblem */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton variant="compact" />
            </div>

            <button
              onClick={() => {
                soundEngine.playClick();
                const pad = getConnectedGamepad();
                if (pad) {
                  onSyncGamepad(pad.id);
                  onUpdateSettings({ gamepadEnabled: true });
                } else {
                  onNavigate('SETTINGS');
                }
              }}
              title="Controle USB / Bluetooth"
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                connectedGamepadName && settings.gamepadEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  : 'bg-black/45 text-slate-300 border border-white/10 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>{connectedGamepadName ? 'Controle ON' : 'Controle'}</span>
            </button>

            <button
              onClick={() => onUpdateSettings({ musicEnabled: !settings.musicEnabled })}
              title="Música"
              className={`hidden sm:inline-flex p-2 rounded-lg border transition-colors cursor-pointer ${
                settings.musicEnabled && !settings.muted
                  ? 'bg-black/50 border-emerald-400/40 text-emerald-300'
                  : 'bg-black/45 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onUpdateSettings({ narrationEnabled: !settings.narrationEnabled })}
              title="Narração Brasileira"
              className={`hidden sm:inline-flex p-2 rounded-lg border transition-colors cursor-pointer ${
                settings.narrationEnabled && !settings.muted
                  ? 'bg-black/50 border-amber-400/40 text-amber-300'
                  : 'bg-black/45 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onUpdateSettings({ muted: !settings.muted })}
              title={settings.muted ? 'Ativar Som' : 'Silenciar'}
              className="p-2 rounded-lg bg-black/45 border border-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              {settings.muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenFriends();
              }}
              title="Amigos & Convites"
              className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-xs font-bold text-emerald-200 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Amigos</span>
              {pendingFriendsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-mono-tabular font-black text-[10px]">
                  {pendingFriendsCount}
                </span>
              )}
            </button>

            {(profile.role === 'super_admin' || profile.role === 'admin' || !hasAnySuperAdmin) && (
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onOpenAdmin();
                }}
                title="Painel Admin"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-bold text-amber-200 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">
                  {profile.role === 'super_admin'
                    ? 'Super Admin'
                    : profile.role === 'admin'
                      ? 'Admin'
                      : 'Admin Setup'}
                </span>
              </button>
            )}

            {/* Profile + Circular Club Emblem */}
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenProfile();
              }}
              className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 transition-colors cursor-pointer"
            >
              <div className="text-right leading-tight">
                <div className="text-[11px] sm:text-xs font-bold text-white max-w-[76px] sm:max-w-none truncate">
                  {profile.nome}
                </div>
                <div className="text-[10px] font-mono-tabular text-amber-300 flex items-center justify-end gap-0.5">
                  <Coins className="w-2.5 h-2.5" /> {profile.moedas}
                </div>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center shadow-lg shrink-0 overflow-hidden p-0.5">
                <ClubCrest team={favTeam} size={28} />
              </div>
            </button>
          </div>
        </header>

        {/* ================= MOBILE & TABLET PORTRAIT LAYOUT (< lg) ================= */}
        <div className="lg:hidden flex-1 flex flex-col gap-3.5 pb-4">
          {/* Featured Action Card */}
          <div className="rounded-2xl bg-[#0B1210]/85 border border-emerald-400/35 backdrop-blur-md p-4 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="font-display text-2xl font-black italic text-white leading-none"
                  style={{ transform: 'skewX(-10deg)' }}
                >
                  {activeEntry.monogram}
                </span>
                <span className="text-[11px] font-bold text-emerald-400">
                  {activeEntry.accentText}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onUpdateSettings({ mobileControls: !settings.mobileControls });
                }}
                className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                  settings.mobileControls
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-black/40 border-white/15 text-slate-300'
                }`}
              >
                <Smartphone className="w-3 h-3" /> Touch {settings.mobileControls ? 'ON' : 'OFF'}
              </button>
            </div>

            <h1 className="font-sans text-lg sm:text-xl font-extrabold text-white leading-snug">
              {activeEntry.headline}
            </h1>
            <p className="text-xs text-slate-300">{activeEntry.meta}</p>

            <div className="pt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={activeEntry.onSelect}
                className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-white hover:bg-emerald-50 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.98]"
              >
                <span>{activeEntry.ctaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playClick();
                  onNavigate('ROCKET_LEAGUE');
                }}
                className="py-2.5 px-3.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/45 text-sky-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Car className="w-4 h-4 text-sky-300" />
                <span>Rocket Cars</span>
              </button>
            </div>
          </div>

          {/* Responsive 2-Column Mode Selector Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {entries.map((item) => {
              const isSelected = item.id === activeEntry.id;
              const isRocket = item.id === 'rocket_league';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveId(item.id);
                    item.onSelect();
                  }}
                  className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[82px] active:scale-[0.98] ${
                    isRocket
                      ? 'bg-gradient-to-br from-[#0F244A]/90 to-[#0B1633]/95 border-sky-400/50 text-white shadow-[0_0_20px_rgba(56,189,248,0.18)]'
                      : isSelected
                        ? 'bg-[#13261C]/95 border-emerald-400/65 text-white shadow-lg'
                        : 'bg-[#0B110F]/85 border-white/15 hover:border-white/30 text-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`font-display text-sm font-black italic tracking-tight ${
                        isRocket ? 'text-sky-300' : 'text-emerald-400'
                      }`}
                    >
                      {item.monogram}
                    </span>
                    {item.highlightBadge && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px] tracking-wider">
                        {item.highlightBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5">
                    <div className="font-sans text-xs sm:text-sm font-extrabold leading-tight text-white">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-300 truncate mt-0.5">
                      {item.accentText}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= DESKTOP EA FC SPLIT LAYOUT (lg+) ================= */}
        <div className="hidden lg:grid flex-1 min-h-0 grid-cols-12 items-center gap-6 py-2">
          {/* Left Rail Navigation */}
          <nav
            aria-label="Menu principal de modos"
            className="col-span-4 flex flex-col justify-center max-h-full overflow-y-auto pr-2 pl-10 space-y-0.5"
          >
            {entries.map((item) => {
              const isActive = item.id === activeEntry.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveId(item.id)}
                  onFocus={() => setActiveId(item.id)}
                  onClick={item.onSelect}
                  className={`group w-full text-left py-1.5 px-2 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? 'text-white translate-x-1.5'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`transition-all duration-150 whitespace-nowrap truncate ${
                        isActive
                          ? 'font-sans text-[21px] font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]'
                          : 'font-sans text-base font-medium'
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.highlightBadge && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 text-[9px] font-black tracking-wider shrink-0">
                        {item.highlightBadge}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <span className="text-[11px] font-semibold text-emerald-400 shrink-0 hidden xl:inline">
                      {item.monogram}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Center Hero Stage */}
          <main className="col-span-8 flex flex-col items-center justify-center text-center px-4 pr-16 xl:pr-24">
            <div className="max-w-xl w-full flex flex-col items-center space-y-5">
              <div className="flex flex-col items-center">
                <div
                  className={`font-display text-7xl font-black italic tracking-tighter drop-shadow-[0_6px_24px_rgba(0,0,0,0.7)] leading-none ${
                    activeEntry.id === 'rocket_league' ? 'text-sky-300' : 'text-white'
                  }`}
                  style={{ transform: 'skewX(-10deg)' }}
                >
                  {activeEntry.monogram}
                </div>
                <span className="text-xs font-semibold text-emerald-400 tracking-wide mt-1">
                  {activeEntry.accentText}
                </span>
              </div>

              <h1 className="font-sans text-4xl font-bold text-white leading-tight text-balance drop-shadow-[0_3px_14px_rgba(0,0,0,0.8)]">
                {activeEntry.headline}
              </h1>

              <p className="text-sm font-medium text-slate-200/90 drop-shadow">
                {activeEntry.meta}
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={activeEntry.onSelect}
                  className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-white hover:bg-emerald-50 text-slate-950 font-bold text-base shadow-[0_0_30px_rgba(16,185,129,0.55)] hover:shadow-[0_0_38px_rgba(52,211,153,0.75)] transition-all duration-150 cursor-pointer active:scale-[0.98]"
                >
                  <span>{activeEntry.ctaLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>
        </div>

        {/* BOTTOM CONSOLE FOOTER BAR */}
        <footer className="hidden lg:flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={activeEntry.onSelect}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <span className="w-5 h-5 rounded-full bg-white/15 border border-white/30 text-[10px] font-bold flex items-center justify-center text-white">
                A
              </span>
              <span>Selecionar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onNavigate('SETTINGS');
              }}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <span className="w-5 h-5 rounded-full bg-white/15 border border-white/30 text-[10px] font-bold flex items-center justify-center text-white">
                L
              </span>
              <span>Configurações / Acessibilidade</span>
            </button>

            <span className="text-slate-400">
              WASD Mover · Espaço Chutar / Impulso · ↑ ↓ Navegar
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onNavigate('MULTIPLAYER_2P');
            }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded bg-black/75 border border-white/15 hover:border-emerald-400/50 text-slate-200 transition-colors cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono-tabular font-bold">
              RT
            </span>
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <Users className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-mono-tabular font-bold">2P Online</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
