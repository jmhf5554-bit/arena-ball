import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  db,
  getRoomByCode,
  getUserByToken,
  PublicUser,
  recordTwoPlayerMatch,
} from './db.ts';

const ARENA_W = 1200;
const ARENA_H = 680;
const PITCH_X = 110;
const PITCH_Y = 90;
const PITCH_W = 980;
const PITCH_H = 500;
const GOAL_W = 46;
const GOAL_H = 166;
const GOAL_TOP = PITCH_Y + (PITCH_H - GOAL_H) / 2;
const GOAL_BOT = GOAL_TOP + GOAL_H;
const POST_R = 9;
const PLAYER_R = 19;
const BALL_R = 11.5;

interface PlayerInputPacket {
  ax: number;
  ay: number;
  kick: boolean;
}

interface OnlineDisc {
  side: 'home' | 'away';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kickGlow: number;
  kickAngle: number;
  kickCooldown: number;
  kickBuffer: number;
  stamina: number;
  pace: number;
  shot: number;
  def: number;
  fis: number;
  mass: number;
  name: string;
}

interface OnlineRoomState {
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
  hostWs: WebSocket | null;
  guestWs: WebSocket | null;
  hostInput: PlayerInputPacket;
  guestInput: PlayerInputPacket;
  intervalId: NodeJS.Timeout | null;
  tickCounter: number;
  sim: {
    discs: [OnlineDisc, OnlineDisc];
    ball: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      spin: number;
      lastTouchedSide: 'home' | 'away';
      lastTouchedName: string;
    };
    homeGoals: number;
    awayGoals: number;
    elapsed: number;
    inAddedTime: boolean;
    addedMinutesTotal: number;
    addedSecondsLeft: number;
    goalPhase: 'none' | 'celebration';
    goalFreezeTimer: number;
    celebrationScorerSide: 'home' | 'away' | null;
    scorers: { teamSide: 'home' | 'away'; playerName: string; timeSec: number }[];
    netRippleLeft: number;
    netRippleRight: number;
    finished: boolean;
  } | null;
}

interface SocketMeta {
  user: PublicUser;
  roomCode: string;
  side: 'home' | 'away';
}

const activeRooms = new Map<string, OnlineRoomState>();
const socketMetaMap = new WeakMap<WebSocket, SocketMeta>();

function createInitialDiscs(room: OnlineRoomState): [OnlineDisc, OnlineDisc] {
  const cx = PITCH_X + PITCH_W / 2;
  const cy = PITCH_Y + PITCH_H / 2;
  const mkDisc = (side: 'home' | 'away', name: string): OnlineDisc => ({
    side,
    x: side === 'home' ? cx - 165 : cx + 165,
    y: cy,
    vx: 0,
    vy: 0,
    radius: PLAYER_R,
    kickGlow: 0,
    kickAngle: side === 'home' ? 0 : Math.PI,
    kickCooldown: 0,
    kickBuffer: 0,
    stamina: 100,
    pace: 82,
    shot: 82,
    def: 76,
    fis: 82,
    mass: 1.15,
    name,
  });
  return [mkDisc('home', room.hostName), mkDisc('away', room.guestName || 'Visitante')];
}

function resetPositions(room: OnlineRoomState) {
  if (!room.sim) return;
  const cx = PITCH_X + PITCH_W / 2;
  const cy = PITCH_Y + PITCH_H / 2;
  const [h, a] = room.sim.discs;
  h.x = cx - 165;
  h.y = cy;
  h.vx = 0;
  h.vy = 0;
  h.kickCooldown = 0;
  h.kickBuffer = 0;
  h.kickGlow = 0;

  a.x = cx + 165;
  a.y = cy;
  a.vx = 0;
  a.vy = 0;
  a.kickCooldown = 0;
  a.kickBuffer = 0;
  a.kickGlow = 0;

  room.sim.ball = {
    x: cx,
    y: cy,
    vx: 0,
    vy: 0,
    spin: 0,
    lastTouchedSide: 'home',
    lastTouchedName: room.hostName,
  };
}

function sendJson(ws: WebSocket | null, payload: unknown) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcastRoom(room: OnlineRoomState, payload: unknown) {
  sendJson(room.hostWs, payload);
  sendJson(room.guestWs, payload);
}

