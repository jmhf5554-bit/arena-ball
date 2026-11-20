import { LEAGUES } from '../data/teams2027';
import {
  CareerCupMatch,
  CareerFinanceRecord,
  CareerFixture,
  CareerNewsItem,
  CareerState,
  LeagueStanding,
  MatchResult,
  Player,
  Team,
} from '../types/game';

const CAREER_STORAGE_KEY = 'arenabola_career_save_v1';

function hydratePlayerAttributes(p: Player): Player {
  const def =
    typeof p.def === 'number'
      ? p.def
      : p.position === 'GOL'
        ? Math.min(99, p.ovr + 4)
        : p.position === 'ZAG'
          ? Math.min(99, p.ovr + 2)
          : p.position === 'MEI'
            ? Math.max(60, p.ovr - 10)
            : Math.max(55, p.ovr - 20);
  const fis =
    typeof p.fis === 'number'
      ? p.fis
      : Math.min(97, Math.round(p.ovr * 0.86 + (p.position === 'ZAG' || p.position === 'GOL' ? 10 : 5)));
  return {
    ...p,
    def,
    fis,
    stamina: typeof p.stamina === 'number' ? p.stamina : 100,
  };
}

function buildInitialSquadWithGk(team: Team): Player[] {
  const hydrated = team.players.map(hydratePlayerAttributes);
  const hasGol = hydrated.some((p) => p.position === 'GOL');
  if (hasGol) return hydrated;

  const gkOvr = Math.max(68, Math.min(92, team.ovr - 2));
  const gkCard: Player = {
    id: `${team.id}-gk-career`,
    name: `Goleiro ${team.shortCode}`,
    shortName: `G. ${team.shortCode}`,
    number: 1,
    position: 'GOL',
    ovr: gkOvr,
    pace: Math.max(64, gkOvr - 8),
    shot: Math.max(62, gkOvr - 12),
    pass: Math.max(70, gkOvr - 4),
    def: Math.min(96, gkOvr + 5),
    fis: Math.min(94, gkOvr + 3),
    stamina: 100,
    age: 26,
    nationality: hydrated[0]?.nationality || 'BRA',
    valueMillions: Math.max(4, Math.round((gkOvr - 62) * 0.8)),
  };
  return [...hydrated, gkCard];
}

export function loadCareerSave(): CareerState | null {
  try {
    const raw = localStorage.getItem(CAREER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CareerState>;
    if (
      !parsed ||
      typeof parsed.teamId !== 'string' ||
      !Array.isArray(parsed.standings) ||
      !Array.isArray(parsed.squad) ||
      parsed.squad.length === 0 ||
      !Array.isArray(parsed.fixtures)
    ) {
      return null;
    }

    const hydratedSquad = parsed.squad.map(hydratePlayerAttributes);
    const staminaMap: Record<string, number> = { ...(parsed.staminaByPlayerId || {}) };
    for (const p of hydratedSquad) {
      if (typeof staminaMap[p.id] !== 'number') {
        staminaMap[p.id] = 100;
      }
    }

    return {
      ...parsed,
      squad: hydratedSquad,
      morale: typeof parsed.morale === 'number' ? parsed.morale : 75,
      formation: parsed.formation || '1-2-2',
      tacticStyle: parsed.tacticStyle || 'equilibrado',
      trainingFocus: parsed.trainingFocus || 'equilibrado',
      stadiumLevel: typeof parsed.stadiumLevel === 'number' ? parsed.stadiumLevel : 1,
      staminaByPlayerId: staminaMap,
      starterIds: Array.isArray(parsed.starterIds)
        ? parsed.starterIds
        : hydratedSquad.slice(0, 3).map((p) => p.id),
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
      news: Array.isArray(parsed.news) ? parsed.news : [],
      finances: Array.isArray(parsed.finances) ? parsed.finances : [],
      topScorers: parsed.topScorers && typeof parsed.topScorers === 'object' ? parsed.topScorers : {},
      cupType: parsed.cupType === 'sulamericana' ? 'sulamericana' : 'libertadores',
      cupMatches: Array.isArray(parsed.cupMatches) ? parsed.cupMatches : [],
      trophies: Array.isArray(parsed.trophies) ? parsed.trophies : [],
    } as CareerState;
  } catch {
    return null;
  }
}

export function saveCareerState(state: CareerState) {
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(state));
}

