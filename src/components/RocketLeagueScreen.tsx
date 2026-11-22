import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Car,
  Flame,
  Paintbrush,
  Play,
  RotateCcw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  ActiveMatchConfig,
  AIDifficulty,
  MatchSettings,
  RocketCarBoost,
  RocketCarChassis,
  RocketCarConfig,
  RocketCarDecal,
  RocketCarTopper,
  RocketCarWheel,
  Team,
} from '../types/game';
import {
  BOOST_PALETTE,
  CHASSIS_SPECS,
  DEFAULT_ROCKET_CAR,
  drawTopDownCar,
} from '../utils/rocketCarStorage';
import { soundEngine } from '../utils/audio';

interface RocketLeagueScreenProps {
  teams: Team[];
  rocketCar: RocketCarConfig;
  settings: MatchSettings;
  onUpdateRocketCar: (next: RocketCarConfig) => void;
  onUpdateSettings: (patch: Partial<MatchSettings>) => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

const PRIMARY_COLORS = [
  '#0EA5E9',
  '#EF4444',
  '#10B981',
  '#F97316',
  '#8B5CF6',
  '#EC4899',
  '#FACC15',
  '#1E293B',
  '#FFFFFF',
];

const SECONDARY_COLORS = [
  '#FACC15',
  '#FFFFFF',
  '#0F172A',
  '#38BDF8',
  '#34D399',
  '#FB7185',
  '#F97316',
  '#A855F7',
];

export const RocketLeagueScreen: React.FC<RocketLeagueScreenProps> = ({
  teams,
  rocketCar,
  settings,
  onUpdateRocketCar,
  onUpdateSettings,
  onStartMatch,
  onBack,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [garageTab, setGarageTab] = useState<'chassis' | 'paint' | 'decal' | 'boost'>('chassis');
  const [testBoost, setTestBoost] = useState(true);
  const [rocketMode, setRocketMode] = useState<'1v1' | '2v2' | 'local_2p'>('1v1');
  const [homeTeamId, setHomeTeamId] = useState<string>('fla');
  const [awayTeamId, setAwayTeamId] = useState<string>('rma');

  const homeTeam = teams.find((t) => t.id === homeTeamId) || teams[0];
  const awayTeam = teams.find((t) => t.id === awayTeamId) || teams[1];
  const spec = CHASSIS_SPECS[rocketCar.chassis];

  useEffect(() => {
    let raf = 0;
    let angle = -0.35;
    const renderPreview = () => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const w = 440;
          const h = 230;
          if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
          }
          ctx.save();
          ctx.scale(dpr, dpr);

          // Cyber Garage Floor
          const bg = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 240);
          bg.addColorStop(0, '#0F2547');
          bg.addColorStop(1, '#060B18');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          // Hexagonal floor grid lines
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
          ctx.lineWidth = 1;
          for (let gx = 0; gx <= w; gx += 32) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, h);
            ctx.stroke();
          }
          for (let gy = 0; gy <= h; gy += 32) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }

          // Turntable glowing circle
          ctx.beginPath();
          ctx.ellipse(w / 2, h / 2 + 4, 115, 62, 0, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          angle += 0.011;
          drawTopDownCar(ctx, w / 2, h / 2, angle, rocketCar, {
            isBoosting: testBoost,
            scale: 2.35,
            isHuman: true,
          });
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(renderPreview);
    };
    raf = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(raf);
  }, [rocketCar, testBoost]);

  const handleLaunch = () => {
    soundEngine.playWhistle(false);
    onStartMatch({
      tournament: 'rocket_cars',
      tournamentLabel:
        rocketMode === '2v2'
          ? 'Rocket Arena · Carros 2v2'
          : rocketMode === 'local_2p'
            ? 'Rocket Arena · 2 Jogadores Local'
            : 'Rocket Arena · Carros 1v1',
      homeTeam,
      awayTeam,
      humanSide: 'home',
      rocketMatchMode: rocketMode,
      rocketCar,
      player1Name: rocketCar.carName.trim() || 'J1 Turbo',
      player2Name: rocketMode === 'local_2p' ? 'J2 Nitro' : undefined,
      settings: {
        ...settings,
        format: 'rocket_cars',
        arenaSize: 'standard',
        withGoalkeeper: false,
      },
    });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#070E24] via-[#0B1738] to-[#050814] text-slate-100 flex flex-col safe-area-hud">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#060C20]/85 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-semibold text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
              Garagem & Arena Nitro
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-none">
              MODO ROCKET CARS
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLaunch}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" /> Jogar Arena Rocket
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: LIVE 2D GARAGE TURNTABLE + CAR SPECS */}
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-[#0C1736]/90 border border-sky-400/30 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-sky-400" />
                <span className="font-display text-xl font-extrabold text-white">
                  {rocketCar.carName || 'TURBO-10'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTestBoost((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                    testBoost
                      ? 'bg-orange-500/20 border-orange-400 text-orange-300'
                      : 'bg-black/40 border-white/15 text-slate-300'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{testBoost ? 'Nitro ON' : 'Nitro OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onUpdateRocketCar(DEFAULT_ROCKET_CAR);
                  }}
                  title="Restaurar Padrão"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="w-full flex items-center justify-center bg-[#060B18] p-2">
              <canvas
                ref={previewCanvasRef}
                className="w-full max-w-[440px] h-auto rounded-xl"
                style={{ aspectRatio: '440 / 230' }}
              />
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs font-bold text-sky-300 uppercase">{spec.label}</div>
                <p className="text-xs text-slate-300 mt-0.5">{spec.subtitle}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/35 border border-white/10 rounded-xl py-2 px-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Velocidade</div>
                  <div className="font-mono-tabular text-sm font-extrabold text-emerald-400">
                    {Math.round(spec.speedBonus * 90)}
                  </div>
                </div>
                <div className="bg-black/35 border border-white/10 rounded-xl py-2 px-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Força Impacto</div>
                  <div className="font-mono-tabular text-sm font-extrabold text-amber-300">
                    {Math.round(spec.shotBonus * 88)}
                  </div>
                </div>
                <div className="bg-black/35 border border-white/10 rounded-xl py-2 px-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Curva / Drift</div>
                  <div className="font-mono-tabular text-sm font-extrabold text-sky-300">
                    {Math.round(spec.turnBonus * 88)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Match Launch Box */}
          <div className="bg-[#0C1736]/90 border border-white/15 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Configurar Partida Rocket
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: '1v1' as const, label: '1v1 Carros' },
                  { id: '2v2' as const, label: '2v2 (4 Carros)' },
                  { id: 'local_2p' as const, label: '2P Local' },
                ]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setRocketMode(m.id);
                  }}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold cursor-pointer ${
                    rocketMode === m.id
                      ? 'bg-sky-400 text-slate-950 border-sky-300'
                      : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/25'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Duração</label>
                <div className="flex gap-1">
                  {[120, 180, 300].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onUpdateSettings({ durationSeconds: sec })}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono-tabular font-bold border cursor-pointer ${
                        settings.durationSeconds === sec
                          ? 'bg-white text-slate-950 border-white'
                          : 'bg-black/30 text-slate-300 border-white/10'
                      }`}
                    >
                      {sec / 60}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Bots IA</label>
                <div className="flex gap-1">
                  {(
                    [
                      { id: 'facil' as AIDifficulty, label: 'Fácil' },
                      { id: 'medio' as AIDifficulty, label: 'Médio' },
                      { id: 'dificil' as AIDifficulty, label: 'Pro' },
                    ]
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onUpdateSettings({ difficulty: d.id })}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        settings.difficulty === d.id
                          ? 'bg-white text-slate-950 border-white'
                          : 'bg-black/30 text-slate-300 border-white/10'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Escudo Casa</label>
                <select
                  value={homeTeam.id}
                  onChange={(e) => setHomeTeamId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                >
                  {teams.slice(0, 24).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Escudo Visitante</label>
                <select
                  value={awayTeam.id}
                  onChange={(e) => setAwayTeamId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                >
                  {teams.slice(0, 24).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[11px] text-sky-200 bg-sky-500/10 border border-sky-400/25 rounded-xl px-3 py-2">
              <strong>Controles Rocket:</strong> W/A/S/D dirigir · <strong>Shift</strong> ativa Nitro Turbo ·{' '}
              <strong>Espaço</strong> dá Impulso / Super Chute! Pegue pads laranjas no chão para recarregar Nitro.
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: GARAGE CUSTOMIZATION */}
        <section className="lg:col-span-7 bg-[#0C1736]/90 border border-white/15 rounded-2xl p-4 sm:p-5 space-y-5">
          {/* Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-black/35 p-1.5 rounded-xl border border-white/10">
            {(
              [
                { id: 'chassis' as const, label: 'Chassi', icon: Car },
                { id: 'paint' as const, label: 'Pintura', icon: Paintbrush },
                { id: 'decal' as const, label: 'Adesivo & Rodas', icon: Wrench },
                { id: 'boost' as const, label: 'Nitro & Teto', icon: Sparkles },
              ]
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setGarageTab(t.id);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    garageTab === t.id
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Car Plate Name */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Placa / Apelido do Carro
            </label>
            <input
              type="text"
              value={rocketCar.carName}
              onChange={(e) => onUpdateRocketCar({ ...rocketCar, carName: e.target.value })}
              maxLength={14}
              placeholder="TURBO-10"
              className="w-full sm:max-w-xs px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-sm font-bold text-white focus:border-sky-400 outline-none"
            />
          </div>

          {garageTab === 'chassis' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(CHASSIS_SPECS) as RocketCarChassis[]).map((key) => {
                const item = CHASSIS_SPECS[key];
                const active = rocketCar.chassis === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateRocketCar({ ...rocketCar, chassis: key });
                    }}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-sky-500/20 border-sky-400 text-white shadow'
                        : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="font-display text-2xl font-extrabold text-white">{item.label}</div>
                    <p className="text-xs text-slate-300 mt-1">{item.subtitle}</p>
                  </button>
                );
              })}
            </div>
          )}

          {garageTab === 'paint' && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-bold uppercase text-slate-300 mb-2">
                  Cor Principal da Lataria
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {PRIMARY_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateRocketCar({ ...rocketCar, primaryColor: hex });
                      }}
                      className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer ${
                        rocketCar.primaryColor === hex
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/25 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={`Cor principal ${hex}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={rocketCar.primaryColor}
                    onChange={(e) => onUpdateRocketCar({ ...rocketCar, primaryColor: e.target.value })}
                    className="w-9 h-9 rounded-lg bg-transparent border border-white/25 cursor-pointer"
                    title="Escolher cor personalizada"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase text-slate-300 mb-2">
                  Cor Secundária / Faixas
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {SECONDARY_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateRocketCar({ ...rocketCar, secondaryColor: hex });
                      }}
                      className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer ${
                        rocketCar.secondaryColor === hex
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/25 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={`Cor secundária ${hex}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={rocketCar.secondaryColor}
                    onChange={(e) => onUpdateRocketCar({ ...rocketCar, secondaryColor: e.target.value })}
                    className="w-9 h-9 rounded-lg bg-transparent border border-white/25 cursor-pointer"
                    title="Escolher cor secundária personalizada"
                  />
                </div>
              </div>
            </div>
          )}

          {garageTab === 'decal' && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-bold uppercase text-slate-300 mb-2">
                  Adesivo / Decalque
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'none' as RocketCarDecal, label: 'Liso (Sem Adesivo)' },
                      { id: 'racing_stripes' as RocketCarDecal, label: 'Listras Racing' },
                      { id: 'flames' as RocketCarDecal, label: 'Chamas Turbo' },
                      { id: 'bolt' as RocketCarDecal, label: 'Raio Elétrico' },
                      { id: 'star' as RocketCarDecal, label: 'Estrela Campeã' },
                    ]
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateRocketCar({ ...rocketCar, decal: d.id });
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                        rocketCar.decal === d.id
                          ? 'bg-sky-400 text-slate-950 border-sky-300'
                          : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase text-slate-300 mb-2">Rodas</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(
                    [
                      { id: 'classic' as RocketCarWheel, label: 'Clássica Prata' },
                      { id: 'neon_sport' as RocketCarWheel, label: 'Esportiva Neon' },
                      { id: 'gold_pro' as RocketCarWheel, label: 'Dourada Pro' },
                      { id: 'carbon' as RocketCarWheel, label: 'Carbono Dark' },
                    ]
                  ).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateRocketCar({ ...rocketCar, wheels: w.id });
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                        rocketCar.wheels === w.id
                          ? 'bg-sky-400 text-slate-950 border-sky-300'
                          : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {garageTab === 'boost' && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-bold uppercase text-slate-300 mb-2">
                  Rastro do Nitro (Turbo)
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(BOOST_PALETTE) as RocketCarBoost[]).map((bKey) => {
                    const b = BOOST_PALETTE[bKey];
                    const active = rocketCar.boostTrail === bKey;
                    return (
                      <button
                        key={bKey}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onUpdateRocketCar({ ...rocketCar, boostTrail: bKey });
                        }}
                        className={`p-3 rounded-xl border flex items-center gap-3 text-xs font-bold cursor-pointer ${
                          active
                            ? 'bg-sky-500/20 border-sky-400 text-white'
                            : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 border border-white/40"
                          style={{ backgroundColor: b.outer }}
                        />
                        <span>{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase text-slate-300 mb-2">
                  Aerofólio / Acessório de Teto
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(
                    [
                      { id: 'none' as RocketCarTopper, label: 'Sem Acessório' },
                      { id: 'wing' as RocketCarTopper, label: 'Aerofólio GT' },
                      { id: 'crown' as RocketCarTopper, label: 'Coroa Dourada' },
                      { id: 'antenna_br' as RocketCarTopper, label: 'Antena Brasil' },
                    ]
                  ).map((tp) => (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateRocketCar({ ...rocketCar, topper: tp.id });
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                        rocketCar.topper === tp.id
                          ? 'bg-sky-400 text-slate-950 border-sky-300'
                          : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {tp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Suas personalizações ficam salvas automaticamente na sua conta!
            </span>
            <button
              type="button"
              onClick={handleLaunch}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-xl cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Entrar na Arena Rocket
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
