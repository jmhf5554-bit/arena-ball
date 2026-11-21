import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Cloud,
  Copy,
  Globe,
  Play,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  ActiveMatchConfig,
  JogadorProfile,
  MatchSettings,
  PublicUser,
  Team,
  TwoPlayerMatchRecord,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';
import {
  createSupabaseRoom,
  fetchSupabaseLeaderboard,
  fetchSupabaseRecentMatches,
  getSupabaseClient,
  joinSupabaseRoom,
  listOpenSupabaseRooms,
  profileToPublicUser,
  SUPABASE_URL,
  SupabaseRoomRow,
  translateSupabaseAuthError,
  updateSupabaseRoom,
} from '../utils/supabaseClient';

interface LobbyRoomState {
  code: string;
  hostUserId: string;
  hostName: string;
  guestUserId: string | null;
  guestName: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  durationSeconds: number;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
}

interface Multiplayer2PScreenProps {
  teams: Team[];
  settings: MatchSettings;
  jogadorProfile: JogadorProfile;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

export const Multiplayer2PScreen: React.FC<Multiplayer2PScreenProps> = ({
  teams,
  settings,
  jogadorProfile,
  onStartMatch,
  onBack,
}) => {
  const currentUser = profileToPublicUser(jogadorProfile);
  const currentUserId = jogadorProfile.user_id || String(jogadorProfile.id || jogadorProfile.nome);

  const [mainTab, setMainTab] = useState<'online' | 'local' | 'ranking'>('online');

  // Online Rooms State (Supabase)
  const [hostTeamId, setHostTeamId] = useState(jogadorProfile.time_favorito || teams[0]?.id || 'fla');
  const [onlineDuration, setOnlineDuration] = useState(120);
  const [openRooms, setOpenRooms] = useState<SupabaseRoomRow[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [lobbyRoom, setLobbyRoom] = useState<LobbyRoomState | null>(null);
  const [lobbySide, setLobbySide] = useState<'home' | 'away'>('home');
  const [copiedCode, setCopiedCode] = useState(false);
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null);

  // Local 2P State
  const [p1TeamId, setP1TeamId] = useState(jogadorProfile.time_favorito || teams[0]?.id || 'fla');
  const [p2TeamId, setP2TeamId] = useState(teams[1]?.id || 'pal');
  const [p2GuestName, setP2GuestName] = useState('Jogador 2');
  const [localDuration, setLocalDuration] = useState(120);
  const [p2User, setP2User] = useState<PublicUser | null>(null);
  const [p2Email, setP2Email] = useState('');
  const [p2Password, setP2Password] = useState('');
  const [p2Error, setP2Error] = useState<string | null>(null);
  const [p2Loading, setP2Loading] = useState(false);

  // Ranking & History State
  const [leaderboard, setLeaderboard] = useState<PublicUser[]>([]);
  const [recentMatches, setRecentMatches] = useState<TwoPlayerMatchRecord[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  const rowToLobbyState = useCallback(
    (row: SupabaseRoomRow): LobbyRoomState => {
      const homeT = teams.find((t) => t.id === row.host_team_id) || teams[0];
      const awayT = teams.find((t) => t.id === row.away_team_id) || teams[1] || teams[0];
      return {
        code: row.code,
        hostUserId: row.host_user_id,
        hostName: row.host_name,
        guestUserId: row.guest_user_id,
        guestName: row.guest_name,
        homeTeamId: row.host_team_id,
        awayTeamId: row.away_team_id,
        homeTeamName: homeT.name,
        awayTeamName: awayT.name,
        durationSeconds: row.duration_seconds || 120,
        status: row.status,
      };
    },
    [teams]
  );

  const cleanupLobbyChannel = useCallback(() => {
    const client = getSupabaseClient();
    if (lobbyChannelRef.current && client) {
      void client.removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
  }, []);

  const fetchOpenRooms = useCallback(async () => {
    const rooms = await listOpenSupabaseRooms();
    setOpenRooms(rooms);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setRankingLoading(true);
    try {
      const [board, matches] = await Promise.all([
        fetchSupabaseLeaderboard(30),
        fetchSupabaseRecentMatches(20),
      ]);
      setLeaderboard(board);
      setRecentMatches(matches);
    } finally {
      setRankingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'online' && !lobbyRoom) {
      void fetchOpenRooms();
    } else if (mainTab === 'ranking') {
      void fetchLeaderboard();
    }
  }, [fetchLeaderboard, fetchOpenRooms, lobbyRoom, mainTab]);

  useEffect(() => {
    return () => {
      cleanupLobbyChannel();
    };
  }, [cleanupLobbyChannel]);

  const launchOnlineMatchFromRoom = useCallback(
    (r: LobbyRoomState, mySide: 'home' | 'away') => {
      const homeT = teams.find((t) => t.id === r.homeTeamId) || teams[0];
      const awayT = teams.find((t) => t.id === r.awayTeamId) || teams[1] || teams[0];

      cleanupLobbyChannel();
      setLobbyRoom(null);

      soundEngine.playWhistle(false);
      onStartMatch({
        tournament: 'friendly',
        tournamentLabel: `Duelo Online 2P · Sala ${r.code}`,
        homeTeam: homeT,
        awayTeam: awayT,
        humanSide: mySide,
        player1Name: r.hostName,
        player2Name: r.guestName || 'Visitante',
        player1UserId: r.hostUserId,
        player2UserId: r.guestUserId,
        onlineRoom: {
          roomCode: r.code,
          token: currentUserId,
          side: mySide,
          transport: 'supabase',
        },
        settings: {
          ...settings,
          format: 'online_2p',
          withGoalkeeper: false,
          durationSeconds: r.durationSeconds || 120,
          goalLimit: 0,
        },
      });
    },
    [cleanupLobbyChannel, currentUserId, onStartMatch, settings, teams]
  );

  const subscribeToLobbyRoom = useCallback(
    (initialRow: SupabaseRoomRow, mySide: 'home' | 'away') => {
      const client = getSupabaseClient();
      if (!client) return;

      cleanupLobbyChannel();
      setLobbySide(mySide);
      setLobbyRoom(rowToLobbyState(initialRow));

      const ch = client
        .channel(`sala-lobby-${initialRow.code}`, {
          config: { broadcast: { self: false } },
        })
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'salas_online',
            filter: `code=eq.${initialRow.code}`,
          },
          (payload) => {
            const updated = payload.new as SupabaseRoomRow;
            if (!updated) return;
            const nextState = rowToLobbyState(updated);
            setLobbyRoom(nextState);
            if (updated.status === 'playing') {
              launchOnlineMatchFromRoom(nextState, mySide);
            }
          }
        )
        .on('broadcast', { event: 'match_started' }, ({ payload }) => {
          const roomPayload = (payload as { room?: LobbyRoomState })?.room;
          if (roomPayload) {
            launchOnlineMatchFromRoom(roomPayload, mySide);
          }
        })
        .on('broadcast', { event: 'team_changed' }, ({ payload }) => {
          const p = payload as { side?: 'home' | 'away'; teamId?: string; teamName?: string };
          if (!p?.teamId) return;
          setLobbyRoom((prev) => {
            if (!prev) return prev;
            return p.side === 'home'
              ? { ...prev, homeTeamId: p.teamId!, homeTeamName: p.teamName || prev.homeTeamName }
              : { ...prev, awayTeamId: p.teamId!, awayTeamName: p.teamName || prev.awayTeamName };
          });
        })
        .subscribe();

      lobbyChannelRef.current = ch;
    },
    [cleanupLobbyChannel, launchOnlineMatchFromRoom, rowToLobbyState]
  );

  const handleCreateRoom = async () => {
    setOnlineError(null);
    soundEngine.playClick();
    setCreatingRoom(true);
    try {
      const awayDefault = teams.find((t) => t.id !== hostTeamId)?.id || 'pal';
      const { room, error } = await createSupabaseRoom({
        hostUserId: currentUserId,
        hostName: currentUser.displayName,
        hostTeamId,
        awayTeamId: awayDefault,
        durationSeconds: onlineDuration,
      });
      if (error || !room) {
        setOnlineError(error || 'Não foi possível criar a sala.');
        return;
      }
      subscribeToLobbyRoom(room, 'home');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setOnlineError('Digite o código válido da sala.');
      return;
    }
    setOnlineError(null);
    soundEngine.playClick();
    const { room, error } = await joinSupabaseRoom({
      code: clean,
      guestUserId: currentUserId,
      guestName: currentUser.displayName,
    });
    if (error || !room) {
      setOnlineError(error || 'Não foi possível entrar na sala.');
      return;
    }
    const mySide: 'home' | 'away' = room.host_user_id === currentUserId ? 'home' : 'away';
    subscribeToLobbyRoom(room, mySide);
  };

  const handleSelectLobbyTeam = async (teamId: string) => {
    if (!lobbyRoom) return;
    const t = teams.find((x) => x.id === teamId);
    if (!t) return;
    soundEngine.playClick();

    setLobbyRoom((prev) => {
      if (!prev) return prev;
      return lobbySide === 'home'
        ? { ...prev, homeTeamId: t.id, homeTeamName: t.name }
        : { ...prev, awayTeamId: t.id, awayTeamName: t.name };
    });

    await updateSupabaseRoom(
      lobbyRoom.code,
      lobbySide === 'home' ? { host_team_id: t.id } : { away_team_id: t.id }
    );
    await lobbyChannelRef.current?.send({
      type: 'broadcast',
      event: 'team_changed',
      payload: { side: lobbySide, teamId: t.id, teamName: t.name },
    });
  };

  const handleStartOnlineMatch = async () => {
    if (!lobbyRoom || !lobbyRoom.guestUserId) return;
    await updateSupabaseRoom(lobbyRoom.code, { status: 'playing' });
    await lobbyChannelRef.current?.send({
      type: 'broadcast',
      event: 'match_started',
      payload: { room: { ...lobbyRoom, status: 'playing' } },
    });
    launchOnlineMatchFromRoom({ ...lobbyRoom, status: 'playing' }, 'home');
  };

  const handleLeaveLobby = async () => {
    if (lobbyRoom) {
      if (lobbySide === 'home') {
        await updateSupabaseRoom(lobbyRoom.code, { status: 'finished' });
      } else {
        await updateSupabaseRoom(lobbyRoom.code, {
          guest_user_id: null,
          guest_name: null,
          status: 'waiting',
        });
      }
    }
    cleanupLobbyChannel();
    setLobbyRoom(null);
    void fetchOpenRooms();
  };

  const handleP2VerifyEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setP2Error(null);
    const cleanEmail = p2Email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setP2Error('Digite o e-mail da conta do Jogador 2.');
      return;
    }
    if (p2Password.length < 6) {
      setP2Error('Digite a senha da conta do Jogador 2 (mín. 6 caracteres).');
      return;
    }

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (!anonKey) {
      setP2Error('Supabase não configurado.');
      return;
    }

