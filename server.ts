import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. AI Tactical Scout & Transfer Advisor
app.post('/api/ai/scout', async (req, res) => {
  try {
    const { myTeamName, myOvr, opponentName, opponentOvr, budgetMillions, tournamentLabel, marketCandidates } =
      req.body || {};

    const ai = getGeminiClient();
    const candidatesText = Array.isArray(marketCandidates)
      ? marketCandidates
          .slice(0, 12)
          .map(
            (c: { name: string; club: string; ovr: number; value: number; pos: string }) =>
              `${c.name} (${c.club}, ${c.pos}, OVR ${c.ovr}, €${c.value}M)`
          )
          .join('; ')
      : '';

    const prompt = `Você é um olheiro e analista tático brasileiro de futebol 2D estilo FIFA/HaxBall.
Time do usuário: ${myTeamName} (OVR ${myOvr}).
Adversário: ${opponentName || 'Rival'} (OVR ${opponentOvr || 80}).
Competição: ${tournamentLabel || 'Liga 2027'}.
Verba disponível: €${budgetMillions ?? 50}M.
Jogadores disponíveis no mercado: ${candidatesText || 'Elenco padrão 2027'}.

Dê uma análise tática direta para o duelo 1v1 (incluindo dicas de finalização, marcação e posicionamento) e recomende até 2 contratações ideais dentro da verba.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tacticalAdvice: {
              type: Type.STRING,
              description: 'Conselho tático conciso em português brasileiro (máx 2 frases).',
            },
            keyDanger: {
              type: Type.STRING,
              description: 'Ponto forte do adversário ou alerta principal (1 frase curta).',
            },
            recommendedSignings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  playerName: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao consultar o Olheiro IA.';
    res.status(500).json({ error: message });
  }
});

const OFFICIAL_NARRATOR_SYSTEM_INSTRUCTION = `Você é o narrador esportivo oficial de um jogo de futebol de bolinhas estilo transmissão de TV brasileira.
Sua função é narrar APENAS o lance atual com emoção genuína, calor humano, ritmo natural de locução esportiva e frases curtas (1 a 2 frases).

ESTILO HUMANIZADO:
- Fale como um narrador brasileiro apaixonado em plena transmissão: natural, espontâneo, próximo do torcedor, usando expressões autênticas ("Olha o perigo!", "Respira fundo!", "Caprichou na batida!", "Que momento!", "Coração na boca!").
- Use vírgulas e exclamações para dar cadência de respiração e entonação humana na fala.
- Varie sempre o jeito de começar e evite repetir frases ou estruturas parecidas com as falas anteriores enviadas no contexto.
- Sinta o clima do placar e do minuto atual (jogo empatado, virada, vantagem apertada, reta final, pressão).

REGRAS ABSOLUTAS:
1. Use EXCLUSIVAMENTE os nomes dos times, jogadores/bolinhas e placar informados no evento atual.
2. NUNCA mencione times, campeonatos, jogadores ou fatos que não estejam nos dados da partida atual (por exemplo, se o jogo for entre Bayer e outro time, nunca cite Flamengo ou outro clube fora do confronto).
3. Se o nome de um jogador ou bolinha não for informado, refira-se apenas ao time ou à bolinha em campo, sem inventar nomes.
4. Respeite exatamente o placar e o minuto/tempo enviados. Não invente gols, cartões ou lances que não aconteceram.
5. Mantenha o tom vibrante de narração de futebol, direto ao ponto e natural em português.`;

// 2. AI Post-Match Brazilian Chronicle & Press Conference
app.post('/api/ai/match-report', async (req, res) => {
  try {
    const { homeTeam, awayTeam, homeGoals, awayGoals, tournamentLabel, scorers, userTeamName } =
      req.body || {};

    const ai = getGeminiClient();
    const scorersList = Array.isArray(scorers) && scorers.length > 0
      ? scorers.map((s: { playerName: string }) => s.playerName).join(', ')
      : 'nenhum gol marcado';

    const prompt = `Dados exatos da partida encerrada:
- Competição: ${tournamentLabel || 'Partida'}
- Confronto e Placar Final: ${homeTeam} ${homeGoals} x ${awayGoals} ${awayTeam}
- Time controlado pelo usuário: ${userTeamName}
- Autores dos gols registrados: ${scorersList}

Escreva manchete, resumo pós-jogo (máximo 2 frases com tom humano e envolvente) e declaração pós-jogo usando EXCLUSIVAMENTE os dados acima.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: OFFICIAL_NARRATOR_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING, description: 'Manchete esportiva fiel ao placar e times.' },
            summary: { type: Type.STRING, description: 'Resumo de 1 a 2 frases sem inventar lances.' },
            coachQuote: { type: Type.STRING, description: 'Declaração curta pós-jogo fiel à partida.' },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar crônica IA.';
    res.status(500).json({ error: message });
  }
});

