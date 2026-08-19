/* ==========================================================================
   RETRO WAVE ARCADE - WEB AUDIO CHIPTUNE SYNTHESIZER
   ========================================================================== */

class RetroAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.currentTrackIndex = 0;
    this.timerId = null;
    this.noteStep = 0;
    this.volume = 0.2;
    this.muted = false;

    // Track Presets (Chiptune Note Frequencies in Hz)
    this.tracks = [
      {
        name: "SYNTHWAVE NIGHTS '84",
        tempo: 120,
        scale: [220, 247.0, 261.6, 293.7, 329.6, 349.2, 392.0, 440], // A Minor
        bass: [110, 110, 130.8, 146.8]
      },
      {
        name: "CYBERPUNK CHIPTUNE PARADISE",
        tempo: 140,
        scale: [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3], // C Pentatonic
        bass: [130.8, 130.8, 174.6, 196.0]
      },
      {
        name: "8-BIT ARCADE ADVENTURE",
        tempo: 150,
        scale: [329.6, 392.0, 440.0, 493.9, 523.3, 587.3, 659.3, 784.0], // E Minor
        bass: [164.8, 146.8, 130.8, 164.8]
      }
    ];
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a retro blip sound for UI buttons
  playUiBeep(freq = 440, duration = 0.08, type = 'square') {
    if (this.muted) return;
    try {
      this.initContext();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context blocked until user gesture.", e);
    }
  }

  // Play Laser Sound FX for arcade games
  playLaserSound() {
    if (this.muted) return;
    try {
      this.initContext();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(this.volume * 1.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {}
  }

  // Play Explosion FX for arcade games
  playExplosionSound() {
    if (this.muted) return;
    try {
      this.initContext();
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1; // White noise
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.25);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 1.5, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
      whiteNoise.stop(this.ctx.currentTime + 0.25);
    } catch (e) {}
  }

  // Play Retro Printer Chiptune Sound FX
  playPrinterSound() {
    if (this.muted) return;
    try {
      this.initContext();
      
      // Clean retro stepping motor sequence
      const pulses = 14;
      for (let i = 0; i < pulses; i++) {
        const startTime = this.ctx.currentTime + (i * 0.11);
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        const pitch = 350 + (i % 4) * 110;
        osc.type = 'square';
        osc.frequency.setValueAtTime(pitch, startTime);
        osc.frequency.linearRampToValueAtTime(pitch * 0.8, startTime + 0.07);

        gain.gain.setValueAtTime(this.volume * 0.5, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.07);
      }

      // Final paper feed completion beep
      const chirpTime = this.ctx.currentTime + (pulses * 0.11);
      this.playUiBeep(1200, 0.12, 'square');

    } catch (e) {}
  }

  // Start background chiptune track loop generator
  togglePlay() {
    this.initContext();
    if (this.isPlaying) {
      this.stop();
    } else {
      this.isPlaying = true;
      this.scheduleNextNote();
    }
    return this.isPlaying;
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.noteStep = 0;
    return this.tracks[this.currentTrackIndex].name;
  }

  scheduleNextNote() {
    if (!this.isPlaying) return;

    const track = this.tracks[this.currentTrackIndex];
    const stepDuration = 60 / track.tempo / 2; // sixteenth notes

    // Melody Note (Arpeggiated)
    const melodyIndex = (this.noteStep * 3 + (this.noteStep % 5)) % track.scale.length;
    const freq = track.scale[melodyIndex];

    if (!this.muted) {
      this.playNote(freq, stepDuration * 0.8, 'square', this.volume * 0.6);
      
      // Bassline Note every 4 steps
      if (this.noteStep % 4 === 0) {
        const bassFreq = track.bass[(this.noteStep / 4) % track.bass.length];
        this.playNote(bassFreq, stepDuration * 1.5, 'triangle', this.volume * 0.8);
      }
    }

    // Trigger visualizer animation effect
    if (window.updateSpectrumBars) {
      window.updateSpectrumBars();
    }

    this.noteStep++;
    this.timerId = setTimeout(() => this.scheduleNextNote(), stepDuration * 1000);
  }

  playNote(freq, duration, type, vol) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }
}

// Global Singleton Instance
window.retroAudio = new RetroAudioEngine();
