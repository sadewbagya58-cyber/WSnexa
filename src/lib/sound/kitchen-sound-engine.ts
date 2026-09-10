const MUTE_STORAGE_KEY = 'wsnexa_kitchen_sound_muted';

class KitchenSoundEngine {
  private audioCtx: AudioContext | null = null;
  private playedOrderIds: Set<string> = new Set();
  private playedCancellationOrderIds: Set<string> = new Set();
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const storedMute = localStorage.getItem(MUTE_STORAGE_KEY);
      this.isMuted = storedMute === 'true';
    }
  }

  /**
   * Initializes Web Audio API context on first user interaction gesture.
   */
  public initAudioContext(): void {
    if (typeof window === 'undefined') return;

    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
    }
  }

  /**
   * Plays a pleasant multi-tone chime for a NEW order.
   * Ensures duplicate order events never replay the sound.
   */
  public playNewOrderChime(orderId: string): void {
    if (this.isMuted) return;
    if (this.playedOrderIds.has(orderId)) return;

    // Track played order ID to guarantee single sound execution per order
    this.playedOrderIds.add(orderId);
    if (this.playedOrderIds.size > 200) {
      const firstKey = this.playedOrderIds.values().next().value;
      if (firstKey) this.playedOrderIds.delete(firstKey);
    }

    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;

      // Play 2-tone pleasant kitchen chime (E5 -> A5)
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.setValueAtTime(880.0, now + 0.12); // A5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);

      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);

      osc2.start(now + 0.12);
      osc2.stop(now + 0.5);
    } catch (err: unknown) {
      console.error('Failed to play kitchen chime:', err);
    }
  }

  /**
   * Plays a sharp, distinctive warning alert for a CANCELLED order (QA-10).
   * Grabs kitchen staff attention immediately with a 3-pulse descending tone.
   */
  public playCancellationAlert(orderId: string): void {
    if (this.isMuted) return;
    if (this.playedCancellationOrderIds.has(orderId)) return;

    this.playedCancellationOrderIds.add(orderId);
    if (this.playedCancellationOrderIds.size > 200) {
      const firstKey = this.playedCancellationOrderIds.values().next().value;
      if (firstKey) this.playedCancellationOrderIds.delete(firstKey);
    }

    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;

      // 3-pulse descending warning tone: 880Hz -> 587Hz -> 440Hz
      const tones = [880, 587, 440];
      tones.forEach((freq, idx) => {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        const startTime = now + idx * 0.14;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.11);
      });
    } catch (err: unknown) {
      console.error('Failed to play cancellation alert:', err);
    }
  }
}

export const kitchenSoundEngine = new KitchenSoundEngine();