    setP2Loading(true);
    try {
      // Ephemeral client without session persistence so Player 1's session remains untouched
      const tempClient = createClient(SUPABASE_URL, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await tempClient.auth.signInWithPassword({
        email: cleanEmail,
        password: p2Password,
      });
      if (error || !data.user) {
        setP2Error(translateSupabaseAuthError(error?.message || 'E-mail ou senha inválidos.'));
        return;
      }
      if (data.user.id === currentUserId) {
        setP2Error('Escolha outra conta para o Jogador 2 (diferente da sua).');
        return;
      }

      const { data: row } = await tempClient
        .from('jogadores')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle();

      const p2Name =
        (row as { nome?: string } | null)?.nome ||
        cleanEmail.split('@')[0];
      const p2Fav = (row as { time_favorito?: string } | null)?.time_favorito || p2TeamId;

      soundEngine.playTransferSuccess();
      setP2User({
        id: data.user.id,
        userId: data.user.id,
        email: cleanEmail,
        username: cleanEmail.split('@')[0],
        displayName: p2Name,
        favoriteTeamId: p2Fav,
        wins: Number((row as { vitorias?: number } | null)?.vitorias) || 0,
        draws: Number((row as { empates?: number } | null)?.empates) || 0,
        losses: Number((row as { derrotas?: number } | null)?.derrotas) || 0,
        goalsFor: Number((row as { gols?: number } | null)?.gols) || 0,
        goalsAgainst: Number((row as { gols_sofridos?: number } | null)?.gols_sofridos) || 0,
        points: 0,
        matchesPlayed: 0,
      });
      setP2TeamId(p2Fav);
      setP2Password('');
    } catch {
      setP2Error('Erro ao verificar conta do Jogador 2.');
    } finally {
      setP2Loading(false);
    }
  };

