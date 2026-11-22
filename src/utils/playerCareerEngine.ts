import { LEAGUES } from '../data/teams2027';
import { CELEBRITY_BY_ID } from '../data/theGroundsData';
import {
  LeagueId,
  LeagueStanding,
  MatchResult,
  Player,
  PlayerCareerFixture,
  PlayerCareerModeType,
  PlayerCareerOffer,
  PlayerCareerState,
  PlayerPosition,
  Team,
  TheGroundsState,
} from '../types/game';

const PLAYER_CAREER_PREFIX = 'arenabola_player_career_v1';

function getStorageKey(userId?: string) {
  return userId ? `${PLAYER_CAREER_PREFIX}_${userId}` : PLAYER_CAREER_PREFIX;
}

export function loadPlayerCareer(userId?: string): PlayerCareerState | null {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerCareerState;
    if (!parsed || !parsed.player || !parsed.stage) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlayerCareer(state: PlayerCareerState | null, userId?: string) {
  try {
    const key = getStorageKey(userId);
    if (!state) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function clearPlayerCareer(userId?: string) {
  savePlayerCareer(null, userId);
}

export function computeOverallForPlayer(p: Player): number {
  const def = p.def ?? 58;
  const fis = p.fis ?? 66;
  if (p.position === 'ATA') {
    return Math.min(99, Math.round(p.shot * 0.36 + p.pace * 0.34 + p.pass * 0.16 + fis * 0.08 + def * 0.06));
  }
  if (p.position === 'MEI') {
    return Math.min(99, Math.round(p.pass * 0.34 + p.pace * 0.24 + p.shot * 0.24 + def * 0.1 + fis * 0.08));
  }
  return Math.min(99, Math.round(def * 0.38 + fis * 0.22 + p.pass * 0.2 + p.pace * 0.14 + p.shot * 0.06));
}

function buildStarterAttributes(pos: PlayerPosition): Pick<Player, 'pace' | 'shot' | 'pass' | 'def' | 'fis'> {
  if (pos === 'ATA') return { pace: 68, shot: 66, pass: 58, def: 46, fis: 64 };
  if (pos === 'MEI') return { pace: 64, shot: 61, pass: 68, def: 56, fis: 64 };
  return { pace: 61, shot: 50, pass: 60, def: 69, fis: 68 };
}

export function createDefaultGroundsState(): TheGroundsState {
  return {
    playerX: 460,
    playerY: 740,
    fame: 10,
    metCelebrityIds: [],
    completedCelebrityIds: [],
    activePartnerCelebrityId: null,
    futsalWins: 0,
    futsalGoals: 0,
    stadiumChallengeWins: 0,
    lastNotice: 'Bem-vindo ao The Grounds! Explore ruas, quadra de futsal, estádios e conheça os famosos.',
  };
}

export function ensureGroundsState(state: PlayerCareerState): PlayerCareerState {
  if (state.grounds && state.careerModeType === 'the_grounds') return state;
  return {
    ...state,
    careerModeType: 'the_grounds',
    grounds: state.grounds || createDefaultGroundsState(),
  };
}

export function createPlayerCareer(input: {
  name: string;
  nationality: string;
  position: PlayerPosition;
  number: number;
  trailColor: string;
  trialClubId: string;
  allTeams: Team[];
  careerModeType?: PlayerCareerModeType;
}): PlayerCareerState {
  const cleanName = input.name.trim().slice(0, 22) || 'Craque da Rua';
  const parts = cleanName.split(/\s+/);
  const shortName = parts.length > 1 ? `${parts[0].charAt(0)}. ${parts[parts.length - 1]}` : cleanName;

  const baseStats = buildStarterAttributes(input.position);
  const player: Player = {
    id: `pc-hero-${Date.now()}`,
    name: cleanName,
    shortName: shortName.slice(0, 14),
    number: Math.max(1, Math.min(99, Math.round(input.number || 10))),
    position: input.position,
    ovr: 62,
    pace: baseStats.pace,
    shot: baseStats.shot,
    pass: baseStats.pass,
    def: baseStats.def,
    fis: baseStats.fis,
    stamina: 100,
    age: 17,
    nationality: input.nationality || 'BRA',
    valueMillions: 1.5,
  };
  player.ovr = computeOverallForPlayer(player);

  const trialTeam = input.allTeams.find((t) => t.id === input.trialClubId) || input.allTeams[0];
  const scouts = ['Olheiro Marcos Silva', 'Olheiro Dedé Carioca', 'Olheiro Rodrigo Caetano Jr.'];
  const scoutName = scouts[Math.floor(Math.random() * scouts.length)];
  const modeType: PlayerCareerModeType = input.careerModeType || 'normal';

  return {
    id: `pc-${Date.now()}`,
    careerModeType: modeType,
    stage: 'street',
    player,
    trailColor: input.trailColor || '#FACC15',
    xp: 0,
    skillPoints: 1,
    scoutName,
    scoutInterest: 15,
    streetMatchesPlayed: 0,
    streetWins: 0,
    streetGoals: 0,
    trialClubId: trialTeam.id,
    trialAttempts: 0,
    trialTargetGoals: 1,
    trialPassed: false,
    lastTrialFeedback: null,
    clubId: trialTeam.id,
    leagueId: trialTeam.leagueId,
    season: 2027,
    currentRound: 1,
    totalRounds: 10,
    managerTrust: 65,
    squadStatus: 'Base / Reserva',
    weeklyWage: 12,
    totalMatches: 0,
    totalGoals: 0,
    totalWins: 0,
    avgRating: 6.5,
    trophies: [],
    standings: [],
    fixtures: [],
    offers: [],
    history: [],
    grounds: createDefaultGroundsState(),
  };
}

export function calculateMatchRating(result: MatchResult, userTeamGoals: number, oppGoals: number): number {
  const stats = result.matchStats || { humanTouches: 6, humanShots: 2, humanDribbles: 2 };
  const won = result.winnerSide === 'home';
  const draw = result.winnerSide === 'draw';
  let rating = 6.0;
  rating += Math.min(2.4, userTeamGoals * 0.95);
  rating += won ? 1.0 : draw ? 0.35 : -0.45;
  rating += Math.min(0.6, stats.humanTouches * 0.04 + stats.humanShots * 0.12);
  rating -= Math.min(0.8, oppGoals * 0.22);
  return Math.round(Math.max(4.8, Math.min(10.0, rating)) * 10) / 10;
}

export function buildProSeasonSchedule(club: Team, allTeams: Team[], season: number): {
  standings: LeagueStanding[];
  fixtures: PlayerCareerFixture[];
  totalRounds: number;
} {
  let leagueTeams = allTeams.filter((t) => t.leagueId === club.leagueId);
  if (leagueTeams.length < 4) {
    leagueTeams = allTeams.slice(0, 8);
  }
  const standings: LeagueStanding[] = leagueTeams.map((t) => ({
    teamId: t.id,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));

  const opponents = leagueTeams.filter((t) => t.id !== club.id);
  const totalRounds = Math.min(10, Math.max(6, opponents.length));
  const fixtures: PlayerCareerFixture[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const opp = opponents[(r - 1) % opponents.length];
    fixtures.push({
      id: `pcf-${season}-${r}-${opp.id}`,
      round: r,
      opponentId: opp.id,
      opponentName: opp.name,
      isHome: r % 2 === 1,
      played: false,
    });
  }
  return { standings, fixtures, totalRounds };
}

function generateOffersForPlayer(state: PlayerCareerState, allTeams: Team[]): PlayerCareerOffer[] {
  const currentClub = allTeams.find((t) => t.id === state.clubId);
  const minClubOvr = Math.min(89, Math.max(74, state.player.ovr + 4));
  const candidates = allTeams
    .filter((t) => t.id !== state.clubId && !t.isNationalTeam && t.ovr >= minClubOvr - 4)
    .sort((a, b) => Math.abs(b.ovr - state.player.ovr) - Math.abs(a.ovr - state.player.ovr))
    .slice(0, 3);

  return candidates.map((t, i) => ({
    id: `offer-${state.season}-${t.id}-${i}`,
    clubId: t.id,
    clubName: t.name,
    leagueId: t.leagueId,
    clubOvr: t.ovr,
    roleLabel: t.ovr > (currentClub?.ovr || 78) ? 'Titular da Equipe' : 'Camisa 10 & Capitão',
    weeklyWage: Math.round(state.weeklyWage * (1.25 + i * 0.2) + t.ovr * 0.35),
    bonusCoins: 300 + i * 150,
  }));
}

export function applyStreetMatchResult(state: PlayerCareerState, result: MatchResult): PlayerCareerState {
  const won = result.winnerSide === 'home';
  const goals = result.homeGoals;
  const rating = calculateMatchRating(result, result.homeGoals, result.awayGoals);
  const interestGain = (won ? 42 : 20) + Math.min(35, goals * 14) + (rating >= 7.5 ? 18 : 6);
  const nextInterest = Math.min(100, state.scoutInterest + interestGain);
  const xpGain = 45 + goals * 25 + (won ? 30 : 10);
  const totalXp = state.xp + xpGain;
  const gainedPoints = (rating >= 7.0 ? 1 : 0) + (won ? 1 : 0);
  const fameGain = (won ? 28 : 12) + goals * 6;
  const nextGrounds: TheGroundsState | undefined = state.grounds
    ? {
        ...state.grounds,
        fame: state.grounds.fame + fameGain,
        lastNotice: won
          ? `Vitória na Pelada de Rua! +${fameGain} Fama e Olheiro em ${nextInterest}%.`
          : `Fim da pelada na rua! +${fameGain} Fama e Olheiro em ${nextInterest}%.`,
      }
    : undefined;

  return {
    ...state,
    xp: totalXp,
    skillPoints: state.skillPoints + gainedPoints,
    scoutInterest: nextInterest,
    streetMatchesPlayed: state.streetMatchesPlayed + 1,
    streetWins: state.streetWins + (won ? 1 : 0),
    streetGoals: state.streetGoals + goals,
    totalMatches: state.totalMatches + 1,
    totalGoals: state.totalGoals + goals,
    totalWins: state.totalWins + (won ? 1 : 0),
    grounds: nextGrounds,
    history: [
      {
        id: `pch-${Date.now()}`,
        round: state.streetMatchesPlayed + 1,
        stage: 'street',
        opponentName: 'Pelada do Bairro',
        teamGoals: result.homeGoals,
        oppGoals: result.awayGoals,
        playerGoals: goals,
        rating,
        won,
        label: 'Pelada na Rua (Asfalto)',
      },
      ...state.history.slice(0, 24),
    ],
  };
}

export function interactWithGroundsCelebrity(state: PlayerCareerState, celebId: string): PlayerCareerState {
  const celeb = CELEBRITY_BY_ID[celebId];
  const baseGrounds = state.grounds || createDefaultGroundsState();
  if (!celeb) return state;

  const alreadyMet = baseGrounds.metCelebrityIds.includes(celebId);
  if (alreadyMet) return state;

  return {
    ...state,
    xp: state.xp + 40,
    skillPoints: state.skillPoints + 1,
    scoutInterest: Math.min(100, state.scoutInterest + 10),
    grounds: {
      ...baseGrounds,
      fame: baseGrounds.fame + 20,
      metCelebrityIds: [...baseGrounds.metCelebrityIds, celebId],
      lastNotice: `Você conheceu ${celeb.name}! +20 Fama, +40 XP e +1 Ponto de Habilidade.`,
    },
  };
}

export function applyGroundsFutsalResult(state: PlayerCareerState, result: MatchResult): PlayerCareerState {
  const won = result.winnerSide === 'home';
  const goals = result.homeGoals;
  const rating = calculateMatchRating(result, result.homeGoals, result.awayGoals);
  const xpGain = 55 + goals * 25 + (won ? 35 : 10);
  const gainedPoints = (rating >= 7.0 ? 1 : 0) + (won ? 1 : 0);
  const fameGain = (won ? 35 : 14) + goals * 7;
  const interestGain = won ? 30 : 14;
  const baseGrounds = state.grounds || createDefaultGroundsState();

  return {
    ...state,
    xp: state.xp + xpGain,
    skillPoints: state.skillPoints + gainedPoints,
    scoutInterest: Math.min(100, state.scoutInterest + interestGain),
    totalMatches: state.totalMatches + 1,
    totalGoals: state.totalGoals + goals,
    totalWins: state.totalWins + (won ? 1 : 0),
    grounds: {
      ...baseGrounds,
      fame: baseGrounds.fame + fameGain,
      futsalWins: baseGrounds.futsalWins + (won ? 1 : 0),
      futsalGoals: baseGrounds.futsalGoals + goals,
      lastNotice: won
        ? `Show na Quadra de Futsal! +${fameGain} Fama e +${gainedPoints} Ponto(s).`
        : `Partida encerrada na Arena Futsal! +${fameGain} Fama.`,
    },
    history: [
      {
        id: `pch-${Date.now()}`,
        round: state.totalMatches + 1,
        stage: state.stage,
        opponentName: 'Desafio Futsal Pro',
        teamGoals: result.homeGoals,
        oppGoals: result.awayGoals,
        playerGoals: goals,
        rating,
        won,
        label: 'Arena Futsal · The Grounds',
      },
      ...state.history.slice(0, 24),
    ],
  };
}

export function applyGroundsCelebrityResult(
  state: PlayerCareerState,
  celebId: string,
  result: MatchResult
): PlayerCareerState {
  const celeb = CELEBRITY_BY_ID[celebId];
  const won = result.winnerSide === 'home';
  const goals = result.homeGoals;
  const rating = calculateMatchRating(result, result.homeGoals, result.awayGoals);
  const baseGrounds = state.grounds || createDefaultGroundsState();
  const firstCompletion = won && !baseGrounds.completedCelebrityIds.includes(celebId);

  const rewardFame = won ? (celeb?.rewardFame ?? 55) : 18;
  const rewardPoints = firstCompletion ? (celeb?.rewardSkillPoints ?? 2) : won ? 1 : 0;
  const xpGain = 70 + goals * 28 + (won ? 50 : 15);
  const metList = baseGrounds.metCelebrityIds.includes(celebId)
    ? baseGrounds.metCelebrityIds
    : [...baseGrounds.metCelebrityIds, celebId];
  const completedList =
    won && !baseGrounds.completedCelebrityIds.includes(celebId)
      ? [...baseGrounds.completedCelebrityIds, celebId]
      : baseGrounds.completedCelebrityIds;

  return {
    ...state,
    xp: state.xp + xpGain,
    skillPoints: state.skillPoints + rewardPoints,
    scoutInterest: Math.min(100, state.scoutInterest + (won ? 35 : 15)),
    totalMatches: state.totalMatches + 1,
    totalGoals: state.totalGoals + goals,
    totalWins: state.totalWins + (won ? 1 : 0),
    grounds: {
      ...baseGrounds,
      fame: baseGrounds.fame + rewardFame,
      metCelebrityIds: metList,
      completedCelebrityIds: completedList,
      activePartnerCelebrityId: won ? celebId : baseGrounds.activePartnerCelebrityId,
      stadiumChallengeWins: baseGrounds.stadiumChallengeWins + (won ? 1 : 0),
      lastNotice: won
        ? `Você venceu o desafio de ${celeb?.name || 'Famoso'}! ${celeb?.shortName || ''} agora pode jogar como seu parceiro 2v2!`
        : `Bom jogo contra ${celeb?.name || 'Famoso'}! Ganhou +${rewardFame} Fama e XP.`,
    },
    history: [
      {
        id: `pch-${Date.now()}`,
        round: state.totalMatches + 1,
        stage: state.stage,
        opponentName: celeb?.teamName || 'Time dos Famosos',
        teamGoals: result.homeGoals,
        oppGoals: result.awayGoals,
        playerGoals: goals,
        rating,
        won,
        label: `Desafio · ${celeb?.name || 'Famoso'}`,
      },
      ...state.history.slice(0, 24),
    ],
  };
}

export function applyTrialMatchResult(
  state: PlayerCareerState,
  result: MatchResult,
  allTeams: Team[]
): PlayerCareerState {
  const won = result.winnerSide === 'home';
  const goals = result.homeGoals;
  const rating = calculateMatchRating(result, result.homeGoals, result.awayGoals);
  const passed = won || (rating >= 7.0 && goals >= state.trialTargetGoals);
  const xpGain = passed ? 120 : 50;

  if (!passed) {
    return {
      ...state,
      xp: state.xp + xpGain,
      skillPoints: state.skillPoints + 1,
      trialAttempts: state.trialAttempts + 1,
      trialPassed: false,
      lastTrialFeedback: `Nota ${rating.toFixed(1)} · ${result.homeGoals}x${result.awayGoals}. O técnico pediu vitória ou Nota 7.0+ com ${state.trialTargetGoals} gol(s). Treine seus atributos e tente a peneira novamente!`,
      totalMatches: state.totalMatches + 1,
      totalGoals: state.totalGoals + goals,
      history: [
        {
          id: `pch-${Date.now()}`,
          round: state.trialAttempts + 1,
          stage: 'trial',
          opponentName: 'Time Sub-20 (Peneira)',
          teamGoals: result.homeGoals,
          oppGoals: result.awayGoals,
          playerGoals: goals,
          rating,
          won,
          label: 'Teste Oficial (Peneira)',
        },
        ...state.history.slice(0, 24),
      ],
    };
  }

  const club = allTeams.find((t) => t.id === state.trialClubId) || allTeams[0];
  const schedule = buildProSeasonSchedule(club, allTeams, state.season);
  const promotedPlayer: Player = {
    ...state.player,
    pace: Math.min(99, state.player.pace + 2),
    shot: Math.min(99, state.player.shot + 2),
    pass: Math.min(99, state.player.pass + 2),
    def: Math.min(99, (state.player.def ?? 55) + 1),
    fis: Math.min(99, (state.player.fis ?? 65) + 2),
    valueMillions: Math.round((state.player.valueMillions + 2.5) * 10) / 10,
  };
  promotedPlayer.ovr = computeOverallForPlayer(promotedPlayer);

  return {
    ...state,
    stage: 'pro',
    player: promotedPlayer,
    xp: state.xp + xpGain,
    skillPoints: state.skillPoints + 3,
    trialAttempts: state.trialAttempts + 1,
    trialPassed: true,
    lastTrialFeedback: `APROVADO NA PENEIRA com Nota ${rating.toFixed(1)}! Contrato profissional assinado com ${club.name}!`,
    clubId: club.id,
    leagueId: club.leagueId,
    currentRound: 1,
    totalRounds: schedule.totalRounds,
    managerTrust: 74,
    squadStatus: 'Titular',
    weeklyWage: 38,
    totalMatches: state.totalMatches + 1,
    totalGoals: state.totalGoals + goals,
    totalWins: state.totalWins + (won ? 1 : 0),
    avgRating: rating,
    standings: schedule.standings,
    fixtures: schedule.fixtures,
    offers: [],
    history: [
      {
        id: `pch-${Date.now()}`,
        round: 1,
        stage: 'trial',
        opponentName: `${club.shortCode} Base (Peneira)`,
        teamGoals: result.homeGoals,
        oppGoals: result.awayGoals,
        playerGoals: goals,
        rating,
        won,
        label: 'Aprovado no Teste Oficial!',
      },
      ...state.history.slice(0, 24),
    ],
  };
}

export function applyProMatchResult(
  state: PlayerCareerState,
  result: MatchResult,
  allTeams: Team[]
): PlayerCareerState {
  const won = result.winnerSide === 'home';
  const draw = result.winnerSide === 'draw';
  const rating = calculateMatchRating(result, result.homeGoals, result.awayGoals);
  const fixture = state.fixtures.find((f) => !f.played);
  const club = allTeams.find((t) => t.id === state.clubId) || allTeams[0];

  const nextFixtures = state.fixtures.map((f) =>
    fixture && f.id === fixture.id
      ? {
          ...f,
          played: true,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          playerGoals: result.homeGoals,
          rating,
        }
      : f
  );

  // Update league standings for user's club + opponent and simulate rest of league teams
  const oppId = fixture?.opponentId;
  const nextStandings = state.standings.map((s) => ({ ...s }));
  const clubStanding = nextStandings.find((s) => s.teamId === state.clubId);
  const oppStanding = oppId ? nextStandings.find((s) => s.teamId === oppId) : undefined;

  if (clubStanding) {
    clubStanding.played += 1;
    clubStanding.goalsFor += result.homeGoals;
    clubStanding.goalsAgainst += result.awayGoals;
    if (won) {
      clubStanding.won += 1;
      clubStanding.points += 3;
    } else if (draw) {
      clubStanding.drawn += 1;
      clubStanding.points += 1;
    } else {
      clubStanding.lost += 1;
    }
  }
  if (oppStanding) {
    oppStanding.played += 1;
    oppStanding.goalsFor += result.awayGoals;
    oppStanding.goalsAgainst += result.homeGoals;
    if (!won && !draw) {
      oppStanding.won += 1;
      oppStanding.points += 3;
    } else if (draw) {
      oppStanding.drawn += 1;
      oppStanding.points += 1;
    } else {
      oppStanding.lost += 1;
    }
  }

  // Simulate remaining league clubs pairing randomly for round parity
  const otherRows = nextStandings.filter((s) => s.teamId !== state.clubId && s.teamId !== oppId);
  for (let i = 0; i + 1 < otherRows.length; i += 2) {
    const a = otherRows[i];
    const b = otherRows[i + 1];
    const gA = Math.floor(Math.random() * 3);
    const gB = Math.floor(Math.random() * 3);
    a.played += 1;
    b.played += 1;
    a.goalsFor += gA;
    a.goalsAgainst += gB;
    b.goalsFor += gB;
    b.goalsAgainst += gA;
    if (gA > gB) {
      a.won += 1;
      a.points += 3;
      b.lost += 1;
    } else if (gB > gA) {
      b.won += 1;
      b.points += 3;
      a.lost += 1;
    } else {
      a.drawn += 1;
      b.drawn += 1;
      a.points += 1;
      b.points += 1;
    }
  }

  const nextTrust = Math.max(20, Math.min(100, state.managerTrust + (rating >= 7.5 ? 5 : won ? 3 : -3)));
  const xpGain = 60 + result.homeGoals * 25 + (won ? 35 : draw ? 15 : 5);
  const newTotalMatches = state.totalMatches + 1;
  const nextAvg = Math.round(((state.avgRating * state.totalMatches + rating) / newTotalMatches) * 10) / 10;
  const nextStatus: PlayerCareerState['squadStatus'] =
    state.player.ovr >= 82 || nextTrust >= 92
      ? 'Capitão'
      : state.player.ovr >= 74 || nextTrust >= 82
        ? 'Craque do Time'
        : nextTrust >= 60
          ? 'Titular'
          : 'Base / Reserva';

  const allDone = nextFixtures.every((f) => f.played);
  let nextTrophies = [...state.trophies];
  if (allDone) {
    const sorted = [...nextStandings].sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst));
    if (sorted[0]?.teamId === state.clubId) {
      const leagueName = LEAGUES.find((l) => l.id === state.leagueId)?.shortName || 'Liga';
      nextTrophies = [...nextTrophies, `Campeão ${leagueName} ${state.season}`];
    }
  }

  const shouldOffer = allDone || state.currentRound % 3 === 0;
  const offers = shouldOffer ? generateOffersForPlayer(state, allTeams) : state.offers;

  return {
    ...state,
    xp: state.xp + xpGain,
    skillPoints: state.skillPoints + (rating >= 7.2 ? 2 : 1),
    currentRound: Math.min(state.totalRounds + 1, state.currentRound + 1),
    managerTrust: nextTrust,
    squadStatus: nextStatus,
    totalMatches: newTotalMatches,
    totalGoals: state.totalGoals + result.homeGoals,
    totalWins: state.totalWins + (won ? 1 : 0),
    avgRating: nextAvg,
    trophies: nextTrophies,
    standings: nextStandings,
    fixtures: nextFixtures,
    offers,
    history: [
      {
        id: `pch-${Date.now()}`,
        round: fixture?.round || state.currentRound,
        stage: 'pro',
        opponentName: fixture?.opponentName || club.name,
        teamGoals: result.homeGoals,
        oppGoals: result.awayGoals,
        playerGoals: result.homeGoals,
        rating,
        won,
        label: `Rodada ${fixture?.round || state.currentRound} · ${club.shortCode}`,
      },
      ...state.history.slice(0, 24),
    ],
  };
}

export function upgradePlayerAttribute(
  state: PlayerCareerState,
  attr: 'pace' | 'shot' | 'pass' | 'def' | 'fis'
): PlayerCareerState {
  if (state.skillPoints <= 0) return state;
  const cur = state.player[attr] ?? 60;
  if (cur >= 99) return state;

  const updated: Player = {
    ...state.player,
    [attr]: Math.min(99, cur + 2),
  };
  updated.ovr = computeOverallForPlayer(updated);
  updated.valueMillions = Math.round((1.5 + Math.max(0, updated.ovr - 62) * 1.45) * 10) / 10;

  return {
    ...state,
    skillPoints: state.skillPoints - 1,
    player: updated,
  };
}

export function startNextPlayerSeason(state: PlayerCareerState, allTeams: Team[]): PlayerCareerState {
  const club = allTeams.find((t) => t.id === state.clubId) || allTeams[0];
  const nextSeason = state.season + 1;
  const schedule = buildProSeasonSchedule(club, allTeams, nextSeason);
  return {
    ...state,
    season: nextSeason,
    player: { ...state.player, age: state.player.age + 1 },
    currentRound: 1,
    totalRounds: schedule.totalRounds,
    standings: schedule.standings,
    fixtures: schedule.fixtures,
    offers: generateOffersForPlayer(state, allTeams),
  };
}

export function acceptPlayerOffer(
  state: PlayerCareerState,
  offerId: string,
  allTeams: Team[]
): PlayerCareerState {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return state;
  const newClub = allTeams.find((t) => t.id === offer.clubId);
  if (!newClub) return state;
  const nextSeason = state.season + 1;
  const schedule = buildProSeasonSchedule(newClub, allTeams, nextSeason);

  return {
    ...state,
    clubId: newClub.id,
    leagueId: newClub.leagueId,
    season: nextSeason,
    currentRound: 1,
    totalRounds: schedule.totalRounds,
    managerTrust: 72,
    squadStatus: 'Titular',
    weeklyWage: offer.weeklyWage,
    player: { ...state.player, age: state.player.age + 1 },
    standings: schedule.standings,
    fixtures: schedule.fixtures,
    offers: [],
  };
}