export function clearCareerSave() {
  localStorage.removeItem(CAREER_STORAGE_KEY);
}

function buildCupBracket(myTeamId: string, allTeams: Team[]): CareerCupMatch[] {
  const candidates = allTeams
    .filter((t) => t.id !== myTeamId && t.ovr >= 79)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const fallback = allTeams.filter((t) => t.id !== myTeamId).slice(0, 3);
  const picks = candidates.length >= 3 ? candidates : fallback;

  return [
    { stage: 'quartas', opponentId: picks[0].id, played: false },
    { stage: 'semi', opponentId: picks[1].id, played: false },
    { stage: 'final', opponentId: picks[2].id, played: false },
  ];
}

export function createNewCareer(
  managerName: string,
  team: Team,
  allTeams: Team[],
  cupType: 'libertadores' | 'sulamericana' = 'libertadores'
): CareerState {
  const leagueTeams = allTeams.filter((t) => t.leagueId === team.leagueId);
  const teamIds = leagueTeams.map((t) => t.id);

  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push('BYE');
  const n = ids.length;
  const totalRounds = n - 1;
  const fixtures: CareerFixture[] = [];

  const rot = [...ids];
  for (let round = 1; round <= totalRounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const tA = rot[i];
      const tB = rot[n - 1 - i];
      if (tA !== 'BYE' && tB !== 'BYE') {
        const homeId = round % 2 === 0 ? tA : tB;
        const awayId = round % 2 === 0 ? tB : tA;
        fixtures.push({
          id: `r${round}-${homeId}-${awayId}`,
          round,
          homeTeamId: homeId,
          awayTeamId: awayId,
          played: false,
        });
      }
    }
    const last = rot.pop()!;
    rot.splice(1, 0, last);
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

  const squad = buildInitialSquadWithGk(team);
  const staminaByPlayerId: Record<string, number> = {};
  squad.forEach((p) => {
    staminaByPlayerId[p.id] = 100;
  });

  const lgName = LEAGUES.find((l) => l.id === team.leagueId)?.name || 'Liga 2027';
  const cupName = cupType === 'libertadores' ? 'Libertadores' : 'Sul-Americana';

  const state: CareerState = {
    id: `career-${Date.now()}`,
    managerName: managerName.trim() || 'Treinador',
    teamId: team.id,
    leagueId: team.leagueId,
    season: 2027,
    currentRound: 1,
    totalRounds,
    budgetMillions: team.budgetMillions,
    morale: 78,
    formation: '1-2-2',
    tacticStyle: 'equilibrado',
    trainingFocus: 'equilibrado',
    stadiumLevel: 1,
    squad,
    starterIds: squad.slice(0, 3).map((p) => p.id),
    staminaByPlayerId,
    standings,
    fixtures,
    transfers: [],
    news: [
      {
        id: `news-init-${Date.now()}`,
        round: 1,
        title: `${team.name} apresenta ${managerName.trim() || 'novo técnico'} para 2027`,
        body: `Diretoria e torcida confiam no projeto para buscar o título da ${lgName} e da ${cupName}.`,
        tone: 'positive',
      },
    ],
    finances: [
      {
        id: `fin-init-${Date.now()}`,
        round: 1,
        label: 'Orçamento Inicial da Diretoria',
        amountMillions: team.budgetMillions,
        kind: 'income',
      },
    ],
    topScorers: {},
    cupType,
    cupMatches: buildCupBracket(team.id, allTeams),
    continentalQualified: 'none',
    continentalPlayed: false,
    continentalWon: false,
    trophies: [],
  };

  saveCareerState(state);
  return state;
}

export function sortStandings(standings: LeagueStanding[], teams: Team[]): LeagueStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const nameA = teams.find((t) => t.id === a.teamId)?.name || '';
    const nameB = teams.find((t) => t.id === b.teamId)?.name || '';
    return nameA.localeCompare(nameB);
  });
}

function simulateAiFixtureGoals(homeOvr: number, awayOvr: number): { hg: number; ag: number } {
  const diff = (homeOvr - awayOvr) / 10;
  const homeBase = Math.max(0.4, 1.35 + diff * 0.45 + 0.15);
  const awayBase = Math.max(0.4, 1.25 - diff * 0.45);
  const hg = Math.min(5, Math.max(0, Math.round(homeBase + (Math.random() - 0.45) * 2.2)));
  const ag = Math.min(5, Math.max(0, Math.round(awayBase + (Math.random() - 0.45) * 2.2)));
  return { hg, ag };
}

