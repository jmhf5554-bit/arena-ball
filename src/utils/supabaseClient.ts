import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CareerState,
  CarreiraJsonb,
  JogadorProfile,
  ProfileTrophy,
  UltimateClubState,
  WorldCupState,
} from '../types/game';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://jnelssxuwuaqkxvvhkko.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const LOCAL_PROFILE_KEY = 'arenabola_jogador_profile_v1';
const LOCAL_PROFILE_IDENTITY_KEY = 'arenabola_jogador_identity_v1';

let supabaseInstance: SupabaseClient | null = null;

function isConfiguredKey(key: string): boolean {
  return Boolean(
    key &&
      key.trim().length > 15 &&
      !key.includes('YOUR_SUPABASE_ANON_KEY') &&
      key !== 'anon / publishable'
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isConfiguredKey(SUPABASE_ANON_KEY)) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseInstance;
}

export interface ProfileLoadResult {
  profile: JogadorProfile | null;
  isFirstVisit: boolean;
  isOnline: boolean;
  notice: string | null;
}

interface StoredIdentity {
  id?: number;
  nome: string;
}

function readLocalIdentity(): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIdentity;
    if (!parsed || typeof parsed.nome !== 'string' || !parsed.nome.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocalIdentity(profile: JogadorProfile) {
  try {
    localStorage.setItem(
      LOCAL_PROFILE_IDENTITY_KEY,
      JSON.stringify({ id: profile.id, nome: profile.nome })
    );
  } catch {
    // ignore storage errors
  }
}

export function readLocalProfileCache(): JogadorProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JogadorProfile;
    if (!parsed || typeof parsed.nome !== 'string' || !parsed.nome.trim()) return null;
    return {
      ...parsed,
      moedas: typeof parsed.moedas === 'number' ? parsed.moedas : 100,
      vitorias: typeof parsed.vitorias === 'number' ? parsed.vitorias : 0,
      gols: typeof parsed.gols === 'number' ? parsed.gols : 0,
      carreira: parsed.carreira && typeof parsed.carreira === 'object' ? parsed.carreira : {},
    };
  } catch {
    return null;
  }
}

export function saveLocalProfileCache(profile: JogadorProfile | null) {
  try {
    if (!profile) {
      localStorage.removeItem(LOCAL_PROFILE_KEY);
      localStorage.removeItem(LOCAL_PROFILE_IDENTITY_KEY);
      return;
    }
    const normalized: JogadorProfile = {
      ...profile,
      updatedAtLocal: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(normalized));
    saveLocalIdentity(normalized);
  } catch {
    // ignore storage errors
  }
}

function normalizeDbRow(row: Record<string, unknown>): JogadorProfile {
  const rawCarreira =
    row.carreira && typeof row.carreira === 'object' ? (row.carreira as CarreiraJsonb) : {};
  return {
    id: typeof row.id === 'number' ? row.id : Number(row.id) || undefined,
    nome: String(row.nome || 'Jogador'),
    time_favorito: String(row.time_favorito || 'fla'),
    moedas: typeof row.moedas === 'number' ? row.moedas : Number(row.moedas) || 0,
    vitorias: typeof row.vitorias === 'number' ? row.vitorias : Number(row.vitorias) || 0,
    gols: typeof row.gols === 'number' ? row.gols : Number(row.gols) || 0,
    carreira: {
      career: rawCarreira.career ?? null,
      worldCup: rawCarreira.worldCup ?? null,
      trophies: Array.isArray(rawCarreira.trophies) ? rawCarreira.trophies : [],
      ultimate: rawCarreira.ultimate ?? null,
    },
  };
}

export async function loadSavedProfileOnBoot(): Promise<ProfileLoadResult> {
  const identity = readLocalIdentity();
  const cached = readLocalProfileCache();

  if (!identity && !cached) {
    return {
      profile: null,
      isFirstVisit: true,
      isOnline: Boolean(getSupabaseClient()),
      notice: null,
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      profile: cached,
      isFirstVisit: !cached,
      isOnline: false,
      notice: 'Modo offline ativo (salvamento local).',
    };
  }

  try {
    let query = client.from('jogadores').select('*');
    if (identity?.id) {
      query = query.eq('id', identity.id);
    } else {
      const targetName = identity?.nome || cached?.nome || '';
      query = query.ilike('nome', targetName);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      return {
        profile: cached,
        isFirstVisit: !cached,
        isOnline: false,
        notice: 'Sem conexão com Supabase — progresso mantido localmente.',
      };
    }

    if (data) {
      const profile = normalizeDbRow(data as Record<string, unknown>);
      saveLocalProfileCache(profile);
      return {
        profile,
        isFirstVisit: false,
        isOnline: true,
        notice: null,
      };
    }

    // If local profile exists but wasn't inserted remotely yet (e.g. created while offline), try syncing it
    if (cached) {
      const { data: inserted, error: insertErr } = await client
        .from('jogadores')
        .insert({
          nome: cached.nome,
          time_favorito: cached.time_favorito,
          moedas: cached.moedas,
          vitorias: cached.vitorias,
          gols: cached.gols,
          carreira: cached.carreira || {},
        })
        .select('*')
        .single();

      if (!insertErr && inserted) {
        const synced = normalizeDbRow(inserted as Record<string, unknown>);
        saveLocalProfileCache(synced);
        return { profile: synced, isFirstVisit: false, isOnline: true, notice: null };
      }
      return {
        profile: cached,
        isFirstVisit: false,
        isOnline: false,
        notice: 'Fallback local ativo — sincronização online indisponível no momento.',
      };
    }

    return { profile: null, isFirstVisit: true, isOnline: true, notice: null };
  } catch {
    return {
      profile: cached,
      isFirstVisit: !cached,
      isOnline: false,
      notice: 'Modo offline ativo — usando dados salvos no dispositivo.',
    };
  }
}

