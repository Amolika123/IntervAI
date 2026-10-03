// Speech & Voice Engine for IntervAI

export type VoiceState = 
  | 'IDLE' 
  | 'READY_TO_START'
  | 'AI_THINKING' 
  | 'AI_SPEAKING' 
  | 'LISTENING' 
  | 'PROCESSING_ANSWER' 
  | 'GENERATING_NEXT_QUESTION' 
  | 'INTERVIEW_ENDED' 
  | 'ERROR';

export interface SpeechEngineCallbacks {
  onStateChange: (state: VoiceState) => void;
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError: (errorMsg: string) => void;
}

export class SpeechEngine {
  private callbacks: SpeechEngineCallbacks;
  private recognition: any = null;
  private audioPlayer: HTMLAudioElement | null = null;
  private isListening = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private currentTranscript = '';
  private voicesLoaded = false;
  private voices: SpeechSynthesisVoice[] = [];

  constructor(callbacks: SpeechEngineCallbacks) {
    this.callbacks = callbacks;
    this.initRecognition();
    this.initVoices();
  }

  private initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
        this.voicesLoaded = true;
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  // Warmup audio context on user gesture click
  public unlockAudioContext() {
    if (typeof window === 'undefined') return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const silentUtterance = new SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume();
      }
    } catch (e) {
      console.warn('AudioContext warmup warning:', e);
    }
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = 
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcriptPiece + ' ';
          } else {
            interim += transcriptPiece;
          }
        }

        if (final) {
          this.currentTranscript += final;
        }

        const combinedText = (this.currentTranscript + ' ' + interim).trim();
        this.callbacks.onInterimTranscript(combinedText);

        if (combinedText.length > 0) {
          this.resetSilenceTimer();
        }
      };

      rec.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.callbacks.onError('Microphone access denied. Please allow microphone permissions in browser.');
        }
      };

      rec.onend = () => {
        if (this.isListening) {
          try {
            rec.start();
          } catch (e) {
            // Restarting
          }
        }
      };

      this.recognition = rec;
    }
  }

  // Speak AI question aloud
  public async speakAIQuestion(text: string): Promise<void> {
    this.stopListening();
    this.callbacks.onStateChange('AI_SPEAKING');

    // 1. Try backend OpenAI TTS API
    try {
      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (ttsRes.ok) {
        const contentType = ttsRes.headers.get('Content-Type');
        if (contentType && contentType.includes('audio/mpeg')) {
          const blob = await ttsRes.blob();
          const url = URL.createObjectURL(blob);

          if (!this.audioPlayer) {
            this.audioPlayer = new Audio();
          }

          this.audioPlayer.src = url;

          return new Promise((resolve) => {
            if (!this.audioPlayer) return resolve();

            let hasEnded = false;
            const finish = () => {
              if (hasEnded) return;
              hasEnded = true;
              this.callbacks.onStateChange('LISTENING');
              this.startListening();
              resolve();
            };

            this.audioPlayer.onended = finish;
            this.audioPlayer.onerror = () => {
              this.speakWithWebSpeech(text, resolve);
            };

            this.audioPlayer.play().catch(() => {
              this.speakWithWebSpeech(text, resolve);
            });
          });
        }
      }
    } catch (e) {
      console.warn('TTS fetch error:', e);
    }

    // 2. Fallback to Browser SpeechSynthesis
    return new Promise((resolve) => {
      this.speakWithWebSpeech(text, resolve);
    });
  }

  private speakWithWebSpeech(text: string, onDone: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.callbacks.onStateChange('LISTENING');
      this.startListening();
      onDone();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Natural speaking rate
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    const voices = this.voices.length > 0 ? this.voices : window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen')));
    if (naturalVoice) utterance.voice = naturalVoice;

    let hasFinished = false;
    const finishSpeech = () => {
      if (hasFinished) return;
      hasFinished = true;
      if (safetyTimeout) clearTimeout(safetyTimeout);
      this.callbacks.onStateChange('LISTENING');
      this.startListening();
      onDone();
    };

    utterance.onend = finishSpeech;
    utterance.onerror = finishSpeech;

    // Safety timeout guardrail (e.g. 10s max speech duration before listening)
    const estimatedDurationMs = Math.max(4000, (text.split(' ').length / 2.5) * 1000 + 2000);
    const safetyTimeout = setTimeout(finishSpeech, estimatedDurationMs);

    window.speechSynthesis.speak(utterance);
  }

  public startListening() {
    this.stopSpeaking();
    this.currentTranscript = '';
    this.isListening = true;
    this.callbacks.onStateChange('LISTENING');

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        // Recognition already running
      }
    }
  }

  public stopListening() {
    this.isListening = false;
    this.clearSilenceTimer();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
    }
  }

  private resetSilenceTimer() {
    this.clearSilenceTimer();

    this.silenceTimer = setTimeout(() => {
      if (this.currentTranscript.trim().length > 0) {
        const finalized = this.currentTranscript.trim();
        this.stopListening();
        this.callbacks.onStateChange('PROCESSING_ANSWER');
        this.callbacks.onFinalTranscript(finalized);
      }
    }, 1800);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public destroy() {
    this.stopSpeaking();
    this.stopListening();
    this.clearSilenceTimer();
  }
}
