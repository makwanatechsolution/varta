class VartaAudioEngine {
  private ctx: AudioContext | null = null;
  private currentGain: GainNode | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeIntervals: number[] = [];
  private isMuted = false;

  constructor() {
    this.attachUnlockListeners();
  }

  private attachUnlockListeners() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  private init() {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // ─── 1. Custom Varta Incoming Ringtone (Melodic Harmonic Chime Loop) ─────
  public playIncomingRing() {
    if (this.isMuted) return;
    this.stop();
    this.init();
    if (!this.ctx) return;

    const playMelodicTrill = () => {
      if (!this.ctx || this.isMuted) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      const t = this.ctx.currentTime;

      // Soft dual chord (E5: 659.25Hz, G#5: 830.61Hz, B5: 987.77Hz)
      const notes = [659.25, 830.61, 987.77];
      notes.forEach((freq, idx) => {
        try {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);
          // Pitch shimmer effect
          osc.frequency.exponentialRampToValueAtTime(freq * 1.05, t + 0.15);
          osc.frequency.exponentialRampToValueAtTime(freq, t + 0.4);

          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.15 / (idx + 1), t + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

          osc.connect(gain);
          gain.connect(this.ctx!.destination);

          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.9);
          this.activeOscillators.push(osc);
        } catch {}
      });
    };

    playMelodicTrill();
    const interval = window.setInterval(playMelodicTrill, 1600);
    this.activeIntervals.push(interval);
  }

  // ─── 2. Custom Varta Outgoing Ringtone (Soft Ambient Pulsing Loop) ───────
  public playOutgoingRing() {
    if (this.isMuted) return;
    this.stop();
    this.init();
    if (!this.ctx) return;

    const playSoftPulse = () => {
      if (!this.ctx || this.isMuted) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      const t = this.ctx.currentTime;

      // Warm dual tone (F4: 349.23Hz + C5: 523.25Hz)
      const freqs = [349.23, 523.25];
      freqs.forEach((freq) => {
        try {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.1, t + 0.3);
          gain.gain.linearRampToValueAtTime(0.1, t + 1.2);
          gain.gain.linearRampToValueAtTime(0.001, t + 1.6);

          osc.connect(gain);
          gain.connect(this.ctx!.destination);

          osc.start(t);
          osc.stop(t + 1.65);
          this.activeOscillators.push(osc);
        } catch {}
      });
    };

    playSoftPulse();
    const interval = window.setInterval(playSoftPulse, 3200);
    this.activeIntervals.push(interval);
  }

  // ─── 3. Call Ended Tone (Gentle 2-tone Descending Chime) ─────────────────
  public playCallEnded() {
    this.stop();
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    const t = this.ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0 },    // C5
      { freq: 392.00, time: 0.18 },  // G4
    ];

    notes.forEach(({ freq, time }) => {
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + time);

        gain.gain.setValueAtTime(0, t + time);
        gain.gain.linearRampToValueAtTime(0.2, t + time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + time + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(t + time);
        osc.stop(t + time + 0.45);
        this.activeOscillators.push(osc);
      } catch {}
    });
  }

  // ─── 4. Busy Tone (Soft Repeating Dual Pulse) ────────────────────────────
  public playBusyTone() {
    this.stop();
    this.init();
    if (!this.ctx) return;

    const playBeep = () => {
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      const t = this.ctx.currentTime;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(480, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.25);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.3);
        this.activeOscillators.push(osc);
      } catch {}
    };

    playBeep();
    let count = 0;
    const interval = window.setInterval(() => {
      count++;
      if (count >= 5) {
        this.stop();
        return;
      }
      playBeep();
    }, 500);
    this.activeIntervals.push(interval);
  }

  // ─── 5. Missed Call Tone (Soft Alert Chime) ──────────────────────────────
  public playMissedCall() {
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    const t = this.ctx.currentTime;
    const notes = [440, 370];
    notes.forEach((freq, idx) => {
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + idx * 0.12);

        gain.gain.setValueAtTime(0, t + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, t + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(t + idx * 0.12);
        osc.stop(t + idx * 0.12 + 0.35);
        this.activeOscillators.push(osc);
      } catch {}
    });
  }

  // ─── 6. Message Notification Sound (Crisp Bubble Pop) ────────────────────
  public playMessageSound() {
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(1400, t + 0.08);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.13);
      this.activeOscillators.push(osc);
    } catch {}
  }

  // ─── Stop All Audio Tones Cleanly ─────────────────────────────────────────
  public stop() {
    this.activeIntervals.forEach((id) => clearInterval(id));
    this.activeIntervals = [];

    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];

    if (this.currentGain) {
      try {
        this.currentGain.disconnect();
      } catch {}
      this.currentGain = null;
    }
  }
}

export const callAudio = new VartaAudioEngine();
