export type LeagueId =
  | 'brasileirao'
  | 'argentina'
  | 'ecuador'
  | 'colombia'
  | 'laliga'
  | 'premier'
  | 'bundesliga'
  | 'selecoes';

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
  isNationalTeam?: boolean;
  flagCode?: string;
  confederation?: string;
}

export type MatchFormat =
  | '1v1'
  | '2v2'
  | '3v3'
  | 'local_2p'
  | 'online_2p'
  | 'rocket_cars'
  | 'artilheirinho'
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
  | 'career_continental_final'
  | 'world_cup_group'
  | 'world_cup_knockout'
  | 'player_career_pro'
  | 'rocket_cars'
  | 'artilheirinho';

export type AIDifficulty = 'facil' | 'medio' | 'dificil';

export type CareerFormation = '1-2-2' | '1-2-1' | '1-1-1' | '1-3-1';
export type CareerTacticStyle = 'equilibrado' | 'ofensivo' | 'retranqueiro';
export type CareerTrainingFocus = 'equilibrado' | 'ataque' | 'defesa' | 'recuperacao';
export type TacticalFormation = '1-2-1' | '2-1-1' | '1-1-2' | '2-2';

export type RocketCarChassis = 'octane' | 'dominus' | 'fennec' | 'breakout';
export type RocketCarDecal = 'none' | 'racing_stripes' | 'flames' | 'bolt' | 'star';
export type RocketCarWheel = 'classic' | 'neon_sport' | 'gold_pro' | 'carbon';
export type RocketCarBoost = 'fire' | 'cyan_plasma' | 'emerald_nitro' | 'violet_hyper';
export type RocketCarTopper = 'none' | 'crown' | 'wing' | 'antenna_br';

export interface RocketCarConfig {
  chassis: RocketCarChassis;
  primaryColor: string;
  secondaryColor: string;
  decal: RocketCarDecal;
  wheels: RocketCarWheel;
  boostTrail: RocketCarBoost;
  topper: RocketCarTopper;
  carName: string;
}

export interface ArtilheirinhoConfig {
  mode: '1p_cpu' | 'local_2p';
  targetPoints: 3 | 6 | 12;
  rotateOnScore: boolean;
  extraTouchOnReboundOrIntercept: boolean;
  counterAttackOnIntercept: boolean;
  penaltyOnPostHits: 0 | 2 | 3;
  allowGoalkeeperGoal: boolean;
}

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

export type ArenaSize = 'standard';
export type ScoreboardStyle = 'brasileirao_tv' | 'transmissao_2026' | 'classic';

