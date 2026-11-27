// Procedural Web Audio API sound effects & island adventure soundtrack (zero external MP3s)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private muted = false;
  private musicTimer: number | null = null;
  private stepIndex = 0;
  private isPlayingMusic = false;

  // Cheerful, mysterious island marimba-style pentatonic motif (MIDI note numbers)
  private readonly melodyPattern = [
    64, 67, 71, 74, 71, 67, 69, 71,
    64, 67, 72, 76, 74, 71, 69, 67,
    62, 67, 71, 74, 72, 69, 67, 64,
    60, 64, 67, 71, 69, 67, 64, 62,
  ];
  private readonly bassPattern = [
    40, 0, 40, 0, 47, 0, 43, 0,
    40, 0, 40, 0, 45, 0, 43, 0,
    38, 0, 38, 0, 45, 0, 43, 0,
    36, 0, 36, 0, 43, 0, 38, 0,
  ];

  public unlock() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.7;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.24;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        mute ? 0 : 0.7,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  public startMusic() {
    this.unlock();
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    this.scheduleNextBeat();
  }

  public stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleNextBeat() {
    if (!this.isPlayingMusic) return;
    if (this.ctx && this.musicGain && !this.muted && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      const idx = this.stepIndex % this.melodyPattern.length;
      const melodyNote = this.melodyPattern[idx];
      const bassNote = this.bassPattern[idx];

      if (melodyNote > 0) {
        this.playMarimbaNote(this.midiToFreq(melodyNote), now, 0.26, 0.18);
      }
      if (bassNote > 0) {
        this.playPadNote(this.midiToFreq(bassNote), now, 0.55, 0.14);
      }
      this.stepIndex++;
    }
    this.musicTimer = window.setTimeout(() => this.scheduleNextBeat(), 280);
  }

  private playMarimbaNote(
    freq: number,
    time: number,
    duration: number,
    volume: number,
  ) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, time);

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.18, time);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.4);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    overtone.start(time);
    osc.stop(time + duration + 0.02);
    overtone.stop(time + duration + 0.02);
  }

  private playPadNote(
    freq: number,
    time: number,
    duration: number,
    volume: number,
  ) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        now + duration,
      );
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playCoin() {
    this.unlock();
    this.playTone(987.77, 987.77, 0.08, 'sine', 0.35, 0);
    this.playTone(1318.51, 1318.51, 0.22, 'sine', 0.35, 0.065);
  }

  public playChest() {
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, n, 0.26, 'triangle', 0.36, i * 0.07);
    });
  }

  public playJump() {
    this.unlock();
    this.playTone(210, 480, 0.16, 'sine', 0.28, 0);
  }

  public playLand() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(115, 55, 0.09, 'triangle', 0.2, 0);
  }

  public playStomp() {
    this.unlock();
    this.playTone(260, 620, 0.14, 'triangle', 0.38, 0);
    this.playTone(740, 880, 0.15, 'sine', 0.25, 0.07);
  }

  public playHurt() {
    this.unlock();
    this.playTone(240, 85, 0.24, 'sawtooth', 0.28, 0);
    this.playTone(170, 60, 0.28, 'square', 0.18, 0.04);
  }

  public playPortalUnlock() {
    this.unlock();
    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((freq, i) => {
      this.playTone(freq, freq * 1.01, 0.45, 'sine', 0.25, i * 0.06);
    });
  }

  public playLevelWin() {
    this.unlock();
    const melody = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    melody.forEach((f, i) => {
      this.playTone(f, f, 0.32, 'triangle', 0.35, i * 0.09);
    });
  }

  public playVictory() {
    this.unlock();
    const fanfare = [523.25, 523.25, 659.25, 783.99, 659.25, 1046.5];
    const delays = [0, 0.12, 0.24, 0.38, 0.54, 0.68];
    fanfare.forEach((f, i) => {
      this.playTone(f, f, 0.42, 'triangle', 0.38, delays[i]);
    });
  }

  public playGameOver() {
    this.unlock();
    const notes = [392.0, 349.23, 311.13, 261.63];
    notes.forEach((f, i) => {
      this.playTone(f, f * 0.96, 0.35, 'triangle', 0.32, i * 0.14);
    });
  }
}

export const soundEngine = new SoundEngine();
