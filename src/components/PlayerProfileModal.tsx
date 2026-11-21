import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Coins, Award, Search, Check, Cloud, LogOut, Mail, Crown, Shield, X } from 'lucide-react';
import { JogadorProfile, Team } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

interface PlayerProfileModalProps {
  isOpen: boolean;
  currentProfile: JogadorProfile | null;
  allTeamsAndNations: Team[];
  isOnline: boolean;
  onUpdateProfile: (patch: { nome: string; timeFavoritoId: string }) => Promise<void>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  isOpen,
  currentProfile,
  allTeamsAndNations,
  isOnline,
  onUpdateProfile,
  onSignOut,
  onClose,
}) => {
  const [nome, setNome] = useState(currentProfile?.nome || '');
  const [favoriteId, setFavoriteId] = useState(currentProfile?.time_favorito || 'fla');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'account' | 'trophies'>('account');

  useEffect(() => {
    if (isOpen && currentProfile) {
      setNome(currentProfile.nome || '');
      setFavoriteId(currentProfile.time_favorito || 'fla');
      setErrorMsg(null);
      setSavedMsg(null);
      setSearch('');
      setTab('account');
    }
  }, [isOpen, currentProfile]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTeamsAndNations;
    return allTeamsAndNations.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortCode.toLowerCase().includes(q)
    );
  }, [allTeamsAndNations, search]);

  if (!isOpen || !currentProfile) return null;

  const selectedTeam =
    allTeamsAndNations.find((t) => t.id === favoriteId) || allTeamsAndNations[0];
  const trophies = currentProfile.carreira?.trophies || [];
  const role = currentProfile.role || 'user';

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nome.trim();
    if (clean.length < 2) {
      setErrorMsg('Digite um nome de jogador com pelo menos 2 caracteres.');
      return;
    }
    setErrorMsg(null);
    setSavedMsg(null);
    setSubmitting(true);
    try {
      await onUpdateProfile({ nome: clean, timeFavoritoId: favoriteId });
      soundEngine.playTransferSuccess();
      setSavedMsg('Perfil atualizado no Supabase!');
    } catch {
      setErrorMsg('Não foi possível salvar suas alterações agora.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#111D16] border border-emerald-500/35 rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0D1812]">
          <div className="flex items-center gap-3 min-w-0">
            <ClubCrest team={selectedTeam} size={36} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-2xl font-extrabold text-white leading-none truncate">
                  {currentProfile.nome}
                </h2>
                {role === 'super_admin' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/45 text-[10px] font-bold text-amber-200">
                    <Crown className="w-3 h-3" /> Super Admin
                  </span>
                )}
                {role === 'admin' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-400/20 border border-sky-400/45 text-[10px] font-bold text-sky-200">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 truncate">
                <span className="flex items-center gap-1 text-emerald-300">
                  <Cloud className="w-3.5 h-3.5" /> {isOnline ? 'Sincronizado no Supabase' : 'Conta Supabase'}
                </span>
                {currentProfile.email && (
                  <span className="flex items-center gap-1 truncate">
                    · <Mail className="w-3 h-3" /> {currentProfile.email}
                  </span>
                )}
              </div>
            </div>
          </div>

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
        </div>

        <div className="flex items-center justify-between gap-2 px-5 pt-3 border-b border-white/10 bg-[#0F1B14]">
          <div className="flex items-center gap-2">
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
              Minha Conta & Clube
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

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              void onSignOut();
            }}
            className="mb-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-[11px] font-bold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair da Conta
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto space-y-4">
          {tab === 'trophies' ? (
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
            <form onSubmit={handleConfirm} noValidate className="space-y-4">
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

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Nome em Campo
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={28}
                  placeholder="Ex: João Silva"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-emerald-400 outline-none text-sm text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Seus dados são isolados por e-mail/usuário e sincronizados automaticamente no Supabase.
                </p>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold text-slate-200">
                    Time ou Seleção Favorita
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

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 sm:max-h-52 overflow-y-auto pr-1">
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

              {savedMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-xs text-emerald-200">
                  {savedMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-display text-lg font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-5 h-5" />
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