export function applyRoundResultsToCareer(
  career: CareerState,
  allTeams: Team[],
  userMatchResult?: MatchResult
): CareerState {
  const nextFixtures = career.fixtures.map((f) => ({ ...f }));
  const nextStandings = career.standings.map((s) => ({ ...s }));
  const nextScorers = { ...career.topScorers };

  const recordScore = (teamId: string, playerName: string) => {
    const key = `${teamId}:${playerName}`;
    if (!nextScorers[key]) {
      nextScorers[key] = { name: playerName, teamId, goals: 0 };
    }
    nextScorers[key].goals += 1;
  };

  const applyStanding = (homeId: string, awayId: string, hg: number, ag: number) => {
    const h = nextStandings.find((s) => s.teamId === homeId);
    const a = nextStandings.find((s) => s.teamId === awayId);
    if (!h || !a) return;
    h.played += 1;
    a.played += 1;
    h.goalsFor += hg;
    h.goalsAgainst += ag;
    a.goalsFor += ag;
    a.goalsAgainst += hg;
    if (hg > ag) {
      h.won += 1;
      h.points += 3;
      a.lost += 1;
    } else if (ag > hg) {
      a.won += 1;
      a.points += 3;
      h.lost += 1;
    } else {
      h.drawn += 1;
      a.drawn += 1;
      h.points += 1;
      a.points += 1;
    }
  };

  let userWon = false;
  let userDrew = false;
  let userGoalsFor = 0;
  let userGoalsAgainst = 0;
  let userOppName = 'Adversário';

  const roundFixtures = nextFixtures.filter((f) => f.round === career.currentRound && !f.played);
  for (const fx of roundFixtures) {
    const isUserFixture = fx.homeTeamId === career.teamId || fx.awayTeamId === career.teamId;

    if (isUserFixture && userMatchResult) {
      fx.played = true;
      fx.homeGoals = userMatchResult.homeGoals;
      fx.awayGoals = userMatchResult.awayGoals;
      applyStanding(fx.homeTeamId, fx.awayTeamId, fx.homeGoals, fx.awayGoals);

      const userSide = fx.homeTeamId === career.teamId ? 'home' : 'away';
      userWon = userMatchResult.winnerSide === userSide;
      userDrew = userMatchResult.winnerSide === 'draw';
      userGoalsFor = userSide === 'home' ? fx.homeGoals : fx.awayGoals;
      userGoalsAgainst = userSide === 'home' ? fx.awayGoals : fx.homeGoals;
      const oppId = userSide === 'home' ? fx.awayTeamId : fx.homeTeamId;
      userOppName = allTeams.find((t) => t.id === oppId)?.name || 'Adversário';

      for (const sc of userMatchResult.scorers) {
        const scorerTeamId = sc.teamSide === 'home' ? fx.homeTeamId : fx.awayTeamId;
        recordScore(scorerTeamId, sc.playerName);
      }
    } else {
      const homeTeam = allTeams.find((t) => t.id === fx.homeTeamId);
      const awayTeam = allTeams.find((t) => t.id === fx.awayTeamId);
      const homeOvr =
        fx.homeTeamId === career.teamId
          ? Math.round(career.squad.reduce((acc, p) => acc + p.ovr, 0) / Math.max(1, career.squad.length))
          : homeTeam?.ovr || 80;
      const awayOvr =
        fx.awayTeamId === career.teamId
          ? Math.round(career.squad.reduce((acc, p) => acc + p.ovr, 0) / Math.max(1, career.squad.length))
          : awayTeam?.ovr || 80;

      const { hg, ag } = simulateAiFixtureGoals(homeOvr, awayOvr);
      fx.played = true;
      fx.homeGoals = hg;
      fx.awayGoals = ag;
      applyStanding(fx.homeTeamId, fx.awayTeamId, hg, ag);

      if (isUserFixture) {
        const userSide = fx.homeTeamId === career.teamId ? 'home' : 'away';
        userWon = (userSide === 'home' && hg > ag) || (userSide === 'away' && ag > hg);
        userDrew = hg === ag;
        userGoalsFor = userSide === 'home' ? hg : ag;
        userGoalsAgainst = userSide === 'home' ? ag : hg;
        const oppId = userSide === 'home' ? fx.awayTeamId : fx.homeTeamId;
        userOppName = allTeams.find((t) => t.id === oppId)?.name || 'Adversário';
      }

      if (homeTeam && hg > 0) {
        for (let g = 0; g < hg; g++) {
          const attacker = homeTeam.players[g % Math.min(3, homeTeam.players.length)];
          if (attacker) recordScore(homeTeam.id, attacker.shortName);
        }
      }
      if (awayTeam && ag > 0) {
        for (let g = 0; g < ag; g++) {
          const attacker = awayTeam.players[g % Math.min(3, awayTeam.players.length)];
          if (attacker) recordScore(awayTeam.id, attacker.shortName);
        }
      }
    }
  }

  // Update Stamina across consecutive matches (Starter loses energy, Bench recovers)
  const nextStamina = { ...(career.staminaByPlayerId || {}) };
  const starterId = career.starterIds[0];
  const recoveryBonus = career.trainingFocus === 'recuperacao' ? 20 : 8;
  for (const player of career.squad) {
    const cur = typeof nextStamina[player.id] === 'number' ? nextStamina[player.id] : 100;
    if (player.id === starterId) {
      if (typeof userMatchResult?.starterStaminaRemaining === 'number') {
        nextStamina[player.id] = Math.max(25, Math.min(100, Math.round(userMatchResult.starterStaminaRemaining + recoveryBonus * 0.5)));
      } else {
        const fisFactor = ((player.fis ?? 80) - 70) * 0.25;
        const drain = Math.max(10, Math.round(18 - fisFactor));
        nextStamina[player.id] = Math.max(30, cur - drain);
      }
    } else {
      nextStamina[player.id] = Math.min(100, cur + 24 + recoveryBonus);
    }
  }

  // Training progression chance on youth / focused attributes
  const nextSquad = career.squad.map((p) => {
    const copy = hydratePlayerAttributes(p);
    if (career.trainingFocus === 'ataque' && copy.age <= 25 && copy.ovr < 94 && Math.random() < 0.28) {
      return { ...copy, shot: Math.min(99, copy.shot + 1), ovr: Math.min(95, copy.ovr + 1) };
    }
    if (career.trainingFocus === 'defesa' && copy.age <= 26 && copy.ovr < 94 && Math.random() < 0.28) {
      return { ...copy, def: Math.min(99, (copy.def || 75) + 1), ovr: Math.min(95, copy.ovr + 1) };
    }
    return copy;
  });

  // Update Morale & Finances
  const bigWin = userWon && userGoalsFor - userGoalsAgainst >= 2;
  const moraleDelta = bigWin ? 8 : userWon ? 5 : userDrew ? 1 : -6;
  const nextMorale = Math.max(15, Math.min(100, (career.morale ?? 75) + moraleDelta));

  const stadiumRevenue = Math.max(1, Math.round(1 + (career.stadiumLevel || 1) * 1.2));
  const prizeRevenue = userWon ? 3 : userDrew ? 1 : 0;
  const totalRoundIncome = stadiumRevenue + prizeRevenue;

  const newFinances: CareerFinanceRecord[] = [
    {
      id: `fin-r${career.currentRound}-${Date.now()}`,
      round: career.currentRound,
      label: userWon
        ? `Bilheteria (Nív. ${career.stadiumLevel || 1}) + Premiação Vitória vs ${userOppName}`
        : `Bilheteria de Jogo (Estádio Nív. ${career.stadiumLevel || 1})`,
      amountMillions: totalRoundIncome,
      kind: 'income' as const,
    },
    ...(career.finances || []),
  ].slice(0, 30);

  // Dynamic Press & Media News Feed
  const myClubName = allTeams.find((t) => t.id === career.teamId)?.name || 'Clube';
  const sortedNow = sortStandings(nextStandings, allTeams);
  const myRankNow = sortedNow.findIndex((s) => s.teamId === career.teamId) + 1;
  const topScorerEntry = Object.values(nextScorers).sort((a, b) => b.goals - a.goals)[0];

  const roundNews: CareerNewsItem[] = [];
  if (bigWin) {
    roundNews.push({
      id: `news-r${career.currentRound}-w-${Date.now()}`,
      round: career.currentRound,
      title: `Vitória convincente do ${myClubName} empolga a torcida`,
      body: `Com o triunfo por ${userGoalsFor}x${userGoalsAgainst} sobre o ${userOppName}, a moral subiu para ${nextMorale}% e o clube ocupa o ${myRankNow}º lugar.`,
      tone: 'positive',
    });
  } else if (userWon) {
    roundNews.push({
      id: `news-r${career.currentRound}-w-${Date.now()}`,
      round: career.currentRound,
      title: `${myClubName} soma 3 pontos importantes contra o ${userOppName}`,
      body: `Placar de ${userGoalsFor}x${userGoalsAgainst} garante bom clima no vestiário (Moral ${nextMorale}%).`,
      tone: 'positive',
    });
  } else if (userDrew) {
    roundNews.push({
      id: `news-r${career.currentRound}-d-${Date.now()}`,
      round: career.currentRound,
      title: `Tudo igual: ${myClubName} empata em ${userGoalsFor}x${userGoalsAgainst} com ${userOppName}`,
      body: `Equipe mantém pontuação estável na ${myRankNow}ª colocação e foca na próxima rodada.`,
      tone: 'neutral',
    });
  } else {
    roundNews.push({
      id: `news-r${career.currentRound}-l-${Date.now()}`,
      round: career.currentRound,
      title: `Tropeço liga alerta no ${myClubName}`,
      body: `Derrota por ${userGoalsFor}x${userGoalsAgainst} diante do ${userOppName} reduz a moral da diretoria para ${nextMorale}%.`,
      tone: 'warning',
    });
  }

  if (topScorerEntry && topScorerEntry.goals >= 2 && career.currentRound % 2 === 0) {
    const scClub = allTeams.find((t) => t.id === topScorerEntry.teamId)?.shortCode || '';
    roundNews.push({
      id: `news-r${career.currentRound}-sc-${Date.now()}`,
      round: career.currentRound,
      title: 'Artilheiro do campeonato chama atenção no mercado',
      body: `${topScorerEntry.name} (${scClub}) já soma ${topScorerEntry.goals} gols na liga e valoriza seu passe.`,
      tone: 'neutral',
    });
  }

  const nextRound = career.currentRound + 1;
  let continentalQualified = career.continentalQualified;
  const trophies = [...career.trophies];

  if (nextRound > career.totalRounds) {
    if (myRankNow === 1) {
      const lgName = LEAGUES.find((l) => l.id === career.leagueId)?.shortName || 'Liga';
      trophies.push(`Campeão ${lgName} ${career.season}`);
      roundNews.unshift({
        id: `news-champ-${Date.now()}`,
        round: career.currentRound,
        title: `É CAMPEÃO! ${myClubName} levanta a taça da ${lgName}!`,
        body: `Campanha histórica coroou o trabalho do técnico ${career.managerName} na temporada ${career.season}.`,
        tone: 'positive',
      });
    }
    if (myRankNow <= 3) {
      continentalQualified = 'libertadores_final';
    } else if (myRankNow <= 6) {
      continentalQualified = 'sulamericana_final';
    } else {
      continentalQualified = 'none';
    }
  }

  const updated: CareerState = {
    ...career,
    currentRound: nextRound,
    squad: nextSquad,
    staminaByPlayerId: nextStamina,
    morale: nextMorale,
    standings: nextStandings,
    fixtures: nextFixtures,
    topScorers: nextScorers,
    news: [...roundNews, ...(career.news || [])].slice(0, 18),
    finances: newFinances,
    continentalQualified,
    trophies,
    budgetMillions: career.budgetMillions + totalRoundIncome,
  };

  saveCareerState(updated);
  return updated;
}

