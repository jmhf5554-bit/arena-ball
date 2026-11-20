export type NarrationEmotion = 'normal' | 'tension' | 'goal' | 'dramatic';

export interface SpeakNarrationOptions {
  priority?: boolean;
  emotion?: NarrationEmotion;
  skipAiVoice?: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  public musicEnabled: boolean = true;
  public narrationEnabled: boolean = true;

  private musicInterval: number | null = null;
  private musicStep: number = 0;
  private lastNarrationAt: number = 0;
  private narrationToken: number = 0;
  private currentTtsAudio: HTMLAudioElement | null = null;
  private currentTtsSource: AudioBufferSourceNode | null = null;
  private ttsCache = new Map<string, string>();
  private aiVoiceBackoffUntil: number = 0;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private speechUnlocked: boolean = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private pendingSpeakTimeout: number | null = null;
  private deferredLine: { text: string; emotion: NarrationEmotion; at: number } | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        this.cachedVoices = window.speechSynthesis.getVoices();
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          this.cachedVoices = window.speechSynthesis.getVoices();
        });
      } catch {
        // ignore speechSynthesis init errors
      }
    }
  }

  public unlock() {
    if (typeof window === 'undefined') return;
    this.ensureContext();
    if ('speechSynthesis' in window) {
      try {
        const synth = window.speechSynthesis;
        const voices = synth.getVoices();
        if (voices.length > 0) this.cachedVoices = voices;
        if (synth.paused) synth.resume();
        if (!this.speechUnlocked) {
          this.speechUnlocked = true;
          const primer = new SpeechSynthesisUtterance(' ');
          primer.lang = 'pt-BR';
          primer.volume = 0;
          primer.rate = 2;
          synth.speak(primer);
        }
        if (this.deferredLine && !this.muted && this.narrationEnabled) {
          const pending = this.deferredLine;
          this.deferredLine = null;
          if (Date.now() - pending.at < 8000 && !this.isSpeakingNow()) {
            this.speakWithBrowserFallback(pending.text, pending.emotion, this.narrationToken, false);
          }
        }
      } catch {
        // ignore mobile speech unlock errors
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Upbeat Stadium / Broadcast Anthem Soundtrack for Menus & Match Intro
  public startSoundtrack() {
    if (this.muted || !this.musicEnabled || this.musicInterval !== null) return;
    if (typeof window === 'undefined') return;

    const bassPattern = [110, 0, 110, 130.81, 146.83, 0, 164.81, 130.81];
    const leadPattern = [440, 0, 523.25, 587.33, 659.25, 587.33, 523.25, 392];

    this.musicInterval = window.setInterval(() => {
      if (this.muted || !this.musicEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const step = this.musicStep % 8;
      this.musicStep += 1;
      const now = ctx.currentTime;

      // Kick drum pulse on even beats
      if (step % 2 === 0) {
        const kick = ctx.createOscillator();
        const kGain = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(115, now);
        kick.frequency.exponentialRampToValueAtTime(42, now + 0.11);
        kGain.gain.setValueAtTime(0.08, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        kick.connect(kGain);
        kGain.connect(ctx.destination);
        kick.start(now);
        kick.stop(now + 0.13);
      }

      // Warm stadium synth bass
      const bFreq = bassPattern[step];
      if (bFreq > 0) {
        const bass = ctx.createOscillator();
        const bGain = ctx.createGain();
        bass.type = 'triangle';
        bass.frequency.setValueAtTime(bFreq, now);
        bGain.gain.setValueAtTime(0.045, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        bass.connect(bGain);
        bGain.connect(ctx.destination);
        bass.start(now);
        bass.stop(now + 0.2);
      }

      // Anthem lead melody
      const lFreq = leadPattern[step];
      if (lFreq > 0) {
        const lead = ctx.createOscillator();
        const lGain = ctx.createGain();
        lead.type = 'sine';
        lead.frequency.setValueAtTime(lFreq, now);
        lGain.gain.setValueAtTime(0.025, now);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        lead.connect(lGain);
        lGain.connect(ctx.destination);
        lead.start(now);
        lead.stop(now + 0.23);
      }
    }, 240);
  }

  public stopSoundtrack() {
    if (this.musicInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  public stopNarration() {
    this.narrationToken += 1;
    if (this.pendingSpeakTimeout !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.pendingSpeakTimeout);
      this.pendingSpeakTimeout = null;
    }
    if (this.currentTtsSource) {
      try {
        this.currentTtsSource.stop();
      } catch {
        // ignore
      }
      this.currentTtsSource = null;
    }
    if (this.currentTtsAudio) {
      try {
        this.currentTtsAudio.pause();
        this.currentTtsAudio.src = '';
      } catch {
        // Ignore audio cleanup errors
      }
      this.currentTtsAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // Ignore speech cancel errors
      }
    }
    this.activeUtterance = null;
  }

  private isSpeakingNow(): boolean {
    const sourcePlaying = Boolean(this.currentTtsSource);
    const audioPlaying = Boolean(this.currentTtsAudio && !this.currentTtsAudio.paused && !this.currentTtsAudio.ended);
    const synthSpeaking =
      typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
    return sourcePlaying || audioPlaying || synthSpeaking;
  }

  private pickBestBrazilianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
    const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));
    if (ptVoices.length === 0) return undefined;

    const maleHints = [
      'antonio',
      'daniel',
      'felipe',
      'rafael',
      'thiago',
      'tiago',
      'rodrigo',
      'fabio',
      'humberto',
      'nicolau',
      'julio',
      'ricardo',
      'paulo',
      'pedro',
      'lucas',
      'mateus',
      'bruno',
      'gustavo',
      'male',
      'masculin',
      'homem',
    ];
    const femaleHints = [
      'francisca',
      'luciana',
      'thalita',
      'maria',
      'vitoria',
      'vitória',
      'fernanda',
      'camila',
      'leticia',
      'letícia',
      'heloisa',
      'raquel',
      'female',
      'feminin',
      'mulher',
    ];

    const scoreVoice = (v: SpeechSynthesisVoice) => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      let score = 0;
      if (lang.includes('pt-br')) score += 60;
      if (maleHints.some((hint) => name.includes(hint))) score += 90;
      if (femaleHints.some((hint) => name.includes(hint))) score -= 45;
      if (name.includes('natural') || name.includes('neural')) score += 35;
      if (name.includes('online')) score += 25;
      if (name.includes('google')) score += 18;
      if (name.includes('espeak') || name.includes('compact')) score -= 35;
      return score;
    };

    return [...ptVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  private speakWithBrowserFallback(
    text: string,
    emotion: NarrationEmotion,
    token: number,
    needsPostCancelDelay = false
  ) {
    if (this.muted || !this.narrationEnabled || token !== this.narrationToken) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const normalized = text
      .replace(/\.\.\./g, ', ')
      .replace(/·/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return;

    const doSpeak = () => {
      if (this.muted || !this.narrationEnabled || token !== this.narrationToken) return;
      try {
        const synth = window.speechSynthesis;
        if (synth.paused) synth.resume();

        const liveVoices = synth.getVoices();
        if (liveVoices.length > 0) this.cachedVoices = liveVoices;

        const utter = new SpeechSynthesisUtterance(normalized);
        utter.lang = 'pt-BR';
        const bestVoice = this.pickBestBrazilianVoice(this.cachedVoices);
        if (bestVoice) utter.voice = bestVoice;

        // Deeper, resonant male sports broadcaster pitch + dynamic play-by-play cadence
        if (emotion === 'goal') {
          utter.rate = 1.18;
          utter.pitch = 0.91;
        } else if (emotion === 'tension') {
          utter.rate = 1.14;
          utter.pitch = 0.87;
        } else if (emotion === 'dramatic') {
          utter.rate = 1.05;
          utter.pitch = 0.81;
        } else {
          utter.rate = 1.08;
          utter.pitch = 0.84;
        }
        utter.volume = 1;

        this.activeUtterance = utter;
        utter.onend = () => {
          if (this.activeUtterance === utter) this.activeUtterance = null;
        };
        utter.onerror = (ev) => {
          if (this.activeUtterance === utter) this.activeUtterance = null;
          if (ev.error === 'not-allowed') {
            this.deferredLine = { text: normalized, emotion, at: Date.now() };
          }
        };

        synth.speak(utter);
      } catch {
        this.deferredLine = { text: normalized, emotion, at: Date.now() };
      }
    };

    if (needsPostCancelDelay) {
      if (this.pendingSpeakTimeout !== null) {
        window.clearTimeout(this.pendingSpeakTimeout);
      }
      this.pendingSpeakTimeout = window.setTimeout(() => {
        this.pendingSpeakTimeout = null;
        doSpeak();
      }, 35);
    } else {
      doSpeak();
    }
  }

  private playAudioDataUrl(dataUrl: string, token: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.muted || !this.narrationEnabled || token !== this.narrationToken) {
        resolve(false);
        return;
      }

      // Prefer unlocked Web Audio API decoding so mobile browsers don't block async playback
      const ctx = this.ensureContext();
      const base64Part = dataUrl.split(',')[1];
      if (ctx && base64Part) {
        try {
          const bin = atob(base64Part);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          ctx.decodeAudioData(
            bytes.buffer.slice(0),
            (audioBuf) => {
              if (token !== this.narrationToken || this.muted || !this.narrationEnabled) {
                resolve(false);
                return;
              }
              const src = ctx.createBufferSource();
              src.buffer = audioBuf;
              src.connect(ctx.destination);
              this.currentTtsSource = src;
              src.onended = () => {
                if (this.currentTtsSource === src) this.currentTtsSource = null;
                resolve(true);
              };
              src.start(0);
            },
            () => {
              this.playHtmlAudioElement(dataUrl, token).then(resolve);
            }
          );
          return;
        } catch {
          // fall through to HTMLAudioElement
        }
      }

      this.playHtmlAudioElement(dataUrl, token).then(resolve);
    });
  }

  private playHtmlAudioElement(dataUrl: string, token: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.muted || !this.narrationEnabled || token !== this.narrationToken || typeof Audio === 'undefined') {
        resolve(false);
        return;
      }
      const audio = new Audio(dataUrl);
      audio.volume = 0.95;
      this.currentTtsAudio = audio;

      const cleanup = () => {
        if (this.currentTtsAudio === audio) {
          this.currentTtsAudio = null;
        }
      };

      audio.onended = () => {
        cleanup();
        resolve(true);
      };
      audio.onerror = () => {
        cleanup();
        resolve(false);
      };

      audio.play().catch(() => {
        cleanup();
        resolve(false);
      });
    });
  }

  // Humanized Brazilian Portuguese Live Speech Narration (Instant Web Speech pt-BR + Neural TTS)
  public speakNarration(text: string, priorityOrOpts: boolean | SpeakNarrationOptions = false) {
    if (this.muted || !this.narrationEnabled || !text.trim()) return;
    if (typeof window === 'undefined') return;

    const opts: SpeakNarrationOptions =
      typeof priorityOrOpts === 'boolean' ? { priority: priorityOrOpts } : priorityOrOpts;
    const priority = Boolean(opts.priority);
    const emotion: NarrationEmotion = opts.emotion || 'normal';

    const now = Date.now();
    if (!priority && now - this.lastNarrationAt < 2300) return;
    if (!priority && this.isSpeakingNow()) return;

    const wasSpeakingSynth =
      'speechSynthesis' in window &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending);

    this.lastNarrationAt = now;
    if (priority) {
      this.stopNarration();
    } else {
      this.narrationToken += 1;
    }

    const token = this.narrationToken;
    const cacheKey = `${emotion}:${text.trim()}`;
    const cachedUrl = this.ttsCache.get(cacheKey);
    if (cachedUrl) {
      void this.playAudioDataUrl(cachedUrl, token).then((ok) => {
        if (!ok && token === this.narrationToken) {
          this.speakWithBrowserFallback(text, emotion, token, false);
        }
      });
      return;
    }

    const isTouchEnv = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (opts.skipAiVoice || now < this.aiVoiceBackoffUntil || isTouchEnv) {
      this.speakWithBrowserFallback(text, emotion, token, priority && wasSpeakingSynth);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2200);

    fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, emotion }),
      signal: controller.signal,
    })
      .then(async (res) => {
        window.clearTimeout(timeoutId);
        if (!res.ok) {
          if (res.status >= 400) {
            this.aiVoiceBackoffUntil = Date.now() + 180000;
          }
          throw new Error('TTS unavailable');
        }
        return (await res.json()) as { audioBase64?: string; mimeType?: string };
      })
      .then(async (data) => {
        if (token !== this.narrationToken || this.muted || !this.narrationEnabled) return;
        if (!data.audioBase64) throw new Error('Empty audio');
        const dataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
        if (this.ttsCache.size >= 30) {
          const firstKey = this.ttsCache.keys().next().value;
          if (firstKey) this.ttsCache.delete(firstKey);
        }
        this.ttsCache.set(cacheKey, dataUrl);
        const played = await this.playAudioDataUrl(dataUrl, token);
        if (!played && token === this.narrationToken) {
          this.speakWithBrowserFallback(text, emotion, token, false);
        }
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        if (token === this.narrationToken) {
          this.speakWithBrowserFallback(text, emotion, token, false);
        }
      });
  }

  public playKick(power = 1, isTrivela = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isTrivela ? 'sawtooth' : 'triangle';
    const baseFreq = (isTrivela ? 165 : 120) + power * 45;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(isTrivela ? 68 : 38, now + 0.11);

    gain.gain.setValueAtTime(Math.min(0.32, 0.16 * power), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playWallBounce(intensity = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.05);

    gain.gain.setValueAtTime(Math.min(0.14, intensity * 0.12), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playPostClang() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [540, 810].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(idx === 0 ? 0.2 : 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);
    });
  }

  public playWhistle(long = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = long ? 0.45 : 0.16;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2650, now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(38, now);
    lfoGain.gain.setValueAtTime(110, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.setValueAtTime(0.11, now + dur - 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + dur + 0.02);
    osc.stop(now + dur + 0.02);
  }

  public playGoalCheer() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [220, 277.18, 329.63, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.88);
    });
  }

  public playClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.035);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playTransferSuccess() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }
}

export const soundEngine = new SoundEngine();