// 3. AI Pre-Match Brazilian Commentator Hype Intro
app.post('/api/ai/hype', async (req, res) => {
  try {
    const { homeTeam, awayTeam, homePlayer, awayPlayer, tournamentLabel } = req.body || {};
    const ai = getGeminiClient();

    const prompt = `Dados da partida prestes a começar:
- Competição: ${tournamentLabel || 'Partida'}
- Time da Casa: ${homeTeam}${homePlayer ? ` (bolinha/jogador: ${homePlayer})` : ''}
- Time Visitante: ${awayTeam}${awayPlayer ? ` (bolinha/jogador: ${awayPlayer})` : ''}
- Placar atual: 0 x 0 (Pré-jogo)

Faça uma abertura calorosa, humana e empolgante de transmissão para o torcedor (1 a 2 frases curtas) citando apenas os dados acima.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: OFFICIAL_NARRATOR_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    res.json({ line: (response.text ?? '').trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar narração IA.';
    res.status(500).json({ error: message });
  }
});

// 4. AI Live Play-by-Play Narrator
app.post('/api/ai/narrate', async (req, res) => {
  try {
    const {
      homeTeam,
      awayTeam,
      homePlayer,
      awayPlayer,
      homeGoals,
      awayGoals,
      halfPeriod,
      clockLabel,
      tournamentLabel,
      eventType,
      actorTeam,
      actorPlayer,
      recentLines,
    } = req.body || {};

    const ai = getGeminiClient();
    const recentBlock =
      Array.isArray(recentLines) && recentLines.length > 0
        ? `- Falas recentes (NÃO repita estas aberturas ou ideias): ${recentLines.slice(-4).join(' | ')}`
        : '';

    const prompt = `Evento atual em campo:
- Competição: ${tournamentLabel || 'Partida'}
- Confronto: ${homeTeam}${homePlayer ? ` (${homePlayer})` : ''} vs ${awayTeam}${awayPlayer ? ` (${awayPlayer})` : ''}
- Placar exato agora: ${homeTeam} ${homeGoals ?? 0} x ${awayGoals ?? 0} ${awayTeam}
- Tempo/Relógio: ${halfPeriod || '1T'} ${clockLabel || '00:00'}
- Situação do lance: ${eventType || 'andamento'}
${actorTeam ? `- Time no lance: ${actorTeam}` : ''}
${actorPlayer ? `- Bolinha/jogador no lance: ${actorPlayer}` : ''}
${recentBlock}

Narre APENAS este lance agora em 1 ou 2 frases curtas, com emoção humana, naturalidade e ritmo de voz falada.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: OFFICIAL_NARRATOR_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    res.json({ line: (response.text ?? '').trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao narrar lance.';
    res.status(500).json({ error: message });
  }
});

// 5. AI Humanized Brazilian Voice TTS (Gemini 3.8 Flash Lite TTS)
app.post('/api/ai/tts', async (req, res) => {
  try {
    const { text, emotion } = (req.body || {}) as {
      text?: string;
      emotion?: 'normal' | 'tension' | 'goal' | 'dramatic';
    };
    const cleanText = typeof text === 'string' ? text.trim().slice(0, 280) : '';
    if (!cleanText) {
      res.status(400).json({ error: 'Texto vazio para narração.' });
      return;
    }

    const ai = getGeminiClient();
    const styleByEmotion: Record<string, string> = {
      goal: 'Narrador esportivo brasileiro narrando em português do Brasil com extrema emoção, vibração calorosa de gol, sorriso na voz e cadência empolgada de TV.',
      tension: 'Narrador esportivo brasileiro falando em português do Brasil com suspense intenso, respiração acelerada e surpresa diante de lance de perigo.',
      dramatic: 'Narrador esportivo brasileiro falando em português do Brasil com tom firme, emocionante e envolvente de momento decisivo.',
      normal: 'Narrador esportivo brasileiro falando em português do Brasil com naturalidade, calor humano, ritmo fluido e proximidade com o torcedor.',
    };

    const style = styleByEmotion[emotion || 'normal'] || styleByEmotion.normal;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
      },
    });

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      res.status(502).json({ error: 'Áudio não retornado pelo sintetizador.', fallbackToBrowser: true });
      return;
    }

    res.json({ audioBase64, mimeType: 'audio/wav' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao sintetizar voz da narração.';
    res.status(503).json({ error: message, fallbackToBrowser: true });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const httpServer = createServer(app);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Arena Bola 2027 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