export async function loginOrCreateJogadorProfile(
  rawName: string,
  favoriteTeamId: string
): Promise<{ profile: JogadorProfile; created: boolean; isOnline: boolean; notice: string | null }> {
  const cleanName = rawName.trim().slice(0, 28);
  const teamId = favoriteTeamId || 'fla';

  const localFallbackProfile = (): JogadorProfile => {
    const existingLocal = readLocalProfileCache();
    if (existingLocal && existingLocal.nome.toLowerCase() === cleanName.toLowerCase()) {
      const merged = { ...existingLocal, time_favorito: teamId };
      saveLocalProfileCache(merged);
      return merged;
    }
    const fresh: JogadorProfile = {
      nome: cleanName,
      time_favorito: teamId,
      moedas: 100,
      vitorias: 0,
      gols: 0,
      carreira: { trophies: [] },
    };
    saveLocalProfileCache(fresh);
    return fresh;
  };

  const client = getSupabaseClient();
  if (!client) {
    return {
      profile: localFallbackProfile(),
      created: true,
      isOnline: false,
      notice: 'Modo offline ativo — perfil salvo localmente.',
    };
  }

  try {
    const { data: existing, error: findErr } = await client
      .from('jogadores')
      .select('*')
      .ilike('nome', cleanName)
      .maybeSingle();

    if (findErr) {
      return {
        profile: localFallbackProfile(),
        created: true,
        isOnline: false,
        notice: 'Supabase indisponível — perfil salvo em modo local.',
      };
    }

    if (existing) {
      const loaded = normalizeDbRow(existing as Record<string, unknown>);
      saveLocalProfileCache(loaded);
      return { profile: loaded, created: false, isOnline: true, notice: null };
    }

    const { data: createdRow, error: insertErr } = await client
      .from('jogadores')
      .insert({
        nome: cleanName,
        time_favorito: teamId,
        moedas: 100,
        vitorias: 0,
        gols: 0,
        carreira: { trophies: [] },
      })
      .select('*')
      .single();

    if (insertErr || !createdRow) {
      return {
        profile: localFallbackProfile(),
        created: true,
        isOnline: false,
        notice: 'Falha ao gravar no Supabase — perfil mantido localmente.',
      };
    }

    const createdProfile = normalizeDbRow(createdRow as Record<string, unknown>);
    saveLocalProfileCache(createdProfile);
    return { profile: createdProfile, created: true, isOnline: true, notice: null };
  } catch {
    return {
      profile: localFallbackProfile(),
      created: true,
      isOnline: false,
      notice: 'Sem conexão com Supabase — perfil salvo localmente.',
    };
  }
}

export async function updateJogadorInSupabase(
  profile: JogadorProfile
): Promise<{ profile: JogadorProfile; isOnline: boolean; notice: string | null }> {
  saveLocalProfileCache(profile);

  const client = getSupabaseClient();
  if (!client) {
    return { profile, isOnline: false, notice: 'Modo offline ativo (salvamento local).' };
  }

  const payload = {
    nome: profile.nome,
    time_favorito: profile.time_favorito,
    moedas: Math.max(0, Math.round(profile.moedas)),
    vitorias: Math.max(0, Math.round(profile.vitorias)),
    gols: Math.max(0, Math.round(profile.gols)),
    carreira: profile.carreira || {},
  };

  try {
    if (profile.id) {
      const { data, error } = await client
        .from('jogadores')
        .update(payload)
        .eq('id', profile.id)
        .select('*')
        .single();

      if (!error && data) {
        const synced = normalizeDbRow(data as Record<string, unknown>);
        saveLocalProfileCache(synced);
        return { profile: synced, isOnline: true, notice: null };
      }
    }

    // Fallback: locate by nome or insert
    const { data: existing } = await client
      .from('jogadores')
      .select('id')
      .ilike('nome', profile.nome)
      .maybeSingle();

    if (existing && (existing as { id?: number }).id) {
      const targetId = (existing as { id: number }).id;
      const { data, error } = await client
        .from('jogadores')
        .update(payload)
        .eq('id', targetId)
        .select('*')
        .single();

      if (!error && data) {
        const synced = normalizeDbRow(data as Record<string, unknown>);
        saveLocalProfileCache(synced);
        return { profile: synced, isOnline: true, notice: null };
      }
    } else {
      const { data, error } = await client
        .from('jogadores')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        const synced = normalizeDbRow(data as Record<string, unknown>);
        saveLocalProfileCache(synced);
        return { profile: synced, isOnline: true, notice: null };
      }
    }

    return {
      profile,
      isOnline: false,
      notice: 'Não foi possível sincronizar agora — salvo localmente.',
    };
  } catch {
    return {
      profile,
      isOnline: false,
      notice: 'Sem conexão com Supabase — progresso salvo no dispositivo.',
    };
  }
}

export function buildUpdatedCarreira(
  current: CarreiraJsonb | undefined,
  patch: {
    career?: CareerState | null;
    worldCup?: WorldCupState | null;
    ultimate?: UltimateClubState | null;
    addTrophy?: ProfileTrophy;
  }
): CarreiraJsonb {
  const base: CarreiraJsonb = {
    career: current?.career ?? null,
    worldCup: current?.worldCup ?? null,
    ultimate: current?.ultimate ?? null,
    trophies: Array.isArray(current?.trophies) ? [...current!.trophies] : [],
  };

  if (patch.career !== undefined) base.career = patch.career;
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
