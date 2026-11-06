import { getTheme } from "./themes";
import type { Answers } from "./types";

export function themeBrief(a: Pick<Answers, "themeId" | "customTheme">): string {
  const t = getTheme(a.themeId);
  if (a.themeId === "custom" || !a.themeId) {
    return `Tema livre pedido pelos pais: "${a.customTheme.slice(0, 200)}". Traduza para elementos genéricos (cenário, bichos, objetos, cores). Se o pedido citar personagem, filme, jogo ou marca de terceiros, NÃO use nomes, logos nem personagens: entenda do que se trata e recrie só o clima, as cores, o cenário e o tipo de aventura com personagens e elementos ORIGINAIS (ex.: "herói que voa" vira um herói original de capa colorida). Nas "cenas", nunca escreva o nome do personagem.`;
  }
  return `Tema: ${t.label}. Cenário visual: ${t.scenePrompt}. Vocabulário e clima: ${t.vocab}.`;
}

export function profileText(a: Answers): string {
  return [
    `Nome da criança: ${a.childName}`,
    `Idade que completa: ${a.age} anos`,
    a.birth ? `Nascimento: ${a.birth}` : "",
    `Presente de: ${a.parents}`,
    `Ama: ${a.loves.join(", ") || "não informado"}`,
    `Personalidade: ${a.traits.join(", ") || "não informado"}`,
    a.memory ? `Memória ou frase especial: ${a.memory}` : "",
    a.lunaQuestion && a.lunaAnswer ? `${a.lunaQuestion} Resposta: ${a.lunaAnswer}` : "",
    themeBrief(a),
  ]
    .filter(Boolean)
    .join("\n");
}

export const FOLLOWUP_SYSTEM = `Você é a Luna, entrevistadora carinhosa de um livro infantil personalizado, em português do Brasil.
Com base nas respostas dos pais, faça UMA pergunta curta e calorosa que deixe a história mais pessoal (um apelido, uma brincadeira favorita, um momento marcante). Não repita o que já foi respondido.
Responda somente JSON: {"pergunta":"..."}`;

export function storySystem(photoCount: number): string {
  return `Você é a Luna, roteirista de um livro e clipe musical infantil personalizado, em português do Brasil.
Regras:
- Tom caloroso, simples, adequado à idade; frases curtas para serem narradas.
- Para cada página escreva TAMBÉM "fala": exatamente o mesmo texto de "texto", palavra por palavra, mas com tags de emoção entre colchetes ANTES das frases, para a narradora interpretar: [warmly], [excited], [softly], [gasps], [giggles], [curious], [happy], [short pause]. Use 2 a 4 tags por página, nunca altere nem acrescente palavras além das tags, e escreva as tags em inglês.
- Narração expressiva: fale COM a criança (às vezes "você"), com exclamações, onomatopeias leves e pausas (reticências). A última página é uma bênção: deseje felicidade, coragem, saúde e muito amor, citando o nome da criança e a família. Nunca soe como relatório.
- A criança é a protagonista; cite os pais e interesses informados, sem inventar fatos sobre a família.
- Use apenas elementos genéricos do tema; nunca nomes, personagens ou marcas de terceiros.
- Exatamente 4 páginas de texto, cada uma com 150 a 250 caracteres; a história toda cabe em cerca de 60 segundos de fala.
- "foto" é o índice (começando em 0) da foto usada na página, entre 0 e ${photoCount - 1}.
- "cenas": exatamente ${photoCount} descrições curtas em inglês (uma por foto) de cenas do tema para um gerador de imagens, com a criança como protagonista; sem texto escrito na imagem.
- "letra": exatamente 16 versos, em 4 estrofes de 4 versos (A, refrão, B, refrão idêntico ao primeiro refrão).
  Cada verso com 5 a 8 sílabas, rimando em AABB ou ABAB, vocabulário infantil e concreto do tema. O refrão é curto, fácil de cantar junto, repete o nome da criança e a palavra "parabéns". Os 2 últimos versos desejam felicidade e anunciam o aniversário. Sem versos soltos ou genéricos ("hoje é dia de alegria" repetido); cada verso traz uma imagem do tema ou da vida da criança.
- "estilo_musical": direção em inglês (gênero, andamento, instrumentos, clima) coerente com o tema.
Responda somente JSON válido neste formato:
{"titulo":"","paginas":[{"capitulo":"","texto":"","fala":"","foto":0,"legenda":""}],"letra":[""],"estilo_musical":"","cenas":[""],"cartao_final":{"titulo":"Feliz aniversário, Nome!","subtitulo":""}}`;
}

export function imagePrompt(themeId: string, customTheme: string, scene: string): string {
  const t = getTheme(themeId);
  const base =
    themeId === "custom" || !themeId
      ? `Storybook scene based on this theme (use only generic elements, no third-party characters or brands): ${customTheme.slice(0, 200)}.`
      : `Storybook scene. ${t.scenePrompt}.`;
  return `${base} Scene: ${scene.slice(0, 400)}. Keep the child from the reference photo as the protagonist: preserve face, skin tone, hair and age exactly. The child is always fully and modestly dressed in an age-appropriate themed outfit with sleeves and long pants or a long skirt (never bare torso, never revealing clothes). Costumes and characters are ORIGINAL designs: no logos, emblems, chest symbols, or recognizable costumes or capes of existing franchises. Warm cinematic storybook lighting, rich detail, photorealistic. No text, no watermark.`;
}