function broadcastLobbyState(room: OnlineRoomState) {
  broadcastRoom(room, {
    type: 'lobby_state',
    room: {
      code: room.code,
      hostUserId: room.hostUserId,
      hostName: room.hostName,
      guestUserId: room.guestUserId,
      guestName: room.guestName,
      homeTeamId: room.homeTeamId,
      awayTeamId: room.awayTeamId,
      homeTeamName: room.homeTeamName,
      awayTeamName: room.awayTeamName,
      durationSeconds: room.durationSeconds,
      status: room.status,
    },
  });
}

function stopRoomLoop(room: OnlineRoomState) {
  if (room.intervalId) {
    clearInterval(room.intervalId);
    room.intervalId = null;
  }
}

function finishOnlineMatch(room: OnlineRoomState) {
  if (!room.sim || room.sim.finished) return;
  room.sim.finished = true;
  room.status = 'finished';
  stopRoomLoop(room);

  const homeGoals = room.sim.homeGoals;
  const awayGoals = room.sim.awayGoals;
  const winnerSide = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw';

  recordTwoPlayerMatch({
    mode: 'online_2p',
    roomCode: room.code,
    player1UserId: room.hostUserId,
    player2UserId: room.guestUserId,
    player1Name: room.hostName,
    player2Name: room.guestName || 'Visitante',
    homeTeamId: room.homeTeamId,
    awayTeamId: room.awayTeamId,
    homeTeamName: room.homeTeamName,
    awayTeamName: room.awayTeamName,
    homeGoals,
    awayGoals,
  });

  broadcastRoom(room, {
    type: 'match_finished',
    result: {
      homeGoals,
      awayGoals,
      winnerSide,
      scorers: room.sim.scorers,
      durationPlayedSeconds: Math.round(room.sim.elapsed),
    },
  });
}

