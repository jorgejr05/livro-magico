export type Answers = {
  childName: string;
  age: number;
  birth: string;
  parents: string;
  themeId: string;
  customTheme: string;
  loves: string[];
  traits: string[];
  memory: string;
  lunaQuestion: string;
  lunaAnswer: string;
  consent: boolean;
};

export type Photo = { id: string; dataUrl: string; name: string };

export type StoryPage = { capitulo: string; texto: string; foto: number; legenda: string };

export type Story = {
  titulo: string;
  paginas: StoryPage[];
  letra: string[];
  estilo_musical: string;
  cenas: string[];
  cartao_final: { titulo: string; subtitulo: string };
};

export type Result = {
  story: Story;
  images: (string | null)[];
  narrationUrl: string | null;
  musicUrl: string | null;
  // tempos reais (segundos): palavras de cada página da narração e início de cada verso da música
  narrTimes?: { start: number; end: number; words: { s: number; e: number }[] }[] | null;
  lyricStarts?: number[] | null;
  errors: string[];
};

export const EMPTY_ANSWERS: Answers = {
  childName: "",
  age: 3,
  birth: "",
  parents: "",
  themeId: "",
  customTheme: "",
  loves: [],
  traits: [],
  memory: "",
  lunaQuestion: "",
  lunaAnswer: "",
  consent: false,
};
