class CallAudio {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private interval: number | null = null;
  private isPlaying = false;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playOutgoingRing() {
    this.stop();
    this.init();
    this.isPlaying = true;
    if (!this.ctx) return;

    // Standard UK/Europe/Asia outgoing ring tone: 400Hz + 450Hz
    // Pattern: 0.4s ON, 0.2s OFF, 0.4s ON, 2s OFF
    const playTone = () => {
      if (!this.isPlaying || !this.ctx) return;
      
      const t = this.ctx.currentTime;
      this.osc1 = this.ctx.createOscillator();
      this.osc2 = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();

      this.osc1.frequency.value = 400;
      this.osc2.frequency.value = 450;
      
      this.osc1.connect(this.gain);
      this.osc2.connect(this.gain);
      this.gain.connect(this.ctx.destination);

      // Envelope 1
      this.gain.gain.setValueAtTime(0, t);
      this.gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      this.gain.gain.setValueAtTime(0.3, t + 0.4);
      this.gain.gain.linearRampToValueAtTime(0, t + 0.45);
      
      // Envelope 2
      this.gain.gain.setValueAtTime(0, t + 0.6);
      this.gain.gain.linearRampToValueAtTime(0.3, t + 0.65);
      this.gain.gain.setValueAtTime(0.3, t + 1.0);
      this.gain.gain.linearRampToValueAtTime(0, t + 1.05);

      this.osc1.start(t);
      this.osc2.start(t);
      this.osc1.stop(t + 1.1);
      this.osc2.stop(t + 1.1);
    };

    playTone();
    this.interval = window.setInterval(playTone, 3000);
  }

  playIncomingRing() {
    this.stop();
    this.init();
    this.isPlaying = true;
    if (!this.ctx) return;

    // Incoming electronic trill
    const playTone = () => {
      if (!this.isPlaying || !this.ctx) return;
      
      const t = this.ctx.currentTime;
      this.osc1 = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();

      this.osc1.type = "sine";
      this.osc1.connect(this.gain);
      this.gain.connect(this.ctx.destination);

      // Trill frequencies
      this.osc1.frequency.setValueAtTime(880, t);
      this.osc1.frequency.setValueAtTime(1100, t + 0.1);
      this.osc1.frequency.setValueAtTime(880, t + 0.2);
      this.osc1.frequency.setValueAtTime(1100, t + 0.3);
      this.osc1.frequency.setValueAtTime(880, t + 0.4);
      this.osc1.frequency.setValueAtTime(1100, t + 0.5);

      this.gain.gain.setValueAtTime(0, t);
      this.gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
      this.gain.gain.setValueAtTime(0.4, t + 0.55);
      this.gain.gain.linearRampToValueAtTime(0, t + 0.6);

      this.osc1.start(t);
      this.osc1.stop(t + 0.65);
    };

    playTone();
    this.interval = window.setInterval(playTone, 2000);
  }

  stop() {
    this.isPlaying = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.osc1) {
      try { this.osc1.stop(); } catch(e) {}
      this.osc1.disconnect();
      this.osc1 = null;
    }
    if (this.osc2) {
      try { this.osc2.stop(); } catch(e) {}
      this.osc2.disconnect();
      this.osc2 = null;
    }
    if (this.gain) {
      this.gain.disconnect();
      this.gain = null;
    }
  }
}

export const callAudio = new CallAudio();
