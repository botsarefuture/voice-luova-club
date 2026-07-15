export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function frequencyToMidi(frequency) {
  return Math.round(frequencyToMidiExact(frequency));
}

export function frequencyToMidiExact(frequency) {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function midiToNoteName(midi) {
  const roundedMidi = Math.round(midi);
  const name = NOTE_NAMES[((roundedMidi % 12) + 12) % 12];
  const octave = Math.floor(roundedMidi / 12) - 1;
  return `${name}${octave}`;
}

export function centsOff(frequency, targetFrequency) {
  return Math.round(1200 * Math.log2(frequency / targetFrequency));
}

export function analyzePitch(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);

  if (rms < 0.012) {
    return { frequency: null, clarity: 0, volume: rms };
  }

  const correlations = new Float32Array(buffer.length);
  let bestOffset = -1;
  let bestCorrelation = 0;
  const minOffset = Math.floor(sampleRate / 1100);
  const maxOffset = Math.min(Math.floor(sampleRate / 65), Math.floor(buffer.length / 2));

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let correlation = 0;
    for (let i = 0; i < buffer.length - offset; i += 1) {
      correlation += buffer[i] * buffer[i + offset];
    }
    correlations[offset] = correlation;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset < 0 || bestCorrelation < 0.01) {
    return { frequency: null, clarity: 0, volume: rms };
  }

  const prev = correlations[bestOffset - 1] || bestCorrelation;
  const next = correlations[bestOffset + 1] || bestCorrelation;
  const shift = (next - prev) / (2 * (2 * bestCorrelation - prev - next));
  const refinedOffset = bestOffset + (Number.isFinite(shift) ? shift : 0);
  const clarity = Math.min(1, bestCorrelation / (rms * rms * buffer.length));

  return {
    frequency: sampleRate / refinedOffset,
    clarity,
    volume: rms,
  };
}

export function formatFrequency(frequency) {
  return frequency ? `${frequency.toFixed(1)} Hz` : "--";
}

export function formatRange(lowMidi, highMidi) {
  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) return "--";
  return `${midiToNoteName(lowMidi)} - ${midiToNoteName(highMidi)}`;
}

export function semitoneSpan(lowMidi, highMidi) {
  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) return 0;
  return Math.max(0, highMidi - lowMidi);
}
