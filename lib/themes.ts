// Um tema é só dados: adicionar um tema novo não exige mexer nos componentes.
// Temas originais/genéricos de propósito: evita personagens e marcas de terceiros.
export type Theme = {
  id: string;
  label: string;
  hint: string;
  colors: { from: string; to: string; accent: string };
  scenePrompt: string; // direção visual para o gerador de imagens
  musicStyle: string; // direção para a música
  vocab: string; // vocabulário e clima da história
};

export const THEMES: Theme[] = [
  {
    id: "ilha",
    label: "Ilha dos Mares",
    hint: "mar, canoa e coragem",
    colors: { from: "#0b6e7a", to: "#06303d", accent: "#f4c766" },
    scenePrompt:
      "tropical island adventure, turquoise ocean, wooden outrigger canoe with a woven sail, hibiscus flowers, palm leaves, golden sunset light, friendly baby pig companion",
    musicStyle:
      "upbeat tropical pop for kids with ukulele, steel drums and light percussion, joyful adventure anthem, warm female and kids vocals",
    vocab: "mar, ilha, vento, canoa, coragem, viagem, estrelas que guiam",
  },
  {
    id: "safari",
    label: "Safari Encantado",
    hint: "savana e bichinhos",
    colors: { from: "#b8741a", to: "#4a2a0c", accent: "#ffe08a" },
    scenePrompt:
      "golden savanna at sunrise, friendly baby elephant, giraffe and lion cub, acacia trees, explorer hat and binoculars, warm storybook light",
    musicStyle:
      "playful african-inspired kids pop with marimba, hand drums and claps, cheerful sing-along chorus",
    vocab: "savana, elefantinho, girafa, amigo leão, expedição, sol, descoberta",
  },
  {
    id: "estrelas",
    label: "Aventura nas Estrelas",
    hint: "foguete e planetas",
    colors: { from: "#2b2d8f", to: "#0a0b2e", accent: "#9ee7ff" },
    scenePrompt:
      "little space explorer in a cozy astronaut suit, friendly cartoon planets, glowing stars, small rocket ship, soft nebula colors, dreamy storybook light",
    musicStyle:
      "dreamy synth pop for kids with glockenspiel, soft pads and gentle beat, wonder and bedtime magic",
    vocab: "estrelas, foguete, planetas, lua, viagem espacial, brilho, descoberta",
  },
  {
    id: "floresta",
    label: "Floresta Mágica",
    hint: "vagalumes e bichos",
    colors: { from: "#1f6b3a", to: "#0a2a17", accent: "#c8f08a" },
    scenePrompt:
      "enchanted forest with glowing fireflies, giant friendly mushrooms, woodland animals (fox, owl, rabbit), moss and ferns, soft green magical light",
    musicStyle:
      "whimsical acoustic folk for kids with guitar, flute and light hand percussion, gentle and playful",
    vocab: "floresta, vagalumes, cogumelos, coruja, raposinha, segredos, trilha",
  },
  {
    id: "fadas",
    label: "Reino das Fadas",
    hint: "flores e purpurina",
    colors: { from: "#c2478f", to: "#4a1342", accent: "#ffd6f1" },
    scenePrompt:
      "flower fairy kingdom, petal dress, glittering translucent wings, pastel blossoms, tiny glowing lanterns, dewdrops, soft pink and lilac light",
    musicStyle:
      "sparkly pastel pop for kids with music box, harp and celesta, sweet and magical sing-along",
    vocab: "fadas, flores, purpurina, asas, jardim encantado, varinha, desejo",
  },
  {
    id: "dino",
    label: "Terra dos Dinossauros",
    hint: "dinos amigos",
    colors: { from: "#3f8a2e", to: "#16300f", accent: "#ffd166" },
    scenePrompt:
      "lush prehistoric valley with friendly cartoon baby dinosaurs, ferns, volcano far away, explorer outfit, warm adventurous light",
    musicStyle:
      "playful stomping kids anthem with brass, big drums and call-and-response chorus",
    vocab: "dinossauros, vale, pegadas, ovo gigante, exploradora, rugido, amizade",
  },
];

export const CUSTOM_THEME: Theme = {
  id: "custom",
  label: "Tema livre",
  hint: "descrito pelos pais",
  colors: { from: "#5b3fa0", to: "#1c1233", accent: "#ffe3a3" },
  scenePrompt: "",
  musicStyle: "cheerful original kids pop with acoustic guitar, light percussion and sing-along chorus",
  vocab: "",
};

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? CUSTOM_THEME;
}

export const LOVES = [
  "Animais",
  "Mar e praia",
  "Música e dança",
  "Desenhos e filmes",
  "Carrinhos",
  "Bonecas e fadas",
  "Dinossauros",
  "Natureza",
];

export const TRAITS = [
  "Curiosa",
  "Corajosa",
  "Risonha",
  "Sapeca",
  "Carinhosa",
  "Dançarina",
  "Sonhadora",
  "Falante",
];
