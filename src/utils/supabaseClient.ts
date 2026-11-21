import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  CareerState,
  CarreiraJsonb,
  JogadorProfile,
  PlayerCareerState,
  ProfileTrophy,
  PublicUser,
  TwoPlayerMatchRecord,
  UltimateClubState,
  UserRole,
  WorldCupState,
} from '../types/game';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://jnelssxuwuaqkxvvhkko.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_ANON_KEY &&
      SUPABASE_ANON_KEY.trim().length > 15 &&
      !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY') &&
      SUPABASE_ANON_KEY !== 'anon / publishable'
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseInstance;
}

export function translateSupabaseAuthError(rawMessage: string): string {
  const msg = (rawMessage || '').toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Este e-mail já está cadastrado. Use a aba "Entrar" para acessar sua conta.';
  }
  if (msg.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado no Supabase. Confirme ou desative a confirmação de e-mail nas configurações do Auth.';
  }
  if (msg.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (msg.includes('unable to validate email address') || msg.includes('invalid email')) {
    return 'Digite um endereço de e-mail válido.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Muitas tentativas seguidas. Aguarde alguns segundos e tente novamente.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Falha de conexão com o servidor do Supabase. Verifique sua internet.';
  }
  return rawMessage || 'Não foi possível concluir a autenticação no Supabase.';
}

export function getScopedProfileCacheKey(userId: string): string {
  return `arenabola_profile_u_${userId}_v2`;
}

