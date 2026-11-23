import React, { useMemo, useState } from 'react';
import {
  Check,
  Gamepad2,
  RefreshCw,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { FriendRelation, GameInvite, PublicUser, Team } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

interface FriendsModalProps {
  isOpen: boolean;
  currentUser: PublicUser;
  friends: FriendRelation[];
  gameInvites: GameInvite[];
  registeredPlayers: PublicUser[];
  allTeams: Team[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSendFriendRequest: (target: PublicUser) => Promise<void>;
  onRespondFriendRequest: (relationId: string, accept: boolean) => Promise<void>;
  onRemoveFriend: (relationId: string) => Promise<void>;
  onPlayWithFriend: (friend: FriendRelation) => Promise<void>;
  onAcceptGameInvite: (invite: GameInvite) => Promise<void>;
  onDismissGameInvite: (inviteId: string) => Promise<void>;
  onClose: () => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  currentUser,
  friends,
  gameInvites,
  registeredPlayers,
  allTeams,
  loading,
  onRefresh,
  onSendFriendRequest,
  onRespondFriendRequest,
  onRemoveFriend,
  onPlayWithFriend,
  onAcceptGameInvite,
  onDismissGameInvite,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const acceptedFriends = useMemo(
    () => friends.filter((f) => f.status === 'accepted'),
    [friends]
  );
  const incomingRequests = useMemo(
    () => friends.filter((f) => f.status === 'pending_received'),
    [friends]
  );
  const sentRequests = useMemo(
    () => friends.filter((f) => f.status === 'pending_sent'),
    [friends]
  );

  const relationByUserId = useMemo(() => {
    const map = new Map<string, FriendRelation>();
    for (const f of friends) {
      map.set(f.friendUserId, f);
    }
    return map;
  }, [friends]);

  const filteredPlayers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const myId = currentUser.userId || String(currentUser.id);
    return registeredPlayers
      .filter((p) => {
        const pid = p.userId || String(p.id);
        if (pid === myId) return false;
        if (!q) return true;
        return (
          p.displayName.toLowerCase().includes(q) ||
          p.favoriteTeamId.toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [currentUser.id, currentUser.userId, registeredPlayers, searchTerm]);

  if (!isOpen) return null;

  const findTeam = (id: string) => allTeams.find((t) => t.id === id) || allTeams[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-3xl max-h-[90dvh] bg-[#0D1712] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10 bg-[#0A120E]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white truncate">
                Amigos e Convites Online
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Adicione jogadores e convide amigos para jogar juntos em sala 2P
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                void onRefresh();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Fechar janela de amigos"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {feedback && (
            <div className="text-xs text-emerald-200 bg-emerald-500/15 border border-emerald-400/35 rounded-xl px-4 py-2.5">
              {feedback}
            </div>
          )}

          {/* Convites de Jogo Recebidos */}
          {gameInvites.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-sm font-bold text-amber-300">
                Convites para Jogar Juntos ({gameInvites.length})
              </h3>
              <div className="space-y-2">
                {gameInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/35 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">
                        {inv.fromName} convidou você para jogar!
                      </div>
                      <div className="text-xs text-slate-300 font-mono-tabular">
                        Sala {inv.roomCode} · Clube: {inv.teamName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === inv.id}
                        onClick={async () => {
                          soundEngine.playTransferSuccess();
                          setBusyId(inv.id);
                          try {
                            await onAcceptGameInvite(inv);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Gamepad2 className="w-3.5 h-3.5" /> Aceitar e Jogar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === inv.id}
                        onClick={async () => {
                          soundEngine.playClick();
                          setBusyId(inv.id);
                          try {
                            await onDismissGameInvite(inv.id);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pedidos de Amizade Recebidos */}
          {incomingRequests.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-sm font-bold text-emerald-300">
                Pedidos de Amizade Recebidos ({incomingRequests.length})
              </h3>
              <div className="space-y-2">
                {incomingRequests.map((req) => {
                  const team = findTeam(req.friendFavoriteTeamId);
                  return (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-black/35 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClubCrest team={team} size={32} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {req.friendName}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            Torce para {team.name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={async () => {
                            soundEngine.playTransferSuccess();
                            setBusyId(req.id);
                            try {
                              await onRespondFriendRequest(req.id, true);
                              setFeedback(`${req.friendName} agora está na sua lista de amigos!`);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Aceitar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={async () => {
                            soundEngine.playClick();
                            setBusyId(req.id);
                            try {
                              await onRespondFriendRequest(req.id, false);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold whitespace-nowrap cursor-pointer"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Meus Amigos */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-white">
              Meus Amigos ({acceptedFriends.length})
            </h3>
            {acceptedFriends.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center bg-black/25 rounded-xl border border-white/10">
                Você ainda não tem amigos adicionados. Busque um jogador abaixo para adicionar!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {acceptedFriends.map((friend) => {
                  const team = findTeam(friend.friendFavoriteTeamId);
                  return (
                    <div
                      key={friend.id}
                      className="p-3 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClubCrest team={team} size={34} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {friend.friendName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {team.shortCode} · Amigo
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === friend.id}
                          onClick={async () => {
                            soundEngine.playClick();
                            setBusyId(friend.id);
                            try {
                              await onPlayWithFriend(friend);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <Gamepad2 className="w-3.5 h-3.5" /> Jogar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === friend.id}
                          onClick={async () => {
                            soundEngine.playClick();
                            setBusyId(friend.id);
                            try {
                              await onRemoveFriend(friend.id);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          title="Remover amigo"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Pedidos Enviados */}
          {sentRequests.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400">
                Convites Enviados Aguardando Resposta ({sentRequests.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {sentRequests.map((s) => (
                  <div
                    key={s.id}
                    className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-slate-300 flex items-center gap-2"
                  >
                    <span>{s.friendName}</span>
                    <button
                      type="button"
                      onClick={() => void onRemoveFriend(s.id)}
                      className="text-slate-400 hover:text-rose-300 cursor-pointer"
                      title="Cancelar convite"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Buscar Jogadores Cadastrados */}
          <section className="space-y-3 pt-2 border-t border-white/10">
            <h3 className="text-sm font-bold text-white">Adicionar Novos Amigos</h3>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar jogador pelo apelido..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
              />
            </div>

            {filteredPlayers.length === 0 ? (
              <div className="text-xs text-slate-400 py-5 text-center bg-black/20 rounded-xl">
                Nenhum jogador encontrado com esse termo.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredPlayers.map((player) => {
                  const pid = player.userId || String(player.id);
                  const rel = relationByUserId.get(pid);
                  const team = findTeam(player.favoriteTeamId);
                  return (
                    <div
                      key={pid}
                      className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClubCrest team={team} size={32} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {player.displayName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono-tabular truncate">
                            {team.shortCode} · {player.wins}V {player.points} pts
                          </div>
                        </div>
                      </div>

                      {rel?.status === 'accepted' ? (
                        <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap shrink-0">
                          Amigo
                        </span>
                      ) : rel?.status === 'pending_sent' ? (
                        <span className="text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0">
                          Solicitado
                        </span>
                      ) : rel?.status === 'pending_received' ? (
                        <button
                          type="button"
                          onClick={() => void onRespondFriendRequest(rel.id, true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer shrink-0"
                        >
                          Aceitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === pid}
                          onClick={async () => {
                            soundEngine.playClick();
                            setBusyId(pid);
                            try {
                              await onSendFriendRequest(player);
                              setFeedback(`Pedido de amizade enviado para ${player.displayName}!`);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-emerald-500 hover:text-slate-950 text-white font-bold text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Adicionar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