  const handleStartLocal2P = () => {
    const hTeam = teams.find((t) => t.id === p1TeamId) || teams[0];
    const aTeam = teams.find((t) => t.id === p2TeamId) || teams[1] || teams[0];
    soundEngine.playWhistle(false);
    onStartMatch({
      tournament: 'friendly',
      tournamentLabel: 'Duelo 2 Jogadores Local (Mesmo PC / Tela)',
      homeTeam: hTeam,
      awayTeam: aTeam,
      humanSide: 'home',
      player1Name: currentUser.displayName,
      player2Name: p2User?.displayName || p2GuestName.trim() || 'Jogador 2',
      player1UserId: currentUserId,
      player2UserId: p2User?.userId || null,
      settings: {
        ...settings,
        format: 'local_2p',
        withGoalkeeper: false,
        durationSeconds: localDuration,
        goalLimit: 0,
      },
    });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#09120D] text-slate-100 flex flex-col safe-area-hud">
      <header className="border-b border-white/10 bg-[#0D1812] px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundEngine.playClick();
                cleanupLobbyChannel();
                onBack();
              }}
              className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <div className="h-5 w-px bg-white/15" />
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
                Modo 2 Jogadores · Salas Online & Ranking
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-black/35 border border-emerald-500/30 rounded-xl px-3 py-1.5">
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-xs leading-tight">
              <div className="font-bold text-white">{currentUser.displayName}</div>
              <div className="text-[11px] text-slate-400 font-mono-tabular">
                {currentUser.wins}V {currentUser.draws}E {currentUser.losses}D · {currentUser.points} pts
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
          <button
            onClick={() => {
              soundEngine.playClick();
              setMainTab('online');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              mainTab === 'online'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111D16] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" /> 2 Jogadores Online (Salas)
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setMainTab('local');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              mainTab === 'local'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111D16] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> 2 Jogadores Local (Mesmo PC / Tela)
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setMainTab('ranking');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              mainTab === 'ranking'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-[#111D16] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" /> Ranking & Histórico
          </button>
        </div>

        {/* TAB 1: ONLINE 2P (SUPABASE REALTIME) */}
        {mainTab === 'online' && (
          <div className="space-y-4">
            {onlineError && (
              <div className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/35 rounded-xl px-4 py-2.5">
                {onlineError}
              </div>
            )}

            {lobbyRoom ? (
              <div className="bg-[#111D16] border border-emerald-500/35 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Sala Online Conectada · Supabase Realtime
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-mono-tabular text-3xl font-black tracking-widest text-white">
                        {lobbyRoom.code}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(lobbyRoom.code);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 1800);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedCode ? 'Copiado!' : 'Copiar Código'}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleLeaveLobby()}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
                  >
                    Sair da Sala
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Home Player */}
                  <div className="p-4 rounded-xl bg-black/35 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase">
                        Jogador 1 (Casa)
                      </span>
                      <span className="text-sm font-extrabold text-white">{lobbyRoom.hostName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ClubCrest
                        team={teams.find((t) => t.id === lobbyRoom.homeTeamId) || teams[0]}
                        size={44}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">
                          {teams.find((t) => t.id === lobbyRoom.homeTeamId)?.name || lobbyRoom.homeTeamName}
                        </div>
                        {lobbySide === 'home' && (
                          <select
                            value={lobbyRoom.homeTeamId}
                            onChange={(e) => void handleSelectLobbyTeam(e.target.value)}
                            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[#0D1612] border border-white/15 text-xs text-white"
                          >
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.ovr})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Away Player */}
                  <div className="p-4 rounded-xl bg-black/35 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 uppercase">
                        Jogador 2 (Visitante)
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {lobbyRoom.guestName || 'Aguardando entrar...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ClubCrest
                        team={teams.find((t) => t.id === lobbyRoom.awayTeamId) || teams[1] || teams[0]}
                        size={44}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">
                          {teams.find((t) => t.id === lobbyRoom.awayTeamId)?.name || lobbyRoom.awayTeamName}
                        </div>
                        {lobbySide === 'away' && (
                          <select
                            value={lobbyRoom.awayTeamId}
                            onChange={(e) => void handleSelectLobbyTeam(e.target.value)}
                            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[#0D1612] border border-white/15 text-xs text-white"
                          >
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.ovr})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-400">
                    Envie o código <strong className="text-white">{lobbyRoom.code}</strong> para seu amigo entrar em outro dispositivo.
                  </span>
                  {lobbySide === 'home' ? (
                    <button
                      onClick={() => void handleStartOnlineMatch()}
                      disabled={!lobbyRoom.guestUserId}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer transition-colors"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      {lobbyRoom.guestUserId ? 'INICIAR PARTIDA ONLINE' : 'AGUARDANDO JOGADOR 2'}
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-300">
                      Conectado! Aguardando {lobbyRoom.hostName} iniciar a partida...
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Create Room */}
                <div className="lg:col-span-5 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
                  <h2 className="font-display text-2xl font-extrabold text-white">
                    Criar Sala Online 2P
                  </h2>
                  <p className="text-xs text-slate-400">
                    Crie uma sala sincronizada via Supabase Realtime e convide outro jogador com o código de 6 letras.
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Seu Clube (Casa)
                    </label>
                    <select
                      value={hostTeamId}
                      onChange={(e) => setHostTeamId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#111D16]">
                          {t.name} ({t.shortCode} · OVR {t.ovr})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Duração da Partida
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[120, 180].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setOnlineDuration(sec)}
                          className={`py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                            onlineDuration === sec
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                              : 'bg-black/30 border-white/10 text-slate-300'
                          }`}
                        >
                          {sec / 60} Minutos
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => void handleCreateRoom()}
                    disabled={creatingRoom}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer"
                  >
                    {creatingRoom ? 'CRIANDO SALA...' : 'CRIAR SALA 2 JOGADORES'}
                  </button>
                </div>

                {/* Join Room */}
                <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-2xl font-extrabold text-white">
                      Entrar em Sala Aberta
                    </h2>
                    <button
                      onClick={() => void fetchOpenRooms()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      placeholder="Código da sala (ex: A7K29P)"
                      maxLength={8}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm font-mono-tabular uppercase text-white focus:border-emerald-400 outline-none"
                    />
                    <button
                      onClick={() => void handleJoinRoom(joinCodeInput)}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer"
                    >
                      Entrar por Código
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {openRooms.length === 0 ? (
                      <div className="text-xs text-slate-400 py-8 text-center bg-black/25 rounded-xl border border-white/5">
                        Nenhuma sala aberta no momento. Crie uma sala ao lado!
                      </div>
                    ) : (
                      openRooms.map((rm) => (
                        <div
                          key={rm.code}
                          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-black/35 border border-white/10"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono-tabular font-bold text-sm text-emerald-300">
                                {rm.code}
                              </span>
                              <span className="text-xs font-semibold text-white">
                                Host: {rm.host_name || 'Jogador 1'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {rm.duration_seconds / 60} min ·{' '}
                              {rm.status === 'waiting' ? '1/2 jogadores (Vaga aberta)' : '2/2 jogadores'}
                            </div>
                          </div>
                          <button
                            onClick={() => void handleJoinRoom(rm.code)}
                            className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            Entrar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LOCAL 2P */}
        {mainTab === 'local' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Player 1 */}
            <div className="bg-[#111D16] border border-emerald-500/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Jogador 1 (Casa · Esquerda)
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300">
                  <ShieldCheck className="w-4 h-4" /> Conta Conectada
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-sm">{currentUser.displayName}</div>
                  <div className="text-[11px] text-slate-400 font-mono-tabular">
                    {currentUser.email || currentUser.username} · {currentUser.wins}V {currentUser.draws}E {currentUser.losses}D
                  </div>
                </div>
                <ClubCrest team={teams.find((t) => t.id === p1TeamId) || teams[0]} size={40} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Time do Jogador 1
                </label>
                <select
                  value={p1TeamId}
                  onChange={(e) => setP1TeamId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#111D16]">
                      {t.name} ({t.shortCode} · OVR {t.ovr})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-white">Controles do Jogador 1:</div>
                <div>• Teclado: <strong className="text-emerald-300">W, A, S, D</strong> + <strong className="text-emerald-300">Espaço</strong></div>
                <div>• Controle 1 ou Touch Esquerdo (se Mobile ON)</div>
              </div>
            </div>

            {/* Player 2 */}
            <div className="bg-[#111D16] border border-amber-400/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Jogador 2 (Visitante · Direita)
                </span>
                {p2User ? (
                  <button
                    onClick={() => setP2User(null)}
                    className="text-xs font-semibold text-slate-300 hover:text-rose-300 cursor-pointer"
                  >
                    Desconectar J2
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">Opcional: conectar conta</span>
                )}
              </div>

              {p2User ? (
                <div className="p-3.5 rounded-xl bg-black/35 border border-amber-400/30 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                      <UserCheck className="w-4 h-4 text-amber-400" /> {p2User.displayName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono-tabular">
                      {p2User.email || p2User.username} · {p2User.wins}V {p2User.draws}E {p2User.losses}D
                    </div>
                  </div>
                  <ClubCrest team={teams.find((t) => t.id === p2TeamId) || teams[1] || teams[0]} size={40} />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Nome do Jogador 2 (Convidado)
                      </label>
                      <input
                        type="text"
                        value={p2GuestName}
                        onChange={(e) => setP2GuestName(e.target.value)}
                        placeholder="Jogador 2"
                        maxLength={18}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/45 border border-white/15 text-xs text-white focus:border-amber-400 outline-none"
                      />
                    </div>
                    <ClubCrest team={teams.find((t) => t.id === p2TeamId) || teams[1] || teams[0]} size={40} />
                  </div>

                  <form onSubmit={handleP2VerifyEmailLogin} noValidate className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
                    <div className="text-[11px] font-bold text-slate-300">
                      Opcional: Conectar Conta Supabase do Jogador 2
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={p2Email}
                        onChange={(e) => setP2Email(e.target.value)}
                        placeholder="E-mail J2"
                        className="px-3 py-2 rounded-lg bg-black/45 border border-white/15 text-xs text-white outline-none"
                      />
                      <input
                        type="password"
                        value={p2Password}
                        onChange={(e) => setP2Password(e.target.value)}
                        placeholder="Senha J2"
                        className="px-3 py-2 rounded-lg bg-black/45 border border-white/15 text-xs text-white outline-none"
                      />
                    </div>
                    {p2Error && <div className="text-[11px] text-rose-300">{p2Error}</div>}
                    <button
                      type="submit"
                      disabled={p2Loading}
                      className="w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      {p2Loading ? 'Verificando...' : 'Conectar Jogador 2'}
                    </button>
                  </form>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Time do Jogador 2
                </label>
                <select
                  value={p2TeamId}
                  onChange={(e) => setP2TeamId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#111D16]">
                      {t.name} ({t.shortCode} · OVR {t.ovr})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-white">Controles do Jogador 2:</div>
                <div>• Mover: <strong className="text-amber-300">Setas (↑ ↓ ← →)</strong> (ou Controle 2)</div>
                <div>• Chutar: <strong className="text-amber-300">Enter, Tecla L ou 0 (Num)</strong></div>
              </div>
            </div>

            {/* Launch Local 2P CTA */}
            <div className="lg:col-span-2 bg-[#111D16] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300 uppercase">Duração:</span>
                {[120, 180].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setLocalDuration(sec)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      localDuration === sec
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-black/30 border-white/10 text-slate-300'
                    }`}
                  >
                    {sec / 60} min
                  </button>
                ))}
              </div>

              <button
                onClick={handleStartLocal2P}
                className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-2xl font-extrabold tracking-wide shadow-xl cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" /> JOGAR DE DOIS (LOCAL 1v1)
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SUPABASE LEADERBOARD & HISTORY */}
        {mainTab === 'ranking' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold text-white">
                  Ranking Geral de Jogadores
                </h2>
                <button
                  onClick={() => void fetchLeaderboard()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rankingLoading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2 pr-2">Jogador</th>
                      <th className="py-2 px-2 text-right">J</th>
                      <th className="py-2 px-2 text-right">V</th>
                      <th className="py-2 px-2 text-right">E</th>
                      <th className="py-2 px-2 text-right">D</th>
                      <th className="py-2 px-2 text-right">SG</th>
                      <th className="py-2 pl-2 text-right">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono-tabular">
                    {leaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                          Nenhum jogador encontrado no ranking ainda.
                        </td>
                      </tr>
                    ) : (
                      leaderboard.map((u, idx) => (
                        <tr
                          key={u.id}
                          className={u.userId === currentUserId ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200'}
                        >
                          <td className="py-2 pr-2 font-bold">{idx + 1}</td>
                          <td className="py-2 pr-2 font-sans">
                            <div className="font-bold text-white">{u.displayName}</div>
                          </td>
                          <td className="py-2 px-2 text-right">{u.matchesPlayed}</td>
                          <td className="py-2 px-2 text-right text-emerald-400">{u.wins}</td>
                          <td className="py-2 px-2 text-right">{u.draws}</td>
                          <td className="py-2 px-2 text-right text-rose-400">{u.losses}</td>
                          <td className="py-2 px-2 text-right">{u.goalsFor - u.goalsAgainst}</td>
                          <td className="py-2 pl-2 text-right font-extrabold text-amber-300">{u.points}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
              <h2 className="font-display text-2xl font-extrabold text-white">
                Últimos Confrontos 2P
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {recentMatches.length === 0 ? (
                  <div className="text-xs text-slate-400 py-8 text-center bg-black/25 rounded-xl border border-white/5">
                    Nenhuma partida 2P registrada ainda.
                  </div>
                ) : (
                  recentMatches.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-black/35 border border-white/10 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase">
                        <span>{m.mode === 'online_2p' ? `Online · Sala ${m.roomCode || ''}` : 'Local 1v1'}</span>
                        <span>{m.playedAt.slice(0, 16)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-white truncate">
                          {m.player1Name} ({m.homeTeamName})
                        </span>
                        <span className="font-mono-tabular font-black text-sm text-emerald-300 shrink-0">
                          {m.homeGoals} x {m.awayGoals}
                        </span>
                        <span className="font-bold text-white truncate text-right">
                          ({m.awayTeamName}) {m.player2Name}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