export function readUserProfileCache(userId: string): JogadorProfile | null {
  try {
    const raw = localStorage.getItem(getScopedProfileCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JogadorProfile;
    if (!parsed || typeof parsed.nome !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveUserProfileCache(profile: JogadorProfile) {
  if (!profile.user_id) return;
  try {
    localStorage.setItem(
      getScopedProfileCacheKey(profile.user_id),
      JSON.stringify({ ...profile, updatedAtLocal: new Date().toISOString() })
    );
  } catch {
    // ignore storage errors
  }
}

function normalizeDbRow(row: Record<string, unknown>): JogadorProfile {
  const rawCarreira =
    row.carreira && typeof row.carreira === 'object' ? (row.carreira as CarreiraJsonb) : {};
  const rawRole = String(row.role || 'user');
  const role: UserRole =
    rawRole === 'super_admin' || rawRole === 'admin' ? rawRole : 'user';
  return {
    id: typeof row.id === 'number' ? row.id : Number(row.id) || undefined,
    user_id: typeof row.user_id === 'string' ? row.user_id : undefined,
    email: typeof row.email === 'string' ? row.email : null,
    role,
    nome: String(row.nome || 'Jogador'),
    time_favorito: String(row.time_favorito || 'fla'),
    moedas: typeof row.moedas === 'number' ? row.moedas : Number(row.moedas) || 0,
    vitorias: typeof row.vitorias === 'number' ? row.vitorias : Number(row.vitorias) || 0,
    empates: typeof row.empates === 'number' ? row.empates : Number(row.empates) || 0,
    derrotas: typeof row.derrotas === 'number' ? row.derrotas : Number(row.derrotas) || 0,
    gols: typeof row.gols === 'number' ? row.gols : Number(row.gols) || 0,
    gols_sofridos:
      typeof row.gols_sofridos === 'number' ? row.gols_sofridos : Number(row.gols_sofridos) || 0,
    carreira: {
      career: rawCarreira.career ?? null,
      playerCareer: rawCarreira.playerCareer ?? null,
      worldCup: rawCarreira.worldCup ?? null,
      trophies: Array.isArray(rawCarreira.trophies) ? rawCarreira.trophies : [],
      ultimate: rawCarreira.ultimate ?? null,
    },
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
  };
}

export async function getCurrentAuthSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

export async function loadOrCreateProfileForAuthUser(
  authUser: User,
  fallbackMeta?: { nome?: string; timeFavoritoId?: string }
): Promise<{ profile: JogadorProfile | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { profile: null, error: 'Supabase não configurado.' };
  }

  try {
    const { data: existing, error: findErr } = await client
      .from('jogadores')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (findErr) {
      const cached = readUserProfileCache(authUser.id);
      if (cached) return { profile: cached, error: null };
      return {
        profile: null,
        error: `Erro ao consultar tabela "jogadores" no Supabase: ${findErr.message}`,
      };
    }

    if (existing) {
      const normalized = normalizeDbRow(existing as Record<string, unknown>);
      saveUserProfileCache(normalized);
      return { profile: normalized, error: null };
    }

    const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
    const rawName =
      fallbackMeta?.nome ||
      (typeof meta.nome === 'string' ? meta.nome : '') ||
      (authUser.email ? authUser.email.split('@')[0] : 'Jogador');
    const cleanName = rawName.trim().slice(0, 28) || 'Jogador';
    const favTeam =
      fallbackMeta?.timeFavoritoId ||
      (typeof meta.time_favorito === 'string' && meta.time_favorito ? meta.time_favorito : 'fla');

    const { data: inserted, error: insertErr } = await client
      .from('jogadores')
      .insert({
        user_id: authUser.id,
        email: authUser.email || null,
        nome: cleanName,
        time_favorito: favTeam,
        role: 'user',
        moedas: 100,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        gols: 0,
        gols_sofridos: 0,
        carreira: { trophies: [] },
      })
      .select('*')
      .single();

    if (insertErr || !inserted) {
      // Trigger may have just inserted it; retry select once
      const { data: retryRow } = await client
        .from('jogadores')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (retryRow) {
        const normalized = normalizeDbRow(retryRow as Record<string, unknown>);
        saveUserProfileCache(normalized);
        return { profile: normalized, error: null };
      }
      return {
        profile: null,
        error: insertErr?.message || 'Não foi possível criar o registro do jogador no Supabase.',
      };
    }

    const created = normalizeDbRow(inserted as Record<string, unknown>);
    saveUserProfileCache(created);
    return { profile: created, error: null };
  } catch (err) {
    return {
      profile: readUserProfileCache(authUser.id),
      error: err instanceof Error ? err.message : 'Erro ao carregar perfil do Supabase.',
    };
  }
}

export async function signUpWithEmailPassword(input: {
  email: string;
  password: string;
  nome: string;
  timeFavoritoId: string;
}): Promise<{ profile: JogadorProfile | null; user: User | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      profile: null,
      user: null,
      error: 'Configure VITE_SUPABASE_ANON_KEY nas variáveis do projeto para conectar ao Supabase.',
    };
  }

  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.nome.trim().slice(0, 28);
  const favTeam = input.timeFavoritoId || 'fla';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { profile: null, user: null, error: 'Digite um e-mail válido.' };
  }
  if (cleanName.length < 2) {
    return { profile: null, user: null, error: 'Digite um nome de jogador com pelo menos 2 caracteres.' };
  }
  if (input.password.length < 6) {
    return { profile: null, user: null, error: 'A senha deve ter no mínimo 6 caracteres.' };
  }

  try {
    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password: input.password,
      options: {
        data: {
          nome: cleanName,
          time_favorito: favTeam,
        },
      },
    });

    if (error) {
      return { profile: null, user: null, error: translateSupabaseAuthError(error.message) };
    }

    if (!data.user) {
      return {
        profile: null,
        user: null,
        error: 'Cadastro realizado, mas o usuário não foi retornado pelo Supabase.',
      };
    }

    // If session wasn't immediately returned (edge case), attempt password sign-in
    if (!data.session) {
      const loginRes = await client.auth.signInWithPassword({
        email: cleanEmail,
        password: input.password,
      });
      if (loginRes.error) {
        return {
          profile: null,
          user: null,
          error: translateSupabaseAuthError(loginRes.error.message),
        };
      }
    }

    const loaded = await loadOrCreateProfileForAuthUser(data.user, {
      nome: cleanName,
      timeFavoritoId: favTeam,
    });

    return {
      profile: loaded.profile,
      user: data.user,
      error: loaded.error,
    };
  } catch (err) {
    return {
      profile: null,
      user: null,
      error: err instanceof Error ? translateSupabaseAuthError(err.message) : 'Erro ao criar conta.',
    };
  }
}

export async function signInWithEmailPassword(input: {
  email: string;
  password: string;
}): Promise<{ profile: JogadorProfile | null; user: User | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      profile: null,
      user: null,
      error: 'Configure VITE_SUPABASE_ANON_KEY nas variáveis do projeto para conectar ao Supabase.',
    };
  }

  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { profile: null, user: null, error: 'Digite um e-mail válido.' };
  }
  if (!input.password || input.password.length < 4) {
    return { profile: null, user: null, error: 'Digite sua senha.' };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: input.password,
    });

    if (error || !data.user) {
      return {
        profile: null,
        user: null,
        error: translateSupabaseAuthError(error?.message || 'E-mail ou senha incorretos.'),
      };
    }

    const loaded = await loadOrCreateProfileForAuthUser(data.user);
    return {
      profile: loaded.profile,
      user: data.user,
      error: loaded.error,
    };
  } catch (err) {
    return {
      profile: null,
      user: null,
      error: err instanceof Error ? translateSupabaseAuthError(err.message) : 'Erro ao entrar.',
    };
  }
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch {
    // ignore
  }
}