function stepRoomPhysics(room: OnlineRoomState, dt: number) {
  const sim = room.sim;
  if (!sim || sim.finished) return;

  sim.netRippleLeft = Math.max(0, sim.netRippleLeft - dt * 1.8);
  sim.netRippleRight = Math.max(0, sim.netRippleRight - dt * 1.8);

  if (sim.goalPhase === 'celebration') {
    sim.goalFreezeTimer -= dt;
    sim.ball.x += sim.ball.vx * dt * 0.25;
    sim.ball.y += sim.ball.vy * dt * 0.25;
    sim.ball.vx *= 0.92;
    sim.ball.vy *= 0.92;
    if (sim.goalFreezeTimer <= 0) {
      sim.goalPhase = 'none';
      sim.celebrationScorerSide = null;
      resetPositions(room);
      broadcastRoom(room, { type: 'sound_event', event: 'whistle' });
    }
    return;
  }

  sim.elapsed += dt;
  const regDuration = room.durationSeconds;

  if (!sim.inAddedTime) {
    if (sim.elapsed >= regDuration) {
      const extraMins = Math.min(5, 2 + Math.floor((sim.homeGoals + sim.awayGoals) * 0.6));
      sim.inAddedTime = true;
      sim.addedMinutesTotal = extraMins;
      sim.addedSecondsLeft = Math.max(8, extraMins * 3.5);
      broadcastRoom(room, {
        type: 'commentary',
        text: `Acréscimos! Mais ${extraMins} minutos de emoção nessa disputa online!`,
        priority: true,
        emotion: 'dramatic',
      });
    }
  } else {
    sim.addedSecondsLeft = Math.max(0, sim.addedSecondsLeft - dt);
    if (sim.addedSecondsLeft <= 0) {
      finishOnlineMatch(room);
      return;
    }
  }

  const ball = sim.ball;
  const inputs: [PlayerInputPacket, PlayerInputPacket] = [room.hostInput, room.guestInput];

  for (let i = 0; i < 2; i++) {
    const disc = sim.discs[i];
    const inp = inputs[i];

    if (disc.kickCooldown > 0) disc.kickCooldown = Math.max(0, disc.kickCooldown - dt);
    if (disc.kickGlow > 0) disc.kickGlow = Math.max(0, disc.kickGlow - dt * 4.5);
    if (disc.kickBuffer > 0) disc.kickBuffer = Math.max(0, disc.kickBuffer - dt);

    let ax = Number.isFinite(inp.ax) ? Math.max(-1, Math.min(1, inp.ax)) : 0;
    let ay = Number.isFinite(inp.ay) ? Math.max(-1, Math.min(1, inp.ay)) : 0;
    const mag = Math.hypot(ax, ay);
    if (mag > 1) {
      ax /= mag;
      ay /= mag;
    }

    if (inp.kick && disc.kickCooldown <= 0) {
      disc.kickBuffer = Math.max(disc.kickBuffer, 0.14);
      disc.kickGlow = 1;
    }

    const currentSpd = Math.hypot(disc.vx, disc.vy);
    if (currentSpd > 140) {
      disc.stamina = Math.max(15, disc.stamina - dt * 0.35);
    } else {
      disc.stamina = Math.min(100, disc.stamina + dt * 0.22);
    }

    const staminaFactor = disc.stamina >= 45 ? 1 : 0.88 + ((disc.stamina - 15) / 30) * 0.12;
    const paceFactor = 0.98 * staminaFactor;
    const maxAccel = 1350 * paceFactor;
    const maxSpeed = 285 * paceFactor;

    disc.vx += ax * maxAccel * dt;
    disc.vy += ay * maxAccel * dt;
    const damping = Math.pow(0.015, dt);
    disc.vx *= damping;
    disc.vy *= damping;

    const spd = Math.hypot(disc.vx, disc.vy);
    if (spd > maxSpeed) {
      disc.vx = (disc.vx / spd) * maxSpeed;
      disc.vy = (disc.vy / spd) * maxSpeed;
    }

    disc.x += disc.vx * dt;
    disc.y += disc.vy * dt;
    disc.kickAngle = Math.atan2(ball.y - disc.y, ball.x - disc.x);

    const minX = PITCH_X - 38 + disc.radius;
    const maxX = PITCH_X + PITCH_W + 38 - disc.radius;
    const minY = PITCH_Y - 38 + disc.radius;
    const maxY = PITCH_Y + PITCH_H + 38 - disc.radius;
    if (disc.x < minX) {
      disc.x = minX;
      disc.vx = Math.max(0, disc.vx);
    }
    if (disc.x > maxX) {
      disc.x = maxX;
      disc.vx = Math.min(0, disc.vx);
    }
    if (disc.y < minY) {
      disc.y = minY;
      disc.vy = Math.max(0, disc.vy);
    }
    if (disc.y > maxY) {
      disc.y = maxY;
      disc.vy = Math.min(0, disc.vy);
    }
  }

  // Disc-to-disc collision
  const [a, b] = sim.discs;
  {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const relN = rvx * nx + rvy * ny;
      if (relN < 0) {
        const jImp = -(1 + 0.52) * relN * 0.5;
        a.vx -= jImp * nx;
        a.vy -= jImp * ny;
        b.vx += jImp * nx;
        b.vy += jImp * ny;
      }
    }
  }

  // Disc-to-ball + kick
  for (const disc of sim.discs) {
    const dx = ball.x - disc.x;
    const dy = ball.y - disc.y;
    const dist = Math.hypot(dx, dy);
    const minDist = disc.radius + BALL_R;

    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      ball.x += nx * overlap * 0.85;
      ball.y += ny * overlap * 0.85;
      disc.x -= nx * overlap * 0.15;
      disc.y -= ny * overlap * 0.15;

      const rvx = ball.vx - disc.vx;
      const rvy = ball.vy - disc.vy;
      const relN = rvx * nx + rvy * ny;
      if (relN < 0) {
        const impulse = -(1 + 0.58) * relN;
        ball.vx += impulse * nx;
        ball.vy += impulse * ny;
      }
      ball.lastTouchedSide = disc.side;
      ball.lastTouchedName = disc.name;
    }

    if (disc.kickBuffer > 0 && disc.kickCooldown <= 0 && dist <= disc.radius + BALL_R + 18) {
      const kx = dist > 0.001 ? dx / dist : Math.cos(disc.kickAngle);
      const ky = dist > 0.001 ? dy / dist : Math.sin(disc.kickAngle);
      const kickPower = 735;
      ball.vx = disc.vx * 0.32 + kx * kickPower;
      ball.vy = disc.vy * 0.32 + ky * kickPower;
      ball.lastTouchedSide = disc.side;
      ball.lastTouchedName = disc.name;
      disc.kickBuffer = 0;
      disc.kickCooldown = 0.24;
      disc.kickGlow = 1;
      broadcastRoom(room, { type: 'sound_event', event: 'kick' });
    }
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  const ballDrag = Math.pow(0.45, dt);
  ball.vx *= ballDrag;
  ball.vy *= ballDrag;
  ball.spin += (Math.hypot(ball.vx, ball.vy) / 200) * dt * 6;

  // Goalposts
  const posts = [
    { x: PITCH_X, y: GOAL_TOP },
    { x: PITCH_X, y: GOAL_BOT },
    { x: PITCH_X + PITCH_W, y: GOAL_TOP },
    { x: PITCH_X + PITCH_W, y: GOAL_BOT },
  ];
  for (const post of posts) {
    const dx = ball.x - post.x;
    const dy = ball.y - post.y;
    const d = Math.hypot(dx, dy);
    const minD = BALL_R + POST_R;
    if (d < minD && d > 0.001) {
      const nx = dx / d;
      const ny = dy / d;
      ball.x = post.x + nx * minD;
      ball.y = post.y + ny * minD;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 1.85 * dot * nx;
        ball.vy -= 1.85 * dot * ny;
        broadcastRoom(room, { type: 'sound_event', event: 'post' });
      }
    }
  }

  const inGoalMouthY = ball.y > GOAL_TOP + BALL_R * 0.35 && ball.y < GOAL_BOT - BALL_R * 0.35;

  if (ball.y - BALL_R < PITCH_Y) {
    ball.y = PITCH_Y + BALL_R;
    ball.vy = Math.abs(ball.vy) * 0.84;
  } else if (ball.y + BALL_R > PITCH_Y + PITCH_H) {
    ball.y = PITCH_Y + PITCH_H - BALL_R;
    ball.vy = -Math.abs(ball.vy) * 0.84;
  }

  if (!inGoalMouthY) {
    if (ball.x - BALL_R < PITCH_X) {
      ball.x = PITCH_X + BALL_R;
      ball.vx = Math.abs(ball.vx) * 0.84;
    } else if (ball.x + BALL_R > PITCH_X + PITCH_W) {
      ball.x = PITCH_X + PITCH_W - BALL_R;
      ball.vx = -Math.abs(ball.vx) * 0.84;
    }
  } else {
    const triggerGoal = (scoringSide: 'home' | 'away') => {
      if (scoringSide === 'home') {
        sim.homeGoals += 1;
        sim.netRippleRight = 1;
      } else {
        sim.awayGoals += 1;
        sim.netRippleLeft = 1;
      }
      const scorerName =
        scoringSide === 'home' ? room.hostName : room.guestName || 'Visitante';
      const teamName = scoringSide === 'home' ? room.homeTeamName : room.awayTeamName;
      sim.scorers.push({ teamSide: scoringSide, playerName: scorerName, timeSec: Math.round(sim.elapsed) });
      sim.goalPhase = 'celebration';
      sim.goalFreezeTimer = 1.6;
      sim.celebrationScorerSide = scoringSide;

      broadcastRoom(room, {
        type: 'goal',
        scoringSide,
        scorer: scorerName,
        teamName,
        homeGoals: sim.homeGoals,
        awayGoals: sim.awayGoals,
      });
    };

    if (ball.x - BALL_R < PITCH_X - 4) {
      triggerGoal('away');
    } else if (ball.x + BALL_R > PITCH_X + PITCH_W + 4) {
      triggerGoal('home');
    }
  }

  // Clamp inside net
  if (ball.x < PITCH_X - GOAL_W + BALL_R) {
    ball.x = PITCH_X - GOAL_W + BALL_R;
    ball.vx = Math.abs(ball.vx) * 0.3;
  } else if (ball.x > PITCH_X + PITCH_W + GOAL_W - BALL_R) {
    ball.x = PITCH_X + PITCH_W + GOAL_W - BALL_R;
    ball.vx = -Math.abs(ball.vx) * 0.3;
  }
}

