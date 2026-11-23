export type HairStyle =
  | 'short'
  | 'curly_afro'
  | 'spiky'
  | 'bald'
  | 'side_part'
  | 'ponytail'
  | 'braids'
  | 'buzz';

export type FacialHairStyle = 'none' | 'stubble' | 'goatee' | 'full_beard' | 'mustache';

export interface PlayerFaceSpec {
  skin: 0 | 1 | 2 | 3 | 4; // 0=very light, 1=olive/tan, 2=medium brown, 3=dark brown, 4=deep dark
  hairStyle: HairStyle;
  hairColor: string;
  hairHighlight?: string;
  facialHair?: FacialHairStyle;
  beardColor?: string;
  headband?: string;
}

function normalizeName(raw: string): string {
  return raw
    .replace(/^(VOCÊ|J1|J2|GL)\s*·\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Researched real-world appearances (skin tone, hair, highlights, facial hair, headbands)
const RESEARCHED_FACES: Record<string, PlayerFaceSpec> = {
  // ---------------- FLAMENGO ----------------
  'pedro guilherme': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'pedro': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'giorgian de arrascaeta': { skin: 0, hairStyle: 'side_part', hairColor: '#4A2C16', facialHair: 'full_beard', beardColor: '#3E2312' },
  'arrascaeta': { skin: 0, hairStyle: 'side_part', hairColor: '#4A2C16', facialHair: 'full_beard', beardColor: '#3E2312' },
  'gerson santos': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'goatee' },
  'gerson': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'goatee' },
  'luiz araujo': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'l araujo': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'leo ortiz': { skin: 1, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'stubble' },
  'l ortiz': { skin: 1, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'stubble' },

  // ---------------- PALMEIRAS ----------------
  'vitor roque': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'v roque': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'raphael veiga': { skin: 1, hairStyle: 'side_part', hairColor: '#27272A', facialHair: 'stubble' },
  'r veiga': { skin: 1, hairStyle: 'side_part', hairColor: '#27272A', facialHair: 'stubble' },
  'paulinho': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'richard rios': { skin: 2, hairStyle: 'spiky', hairColor: '#18181B', facialHair: 'stubble' },
  'r rios': { skin: 2, hairStyle: 'spiky', hairColor: '#18181B', facialHair: 'stubble' },
  'gustavo gomez': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'g gomez': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },

  // ---------------- CORINTHIANS ----------------
  'yuri alberto': { skin: 1, hairStyle: 'spiky', hairColor: '#27272A', facialHair: 'stubble' },
  'y alberto': { skin: 1, hairStyle: 'spiky', hairColor: '#27272A', facialHair: 'stubble' },
  'memphis depay': { skin: 3, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'full_beard', headband: '#F8FAFC' },
  'memphis': { skin: 3, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'full_beard', headband: '#F8FAFC' },
  'rodrigo garro': { skin: 1, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'stubble' },
  'garro': { skin: 1, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'stubble' },
  'andre carrillo': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'carrillo': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'andre ramalho': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'full_beard' },
  'a ramalho': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'full_beard' },

  // ---------------- SÃO PAULO ----------------
  'jonathan calleri': { skin: 1, hairStyle: 'side_part', hairColor: '#4A2C16', facialHair: 'stubble' },
  'calleri': { skin: 1, hairStyle: 'side_part', hairColor: '#4A2C16', facialHair: 'stubble' },
  'lucas moura': { skin: 2, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'goatee' },
  'lucas': { skin: 2, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'goatee' },
  'oscar dos santos': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'oscar': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'luciano neves': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'luciano': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'arboleda': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'goatee' },

  // ---------------- BOTAFOGO / ATLÉTICO-MG / CRUZEIRO / SANTOS / FLU / GRE / INT ----------------
  'igor jesus': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'i jesus': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'savarino': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'hulk paraiba': { skin: 2, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'hulk': { skin: 2, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'gustavo scarpa': { skin: 1, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'stubble' },
  'scarpa': { skin: 1, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'stubble' },
  'guilherme arana': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'arana': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'gabriel barbosa': { skin: 2, hairStyle: 'braids', hairColor: '#EAB308', facialHair: 'goatee' },
  'gabigol': { skin: 2, hairStyle: 'braids', hairColor: '#EAB308', facialHair: 'goatee' },
  'matheus pereira': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'full_beard' },
  'm pereira': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'full_beard' },
  'kaio jorge': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'stubble' },
  'k jorge': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'stubble' },
  'neymar jr': { skin: 2, hairStyle: 'spiky', hairColor: '#18181B', hairHighlight: '#FACC15', facialHair: 'goatee' },
  'neymar': { skin: 2, hairStyle: 'spiky', hairColor: '#18181B', hairHighlight: '#FACC15', facialHair: 'goatee' },
  'thiago silva': { skin: 2, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  't silva': { skin: 2, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'german cano': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'full_beard' },
  'cano': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'full_beard' },
  'jhon arias': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'j arias': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'paulo henrique ganso': { skin: 1, hairStyle: 'side_part', hairColor: '#27272A', facialHair: 'stubble' },
  'ganso': { skin: 1, hairStyle: 'side_part', hairColor: '#27272A', facialHair: 'stubble' },
  'everton ribeiro': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'e ribeiro': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'rafael borre': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'borre': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'alan patrick': { skin: 1, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'stubble' },
  'a patrick': { skin: 1, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'stubble' },
  'martin braithwaite': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'full_beard' },
  'braithwaite': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'full_beard' },
  'gil': { skin: 4, hairStyle: 'bald', hairColor: '#18181B', facialHair: 'goatee' },

  // ---------------- REAL MADRID / LA LIGA ----------------
  'kylian mbappe': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'mbappe': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'vinicius junior': { skin: 4, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'goatee' },
  'vini jr': { skin: 4, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'goatee' },
  'jude bellingham': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'full_beard' },
  'bellingham': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'full_beard' },
  'federico valverde': { skin: 0, hairStyle: 'short', hairColor: '#4A2C16', facialHair: 'stubble' },
  'valverde': { skin: 0, hairStyle: 'short', hairColor: '#4A2C16', facialHair: 'stubble' },
  'endrick felipe': { skin: 3, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'endrick': { skin: 3, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'lamine yamal': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', hairHighlight: '#FACC15', facialHair: 'none' },
  'yamal': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', hairHighlight: '#FACC15', facialHair: 'none' },
  'l yamal': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', hairHighlight: '#FACC15', facialHair: 'none' },
  'raphinha': { skin: 2, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'goatee', headband: '#F8FAFC' },
  'pedri gonzalez': { skin: 0, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'none' },
  'pedri': { skin: 0, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'none' },
  'dani olmo': { skin: 0, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'stubble' },
  'd olmo': { skin: 0, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'stubble' },
  'pau cubarsi': { skin: 0, hairStyle: 'short', hairColor: '#4A2C16', facialHair: 'none' },
  'cubarsi': { skin: 0, hairStyle: 'short', hairColor: '#4A2C16', facialHair: 'none' },
  'julian alvarez': { skin: 0, hairStyle: 'short', hairColor: '#27272A', facialHair: 'none' },
  'j alvarez': { skin: 0, hairStyle: 'short', hairColor: '#27272A', facialHair: 'none' },
  'antoine griezmann': { skin: 0, hairStyle: 'ponytail', hairColor: '#C2933E', facialHair: 'stubble', headband: '#111827' },
  'griezmann': { skin: 0, hairStyle: 'ponytail', hairColor: '#C2933E', facialHair: 'stubble', headband: '#111827' },
  'rodrigo de paul': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'full_beard' },
  'de paul': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'full_beard' },
  'nico williams': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', hairHighlight: '#FACC15', facialHair: 'none' },
  'n williams': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', hairHighlight: '#FACC15', facialHair: 'none' },
  'inaki williams': { skin: 4, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'i williams': { skin: 4, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'takefusa kubo': { skin: 1, hairStyle: 'side_part', hairColor: '#18181B', facialHair: 'none' },
  'kubo': { skin: 1, hairStyle: 'side_part', hairColor: '#18181B', facialHair: 'none' },
  'isco alarcon': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'full_beard' },
  'isco': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'full_beard' },
  'antony': { skin: 2, hairStyle: 'spiky', hairColor: '#18181B', hairHighlight: '#EAB308', facialHair: 'goatee' },

  // ---------------- PREMIER LEAGUE ----------------
  'erling haaland': { skin: 0, hairStyle: 'ponytail', hairColor: '#E6C25A', facialHair: 'none' },
  'haaland': { skin: 0, hairStyle: 'ponytail', hairColor: '#E6C25A', facialHair: 'none' },
  'phil foden': { skin: 0, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'none' },
  'foden': { skin: 0, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'none' },
  'rodri hernandez': { skin: 0, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'stubble' },
  'rodri': { skin: 0, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'stubble' },
  'savinho': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'josko gvardiol': { skin: 0, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'full_beard' },
  'gvardiol': { skin: 0, hairStyle: 'short', hairColor: '#3E2312', facialHair: 'full_beard' },
  'bukayo saka': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'stubble' },
  'saka': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'stubble' },
  'martin odegaard': { skin: 0, hairStyle: 'side_part', hairColor: '#C89E46', facialHair: 'stubble' },
  'odegaard': { skin: 0, hairStyle: 'side_part', hairColor: '#C89E46', facialHair: 'stubble' },
  'gabriel martinelli': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'martinelli': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'declan rice': { skin: 0, hairStyle: 'short', hairColor: '#4A2C16', facialHair: 'stubble' },
  'rice': { skin: 0, hairStyle: 'short', hairColor: '#4A2C16', facialHair: 'stubble' },
  'william saliba': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'saliba': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'mohamed salah': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'full_beard' },
  'm salah': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'full_beard' },
  'salah': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'full_beard' },
  'alexis mac allister': { skin: 0, hairStyle: 'short', hairColor: '#6B3B16', facialHair: 'full_beard', beardColor: '#7C3E18' },
  'mac allister': { skin: 0, hairStyle: 'short', hairColor: '#6B3B16', facialHair: 'full_beard', beardColor: '#7C3E18' },
  'luis diaz': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'l diaz': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'none' },
  'dominik szoboszlai': { skin: 0, hairStyle: 'ponytail', hairColor: '#3E2312', facialHair: 'stubble' },
  'szoboszlai': { skin: 0, hairStyle: 'ponytail', hairColor: '#3E2312', facialHair: 'stubble' },
  'cole palmer': { skin: 0, hairStyle: 'side_part', hairColor: '#5B3E22', facialHair: 'none' },
  'palmer': { skin: 0, hairStyle: 'side_part', hairColor: '#5B3E22', facialHair: 'none' },
  'estevao willian': { skin: 3, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'estevao': { skin: 3, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'nicolas jackson': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'goatee' },
  'n jackson': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'goatee' },
  'jackson': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'goatee' },
  'enzo fernandez': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'stubble' },
  'enzo': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'stubble' },
  'moises caicedo': { skin: 4, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'm caicedo': { skin: 4, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'caicedo': { skin: 4, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'bruno fernandes': { skin: 0, hairStyle: 'short', hairColor: '#27272A', facialHair: 'goatee' },
  'b fernandes': { skin: 0, hairStyle: 'short', hairColor: '#27272A', facialHair: 'goatee' },
  'rasmus hojlund': { skin: 0, hairStyle: 'short', hairColor: '#D4A039', facialHair: 'none' },
  'hojlund': { skin: 0, hairStyle: 'short', hairColor: '#D4A039', facialHair: 'none' },
  'alexander isak': { skin: 3, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'stubble' },
  'isak': { skin: 3, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'stubble' },
  'bruno guimaraes': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble', headband: '#111827' },
  'b guimaraes': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble', headband: '#111827' },
  'lucas paqueta': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'paqueta': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },

  // ---------------- BUNDESLIGA ----------------
  'harry kane': { skin: 0, hairStyle: 'side_part', hairColor: '#7A5226', facialHair: 'stubble' },
  'h kane': { skin: 0, hairStyle: 'side_part', hairColor: '#7A5226', facialHair: 'stubble' },
  'kane': { skin: 0, hairStyle: 'side_part', hairColor: '#7A5226', facialHair: 'stubble' },
  'jamal musiala': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'musiala': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'michael olise': { skin: 3, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'none' },
  'olise': { skin: 3, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'none' },
  'joshua kimmich': { skin: 0, hairStyle: 'side_part', hairColor: '#5B3E22', facialHair: 'stubble' },
  'kimmich': { skin: 0, hairStyle: 'side_part', hairColor: '#5B3E22', facialHair: 'stubble' },
  'alphonso davies': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'a davies': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'davies': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'florian wirtz': { skin: 0, hairStyle: 'short', hairColor: '#5B3E22', facialHair: 'none' },
  'wirtz': { skin: 0, hairStyle: 'short', hairColor: '#5B3E22', facialHair: 'none' },
  'granit xhaka': { skin: 0, hairStyle: 'short', hairColor: '#27272A', facialHair: 'stubble' },
  'xhaka': { skin: 0, hairStyle: 'short', hairColor: '#27272A', facialHair: 'stubble' },
  'xavi simons': { skin: 2, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'none' },
  'x simons': { skin: 2, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'none' },
  'karim adeyemi': { skin: 3, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },
  'adeyemi': { skin: 3, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'none' },

  // ---------------- SELEÇÕES / COPA DO MUNDO ----------------
  'rodrygo goes': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'stubble' },
  'rodrygo': { skin: 2, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'stubble' },
  'gabriel magalhaes': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'full_beard' },
  'gabriel': { skin: 3, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'full_beard' },
  'lionel messi': { skin: 0, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'full_beard', beardColor: '#7C3E18' },
  'messi': { skin: 0, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'full_beard', beardColor: '#7C3E18' },
  'lautaro martinez': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'stubble' },
  'lautaro': { skin: 1, hairStyle: 'short', hairColor: '#27272A', facialHair: 'stubble' },
  'ousmane dembele': { skin: 4, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'goatee' },
  'dembele': { skin: 4, hairStyle: 'curly_afro', hairColor: '#18181B', facialHair: 'goatee' },
  'eduardo camavinga': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'none' },
  'camavinga': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'none' },
  'antonio rudiger': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'full_beard' },
  'rudiger': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'full_beard' },
  'cristiano ronaldo': { skin: 1, hairStyle: 'side_part', hairColor: '#18181B', facialHair: 'stubble' },
  'c ronaldo': { skin: 1, hairStyle: 'side_part', hairColor: '#18181B', facialHair: 'stubble' },
  'rafael leao': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'goatee' },
  'r leao': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'goatee' },
  'virgil van dijk': { skin: 3, hairStyle: 'ponytail', hairColor: '#18181B', facialHair: 'full_beard' },
  'van dijk': { skin: 3, hairStyle: 'ponytail', hairColor: '#18181B', facialHair: 'full_beard' },
  'frenkie de jong': { skin: 0, hairStyle: 'side_part', hairColor: '#D4A039', facialHair: 'none' },
  'de jong': { skin: 0, hairStyle: 'side_part', hairColor: '#D4A039', facialHair: 'none' },
  'darwin nunez': { skin: 1, hairStyle: 'ponytail', hairColor: '#27272A', facialHair: 'stubble' },
  'd nunez': { skin: 1, hairStyle: 'ponytail', hairColor: '#27272A', facialHair: 'stubble' },
  'ronald araujo': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble', headband: '#F8FAFC' },
  'r araujo': { skin: 2, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble', headband: '#F8FAFC' },
  'luka modric': { skin: 0, hairStyle: 'ponytail', hairColor: '#C89E46', facialHair: 'stubble', headband: '#111827' },
  'modric': { skin: 0, hairStyle: 'ponytail', hairColor: '#C89E46', facialHair: 'stubble', headband: '#111827' },
  'achraf hakimi': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'hakimi': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'heung min son': { skin: 1, hairStyle: 'side_part', hairColor: '#18181B', facialHair: 'none' },
  'son': { skin: 1, hairStyle: 'side_part', hairColor: '#18181B', facialHair: 'none' },
  'christian pulisic': { skin: 0, hairStyle: 'short', hairColor: '#4A2C16', facialHair: 'full_beard' },
  'pulisic': { skin: 0, hairStyle: 'short', hairColor: '#4A2C16', facialHair: 'full_beard' },
  'james rodriguez': { skin: 1, hairStyle: 'side_part', hairColor: '#27272A', facialHair: 'stubble' },
  'james r': { skin: 1, hairStyle: 'side_part', hairColor: '#27272A', facialHair: 'stubble' },
  'kevin de bruyne': { skin: 0, hairStyle: 'side_part', hairColor: '#D98E32', facialHair: 'stubble' },
  'de bruyne': { skin: 0, hairStyle: 'side_part', hairColor: '#D98E32', facialHair: 'stubble' },
  'jeremy doku': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'none' },
  'doku': { skin: 4, hairStyle: 'braids', hairColor: '#18181B', facialHair: 'none' },
  'romelu lukaku': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'full_beard' },
  'lukaku': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'full_beard' },
  'sadio mane': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'mane': { skin: 4, hairStyle: 'buzz', hairColor: '#18181B', facialHair: 'stubble' },
  'arda guler': { skin: 0, hairStyle: 'side_part', hairColor: '#27272A', facialHair: 'none' },
  'a guler': { skin: 0, hairStyle: 'side_part', hairColor: '#27272A', facialHair: 'none' },
  'victor osimhen': { skin: 4, hairStyle: 'buzz', hairColor: '#EAB308', facialHair: 'none' },
  'osimhen': { skin: 4, hairStyle: 'buzz', hairColor: '#EAB308', facialHair: 'none' },
  'robert lewandowski': { skin: 0, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'stubble' },
  'lewandowski': { skin: 0, hairStyle: 'side_part', hairColor: '#3E2312', facialHair: 'stubble' },
  'radamel falcao': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'falcao': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'goatee' },
  'emiliano martinez': { skin: 1, hairStyle: 'short', hairColor: '#18181B', facialHair: 'stubble' },
  'alisson': { skin: 0, hairStyle: 'side_part', hairColor: '#4A2C16', facialHair: 'full_beard' },
};

