# Livro Mágico (MVP)

Questionário sem login, em moldura de celular com visual liquid glass. A Luna (GPT) entrevista os pais, o Sunburst gera as imagens do tema a partir das fotos, o ElevenLabs faz a narração e a música, e o resultado aparece na hora em um livro interativo.

## Fluxo
1. Nome, idade e nascimento da criança → quem presenteia → tema → o que ela ama → personalidade → memória (texto ou voz).
2. A Luna faz **uma pergunta personalizada** (`/api/luna/followup`).
3. Upload de até 10 fotos (reduzidas no navegador) + **consentimento dos responsáveis** (obrigatório).
4. Geração: roteiro e letra (`/api/luna/story`) → imagens 1024x1024, qualidade média, webp (`/api/generate/image`, uma por foto) → narração (`/api/generate/narration`) → música (`/api/generate/music`).
5. Leitor do livro com texto acendendo no ritmo da narração, música com letra e downloads.

## Rodar local
```
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev
```

## Variáveis de ambiente (Vercel > Settings > Environment Variables)
Veja `.env.example`. Chaves **só no servidor**; nada de chave no código ou no Git.

| Variável | Para quê |
| --- | --- |
| `OPENAI_API_KEY` | Luna e Sunburst |
| `LUNA_MODEL`, `SUNBURST_MODEL` | Identificadores dos modelos (confirmar na sua conta) |
| `ELEVENLABS_API_KEY` | Narração e música |
| `ELEVEN_VOICE_ID`, `ELEVEN_TTS_MODEL`, `ELEVEN_MUSIC_MODEL` | Voz e modelos |
| `ACCESS_CODE` + `ACCESS_ENFORCE=1` | Opcional: com os dois definidos, a 1ª tela pede o código e a API o exige. Por padrão está desligado (sem fricção). |

## Pontos a validar na primeira execução
- Os identificadores padrão dos modelos (`gpt-6-luna`, `gpt-image-2.5-sunburst`, `eleven_multilingual_v2`, `music_v1`) são suposições: ajuste pelas variáveis se a API usar outros nomes.
- O endpoint de imagens usa `POST /v1/images/edits` com `size=1024x1024`, `quality=medium`, `output_format=webp`. Se o Sunburst usar outro formato de chamada, ajuste `app/api/generate/image/route.ts`.
- `next.config.mjs` ignora erros de tipo/lint no build porque o scaffold foi escrito sem poder rodar `next build`. Remova depois do primeiro build limpo.
- Tempo das funções: música pode passar de 60 s; `maxDuration` está em 300 s (confira o limite do seu plano na Vercel).

## Fora do MVP (próximos passos)
- Vídeo MP4 (Remotion): livro, clipe musical e filme completo. Ver o projeto `livro-antonella`.
- Armazenamento (Vercel Blob) e página de entrega com link privado e expiração; envio por WhatsApp.
- Alinhamento de letra por palavra (hoje a letra avança por estimativa).
- Pagamento, fila de jobs e limite de uso por IP.

## Privacidade
Fotos de crianças: consentimento obrigatório, nada é gravado em servidor neste MVP (tudo fica no navegador), nada é usado para treino. Antes de abrir ao público, revisar com advogado (LGPD) e os termos dos fornecedores.