function startOnlineMatchLoop(room: OnlineRoomState) {
  stopRoomLoop(room);
  room.status = 'playing';
  db.prepare(`UPDATE match_rooms SET status = 'playing' WHERE code = ?`).run(room.code);
  room.sim = {
    discs: createInitialDiscs(room),
    ball: {
      x: PITCH_X + PITCH_W / 2,
      y: PITCH_Y + PITCH_H / 2,
      vx: 0,
      vy: 0,
      spin: 0,
      lastTouchedSide: 'home',
      lastTouchedName: room.hostName,
    },
    homeGoals: 0,
    awayGoals: 0,
    elapsed: 0,
    inAddedTime: false,
    addedMinutesTotal: 0,
    addedSecondsLeft: 0,
    goalPhase: 'none',
    goalFreezeTimer: 0,
    celebrationScorerSide: null,
    scorers: [],
    netRippleLeft: 0,
    netRippleRight: 0,
    finished: false,
  };
  room.tickCounter = 0;

  broadcastRoom(room, {
    type: 'match_started',
    room: {
      code: room.code,
      homeTeamId: room.homeTeamId,
      awayTeamId: room.awayTeamId,
      homeTeamName: room.homeTeamName,
      awayTeamName: room.awayTeamName,
      hostName: room.hostName,
      guestName: room.guestName,
      durationSeconds: room.durationSeconds,
    },
  });

  room.intervalId = setInterval(() => {
    stepRoomPhysics(room, 1 / 60);
    room.tickCounter += 1;
    if (room.sim && room.tickCounter % 2 === 0) {
      broadcastRoom(room, {
        type: 'state',
        homeGoals: room.sim.homeGoals,
        awayGoals: room.sim.awayGoals,
        elapsed: room.sim.elapsed,
        inAddedTime: room.sim.inAddedTime,
        addedMinutesTotal: room.sim.addedMinutesTotal,
        addedSecondsLeft: room.sim.addedSecondsLeft,
        goalPhase: room.sim.goalPhase,
        netRippleLeft: room.sim.netRippleLeft,
        netRippleRight: room.sim.netRippleRight,
        ball: {
          x: Math.round(room.sim.ball.x * 10) / 10,
          y: Math.round(room.sim.ball.y * 10) / 10,
          spin: Math.round(room.sim.ball.spin * 100) / 100,
        },
        discs: room.sim.discs.map((d) => ({
          side: d.side,
          x: Math.round(d.x * 10) / 10,
          y: Math.round(d.y * 10) / 10,
          kickGlow: Math.round(d.kickGlow * 100) / 100,
          kickAngle: Math.round(d.kickAngle * 100) / 100,
          stamina: Math.round(d.stamina),
          name: d.name,
        })),
      });
    }
  }, 1000 / 60);
}

