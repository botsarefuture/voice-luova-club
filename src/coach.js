import { centsOff, frequencyToMidi, midiToNoteName } from "./audio";

export const TARGET_MATCH_TOLERANCE_CENTS = 50;

export function buildCoachTips({ history, targetFrequency, currentFrequency, dailySession }) {
  const voiced = history.filter((sample) => sample.frequency && sample.clarity > 0.35);
  const recent = voiced.slice(-40);
  const tips = [];

  if (voiced.length < 10) {
    return [
      {
        title: "I am listening for an easy tone",
        text: "Start with a small mmm or ee. Keep it gentle enough that you could do it for a few minutes.",
      },
    ];
  }

  const averageVolume = recent.reduce((sum, sample) => sum + sample.volume, 0) / recent.length;
  const averageClarity = recent.reduce((sum, sample) => sum + sample.clarity, 0) / recent.length;
  const midiValues = recent.map((sample) => 69 + 12 * Math.log2(sample.frequency / 440));
  const meanMidi = midiValues.reduce((sum, midi) => sum + midi, 0) / midiValues.length;
  const pitchSpread = Math.sqrt(
    midiValues.reduce((sum, midi) => sum + (midi - meanMidi) ** 2, 0) / midiValues.length,
  );

  if (targetFrequency && currentFrequency) {
    const cents = centsOff(currentFrequency, targetFrequency);
    if (Math.abs(cents) <= 18) {
      tips.push({ title: "That pitch is centered", text: "Good. Now make it feel repeatable: light airflow, forward buzz, and no extra loudness." });
    } else if (cents > 18) {
      tips.push({ title: "Let it settle a little", text: `You are ${Math.abs(cents)} cents above the target. Relax the jaw and think smaller, not lower.` });
    } else {
      tips.push({ title: "Lift with brightness, not force", text: `You are ${Math.abs(cents)} cents below the target. Try a narrower ee shape before adding volume.` });
    }
  }

  if (pitchSpread > 0.45) {
    tips.push({ title: "Make it boring on purpose", text: "The pitch is wobbling. Hold one simple note for two beats, then release. Smooth beats impressive." });
  }

  if (averageClarity < 0.48) {
    tips.push({ title: "Try a cleaner shape", text: "The signal is fuzzy. Move slightly closer to the mic, then use a narrow ee or ih with the buzz near the lips." });
  }

  if (averageVolume > 0.18) {
    tips.push({ title: "Softer will train better", text: "Your signal is strong enough. Feminization practice works best with sustainable volume, not force." });
  } else if (averageVolume < 0.035) {
    tips.push({ title: "Clearer, not louder", text: "The mic is barely hearing you. Stay relaxed and aim the sound forward before increasing volume." });
  }

  if (dailySession.lowMidi !== null && dailySession.highMidi !== null) {
    tips.push({
      title: "Today's range is mapped",
      text: `Your detected range today reaches ${midiToNoteName(dailySession.lowMidi)} to ${midiToNoteName(dailySession.highMidi)}.`,
    });
  }

  return tips.slice(0, 3);
}

export function scoreAttempt({ targetFrequency, samples, allowContour = false }) {
  const voiced = samples.filter((sample) => sample.frequency && sample.clarity > 0.55);
  if (voiced.length < 8) return { score: 0, label: "Need a longer tone", cents: null };

  let longestRunMs = 0;
  let runStartedAt = voiced[0].time;
  for (let index = 1; index < voiced.length; index += 1) {
    if (voiced[index].time - voiced[index - 1].time > 250) runStartedAt = voiced[index].time;
    longestRunMs = Math.max(longestRunMs, voiced[index].time - runStartedAt);
  }

  const cents = voiced.map((sample) => centsOff(sample.frequency, targetFrequency));
  const pitchTravelCents = Math.round(Math.max(...cents) - Math.min(...cents));
  const mean = cents.reduce((sum, value) => sum + value, 0) / cents.length;
  const spread = Math.sqrt(cents.reduce((sum, value) => sum + (value - mean) ** 2, 0) / cents.length);
  // A beginner needs room to learn the motion. This rewards a relaxed,
  // reasonably steady repeat instead of demanding near-perfect cents.
  const accuracy = Math.max(0, 100 - Math.abs(mean) * 0.8 - spread * 0.65);
  const stable = allowContour ? spread <= 220 : spread <= 55;
  const stableAboveTarget = stable && mean > TARGET_MATCH_TOLERANCE_CENTS;
  const stableBelowTarget = stable && mean < -TARGET_MATCH_TOLERANCE_CENTS;
  const withinTargetZone = Math.abs(mean) <= TARGET_MATCH_TOLERANCE_CENTS;

  let label = "Good data, try one small adjustment";
  if (longestRunMs < 1800) label = "Keep the tone going a little longer";
  else if (allowContour && longestRunMs >= 1800) label = "Phrase movement captured";
  else if (withinTargetZone) label = "Comfortable hold zone";
  else if (Math.abs(mean) > 65) label = mean > 0 ? "Let the pitch settle" : "Lift with a brighter vowel";

  return {
    score: Math.round(accuracy),
    label,
    cents: Math.round(mean),
    spread: Math.round(spread),
    stableAboveTarget,
    stableBelowTarget,
    matched: allowContour ? longestRunMs >= 1800 : withinTargetZone && stable && longestRunMs >= 1800,
    sustainedMs: longestRunMs,
    pitchTravelCents,
    targetNote: midiToNoteName(frequencyToMidi(targetFrequency)),
  };
}
