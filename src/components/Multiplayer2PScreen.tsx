import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Cloud,
  Copy,
  Globe,
  Layers,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  ActiveMatchConfig,
  CrestShape,
  CustomOnlineTeam,
  CustomTeamInvite,
  FriendRelation,
  GameInvite,
  JogadorProfile,
  KitPattern,
  MatchSettings,
  OnlineLeague,
  PublicUser,
  Team,
  TwoPlayerMatchRecord,
} from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';
import {
  respondCustomTeamInvite,
  sendCustomTeamInvite,
} from '../utils/socialSupabase';
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
import {
  createOnlineLeague,
  customOnlineTeamToTeam,
  fetchOnlineLeagues,
  joinOnlineLeague,
  sortLeagueMembers,
} from '../utils/onlineLeagues';

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
  customHomeTeam?: Team;
  customAwayTeam?: Team;
  onlineLeagueId?: string;
  onlineLeagueName?: string;
  durationSeconds: number;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
}

interface Multiplayer2PScreenProps {
  teams: Team[];
  settings: MatchSettings;
  jogadorProfile: JogadorProfile;
  customOnlineTeams: CustomOnlineTeam[];
  friends?: FriendRelation[];
  registeredPlayers?: PublicUser[];
  gameInvites?: GameInvite[];
  teamInvites?: CustomTeamInvite[];
  initialRoomCodeToJoin?: string | null;
  onConsumeInitialRoomCode?: () => void;
  onRefreshSocial?: () => Promise<void>;
  onInviteFriendToRoom?: (friend: FriendRelation, roomCode: string, teamName: string) => Promise<void>;
  onOpenFriendsModal?: () => void;
  onUpdateCustomOnlineTeams: (next: CustomOnlineTeam[]) => void;
  onStartMatch: (config: ActiveMatchConfig) => void;
  onBack: () => void;
}

const CREST_SHAPES: { id: CrestShape; label: string }[] = [
  { id: 'shield', label: 'Escudo Clássico' },
  { id: 'circle', label: 'Circular' },
  { id: 'diamond', label: 'Diamante' },
  { id: 'hexagon', label: 'Hexágono' },
];

const KIT_PATTERNS: { id: KitPattern; label: string }[] = [
  { id: 'solid', label: 'Liso' },
  { id: 'vertical_stripes', label: 'Listras Verticais' },
  { id: 'horizontal_hoops', label: 'Listras Horizontais' },
  { id: 'halves', label: 'Meio a Meio' },
  { id: 'sash', label: 'Faixa Diagonal' },
  { id: 'double_border', label: 'Anel / Borda' },
];

const TEAM_COLOR_PRESETS = [
  { name: 'Rubro-Negro', p: '#DC2626', s: '#111827', t: '#FFFFFF' },
  { name: 'Alviverde', p: '#15803D', s: '#FFFFFF', t: '#FFFFFF' },
  { name: 'Celeste', p: '#0284C7', s: '#FFFFFF', t: '#FFFFFF' },
  { name: 'Aurinegro', p: '#FACC15', s: '#18181B', t: '#09090B' },
  { name: 'Violeta', p: '#7C3AED', s: '#EC4899', t: '#FFFFFF' },
  { name: 'Tricolor', p: '#E11D48', s: '#0F172A', t: '#FFFFFF' },
];