export function attachMultiplayerWebSocket(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const type = msg.type;

        if (type === 'join_room') {
          const token = typeof msg.token === 'string' ? msg.token : '';
          const roomCode = typeof msg.roomCode === 'string' ? msg.roomCode.trim().toUpperCase() : '';
          const user = getUserByToken(token);
          if (!user) {
            sendJson(ws, { type: 'error', message: 'Sessão inválida. Faça login primeiro.' });
            return;
          }

          const dbRoom = getRoomByCode(roomCode);
          if (!dbRoom || dbRoom.status === 'finished') {
            sendJson(ws, { type: 'error', message: 'Sala não encontrada ou já encerrada.' });
            return;
          }

          let room = activeRooms.get(roomCode);
          if (!room) {
            room = {
              code: roomCode,
              hostUserId: dbRoom.host_user_id,
              hostName: dbRoom.host_name || 'Jogador 1',
              guestUserId: dbRoom.guest_user_id,
              guestName: dbRoom.guest_name || null,
              homeTeamId: dbRoom.host_team_id,
              awayTeamId: dbRoom.away_team_id,
              homeTeamName: typeof msg.homeTeamName === 'string' ? msg.homeTeamName : dbRoom.host_team_id.toUpperCase(),
              awayTeamName: typeof msg.awayTeamName === 'string' ? msg.awayTeamName : dbRoom.away_team_id.toUpperCase(),
              durationSeconds: dbRoom.duration_seconds,
              status: dbRoom.status,
              hostWs: null,
              guestWs: null,
              hostInput: { ax: 0, ay: 0, kick: false },
              guestInput: { ax: 0, ay: 0, kick: false },
              intervalId: null,
              tickCounter: 0,
              sim: null,
            };
            activeRooms.set(roomCode, room);
          }

          let side: 'home' | 'away' = 'home';
          if (user.id === room.hostUserId) {
            side = 'home';
            room.hostWs = ws;
            room.hostName = user.displayName;
          } else {
            if (room.guestUserId && room.guestUserId !== user.id && room.guestWs) {
              sendJson(ws, { type: 'error', message: 'Esta sala já está cheia (2 jogadores).' });
              return;
            }
            side = 'away';
            room.guestUserId = user.id;
            room.guestName = user.displayName;
            room.guestWs = ws;
            if (room.status === 'waiting') room.status = 'ready';
            db.prepare(`UPDATE match_rooms SET guest_user_id = ?, status = ? WHERE code = ?`).run(
              user.id,
              room.status === 'playing' ? 'playing' : 'ready',
              room.code
            );
          }

          socketMetaMap.set(ws, { user, roomCode, side });
          sendJson(ws, { type: 'joined', side, roomCode });
          broadcastLobbyState(room);
          return;
        }

        const meta = socketMetaMap.get(ws);
        if (!meta) return;
        const room = activeRooms.get(meta.roomCode);
        if (!room) return;

        if (type === 'select_team') {
          const teamId = typeof msg.teamId === 'string' ? msg.teamId : '';
          const teamName = typeof msg.teamName === 'string' ? msg.teamName : teamId.toUpperCase();
          if (meta.side === 'home' && teamId) {
            room.homeTeamId = teamId;
            room.homeTeamName = teamName;
            db.prepare('UPDATE match_rooms SET host_team_id = ? WHERE code = ?').run(teamId, room.code);
          } else if (meta.side === 'away' && teamId) {
            room.awayTeamId = teamId;
            room.awayTeamName = teamName;
            db.prepare('UPDATE match_rooms SET away_team_id = ? WHERE code = ?').run(teamId, room.code);
          }
          broadcastLobbyState(room);
          return;
        }

        if (type === 'start_match') {
          if (meta.side !== 'home') {
            sendJson(ws, { type: 'error', message: 'Apenas o criador da sala pode iniciar a partida.' });
            return;
          }
          if (!room.guestWs || !room.guestUserId) {
            sendJson(ws, { type: 'error', message: 'Aguardando o Jogador 2 entrar na sala.' });
            return;
          }
          if (typeof msg.homeTeamName === 'string') room.homeTeamName = msg.homeTeamName;
          if (typeof msg.awayTeamName === 'string') room.awayTeamName = msg.awayTeamName;
          startOnlineMatchLoop(room);
          return;
        }

        if (type === 'input') {
          const pkt: PlayerInputPacket = {
            ax: Number(msg.ax) || 0,
            ay: Number(msg.ay) || 0,
            kick: Boolean(msg.kick),
          };
          if (meta.side === 'home') room.hostInput = pkt;
          else room.guestInput = pkt;
          return;
        }
      } catch {
        // Ignore malformed packets safely
      }
    });

    ws.on('close', () => {
      const meta = socketMetaMap.get(ws);
      if (!meta) return;
      const room = activeRooms.get(meta.roomCode);
      if (!room) return;

      if (meta.side === 'home' && room.hostWs === ws) {
        room.hostWs = null;
      } else if (meta.side === 'away' && room.guestWs === ws) {
        room.guestWs = null;
        if (room.status === 'ready') {
          room.guestUserId = null;
          room.guestName = null;
          room.status = 'waiting';
          db.prepare(`UPDATE match_rooms SET guest_user_id = NULL, status = 'waiting' WHERE code = ?`).run(
            room.code
          );
          broadcastLobbyState(room);
        }
      }

      if (room.status === 'playing' && (!room.hostWs || !room.guestWs)) {
        stopRoomLoop(room);
        room.status = 'finished';
        db.prepare(`UPDATE match_rooms SET status = 'finished' WHERE code = ?`).run(room.code);
        broadcastRoom(room, {
          type: 'opponent_disconnected',
          message: 'O outro jogador desconectou da sala.',
        });
      }

      if (!room.hostWs && !room.guestWs) {
        stopRoomLoop(room);
        activeRooms.delete(room.code);
      }
    });
  });

  return wss;
}
