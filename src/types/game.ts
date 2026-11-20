export type LeagueId =
  | 'brasileirao'
  | 'argentina'
  | 'ecuador'
  | 'colombia'
  | 'laliga'
  | 'premier'
  | 'bundesliga';

export type KitPattern =
  | 'solid'
  | 'vertical_stripes'
  | 'horizontal_hoops'
  | 'halves'
  | 'sash'
  | 'double_border';

export type CrestShape = 'shield' | 'circle' | 'diamond' | 'hexagon';

export interface KitConfig {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  borderColor: string;
  pattern: KitPattern;
  displayMode: 'number' | 'initial';
  trailColor: string;
  showCrown?: boolean;
}

export type PlayerPosition = 'GOL' | 'ZAG' | 'MEI' | 'ATA';

export interface Player {
  id: string;
  name: string;
  shortName: string;
  number: number;
  position: PlayerPosition;
  ovr: number;
  pace: number; // VEL (60-99)
  shot: number; // CHU (60-99)
  pass: number; // PAS (60-99)
  def?: number; // DEF (60-99) - Massa da bolinha e força de roubada de bola
  fis?: number; // FIS (60-99) - Stamina / energia
  stamina?: number; // 0-100 energia atual entre jogos seguidos
  age: number;
  nationality: string;
  valueMillions: number;
}

export interface Team {
  id: string;
  name: string;
  shortCode: string;
  leagueId: LeagueId;
  ovr: number;
  budgetMillions: number;
  crestShape: CrestShape;
  kit: KitConfig;
  players: Player[];
}

export type MatchFormat =
  | '1v1'
  | '2v2'
  | '3v3'
  | 'local_2p'
  | 'online_2p'
  | 'training_solo'
  | 'training_1v1'
  | 'penalty_shootout';

export type TournamentType =
  | 'friendly'
  | 'libertadores_final'
  | 'sulamericana_final'
  | 'penalty_shootout'
  | 'tournament_cup'
  | 'career_league'
  | 'career_continental_cup'
  | 'career_continental_final';

export type AIDifficulty = 'facil' | 'medio' | 'dificil';

export type CareerFormation = '1-2-2' | '1-2-1' | '1-1-1' | '1-3-1';
export type CareerTacticStyle = 'equilibrado' | 'ofensivo' | 'retranqueiro';
export type CareerTrainingFocus = 'equilibrado' | 'ataque' | 'defesa' | 'recuperacao';

export interface CareerNewsItem {
  id: string;
  round: number;
  title: string;
  body: string;
  tone: 'positive' | 'neutral' | 'warning';
}

export interface CareerFinanceRecord {
  id: string;
  round: number;
  label: string;
  amountMillions: number;
  kind: 'income' | 'expense';
}

export interface MatchSettings {
  format: MatchFormat;
  withGoalkeeper: boolean;
  durationSeconds: number;
  goalLimit: number;
  difficulty: AIDifficulty;
  mobileControls: boolean;
  gamepadEnabled: boolean;
  muted: boolean;
  musicEnabled: boolean;
  narrationEnabled: boolean;
}

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

export interface TwoPlayerMatchRecord {
  id: number;
  mode: 'local_2p' | 'online_2p';
  roomCode?: string | null;
  player1Name: string;
  player2Name: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
  playedAt: string;
}

export interface ActiveMatchConfig {
  tournament: TournamentType;
  tournamentLabel: string;
  homeTeam: Team;
  awayTeam: Team;
  humanSide: 'home' | 'away';
  settings: MatchSettings;
  careerFixtureId?: string;
  homeStarterIndex?: number;
  tacticStyle?: CareerTacticStyle;
  player1Name?: string;
  player2Name?: string;
  player1UserId?: number | null;
  player2UserId?: number | null;
  onlineRoom?: {
    roomCode: string;
    token: string;
    side: 'home' | 'away';
  };
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  scorers: { teamSide: 'home' | 'away'; playerName: string; timeSec: number }[];
  winnerSide: 'home' | 'away' | 'draw';
  tournament: TournamentType;
  careerFixtureId?: string;
  penaltySummary?: string;
  starterStaminaRemaining?: number;
}

export interface LeagueStanding {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface CareerFixture {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
}

export interface TransferRecord {
  id: string;
  type: 'buy' | 'sell';
  playerName: string;
  fromTeamName: string;
  toTeamName: string;
  amountMillions: number;
  round: number;
}

export interface CareerCupMatch {
  stage: 'quartas' | 'semi' | 'final';
  opponentId: string;
  played: boolean;
  won?: boolean;
  userGoals?: number;
  oppGoals?: number;
}

export interface CareerState {
  id: string;
  managerName: string;
  teamId: string;
  leagueId: LeagueId;
  season: number;
  currentRound: number;
  totalRounds: number;
  budgetMillions: number;
  morale: number; // 0-100 Moral da Torcida e Diretoria
  formation: CareerFormation;
  tacticStyle: CareerTacticStyle;
  trainingFocus: CareerTrainingFocus;
  stadiumLevel: number; // 1-5
  squad: Player[];
  starterIds: string[];
  staminaByPlayerId: Record<string, number>;
  standings: LeagueStanding[];
  fixtures: CareerFixture[];
  transfers: TransferRecord[];
  news: CareerNewsItem[];
  finances: CareerFinanceRecord[];
  topScorers: Record<string, { name: string; teamId: string; goals: number }>;
  cupType: 'libertadores' | 'sulamericana';
  cupMatches: CareerCupMatch[];
  continentalQualified?: 'libertadores_final' | 'sulamericana_final' | 'none';
  continentalPlayed?: boolean;
  continentalWon?: boolean;
  trophies: string[];
}

export interface UltimateClubState {
  clubName: string;
  coins: number;
  ownedPlayerIds: string[];
  activeStarterId: string;
  wins: number;
}

export type AppScreen =
  | 'TITLE'
  | 'QUICK_MATCH'
  | 'PRE_MATCH'
  | 'TRAINING_SETUP'
  | 'KIT_CUSTOMIZER'
  | 'CAREER_SELECT'
  | 'CAREER_HUB'
  | 'ULTIMATE_CARDS'
  | 'TOURNAMENTS'
  | 'MULTIPLAYER_2P'
  | 'ONE_TOUCH'
  | 'SETTINGS'
  | 'PLAYING';
