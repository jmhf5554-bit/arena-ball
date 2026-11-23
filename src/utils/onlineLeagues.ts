import {
  CustomOnlineTeam,
  OnlineLeague,
  OnlineLeagueMember,
  Team,
} from '../types/game';
import { getSupabaseClient } from './supabaseClient';

const LOCAL_LEAGUES_KEY = 'arenabola_online_leagues_v1';

export function customOnlineTeamToTeam(ct: CustomOnlineTeam): Team {
  const cleanShort = (ct.shortCode || ct.name.slice(0, 3)).toUpperCase().slice(0, 4);
  const ovr = Math.max(76, Math.min(84, ct.ovr || 80));
  const baseShort = ct.name.split(/\s+/)[0]?.slice(0, 8) || cleanShort;
  const captainName = ct.members?.[0]?.name || `${baseShort} Camisa 10`;
  const partnerName = ct.members?.[1]?.name || `${baseShort} Armador`;
  const thirdName = ct.members?.[2]?.name || `${baseShort} Xerife`;
  const shortify = (full: string, fallback: string) =>
    full.trim().split(/\s+/)[0]?.slice(0, 12) || fallback;

  return {
    id: ct.id,
    name: ct.name,
    shortCode: cleanShort,
    leagueId: 'brasileirao',
    ovr,
    budgetMillions: 50,
    crestShape: ct.crestShape || 'shield',
    kit: {
      primaryColor: ct.primaryColor || '#10B981',
      secondaryColor: ct.secondaryColor || '#0F172A',
      textColor: ct.textColor || '#FFFFFF',
      borderColor: '#FFFFFF',
      pattern: ct.pattern || 'vertical_stripes',
      displayMode: 'number',
      trailColor: ct.primaryColor || '#10B981',
    },
    players: [
      {
        id: `${ct.id}-ata`,
        name: captainName,
        shortName: shortify(captainName, `${cleanShort} 10`),
        number: 10,
        position: 'ATA',
        ovr,
        pace: ovr + 3,
        shot: ovr + 4,
        pass: ovr,
        def: ovr - 12,
        fis: ovr,
        age: 23,
        nationality: 'BRA',
        valueMillions: 18,
      },
      {
        id: `${ct.id}-mei`,
        name: partnerName,
        shortName: shortify(partnerName, `${cleanShort} 8`),
        number: 8,
        position: 'MEI',
        ovr: ovr - 1,
        pace: ovr,
        shot: ovr - 1,
        pass: ovr + 4,
        def: ovr - 5,
        fis: ovr + 1,
        age: 24,
        nationality: 'BRA',
        valueMillions: 14,
      },
      {
        id: `${ct.id}-zag`,
        name: thirdName,
        shortName: shortify(thirdName, `${cleanShort} 4`),
        number: 4,
        position: 'ZAG',
        ovr: ovr - 1,
        pace: ovr - 4,
        shot: ovr - 10,
        pass: ovr - 2,
        def: ovr + 5,
        fis: ovr + 4,
        age: 26,
        nationality: 'BRA',
        valueMillions: 12,
      },
      {
        id: `${ct.id}-gol`,
        name: `${baseShort} Muralha`,
        shortName: `${cleanShort} 1`,
        number: 1,
        position: 'GOL',
        ovr: ovr - 2,
        pace: ovr - 10,
        shot: ovr - 16,
        pass: ovr - 4,
        def: ovr + 4,
        fis: ovr + 2,
        age: 27,
        nationality: 'BRA',
        valueMillions: 10,
      },
    ],
  };
}

export function sortLeagueMembers(members: OnlineLeagueMember[]): OnlineLeagueMember[] {
  return [...members].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const sgA = a.goalsFor - a.goalsAgainst;
    const sgB = b.goalsFor - b.goalsAgainst;
    if (sgB !== sgA) return sgB - sgA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return b.won - a.won;
  });
}

