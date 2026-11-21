import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  User,
  Users,
  X,
} from 'lucide-react';
import { JogadorProfile, Team, UserRole } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';
import {
  claimInitialSuperAdmin,
  fetchAllRegisteredUsersForAdmin,
  setUserRoleAsSuperAdmin,
} from '../utils/supabaseClient';

interface AdminPanelModalProps {
  isOpen: boolean;
  currentProfile: JogadorProfile;
  hasAnySuperAdmin: boolean;
  allTeamsAndNations: Team[];
  onProfileUpdated: (next: JogadorProfile) => void;
  onSuperAdminClaimed: () => void;
  onClose: () => void;
}

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'Jogador',
};

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  currentProfile,
  hasAnySuperAdmin,
  allTeamsAndNations,
  onProfileUpdated,
  onSuperAdminClaimed,
  onClose,
}) => {
  const [users, setUsers] = useState<JogadorProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isSuperAdmin = currentProfile.role === 'super_admin';
  const isAdminOrSuper = isSuperAdmin || currentProfile.role === 'admin';

  const loadUsers = useCallback(async () => {
    if (!isAdminOrSuper) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchAllRegisteredUsersForAdmin();
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setUsers(res.users);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdminOrSuper]);

  useEffect(() => {
    if (isOpen && isAdminOrSuper) {
      void loadUsers();
    }
  }, [isOpen, isAdminOrSuper, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || 'user').toLowerCase().includes(q)
    );
  }, [users, search]);

  if (!isOpen) return null;

  const handleClaimFirstSuperAdmin = async () => {
    soundEngine.playClick();
    setClaiming(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await claimInitialSuperAdmin();
      if (res.error || !res.profile) {
        setErrorMsg(res.error || 'Não foi possível ativar Super Admin inicial.');
        return;
      }
      soundEngine.playTransferSuccess();
      onProfileUpdated(res.profile);
      onSuperAdminClaimed();
      setStatusMsg('Sua conta agora é Super Admin do projeto!');
    } finally {
      setClaiming(false);
    }
  };

  const handleChangeRole = async (target: JogadorProfile, newRole: UserRole) => {
    if (!target.user_id || !isSuperAdmin) return;
    if (target.user_id === currentProfile.user_id && newRole !== 'super_admin') {
      const superAdminsCount = users.filter((u) => u.role === 'super_admin').length;
      if (superAdminsCount <= 1) {
        setErrorMsg('Promova outro usuário a Super Admin antes de rebaixar sua própria conta.');
        return;
      }
    }

    soundEngine.playClick();
    setUpdatingUserId(target.user_id);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await setUserRoleAsSuperAdmin(target.user_id, newRole);
      if (res.error || !res.user) {
        setErrorMsg(res.error || 'Falha ao atualizar cargo do usuário.');
        return;
      }
      soundEngine.playTransferSuccess();
      setUsers((prev) =>
        prev.map((u) => (u.user_id === target.user_id ? res.user! : u))
      );
      if (target.user_id === currentProfile.user_id) {
        onProfileUpdated({ ...currentProfile, role: newRole });
      }
      setStatusMsg(`${target.nome} atualizado para ${ROLE_LABEL[newRole]}.`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const totalGoals = users.reduce((acc, u) => acc + (u.gols || 0), 0);
  const totalWins = users.reduce((acc, u) => acc + (u.vitorias || 0), 0);
  const superCount = users.filter((u) => u.role === 'super_admin').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#111D16] border border-amber-400/40 rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0D1812]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white leading-none">
                Painel Admin · Usuários Cadastrados
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Gerenciamento de contas e cargos no Supabase ({ROLE_LABEL[currentProfile.role || 'user']})
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
            aria-label="Fechar painel admin"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200">
              {statusMsg}
            </div>
          )}

          {!isAdminOrSuper ? (
            <div className="p-6 rounded-2xl bg-black/35 border border-amber-400/30 text-center space-y-4">
              <ShieldAlert className="w-10 h-10 text-amber-300 mx-auto" />
              {!hasAnySuperAdmin ? (
                <>
                  <div className="space-y-1">
                    <h3 className="font-display text-2xl font-extrabold text-white">
                      Ativar Primeiro Super Admin
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto">
                      Ainda não existe nenhum Super Admin neste banco Supabase. Clique abaixo para promover sua conta atual (<strong>{currentProfile.email || currentProfile.nome}</strong>) a Super Admin.
                    </p>
                  </div>
                  <button
                    onClick={handleClaimFirstSuperAdmin}
                    disabled={claiming}
                    className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-display text-lg font-extrabold cursor-pointer"
                  >
                    {claiming ? 'Promovendo...' : 'TORNAR-ME SUPER ADMIN'}
                  </button>
                </>
              ) : (
                <div className="space-y-1">
                  <h3 className="font-display text-2xl font-extrabold text-white">
                    Acesso Restrito
                  </h3>
                  <p className="text-xs text-slate-400">
                    Apenas usuários com cargo de Admin ou Super Admin podem visualizar e gerenciar os cadastros.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-black/35 border border-white/10">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-400" /> Cadastrados
                  </div>
                  <div className="font-mono-tabular text-2xl font-extrabold text-white mt-0.5">
                    {users.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-black/35 border border-white/10">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" /> Super Admins
                  </div>
                  <div className="font-mono-tabular text-2xl font-extrabold text-amber-300 mt-0.5">
                    {superCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-black/35 border border-white/10">
                  <div className="text-[11px] text-slate-400">Total Vitórias</div>
                  <div className="font-mono-tabular text-2xl font-extrabold text-emerald-300 mt-0.5">
                    {totalWins}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-black/35 border border-white/10">
                  <div className="text-[11px] text-slate-400">Total Gols</div>
                  <div className="font-mono-tabular text-2xl font-extrabold text-white mt-0.5">
                    {totalGoals}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar usuário por nome, e-mail ou cargo..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
                <button
                  onClick={() => void loadUsers()}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar Lista
                </button>
              </div>

              <div className="space-y-2">
                {loading && users.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Carregando usuários do Supabase...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-black/25 rounded-xl border border-white/10">
                    Nenhum usuário encontrado.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const team =
                      allTeamsAndNations.find((t) => t.id === u.time_favorito) ||
                      allTeamsAndNations[0];
                    const role: UserRole = u.role || 'user';
                    const isSelf = u.user_id === currentProfile.user_id;
                    const busy = Boolean(u.user_id && updatingUserId === u.user_id);

                    return (
                      <div
                        key={u.user_id || u.id || u.nome}
                        className="p-3.5 rounded-xl bg-black/35 border border-white/10 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ClubCrest team={team} size={34} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-extrabold text-white truncate">
                                {u.nome}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                  VOCÊ
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                                  role === 'super_admin'
                                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                                    : role === 'admin'
                                      ? 'bg-sky-400/20 border-sky-400/50 text-sky-200'
                                      : 'bg-white/5 border-white/15 text-slate-300'
                                }`}
                              >
                                {role === 'super_admin' ? (
                                  <Crown className="w-3 h-3" />
                                ) : role === 'admin' ? (
                                  <Shield className="w-3 h-3" />
                                ) : (
                                  <User className="w-3 h-3" />
                                )}
                                {ROLE_LABEL[role]}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {u.email || 'Sem e-mail registrado'} · {u.moedas} moedas · {u.vitorias}V · {u.gols} gols
                              {u.created_at
                                ? ` · Cadastro: ${new Date(u.created_at).toLocaleDateString('pt-BR')}`
                                : ''}
                            </div>
                          </div>
                        </div>

                        {isSuperAdmin && u.user_id && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {role !== 'super_admin' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleChangeRole(u, 'super_admin')}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-[11px] cursor-pointer"
                              >
                                Subir p/ Super Admin
                              </button>
                            )}
                            {role !== 'admin' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleChangeRole(u, 'admin')}
                                className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 disabled:opacity-50 text-sky-200 font-bold text-[11px] cursor-pointer"
                              >
                                Tornar Admin
                              </button>
                            )}
                            {role !== 'user' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleChangeRole(u, 'user')}
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/15 hover:border-rose-400/40 disabled:opacity-50 text-slate-300 hover:text-rose-200 font-bold text-[11px] cursor-pointer"
                              >
                                Rebaixar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