export interface MatchSettings {
  format: MatchFormat;
  arenaSize?: ArenaSize;
  scoreboardStyle?: ScoreboardStyle;
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

export type UserRole = 'user' | 'admin' | 'super_admin';

export interface PublicUser {
  id: number | string;
  userId?: string;
  email?: string | null;
  role?: UserRole;
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
  worldCupMatchId?: string;
  homeStarterIndex?: number;
  tacticStyle?: CareerTacticStyle;
  tacticalFormation?: TacticalFormation;
  captainPlayerId?: string;
  penaltyTakerId?: string;
  rocketMatchMode?: '1v1' | '2v2' | 'local_2p';
  rocketCar?: RocketCarConfig;
  artilheirinhoConfig?: ArtilheirinhoConfig;
  player1Name?: string;
  player2Name?: string;
  player1UserId?: number | string | null;
  player2UserId?: number | string | null;
  onlineLeagueId?: string;
  onlineLeagueName?: string;
  onlineRoom?: {
    roomCode: string;
    token: string;
    side: 'home' | 'away';
    transport?: 'supabase' | 'ws';
  };
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  scorers: { teamSide: 'home' | 'away'; playerName: string; timeSec: number }[];
  winnerSide: 'home' | 'away' | 'draw';
  tournament: TournamentType;
  careerFixtureId?: string;
  worldCupMatchId?: string;
  onlineLeagueId?: string;
  penaltySummary?: string;
  starterStaminaRemaining?: number;
  matchStats?: {
    humanTouches: number;
    humanShots: number;
    humanDribbles: number;
  };
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

export type WorldCupStage = 'group' | 'round_of_16' | 'quarter' | 'semi' | 'final' | 'completed';

export interface WorldCupStanding {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface WorldCupGroupMatch {
  id: string;
  groupName: string;
  round: number; // 1 | 2 | 3
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
}

export interface WorldCupGroup {
  name: string; // 'A'..'H'
  teamIds: string[];
  standings: WorldCupStanding[];
  matches: WorldCupGroupMatch[];
}

export interface WorldCupKnockoutMatch {
  id: string;
  stage: 'round_of_16' | 'quarter' | 'semi' | 'final';
  slotIndex: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
  winnerId?: string | null;
  decidedByPenalties?: boolean;
  penaltySummary?: string;
}

export interface WorldCupState {
  id: string;
  userTeamId: string;
  currentStage: WorldCupStage;
  currentGroupRound: number; // 1..3
  groups: WorldCupGroup[];
  knockoutMatches: WorldCupKnockoutMatch[];
  championTeamId?: string | null;
  userEliminated?: boolean;
  rewardClaimed?: boolean;
}

export interface ProfileTrophy {
  id: string;
  title: string;
  teamId: string;
  teamName: string;
  type: 'world_cup' | 'libertadores' | 'sulamericana' | 'league';
  wonAt: string;
}

export type PlayerCareerStage = 'pro';
export type PlayerCareerModeType = 'normal';

export interface PlayerCareerFixture {
  id: string;
  round: number;
  opponentId: string;
  opponentName: string;
  isHome: boolean;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
  playerGoals?: number;
  rating?: number;
}

export interface PlayerCareerOffer {
  id: string;
  clubId: string;
  clubName: string;
  leagueId: LeagueId;
  clubOvr: number;
  roleLabel: string;
  weeklyWage: number;
  bonusCoins: number;
}

export interface PlayerCareerMatchHistory {
  id: string;
  round: number;
  stage: PlayerCareerStage;
  opponentName: string;
  teamGoals: number;
  oppGoals: number;
  playerGoals: number;
  rating: number;
  won: boolean;
  label: string;
}

export interface PlayerCareerState {
  id: string;
  careerModeType?: PlayerCareerModeType;
  stage: PlayerCareerStage;
  player: Player;
  trailColor: string;
  xp: number;
  skillPoints: number;
  trialClubId: string;
  clubId: string;
  leagueId: LeagueId;
  season: number;
  currentRound: number;
  totalRounds: number;
  managerTrust: number;
  squadStatus: 'Base / Reserva' | 'Titular' | 'Craque do Time' | 'Capitão';
  weeklyWage: number;
  totalMatches: number;
  totalGoals: number;
  totalWins: number;
  avgRating: number;
  trophies: string[];
  standings: LeagueStanding[];
  fixtures: PlayerCareerFixture[];
  offers: PlayerCareerOffer[];
  history: PlayerCareerMatchHistory[];
}

export interface CustomTeamMember {
  userId: string;
  name: string;
  role: 'captain' | 'member';
  joinedAt: string;
}

export interface CustomOnlineTeam {
  id: string;
  ownerUserId: string;
  ownerName: string;
  name: string;
  shortCode: string;
  crestShape: CrestShape;
  pattern: KitPattern;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  ovr: number;
  members?: CustomTeamMember[];
  createdAt: string;
}

export type FriendshipStatus = 'pending_sent' | 'pending_received' | 'accepted';

export interface FriendRelation {
  id: string;
  friendUserId: string;
  friendName: string;
  friendFavoriteTeamId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface GameInvite {
  id: string;
  roomCode: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  teamName: string;
  createdAt: string;
}

export interface CustomTeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  teamShortCode: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  crestShape: CrestShape;
  pattern: KitPattern;
  ownerUserId: string;
  ownerName: string;
  targetUserId: string;
  targetName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface OnlineLeagueMember {
  userId: string;
  userName: string;
  teamId: string;
  teamName: string;
  teamShortCode: string;
  customTeam?: CustomOnlineTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface OnlineLeagueResult {
  id: string;
  homeUserId: string;
  awayUserId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
  playedAt: string;
}

export interface OnlineLeague {
  id: string;
  code: string;
  name: string;
  ownerUserId: string;
  ownerName: string;
  maxTeams: number;
  durationSeconds: number;
  status: 'open' | 'active' | 'finished';
  members: OnlineLeagueMember[];
  recentResults: OnlineLeagueResult[];
  createdAt: string;
}

export interface CarreiraJsonb {
  career?: CareerState | null;
  playerCareer?: PlayerCareerState | null;
  worldCup?: WorldCupState | null;
  trophies?: ProfileTrophy[];
  ultimate?: UltimateClubState | null;
  rocketCar?: RocketCarConfig | null;
  customOnlineTeams?: CustomOnlineTeam[];
  auth?: {
    username: string;
    salt: string;
    hash: string;
  } | null;
}

export interface JogadorProfile {
  id?: number;
  user_id?: string;
  email?: string | null;
  role?: UserRole;
  nome: string;
  time_favorito: string;
  moedas: number;
  vitorias: number;
  empates?: number;
  derrotas?: number;
  gols: number;
  gols_sofridos?: number;
  carreira: CarreiraJsonb;
  created_at?: string;
  updatedAtLocal?: string;
}

export type AppScreen =
  | 'TITLE'
  | 'QUICK_MATCH'
  | 'PRE_MATCH'
  | 'TRAINING_SETUP'
  | 'KIT_CUSTOMIZER'
  | 'CAREER_SELECT'
  | 'CAREER_HUB'
  | 'PLAYER_CAREER'
  | 'ROCKET_LEAGUE'
  | 'ARTILHEIRINHO'
  | 'ULTIMATE_CARDS'
  | 'TOURNAMENTS'
  | 'MULTIPLAYER_2P'
  | 'SETTINGS'
  | 'PLAYING';