export async function updateJogadorInSupabase(
  profile: JogadorProfile
): Promise<{ profile: JogadorProfile; isOnline: boolean }> {
  saveUserProfileCache(profile);

  const client = getSupabaseClient();
  if (!client || !profile.user_id) {
    return { profile, isOnline: false };
  }

  const payload = {
    nome: profile.nome,
    time_favorito: profile.time_favorito,
    moedas: Math.max(0, Math.round(profile.moedas)),
    vitorias: Math.max(0, Math.round(profile.vitorias)),
    empates: Math.max(0, Math.round(profile.empates || 0)),
    derrotas: Math.max(0, Math.round(profile.derrotas || 0)),
    gols: Math.max(0, Math.round(profile.gols)),
    gols_sofridos: Math.max(0, Math.round(profile.gols_sofridos || 0)),
    carreira: profile.carreira || {},
  };

  try {
    const { data, error } = await client
      .from('jogadores')
      .update(payload)
      .eq('user_id', profile.user_id)
      .select('*')
      .single();

    if (!error && data) {
      const synced = normalizeDbRow(data as Record<string, unknown>);
      saveUserProfileCache(synced);
      return { profile: synced, isOnline: true };
    }
    return { profile, isOnline: false };
  } catch {
    return { profile, isOnline: false };
  }
}

export function buildUpdatedCarreira(
  current: CarreiraJsonb | undefined,
  patch: {
    career?: CareerState | null;
    playerCareer?: PlayerCareerState | null;
    worldCup?: WorldCupState | null;
    ultimate?: UltimateClubState | null;
    addTrophy?: ProfileTrophy;
  }
): CarreiraJsonb {
  const base: CarreiraJsonb = {
    career: current?.career ?? null,
    playerCareer: current?.playerCareer ?? null,
    worldCup: current?.worldCup ?? null,
    ultimate: current?.ultimate ?? null,
    trophies: Array.isArray(current?.trophies) ? [...current!.trophies] : [],
  };

  if (patch.career !== undefined) base.career = patch.career;
  if (patch.playerCareer !== undefined) base.playerCareer = patch.playerCareer;
  if (patch.worldCup !== undefined) base.worldCup = patch.worldCup;
  if (patch.ultimate !== undefined) base.ultimate = patch.ultimate;
  if (patch.addTrophy) {
    const exists = base.trophies?.some((t) => t.id === patch.addTrophy!.id);
    if (!exists) {
      base.trophies = [...(base.trophies || []), patch.addTrophy];
    }
  }
  return base;
}

export function profileToPublicUser(profile: JogadorProfile): PublicUser {
  const wins = Math.max(0, Math.round(profile.vitorias || 0));
  const draws = Math.max(0, Math.round(profile.empates || 0));
  const losses = Math.max(0, Math.round(profile.derrotas || 0));
  const goalsFor = Math.max(0, Math.round(profile.gols || 0));
  const goalsAgainst = Math.max(0, Math.round(profile.gols_sofridos || 0));
  return {
    id: profile.user_id || profile.id || profile.nome,
    userId: profile.user_id,
    email: profile.email || null,
    role: profile.role || 'user',
    username: profile.email ? profile.email.split('@')[0] : profile.nome,
    displayName: profile.nome,
    favoriteTeamId: profile.time_favorito || 'fla',
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    points: wins * 3 + draws,
    matchesPlayed: wins + draws + losses,
  };
}

// ================= ADMIN / SUPER ADMIN =================

export async function checkHasAnySuperAdmin(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const { data, error } = await client.rpc('has_any_super_admin');
    if (error) return false;
    return Boolean(data);
  } catch {
    return true;
  }
}

