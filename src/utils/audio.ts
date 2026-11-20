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
  private ttsCache = new Map<string, string>();
  private aiVoiceBackoffUntil: number = 0;

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
        window.speechSynthesis.cancel();
      } catch {
        // Ignore speech cancel errors
      }
    }
  }

  private isSpeakingNow(): boolean {
    const audioPlaying = Boolean(this.currentTtsAudio && !this.currentTtsAudio.paused && !this.currentTtsAudio.ended);
    const synthSpeaking =
      typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
    return audioPlaying || synthSpeaking;
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

  private speakWithBrowserFallback(text: string, emotion: NarrationEmotion, token: number) {
    if (this.muted || !this.narrationEnabled || token !== this.narrationToken) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      const normalized = text
        .replace(/\.\.\./g, ', ')
        .replace(/·/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();

      const utter = new SpeechSynthesisUtterance(normalized);
      utter.lang = 'pt-BR';
      const bestVoice = this.pickBestBrazilianVoice(window.speechSynthesis.getVoices());
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
      utter.volume = 0.95;
      window.speechSynthesis.speak(utter);
    } catch {
      // Speech synthesis gracefully ignored if blocked
    }
  }

  private playAudioDataUrl(dataUrl: string, token: number): Promise<boolean> {
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

  // Humanized Brazilian Portuguese Live Speech Narration (Neural TTS + Natural Fallback)
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
          this.speakWithBrowserFallback(text, emotion, token);
        }
      });
      return;
    }

    if (opts.skipAiVoice || now < this.aiVoiceBackoffUntil) {
      this.speakWithBrowserFallback(text, emotion, token);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3800);

    fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, emotion }),
      signal: controller.signal,
    })
      .then(async (res) => {
        window.clearTimeout(timeoutId);
        if (!res.ok) {
          if (res.status === 429 || res.status === 403 || res.status >= 500) {
            this.aiVoiceBackoffUntil = Date.now() + 45000;
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
          this.speakWithBrowserFallback(text, emotion, token);
        }
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        if (token === this.narrationToken) {
          this.speakWithBrowserFallback(text, emotion, token);
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