export function applyCupMatchResult(career: CareerState, result: MatchResult): CareerState {
  const nextCup = career.cupMatches.map((m) => ({ ...m }));
  const currentIdx = nextCup.findIndex((m) => !m.played);
  if (currentIdx === -1) return career;

  const won = result.winnerSide === 'home';
  nextCup[currentIdx] = {
    ...nextCup[currentIdx],
    played: true,
    won,
    userGoals: result.homeGoals,
    oppGoals: result.awayGoals,
  };

  const trophies = [...career.trophies];
  let bonus = won ? 5 : 1;
  const cupName = career.cupType === 'libertadores' ? 'Libertadores' : 'Sul-Americana';
  let newsTitle = won
    ? `Classificação na ${cupName}! Vitória por ${result.homeGoals}x${result.awayGoals}`
    : `Fim da linha na ${cupName} após placar de ${result.homeGoals}x${result.awayGoals}`;

  if (nextCup[currentIdx].stage === 'final' && won) {
    trophies.push(`Campeão da ${cupName} ${career.season}`);
    bonus = 35;
    newsTitle = `CAMPEÃO CONTINENTAL! ${cupName} ${career.season} é do clube!`;
  }

  const updated: CareerState = {
    ...career,
    cupMatches: nextCup,
    trophies,
    morale: Math.max(15, Math.min(100, (career.morale ?? 75) + (won ? 9 : -8))),
    news: [
      {
        id: `news-cup-${Date.now()}`,
        round: Math.min(career.currentRound, career.totalRounds),
        title: newsTitle,
        body: won
          ? `Premiação continental de +€${bonus}M entra no caixa do clube.`
          : 'Equipe agora volta o foco total para a disputa da Liga Nacional.',
        tone: won ? ('positive' as const) : ('warning' as const),
      },
      ...(career.news || []),
    ].slice(0, 18),
    finances: [
      {
        id: `fin-cup-${Date.now()}`,
        round: Math.min(career.currentRound, career.totalRounds),
        label: `Premiação ${cupName} (${nextCup[currentIdx].stage.toUpperCase()})`,
        amountMillions: bonus,
        kind: 'income' as const,
      },
      ...(career.finances || []),
    ].slice(0, 30),
    budgetMillions: career.budgetMillions + bonus,
  };
  saveCareerState(updated);
  return updated;
}

