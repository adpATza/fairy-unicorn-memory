export type SoundKind = 'flip' | 'match' | 'miss';

/** The Godot edition's synthesised tones: notes (Hz), duration (s) and volume. */
const TONES: Record<SoundKind, [number[], number, number]> = {
  flip: [[440], 0.055, 0.09],
  match: [[523.25, 659.25, 783.99], 0.28, 0.1],
  miss: [[293.66], 0.12, 0.07],
};
const RATE = 22050;

/**
 * Plays the game's short tones with Web Audio. Browsers only allow audio after
 * a user gesture, so the context is created or resumed on the first tap or key.
 */
export class Sounds {
  private context: AudioContext | null = null;
  private buffers = new Map<SoundKind, AudioBuffer>();

  constructor() {
    const unlock = () => this.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(type, unlock, { capture: true, passive: true });
  }

  private unlock(): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      this.context = null;
    }
  }

  play(kind: SoundKind): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    let buffer = this.buffers.get(kind);
    if (!buffer) {
      buffer = synthesise(context, ...TONES[kind]);
      this.buffers.set(kind, buffer);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
  }
}

/** Same waveform as main.gd::_tone: summed sines with a soft attack and decay. */
function synthesise(context: AudioContext, notes: number[], duration: number, volume: number): AudioBuffer {
  const length = Math.floor(RATE * duration);
  const buffer = context.createBuffer(1, length, RATE);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    let value = 0;
    for (const hz of notes) value += Math.sin(2 * Math.PI * hz * t);
    data[i] = ((value * volume) / notes.length) * Math.sin((Math.PI * t) / duration) * Math.exp(-5 * t);
  }
  return buffer;
}
