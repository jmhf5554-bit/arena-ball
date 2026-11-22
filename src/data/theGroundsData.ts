import { ArenaSize, Player, Team, TournamentType } from '../types/game';

export const GROUNDS_WORLD_W = 2200;
export const GROUNDS_WORLD_H = 1440;

export interface GroundsZone {
  id: 'street_pitch' | 'futsal_arena' | 'academy_stadium' | 'main_stadium' | 'training_plaza';
  name: string;
  shortLabel: string;
  subtitle: string;
  x: number;
  y: number;
  w: number;
  h: number;
  interactX: number;
  interactY: number;
  accentColor: string;
  arenaSize: ArenaSize;
}

export const GROUNDS_ZONES: GroundsZone[] = [
  {
    id: 'street_pitch',
    name: 'Pelada na Rua (Asfalto)',
    shortLabel: 'Rua · Carros',
    subtitle: 'Jogue no asfalto do bairro com carros passando na avenida ao lado.',
    x: 240,
    y: 440,
    w: 360,
    h: 220,
    interactX: 420,
    interactY: 550,
    accentColor: '#F59E0B',
    arenaSize: 'street_asphalt',
  },
  {
    id: 'futsal_arena',
    name: 'Arena Futsal Pro',
    shortLabel: 'Futsal',
    subtitle: 'Quadra coberta de futsal rápido: toque curto, drible e tabela!',
    x: 880,
    y: 190,
    w: 360,
    h: 220,
    interactX: 1060,
    interactY: 300,
    accentColor: '#38BDF8',
    arenaSize: 'futsal',
  },
  {
    id: 'academy_stadium',
    name: 'Estádio da Base & Peneira',
    shortLabel: 'Estádio Base',
    subtitle: 'Centro de Treinamento onde o clube avalia você no Teste Oficial.',
    x: 1520,
    y: 230,
    w: 410,
    h: 250,
    interactX: 1725,
    interactY: 355,
    accentColor: '#10B981',
    arenaSize: 'standard',
  },
  {
    id: 'main_stadium',
    name: 'Estádio Monumental · Liga Pro',
    shortLabel: 'Estádio Pro',
    subtitle: 'Casa das grandes partidas profissionais com arquibancada lotada.',
    x: 1470,
    y: 860,
    w: 500,
    h: 320,
    interactX: 1720,
    interactY: 1020,
    accentColor: '#34D399',
    arenaSize: 'standard',
  },
  {
    id: 'training_plaza',
    name: 'Praça dos Campeões & Treino',
    shortLabel: 'Treino & Ficha',
    subtitle: 'Evolua seu OVR, confira a tabela da liga e veja propostas.',
    x: 840,
    y: 920,
    w: 320,
    h: 210,
    interactX: 1000,
    interactY: 1025,
    accentColor: '#A78BFA',
    arenaSize: 'standard',
  },
];

export interface GroundsCelebrity {
  id: string;
  name: string;
  shortName: string;
  title: string;
  number: number;
  ovr: number;
  position: 'ATA' | 'MEI' | 'ZAG';
  x: number;
  y: number;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  haloColor: string;
  greeting: string;
  challengeTitle: string;
  challengeDesc: string;
  challengeTournament: TournamentType;
  challengeArena: ArenaSize;
  hasStreetTraffic?: boolean;
  rewardFame: number;
  rewardSkillPoints: number;
  rewardCoins: number;
  teamName: string;
  teamCode: string;
}

