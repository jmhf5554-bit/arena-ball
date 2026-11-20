import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'arena_bola.sqlite');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    favorite_team_id TEXT NOT NULL DEFAULT 'fla',
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match_rooms (
    code TEXT PRIMARY KEY,
    host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guest_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    host_team_id TEXT NOT NULL DEFAULT 'fla',
    away_team_id TEXT NOT NULL DEFAULT 'pal',
    duration_seconds INTEGER NOT NULL DEFAULT 120,
    status TEXT NOT NULL DEFAULT 'waiting',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS two_player_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    room_code TEXT,
    player1_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    player2_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    player1_name TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    home_team_name TEXT NOT NULL,
    away_team_name TEXT NOT NULL,
    home_goals INTEGER NOT NULL,
    away_goals INTEGER NOT NULL,
    winner_user_id INTEGER,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  favoriteTeamId: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  matchesPlayed: number;
}

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  favorite_team_id: string;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    favoriteTeamId: row.favorite_team_id,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    points: row.wins * 3 + row.draws,
    matchesPlayed: row.wins + row.draws + row.losses,
  };
}

export function registerUser(params: {
  username: string;
  displayName?: string;
  password: string;
  favoriteTeamId?: string;
}): { user: PublicUser; token: string } {
  const username = params.username.trim();
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username)) {
    throw new Error('Usuário deve ter 3 a 20 caracteres (letras, números, _ . -).');
  }
  if (!params.password || params.password.length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
  if (existing) {
    throw new Error('Este nome de usuário já está cadastrado.');
  }

  const displayName = (params.displayName || username).trim().slice(0, 24) || username;
  const favTeam = (params.favoriteTeamId || 'fla').trim() || 'fla';
  const pwHash = hashPassword(params.password);

  const info = db
    .prepare(
      `INSERT INTO users (username, display_name, password_hash, favorite_team_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(username, displayName, pwHash, favTeam);

  const userRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as unknown as UserRow;
  const token = createSession(userRow.id);
  return { user: toPublicUser(userRow), token };
}

export function authenticateUser(username: string, password: string): { user: PublicUser; token: string } {
  const cleanUser = username.trim();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUser) as unknown as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error('Usuário ou senha inválidos.');
  }
  const token = createSession(row.id);
  return { user: toPublicUser(row), token };
}

export function verifyCredentialsWithoutSession(username: string, password: string): PublicUser {
  const cleanUser = username.trim();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUser) as unknown as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error('Usuário ou senha do Jogador 2 inválidos.');
  }
  return toPublicUser(row);
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  return token;
}

export function getUserByToken(token: string | undefined | null): PublicUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as unknown as UserRow | undefined;
  return row ? toPublicUser(row) : null;
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getUserById(id: number): PublicUser | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow | undefined;
  return row ? toPublicUser(row) : null;
}

export function updateUserFavoriteTeam(userId: number, favoriteTeamId: string): PublicUser | null {
  db.prepare('UPDATE users SET favorite_team_id = ? WHERE id = ?').run(favoriteTeamId, userId);
  return getUserById(userId);
}

export function recordTwoPlayerMatch(params: {
  mode: 'local_2p' | 'online_2p';
  roomCode?: string | null;
  player1UserId?: number | null;
  player2UserId?: number | null;
  player1Name: string;
  player2Name: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
}): number {
  const p1Won = params.homeGoals > params.awayGoals;
  const p2Won = params.awayGoals > params.homeGoals;
  const isDraw = params.homeGoals === params.awayGoals;
  const winnerUserId = p1Won
    ? params.player1UserId || null
    : p2Won
      ? params.player2UserId || null
      : null;

  db.exec('BEGIN IMMEDIATE');
  try {
    const info = db
      .prepare(
        `INSERT INTO two_player_matches (
          mode, room_code, player1_user_id, player2_user_id,
          player1_name, player2_name, home_team_id, away_team_id,
          home_team_name, away_team_name, home_goals, away_goals, winner_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        params.mode,
        params.roomCode || null,
        params.player1UserId || null,
        params.player2UserId || null,
        params.player1Name,
        params.player2Name,
        params.homeTeamId,
        params.awayTeamId,
        params.homeTeamName,
        params.awayTeamName,
        params.homeGoals,
        params.awayGoals,
        winnerUserId
      );

    if (params.player1UserId) {
      db.prepare(
        `UPDATE users SET
          wins = wins + ?,
          draws = draws + ?,
          losses = losses + ?,
          goals_for = goals_for + ?,
          goals_against = goals_against + ?
         WHERE id = ?`
      ).run(
        p1Won ? 1 : 0,
        isDraw ? 1 : 0,
        p2Won ? 1 : 0,
        params.homeGoals,
        params.awayGoals,
        params.player1UserId
      );
    }

    if (params.player2UserId && params.player2UserId !== params.player1UserId) {
      db.prepare(
        `UPDATE users SET
          wins = wins + ?,
          draws = draws + ?,
          losses = losses + ?,
          goals_for = goals_for + ?,
          goals_against = goals_against + ?
         WHERE id = ?`
      ).run(
        p2Won ? 1 : 0,
        isDraw ? 1 : 0,
        p1Won ? 1 : 0,
        params.awayGoals,
        params.homeGoals,
        params.player2UserId
      );
    }

    if (params.roomCode) {
      db.prepare(`UPDATE match_rooms SET status = 'finished' WHERE code = ?`).run(params.roomCode);
    }

    db.exec('COMMIT');
    return Number(info.lastInsertRowid);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getLeaderboard(limit = 20): PublicUser[] {
  const rows = db
    .prepare(
      `SELECT * FROM users
       ORDER BY (wins * 3 + draws) DESC, (goals_for - goals_against) DESC, goals_for DESC, id ASC
       LIMIT ?`
    )
    .all(limit) as unknown as UserRow[];
  return rows.map(toPublicUser);
}

export function getRecentTwoPlayerMatches(limit = 20) {
  return db
    .prepare(
      `SELECT id, mode, room_code as roomCode, player1_name as player1Name, player2_name as player2Name,
              home_team_id as homeTeamId, away_team_id as awayTeamId,
              home_team_name as homeTeamName, away_team_name as awayTeamName,
              home_goals as homeGoals, away_goals as awayGoals, played_at as playedAt
       FROM two_player_matches
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit);
}

export interface RoomRow {
  code: string;
  host_user_id: number;
  guest_user_id: number | null;
  host_team_id: string;
  away_team_id: string;
  duration_seconds: number;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  created_at: string;
  host_name?: string;
  guest_name?: string | null;
}

export function createMatchRoomInDb(params: {
  hostUserId: number;
  hostTeamId: string;
  awayTeamId?: string;
  durationSeconds?: number;
}): RoomRow {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const exists = db.prepare('SELECT code FROM match_rooms WHERE code = ?').get(code);
    if (!exists) break;
  }

  const awayTeamId = params.awayTeamId || (params.hostTeamId === 'pal' ? 'fla' : 'pal');
  const dur = Math.max(60, Math.min(300, params.durationSeconds || 120));

  db.prepare(
    `INSERT INTO match_rooms (code, host_user_id, host_team_id, away_team_id, duration_seconds, status)
     VALUES (?, ?, ?, ?, ?, 'waiting')`
  ).run(code, params.hostUserId, params.hostTeamId, awayTeamId, dur);

  return getRoomByCode(code)!;
}

export function getRoomByCode(code: string): RoomRow | null {
  const row = db
    .prepare(
      `SELECT r.*, h.display_name as host_name, g.display_name as guest_name
       FROM match_rooms r
       JOIN users h ON h.id = r.host_user_id
       LEFT JOIN users g ON g.id = r.guest_user_id
       WHERE r.code = ?`
    )
    .get(code.trim().toUpperCase()) as unknown as RoomRow | undefined;
  return row || null;
}

export function listOpenRooms(): RoomRow[] {
  return db
    .prepare(
      `SELECT r.*, h.display_name as host_name, g.display_name as guest_name
       FROM match_rooms r
       JOIN users h ON h.id = r.host_user_id
       LEFT JOIN users g ON g.id = r.guest_user_id
       WHERE r.status IN ('waiting', 'ready')
       ORDER BY r.created_at DESC
       LIMIT 16`
    )
    .all() as unknown as RoomRow[];
}
