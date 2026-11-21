import React, { useMemo, useState } from 'react';
import { Trophy, Coins, Award, Search, UserCheck, Cloud, CloudOff, X } from 'lucide-react';
import { JogadorProfile, Team } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

interface PlayerProfileModalProps {
  isOpen: boolean;
  isFirstVisit: boolean;
  currentProfile: JogadorProfile | null;
  allTeamsAndNations: Team[];
  isOnline: boolean;
  syncNotice: string | null;
  onSubmitProfile: (nome: string, timeFavoritoId: string) => Promise<void>;
  onUpdateFavoriteTeam?: (timeFavoritoId: string) => Promise<void>;
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  isOpen,
  isFirstVisit,
  currentProfile,
  allTeamsAndNations,
  isOnline,
  syncNotice,
  onSubmitProfile,
  onUpdateFavoriteTeam,
  onClose,
}) => {
  const [nome, setNome] = useState(currentProfile?.nome || '');
  const [favoriteId, setFavoriteId] = useState(currentProfile?.time_favorito || 'fla');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'account' | 'trophies'>(
    currentProfile && !isFirstVisit ? 'account' : 'account'
  );

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTeamsAndNations;
    return allTeamsAndNations.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortCode.toLowerCase().includes(q)
    );
  }, [allTeamsAndNations, search]);

  if (!isOpen) return null;

  const selectedTeam =
    allTeamsAndNations.find((t) => t.id === favoriteId) || allTeamsAndNations[0];
  const trophies = currentProfile?.carreira?.trophies || [];

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nome.trim();
    if (clean.length < 2) {
      setErrorMsg('Digite um nome de jogador com pelo menos 2 caracteres.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onSubmitProfile(clean, favoriteId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#111D16] border border-emerald-500/35 rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0D1812]">
          <div className="flex items-center gap-3">
            <ClubCrest team={selectedTeam} size={36} />
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white leading-none">
                {currentProfile ? `Perfil · ${currentProfile.nome}` : 'Bem-vindo ao Arena Bola 2027'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                {isOnline ? (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <Cloud className="w-3.5 h-3.5" /> Conectado ao Supabase
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-300">
                    <CloudOff className="w-3.5 h-3.5" /> Modo Offline (Fallback Local)
                  </span>
                )}
              </div>
            </div>
          </div>

          {!isFirstVisit && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {currentProfile && (
          <div className="flex items-center gap-2 px-5 pt-3 border-b border-white/10 bg-[#0F1B14]">
            <button
              onClick={() => {
                soundEngine.playClick();
                setTab('account');
              }}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                tab === 'account'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Conta & Time Favorito
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setTab('trophies');
              }}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                tab === 'trophies'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> Sala de Troféus ({trophies.length})
            </button>
          </div>
        )}

        <div className="p-5 overflow-y-auto space-y-4">
          {syncNotice && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-xs text-amber-200">
              {syncNotice}
            </div>
          )}

          {currentProfile && tab === 'trophies' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-black/35 border border-white/10 text-center">
                  <div className="text-[11px] text-slate-400">Moedas</div>
                  <div className="font-mono-tabular text-xl font-extrabold text-amber-300 flex items-center justify-center gap-1 mt-0.5">
                    <Coins className="w-4 h-4" /> {currentProfile.moedas}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-black/35 border border-white/10 text-center">
                  <div className="text-[11px] text-slate-400">Vitórias</div>
                  <div className="font-mono-tabular text-xl font-extrabold text-emerald-300 mt-0.5">
                    {currentProfile.vitorias}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-black/35 border border-white/10 text-center">
                  <div className="text-[11px] text-slate-400">Gols Marcados</div>
                  <div className="font-mono-tabular text-xl font-extrabold text-white mt-0.5">
                    {currentProfile.gols}
                  </div>
                </div>
              </div>

              {trophies.length === 0 ? (
                <div className="p-6 rounded-xl bg-black/30 border border-white/10 text-center text-xs text-slate-400">
                  Nenhum troféu conquistado ainda. Vença a Copa do Mundo, a Libertadores ou o Brasileirão para exibir suas taças aqui!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {trophies.map((tr) => {
                    const trTeam = allTeamsAndNations.find((t) => t.id === tr.teamId);
                    return (
                      <div
                        key={tr.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-amber-400/10 border border-amber-400/35"
                      >
                        {trTeam ? (
                          <ClubCrest team={trTeam} size={36} />
                        ) : (
                          <Award className="w-8 h-8 text-amber-300 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-amber-200 truncate">
                            {tr.title}
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {tr.teamName} · {new Date(tr.wonAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              {currentProfile && (
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 text-center">
                    <div className="text-[10px] text-slate-400">Moedas</div>
                    <div className="font-mono-tabular text-base font-extrabold text-amber-300">
                      {currentProfile.moedas}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 text-center">
                    <div className="text-[10px] text-slate-400">Vitórias</div>
                    <div className="font-mono-tabular text-base font-extrabold text-emerald-300">
                      {currentProfile.vitorias}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 text-center">
                    <div className="text-[10px] text-slate-400">Gols</div>
                    <div className="font-mono-tabular text-base font-extrabold text-white">
                      {currentProfile.gols}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Nome de Jogador {currentProfile ? '(ou digite outro para trocar/criar conta)' : ''}
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={28}
                  placeholder="Ex: CraqueCamisa10"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-emerald-400 outline-none text-sm text-white"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Se esse nome já existir no banco online, carregaremos seus dados automaticamente. Novos jogadores começam com 100 moedas.
                </p>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold text-slate-200">
                    Escolha seu Time ou Seleção Favorita
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar clube ou seleção..."
                      className="pl-8 pr-3 py-1 rounded-lg bg-black/40 border border-white/15 text-xs text-white outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                  {filteredTeams.map((t) => {
                    const active = t.id === favoriteId;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => {
                          soundEngine.playClick();
                          setFavoriteId(t.id);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-white'
                            : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <ClubCrest team={t} size={28} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{t.name}</div>
                          <div className="text-[10px] text-slate-400">{t.shortCode}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/35 text-xs text-rose-200">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 pt-1">
                {currentProfile && onUpdateFavoriteTeam && favoriteId !== currentProfile.time_favorito && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        await onUpdateFavoriteTeam(favoriteId);
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
                  >
                    Salvar Novo Time Favorito
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-display text-lg font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-5 h-5" />
                  {submitting
                    ? 'Sincronizando...'
                    : currentProfile
                      ? 'Confirmar / Carregar Conta'
                      : 'Entrar no Arena Bola'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