export async function claimInitialSuperAdmin(): Promise<{
  profile: JogadorProfile | null;
  error: string | null;
}> {
  const client = getSupabaseClient();
  if (!client) return { profile: null, error: 'Supabase não configurado.' };
  try {
    const { data, error } = await client.rpc('claim_initial_super_admin');
    if (error || !data) {
      return {
        profile: null,
        error: error?.message || 'Não foi possível reivindicar Super Admin inicial.',
      };
    }
    const normalized = normalizeDbRow(data as Record<string, unknown>);
    saveUserProfileCache(normalized);
    return { profile: normalized, error: null };
  } catch (err) {
    return {
      profile: null,
      error: err instanceof Error ? err.message : 'Erro ao reivindicar Super Admin.',
    };
  }
}

export async function fetchAllRegisteredUsersForAdmin(): Promise<{
  users: JogadorProfile[];
  error: string | null;
}> {
  const client = getSupabaseClient();
  if (!client) return { users: [], error: 'Supabase não configurado.' };
  try {
    const { data, error } = await client
      .from('jogadores')
      .select('id, user_id, email, nome, time_favorito, role, moedas, vitorias, empates, derrotas, gols, gols_sofridos, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return { users: [], error: error.message };
    }
    return {
      users: Array.isArray(data)
        ? data.map((row) => normalizeDbRow(row as Record<string, unknown>))
        : [],
      error: null,
    };
  } catch (err) {
    return {
      users: [],
      error: err instanceof Error ? err.message : 'Erro ao buscar usuários.',
    };
  }
}

export async function setUserRoleAsSuperAdmin(
  targetUserId: string,
  newRole: UserRole
): Promise<{ user: JogadorProfile | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { user: null, error: 'Supabase não configurado.' };
  try {
    const { data, error } = await client.rpc('admin_set_user_role', {
      target_user_id: targetUserId,
      new_role: newRole,
    });
    if (error || !data) {
      return { user: null, error: error?.message || 'Falha ao atualizar cargo.' };
    }
    return { user: normalizeDbRow(data as Record<string, unknown>), error: null };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err.message : 'Erro ao atualizar cargo.',
    };
  }
}

// ================= ONLINE 2P ROOMS, RANKING & HISTORY (SUPABASE) =================

export interface SupabaseRoomRow {
  code: string;
  host_user_id: string;
  host_name: string;
  guest_user_id: string | null;
  guest_name: string | null;
  host_team_id: string;
  away_team_id: string;
  duration_seconds: number;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  created_at: string;
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function listOpenSupabaseRooms(): Promise<SupabaseRoomRow[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('salas_online')
      .select('*')
      .in('status', ['waiting', 'ready'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return [];
    return data as SupabaseRoomRow[];
  } catch {
    return [];
  }
}

export async function createSupabaseRoom(input: {
  hostUserId: string;
  hostName: string;
  hostTeamId: string;
  awayTeamId: string;
  durationSeconds: number;
}): Promise<{ room: SupabaseRoomRow | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { room: null, error: 'Supabase não configurado.' };

  const code = generateRoomCode();
  try {
    const { data, error } = await client
      .from('salas_online')
      .insert({
        code,
        host_user_id: input.hostUserId,
        host_name: input.hostName,
        host_team_id: input.hostTeamId,
        away_team_id: input.awayTeamId,
        duration_seconds: input.durationSeconds || 120,
        status: 'waiting',
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        room: null,
        error: error?.message || 'Não foi possível criar a sala no Supabase.',
      };
    }
    return { room: data as SupabaseRoomRow, error: null };
  } catch (err) {
    return {
      room: null,
      error: err instanceof Error ? err.message : 'Erro ao criar sala.',
    };
  }
}

export async function joinSupabaseRoom(input: {
  code: string;
  guestUserId: string;
  guestName: string;
}): Promise<{ room: SupabaseRoomRow | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { room: null, error: 'Supabase não configurado.' };

  const cleanCode = input.code.trim().toUpperCase();
  try {
    const { data: current, error: fetchErr } = await client
      .from('salas_online')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();

    if (fetchErr || !current) {
      return { room: null, error: 'Sala não encontrada ou já encerrada.' };
    }

    const room = current as SupabaseRoomRow;
    if (room.status === 'finished') {
      return { room: null, error: 'Esta sala já foi encerrada.' };
    }
    if (room.host_user_id === input.guestUserId) {
      return { room, error: null };
    }
    if (room.guest_user_id && room.guest_user_id !== input.guestUserId) {
      return { room: null, error: 'Esta sala já está cheia (2 jogadores).' };
    }

    const nextStatus = room.status === 'waiting' ? 'ready' : room.status;
    const { data: updated, error: updateErr } = await client
      .from('salas_online')
      .update({
        guest_user_id: input.guestUserId,
        guest_name: input.guestName,
        status: nextStatus,
      })
      .eq('code', cleanCode)
      .select('*')
      .single();

    if (updateErr || !updated) {
      return { room: null, error: updateErr?.message || 'Erro ao entrar na sala.' };
    }
    return { room: updated as SupabaseRoomRow, error: null };
  } catch (err) {
    return {
      room: null,
      error: err instanceof Error ? err.message : 'Erro ao entrar na sala.',
    };
  }
}

export async function updateSupabaseRoom(
  code: string,
  patch: Partial<
    Pick<
      SupabaseRoomRow,
      'host_team_id' | 'away_team_id' | 'status' | 'guest_user_id' | 'guest_name'
    >
  >
): Promise<SupabaseRoomRow | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('salas_online')
      .update(patch)
      .eq('code', code.toUpperCase())
      .select('*')
      .maybeSingle();
    if (error || !data) return null;
    return data as SupabaseRoomRow;
  } catch {
    return null;
  }
}