export function runRecoveryTraining(career: CareerState): CareerState {
  const nextStamina: Record<string, number> = { ...(career.staminaByPlayerId || {}) };
  career.squad.forEach((p) => {
    const cur = typeof nextStamina[p.id] === 'number' ? nextStamina[p.id] : 100;
    nextStamina[p.id] = Math.min(100, cur + 30);
  });
  const updated: CareerState = {
    ...career,
    staminaByPlayerId: nextStamina,
    morale: Math.min(100, (career.morale ?? 75) + 2),
    news: [
      {
        id: `news-rec-${Date.now()}`,
        round: Math.min(career.currentRound, career.totalRounds),
        title: 'Treino regenerativo recupera fôlego do elenco',
        body: 'Departamento físico eleva energia das bolinhas em +30% antes do próximo desafio.',
        tone: 'positive' as const,
      },
      ...(career.news || []),
    ].slice(0, 18),
  };
  saveCareerState(updated);
  return updated;
}

export function upgradeStadium(career: CareerState): { updated: CareerState; cost: number } | null {
  const curLevel = career.stadiumLevel || 1;
  if (curLevel >= 5) return null;
  const cost = curLevel * 12;
  if (career.budgetMillions < cost) return null;

  const nextLevel = curLevel + 1;
  const updated: CareerState = {
    ...career,
    stadiumLevel: nextLevel,
    budgetMillions: career.budgetMillions - cost,
    morale: Math.min(100, (career.morale ?? 75) + 4),
    finances: [
      {
        id: `fin-stad-${Date.now()}`,
        round: Math.min(career.currentRound, career.totalRounds),
        label: `Expansão do Estádio (Nível ${nextLevel})`,
        amountMillions: cost,
        kind: 'expense' as const,
      },
      ...(career.finances || []),
    ].slice(0, 30),
    news: [
      {
        id: `news-stad-${Date.now()}`,
        round: Math.min(career.currentRound, career.totalRounds),
        title: `Arena ampliada para o Nível ${nextLevel}!`,
        body: 'Nova arquibancada aumenta a receita de bilheteria por partida e anima os sócios.',
        tone: 'positive' as const,
      },
      ...(career.news || []),
    ].slice(0, 18),
  };
  saveCareerState(updated);
  return { updated, cost };
}

export function getSquadOrderedForPitch(career: CareerState): Player[] {
  const withStamina = (p: Player): Player => ({
    ...hydratePlayerAttributes(p),
    stamina:
      typeof career.staminaByPlayerId?.[p.id] === 'number' ? career.staminaByPlayerId[p.id] : 100,
  });

  const starters = career.starterIds
    .map((id) => career.squad.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .map(withStamina);
  const others = career.squad.filter((p) => !career.starterIds.includes(p.id)).map(withStamina);
  return [...starters, ...others];
}

