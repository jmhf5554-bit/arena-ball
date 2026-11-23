import {
  CustomOnlineTeam,
  CustomTeamInvite,
  CustomTeamMember,
  FriendRelation,
  GameInvite,
  PublicUser,
} from '../types/game';
import {
  fetchSupabaseLeaderboard,
  getSupabaseClient,
  SupabaseRoomRow,
} from './supabaseClient';

const LOCAL_FRIENDS_KEY = 'arenabola_social_friends_v1';
const LOCAL_GAME_INVITES_KEY = 'arenabola_social_game_invites_v1';
const LOCAL_TEAM_INVITES_KEY = 'arenabola_social_team_invites_v1';

interface FriendPayload {
  kind: 'friend';
  fromName: string;
  fromFavTeam: string;
  toName: string;
  toFavTeam: string;
}

interface GameInvitePayload {
  kind: 'game_invite';
  roomCode: string;
  fromName: string;
  toName: string;
  teamName: string;
}

interface TeamInvitePayload {
  kind: 'team_invite';
  teamId: string;
  teamName: string;
  teamShortCode: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  crestShape: CustomOnlineTeam['crestShape'];
  pattern: CustomOnlineTeam['pattern'];
  ownerName: string;
  targetName: string;
}

function generatePrefixedCode(prefix: 'FR_' | 'GI_' | 'TI_'): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = prefix;
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readLocalList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, list: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

export async function searchRegisteredPlayers(currentUserId: string): Promise<PublicUser[]> {
  const list = await fetchSupabaseLeaderboard(100);
  return list.filter((u) => (u.userId || String(u.id)) !== currentUserId);
}

export interface SocialBundle {
  friends: FriendRelation[];
  gameInvites: GameInvite[];
  teamInvites: CustomTeamInvite[];
}