export const GROUNDS_CELEBRITIES: GroundsCelebrity[] = [
  {
    id: 'ronaldinho',
    name: 'Ronaldinho Gaúcho',
    shortName: 'R10',
    title: 'Rei do Futebol de Rua',
    number: 10,
    ovr: 94,
    position: 'MEI',
    x: 635,
    y: 675,
    primaryColor: '#FACC15',
    secondaryColor: '#16A34A',
    textColor: '#09090B',
    haloColor: '#FACC15',
    greeting:
      '"E aí, garoto! Aqui no asfalto é onde nasce a ginga. Quer testar seu drible com os carros passando na avenida?"',
    challengeTitle: 'Pelada Mágica com R10',
    challengeDesc: 'Vença uma pelada de rua no asfalto contra os Amigos do Bruxo.',
    challengeTournament: 'the_grounds_celebrity',
    challengeArena: 'street_asphalt',
    hasStreetTraffic: true,
    rewardFame: 60,
    rewardSkillPoints: 2,
    rewardCoins: 250,
    teamName: 'Amigos do Bruxo R10',
    teamCode: 'R10',
  },
  {
    id: 'neymar',
    name: 'Neymar Jr.',
    shortName: 'NJ10',
    title: 'Astro do Futsal & Drible',
    number: 10,
    ovr: 93,
    position: 'ATA',
    x: 825,
    y: 430,
    primaryColor: '#0EA5E9',
    secondaryColor: '#FACC15',
    textColor: '#FFFFFF',
    haloColor: '#38BDF8',
    greeting:
      '"Fala, cria! Antes do estádio lotado, todo craque afia o controle curto no futsal. Bora pro desafio na quadra azul?"',
    challengeTitle: 'Desafio Futsal Show NJ10',
    challengeDesc: 'Encare o time do Neymar Jr. dentro da Arena Futsal Pro.',
    challengeTournament: 'the_grounds_celebrity',
    challengeArena: 'futsal',
    rewardFame: 65,
    rewardSkillPoints: 2,
    rewardCoins: 280,
    teamName: 'Instituto NJ10 Futsal',
    teamCode: 'NJ10',
  },
  {
    id: 'vini',
    name: 'Vinícius Jr.',
    shortName: 'VINI 7',
    title: 'Raio dos Estádios',
    number: 7,
    ovr: 92,
    position: 'ATA',
    x: 1395,
    y: 960,
    primaryColor: '#FFFFFF',
    secondaryColor: '#1E293B',
    textColor: '#0F172A',
    haloColor: '#F8FAFC',
    greeting:
      '"Bora mostrar personalidade! No Estádio Monumental só fica quem decide no mano a mano e não treme na frente do gol."',
    challengeTitle: 'Duelo Monumental · Vini 7',
    challengeDesc: 'Enfrente a equipe do Vinícius Jr. no gramado do Estádio Monumental.',
    challengeTournament: 'the_grounds_celebrity',
    challengeArena: 'standard',
    rewardFame: 75,
    rewardSkillPoints: 2,
    rewardCoins: 320,
    teamName: 'Seleção Vini 7',
    teamCode: 'VINI',
  },
  {
    id: 'marta',
    name: 'Marta Rainha',
    shortName: 'M10',
    title: 'Lenda Mundial',
    number: 10,
    ovr: 93,
    position: 'MEI',
    x: 1185,
    y: 1015,
    primaryColor: '#10B981',
    secondaryColor: '#FACC15',
    textColor: '#052E16',
    haloColor: '#34D399',
    greeting:
      '"Prazer te ver por aqui! Visão de jogo e finalização limpa se constroem no treino diário. Topa uma partida técnica de futsal?"',
    challengeTitle: 'Desafio da Rainha 10',
    challengeDesc: 'Partida técnica na Arena Futsal contra o esquadrão da Marta.',
    challengeTournament: 'the_grounds_celebrity',
    challengeArena: 'futsal',
    rewardFame: 65,
    rewardSkillPoints: 2,
    rewardCoins: 260,
    teamName: 'Rainha 10 Futsal',
    teamCode: 'M10',
  },
  {
    id: 'endrick',
    name: 'Endrick',
    shortName: 'END 9',
    title: 'Joia da Base ao Pro',
    number: 9,
    ovr: 87,
    position: 'ATA',
    x: 1445,
    y: 455,
    primaryColor: '#15803D',
    secondaryColor: '#FACC15',
    textColor: '#FFFFFF',
    haloColor: '#4ADE80',
    greeting:
      '"Salve! Passei pela peneira igual você tá fazendo agora. Treina forte e confia no seu chute quando a oportunidade aparecer!"',
    challengeTitle: 'Duelo da Nova Geração',
    challengeDesc: 'Jogue contra o time do Endrick no Estádio da Base.',
    challengeTournament: 'the_grounds_celebrity',
    challengeArena: 'standard',
    rewardFame: 55,
    rewardSkillPoints: 2,
    rewardCoins: 220,
    teamName: 'Cria da Base FC',
    teamCode: 'END9',
  },
];

export const CELEBRITY_BY_ID: Record<string, GroundsCelebrity> = Object.fromEntries(
  GROUNDS_CELEBRITIES.map((c) => [c.id, c])
);

export function celebrityToPlayer(celeb: GroundsCelebrity): Player {
  return {
    id: `celeb-${celeb.id}`,
    name: celeb.name,
    shortName: celeb.shortName,
    number: celeb.number,
    position: celeb.position,
    ovr: celeb.ovr,
    pace: Math.min(97, celeb.ovr),
    shot: Math.min(96, celeb.ovr - 1),
    pass: Math.min(96, celeb.ovr - 2),
    def: 66,
    fis: 84,
    stamina: 100,
    age: 26,
    nationality: 'BRA',
    valueMillions: 95,
  };
}

export function buildCelebrityOpponentTeam(celeb: GroundsCelebrity): Team {
  const star = celebrityToPlayer(celeb);
  const mate: Player = {
    id: `celeb-mate-${celeb.id}`,
    name: `Parceiro ${celeb.shortName}`,
    shortName: 'Parceiro',
    number: 8,
    position: 'ZAG',
    ovr: Math.max(74, celeb.ovr - 12),
    pace: 76,
    shot: 72,
    pass: 78,
    def: 80,
    fis: 82,
    stamina: 100,
    age: 23,
    nationality: 'BRA',
    valueMillions: 20,
  };

  return {
    id: `grounds-team-${celeb.id}`,
    name: celeb.teamName,
    shortCode: celeb.teamCode,
    leagueId: 'brasileirao',
    ovr: Math.round((star.ovr + mate.ovr) / 2),
    budgetMillions: 100,
    crestShape: 'shield',
    kit: {
      primaryColor: celeb.primaryColor,
      secondaryColor: celeb.secondaryColor,
      textColor: celeb.textColor,
      borderColor: celeb.haloColor,
      pattern: 'halves',
      displayMode: 'number',
      trailColor: celeb.haloColor,
    },
    players: [star, mate],
  };
}
