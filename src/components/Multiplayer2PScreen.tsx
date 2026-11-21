import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Database,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  ActiveMatchConfig,
  MatchSettings,
  PublicUser,
  Team,
  TwoPlayerMatchRecord,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';

interface OpenRoomSummary {
  code: string;
  host_user_id: number;
  guest_user_id: number | null;
  host_team_id: string;
  away_team_id: string;
  duration_seconds: number;
  status: string;
  host_name?: string;
  guest_name?: string | null;
}

interface LobbyRoomState {
  code: string;
  hostUserId: number;
  hostName: string;
  guestUserId: number | null;
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
  authUser: PublicUser | null;
  authToken: string | null;
  onAuthChange: (user: PublicUser | null, token: string | null) => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

export const Multiplayer2PScreen: React.FC<Multiplayer2PScreenProps> = ({
  teams,
  settings,
  authUser,
  authToken,
  onAuthChange,
  onStartMatch,
  onBack,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [favTeamId, setFavTeamId] = useState(teams[0]?.id || 'fla');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [mainTab, setMainTab] = useState<'online' | 'local' | 'ranking'>(authUser ? 'online' : 'local');

  // Online Rooms State
  const [hostTeamId, setHostTeamId] = useState(authUser?.favoriteTeamId || teams[0]?.id || 'fla');
  const [onlineDuration, setOnlineDuration] = useState(120);
  const [openRooms, setOpenRooms] = useState<OpenRoomSummary[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [lobbyRoom, setLobbyRoom] = useState<LobbyRoomState | null>(null);
  const [lobbySide, setLobbySide] = useState<'home' | 'away'>('home');
  const [copiedCode, setCopiedCode] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Local 2P State
  const [p1TeamId, setP1TeamId] = useState(authUser?.favoriteTeamId || teams[0]?.id || 'fla');
  const [p2TeamId, setP2TeamId] = useState(teams[1]?.id || 'pal');
  const [p1GuestName, setP1GuestName] = useState('Jogador 1');
  const [p2GuestName, setP2GuestName] = useState('Jogador 2');
  const [localDuration, setLocalDuration] = useState(120);
  const [p2User, setP2User] = useState<PublicUser | null>(null);
  const [p2Mode, setP2Mode] = useState<'login' | 'register'>('login');
  const [p2Username, setP2Username] = useState('');
  const [p2DisplayName, setP2DisplayName] = useState('');
  const [p2Password, setP2Password] = useState('');
  const [p2Error, setP2Error] = useState<string | null>(null);
  const [p2Loading, setP2Loading] = useState(false);

  // Ranking & History State
  const [leaderboard, setLeaderboard] = useState<PublicUser[]>([]);
  const [recentMatches, setRecentMatches] = useState<TwoPlayerMatchRecord[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  useEffect(() => {
    if (authUser?.favoriteTeamId) {
      setHostTeamId(authUser.favoriteTeamId);
      setP1TeamId(authUser.favoriteTeamId);
    }
  }, [authUser]);

  const fetchOpenRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return;
      const data = (await res.json()) as { rooms?: OpenRoomSummary[] };
      setOpenRooms(data.rooms || []);
    } catch {
      // ignore
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setRankingLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) return;
      const data = (await res.json()) as {
        leaderboard?: PublicUser[];
        recentMatches?: TwoPlayerMatchRecord[];
      };
      setLeaderboard(data.leaderboard || []);
      setRecentMatches(data.recentMatches || []);
    } finally {
      setRankingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser && mainTab === 'online' && !lobbyRoom) {
      void fetchOpenRooms();
    } else if (mainTab === 'ranking') {
      void fetchLeaderboard();
    }
  }, [authUser, fetchLeaderboard, fetchOpenRooms, lobbyRoom, mainTab]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const endpoint = authTab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        authTab === 'login'
          ? { username, password }
          : { username, displayName: displayName || username, password, favoriteTeamId: favTeamId };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { user?: PublicUser; token?: string; error?: string };
      if (!res.ok || !data.user || !data.token) {
        setAuthError(data.error || 'Não foi possível autenticar.');
        return;
      }
      soundEngine.playTransferSuccess();
      onAuthChange(data.user, data.token);
      setPassword('');
    } catch {
      setAuthError('Erro de conexão com o servidor SQLite.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    soundEngine.playClick();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setLobbyRoom(null);
    setP2User(null);
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // ignore
      }
    }
    onAuthChange(null, null);
  };

  const connectLobbyWebSocket = (roomCode: string, token: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setOnlineError(null);
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      const hTeam = teams.find((t) => t.id === hostTeamId) || teams[0];
      const aTeam = teams.find((t) => t.id !== hTeam.id) || teams[1] || teams[0];
      ws.send(
        JSON.stringify({
          type: 'join_room',
          token,
          roomCode,
          homeTeamName: hTeam.name,
          awayTeamName: aTeam.name,
        })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data || '{}')) as Record<string, unknown>;
        if (msg.type === 'error') {
          setOnlineError(String(msg.message || 'Erro na sala.'));
        } else if (msg.type === 'joined') {
          setLobbySide(msg.side === 'away' ? 'away' : 'home');
        } else if (msg.type === 'lobby_state') {
          setLobbyRoom(msg.room as LobbyRoomState);
        } else if (msg.type === 'match_started') {
          const r = msg.room as LobbyRoomState;
          const homeT = teams.find((t) => t.id === r.homeTeamId) || teams[0];
          const awayT = teams.find((t) => t.id === r.awayTeamId) || teams[1] || teams[0];
          const mySide = authUser && r.hostUserId === authUser.id ? 'home' : 'away';

          ws.close();
          wsRef.current = null;
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
              token,
              side: mySide,
            },
            settings: {
              ...settings,
              format: 'online_2p',
              withGoalkeeper: false,
              durationSeconds: r.durationSeconds || 120,
              goalLimit: 0,
            },
          });
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      setOnlineError('Não foi possível conectar ao WebSocket da sala.');
    };
  };

  const handleCreateRoom = async () => {
    if (!authToken) return;
    setOnlineError(null);
    soundEngine.playClick();
    try {
      const awayDefault = teams.find((t) => t.id !== hostTeamId)?.id || 'pal';
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          hostTeamId,
          awayTeamId: awayDefault,
          durationSeconds: onlineDuration,
        }),
      });
      const data = (await res.json()) as { room?: OpenRoomSummary; error?: string };
      if (!res.ok || !data.room) {
        setOnlineError(data.error || 'Erro ao criar sala.');
        return;
      }
      connectLobbyWebSocket(data.room.code, authToken);
    } catch {
      setOnlineError('Falha ao criar sala no SQLite.');
    }
  };

  const handleJoinRoom = (code: string) => {
    if (!authToken) return;
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setOnlineError('Digite o código válido da sala.');
      return;
    }
    soundEngine.playClick();
    connectLobbyWebSocket(clean, authToken);
  };

  const handleSelectLobbyTeam = (teamId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const t = teams.find((x) => x.id === teamId);
    if (!t) return;
    soundEngine.playClick();
    wsRef.current.send(
      JSON.stringify({
        type: 'select_team',
        teamId: t.id,
        teamName: t.name,
      })
    );
  };

  const handleStartOnlineMatch = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !lobbyRoom) return;
    const hTeam = teams.find((t) => t.id === lobbyRoom.homeTeamId) || teams[0];
    const aTeam = teams.find((t) => t.id === lobbyRoom.awayTeamId) || teams[1] || teams[0];
    wsRef.current.send(
      JSON.stringify({
        type: 'start_match',
        homeTeamName: hTeam.name,
        awayTeamName: aTeam.name,
      })
    );
  };

  const handleP2VerifyOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setP2Error(null);
    setP2Loading(true);
    try {
      if (p2Mode === 'login') {
        const res = await fetch('/api/auth/verify-second-player', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: p2Username, password: p2Password }),
        });
        const data = (await res.json()) as { user?: PublicUser; error?: string };
        if (!res.ok || !data.user) {
          setP2Error(data.error || 'Usuário ou senha do Jogador 2 inválidos.');
          return;
        }
        if (authUser && data.user.id === authUser.id) {
          setP2Error('Escolha outra conta para o Jogador 2 (diferente do Jogador 1).');
          return;
        }
        soundEngine.playTransferSuccess();
        setP2User(data.user);
        setP2TeamId(data.user.favoriteTeamId || p2TeamId);
        setP2Password('');
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: p2Username,
            displayName: p2DisplayName || p2Username,
            password: p2Password,
            favoriteTeamId: p2TeamId,
          }),
        });
        const data = (await res.json()) as { user?: PublicUser; error?: string };
        if (!res.ok || !data.user) {
          setP2Error(data.error || 'Erro ao cadastrar Jogador 2.');
          return;
        }
        soundEngine.playTransferSuccess();
        setP2User(data.user);
        setP2Password('');
      }
    } catch {
      setP2Error('Erro ao consultar o banco SQLite.');
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
      player1Name: authUser?.displayName || p1GuestName.trim() || 'Jogador 1',
      player2Name: p2User?.displayName || p2GuestName.trim() || 'Jogador 2',
      player1UserId: authUser?.id || null,
      player2UserId: p2User?.id || null,
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
                if (wsRef.current) {
                  wsRef.current.close();
                  wsRef.current = null;
                }
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
                Modo 2 Jogadores · Contas SQLite
              </h1>
            </div>
          </div>

          {authUser && (
            <div className="flex items-center gap-2.5 bg-black/35 border border-emerald-500/30 rounded-xl px-3 py-1.5">
              <Database className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs leading-tight">
                <div className="font-bold text-white">{authUser.displayName}</div>
                <div className="text-[11px] text-slate-400 font-mono-tabular">
                  @{authUser.username} · {authUser.wins}V {authUser.draws}E {authUser.losses}D · {authUser.points} pts
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sair da conta"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Navigation Tabs (Local 2P always unlocked, no mandatory login!) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
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
              setMainTab('online');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              mainTab === 'online'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111D16] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" /> 2 Jogadores Online (Salas SQLite)
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
            <Trophy className="w-4 h-4" /> Ranking & Histórico SQLite
          </button>
        </div>

        {/* TAB 1: ONLINE 2P */}
        {mainTab === 'online' && !authUser && (
          <div className="max-w-md mx-auto bg-[#111D16] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="font-display text-3xl font-extrabold text-white">
                {authTab === 'login' ? 'Entrar com Usuário e Senha' : 'Criar Conta no SQLite'}
              </h2>
              <p className="text-xs text-slate-400">
                Entre para criar ou entrar em salas online. Para jogar no mesmo PC sem conta, use a aba <strong>2 Jogadores Local</strong> acima.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  authTab === 'login' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Já Tenho Conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  authTab === 'register' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Criar Nova Conta
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Nome de Usuário (login)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: craque10"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/45 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                />
              </div>

              {authTab === 'register' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Nome em Campo (apelido)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="ex: João Silva"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/45 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Senha (mín. 4 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-black/45 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authTab === 'register' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Clube Favorito
                  </label>
                  <select
                    value={favTeamId}
                    onChange={(e) => setFavTeamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/45 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#111D16]">
                        {t.name} ({t.shortCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {authError && (
                <div className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/35 rounded-xl px-3 py-2">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer transition-colors"
              >
                {authLoading
                  ? 'Salvando no SQLite...'
                  : authTab === 'login'
                    ? 'ENTRAR NO JOGO'
                    : 'CRIAR CONTA E ENTRAR'}
              </button>
            </form>
          </div>
        )}

        {mainTab === 'online' && authUser && (
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
                          Sala Online Conectada · WebSocket + SQLite
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
                        onClick={() => {
                          wsRef.current?.close();
                          wsRef.current = null;
                          setLobbyRoom(null);
                        }}
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
                                onChange={(e) => handleSelectLobbyTeam(e.target.value)}
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
                                onChange={(e) => handleSelectLobbyTeam(e.target.value)}
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
                        Envie o código <strong className="text-white">{lobbyRoom.code}</strong> para seu amigo entrar em outra aba ou dispositivo.
                      </span>
                      {lobbySide === 'home' ? (
                        <button
                          onClick={handleStartOnlineMatch}
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
                        Crie uma sala autenticada no SQLite e convide um amigo com o código de 6 letras.
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
                        onClick={handleCreateRoom}
                        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer"
                      >
                        CRIAR SALA 2 JOGADORES
                      </button>
                    </div>

                    {/* Join Room */}
                    <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-display text-2xl font-extrabold text-white">
                          Entrar em Sala Aberta
                        </h2>
                        <button
                          onClick={fetchOpenRooms}
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
                          onClick={() => handleJoinRoom(joinCodeInput)}
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
                                onClick={() => handleJoinRoom(rm.code)}
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
                    {authUser ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300">
                        <ShieldCheck className="w-4 h-4" /> Autenticado
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Modo Rápido (Sem Login)</span>
                    )}
                  </div>

                  {authUser ? (
                    <div className="p-3.5 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{authUser.displayName}</div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular">
                          @{authUser.username} · {authUser.wins}V {authUser.draws}E {authUser.losses}D
                        </div>
                      </div>
                      <ClubCrest team={teams.find((t) => t.id === p1TeamId) || teams[0]} size={40} />
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Nome do Jogador 1
                        </label>
                        <input
                          type="text"
                          value={p1GuestName}
                          onChange={(e) => setP1GuestName(e.target.value)}
                          placeholder="Jogador 1"
                          maxLength={18}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/45 border border-white/15 text-xs text-white focus:border-emerald-400 outline-none"
                        />
                      </div>
                      <ClubCrest team={teams.find((t) => t.id === p1TeamId) || teams[0]} size={40} />
                    </div>
                  )}

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
                        Trocar Conta J2
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Opcional: entrar para pontuar</span>
                    )}
                  </div>

                  {p2User ? (
                    <div className="p-3.5 rounded-xl bg-black/35 border border-amber-400/30 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                          <UserCheck className="w-4 h-4 text-amber-400" /> {p2User.displayName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular">
                          @{p2User.username} · {p2User.wins}V {p2User.draws}E {p2User.losses}D
                        </div>
                      </div>
                      <ClubCrest team={teams.find((t) => t.id === p2TeamId) || teams[1] || teams[0]} size={40} />
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Nome do Jogador 2 (Sem Login)
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

                      <form onSubmit={handleP2VerifyOrRegister} className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-300">Opcional: Conectar Conta J2 (SQLite)</span>
                          <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setP2Mode('login');
                              setP2Error(null);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                              p2Mode === 'login' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            Entrar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setP2Mode('register');
                              setP2Error(null);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                              p2Mode === 'register' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            <UserPlus className="w-3 h-3 inline mr-1" />Criar J2
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={p2Username}
                          onChange={(e) => setP2Username(e.target.value)}
                          placeholder="Usuário J2"
                          className="px-3 py-2 rounded-lg bg-black/45 border border-white/15 text-xs text-white outline-none"
                        />
                        <input
                          type="password"
                          required
                          minLength={4}
                          value={p2Password}
                          onChange={(e) => setP2Password(e.target.value)}
                          placeholder="Senha J2"
                          className="px-3 py-2 rounded-lg bg-black/45 border border-white/15 text-xs text-white outline-none"
                        />
                      </div>

                      {p2Mode === 'register' && (
                        <input
                          type="text"
                          value={p2DisplayName}
                          onChange={(e) => setP2DisplayName(e.target.value)}
                          placeholder="Nome de exibição do Jogador 2"
                          className="w-full px-3 py-2 rounded-lg bg-black/45 border border-white/15 text-xs text-white outline-none"
                        />
                      )}

                      {p2Error && <div className="text-[11px] text-rose-300">{p2Error}</div>}

                      <button
                        type="submit"
                        disabled={p2Loading}
                        className="w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        {p2Loading ? 'Verificando...' : p2Mode === 'login' ? 'Conectar Jogador 2 com Senha' : 'Cadastrar Jogador 2 no SQLite'}
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

            {/* TAB 3: SQLITE LEADERBOARD & HISTORY */}
            {mainTab === 'ranking' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-2xl font-extrabold text-white">
                      Ranking Geral de Jogadores (SQLite)
                    </h2>
                    <button
                      onClick={fetchLeaderboard}
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
                              Nenhum usuário registrado ainda.
                            </td>
                          </tr>
                        ) : (
                          leaderboard.map((u, idx) => (
                            <tr
                              key={u.id}
                              className={authUser && u.id === authUser.id ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200'}
                            >
                              <td className="py-2 pr-2 font-bold">{idx + 1}</td>
                              <td className="py-2 pr-2 font-sans">
                                <div className="font-bold text-white">{u.displayName}</div>
                                <div className="text-[10px] text-slate-400">@{u.username}</div>
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
                        Nenhuma partida 2P registrada no SQLite ainda.
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
