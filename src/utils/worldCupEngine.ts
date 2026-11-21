import { WORLD_CUP_TEAMS } from '../data/worldCupTeams';
import {
  MatchResult,
  Team,
  WorldCupGroup,
  WorldCupGroupMatch,
  WorldCupKnockoutMatch,
  WorldCupStanding,
  WorldCupState,
} from '../types/game';

const WC_STORAGE_PREFIX = 'arenabola_worldcup_v2';

function getWcStorageKey(userId?: string) {
  return userId ? `${WC_STORAGE_PREFIX}_${userId}` : WC_STORAGE_PREFIX;
}

export function loadWorldCupLocal(userId?: string): WorldCupState | null {
  try {
    const raw = localStorage.getItem(getWcStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorldCupState;
    if (!parsed || !Array.isArray(parsed.groups) || parsed.groups.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorldCupLocal(wc: WorldCupState | null, userId?: string) {
  try {
    const key = getWcStorageKey(userId);
    if (!wc) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(wc));
  } catch {
    // ignore
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getTeamOvr(teamId: string): number {
  return WORLD_CUP_TEAMS.find((t) => t.id === teamId)?.ovr ?? 80;
}

function simulateScore(homeId: string, awayId: string, allowDraw: boolean): {
  homeGoals: number;
  awayGoals: number;
  winnerId: string | null;
  decidedByPenalties?: boolean;
  penaltySummary?: string;
} {
  const hOvr = getTeamOvr(homeId);
  const aOvr = getTeamOvr(awayId);
  const diff = (hOvr - aOvr) * 0.055;

  const sampleGoals = (bias: number) => {
    const r = Math.random();
    const base = Math.max(0.25, 1.35 + bias);
    if (r < 0.22 / Math.max(0.5, base)) return 0;
    if (r < 0.56 / Math.max(0.65, base * 0.85)) return 1;
    if (r < 0.83) return 2;
    if (r < 0.95) return 3;
    return 4;
  };

  const homeGoals = sampleGoals(diff);
  const awayGoals = sampleGoals(-diff);

  if (homeGoals !== awayGoals || allowDraw) {
    return {
      homeGoals,
      awayGoals,
      winnerId: homeGoals > awayGoals ? homeId : awayGoals > homeGoals ? awayId : null,
    };
  }

  // Knockout tie -> simulated penalties weighted slightly by OVR
  const homePenEdge = 0.5 + (hOvr - aOvr) * 0.015;
  const homeWinsPen = Math.random() < homePenEdge;
  const penWin = 4 + Math.floor(Math.random() * 2);
  const penLose = Math.max(2, penWin - (1 + Math.floor(Math.random() * 2)));
  return {
    homeGoals,
    awayGoals,
    winnerId: homeWinsPen ? homeId : awayId,
    decidedByPenalties: true,
    penaltySummary: homeWinsPen
      ? `${penWin} x ${penLose} nos pênaltis`
      : `${penLose} x ${penWin} nos pênaltis`,
  };
}

export function sortGroupStandings(standings: WorldCupStanding[]): WorldCupStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const sgA = a.goalsFor - a.goalsAgainst;
    const sgB = b.goalsFor - b.goalsAgainst;
    if (sgB !== sgA) return sgB - sgA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamId.localeCompare(b.teamId);
  });
}

function recalculateGroupStandings(teamIds: string[], matches: WorldCupGroupMatch[]): WorldCupStanding[] {
  const map = new Map<string, WorldCupStanding>();
  for (const tid of teamIds) {
    map.set(tid, {
      teamId: tid,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (!m.played || m.homeGoals === undefined || m.awayGoals === undefined) continue;
    const h = map.get(m.homeTeamId);
    const a = map.get(m.awayTeamId);
    if (!h || !a) continue;

    h.played += 1;
    a.played += 1;
    h.goalsFor += m.homeGoals;
    h.goalsAgainst += m.awayGoals;
    a.goalsFor += m.awayGoals;
    a.goalsAgainst += m.homeGoals;

    if (m.homeGoals > m.awayGoals) {
      h.won += 1;
      h.points += 3;
      a.lost += 1;
    } else if (m.awayGoals > m.homeGoals) {
      a.won += 1;
      a.points += 3;
      h.lost += 1;
    } else {
      h.drawn += 1;
      a.drawn += 1;
      h.points += 1;
      a.points += 1;
    }
  }

  return sortGroupStandings(Array.from(map.values()));
}

export function createNewWorldCup(userTeamId: string): WorldCupState {
  // Seeded pots of 8 teams each by OVR so groups are balanced and realistic
  const sorted = [...WORLD_CUP_TEAMS].sort((a, b) => b.ovr - a.ovr);
  const pot1 = shuffle(sorted.slice(0, 8));
  const pot2 = shuffle(sorted.slice(8, 16));
  const pot3 = shuffle(sorted.slice(16, 24));
  const pot4 = shuffle(sorted.slice(24, 32));

  const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const groups: WorldCupGroup[] = groupNames.map((name, idx) => {
    const teamIds = [pot1[idx].id, pot2[idx].id, pot3[idx].id, pot4[idx].id];
    const [t0, t1, t2, t3] = teamIds;
    const matches: WorldCupGroupMatch[] = [
      { id: `wc-${name}-r1-1`, groupName: name, round: 1, homeTeamId: t0, awayTeamId: t1, played: false },
      { id: `wc-${name}-r1-2`, groupName: name, round: 1, homeTeamId: t2, awayTeamId: t3, played: false },
      { id: `wc-${name}-r2-1`, groupName: name, round: 2, homeTeamId: t0, awayTeamId: t2, played: false },
      { id: `wc-${name}-r2-2`, groupName: name, round: 2, homeTeamId: t3, awayTeamId: t1, played: false },
      { id: `wc-${name}-r3-1`, groupName: name, round: 3, homeTeamId: t3, awayTeamId: t0, played: false },
      { id: `wc-${name}-r3-2`, groupName: name, round: 3, homeTeamId: t1, awayTeamId: t2, played: false },
    ];
    return {
      name,
      teamIds,
      standings: recalculateGroupStandings(teamIds, matches),
      matches,
    };
  });

  const wc: WorldCupState = {
    id: `wc-${Date.now()}`,
    userTeamId,
    currentStage: 'group',
    currentGroupRound: 1,
    groups,
    knockoutMatches: [],
    championTeamId: null,
    userEliminated: false,
    rewardClaimed: false,
  };
  saveWorldCupLocal(wc);
  return wc;
}

function buildRoundOf16FromGroups(groups: WorldCupGroup[]): WorldCupKnockoutMatch[] {
  const byName = new Map<string, WorldCupStanding[]>();
  for (const g of groups) {
    byName.set(g.name, sortGroupStandings(g.standings));
  }
  const first = (g: string) => byName.get(g)?.[0]?.teamId ?? null;
  const second = (g: string) => byName.get(g)?.[1]?.teamId ?? null;

  const r16Pairs: [string | null, string | null][] = [
    [first('A'), second('B')],
    [first('C'), second('D')],
    [first('E'), second('F')],
    [first('G'), second('H')],
    [first('B'), second('A')],
    [first('D'), second('C')],
    [first('F'), second('E')],
    [first('H'), second('G')],
  ];

  const r16: WorldCupKnockoutMatch[] = r16Pairs.map(([h, a], idx) => ({
    id: `wc-r16-${idx}`,
    stage: 'round_of_16',
    slotIndex: idx,
    homeTeamId: h,
    awayTeamId: a,
    played: false,
  }));

  const qf: WorldCupKnockoutMatch[] = [0, 1, 2, 3].map((idx) => ({
    id: `wc-qf-${idx}`,
    stage: 'quarter',
    slotIndex: idx,
    homeTeamId: null,
    awayTeamId: null,
    played: false,
  }));

  const sf: WorldCupKnockoutMatch[] = [0, 1].map((idx) => ({
    id: `wc-sf-${idx}`,
    stage: 'semi',
    slotIndex: idx,
    homeTeamId: null,
    awayTeamId: null,
    played: false,
  }));

  const finalMatch: WorldCupKnockoutMatch = {
    id: 'wc-final-0',
    stage: 'final',
    slotIndex: 0,
    homeTeamId: null,
    awayTeamId: null,
    played: false,
  };

  return [...r16, ...qf, ...sf, finalMatch];
}

function propagateBracket(matches: WorldCupKnockoutMatch[]): WorldCupKnockoutMatch[] {
  const next = matches.map((m) => ({ ...m }));
  const findMatch = (stage: WorldCupKnockoutMatch['stage'], slot: number) =>
    next.find((m) => m.stage === stage && m.slotIndex === slot);

  for (let i = 0; i < 4; i++) {
    const mA = findMatch('round_of_16', i * 2);
    const mB = findMatch('round_of_16', i * 2 + 1);
    const qf = findMatch('quarter', i);
    if (qf) {
      if (mA?.played && mA.winnerId) qf.homeTeamId = mA.winnerId;
      if (mB?.played && mB.winnerId) qf.awayTeamId = mB.winnerId;
    }
  }

  for (let i = 0; i < 2; i++) {
    const qA = findMatch('quarter', i * 2);
    const qB = findMatch('quarter', i * 2 + 1);
    const sf = findMatch('semi', i);
    if (sf) {
      if (qA?.played && qA.winnerId) sf.homeTeamId = qA.winnerId;
      if (qB?.played && qB.winnerId) sf.awayTeamId = qB.winnerId;
    }
  }

  const s0 = findMatch('semi', 0);
  const s1 = findMatch('semi', 1);
  const fin = findMatch('final', 0);
  if (fin) {
    if (s0?.played && s0.winnerId) fin.homeTeamId = s0.winnerId;
    if (s1?.played && s1.winnerId) fin.awayTeamId = s1.winnerId;
  }

  return next;
}

function refreshWorldCupStage(wc: WorldCupState): WorldCupState {
  if (wc.currentStage === 'group') {
    const allPlayedInRound = wc.groups.every((g) =>
      g.matches.filter((m) => m.round === wc.currentGroupRound).every((m) => m.played)
    );
    if (!allPlayedInRound) return wc;

    if (wc.currentGroupRound < 3) {
      return { ...wc, currentGroupRound: wc.currentGroupRound + 1 };
    }

    // All 3 group rounds completed -> advance to Round of 16
    const bracket = buildRoundOf16FromGroups(wc.groups);
    const r16Teams = new Set(bracket.filter((m) => m.stage === 'round_of_16').flatMap((m) => [m.homeTeamId, m.awayTeamId]));
    const eliminated = !r16Teams.has(wc.userTeamId);
    return {
      ...wc,
      currentStage: 'round_of_16',
      knockoutMatches: bracket,
      userEliminated: eliminated,
    };
  }

  const stageOrder: ('round_of_16' | 'quarter' | 'semi' | 'final')[] = [
    'round_of_16',
    'quarter',
    'semi',
    'final',
  ];

  const propagated = propagateBracket(wc.knockoutMatches);
  const activeStage = wc.currentStage;
  if (activeStage === 'completed') return { ...wc, knockoutMatches: propagated };

  const currentStageMatches = propagated.filter((m) => m.stage === activeStage);
  const allPlayed = currentStageMatches.length > 0 && currentStageMatches.every((m) => m.played);

  if (!allPlayed) {
    return { ...wc, knockoutMatches: propagated };
  }

  if (activeStage === 'final') {
    const finalM = currentStageMatches[0];
    return {
      ...wc,
      currentStage: 'completed',
      knockoutMatches: propagated,
      championTeamId: finalM?.winnerId ?? null,
      userEliminated: finalM?.winnerId !== wc.userTeamId,
    };
  }

  const idx = stageOrder.indexOf(activeStage);
  const nextStage = stageOrder[idx + 1];
  const nextMatches = propagated.filter((m) => m.stage === nextStage);
  const stillIn = nextMatches.some(
    (m) => m.homeTeamId === wc.userTeamId || m.awayTeamId === wc.userTeamId
  );

  return {
    ...wc,
    currentStage: nextStage,
    knockoutMatches: propagated,
    userEliminated: !stillIn,
  };
}

export function getUserNextWorldCupMatch(wc: WorldCupState): {
  kind: 'group' | 'knockout';
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  label: string;
} | null {
  if (wc.currentStage === 'completed' || wc.userEliminated) return null;

  if (wc.currentStage === 'group') {
    for (const g of wc.groups) {
      const m = g.matches.find(
        (gm) =>
          gm.round === wc.currentGroupRound &&
          !gm.played &&
          (gm.homeTeamId === wc.userTeamId || gm.awayTeamId === wc.userTeamId)
      );
      if (m) {
        return {
          kind: 'group',
          matchId: m.id,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          label: `Copa do Mundo · Grupo ${g.name} · Rodada ${m.round}`,
        };
      }
    }
    return null;
  }

  const stageNames: Record<string, string> = {
    round_of_16: 'Oitavas de Final',
    quarter: 'Quartas de Final',
    semi: 'Semifinal',
    final: 'Grande Final da Copa do Mundo',
  };

  const km = wc.knockoutMatches.find(
    (m) =>
      m.stage === wc.currentStage &&
      !m.played &&
      (m.homeTeamId === wc.userTeamId || m.awayTeamId === wc.userTeamId)
  );
  if (km && km.homeTeamId && km.awayTeamId) {
    return {
      kind: 'knockout',
      matchId: km.id,
      homeTeamId: km.homeTeamId,
      awayTeamId: km.awayTeamId,
      label: `Copa do Mundo · ${stageNames[km.stage] || km.stage}`,
    };
  }
  return null;
}

export function applyWorldCupUserMatchResult(wc: WorldCupState, result: MatchResult): WorldCupState {
  if (!result.worldCupMatchId) return wc;

  if (wc.currentStage === 'group') {
    const groups = wc.groups.map((g) => {
      let touched = false;
      const matches = g.matches.map((m) => {
        if (m.id === result.worldCupMatchId) {
          touched = true;
          return {
            ...m,
            played: true,
            homeGoals: result.homeGoals,
            awayGoals: result.awayGoals,
          };
        }
        // Auto-simulate remaining matches of the same round!
        if (m.round === wc.currentGroupRound && !m.played && m.homeTeamId !== wc.userTeamId && m.awayTeamId !== wc.userTeamId) {
          const sim = simulateScore(m.homeTeamId, m.awayTeamId, true);
          touched = true;
          return {
            ...m,
            played: true,
            homeGoals: sim.homeGoals,
            awayGoals: sim.awayGoals,
          };
        }
        return m;
      });
      if (!touched) return g;
      return {
        ...g,
        matches,
        standings: recalculateGroupStandings(g.teamIds, matches),
      };
    });

    const updated = refreshWorldCupStage({ ...wc, groups });
    saveWorldCupLocal(updated);
    return updated;
  }

  // Knockout stage: apply user match and auto-simulate all other matches of same stage
  const stage = wc.currentStage;
  const knockoutMatches = wc.knockoutMatches.map((m) => {
    if (m.id === result.worldCupMatchId && m.homeTeamId && m.awayTeamId) {
      const winnerId =
        result.winnerSide === 'home'
          ? m.homeTeamId
          : result.winnerSide === 'away'
            ? m.awayTeamId
            : m.homeTeamId;
      return {
        ...m,
        played: true,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        winnerId,
        decidedByPenalties: Boolean(result.penaltySummary),
        penaltySummary: result.penaltySummary,
      };
    }
    if (m.stage === stage && !m.played && m.homeTeamId && m.awayTeamId) {
      const sim = simulateScore(m.homeTeamId, m.awayTeamId, false);
      return {
        ...m,
        played: true,
        homeGoals: sim.homeGoals,
        awayGoals: sim.awayGoals,
        winnerId: sim.winnerId,
        decidedByPenalties: sim.decidedByPenalties,
        penaltySummary: sim.penaltySummary,
      };
    }
    return m;
  });

  const updated = refreshWorldCupStage({ ...wc, knockoutMatches });
  saveWorldCupLocal(updated);
  return updated;
}

export function simulateCurrentWorldCupRound(wc: WorldCupState): WorldCupState {
  if (wc.currentStage === 'completed') return wc;

  if (wc.currentStage === 'group') {
    const groups = wc.groups.map((g) => {
      const matches = g.matches.map((m) => {
        if (m.round !== wc.currentGroupRound || m.played) return m;
        const sim = simulateScore(m.homeTeamId, m.awayTeamId, true);
        return {
          ...m,
          played: true,
          homeGoals: sim.homeGoals,
          awayGoals: sim.awayGoals,
        };
      });
      return {
        ...g,
        matches,
        standings: recalculateGroupStandings(g.teamIds, matches),
      };
    });
    const updated = refreshWorldCupStage({ ...wc, groups });
    saveWorldCupLocal(updated);
    return updated;
  }

  const stage = wc.currentStage;
  const knockoutMatches = wc.knockoutMatches.map((m) => {
    if (m.stage !== stage || m.played || !m.homeTeamId || !m.awayTeamId) return m;
    const sim = simulateScore(m.homeTeamId, m.awayTeamId, false);
    return {
      ...m,
      played: true,
      homeGoals: sim.homeGoals,
      awayGoals: sim.awayGoals,
      winnerId: sim.winnerId,
      decidedByPenalties: sim.decidedByPenalties,
      penaltySummary: sim.penaltySummary,
    };
  });

  const updated = refreshWorldCupStage({ ...wc, knockoutMatches });
  saveWorldCupLocal(updated);
  return updated;
}

export function getWorldCupTeamById(id: string | null | undefined): Team | undefined {
  if (!id) return undefined;
  return WORLD_CUP_TEAMS.find((t) => t.id === id);
}
