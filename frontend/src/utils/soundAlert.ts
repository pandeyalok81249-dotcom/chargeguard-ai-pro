/**
 * Browser Web Audio API electronic synthesizer for emergency & warning beeps.
 * Safe, zero-external-asset, client-side audio pulse.
 */

class AudioAlertSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private lastAlertTime: number = 0;

  constructor() {
    // AudioContext is initialized on first user gesture or invocation
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch (e) {
        console.warn('Web Audio API not supported on this browser:', e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Play high-tech two-tone thermal warning alert: 880Hz -> 660Hz
   */
  public playOverheatWarning() {
    if (this.isMuted) return;
    const now = Date.now();
    // Throttle sound to at most once every 3.5 seconds so it doesn't become ear-piercing
    if (now - this.lastAlertTime < 3500) return;
    this.lastAlertTime = now;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // First tone: 880Hz (A5)
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      // Second tone: 659Hz (E5)
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);

      // Volume envelope: soft attack, decaying release
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Error playing audio warning:', e);
    }
  }

  /**
   * Play critical emergency alarm: 3 alternating pulses
   */
  public playCriticalOverheatAlarm() {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastAlertTime < 3000) return;
    this.lastAlertTime = now;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      for (let i = 0; i < 3; i++) {
        const startTime = ctx.currentTime + i * 0.16;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(987.77, startTime); // B5

        gain.gain.setValueAtTime(0.01, startTime);
        gain.gain.linearRampToValueAtTime(0.14, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.14);
      }
    } catch (e) {
      console.warn('Error playing critical alarm:', e);
    }
  }
}

export const audioAlerts = new AudioAlertSystem();
