import React, { useState } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { INITIAL_TEAMS_2027, LEAGUES } from '../data/teams2027';
import { KitConfig, KitPattern, LeagueId, Team } from '../types/game';
import { PlayerDiscPreview } from './PlayerDiscPreview';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

interface KitCustomizerScreenProps {
  teams: Team[];
  initialTeamId?: string;
  onSaveKit: (teamId: string, kit: KitConfig) => void;
  onBack: () => void;
}

const PATTERNS: { id: KitPattern; label: string }[] = [
  { id: 'solid', label: 'Sólido' },
  { id: 'vertical_stripes', label: 'Listras Verticais' },
  { id: 'horizontal_hoops', label: 'Listras Horizontais' },
  { id: 'halves', label: 'Meio a Meio' },
  { id: 'sash', label: 'Faixa Diagonal' },
  { id: 'double_border', label: 'Anel Duplo' },
];

const COLOR_SWATCHES = [
  '#C8102E',
  '#DC2626',
  '#006437',
  '#15803D',
  '#004D98',
  '#1D4ED8',
  '#6CABDD',
  '#FDE047',
  '#F97316',
  '#670E36',
  '#111111',
  '#FFFFFF',
  '#A50044',
  '#D4AF37',
];

export const KitCustomizerScreen: React.FC<KitCustomizerScreenProps> = ({
  teams,
  initialTeamId,
  onSaveKit,
  onBack,
}) => {
  const startTeam = teams.find((t) => t.id === initialTeamId) || teams[0];
  const [selectedLeague, setSelectedLeague] = useState<LeagueId>(startTeam.leagueId);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(startTeam.id);
  const [draftKit, setDraftKit] = useState<KitConfig>({ ...startTeam.kit });
  const [savedNotice, setSavedNotice] = useState(false);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];
  const leagueTeams = teams.filter((t) => t.leagueId === selectedLeague);

  const selectClub = (team: Team) => {
    soundEngine.playClick();
    setSelectedTeamId(team.id);
    setDraftKit({ ...team.kit });
    setSavedNotice(false);
  };

  const handleSave = () => {
    soundEngine.playTransferSuccess();
    onSaveKit(selectedTeam.id, draftKit);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleResetDefault = () => {
    soundEngine.playClick();
    const original = INITIAL_TEAMS_2027.find((t) => t.id === selectedTeam.id);
    if (original) {
      setDraftKit({ ...original.kit });
      onSaveKit(selectedTeam.id, { ...original.kit });
    }
  };

  const samplePlayer = selectedTeam.players[0];
  const previewLabel =
    draftKit.displayMode === 'initial'
      ? (samplePlayer?.shortName.charAt(0) || 'A').toUpperCase()
      : String(samplePlayer?.number || 10);

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
            Customização de Uniformes
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Padrão Original
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" /> {savedNotice ? 'Uniforme Salvo!' : 'Salvar Uniforme'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl 2xl:max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Team Selector */}
        <section className="lg:col-span-4 bg-[#111D16] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Selecione o Clube (2027)
          </h2>

          <div className="grid grid-cols-2 gap-1.5 bg-black/35 p-1 rounded-xl">
            {LEAGUES.map((lg) => (
              <button
                key={lg.id}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedLeague(lg.id);
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedLeague === lg.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {lg.shortName}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
            {leagueTeams.map((team) => {
              const active = team.id === selectedTeam.id;
              return (
                <button
                  key={team.id}
                  onClick={() => selectClub(team)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-black/25 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <ClubCrest team={team} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{team.name}</div>
                    <div className="text-[11px] text-slate-400">{team.shortCode}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right: Live Pitch Disc Preview & Kit Controls */}
        <section className="lg:col-span-8 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-5 border-b border-white/10">
            <PlayerDiscPreview
              kit={draftKit}
              label={previewLabel}
              playerName={samplePlayer?.shortName || 'Craque'}
              team={selectedTeam}
              size={180}
            />
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2.5">
                <ClubCrest team={{ ...selectedTeam, kit: draftKit }} size={36} />
                <h2 className="font-display text-3xl font-extrabold text-white">{selectedTeam.name}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                O uniforme personalizado é aplicado imediatamente no jogador em pixel art, no escudo e nas partidas em todos os modos (Jogo Rápido, Artilheirinho, Treino e Carreira).
              </p>
              <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-3">
                <button
                  onClick={() => setDraftKit({ ...draftKit, displayMode: 'number' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    draftKit.displayMode === 'number'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-black/30 text-slate-300 border-white/10'
                  }`}
                >
                  Mostrar Número (ex: {samplePlayer?.number || 10})
                </button>
                <button
                  onClick={() => setDraftKit({ ...draftKit, displayMode: 'initial' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    draftKit.displayMode === 'initial'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-black/30 text-slate-300 border-white/10'
                  }`}
                >
                  Mostrar Inicial (ex: {samplePlayer?.shortName.charAt(0) || 'A'})
                </button>
                <button
                  onClick={() => setDraftKit({ ...draftKit, showCrown: !draftKit.showCrown })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    draftKit.showCrown
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-black/30 text-slate-300 border-white/10'
                  }`}
                >
                  Coroa no Capitão
                </button>
              </div>
            </div>
          </div>

          {/* Pattern Picker */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
              Estilo da Camisa em Campo
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PATTERNS.map((pat) => (
                <button
                  key={pat.id}
                  onClick={() => {
                    soundEngine.playClick();
                    setDraftKit({ ...draftKit, pattern: pat.id });
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    draftKit.pattern === pat.id
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-black/25 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  {pat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ColorRow
              label="Cor Primária"
              value={draftKit.primaryColor}
              onChange={(c) => setDraftKit({ ...draftKit, primaryColor: c })}
            />
            <ColorRow
              label="Cor Secundária"
              value={draftKit.secondaryColor}
              onChange={(c) => setDraftKit({ ...draftKit, secondaryColor: c })}
            />
            <ColorRow
              label="Cor do Texto / Número"
              value={draftKit.textColor}
              onChange={(c) => setDraftKit({ ...draftKit, textColor: c })}
            />
            <ColorRow
              label="Cor da Borda & Rastro"
              value={draftKit.borderColor}
              onChange={(c) => setDraftKit({ ...draftKit, borderColor: c, trailColor: c === '#09090B' || c === '#111111' ? draftKit.primaryColor : c })}
            />
          </div>
        </section>
      </main>
    </div>
  );
};

const ColorRow: React.FC<{ label: string; value: string; onChange: (c: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
      />
    </div>
    <div className="flex flex-wrap gap-1.5">
      {COLOR_SWATCHES.map((hex) => (
        <button
          key={hex}
          onClick={() => onChange(hex)}
          aria-label={`Selecionar cor ${hex}`}
          className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
            value.toLowerCase() === hex.toLowerCase()
              ? 'scale-110 border-white ring-2 ring-emerald-400'
              : 'border-white/20 hover:scale-105'
          }`}
          style={{ backgroundColor: hex }}
        />
      ))}
    </div>
  </div>
);