export async function fetchSocialBundle(currentUserId: string): Promise<SocialBundle> {
  const client = getSupabaseClient();
  if (!client || !currentUserId) {
    return {
      friends: readLocalList<FriendRelation>(LOCAL_FRIENDS_KEY),
      gameInvites: readLocalList<GameInvite>(LOCAL_GAME_INVITES_KEY),
      teamInvites: readLocalList<CustomTeamInvite>(LOCAL_TEAM_INVITES_KEY),
    };
  }

  try {
    const { data, error } = await client
      .from('salas_online')
      .select('*')
      .or(`code.like.FR_%,code.like.GI_%,code.like.TI_%`)
      .or(`host_user_id.eq.${currentUserId},guest_user_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })
      .limit(120);

    if (error || !Array.isArray(data)) {
      return {
        friends: readLocalList<FriendRelation>(LOCAL_FRIENDS_KEY),
        gameInvites: readLocalList<GameInvite>(LOCAL_GAME_INVITES_KEY),
        teamInvites: readLocalList<CustomTeamInvite>(LOCAL_TEAM_INVITES_KEY),
      };
    }

    const friendsMap = new Map<string, FriendRelation>();
    const gameInvites: GameInvite[] = [];
    const teamInvites: CustomTeamInvite[] = [];

    for (const row of data as SupabaseRoomRow[]) {
      if (row.code.startsWith('FR_')) {
        if (row.status === 'finished') continue;
        const payload = safeParseJson<FriendPayload>(row.guest_name);
        if (!payload || payload.kind !== 'friend') continue;

        const isSender = row.host_user_id === currentUserId;
        const otherId = isSender ? row.guest_user_id || '' : row.host_user_id;
        if (!otherId || otherId === currentUserId) continue;

        const status: FriendRelation['status'] =
          row.status === 'ready'
            ? 'accepted'
            : isSender
              ? 'pending_sent'
              : 'pending_received';

        const existing = friendsMap.get(otherId);
        if (!existing || (existing.status !== 'accepted' && status === 'accepted')) {
          friendsMap.set(otherId, {
            id: row.code,
            friendUserId: otherId,
            friendName: isSender ? payload.toName : payload.fromName,
            friendFavoriteTeamId: isSender ? payload.toFavTeam : payload.fromFavTeam,
            status,
            createdAt: row.created_at,
          });
        }
      } else if (row.code.startsWith('GI_')) {
        if (row.status !== 'waiting') continue;
        if (row.guest_user_id !== currentUserId) continue;
        const payload = safeParseJson<GameInvitePayload>(row.guest_name);
        if (!payload || payload.kind !== 'game_invite') continue;
        gameInvites.push({
          id: row.code,
          roomCode: payload.roomCode,
          fromUserId: row.host_user_id,
          fromName: payload.fromName || row.host_name,
          toUserId: currentUserId,
          toName: payload.toName,
          teamName: payload.teamName || 'Clube',
          createdAt: row.created_at,
        });
      } else if (row.code.startsWith('TI_')) {
        if (row.status === 'finished') continue;
        const payload = safeParseJson<TeamInvitePayload>(row.guest_name);
        if (!payload || payload.kind !== 'team_invite') continue;
        teamInvites.push({
          id: row.code,
          teamId: payload.teamId,
          teamName: payload.teamName,
          teamShortCode: payload.teamShortCode,
          primaryColor: payload.primaryColor,
          secondaryColor: payload.secondaryColor,
          textColor: payload.textColor,
          crestShape: payload.crestShape || 'shield',
          pattern: payload.pattern || 'vertical_stripes',
          ownerUserId: row.host_user_id,
          ownerName: payload.ownerName || row.host_name,
          targetUserId: row.guest_user_id || '',
          targetName: payload.targetName,
          status: row.status === 'ready' ? 'accepted' : 'pending',
          createdAt: row.created_at,
        });
      }
    }

    const friends = Array.from(friendsMap.values());
    writeLocalList(LOCAL_FRIENDS_KEY, friends);
    writeLocalList(LOCAL_GAME_INVITES_KEY, gameInvites);
    writeLocalList(LOCAL_TEAM_INVITES_KEY, teamInvites);
    return { friends, gameInvites, teamInvites };
  } catch {
    return {
      friends: readLocalList<FriendRelation>(LOCAL_FRIENDS_KEY),
      gameInvites: readLocalList<GameInvite>(LOCAL_GAME_INVITES_KEY),
      teamInvites: readLocalList<CustomTeamInvite>(LOCAL_TEAM_INVITES_KEY),
    };
  }
}

export async function sendFriendRequest(opts: {
  fromUser: PublicUser;
  targetPlayer: PublicUser;
}): Promise<{ relation: FriendRelation | null; error: string | null }> {
  const fromId = opts.fromUser.userId || String(opts.fromUser.id);
  const targetId = opts.targetPlayer.userId || String(opts.targetPlayer.id);
  if (!targetId || targetId === fromId) {
    return { relation: null, error: 'Jogador inválido.' };
  }

  const code = generatePrefixedCode('FR_');
  const payload: FriendPayload = {
    kind: 'friend',
    fromName: opts.fromUser.displayName,
    fromFavTeam: opts.fromUser.favoriteTeamId || 'fla',
    toName: opts.targetPlayer.displayName,
    toFavTeam: opts.targetPlayer.favoriteTeamId || 'fla',
  };

  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('salas_online').insert({
      code,
      host_user_id: fromId,
      host_name: opts.fromUser.displayName,
      guest_user_id: targetId,
      guest_name: JSON.stringify(payload),
      host_team_id: opts.fromUser.favoriteTeamId || 'fla',
      away_team_id: opts.targetPlayer.favoriteTeamId || 'fla',
      duration_seconds: 120,
      status: 'waiting',
    });
    if (error) {
      return { relation: null, error: 'Não foi possível enviar o pedido de amizade.' };
    }
  }

  const relation: FriendRelation = {
    id: code,
    friendUserId: targetId,
    friendName: opts.targetPlayer.displayName,
    friendFavoriteTeamId: opts.targetPlayer.favoriteTeamId || 'fla',
    status: 'pending_sent',
    createdAt: new Date().toISOString(),
  };

  const prev = readLocalList<FriendRelation>(LOCAL_FRIENDS_KEY);
  writeLocalList(LOCAL_FRIENDS_KEY, [
    relation,
    ...prev.filter((r) => r.friendUserId !== targetId),
  ]);
  return { relation, error: null };
}

export async function respondFriendRequest(
  relationId: string,
  accept: boolean
): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client
      .from('salas_online')
      .update({ status: accept ? 'ready' : 'finished' })
      .eq('code', relationId);
    if (error) return false;
  }
  const prev = readLocalList<FriendRelation>(LOCAL_FRIENDS_KEY);
  const next = accept
    ? prev.map((r) => (r.id === relationId ? { ...r, status: 'accepted' as const } : r))
    : prev.filter((r) => r.id !== relationId);
  writeLocalList(LOCAL_FRIENDS_KEY, next);
  return true;
}

export async function removeFriendship(relationId: string): Promise<boolean> {
  return respondFriendRequest(relationId, false);
}

export async function sendGameInviteToFriend(opts: {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  roomCode: string;
  teamName: string;
}): Promise<{ invite: GameInvite | null; error: string | null }> {
  const code = generatePrefixedCode('GI_');
  const payload: GameInvitePayload = {
    kind: 'game_invite',
    roomCode: opts.roomCode,
    fromName: opts.fromName,
    toName: opts.toName,
    teamName: opts.teamName,
  };

  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('salas_online').insert({
      code,
      host_user_id: opts.fromUserId,
      host_name: opts.fromName,
      guest_user_id: opts.toUserId,
      guest_name: JSON.stringify(payload),
      host_team_id: 'fla',
      away_team_id: 'pal',
      duration_seconds: 120,
      status: 'waiting',
    });
    if (error) {
      return { invite: null, error: 'Não foi possível enviar o convite de jogo.' };
    }
  }

  return {
    invite: {
      id: code,
      roomCode: opts.roomCode,
      fromUserId: opts.fromUserId,
      fromName: opts.fromName,
      toUserId: opts.toUserId,
      toName: opts.toName,
      teamName: opts.teamName,
      createdAt: new Date().toISOString(),
    },
    error: null,
  };
}

export async function dismissGameInvite(inviteId: string): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    await client.from('salas_online').update({ status: 'finished' }).eq('code', inviteId);
  }
  const prev = readLocalList<GameInvite>(LOCAL_GAME_INVITES_KEY);
  writeLocalList(
    LOCAL_GAME_INVITES_KEY,
    prev.filter((g) => g.id !== inviteId)
  );
}

export async function sendCustomTeamInvite(opts: {
  team: CustomOnlineTeam;
  ownerUserId: string;
  ownerName: string;
  target: PublicUser;
}): Promise<{ invite: CustomTeamInvite | null; error: string | null }> {
  const targetId = opts.target.userId || String(opts.target.id);
  if (!targetId || targetId === opts.ownerUserId) {
    return { invite: null, error: 'Selecione outro jogador para convidar.' };
  }
  const code = generatePrefixedCode('TI_');
  const payload: TeamInvitePayload = {
    kind: 'team_invite',
    teamId: opts.team.id,
    teamName: opts.team.name,
    teamShortCode: opts.team.shortCode,
    primaryColor: opts.team.primaryColor,
    secondaryColor: opts.team.secondaryColor,
    textColor: opts.team.textColor,
    crestShape: opts.team.crestShape,
    pattern: opts.team.pattern,
    ownerName: opts.ownerName,
    targetName: opts.target.displayName,
  };

  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('salas_online').insert({
      code,
      host_user_id: opts.ownerUserId,
      host_name: opts.ownerName,
      guest_user_id: targetId,
      guest_name: JSON.stringify(payload),
      host_team_id: opts.team.id,
      away_team_id: opts.team.id,
      duration_seconds: 120,
      status: 'waiting',
    });
    if (error) {
      return { invite: null, error: 'Falha ao enviar convite para o time.' };
    }
  }

  return {
    invite: {
      id: code,
      teamId: opts.team.id,
      teamName: opts.team.name,
      teamShortCode: opts.team.shortCode,
      primaryColor: opts.team.primaryColor,
      secondaryColor: opts.team.secondaryColor,
      textColor: opts.team.textColor,
      crestShape: opts.team.crestShape,
      pattern: opts.team.pattern,
      ownerUserId: opts.ownerUserId,
      ownerName: opts.ownerName,
      targetUserId: targetId,
      targetName: opts.target.displayName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    error: null,
  };
}

export async function respondCustomTeamInvite(
  inviteId: string,
  accept: boolean
): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client
      .from('salas_online')
      .update({ status: accept ? 'ready' : 'finished' })
      .eq('code', inviteId);
    if (error) return false;
  }
  const prev = readLocalList<CustomTeamInvite>(LOCAL_TEAM_INVITES_KEY);
  const next = accept
    ? prev.map((t) => (t.id === inviteId ? { ...t, status: 'accepted' as const } : t))
    : prev.filter((t) => t.id !== inviteId);
  writeLocalList(LOCAL_TEAM_INVITES_KEY, next);
  return true;
}

export function mergeAcceptedTeamMembers(
  teams: CustomOnlineTeam[],
  teamInvites: CustomTeamInvite[],
  ownerUserId: string,
  ownerName: string
): CustomOnlineTeam[] {
  return teams.map((ct) => {
    const baseMembers: CustomTeamMember[] =
      ct.members && ct.members.length > 0
        ? [...ct.members]
        : [
            {
              userId: ct.ownerUserId || ownerUserId,
              name: ct.ownerName || ownerName,
              role: 'captain',
              joinedAt: ct.createdAt,
            },
          ];

    const acceptedInvites = teamInvites.filter(
      (ti) => ti.teamId === ct.id && ti.status === 'accepted'
    );
    for (const inv of acceptedInvites) {
      if (!baseMembers.some((m) => m.userId === inv.targetUserId)) {
        baseMembers.push({
          userId: inv.targetUserId,
          name: inv.targetName,
          role: 'member',
          joinedAt: inv.createdAt,
        });
      }
    }
    return { ...ct, members: baseMembers };
  });
}