export async function recordSupabaseTwoPlayerMatch(input: {
  mode: 'local_2p' | 'online_2p';
  roomCode?: string | null;
  player1UserId?: string | null;
  player2UserId?: string | null;
  player1Name: string;
  player2Name: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('partidas_2p').insert({
      mode: input.mode,
      room_code: input.roomCode || null,
      player1_user_id: input.player1UserId || null,
      player2_user_id: input.player2UserId || null,
      player1_name: input.player1Name,
      player2_name: input.player2Name,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      home_team_name: input.homeTeamName,
      away_team_name: input.awayTeamName,
      home_goals: input.homeGoals,
      away_goals: input.awayGoals,
    });
    if (input.roomCode) {
      await updateSupabaseRoom(input.roomCode, { status: 'finished' });
    }
  } catch {
    // ignore
  }
}

export async function fetchSupabaseLeaderboard(limit = 30): Promise<PublicUser[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data: rpcData, error: rpcErr } = await client.rpc('get_public_leaderboard', {
      limit_rows: limit,
    });
    if (!rpcErr && Array.isArray(rpcData)) {
      return rpcData.map((r) => {
        const row = r as Record<string, unknown>;
        const wins = Number(row.vitorias) || 0;
        const draws = Number(row.empates) || 0;
        const losses = Number(row.derrotas) || 0;
        const gf = Number(row.gols) || 0;
        const ga = Number(row.gols_sofridos) || 0;
        return {
          id: String(row.user_id || row.id),
          userId: typeof row.user_id === 'string' ? row.user_id : undefined,
          username: String(row.nome || 'Jogador'),
          displayName: String(row.nome || 'Jogador'),
          favoriteTeamId: String(row.time_favorito || 'fla'),
          wins,
          draws,
          losses,
          goalsFor: gf,
          goalsAgainst: ga,
          points: wins * 3 + draws,
          matchesPlayed: wins + draws + losses,
        };
      });
    }

    // Graceful fallback if get_public_leaderboard RPC wasn't run yet
    const { data, error } = await client
      .from('jogadores')
      .select('id, user_id, nome, time_favorito, moedas, vitorias, gols')
      .order('vitorias', { ascending: false })
      .order('gols', { ascending: false })
      .limit(limit);

    if (error || !Array.isArray(data)) return [];
    return data.map((row) => profileToPublicUser(normalizeDbRow(row as Record<string, unknown>)));
  } catch {
    return [];
  }
}

export async function fetchSupabaseRecentMatches(limit = 20): Promise<TwoPlayerMatchRecord[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('partidas_2p')
      .select('*')
      .order('played_at', { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Number(row.id) || 0,
        mode: row.mode === 'online_2p' ? 'online_2p' : 'local_2p',
        roomCode: typeof row.room_code === 'string' ? row.room_code : null,
        player1Name: String(row.player1_name || 'Jogador 1'),
        player2Name: String(row.player2_name || 'Jogador 2'),
        homeTeamId: String(row.home_team_id || 'fla'),
        awayTeamId: String(row.away_team_id || 'pal'),
        homeTeamName: String(row.home_team_name || 'Casa'),
        awayTeamName: String(row.away_team_name || 'Visitante'),
        homeGoals: Number(row.home_goals) || 0,
        awayGoals: Number(row.away_goals) || 0,
        playedAt: String(row.played_at || new Date().toISOString()),
      };
    });
  } catch {
    return [];
  }
}