const FALLBACK_HAIR_COLORS = ['#18181B', '#3E2312', '#6B3B16', '#D4A039', '#27272A'];
const FALLBACK_STYLES: HairStyle[] = ['short', 'curly_afro', 'spiky', 'side_part', 'buzz'];

export function getPlayerFaceSpec(
  playerName: string | undefined,
  label: string,
  isGoalkeeper: boolean,
  seedKey: string
): PlayerFaceSpec {
  const key = normalizeName(playerName || label);
  if (key && RESEARCHED_FACES[key]) {
    return RESEARCHED_FACES[key];
  }
  // Partial token match (e.g. if playerName is "V. Roque" or "J. Bellingham")
  const tokens = key.split(' ');
  const lastToken = tokens[tokens.length - 1];
  if (lastToken && lastToken.length >= 4 && RESEARCHED_FACES[lastToken]) {
    return RESEARCHED_FACES[lastToken];
  }

  const seed = hashSeed(seedKey || key || (isGoalkeeper ? 'gk' : 'fp'));
  const facialOpts: FacialHairStyle[] = ['none', 'none', 'stubble', 'goatee'];
  return {
    skin: (seed % 5) as 0 | 1 | 2 | 3 | 4,
    hairStyle: FALLBACK_STYLES[(seed >>> 4) % FALLBACK_STYLES.length],
    hairColor: FALLBACK_HAIR_COLORS[(seed >>> 8) % FALLBACK_HAIR_COLORS.length],
    facialHair: facialOpts[(seed >>> 12) % facialOpts.length],
  };
}