export const Multiplayer2PScreen: React.FC<Multiplayer2PScreenProps> = ({
  teams,
  settings,
  jogadorProfile,
  customOnlineTeams,
  friends = [],
  registeredPlayers = [],
  gameInvites = [],
  teamInvites = [],
  initialRoomCodeToJoin = null,
  onConsumeInitialRoomCode,
  onRefreshSocial,
  onInviteFriendToRoom,
  onOpenFriendsModal,
  onUpdateCustomOnlineTeams,
  onStartMatch,
  onBack,
}) => {
  const currentUser = profileToPublicUser(jogadorProfile);
  const currentUserId = jogadorProfile.user_id || String(jogadorProfile.id || jogadorProfile.nome);

  const [mainTab, setMainTab] = useState<'online' | 'leagues' | 'teams' | 'local' | 'ranking'>('online');

  const customTeamsAsTeams = useMemo(
    () => customOnlineTeams.map((ct) => customOnlineTeamToTeam(ct)),
    [customOnlineTeams]
  );

  const allAvailableTeams = useMemo(
    () => [...customTeamsAsTeams, ...teams],
    [customTeamsAsTeams, teams]
  );

  // Online Rooms State (Supabase)
  const [hostTeamId, setHostTeamId] = useState(
    customTeamsAsTeams[0]?.id || jogadorProfile.time_favorito || teams[0]?.id || 'fla'
  );
  const [onlineDuration, setOnlineDuration] = useState(120);
  const [openRooms, setOpenRooms] = useState<SupabaseRoomRow[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [lobbyRoom, setLobbyRoom] = useState<LobbyRoomState | null>(null);
  const [lobbySide, setLobbySide] = useState<'home' | 'away'>('home');
  const [copiedCode, setCopiedCode] = useState(false);
  const [roomInviteNotice, setRoomInviteNotice] = useState<string | null>(null);
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null);

  // Custom Team Builder State
  const [teamName, setTeamName] = useState('');
  const [teamShortCode, setTeamShortCode] = useState('');
  const [teamCrestShape, setTeamCrestShape] = useState<CrestShape>('shield');
  const [teamPattern, setTeamPattern] = useState<KitPattern>('vertical_stripes');
  const [teamPrimary, setTeamPrimary] = useState('#10B981');
  const [teamSecondary, setTeamSecondary] = useState('#0F172A');
  const [teamTextColor, setTeamTextColor] = useState('#FFFFFF');
  const [teamFeedback, setTeamFeedback] = useState<string | null>(null);
  const [inviteTargetByTeam, setInviteTargetByTeam] = useState<Record<string, string>>({});

  // Online Leagues State
  const [leagues, setLeagues] = useState<OnlineLeague[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [selectedLeagueCode, setSelectedLeagueCode] = useState<string | null>(null);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueMaxTeams, setNewLeagueMaxTeams] = useState(8);
  const [newLeagueDuration, setNewLeagueDuration] = useState(120);
  const [leagueTeamId, setLeagueTeamId] = useState(
    customTeamsAsTeams[0]?.id || jogadorProfile.time_favorito || teams[0]?.id || 'fla'
  );
  const [joinLeagueCode, setJoinLeagueCode] = useState('');
  const [leagueMessage, setLeagueMessage] = useState<string | null>(null);
  const [leagueError, setLeagueError] = useState<string | null>(null);

  // Local 2P State
  const [p1TeamId, setP1TeamId] = useState(
    customTeamsAsTeams[0]?.id || jogadorProfile.time_favorito || teams[0]?.id || 'fla'
  );
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

  const previewCustomTeam: Team = useMemo(
    () =>
      customOnlineTeamToTeam({
        id: 'preview-custom',
        ownerUserId: currentUserId,
        ownerName: currentUser.displayName,
        name: teamName.trim() || 'Meu Clube FC',
        shortCode: (teamShortCode.trim() || teamName.trim().slice(0, 3) || 'MCF').toUpperCase(),
        crestShape: teamCrestShape,
        pattern: teamPattern,
        primaryColor: teamPrimary,
        secondaryColor: teamSecondary,
        textColor: teamTextColor,
        ovr: 80,
        createdAt: new Date().toISOString(),
      }),
    [
      currentUser.displayName,
      currentUserId,
      teamCrestShape,
      teamName,
      teamPattern,
      teamPrimary,
      teamSecondary,
      teamShortCode,
      teamTextColor,
    ]
  );

  const findTeamAny = useCallback(
    (teamId: string, customOverride?: Team): Team => {
      if (customOverride && customOverride.id === teamId) return customOverride;
      return allAvailableTeams.find((t) => t.id === teamId) || teams[0];
    },
    [allAvailableTeams, teams]
  );

  const rowToLobbyState = useCallback(
    (row: SupabaseRoomRow, extra?: { onlineLeagueId?: string; onlineLeagueName?: string }): LobbyRoomState => {
      const homeT = findTeamAny(row.host_team_id);
      const awayT = findTeamAny(row.away_team_id);
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
        customHomeTeam: row.host_team_id.startsWith('cot-') ? homeT : undefined,
        customAwayTeam: row.away_team_id.startsWith('cot-') ? awayT : undefined,
        onlineLeagueId: extra?.onlineLeagueId,
        onlineLeagueName: extra?.onlineLeagueName,
        durationSeconds: row.duration_seconds || 120,
        status: row.status,
      };
    },
    [findTeamAny]
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

  const refreshLeagues = useCallback(async () => {
    setLeaguesLoading(true);
    try {
      const list = await fetchOnlineLeagues();
      setLeagues(list);
      setSelectedLeagueCode((prev) => prev || list[0]?.code || null);
    } finally {
      setLeaguesLoading(false);
    }
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
    } else if (mainTab === 'leagues') {
      void refreshLeagues();
    } else if (mainTab === 'ranking') {
      void fetchLeaderboard();
    }
  }, [fetchLeaderboard, fetchOpenRooms, lobbyRoom, mainTab, refreshLeagues]);

  useEffect(() => {
    return () => {
      cleanupLobbyChannel();
    };
  }, [cleanupLobbyChannel]);

  const launchOnlineMatchFromRoom = useCallback(
    (r: LobbyRoomState, mySide: 'home' | 'away') => {
      const homeT = findTeamAny(r.homeTeamId, r.customHomeTeam);
      const awayT = findTeamAny(r.awayTeamId, r.customAwayTeam);

      cleanupLobbyChannel();
      setLobbyRoom(null);

      soundEngine.playWhistle(false);
      onStartMatch({
        tournament: 'friendly',
        tournamentLabel: r.onlineLeagueName
          ? `Liga Online · ${r.onlineLeagueName} (Sala ${r.code})`
          : `Duelo Online 2P · Sala ${r.code}`,
        homeTeam: homeT,
        awayTeam: awayT,
        humanSide: mySide,
        player1Name: r.hostName,
        player2Name: r.guestName || 'Visitante',
        player1UserId: r.hostUserId,
        player2UserId: r.guestUserId,
        onlineLeagueId: r.onlineLeagueId,
        onlineLeagueName: r.onlineLeagueName,
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
    [cleanupLobbyChannel, currentUserId, findTeamAny, onStartMatch, settings]
  );

  const subscribeToLobbyRoom = useCallback(
    (
      initialRow: SupabaseRoomRow,
      mySide: 'home' | 'away',
      extra?: { onlineLeagueId?: string; onlineLeagueName?: string }
    ) => {
      const client = getSupabaseClient();
      if (!client) return;

      cleanupLobbyChannel();
      setLobbySide(mySide);
      const initialLobby = rowToLobbyState(initialRow, extra);
      setLobbyRoom(initialLobby);

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
            setLobbyRoom((prev) => {
              const base = rowToLobbyState(updated, {
                onlineLeagueId: prev?.onlineLeagueId,
                onlineLeagueName: prev?.onlineLeagueName,
              });
              const merged: LobbyRoomState = {
                ...base,
                customHomeTeam: prev?.customHomeTeam || base.customHomeTeam,
                customAwayTeam: prev?.customAwayTeam || base.customAwayTeam,
              };
              if (updated.status === 'playing') {
                launchOnlineMatchFromRoom(merged, mySide);
              }
              return merged;
            });
          }
        )
        .on('broadcast', { event: 'match_started' }, ({ payload }) => {
          const roomPayload = (payload as { room?: LobbyRoomState })?.room;
          if (roomPayload) {
            launchOnlineMatchFromRoom(roomPayload, mySide);
          }
        })
        .on('broadcast', { event: 'team_changed' }, ({ payload }) => {
          const p = payload as {
            side?: 'home' | 'away';
            teamId?: string;
            teamName?: string;
            customTeam?: Team;
            onlineLeagueId?: string;
            onlineLeagueName?: string;
          };
          if (!p?.teamId) return;
          setLobbyRoom((prev) => {
            if (!prev) return prev;
            return p.side === 'home'
              ? {
                  ...prev,
                  homeTeamId: p.teamId!,
                  homeTeamName: p.teamName || prev.homeTeamName,
                  customHomeTeam: p.customTeam || prev.customHomeTeam,
                  onlineLeagueId: p.onlineLeagueId || prev.onlineLeagueId,
                  onlineLeagueName: p.onlineLeagueName || prev.onlineLeagueName,
                }
              : {
                  ...prev,
                  awayTeamId: p.teamId!,
                  awayTeamName: p.teamName || prev.awayTeamName,
                  customAwayTeam: p.customTeam || prev.customAwayTeam,
                  onlineLeagueId: p.onlineLeagueId || prev.onlineLeagueId,
                  onlineLeagueName: p.onlineLeagueName || prev.onlineLeagueName,
                };
          });
        })
        .subscribe();

      lobbyChannelRef.current = ch;

      // Announce our custom team right away if we joined with one
      const myTeamId = mySide === 'home' ? initialRow.host_team_id : initialRow.away_team_id;
      const myTeam = allAvailableTeams.find((t) => t.id === myTeamId);
      if (myTeam && (myTeamId.startsWith('cot-') || extra?.onlineLeagueId)) {
        setTimeout(() => {
          void ch.send({
            type: 'broadcast',
            event: 'team_changed',
            payload: {
              side: mySide,
              teamId: myTeam.id,
              teamName: myTeam.name,
              customTeam: myTeamId.startsWith('cot-') ? myTeam : undefined,
              onlineLeagueId: extra?.onlineLeagueId,
              onlineLeagueName: extra?.onlineLeagueName,
            },
          });
        }, 350);
      }
    },
    [allAvailableTeams, cleanupLobbyChannel, launchOnlineMatchFromRoom, rowToLobbyState]
  );

  const handleCreateRoom = async (opts?: {
    teamIdOverride?: string;
    durationOverride?: number;
    onlineLeagueId?: string;
    onlineLeagueName?: string;
  }) => {
    setOnlineError(null);
    soundEngine.playClick();
    setCreatingRoom(true);
    try {
      const chosenHostTeamId = opts?.teamIdOverride || hostTeamId;
      const awayDefault = allAvailableTeams.find((t) => t.id !== chosenHostTeamId)?.id || 'pal';
      const { room, error } = await createSupabaseRoom({
        hostUserId: currentUserId,
        hostName: currentUser.displayName,
        hostTeamId: chosenHostTeamId,
        awayTeamId: awayDefault,
        durationSeconds: opts?.durationOverride || onlineDuration,
      });
      if (error || !room) {
        setOnlineError(error || 'Não foi possível criar a sala.');
        return;
      }
      setMainTab('online');
      subscribeToLobbyRoom(room, 'home', {
        onlineLeagueId: opts?.onlineLeagueId,
        onlineLeagueName: opts?.onlineLeagueName,
      });
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
    const t = allAvailableTeams.find((x) => x.id === teamId);
    if (!t) return;
    soundEngine.playClick();
    const isCustom = t.id.startsWith('cot-');

    setLobbyRoom((prev) => {
      if (!prev) return prev;
      return lobbySide === 'home'
        ? {
            ...prev,
            homeTeamId: t.id,
            homeTeamName: t.name,
            customHomeTeam: isCustom ? t : undefined,
          }
        : {
            ...prev,
            awayTeamId: t.id,
            awayTeamName: t.name,
            customAwayTeam: isCustom ? t : undefined,
          };
    });

    await updateSupabaseRoom(
      lobbyRoom.code,
      lobbySide === 'home' ? { host_team_id: t.id } : { away_team_id: t.id }
    );
    await lobbyChannelRef.current?.send({
      type: 'broadcast',
      event: 'team_changed',
      payload: {
        side: lobbySide,
        teamId: t.id,
        teamName: t.name,
        customTeam: isCustom ? t : undefined,
        onlineLeagueId: lobbyRoom.onlineLeagueId,
        onlineLeagueName: lobbyRoom.onlineLeagueName,
      },
    });
  };

  const handleStartOnlineMatch = async () => {
    if (!lobbyRoom || !lobbyRoom.guestUserId) return;
    const readyRoom: LobbyRoomState = {
      ...lobbyRoom,
      customHomeTeam: lobbyRoom.customHomeTeam || (lobbyRoom.homeTeamId.startsWith('cot-') ? findTeamAny(lobbyRoom.homeTeamId) : undefined),
      customAwayTeam: lobbyRoom.customAwayTeam || (lobbyRoom.awayTeamId.startsWith('cot-') ? findTeamAny(lobbyRoom.awayTeamId) : undefined),
      status: 'playing',
    };
    await updateSupabaseRoom(lobbyRoom.code, { status: 'playing' });
    await lobbyChannelRef.current?.send({
      type: 'broadcast',
      event: 'match_started',
      payload: { room: readyRoom },
    });
    launchOnlineMatchFromRoom(readyRoom, 'home');
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

  // ================= CUSTOM ONLINE TEAM CREATION =================
  const handleSaveCustomTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = teamName.trim().slice(0, 26);
    if (cleanName.length < 2) {
      setTeamFeedback('Digite um nome com pelo menos 2 letras para o seu time.');
      return;
    }
    const cleanCode = (
      teamShortCode.trim() || cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3) || 'CLB'
    )
      .toUpperCase()
      .slice(0, 4);

    const nowIso = new Date().toISOString();
    const newTeam: CustomOnlineTeam = {
      id: `cot-${Date.now().toString(36)}`,
      ownerUserId: currentUserId,
      ownerName: currentUser.displayName,
      name: cleanName,
      shortCode: cleanCode,
      crestShape: teamCrestShape,
      pattern: teamPattern,
      primaryColor: teamPrimary,
      secondaryColor: teamSecondary,
      textColor: teamTextColor,
      ovr: 80,
      members: [
        {
          userId: currentUserId,
          name: currentUser.displayName,
          role: 'captain',
          joinedAt: nowIso,
        },
      ],
      createdAt: nowIso,
    };

    soundEngine.playTransferSuccess();
    const nextList = [newTeam, ...customOnlineTeams];
    onUpdateCustomOnlineTeams(nextList);
    setHostTeamId(newTeam.id);
    setLeagueTeamId(newTeam.id);
    setTeamName('');
    setTeamShortCode('');
    setTeamFeedback(`Time "${newTeam.name}" (${newTeam.shortCode}) criado e salvo na sua conta!`);
  };

  useEffect(() => {
    if (!initialRoomCodeToJoin) return;
    const code = initialRoomCodeToJoin;
    onConsumeInitialRoomCode?.();
    setMainTab('online');
    void handleJoinRoom(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoomCodeToJoin]);

  const acceptedFriends = useMemo(
    () => friends.filter((f) => f.status === 'accepted'),
    [friends]
  );

  const invitablePlayers = useMemo(() => {
    const map = new Map<string, PublicUser>();
    for (const f of acceptedFriends) {
      map.set(f.friendUserId, {
        id: f.friendUserId,
        userId: f.friendUserId,
        username: f.friendName,
        displayName: `${f.friendName} (Amigo)`,
        favoriteTeamId: f.friendFavoriteTeamId,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        matchesPlayed: 0,
      });
    }
    for (const p of registeredPlayers) {
      const pid = p.userId || String(p.id);
      if (pid === currentUserId) continue;
      if (!map.has(pid)) map.set(pid, p);
    }
    return Array.from(map.values());
  }, [acceptedFriends, currentUserId, registeredPlayers]);

  const pendingTeamInvites = useMemo(
    () =>
      teamInvites.filter(
        (ti) => ti.targetUserId === currentUserId && ti.status === 'pending'
      ),
    [currentUserId, teamInvites]
  );

  const handleInvitePlayerToTeam = async (ct: CustomOnlineTeam) => {
    const selectedId =
      inviteTargetByTeam[ct.id] ||
      (invitablePlayers[0] ? invitablePlayers[0].userId || String(invitablePlayers[0].id) : '');
    const target = invitablePlayers.find(
      (p) => (p.userId || String(p.id)) === selectedId
    );
    if (!target) {
      setTeamFeedback('Nenhum outro jogador cadastrado encontrado para convidar.');
      return;
    }
    soundEngine.playClick();
    const cleanTarget: PublicUser = {
      ...target,
      displayName: target.displayName.replace(/\s*\(Amigo\)$/, ''),
    };
    const { error } = await sendCustomTeamInvite({
      team: ct,
      ownerUserId: currentUserId,
      ownerName: currentUser.displayName,
      target: cleanTarget,
    });
    if (error) {
      setTeamFeedback(error);
      return;
    }
    soundEngine.playTransferSuccess();
    setTeamFeedback(`Convite enviado para ${cleanTarget.displayName} entrar no time ${ct.name}!`);
    await onRefreshSocial?.();
  };

  const handleRespondTeamInvite = async (inv: CustomTeamInvite, accept: boolean) => {
    soundEngine.playClick();
    const ok = await respondCustomTeamInvite(inv.id, accept);
    if (!ok) return;
    if (accept) {
      soundEngine.playTransferSuccess();
      const exists = customOnlineTeams.some((t) => t.id === inv.teamId);
      if (!exists) {
        const joinedTeam: CustomOnlineTeam = {
          id: inv.teamId,
          ownerUserId: inv.ownerUserId,
          ownerName: inv.ownerName,
          name: inv.teamName,
          shortCode: inv.teamShortCode,
          crestShape: inv.crestShape,
          pattern: inv.pattern,
          primaryColor: inv.primaryColor,
          secondaryColor: inv.secondaryColor,
          textColor: inv.textColor,
          ovr: 80,
          members: [
            {
              userId: inv.ownerUserId,
              name: inv.ownerName,
              role: 'captain',
              joinedAt: inv.createdAt,
            },
            {
              userId: currentUserId,
              name: currentUser.displayName,
              role: 'member',
              joinedAt: new Date().toISOString(),
            },
          ],
          createdAt: inv.createdAt,
        };
        onUpdateCustomOnlineTeams([joinedTeam, ...customOnlineTeams]);
      }
      setTeamFeedback(`Você entrou no time "${inv.teamName}"!`);
    }
    await onRefreshSocial?.();
  };

  const handleDeleteCustomTeam = (teamId: string) => {
    soundEngine.playClick();
    const nextList = customOnlineTeams.filter((t) => t.id !== teamId);
    onUpdateCustomOnlineTeams(nextList);
    if (hostTeamId === teamId) setHostTeamId(nextList[0]?.id || teams[0]?.id || 'fla');
    if (leagueTeamId === teamId) setLeagueTeamId(nextList[0]?.id || teams[0]?.id || 'fla');
  };

  // ================= ONLINE LEAGUES HANDLERS =================
  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeagueError(null);
    setLeagueMessage(null);
    const cleanName = newLeagueName.trim();
    if (cleanName.length < 3) {
      setLeagueError('Digite um nome com pelo menos 3 caracteres para a Liga Online.');
      return;
    }
    const pickedTeam = findTeamAny(leagueTeamId);
    const customRef = customOnlineTeams.find((ct) => ct.id === pickedTeam.id);

    soundEngine.playTransferSuccess();
    const { league, syncedOnline } = await createOnlineLeague({
      name: cleanName,
      maxTeams: newLeagueMaxTeams,
      durationSeconds: newLeagueDuration,
      ownerUserId: currentUserId,
      ownerName: currentUser.displayName,
      team: pickedTeam,
      customTeam: customRef,
    });

    setNewLeagueName('');
    setLeagues((prev) => [league, ...prev.filter((l) => l.code !== league.code)]);
    setSelectedLeagueCode(league.code);
    setLeagueMessage(
      syncedOnline
        ? `Liga "${league.name}" criada no Supabase! Compartilhe o código ${league.code}.`
        : `Liga "${league.name}" salva localmente! Código: ${league.code}.`
    );
  };

  const handleJoinLeague = async (codeToJoin: string) => {
    setLeagueError(null);
    setLeagueMessage(null);
    const pickedTeam = findTeamAny(leagueTeamId);
    const customRef = customOnlineTeams.find((ct) => ct.id === pickedTeam.id);

    soundEngine.playClick();
    const { league, error } = await joinOnlineLeague({
      code: codeToJoin,
      userId: currentUserId,
      userName: currentUser.displayName,
      team: pickedTeam,
      customTeam: customRef,
    });

    if (error || !league) {
      setLeagueError(error || 'Não foi possível entrar na liga.');
      return;
    }

    soundEngine.playTransferSuccess();
    setJoinLeagueCode('');
    setLeagues((prev) => [league, ...prev.filter((l) => l.code !== league.code)]);
    setSelectedLeagueCode(league.code);
    setLeagueMessage(`Você entrou na liga "${league.name}" com o time ${pickedTeam.name}!`);
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
    const hTeam = findTeamAny(p1TeamId);
    const aTeam = findTeamAny(p2TeamId);
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

  const selectedLeague = leagues.find((l) => l.code === selectedLeagueCode) || leagues[0] || null;

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
              <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white tracking-wide">
                Modo Online · Times, Ligas & Salas 2P
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenFriendsModal && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onOpenFriendsModal();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-white whitespace-nowrap cursor-pointer"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Amigos ({acceptedFriends.length})</span>
                {gameInvites.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                    {gameInvites.length}
                  </span>
                )}
              </button>
            )}

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
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              mainTab === 'online'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111D16] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" /> Salas 2P Online
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setMainTab('leagues');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              mainTab === 'leagues'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111D16] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" /> Ligas Online
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setMainTab('teams');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              mainTab === 'teams'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111D16] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" /> Criar Times ({customOnlineTeams.length})
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setMainTab('local');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              mainTab === 'local'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111D16] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> 2 Jogadores Local
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setMainTab('ranking');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
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
                      {lobbyRoom.onlineLeagueName
                        ? `Partida da Liga Online: ${lobbyRoom.onlineLeagueName}`
                        : 'Sala Online Conectada · Supabase Realtime'}
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
                        team={findTeamAny(lobbyRoom.homeTeamId, lobbyRoom.customHomeTeam)}
                        size={44}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">
                          {lobbyRoom.customHomeTeam?.name ||
                            findTeamAny(lobbyRoom.homeTeamId, lobbyRoom.customHomeTeam).name}
                        </div>
                        {lobbySide === 'home' && (
                          <select
                            value={lobbyRoom.homeTeamId}
                            onChange={(e) => void handleSelectLobbyTeam(e.target.value)}
                            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[#0D1612] border border-white/15 text-xs text-white"
                          >
                            {customTeamsAsTeams.length > 0 && (
                              <optgroup label="Meus Times Criados">
                                {customTeamsAsTeams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    ★ {t.name} ({t.shortCode})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Clubes Oficiais">
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.ovr})
                                </option>
                              ))}
                            </optgroup>
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
                        team={findTeamAny(lobbyRoom.awayTeamId, lobbyRoom.customAwayTeam)}
                        size={44}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">
                          {lobbyRoom.customAwayTeam?.name ||
                            findTeamAny(lobbyRoom.awayTeamId, lobbyRoom.customAwayTeam).name}
                        </div>
                        {lobbySide === 'away' && (
                          <select
                            value={lobbyRoom.awayTeamId}
                            onChange={(e) => void handleSelectLobbyTeam(e.target.value)}
                            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[#0D1612] border border-white/15 text-xs text-white"
                          >
                            {customTeamsAsTeams.length > 0 && (
                              <optgroup label="Meus Times Criados">
                                {customTeamsAsTeams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    ★ {t.name} ({t.shortCode})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Clubes Oficiais">
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.ovr})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-400">
                    Envie o código <strong className="text-white">{lobbyRoom.code}</strong> para seu adversário entrar em outro dispositivo.
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

                {lobbySide === 'home' && !lobbyRoom.guestUserId && acceptedFriends.length > 0 && onInviteFriendToRoom && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="text-xs font-bold text-emerald-300">
                      Convidar Amigo para Jogar Juntos nesta Sala:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {acceptedFriends.map((friend) => (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={async () => {
                            soundEngine.playClick();
                            await onInviteFriendToRoom(friend, lobbyRoom.code, lobbyRoom.homeTeamName);
                            setRoomInviteNotice(`Convite enviado para ${friend.friendName}!`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-bold text-emerald-200 cursor-pointer"
                        >
                          Convidar {friend.friendName}
                        </button>
                      ))}
                    </div>
                    {roomInviteNotice && (
                      <div className="text-xs text-amber-300">{roomInviteNotice}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Create Room */}
                <div className="lg:col-span-5 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-2xl font-extrabold text-white">
                      Criar Sala Online 2P
                    </h2>
                    <button
                      type="button"
                      onClick={() => setMainTab('teams')}
                      className="text-[11px] font-bold text-emerald-300 hover:underline cursor-pointer"
                    >
                      + Criar meu time
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Crie uma sala sincronizada via Supabase Realtime usando seu time criado ou qualquer clube oficial.
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
                      {customTeamsAsTeams.length > 0 && (
                        <optgroup label="Meus Times Criados">
                          {customTeamsAsTeams.map((t) => (
                            <option key={t.id} value={t.id} className="bg-[#111D16]">
                              ★ {t.name} ({t.shortCode} · OVR {t.ovr})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Clubes Oficiais">
                        {teams.map((t) => (
                          <option key={t.id} value={t.id} className="bg-[#111D16]">
                            {t.name} ({t.shortCode} · OVR {t.ovr})
                          </option>
                        ))}
                      </optgroup>
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

        {/* TAB 2: LIGAS ONLINE */}
        {mainTab === 'leagues' && (
          <div className="space-y-5">
            {leagueError && (
              <div className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/35 rounded-xl px-4 py-2.5">
                {leagueError}
              </div>
            )}
            {leagueMessage && (
              <div className="text-xs text-emerald-200 bg-emerald-500/15 border border-emerald-400/35 rounded-xl px-4 py-2.5">
                {leagueMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Create or Join League */}
              <div className="lg:col-span-5 space-y-5">
                <form
                  onSubmit={handleCreateLeague}
                  className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-2xl font-extrabold text-white">
                      Criar Liga Online
                    </h2>
                    <button
                      type="button"
                      onClick={() => setMainTab('teams')}
                      className="text-[11px] font-bold text-emerald-300 hover:underline cursor-pointer"
                    >
                      + Novo Time
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Nome da Liga
                    </label>
                    <input
                      type="text"
                      value={newLeagueName}
                      onChange={(e) => setNewLeagueName(e.target.value)}
                      placeholder="Ex: Liga dos Craques 2027"
                      maxLength={36}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Seu Time na Liga
                    </label>
                    <select
                      value={leagueTeamId}
                      onChange={(e) => setLeagueTeamId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white"
                    >
                      {customTeamsAsTeams.length > 0 && (
                        <optgroup label="Meus Times Criados">
                          {customTeamsAsTeams.map((t) => (
                            <option key={t.id} value={t.id} className="bg-[#111D16]">
                              ★ {t.name} ({t.shortCode})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Clubes Oficiais">
                        {teams.map((t) => (
                          <option key={t.id} value={t.id} className="bg-[#111D16]">
                            {t.name} ({t.shortCode} · OVR {t.ovr})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Vagas
                      </label>
                      <select
                        value={newLeagueMaxTeams}
                        onChange={(e) => setNewLeagueMaxTeams(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                      >
                        {[4, 6, 8, 12].map((n) => (
                          <option key={n} value={n} className="bg-[#111D16]">
                            {n} Times
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Tempo de Jogo
                      </label>
                      <select
                        value={newLeagueDuration}
                        onChange={(e) => setNewLeagueDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                      >
                        <option value={120} className="bg-[#111D16]">2 Minutos</option>
                        <option value={180} className="bg-[#111D16]">3 Minutos</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> CRIAR LIGA ONLINE
                  </button>
                </form>

                {/* Join League by Code + List */}
                <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold text-white">
                      Entrar ou Selecionar Liga
                    </h3>
                    <button
                      onClick={() => void refreshLeagues()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${leaguesLoading ? 'animate-spin' : ''}`} />
                      Atualizar
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinLeagueCode}
                      onChange={(e) => setJoinLeagueCode(e.target.value.toUpperCase())}
                      placeholder="Código (ex: LG4821)"
                      maxLength={8}
                      className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs font-mono-tabular uppercase text-white outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => void handleJoinLeague(joinLeagueCode)}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Entrar
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {leagues.length === 0 ? (
                      <div className="text-xs text-slate-400 py-6 text-center bg-black/25 rounded-xl">
                        Nenhuma liga online criada ainda. Crie a primeira acima!
                      </div>
                    ) : (
                      leagues.map((lg) => {
                        const isMember = lg.members.some((m) => m.userId === currentUserId);
                        const isSelected = selectedLeague?.code === lg.code;
                        return (
                          <div
                            key={lg.code}
                            onClick={() => setSelectedLeagueCode(lg.code)}
                            className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-400'
                                : 'bg-black/30 border-white/10 hover:border-white/25'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-white truncate">
                                {lg.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono-tabular">
                                {lg.code} · {lg.members.length}/{lg.maxTeams} times · {lg.durationSeconds / 60}m
                              </div>
                            </div>
                            {!isMember ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleJoinLeague(lg.code);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
                              >
                                Participar
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-300 shrink-0">
                                Inscrito
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Selected League Table & Launch Match */}
              <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4">
                {!selectedLeague ? (
                  <div className="py-16 text-center space-y-2">
                    <Trophy className="w-10 h-10 text-amber-400 mx-auto opacity-75" />
                    <div className="font-display text-2xl font-bold text-white">
                      Selecione ou Crie uma Liga Online
                    </div>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Crie seu próprio time na aba "Criar Times", entre em uma liga online e dispute pontos na tabela em partidas 1v1 sincronizadas!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular text-xs font-bold text-amber-300">
                            CÓDIGO: {selectedLeague.code}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            · Org: {selectedLeague.ownerName}
                          </span>
                        </div>
                        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                          {selectedLeague.name}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!selectedLeague.members.some((m) => m.userId === currentUserId) ? (
                          <button
                            type="button"
                            onClick={() => void handleJoinLeague(selectedLeague.code)}
                            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            Entrar com Meu Time
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const myMember = selectedLeague.members.find(
                                (m) => m.userId === currentUserId
                              );
                              void handleCreateRoom({
                                teamIdOverride: myMember?.teamId || leagueTeamId,
                                durationOverride: selectedLeague.durationSeconds,
                                onlineLeagueId: selectedLeague.code,
                                onlineLeagueName: selectedLeague.name,
                              });
                            }}
                            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-current" /> Criar Jogo da Liga (Sala Online)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* League Standings Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                            <th className="py-2 pr-2">#</th>
                            <th className="py-2 pr-2">Time / Jogador</th>
                            <th className="py-2 px-1.5 text-right">J</th>
                            <th className="py-2 px-1.5 text-right">V</th>
                            <th className="py-2 px-1.5 text-right">E</th>
                            <th className="py-2 px-1.5 text-right">D</th>
                            <th className="py-2 px-1.5 text-right">GP</th>
                            <th className="py-2 px-1.5 text-right">GC</th>
                            <th className="py-2 px-1.5 text-right">SG</th>
                            <th className="py-2 pl-2 text-right">PTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono-tabular">
                          {sortLeagueMembers(selectedLeague.members).map((m, idx) => {
                            const memberTeam = m.customTeam
                              ? customOnlineTeamToTeam(m.customTeam)
                              : findTeamAny(m.teamId);
                            const isMe = m.userId === currentUserId;
                            return (
                              <tr
                                key={m.userId}
                                className={
                                  isMe
                                    ? 'bg-emerald-500/15 text-emerald-100'
                                    : 'text-slate-200'
                                }
                              >
                                <td className="py-2.5 pr-2 font-bold">{idx + 1}</td>
                                <td className="py-2.5 pr-2 font-sans">
                                  <div className="flex items-center gap-2">
                                    <ClubCrest team={memberTeam} size={24} />
                                    <div className="min-w-0">
                                      <div className="font-bold text-white truncate">
                                        {m.teamName} ({m.teamShortCode})
                                      </div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        Técnico: {m.userName}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-1.5 text-right">{m.played}</td>
                                <td className="py-2.5 px-1.5 text-right text-emerald-400">{m.won}</td>
                                <td className="py-2.5 px-1.5 text-right">{m.drawn}</td>
                                <td className="py-2.5 px-1.5 text-right text-rose-400">{m.lost}</td>
                                <td className="py-2.5 px-1.5 text-right">{m.goalsFor}</td>
                                <td className="py-2.5 px-1.5 text-right">{m.goalsAgainst}</td>
                                <td className="py-2.5 px-1.5 text-right">
                                  {m.goalsFor - m.goalsAgainst}
                                </td>
                                <td className="py-2.5 pl-2 text-right font-extrabold text-amber-300">
                                  {m.points}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {selectedLeague.recentResults.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Últimos Jogos da Liga
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedLeague.recentResults.slice(0, 6).map((res) => (
                            <div
                              key={res.id}
                              className="px-3 py-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs"
                            >
                              <span className="truncate max-w-[110px] font-semibold text-white">
                                {res.homeTeamName}
                              </span>
                              <span className="font-mono-tabular font-black text-amber-300 px-2">
                                {res.homeGoals} x {res.awayGoals}
                              </span>
                              <span className="truncate max-w-[110px] font-semibold text-white text-right">
                                {res.awayTeamName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CRIAR TIMES ONLINE */}
        {mainTab === 'teams' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleSaveCustomTeam}
              className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" /> Criador de Times Online
                  </h2>
                  <p className="text-xs text-slate-400">
                    Personalize escudo, sigla e cores para usar em Salas 2P Online e Ligas Online.
                  </p>
                </div>
                <ClubCrest team={previewCustomTeam} size={56} />
              </div>

              {teamFeedback && (
                <div className="text-xs text-emerald-200 bg-emerald-500/15 border border-emerald-400/35 rounded-xl px-3.5 py-2">
                  {teamFeedback}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Nome do Time
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Ex: Atlético da Quebrada"
                    maxLength={26}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Sigla (3 Letras)
                  </label>
                  <input
                    type="text"
                    value={teamShortCode}
                    onChange={(e) => setTeamShortCode(e.target.value.toUpperCase())}
                    placeholder="QUE"
                    maxLength={4}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm font-mono-tabular uppercase text-white focus:border-emerald-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Formato do Escudo
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CREST_SHAPES.map((cs) => (
                      <button
                        type="button"
                        key={cs.id}
                        onClick={() => setTeamCrestShape(cs.id)}
                        className={`py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
                          teamCrestShape === cs.id
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-black/30 text-slate-300 border-white/10'
                        }`}
                      >
                        {cs.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Estilo da Camisa
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {KIT_PATTERNS.map((kp) => (
                      <button
                        type="button"
                        key={kp.id}
                        onClick={() => setTeamPattern(kp.id)}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold cursor-pointer ${
                          teamPattern === kp.id
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-black/30 text-slate-300 border-white/10'
                        }`}
                      >
                        {kp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                  Combinações Rápidas ou Personalizadas
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {TEAM_COLOR_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => {
                        setTeamPrimary(preset.p);
                        setTeamSecondary(preset.s);
                        setTeamTextColor(preset.t);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/15 hover:border-white/35 text-[11px] font-bold text-slate-200 cursor-pointer"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white/40"
                        style={{ backgroundColor: preset.p }}
                      />
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/35 border border-white/10 text-xs">
                    <span>Cor 1</span>
                    <input
                      type="color"
                      value={teamPrimary}
                      onChange={(e) => setTeamPrimary(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                  <label className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/35 border border-white/10 text-xs">
                    <span>Cor 2</span>
                    <input
                      type="color"
                      value={teamSecondary}
                      onChange={(e) => setTeamSecondary(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                  <label className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/35 border border-white/10 text-xs">
                    <span>Número</span>
                    <input
                      type="color"
                      value={teamTextColor}
                      onChange={(e) => setTeamTextColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer"
              >
                SALVAR TIME PARA LIGAS & SALAS ONLINE
              </button>
            </form>

            {/* Saved Custom Teams List + Player Invites */}
            <div className="lg:col-span-5 space-y-4">
              {pendingTeamInvites.length > 0 && (
                <div className="bg-[#111D16] border border-amber-400/35 rounded-2xl p-5 space-y-3">
                  <h2 className="font-display text-xl font-extrabold text-amber-300">
                    Convites de Time Recebidos ({pendingTeamInvites.length})
                  </h2>
                  <div className="space-y-2">
                    {pendingTeamInvites.map((inv) => {
                      const previewInviteTeam = customOnlineTeamToTeam({
                        id: inv.teamId,
                        ownerUserId: inv.ownerUserId,
                        ownerName: inv.ownerName,
                        name: inv.teamName,
                        shortCode: inv.teamShortCode,
                        crestShape: inv.crestShape,
                        pattern: inv.pattern,
                        primaryColor: inv.primaryColor,
                        secondaryColor: inv.secondaryColor,
                        textColor: inv.textColor,
                        ovr: 80,
                        createdAt: inv.createdAt,
                      });
                      return (
                        <div
                          key={inv.id}
                          className="p-3 rounded-xl bg-black/35 border border-white/10 flex flex-wrap items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ClubCrest team={previewInviteTeam} size={36} />
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">
                                {inv.teamName} ({inv.teamShortCode})
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                Capitão: {inv.ownerName}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleRespondTeamInvite(inv, true)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                            >
                              Aceitar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRespondTeamInvite(inv, false)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold cursor-pointer"
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
                <h2 className="font-display text-2xl font-extrabold text-white">
                  Meus Times Criados ({customOnlineTeams.length})
                </h2>
                {customOnlineTeams.length === 0 ? (
                  <div className="text-xs text-slate-400 py-10 text-center bg-black/25 rounded-xl border border-white/5">
                    Você ainda não criou nenhum time personalizado. Crie o primeiro ao lado para jogar nas Ligas Online e convidar amigos!
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {customOnlineTeams.map((ct) => {
                      const asTeam = customOnlineTeamToTeam(ct);
                      const members = ct.members && ct.members.length > 0
                        ? ct.members
                        : [{ userId: ct.ownerUserId, name: ct.ownerName, role: 'captain' as const, joinedAt: ct.createdAt }];
                      const sentPendingInvites = teamInvites.filter(
                        (ti) => ti.teamId === ct.id && ti.ownerUserId === currentUserId
                      );
                      const selectedInviteId =
                        inviteTargetByTeam[ct.id] ||
                        (invitablePlayers[0] ? invitablePlayers[0].userId || String(invitablePlayers[0].id) : '');

                      return (
                        <div
                          key={ct.id}
                          className="p-3.5 rounded-xl bg-black/35 border border-white/10 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <ClubCrest team={asTeam} size={40} />
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-white truncate">
                                  {ct.name}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono-tabular">
                                  {ct.shortCode} · OVR {ct.ovr} · {members.length} jogador(es)
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setLeagueTeamId(ct.id);
                                  setHostTeamId(ct.id);
                                  setMainTab('leagues');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold cursor-pointer"
                              >
                                Usar na Liga
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomTeam(ct.id)}
                                title="Excluir Time"
                                className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Elenco do Time (Capitão + Jogadores Convidados) */}
                          <div className="text-[11px] text-slate-300 space-y-1 pt-2 border-t border-white/10">
                            <div className="font-bold text-slate-400">Elenco do Time:</div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {members.map((m) => (
                                <span key={m.userId} className="text-xs text-white">
                                  {m.name} {m.role === 'captain' ? '(Capitão)' : '(Membro)'}
                                </span>
                              ))}
                            </div>
                            {sentPendingInvites.some((ti) => ti.status === 'pending') && (
                              <div className="text-[11px] text-amber-300">
                                Convites pendentes:{' '}
                                {sentPendingInvites
                                  .filter((ti) => ti.status === 'pending')
                                  .map((ti) => ti.targetName)
                                  .join(', ')}
                              </div>
                            )}
                          </div>

                          {/* Convidar Jogador para o Time */}
                          {ct.ownerUserId === currentUserId && (
                            <div className="flex items-center gap-2 pt-1">
                              <select
                                value={selectedInviteId}
                                onChange={(e) =>
                                  setInviteTargetByTeam((prev) => ({
                                    ...prev,
                                    [ct.id]: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#0D1612] border border-white/15 text-xs text-white"
                              >
                                {invitablePlayers.length === 0 ? (
                                  <option value="">Nenhum jogador cadastrado disponível</option>
                                ) : (
                                  invitablePlayers.map((p) => {
                                    const pid = p.userId || String(p.id);
                                    return (
                                      <option key={pid} value={pid}>
                                        {p.displayName}
                                      </option>
                                    );
                                  })
                                )}
                              </select>
                              <button
                                type="button"
                                disabled={invitablePlayers.length === 0}
                                onClick={() => void handleInvitePlayerToTeam(ct)}
                                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-45 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer shrink-0"
                              >
                                Convidar Jogador
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LOCAL 2P */}
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
                <ClubCrest team={findTeamAny(p1TeamId)} size={40} />
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
                  {allAvailableTeams.map((t) => (
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
                  <ClubCrest team={findTeamAny(p2TeamId)} size={40} />
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
                    <ClubCrest team={findTeamAny(p2TeamId)} size={40} />
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
                  {allAvailableTeams.map((t) => (
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

        {/* TAB 5: SUPABASE LEADERBOARD & HISTORY */}
        {mainTab === 'ranking' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-[#111D16] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-white">
                    Liga Global · Ranking Online
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Computa somente resultados de partidas online (Salas 2P e Ligas Online).
                  </p>
                </div>
                <button
                  onClick={() => void fetchLeaderboard()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer shrink-0"
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
                          Nenhum resultado online registrado na Liga Global ainda.
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
                Últimas Partidas Online
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {recentMatches.length === 0 ? (
                  <div className="text-xs text-slate-400 py-6 text-center">
                    Nenhuma partida online registrada ainda.
                  </div>
                ) : (
                  recentMatches.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-black/35 border border-white/10 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="text-emerald-300 font-semibold">Online</span>
                        <span>{new Date(m.playedAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex items-center justify-between font-bold text-white">
                        <span>
                          {m.player1Name} ({m.homeTeamName})
                        </span>
                        <span className="font-mono-tabular text-sm text-amber-300 px-2">
                          {m.homeGoals} x {m.awayGoals}
                        </span>
                        <span className="text-right">
                          {m.player2Name} ({m.awayTeamName})
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