function readLocalLeagues(): OnlineLeague[] {
  try {
    const raw = localStorage.getItem(LOCAL_LEAGUES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OnlineLeague[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalLeagues(leagues: OnlineLeague[]) {
  try {
    localStorage.setItem(LOCAL_LEAGUES_KEY, JSON.stringify(leagues.slice(0, 40)));
  } catch {
    // ignore quota errors
  }
}

function upsertLocalLeague(league: OnlineLeague) {
  const existing = readLocalLeagues().filter((l) => l.code !== league.code);
  writeLocalLeagues([league, ...existing]);
}

function generateLeagueCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `LG${suffix}`;
}

function parseLeagueRow(row: {
  code?: string;
  guest_name?: string | null;
  created_at?: string;
}): OnlineLeague | null {
  if (!row.code || !row.code.startsWith('LG') || !row.guest_name) return null;
  try {
    const parsed = JSON.parse(row.guest_name) as OnlineLeague;
    if (!parsed || !parsed.name || !Array.isArray(parsed.members)) return null;
    return {
      ...parsed,
      code: row.code,
      id: parsed.id || row.code,
      recentResults: Array.isArray(parsed.recentResults) ? parsed.recentResults : [],
      createdAt: parsed.createdAt || row.created_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchOnlineLeagues(): Promise<OnlineLeague[]> {
  const client = getSupabaseClient();
  const local = readLocalLeagues();
  if (!client) return local;

  try {
    const { data, error } = await client
      .from('salas_online')
      .select('code, guest_name, created_at')
      .like('code', 'LG%')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !Array.isArray(data)) {
      return local;
    }

    const remoteLeagues: OnlineLeague[] = [];
    for (const row of data) {
      const parsed = parseLeagueRow(row as { code?: string; guest_name?: string | null; created_at?: string });
      if (parsed) remoteLeagues.push(parsed);
    }

    // Merge remote truth with any un-synced local leagues
    const byCode = new Map<string, OnlineLeague>();
    for (const l of local) byCode.set(l.code, l);
    for (const r of remoteLeagues) byCode.set(r.code, r);

    const merged = Array.from(byCode.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    writeLocalLeagues(merged);
    return merged;
  } catch {
    return local;
  }
}

async function saveLeagueToSupabase(league: OnlineLeague): Promise<boolean> {
  upsertLocalLeague(league);
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const serialized = JSON.stringify(league);
    const { data: existing } = await client
      .from('salas_online')
      .select('code')
      .eq('code', league.code)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from('salas_online')
        .update({
          host_name: league.name.slice(0, 60),
          guest_name: serialized,
          host_team_id: league.members[0]?.teamId || 'custom',
          duration_seconds: league.durationSeconds,
          status: 'waiting',
        })
        .eq('code', league.code);
      return !error;
    }

    const { error } = await client.from('salas_online').insert({
      code: league.code,
      host_user_id: league.ownerUserId,
      host_name: league.name.slice(0, 60),
      guest_user_id: null,
      guest_name: serialized,
      host_team_id: league.members[0]?.teamId || 'custom',
      away_team_id: 'league',
      duration_seconds: league.durationSeconds,
      status: 'waiting',
    });
    return !error;
  } catch {
    return false;
  }
}

export async function createOnlineLeague(input: {
  name: string;
  maxTeams: number;
  durationSeconds: number;
  ownerUserId: string;
  ownerName: string;
  team: Team;
  customTeam?: CustomOnlineTeam;
}): Promise<{ league: OnlineLeague; syncedOnline: boolean }> {
  const code = generateLeagueCode();
  const initialMember: OnlineLeagueMember = {
    userId: input.ownerUserId,
    userName: input.ownerName,
    teamId: input.team.id,
    teamName: input.team.name,
    teamShortCode: input.team.shortCode,
    customTeam: input.customTeam,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };

  const league: OnlineLeague = {
    id: code,
    code,
    name: input.name.trim().slice(0, 36) || `Liga de ${input.ownerName}`,
    ownerUserId: input.ownerUserId,
    ownerName: input.ownerName,
    maxTeams: Math.max(4, Math.min(16, input.maxTeams || 8)),
    durationSeconds: input.durationSeconds || 120,
    status: 'open',
    members: [initialMember],
    recentResults: [],
    createdAt: new Date().toISOString(),
  };

  const syncedOnline = await saveLeagueToSupabase(league);
  return { league, syncedOnline };
}

export async function joinOnlineLeague(input: {
  code: string;
  userId: string;
  userName: string;
  team: Team;
  customTeam?: CustomOnlineTeam;
}): Promise<{ league: OnlineLeague | null; error: string | null }> {
  const cleanCode = input.code.trim().toUpperCase();
  if (!cleanCode) {
    return { league: null, error: 'Digite o código da liga (ex: LG4X9P).' };
  }

  const all = await fetchOnlineLeagues();
  let target = all.find((l) => l.code === cleanCode) || null;

  const client = getSupabaseClient();
  if (!target && client) {
    const { data } = await client
      .from('salas_online')
      .select('code, guest_name, created_at')
      .eq('code', cleanCode)
      .maybeSingle();
    if (data) {
      target = parseLeagueRow(data as { code?: string; guest_name?: string | null; created_at?: string });
    }
  }

  if (!target) {
    return { league: null, error: 'Liga online não encontrada com este código.' };
  }

  const alreadyMember = target.members.some((m) => m.userId === input.userId);
  if (!alreadyMember && target.members.length >= target.maxTeams) {
    return { league: null, error: `Esta liga já atingiu o limite de ${target.maxTeams} times.` };
  }

  const newMember: OnlineLeagueMember = {
    userId: input.userId,
    userName: input.userName,
    teamId: input.team.id,
    teamName: input.team.name,
    teamShortCode: input.team.shortCode,
    customTeam: input.customTeam,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };

  const updatedMembers = alreadyMember
    ? target.members.map((m) =>
        m.userId === input.userId
          ? {
              ...m,
              teamId: newMember.teamId,
              teamName: newMember.teamName,
              teamShortCode: newMember.teamShortCode,
              customTeam: newMember.customTeam,
            }
          : m
      )
    : [...target.members, newMember];

  const updatedLeague: OnlineLeague = {
    ...target,
    status: updatedMembers.length >= 2 ? 'active' : target.status,
    members: updatedMembers,
  };

  await saveLeagueToSupabase(updatedLeague);
  return { league: updatedLeague, error: null };
}

export async function recordOnlineLeagueMatchResult(input: {
  leagueId: string;
  homeUserId: string;
  awayUserId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
}): Promise<OnlineLeague | null> {
  const leagues = await fetchOnlineLeagues();
  const target = leagues.find((l) => l.code === input.leagueId || l.id === input.leagueId);
  if (!target) return null;

  const homeWon = input.homeGoals > input.awayGoals;
  const awayWon = input.awayGoals > input.homeGoals;
  const draw = input.homeGoals === input.awayGoals;

  const nextMembers = target.members.map((m) => {
    if (m.userId === input.homeUserId) {
      return {
        ...m,
        played: m.played + 1,
        won: m.won + (homeWon ? 1 : 0),
        drawn: m.drawn + (draw ? 1 : 0),
        lost: m.lost + (awayWon ? 1 : 0),
        goalsFor: m.goalsFor + input.homeGoals,
        goalsAgainst: m.goalsAgainst + input.awayGoals,
        points: m.points + (homeWon ? 3 : draw ? 1 : 0),
      };
    }
    if (m.userId === input.awayUserId) {
      return {
        ...m,
        played: m.played + 1,
        won: m.won + (awayWon ? 1 : 0),
        drawn: m.drawn + (draw ? 1 : 0),
        lost: m.lost + (homeWon ? 1 : 0),
        goalsFor: m.goalsFor + input.awayGoals,
        goalsAgainst: m.goalsAgainst + input.homeGoals,
        points: m.points + (awayWon ? 3 : draw ? 1 : 0),
      };
    }
    return m;
  });

  const nextLeague: OnlineLeague = {
    ...target,
    status: 'active',
    members: nextMembers,
    recentResults: [
      {
        id: `olr-${Date.now()}`,
        homeUserId: input.homeUserId,
        awayUserId: input.awayUserId,
        homeTeamName: input.homeTeamName,
        awayTeamName: input.awayTeamName,
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        playedAt: new Date().toISOString(),
      },
      ...(target.recentResults || []).slice(0, 19),
    ],
  };

  await saveLeagueToSupabase(nextLeague);
  return nextLeague;
}
