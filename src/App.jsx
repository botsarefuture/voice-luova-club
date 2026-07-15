import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ExternalLink,
  Gauge,
  HeartPulse,
  Mic,
  MessageCircle,
  Music2,
  PauseCircle,
  RotateCcw,
  Trash2,
  Sparkles,
  Square,
  Target,
  Timer,
  Trophy,
  UserRound,
  Volume2,
  Waves,
  ShieldCheck,
} from "lucide-react";
import {
  analyzePitch,
  centsOff,
  formatFrequency,
  formatRange,
  frequencyToMidi,
  midiToFrequency,
  midiToNoteName,
  semitoneSpan,
} from "./audio";
import { deleteAccount, downloadPrivateRecording, exportAccountData, listPrivateRecordings, loadCloudProgress, loadMe, loginAccount, logoutAccount, registerAccount, removePrivateRecording as deletePrivateRecording, requestEmailVerification, saveCloudProgress, submitFeedback, uploadPrivateRecording } from "./api";
import { buildCoachTips, scoreAttempt } from "./coach";
import {
  dayKey,
  getDeviceId,
  loadProgress,
  loadTodaySession,
  mergeProgressRecords,
  mergeTodayIntoProgress,
  saveProgress,
  saveTodaySession,
} from "./storage";
import { decryptRecording, deriveRecordingKey, encryptRecording } from "./recordings";

const EXERCISE_STEPS = [0, 1, 2, 3, 5, 7, 8, 10, 12];
const DEFAULT_COMFORT_ANCHOR = 52;
const MAX_TRAINING_MIDI = 77;

const APP_VIEWS = [
  { id: "today", label: "Today", icon: HeartPulse },
  { id: "practice", label: "Practice", icon: Waves },
  { id: "progress", label: "Progress", icon: Activity },
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "account", label: "Settings", icon: UserRound },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "feedback", label: "Feedback", icon: MessageCircle },
];
const MAIN_VIEW_IDS = new Set(["today", "practice", "progress", "learn"]);

function initialView() {
  const view = window.location.hash.replace("#", "");
  return APP_VIEWS.some((item) => item.id === view) ? view : "today";
}

const PRACTICE_FLOW = [
  {
    id: "warmup",
    label: "Warmup",
    title: "Easy sound exploration",
    prompt: "Use a soft hum, oo, vv, or lip trill. Keep it smooth; this is exploration, not a test.",
    target: "Comfort first",
    icon: HeartPulse,
  },
  {
    id: "pitch",
    label: "Pitch",
    title: "Light pitch exploration",
    prompt: "Hear the tone, glide toward it, and settle on a light ee. A close, easy match is enough to advance.",
    target: "Accurate and easy",
    icon: Target,
  },
  {
    id: "resonance",
    label: "Resonance",
    title: "Brightness exploration",
    prompt: "Keep an easy pitch, then explore lighter and brighter vowel colours. Your ears decide, not throat sensations.",
    target: "Clearer, not louder",
    icon: Sparkles,
  },
  {
    id: "speech",
    label: "Speech",
    title: "Speech transfer",
    prompt: 'Say "hey, I am here" near the target note with the same light, clear quality.',
    target: "Carryover",
    icon: Waves,
  },
  {
    id: "cooldown",
    label: "Cooldown",
    title: "Release and reset",
    prompt: "Slide gently downward, sip water, and stop if anything feels scratchy.",
    target: "No strain",
    icon: PauseCircle,
  },
];

const HUM_DRILLS = [
  {
    title: "Closed-mouth hum",
    cue: "Lips together, teeth apart. Let the sound buzz around lips and nose for three easy breaths.",
    duration: "20 sec",
  },
  {
    title: "Hum into ee",
    cue: "Start on mmm, then open to a tiny ee without getting louder or heavier.",
    duration: "3 reps",
  },
  {
    title: "Tiny siren",
    cue: "Glide up and down only inside the comfortable range the app detected today.",
    duration: "4 slides",
  },
  {
    title: "Hum into words",
    cue: 'Hum once, then say "hey, I am here" with the same forward buzz.',
    duration: "3 phrases",
  },
];

const STEP_MODES = {
  warmup: "comfort-ladder",
  pitch: "comfort-ladder",
  resonance: "resonance-step",
  speech: "speech-floor",
  cooldown: "comfort-ladder",
};

const STAGE_EXERCISES = {
  warmup: {
    eyebrow: "Warmup circuit",
    duration: "2 min",
    nextLabel: "Go to pitch",
    cards: [
      { title: "Hear it", text: "Make one quiet hum and notice where it feels easiest to keep steady." },
      { title: "Soften it", text: "Try oo, vv, or a lip trill at an everyday volume. No reaching yet." },
      { title: "Wake it up", text: "Use a tiny comfortable slide, then pause. Easy repetition beats a big stretch." },
    ],
  },
  pitch: {
    eyebrow: "Pitch match",
    duration: "3 min",
    nextLabel: "Explore brightness",
    cards: [
      { title: "Hear it", text: "Hold the tone button and let the note settle in your ear before you copy it." },
      { title: "Glide to it", text: "Start near your easy note, slide toward the target, and stop before effort appears." },
      { title: "Check it", text: "Try a gentle 3-second match. A close, steady repeat unlocks only a small next step." },
    ],
  },
  resonance: {
    eyebrow: "Brightness explorer",
    duration: "3 min",
    nextLabel: "Bring it into speech",
    cards: [
      { title: "Keep pitch", text: "Stay near the reference note. This part is about changing colour, not climbing higher." },
      { title: "Compare", text: "Alternate a round oo with a lighter ee or ih. Listen for the clearer, forward version." },
      { title: "Choose ease", text: "Keep the version that feels and sounds sustainable. The app cannot grade resonance for you." },
    ],
  },
  speech: {
    eyebrow: "Speech transfer",
    duration: "3 min",
    nextLabel: "Cool down",
    cards: [
      { title: "Set up", text: "Make a short light hum near the reference, then keep that feeling for one phrase." },
      { title: "Say it", text: 'Try "hey, I am here" with ordinary rhythm. Let the pitch move naturally.' },
      { title: "Reset", text: "If it drops or tightens, return to the hum. One comfortable phrase is a real win." },
    ],
  },
  cooldown: {
    eyebrow: "Cooldown",
    duration: "1 min",
    nextLabel: "Back to warmup",
    cards: [
      { title: "Release", text: "Make a quiet downward slide or a relaxed hum. There is nothing left to achieve today." },
      { title: "Check in", text: "Your voice should feel ordinary or easier than when you began. Stop if it feels scratchy." },
      { title: "Recover", text: "Sip water and take a speaking break when you can. Progress comes from repeatable, comfortable practice." },
    ],
  },
};

const MODE_LABELS = {
  "comfort-ladder": "Light pitch exploration",
  "resonance-step": "Brightness exploration",
  "speech-floor": "Speech transfer",
};

const PRACTICE_TIERS = {
  starter: {
    label: "Starter",
    minutes: 8,
    breakEvery: 4,
    description: "Tiny daily reps for a brand-new voice-training habit.",
  },
  steady: {
    label: "Steady",
    minutes: 14,
    breakEvery: 6,
    description: "Balanced practice with time for pitch, resonance, and speech.",
  },
  deep: {
    label: "Deep",
    minutes: 22,
    breakEvery: 7,
    description: "Longer session, only when the voice feels fresh and easy.",
  },
};

const TRAINING_GOALS = {
  comfort: { label: "Comfort & ease", detail: "Build an easy, sustainable voice first." },
  flexibility: { label: "Flexibility", detail: "Explore more pitch movement and options." },
  femininity: { label: "Feminine expression", detail: "Explore a voice presentation that feels more feminine to you." },
  context: { label: "Everyday speaking", detail: "Carry a comfortable change into ordinary phrases." },
};

const RESOURCE_FILTERS = [
  { id: "start", label: "Start here" },
  { id: "foundations", label: "Foundations" },
  { id: "practice", label: "Practice" },
  { id: "listening", label: "Listening & mimicry" },
  { id: "tools", label: "Tools" },
  { id: "safety", label: "Vocal health" },
  { id: "all", label: "Everything" },
];

const LEARNING_RESOURCES = [
  { category: "start", label: "Voice Resource Project: Getting Started", kind: "Community guide", detail: "A calm overview of voice feminisation, how to practise, and what to avoid. Read this first when the vocabulary feels new.", href: "https://wiki.sumianvoice.com/wiki/pages/getting-started/" },
  { category: "start", label: "Introductory Voice Training Resources", kind: "Community guide", detail: "A broad beginner roadmap: learn to hear, gain control, then explore and iterate. Includes warmup and practice ideas.", href: "https://www.reddit.com/r/transvoice/comments/mgaci7/solid_introductory_voice_training_resources/" },
  { category: "start", label: "Trans Voice Lessons video library", kind: "Video library", detail: "A large collection from Zheanna, Clover, and Vivienne. Pick one short video at a time instead of trying to learn everything at once.", href: "https://www.youtube.com/@TransVoiceLessons/videos" },
  { category: "foundations", label: "How important is pitch?", kind: "Plain-language explainer", detail: "Pitch is useful, but it is only one cue. This helps put pitch, vocal weight, resonance, clarity, and speech habits in perspective.", href: "https://wiki.sumianvoice.com/wiki/pages/getting-started/" },
  { category: "foundations", label: "Hear size and resonance", kind: "Video", detail: "A listening lesson for noticing changes in resonance or perceived size without trying to manually move anything in the throat.", href: "https://youtu.be/oWmj73Ttp4E" },
  { category: "foundations", label: "Cram Voice Lessons", kind: "Articles", detail: "A large independent collection of voice articles and perspectives. Useful for comparing explanations after you have a gentle foundation.", href: "https://cramdvoicelessons.blog/" },
  { category: "practice", label: "Practice advice from Trans Voice Lessons", kind: "Video", detail: "How to make practice regular, exploratory, and sustainable instead of drilling until you are exhausted.", href: "https://www.youtube.com/watch?v=fylIX28mlyY" },
  { category: "practice", label: "Kin Maynard: how to practise", kind: "Community guide", detail: "A practical discussion of routines, expectations, and making voice practice part of ordinary life.", href: "https://www.reddit.com/r/transvoice/comments/1c5lveq/how_to_voice_train/" },
  { category: "practice", label: "Ear-training livestream", kind: "Video", detail: "Practice recognising pitch and sound changes before trying to control them. Good for days when speaking practice feels like too much.", href: "https://youtu.be/rvet1PwCoGY" },
  { category: "practice", label: "Tone generator", kind: "Practice tool", detail: "Use a quiet reference tone for matching or small slides. Start close to your comfortable voice; a high number is never the goal by itself.", href: "https://www.szynalski.com/tone-generator/" },
  { category: "listening", label: "Selene Da Silva clip collection", kind: "Listening library", detail: "An organised collection of short demonstrations. Listen for one feature at a time, then copy only a tiny piece of it.", href: "https://www.reddit.com/r/transvoice/comments/ztdtll/an_organized_collection_of_selene_da_silvas_clips/" },
  { category: "listening", label: "Jana: mimicry advice", kind: "Community guide", detail: "A guide to using a reference voice as an ear-training target, not as a demand to sound exactly like someone else.", href: "https://docs.google.com/document/d/1H49fFxiLw4C7OisG1yy0-9dQIH373UX0Il1ybV8Gju8/edit" },
  { category: "listening", label: "Find a voice example", kind: "Practice idea", detail: "Choose a voice that feels like a reachable next step. Copy its rhythm or vowel colour for one short phrase, then rest.", href: "https://wiki.sumianvoice.com/wiki/pages/getting-started/" },
  { category: "tools", label: "InFormant", kind: "Desktop analysis tool", detail: "Real-time pitch and formant tracking for people who want to see more acoustic information while they practise.", href: "https://in-formant.app/" },
  { category: "tools", label: "Spectrus", kind: "Web analysis tool", detail: "A browser-based tool for pitch and formant tracking. Treat visuals as feedback, not a score you need to win.", href: "https://spec.sumianvoice.com/" },
  { category: "tools", label: "AcousticGender", kind: "Recording analysis", detail: "A way to inspect pitch and resonance-related information from recorded clips when you want to compare takes.", href: "https://acousticgender.space/" },
  { category: "tools", label: "TransVoiceParty", kind: "Resource directory", detail: "A broad directory of teachers, communities, tools, recorded lessons, and other places to keep learning.", href: "https://transvoice.party/" },
  { category: "safety", label: "UCSF: vocal health and considerations", kind: "Clinical reading", detail: "Clear clinical context for pitch, resonance, intonation, fatigue, and why a comfortable voice matters more than forcing a result.", href: "https://transcare.ucsf.edu/guidelines/vocal-health" },
  { category: "safety", label: "ASHA: gender-affirming voice and communication", kind: "Clinical reading", detail: "An overview from speech-language pathologists on client-led goals, vocal health, and the many parts of communication beyond pitch.", href: "https://www.asha.org/public/speech/disorders/Voice-and-Communication-Change-for-Transgender-People/" },
  { category: "safety", label: "Common voice-training myths", kind: "Video", detail: "Helpful context for separating sound-based exploration from rules that encourage strain or overly rigid technique.", href: "https://www.youtube.com/watch?v=gHyVNIcw_XI" },
  { category: "safety", label: "Older guides, read with care", kind: "Historical context", detail: "Older material can be interesting for ideas, but skip any instruction that asks you to swallow, force the larynx, or work through pain.", href: "https://docs.google.com/document/d/1MOd5CJQUGmUD5e1p7_CLxWLU-aFiUTmKvL0SoT-LhEk/edit" },
];

export default function App() {
  const [activeView, setActiveView] = useState(initialView);
  const [deviceId] = useState(getDeviceId);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState("");
  const [current, setCurrent] = useState({ frequency: null, clarity: 0, volume: 0 });
  const [history, setHistory] = useState([]);
  const [dailySession, setDailySession] = useState(loadTodaySession);
  const [progress, setProgress] = useState(loadProgress);
  const [targetIndex, setTargetIndex] = useState(() => loadProgress().lastTargetIndex ?? 0);
  const [exerciseMode, setExerciseMode] = useState(() => loadProgress().lastMode ?? "comfort-ladder");
  const [activeStep, setActiveStep] = useState(() => loadProgress().lastStep ?? "warmup");
  const [practiceTier, setPracticeTier] = useState(() => loadProgress().practiceTier ?? "starter");
  const [comfortAnchorMidi, setComfortAnchorMidi] = useState(() => loadProgress().comfortAnchorMidi ?? null);
  const [humDrillIndex, setHumDrillIndex] = useState(0);
  const [lastScore, setLastScore] = useState(null);
  const [isPlayingTone, setIsPlayingTone] = useState(false);
  const [recordingAttempt, setRecordingAttempt] = useState(false);
  const [attemptProgress, setAttemptProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState("local");
  const [authInfo, setAuthInfo] = useState({ authenticated: false, user: null });
  const [accountMode, setAccountMode] = useState(null);
  const [accountForm, setAccountForm] = useState({ username: "", password: "", confirmation: "" });
  const [accountError, setAccountError] = useState("");
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ category: "idea", message: "" });
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [resourceFilter, setResourceFilter] = useState("start");
  const [showExtendedRange, setShowExtendedRange] = useState(() => loadProgress().showExtendedRange ?? false);
  const [gentleDisplay, setGentleDisplay] = useState(() => loadProgress().gentleDisplay ?? false);
  const [autoRecord, setAutoRecord] = useState(() => loadProgress().autoRecordConsent ?? false);
  const [trainingGoal, setTrainingGoal] = useState(() => loadProgress().trainingGoal ?? "comfort");
  const [targetMisses, setTargetMisses] = useState(0);
  const [practiceStyle, setPracticeStyle] = useState(() => loadProgress().practiceStyle ?? "guided");
  const [savedRecordings, setSavedRecordings] = useState([]);
  const [vaultRecording, setVaultRecording] = useState(false);
  const [vaultStatus, setVaultStatus] = useState("");
  const [playingRecording, setPlayingRecording] = useState(null);
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultUsage, setVaultUsage] = useState({ used: 0, limit: 100 * 1024 * 1024 });

  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const recordingRef = useRef(false);
  const attemptSamplesRef = useRef([]);
  const rangeWindowRef = useRef([]);
  const toneRef = useRef(null);
  const timedPracticeMsRef = useRef(0);
  const lastTimerFrameRef = useRef(null);
  const progressTimerRef = useRef(null);
  const cloudLoadedRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const playbackUrlRef = useRef(null);
  const playbackAudioRef = useRef(null);
  const discardRecordingRef = useRef(false);
  const lastVoicedAtRef = useRef(0);
  const vaultKeyRef = useRef(null);

  const targetMidi = useMemo(() => {
    if (exerciseMode === "resonance-step" && dailySession.highMidi !== null) {
      return Math.min(MAX_TRAINING_MIDI, Math.max(45, dailySession.highMidi));
    }
    if (exerciseMode === "speech-floor" && dailySession.lowMidi !== null) {
      return Math.min(MAX_TRAINING_MIDI, Math.max(45, dailySession.lowMidi + 2));
    }
    return Math.min(
      MAX_TRAINING_MIDI,
      (comfortAnchorMidi ?? DEFAULT_COMFORT_ANCHOR) + (EXERCISE_STEPS[targetIndex] ?? EXERCISE_STEPS[0]),
    );
  }, [comfortAnchorMidi, dailySession.highMidi, dailySession.lowMidi, exerciseMode, targetIndex]);

  const targetFrequency = midiToFrequency(targetMidi);
  const rememberedTargetMidi = Math.min(
    MAX_TRAINING_MIDI,
    (progress.comfortAnchorMidi ?? DEFAULT_COMFORT_ANCHOR)
      + (EXERCISE_STEPS[progress.lastTargetIndex] ?? EXERCISE_STEPS[0]),
  );
  const currentMidi = current.frequency ? frequencyToMidi(current.frequency) : null;
  const currentCents = current.frequency ? centsOff(current.frequency, targetFrequency) : null;
  const visualRangeMaxMidi = showExtendedRange ? 77 : 61;
  const visualRangePosition = Math.max(2, Math.min(98, ((currentMidi ?? 54) - 48) / (visualRangeMaxMidi - 48) * 100));
  const visualRangeLow = Math.max(0, Math.min(100, ((dailySession.lowMidi ?? 54) - 48) / (visualRangeMaxMidi - 48) * 100));
  const visualRangeHigh = Math.max(0, Math.min(100, ((dailySession.highMidi ?? dailySession.lowMidi ?? 54) - 48) / (visualRangeMaxMidi - 48) * 100));
  const sessionStats = useMemo(() => summarizeSession(history, current, dailySession), [history, current, dailySession]);
  const progressStats = useMemo(() => summarizeProgress(progress), [progress]);
  const dailyComparison = useMemo(
    () => buildDailyComparison(progress.days, dailySession),
    [progress.days, dailySession],
  );
  const tips = buildCoachTips({ history, targetFrequency, currentFrequency: current.frequency, dailySession });
  const activePractice = PRACTICE_FLOW.find((step) => step.id === activeStep) ?? PRACTICE_FLOW[0];
  const activeHumDrill = HUM_DRILLS[humDrillIndex] ?? HUM_DRILLS[0];
  const activeStageExercise = STAGE_EXERCISES[activeStep] ?? STAGE_EXERCISES.warmup;
  const activeTier = PRACTICE_TIERS[practiceTier] ?? PRACTICE_TIERS.starter;
  const sessionSeconds = dailySession.seconds ?? dailySession.minutes * 60;
  const voiceCheck = dailySession.voiceCheck ?? "unset";
  const sessionPlan = useMemo(() => buildSessionPlan(activeTier, sessionSeconds), [activeTier, sessionSeconds]);
  const breakReminder = useMemo(
    () => getBreakReminder(activeTier, dailySession),
    [activeTier, dailySession],
  );
  const beginnerInstruction = getBeginnerInstruction({
    activeStep,
    listening,
    current,
    currentCents,
    recordingAttempt,
    lastScore,
  });
  const targetExplanation = getTargetExplanation({
    exerciseMode,
    targetIndex,
    comfortAnchorMidi,
    targetMidi,
    lastScore,
  });
  const visibleResources = resourceFilter === "all"
    ? LEARNING_RESOURCES
    : LEARNING_RESOURCES.filter((resource) => resource.category === resourceFilter);

  useEffect(() => {
    const handleHashChange = () => setActiveView(initialView());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    saveTodaySession(dailySession);
    setProgress((currentProgress) => mergeTodayIntoProgress(currentProgress, dailySession, {
      targetIndex,
      activeStep,
      exerciseMode,
      practiceTier,
      comfortAnchorMidi,
      showExtendedRange,
      gentleDisplay,
      autoRecordConsent: autoRecord,
      trainingGoal,
      practiceStyle,
    }));
  }, [dailySession]);

  useEffect(() => {
    setProgress((currentProgress) => mergeTodayIntoProgress(currentProgress, dailySession, {
      targetIndex,
      activeStep,
      exerciseMode,
      practiceTier,
      comfortAnchorMidi,
      showExtendedRange,
      gentleDisplay,
      autoRecordConsent: autoRecord,
      trainingGoal,
      practiceStyle,
    }));
  }, [targetIndex, activeStep, exerciseMode, practiceTier, comfortAnchorMidi, showExtendedRange, gentleDisplay, autoRecord, trainingGoal, practiceStyle]);

  useEffect(() => {
    saveProgress(progress);
    if (!cloudLoadedRef.current) return;
    setSyncStatus("syncing");
    const timeout = window.setTimeout(() => {
      saveCloudProgress(deviceId, progress)
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("local"));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [deviceId, progress]);

  useEffect(() => {
    let cancelled = false;
    loadMe().then((me) => {
      if (!cancelled) setAuthInfo(me);
    });
    loadCloudProgress(deviceId)
      .then((cloudProgress) => {
        if (cancelled) return;
        cloudLoadedRef.current = true;
        if (cloudProgress) {
          const merged = mergeProgressRecords(cloudProgress, progress);
          setProgress(merged);
          setTargetIndex(merged.lastTargetIndex ?? 0);
          setActiveStep(merged.lastStep ?? "warmup");
          setExerciseMode(merged.lastMode ?? "comfort-ladder");
          setPracticeTier(merged.practiceTier ?? "starter");
          setComfortAnchorMidi(merged.comfortAnchorMidi ?? null);
          setShowExtendedRange(merged.showExtendedRange ?? false);
          setGentleDisplay(merged.gentleDisplay ?? false);
          setAutoRecord(merged.autoRecordConsent ?? false);
          setTrainingGoal(merged.trainingGoal ?? "comfort");
          setPracticeStyle(merged.practiceStyle ?? "guided");
        }
        setSyncStatus("synced");
      })
      .catch(() => {
        if (!cancelled) {
          cloudLoadedRef.current = true;
          setSyncStatus("local");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    const transfer = new URLSearchParams(window.location.search).get("transfer");
    if (!transfer) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (transfer === "ready") setAccountMode("register");
    if (transfer === "failed") {
      setAccountMode("register");
      setAccountError("We could not verify that existing account. Please try the transfer again.");
    }
  }, []);

  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email");
    if (!email) return;
    window.history.replaceState({}, "", `${window.location.pathname}#account`);
    setActiveView("account");
    if (email === "verified") {
      setPrivacyStatus("Email verified. You can use it for recovery once password reset is enabled.");
      loadMe().then(setAuthInfo);
    } else {
      setPrivacyStatus("That verification link is invalid or has expired. Request a new one from Account.");
    }
  }, []);

  useEffect(() => {
    drawVisualizer();
  }, [history, targetFrequency, current.frequency, showExtendedRange]);

  useEffect(() => {
    if (comfortAnchorMidi !== null) return;
    const voiced = history.filter((sample) => sample.frequency && sample.clarity > 0.55).slice(-36);
    if (voiced.length < 12) return;
    const midis = voiced.map((sample) => frequencyToMidi(sample.frequency)).sort((a, b) => a - b);
    const median = midis[Math.floor(midis.length / 2)];
    // Use the person's easy hum as the anchor; do not pull it down to a preset range.
    setComfortAnchorMidi(Math.max(45, Math.min(MAX_TRAINING_MIDI, median + 1)));
  }, [comfortAnchorMidi, history]);

  useEffect(() => () => {
    stopListening();
    stopTone();
    playbackAudioRef.current?.pause();
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
  }, []);

  useEffect(() => {
    if (!authInfo.authenticated) {
      setSavedRecordings([]);
      return;
    }
    listPrivateRecordings().then((vault) => {
      setSavedRecordings(vault.recordings);
      setVaultUsage({ used: vault.usage_bytes, limit: vault.limit_bytes });
    }).catch(() => setVaultStatus("Private recordings are unavailable right now."));
  }, [authInfo.authenticated]);

  async function startListening() {
    try {
      setMicError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioRef.current = { audioContext, analyser, stream, buffer: new Float32Array(analyser.fftSize) };
      setListening(true);
      timedPracticeMsRef.current = sessionSeconds * 1000;
      lastTimerFrameRef.current = Date.now();
      tick();
      if (autoRecord && authInfo.authenticated && vaultKeyRef.current) window.setTimeout(() => startPrivateRecording(true), 0);
      return true;
    } catch (error) {
      setMicError(error.message || "Could not access the microphone.");
      return false;
    }
  }

  function stopListening() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    rafRef.current = null;
    progressTimerRef.current = null;
    lastTimerFrameRef.current = null;
    recordingRef.current = false;
    if (mediaRecorderRef.current?.state === "recording" || mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.stop();
    const audio = audioRef.current;
    if (audio) {
      audio.stream.getTracks().forEach((track) => track.stop());
      audio.audioContext.close();
    }
    audioRef.current = null;
    setListening(false);
    setRecordingAttempt(false);
    setAttemptProgress(0);
  }

  function lockPrivateVault() {
    playbackAudioRef.current?.pause();
    playbackAudioRef.current = null;
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
    vaultKeyRef.current = null;
    setPlayingRecording(null);
  }

  async function unlockPrivateVault(event) {
    event.preventDefault();
    if (!authInfo.user?.username || !vaultPassphrase) return;
    try {
      vaultKeyRef.current = await deriveRecordingKey(vaultPassphrase, authInfo.user.username);
      setVaultPassphrase("");
      setVaultStatus("Private vault unlocked for this visit.");
    } catch (error) {
      setVaultStatus(error.message);
    }
  }

  async function startPrivateRecording(automatic = false) {
    if (!authInfo.authenticated) {
      setVaultStatus("Create an account or sign in before saving a private recording.");
      navigateTo("account");
      return;
    }
    if (!vaultKeyRef.current) {
      setVaultStatus("Unlock your private vault with your FemmeVoice passphrase first.");
      navigateTo("account");
      return;
    }
    if (!audioRef.current && !await startListening()) return;
    if (mediaRecorderRef.current?.state === "recording" || mediaRecorderRef.current?.state === "paused") return;
    try {
      const recorder = new MediaRecorder(audioRef.current.stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      recordingChunksRef.current = [];
      discardRecordingRef.current = false;
      recordingStartedAtRef.current = Date.now();
      lastVoicedAtRef.current = recordingStartedAtRef.current;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const durationMs = Date.now() - (recordingStartedAtRef.current ?? Date.now());
        setVaultRecording(false);
        if (discardRecordingRef.current) {
          setVaultStatus("Recording discarded. Nothing was uploaded or saved.");
          return;
        }
        if (!recordingChunksRef.current.length || !vaultKeyRef.current) return;
        try {
          setVaultStatus("Encrypting and saving your recording...");
          const mimeType = recorder.mimeType || "audio/webm";
          const blob = new Blob(recordingChunksRef.current, { type: mimeType });
          const recording = { id: crypto.randomUUID(), label: `${activePractice.label} - ${new Date().toLocaleDateString()}`, durationMs, mimeType, encryptionVersion: 2 };
          const { ciphertext, iv } = await encryptRecording(blob, vaultKeyRef.current, recordingAad(authInfo.user.username, recording.id, mimeType));
          recording.iv = iv;
          const saved = await uploadPrivateRecording(recording, ciphertext);
          setSavedRecordings((recordings) => [saved.recording, ...recordings]);
          setVaultUsage((usage) => ({ ...usage, used: usage.used + ciphertext.size }));
          setVaultStatus("Saved privately to your encrypted FemmeVoice vault.");
        } catch (error) {
          setVaultStatus(error.message);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setVaultRecording(true);
      setVaultStatus(automatic ? "Recording voiced practice privately. Quiet gaps are skipped." : "Recording privately. Quiet gaps are skipped.");
    } catch (error) {
      setVaultStatus(error.message || "Could not start a private recording.");
    }
  }

  function stopPrivateRecording() {
    discardRecordingRef.current = false;
    if (mediaRecorderRef.current?.state === "recording" || mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.stop();
  }

  function discardPrivateRecording() {
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current?.state === "recording" || mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.stop();
  }

  async function playPrivateRecording(recording) {
    if (!vaultKeyRef.current) {
      setVaultStatus("Unlock your private vault with your FemmeVoice passphrase first.");
      navigateTo("account");
      return;
    }
    try {
      const recordingId = recording.recording_id || recording.id;
      setPlayingRecording(recordingId);
      const encrypted = await downloadPrivateRecording(recordingId);
      const blob = await decryptRecording(encrypted.ciphertext, encrypted.iv, encrypted.mimeType, vaultKeyRef.current, recording.encryption_version >= 2 ? recordingAad(authInfo.user.username, recordingId, encrypted.mimeType) : undefined);
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = URL.createObjectURL(blob);
      const audio = new Audio(playbackUrlRef.current);
      playbackAudioRef.current = audio;
      audio.onended = () => setPlayingRecording(null);
      await audio.play();
    } catch (error) {
      setPlayingRecording(null);
      setVaultStatus("Could not unlock that recording. Check that you used the same FemmeVoice passphrase.");
    }
  }

  async function removePrivateRecording(recording) {
    if (!window.confirm("Delete this private recording permanently?")) return;
    try {
      await deletePrivateRecording(recording.recording_id || recording.id);
      setSavedRecordings((recordings) => recordings.filter((item) => (item.recording_id || item.id) !== (recording.recording_id || recording.id)));
      setVaultUsage((usage) => ({ ...usage, used: Math.max(0, usage.used - (recording.byte_size || 0)) }));
      setVaultStatus("Private recording deleted.");
    } catch (error) {
      setVaultStatus(error.message);
    }
  }

  function tick() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.analyser.getFloatTimeDomainData(audio.buffer);
    const analysis = analyzePitch(audio.buffer, audio.audioContext.sampleRate);
    const sample = { ...analysis, time: Date.now() };
    setCurrent(analysis);
    setHistory((samples) => [...samples.slice(-300), sample]);

    if (recordingRef.current) {
      attemptSamplesRef.current = [...attemptSamplesRef.current.slice(-90), sample];
    }

    updatePrivateRecordingActivity(analysis, sample.time);

    if (analysis.frequency && analysis.clarity > 0.35) {
      const midi = frequencyToMidi(analysis.frequency);
      captureSustainedRangeNote(midi, sample.time);
    } else {
      rangeWindowRef.current = [];
    }
    updateSessionTimer(sample.time, Boolean(analysis.frequency && analysis.clarity > 0.35));
    rafRef.current = requestAnimationFrame(tick);
  }

  function updatePrivateRecordingActivity(analysis, time) {
    const recorder = mediaRecorderRef.current;
    if (!recorder || (recorder.state !== "recording" && recorder.state !== "paused")) return;
    const voiced = Boolean(analysis.frequency && analysis.clarity > 0.35 && analysis.volume > 0.008);
    if (voiced) {
      lastVoicedAtRef.current = time;
      if (recorder.state === "paused") recorder.resume();
      return;
    }
    if (recorder.state === "recording" && time - lastVoicedAtRef.current > 650) recorder.pause();
  }

  function captureSustainedRangeNote(midi, time) {
    const windowStart = time - 420;
    const window = [...rangeWindowRef.current, { midi, time }].filter((sample) => sample.time >= windowStart);
    rangeWindowRef.current = window;
    if (window.length < 8 || window[window.length - 1].time - window[0].time < 380) return;
    const notes = window.map((sample) => sample.midi);
    if (Math.max(...notes) - Math.min(...notes) > 0.8) return;
    const steadyMidi = notes.slice().sort((a, b) => a - b)[Math.floor(notes.length / 2)];
    setDailySession((session) => ({
      ...session,
      lowMidi: session.lowMidi === null ? steadyMidi : Math.min(session.lowMidi, steadyMidi),
      highMidi: session.highMidi === null ? steadyMidi : Math.max(session.highMidi, steadyMidi),
    }));
  }

  function updateSessionTimer(now, isVoiced) {
    const previousFrame = lastTimerFrameRef.current ?? now;
    lastTimerFrameRef.current = now;
    if (!isVoiced) return;
    timedPracticeMsRef.current += Math.min(250, Math.max(0, now - previousFrame));
    const elapsedSeconds = Math.floor(timedPracticeMsRef.current / 1000);
    setDailySession((session) => {
      const previousSeconds = session.seconds ?? session.minutes * 60;
      if (elapsedSeconds <= previousSeconds) return session;
      return { ...session, seconds: elapsedSeconds, minutes: Math.floor(elapsedSeconds / 60) };
    });
  }

  function startTone() {
    if (toneRef.current) return;
    setIsPlayingTone(true);
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const formant = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    oscillator.type = activeStep === "warmup" ? "triangle" : "sawtooth";
    oscillator.frequency.value = targetFrequency;
    formant.type = "bandpass";
    formant.frequency.value = activeStep === "pitch" ? 1850 : 900;
    formant.Q.value = 0.8;
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.04);
    oscillator.connect(formant).connect(gain).connect(audioContext.destination);
    oscillator.start();
    toneRef.current = { audioContext, oscillator, gain };
  }

  function stopTone() {
    const tone = toneRef.current;
    if (!tone) return;
    toneRef.current = null;
    const now = tone.audioContext.currentTime;
    tone.gain.gain.cancelScheduledValues(now);
    tone.gain.gain.setValueAtTime(Math.max(0.001, tone.gain.gain.value), now);
    tone.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    tone.oscillator.stop(now + 0.06);
    tone.oscillator.onended = () => tone.audioContext.close();
    setIsPlayingTone(false);
  }

  async function beginAttempt() {
    if (voiceCheck === "pain") {
      setMicError("Skip scored practice today. Pain, persistent scratchiness, or unusual hoarseness is a reason to rest and seek a voice clinician if it continues.");
      return;
    }
    if (!listening) {
      const started = await startListening();
      if (!started) return;
    }
    attemptSamplesRef.current = [];
    recordingRef.current = true;
    setAttemptProgress(0);
    setLastScore(null);
    setRecordingAttempt(true);

    const startedAt = Date.now();
    progressTimerRef.current = window.setInterval(() => {
      setAttemptProgress(Math.min(100, ((Date.now() - startedAt) / 3000) * 100));
    }, 80);

    window.setTimeout(() => {
      recordingRef.current = false;
      setRecordingAttempt(false);
      setAttemptProgress(100);
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
      const result = scoreAttempt({ targetFrequency, samples: attemptSamplesRef.current });
      const stepDown = !result.matched && activeStep === "pitch" && targetMisses >= 1 && targetIndex > 0;
      const enriched = {
        ...result,
        mode: exerciseMode,
        step: activeStep,
        time: Date.now(),
        adaptation: stepDown ? "This note is not ready today. FemmeVoice moved back one comfortable step." : null,
      };
      setLastScore(enriched);
      setDailySession((session) => ({ ...session, attempts: [...session.attempts.slice(-17), enriched] }));
      if (result.matched && activeStep === "pitch") {
        setTargetMisses(0);
        setTargetIndex((index) => Math.min(EXERCISE_STEPS.length - 1, index + 1));
      } else if (activeStep === "pitch") {
        if (stepDown) {
          setTargetIndex((index) => Math.max(0, index - 1));
          setTargetMisses(0);
        } else {
          setTargetMisses((misses) => misses + 1);
        }
      }
    }, 3000);
  }

  function resetDay() {
    const reset = { date: dayKey(), lowMidi: null, highMidi: null, attempts: [], minutes: 0, seconds: 0, breakAcknowledged: [], voiceCheck: "unset", guidedStep: "warmup", guidedCompleted: false, reflections: [] };
    setDailySession(reset);
    saveTodaySession(reset);
    setHistory([]);
    rangeWindowRef.current = [];
    setLastScore(null);
    setAttemptProgress(0);
  }

  function removeSavedHighOutlier() {
    const outlier = progress.bestHighMidi;
    if (outlier === null) return;
    if (!window.confirm(`Remove ${midiToNoteName(outlier)} as a false high-note outlier? This keeps your other progress.`)) return;
    const remainingHighs = [
      ...progress.days.map((day) => day.highMidi),
      dailySession.highMidi,
    ].filter((midi) => midi !== null && midi < outlier);
    const replacement = remainingHighs.length ? Math.max(...remainingHighs) : null;
    setDailySession((session) => session.highMidi === outlier ? { ...session, highMidi: null } : session);
    setProgress((currentProgress) => ({
      ...currentProgress,
      bestHighMidi: replacement,
      days: currentProgress.days.map((day) => day.highMidi === outlier ? { ...day, highMidi: null } : day),
    }));
  }

  function acknowledgeBreak(id) {
    setDailySession((session) => ({
      ...session,
      breakAcknowledged: [...new Set([...(session.breakAcknowledged ?? []), id])],
    }));
  }

  function selectVoiceCheck(value) {
    setDailySession((session) => ({ ...session, voiceCheck: value }));
    if (value === "pain") selectPracticeStep("cooldown");
  }

  function reflectOnPractice(rating) {
    setDailySession((session) => ({
      ...session,
      reflections: [...(session.reflections ?? []).slice(-7), { rating, time: Date.now() }],
    }));
  }

  function nextHumDrill() {
    setHumDrillIndex((index) => (index + 1) % HUM_DRILLS.length);
  }

  function recalibrateComfortAnchor() {
    setComfortAnchorMidi(null);
    setTargetIndex(0);
    setLastScore(null);
  }

  function navigateTo(view) {
    window.location.hash = view;
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectPracticeStep(stepId) {
    setActiveStep(stepId);
    setExerciseMode(STEP_MODES[stepId] ?? "comfort-ladder");
    setLastScore(null);
    if (practiceStyle === "guided") setDailySession((session) => ({ ...session, guidedStep: stepId, guidedCompleted: false }));
  }

  function enterGuidedPractice() {
    const stepId = dailySession.guidedCompleted ? "warmup" : (dailySession.guidedStep ?? "warmup");
    setPracticeStyle("guided");
    setActiveStep(stepId);
    setExerciseMode(STEP_MODES[stepId] ?? "comfort-ladder");
    setLastScore(null);
    setDailySession((session) => ({ ...session, guidedStep: stepId, guidedCompleted: false }));
  }

  function advancePracticeStep() {
    const currentIndex = PRACTICE_FLOW.findIndex((step) => step.id === activeStep);
    if (practiceStyle === "guided" && activeStep === "cooldown") {
      setDailySession((session) => ({ ...session, guidedStep: "cooldown", guidedCompleted: true }));
      return;
    }
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % PRACTICE_FLOW.length;
    selectPracticeStep(PRACTICE_FLOW[nextIndex].id);
  }

  function selectExerciseMode(mode) {
    setExerciseMode(mode);
    if (mode === "resonance-step") selectPracticeStep("resonance");
    else if (mode === "speech-floor") selectPracticeStep("speech");
    else selectPracticeStep("pitch");
  }

  function moveTarget(direction) {
    setTargetIndex((index) => Math.max(0, Math.min(EXERCISE_STEPS.length - 1, index + direction)));
    setLastScore(null);
  }

  async function submitAccount(event) {
    event.preventDefault();
    setAccountError("");
    setAccountSubmitting(true);
    try {
      const result = accountMode === "register"
        ? await registerAccount(accountForm)
        : await loginAccount(accountForm);
      setAuthInfo({ authenticated: true, user: result.user });
      vaultKeyRef.current = await deriveRecordingKey(accountForm.password, result.user.username);
      setVaultPassphrase("");
      setAccountMode(null);
      setAccountForm({ username: "", password: "", confirmation: "" });
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setAccountSubmitting(false);
    }
  }

  async function signOut() {
    try {
      await logoutAccount();
    } finally {
      setAuthInfo({ authenticated: false, user: null });
      lockPrivateVault();
    }
  }

  async function downloadPersonalData() {
    try {
      setPrivacyStatus("");
      const payload = await exportAccountData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "femmevoice-data-export.json";
      link.click();
      URL.revokeObjectURL(url);
      setPrivacyStatus("Your data export is ready.");
    } catch (error) {
      setPrivacyStatus(error.message);
    }
  }

  async function erasePersonalData() {
    if (!window.confirm("Delete your FemmeVoice account and synced progress permanently? This cannot be undone.")) return;
    try {
      setPrivacyStatus("");
      await deleteAccount();
      setAuthInfo({ authenticated: false, user: null });
      lockPrivateVault();
      setPrivacyStatus("Your FemmeVoice account and synced data were deleted.");
    } catch (error) {
      setPrivacyStatus(error.message);
    }
  }

  async function addAccountEmail(event) {
    event.preventDefault();
    if (emailSubmitting) return;
    try {
      setEmailSubmitting(true);
      setPrivacyStatus("");
      await requestEmailVerification(emailAddress);
      setPrivacyStatus("Check your inbox to verify this email address. The link expires in one hour.");
    } catch (error) {
      setPrivacyStatus(error.message);
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function sendFeedback(event) {
    event.preventDefault();
    if (feedbackSubmitting) return;
    try {
      setFeedbackSubmitting(true);
      setFeedbackStatus("");
      await submitFeedback(feedbackForm);
      setFeedbackForm({ category: "idea", message: "" });
      setFeedbackStatus("Thank you. Your feedback was received.");
    } catch (error) {
      setFeedbackStatus(error.message);
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  function drawVisualizer() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#fff8ed");
    gradient.addColorStop(1, "#edf8f5");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const minMidi = 48;
    const maxMidi = showExtendedRange ? 77 : 62;
    const xFor = (index, total) => (total <= 1 ? 0 : (index / (total - 1)) * width);
    const yForMidi = (midi) => height - ((midi - minMidi) / (maxMidi - minMidi)) * height;

    const rangeBands = [
      { low: 48, high: 49.5, color: "rgba(46, 115, 204, 0.22)", label: "lower" },
      { low: 49.5, high: 53.5, color: "rgba(92, 99, 107, 0.14)", label: "neutral" },
      { low: 53.5, high: 61.5, color: "rgba(218, 77, 137, 0.18)", label: "bright" },
    ];
    if (showExtendedRange) {
      rangeBands.push({ low: 61.5, high: 77, color: "rgba(126, 83, 190, 0.16)", label: "extended" });
    }
    rangeBands.forEach((band) => {
      ctx.fillStyle = band.color;
      ctx.fillRect(0, yForMidi(band.high), width, yForMidi(band.low) - yForMidi(band.high));
      ctx.fillStyle = "rgba(35, 38, 34, 0.55)";
      ctx.font = "11px system-ui";
      ctx.fillText(band.label, width - 68, yForMidi(band.high) + 16);
    });
    ctx.fillStyle = "rgba(20, 122, 126, 0.09)";
    ctx.fillRect(0, yForMidi(targetMidi + 0.18), width, yForMidi(targetMidi - 0.18) - yForMidi(targetMidi + 0.18));

    ctx.strokeStyle = "rgba(34, 35, 32, 0.13)";
    ctx.lineWidth = 1;
    const gridNotes = showExtendedRange ? [48, 49, 50, 53, 54, 61, 72, 77] : [48, 49, 50, 53, 54, 61];
    gridNotes.forEach((midi) => {
      const y = yForMidi(midi);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(34, 35, 32, 0.58)";
      ctx.font = "12px system-ui";
      ctx.fillText(midiToNoteName(midi), 12, y - 6);
    });

    const targetY = yForMidi(targetMidi);
    ctx.strokeStyle = "#147a7e";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    const voiced = history.filter((sample) => sample.frequency && sample.clarity > 0.35);
    ctx.strokeStyle = "#7b4fd6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    voiced.forEach((sample, index) => {
      const midi = 69 + 12 * Math.log2(sample.frequency / 440);
      const x = xFor(index, Math.max(1, voiced.length));
      const y = yForMidi(midi);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (current.frequency) {
      const y = yForMidi(69 + 12 * Math.log2(current.frequency / 440));
      ctx.fillStyle = "#222320";
      ctx.beginPath();
      ctx.arc(width - 18, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <button className="brand" onClick={() => navigateTo("today")} aria-label="FemmeVoice home">
          <span>F</span>
          <strong>FemmeVoice</strong>
        </button>
        <nav className="app-nav" aria-label="Main navigation">
          {APP_VIEWS.filter((view) => MAIN_VIEW_IDS.has(view.id)).map((view) => {
            const Icon = view.icon;
            return (
              <button
                className={activeView === view.id ? "selected" : ""}
                key={view.id}
                onClick={() => navigateTo(view.id)}
                aria-current={activeView === view.id ? "page" : undefined}
              >
                <Icon />
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="profile-button" onClick={() => navigateTo("account")} aria-label="Open settings">
          <UserRound />
          <span>{authInfo.authenticated ? (authInfo.user?.display_name || authInfo.user?.username) : "Settings"}</span>
        </button>
      </header>

      {activeView === "today" && <section className="hero">
        <div>
          <p className="eyebrow">FemmeVoice</p>
          <h1>Find a voice that feels easy, expressive, and yours.</h1>
          <p className="hero-copy">
            Real-time pitch tracking and guided listening drills for weight, pitch comfort, brightness, and speech
            carryover. This is a practice companion, not a diagnosis: stop for pain, scratchiness, or fatigue.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-action" onClick={listening ? stopListening : startListening}>
            {listening ? <Square /> : <Mic />}
            {listening ? "Stop mic" : "Start mic"}
          </button>
          <button className="icon-action" onClick={resetDay} aria-label="Reset today's session">
            <RotateCcw />
          </button>
        </div>
      </section>}

      {activeView !== "today" && (
        <section className="view-intro">
          <p className="eyebrow">FemmeVoice</p>
          <h1>{APP_VIEWS.find((view) => view.id === activeView)?.label}</h1>
          <p>{activeView === "practice" ? "One calm exercise at a time. Stop any time your voice stops feeling easy." : activeView === "progress" ? "Your practice history, range notes, and gentle next steps." : activeView === "learn" ? "Simple explanations first, then deeper resources whenever you want them." : activeView === "privacy" ? "A plain-language account of what FemmeVoice stores, why, and how you stay in control." : activeView === "feedback" ? "Tell us what feels useful, unclear, missing, or unsafe. Thoughtful feedback shapes FemmeVoice." : "Your private FemmeVoice account, preferences, and safety information."}</p>
        </section>
      )}

      {activeView === "today" && <>
      <section className={voiceCheck === "pain" ? "voice-check caution" : "voice-check"} aria-label="How does your voice feel today">
        <div><p className="eyebrow">Before practice</p><h2>How does your voice feel today?</h2></div>
        <div className="voice-check-options"><button className={voiceCheck === "easy" ? "selected" : ""} onClick={() => selectVoiceCheck("easy")}>Comfortable</button><button className={voiceCheck === "tired" ? "selected" : ""} onClick={() => selectVoiceCheck("tired")}>Tired or dry</button><button className={voiceCheck === "pain" ? "selected" : ""} onClick={() => selectVoiceCheck("pain")}>Pain or hoarseness</button></div>
        <p>{voiceCheck === "pain" ? "Choose rest or listening today. Do not push through pain." : voiceCheck === "tired" ? "Keep this brief: warm up, explore gently, and skip higher targets." : "Your answer helps FemmeVoice suggest a pace. You can change it any time."}</p>
      </section>
      <section className="beginner-coach" aria-label="Beginner coach">
        <div className="coach-script">
          <span className="coach-avatar"><Bot /></span>
          <div>
            <p className="eyebrow">Start here</p>
            <h2>{beginnerInstruction.title}</h2>
            <p>{beginnerInstruction.text}</p>
          </div>
        </div>
        <ol className="session-plan">
          <li className={activeStep === "warmup" ? "current" : ""}>
            <strong>Warm up</strong>
            <span>Quiet hums, no performance voice yet.</span>
          </li>
          <li className={activeStep === "pitch" ? "current" : ""}>
            <strong>Match one note</strong>
            <span>Play tone, repeat, then let the app score it.</span>
          </li>
          <li className={activeStep === "resonance" ? "current" : ""}>
            <strong>Make it brighter</strong>
            <span>Same effort, more forward buzz.</span>
          </li>
          <li className={activeStep === "speech" ? "current" : ""}>
            <strong>Use words</strong>
            <span>Carry the shape into a short phrase.</span>
          </li>
        </ol>
      </section>

      {micError && <p className="alert">{micError}</p>}

      <section className="metrics-grid" aria-label="Daily voice metrics">
        <Metric icon={<Music2 />} label="Detected now" value={gentleDisplay ? (current.frequency ? "Sound heard" : "Listening") : current.frequency ? midiToNoteName(currentMidi) : "--"} detail={gentleDisplay ? "No note labels in gentle display" : formatFrequency(current.frequency)} />
        <Metric icon={<Gauge />} label="Comfort range today" value={gentleDisplay ? (dailySession.highMidi === null ? "Still mapping" : "Gently mapped") : formatRange(dailySession.lowMidi, dailySession.highMidi)} detail={gentleDisplay ? "Only sustained, easy sounds count" : `${semitoneSpan(dailySession.lowMidi, dailySession.highMidi)} sustained semitones mapped`} />
        <Metric icon={<Activity />} label="Steadiness" value={gentleDisplay ? sessionStats.stabilityLabel : `${sessionStats.stability}%`} detail={gentleDisplay ? "A soft hold is enough" : "Pitch hold"} />
        <Metric icon={<HeartPulse />} label="Mic level" value={gentleDisplay ? (current.volume > 0.12 ? "Clear" : "Soft") : sessionStats.effortLabel} detail="Volume is not vocal effort" />
      </section>

      <section className="practice-tier-panel" aria-label="Practice tier and rest guidance">
        <div>
          <p className="eyebrow">Today’s training tier</p>
          <h2>{activeTier.label} session: {formatSessionTime(sessionSeconds)} / {activeTier.minutes}:00</h2>
          <p>{sessionPlan.message}</p>
        </div>
        <div className="tier-options">
          {Object.entries(PRACTICE_TIERS).map(([id, tier]) => (
            <button
              className={practiceTier === id ? "tier-option selected" : "tier-option"}
              key={id}
              onClick={() => setPracticeTier(id)}
              aria-pressed={practiceTier === id}
            >
              <strong>{tier.label}</strong>
              <span>{tier.minutes} min</span>
            </button>
          ))}
        </div>
        <div className="tier-meter" aria-label="Daily practice target">
          <span style={{ width: `${sessionPlan.percent}%` }} />
        </div>
        {breakReminder && (
          <div className={breakReminder.kind === "done" ? "rest-reminder done" : "rest-reminder"}>
            <Coffee />
            <div>
              <strong>{breakReminder.title}</strong>
              <p>{breakReminder.text}</p>
            </div>
            <button onClick={() => acknowledgeBreak(breakReminder.id)}>
              {breakReminder.kind === "done" ? "Done for today" : "I took a break"}
            </button>
          </div>
        )}
      </section>

      <section className="today-continue">
        <div>
          <p className="eyebrow">Ready when you are</p>
          <h2>{activePractice.label}: {activePractice.title}</h2>
          <p>{activePractice.prompt}</p>
        </div>
        <button className="primary-action" onClick={() => navigateTo("practice")}><Waves /> Continue practice</button>
      </section>
      <section className="focus-picker" aria-label="Choose a practice focus">
        <div><p className="eyebrow">Choose one small thing</p><h2>What would feel useful today?</h2></div>
        <div className="focus-options">
          <button onClick={() => { setPracticeStyle("guided"); selectPracticeStep("warmup"); navigateTo("practice"); }}><HeartPulse /><strong>Feel easier</strong><span>Soft hums and gentle resets.</span></button>
          <button onClick={() => { setPracticeStyle("guided"); selectPracticeStep("pitch"); navigateTo("practice"); }}><Music2 /><strong>Explore pitch</strong><span>Small, forgiving steps by ear.</span></button>
          <button onClick={() => { setPracticeStyle("guided"); selectPracticeStep("speech"); navigateTo("practice"); }}><Waves /><strong>Use a phrase</strong><span>Bring one sound into real speech.</span></button>
        </div>
      </section>
      </>}

      {activeView === "practice" && <>
      {micError && <p className="alert">{micError}</p>}
      <section className="practice-style-picker" aria-label="Practice style">
        <div><p className="eyebrow">Practice style</p><h2>{practiceStyle === "guided" ? "Let FemmeVoice lead" : "Make the session your own"}</h2></div>
        <div role="group" aria-label="Choose practice style">
          <button className={practiceStyle === "guided" ? "selected" : ""} onClick={enterGuidedPractice} aria-pressed={practiceStyle === "guided"}>Guided</button>
          <button className={practiceStyle === "free" ? "selected" : ""} onClick={() => setPracticeStyle("free")} aria-pressed={practiceStyle === "free"}>Free practice</button>
        </div>
      </section>
      {practiceStyle === "free" && <section className="practice-flow" aria-label="Practice flow">
        {PRACTICE_FLOW.map((step) => {
          const Icon = step.icon;
          const selected = step.id === activeStep;
          return (
            <button
              className={selected ? "flow-step selected" : "flow-step"}
              key={step.id}
              onClick={() => selectPracticeStep(step.id)}
              aria-pressed={selected}
            >
              <Icon />
              <span>{step.label}</span>
            </button>
          );
        })}
      </section>}

      <section className="workspace">
        <article className="training-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{practiceStyle === "guided" ? "Your next small step" : "Free practice"}</p>
              <h2>{activePractice.title}</h2>
              <p>{activePractice.prompt}</p>
            </div>
            <span className={Math.abs(currentCents ?? 999) <= 55 ? "status good" : "status"}>
              {gentleDisplay ? currentCents === null ? "Waiting" : Math.abs(currentCents) <= 55 ? "In your zone" : "Adjust gently" : currentCents === null ? "Waiting" : `${currentCents > 0 ? "+" : ""}${currentCents} cents`}
            </span>
          </div>

          <div className="exercise-controls">
            {practiceStyle === "free" && <label>
              Mode
              <select value={exerciseMode} onChange={(event) => selectExerciseMode(event.target.value)}>
                <option value="comfort-ladder">Light pitch exploration</option>
                <option value="resonance-step">Brightness exploration</option>
                <option value="speech-floor">Speech transfer</option>
              </select>
            </label>}
            <div className="target-chip">
              <span>{gentleDisplay ? "Reference" : "Target"}</span>
              <strong>{gentleDisplay ? "Easy next step" : midiToNoteName(targetMidi)}</strong>
              <small>{gentleDisplay ? "Follow the tone by ear" : `${Math.round(targetFrequency)} Hz`}</small>
            </div>
            <button
              className="icon-action"
              onClick={recalibrateComfortAnchor}
              aria-label="Use my current easy hum as the starting note"
              title="Use my current easy hum as the starting note"
            >
              <RotateCcw />
            </button>
            {practiceStyle === "free" && <button className="icon-action" onClick={() => moveTarget(-1)} disabled={targetIndex === 0} aria-label="Use an easier target" title="Use an easier target">
              <ChevronLeft />
            </button>}
            <button
              className={isPlayingTone ? "tone-button playing" : "tone-button"}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                startTone();
              }}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture?.(event.pointerId);
                stopTone();
              }}
              onPointerCancel={stopTone}
              onBlur={stopTone}
              onKeyDown={(event) => {
                if (!event.repeat && (event.key === " " || event.key === "Enter")) startTone();
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") stopTone();
              }}
              aria-label="Hold to hear the target tone"
              title="Hold to hear the target tone"
            >
              <Volume2 />
              {isPlayingTone ? "Release to stop" : "Hold reference"}
            </button>
            {activeStep !== "cooldown" && (
              <button className="primary-action" onClick={beginAttempt} disabled={recordingAttempt}>
                <Target />
                {recordingAttempt ? "Listening..." : activeStep === "speech" ? "Check 3-second phrase" : activeStep === "resonance" ? "Check pitch hold" : "Try 3-second match"}
              </button>
            )}
            {practiceStyle === "free" && <button className="icon-action" onClick={() => moveTarget(1)} disabled={targetIndex === EXERCISE_STEPS.length - 1} aria-label="Try the next small step" title="Try the next small step">
              <ChevronRight />
            </button>}
          </div>

          <div className="coach-nudge">
            <strong>{beginnerInstruction.action}</strong>
            <span>{beginnerInstruction.why}</span>
          </div>

          <section className="animated-guide" aria-label="How the pitch guide works">
            <div className="guide-orbit" style={{ "--pitch-position": `${Math.max(5, Math.min(95, 50 + (currentCents ?? 0) / 3.5))}%` }}>
              <span className="guide-target" />
              <span className="guide-voice" />
              <span className="guide-window" />
            </div>
            <div className="guide-copy">
              <p className="eyebrow">Why this target?</p>
              <h3>{targetExplanation.title}</h3>
              <p>{targetExplanation.text}</p>
              <small>{targetExplanation.change}</small>
            </div>
            <div className="guide-legend" aria-label="Pitch guide legend">
              <span><i className="voice-dot" /> Your live pitch</span>
              <span><i className="target-dot" /> Gentle match zone (+/- 55 cents)</span>
            </div>
          </section>

          {activeStep === "warmup" ? (
            <div className="hum-circuit" aria-label="Guided humming warmup">
              <div className="hum-circuit-heading">
                <div>
                  <p className="eyebrow">Humming circuit</p>
                  <h3>{activeHumDrill.title}</h3>
                </div>
                <span>{activeHumDrill.duration}</span>
              </div>
              <p>{activeHumDrill.cue}</p>
              <div className="hum-drill-steps">
                {HUM_DRILLS.map((drill, index) => (
                  <button
                    className={index === humDrillIndex ? "selected" : ""}
                    key={drill.title}
                    onClick={() => setHumDrillIndex(index)}
                    aria-pressed={index === humDrillIndex}
                    aria-label={`Warmup drill ${index + 1}: ${drill.title}`}
                  >
                    {index + 1}
                  </button>
                ))}
                <button className="next-hum" onClick={nextHumDrill}>Next hum</button>
                <button className="next-stage" onClick={advancePracticeStep}>Go to pitch <ChevronRight /></button>
              </div>
            </div>
          ) : (
            <section className="stage-exercise" aria-label={`${activePractice.label} exercise`}>
              <div className="stage-exercise-heading">
                <div>
                  <p className="eyebrow">{activeStageExercise.eyebrow}</p>
                  <h3>{activePractice.title}</h3>
                </div>
                <span>{activeStageExercise.duration}</span>
              </div>
              <p>{activePractice.prompt}</p>
              <button className="next-stage" onClick={advancePracticeStep}>
                {practiceStyle === "guided" && activeStep === "cooldown" ? "Finish today" : activeStageExercise.nextLabel} <ChevronRight />
              </button>
            </section>
          )}

          {practiceStyle === "guided" && dailySession.guidedCompleted && <section className="guided-complete" aria-label="Guided practice complete">
            <CheckCircle2 />
            <div><strong>That is enough for today.</strong><span>Your voice has had a complete gentle round. Keep the easy feeling, drink some water, and come back another day.</span></div>
            <button onClick={() => { setDailySession((session) => ({ ...session, guidedCompleted: false, guidedStep: "warmup" })); setActiveStep("warmup"); setExerciseMode("comfort-ladder"); }}>Start another round</button>
          </section>}

          <div className="practice-principles" aria-label="Training principles">
            <div><strong>Listen first</strong><span>Try a sound, notice its colour, then try a small change.</span></div>
            <div><strong>Explore, do not force</strong><span>No larynx pushing, swallowing drills, or chasing a number.</span></div>
            <div><strong>Transfer it</strong><span>After a drill, use a short phrase before changing anything again.</span></div>
          </div>

          {recordingAttempt && (
            <div className="recording-bar" aria-label="Recording progress">
              <span style={{ width: `${attemptProgress}%` }} />
            </div>
          )}

          {practiceStyle === "free" && <canvas ref={canvasRef} width="980" height="340" aria-label="Pitch trace against the exercise target" />}

          <div className={practiceStyle === "guided" ? "range-map guided-range-map" : "range-map"} aria-label="Pitch reference range map">
            <div className="range-map-heading">
              <div>
                <p className="eyebrow">{practiceStyle === "guided" ? "Your pitch map" : "Pitch reference map"}</p>
                <h3>{practiceStyle === "guided" ? "A gentle picture of today’s voice range." : "Use the colours to orient yourself, not to grade yourself."}</h3>
              </div>
              <span>{gentleDisplay ? "Your own map" : showExtendedRange ? "C3 - F5" : "C3 - C#4"}</span>
            </div>
            <div className="range-live-track" style={{ "--range-position": `${visualRangePosition}%`, "--range-low": `${Math.min(visualRangeLow, visualRangeHigh)}%`, "--range-width": `${Math.max(1.2, Math.abs(visualRangeHigh - visualRangeLow))}%` }} aria-label={currentMidi === null ? "Waiting for a steady voice sound" : `Live pitch: ${gentleDisplay ? "detected" : midiToNoteName(currentMidi)}`}>
              <i className="range-track-blue" />
              <i className="range-track-gray" />
              <i className="range-track-pink" />
              {(dailySession.lowMidi !== null || dailySession.highMidi !== null) && <i className="range-today-window" />}
              <span className={currentMidi === null ? "range-live-dot waiting" : "range-live-dot"} />
            </div>
            <div className="range-map-legend">
              <span className="range-band blue"><b>{gentleDisplay ? "Lower" : "C3 - C#3"}</b> Lower reference</span>
              <span className="range-band gray"><b>{gentleDisplay ? "Middle" : "D3 - F3"}</b> Everyday reference</span>
              <span className="range-band pink"><b>{gentleDisplay ? "Lighter" : "F#3 - C#4"}</b> Light exploration</span>
              {showExtendedRange && <span className="range-band violet"><b>{gentleDisplay ? "Extended" : "D4 - F5"}</b> Optional exploration</span>}
            </div>
            <p>{practiceStyle === "guided" ? "The dot moves when FemmeVoice hears a steady sound. No colour is better than another; this just shows where your voice is today." : "Every voice has its own comfortable range. These bands are a visual guide for exploration, not a promise about what you should sound like or reach."}</p>
          </div>

          <div className="micro-drills" aria-label={`${activePractice.label} practice prompts`}>
            {activeStageExercise.cards.map((card, index) => (
              <PracticeCard key={card.title} number={String(index + 1)} title={card.title} text={card.text} />
            ))}
          </div>

          {lastScore && (
            <div className="score-card">
              <div className="score-ring" style={{ "--score": `${lastScore.score * 3.6}deg` }}>
                <strong>{gentleDisplay ? "~" : lastScore.score}</strong>
                <span>{gentleDisplay ? "check" : "/100"}</span>
              </div>
              <div>
                <h3>{lastScore.label}</h3>
                <p>
                  {gentleDisplay ? "A gentle check of steadiness and closeness. Keep only the part that felt easy." : lastScore.cents !== null
                    ? `${lastScore.cents > 0 ? "+" : ""}${lastScore.cents} cents average on ${lastScore.targetNote}.`
                    : "Try a longer, steadier sound so the coach has enough data."}
                </p>
                {lastScore.adaptation && <p className="score-adaptation">{lastScore.adaptation}</p>}
              </div>
            </div>
          )}

          {activeStep === "speech" && lastScore && <section className="self-reflection" aria-label="Your own practice reflection">
            <div><p className="eyebrow">Your ears matter</p><h3>How did that phrase feel?</h3></div>
            <div><button onClick={() => reflectOnPractice("easy")}>Easy</button><button onClick={() => reflectOnPractice("okay")}>Okay</button><button onClick={() => reflectOnPractice("effortful")}>Effortful</button></div>
          </section>}
        </article>

        <aside className="coach-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Coach</p>
              <h2>What to adjust</h2>
            </div>
            <Bot />
          </div>

          <div className="coach-readout">
            <Readout label="Mode" value={MODE_LABELS[exerciseMode]} />
            <Readout label="Goal" value={activePractice.target} />
            <Readout label="Your focus" value={TRAINING_GOALS[trainingGoal].label} />
            <Readout label="Tier" value={`${activeTier.label} ${activeTier.minutes} min`} />
            <Readout label="Session" value={`${dailySession.attempts.length} scored repeats`} />
            <Readout label="Remembered target" value={gentleDisplay ? "Your last easy step" : midiToNoteName(rememberedTargetMidi)} />
          </div>

          <div className="lesson-card">
            <h3><Timer /> What matters</h3>
            <p>
              Pitch helps, but it is not the whole voice. This app measures pitch, steadiness, and level; it cannot
              measure resonance or vocal weight for you. Use the listening prompts to explore those safely.
            </p>
          </div>

          <div className="tip-list">
            {tips.map((tip) => (
              <div className="tip" key={tip.title}>
                <CheckCircle2 />
                <div>
                  <strong>{tip.title}</strong>
                  <p>{tip.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="attempt-log">
            <h3>Recent attempts</h3>
            {dailySession.attempts.length === 0 ? (
              <p className="muted">No scored repeats yet.</p>
            ) : (
              dailySession.attempts.slice().reverse().map((attempt, index) => (
                <div className="attempt" key={`${attempt.targetNote}-${attempt.time ?? index}`}>
                  <span>{attempt.targetNote}</span>
                  <small>{attempt.mode ? MODE_LABELS[attempt.mode] : "Practice"}</small>
                  <strong>{attempt.score}</strong>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
      </>}

      {activeView === "progress" && <>
      <section className={`daily-insight ${dailyComparison.tone}`} aria-label="Today compared with yesterday">
        <div>
          <p className="eyebrow">Today, kindly</p>
          <h2>{dailyComparison.title}</h2>
          <p>{dailyComparison.message}</p>
        </div>
        <div className="daily-insight-stats">
          <div><span>Highest easy note</span><strong>{dailyComparison.highNote}</strong><small>{dailyComparison.highDetail}</small></div>
          <div><span>Comfort range</span><strong>{dailyComparison.range}</strong><small>{dailyComparison.rangeDetail}</small></div>
        </div>
      </section>
      <section className="progress-dashboard" aria-label="Progress over time">
        <div className="progress-summary">
          <p className="eyebrow">Progress memory</p>
          <h2>{gentleDisplay ? `Your last saved practice step was ${MODE_LABELS[progress.lastMode]}.` : `Last time you reached ${midiToNoteName(rememberedTargetMidi)} in ${MODE_LABELS[progress.lastMode]}.`}</h2>
          <p>
            Best saved range: {formatRange(progress.bestLowMidi, progress.bestHighMidi)}.
            {progress.bestScore !== null ? ` Best scored repeat: ${progress.bestScore}/100 on ${progress.bestScoreNote}.` : "Score a repeat to begin your history."}
          </p>
          {progress.bestHighMidi !== null && <button className="account-link range-correction" onClick={removeSavedHighOutlier}>Remove {midiToNoteName(progress.bestHighMidi)} as a false high-note outlier</button>}
          <span className={syncStatus === "synced" ? "sync-pill synced" : "sync-pill"}>
            {syncStatus === "synced" ? authInfo.authenticated ? "Account progress synced" : "Anonymous cloud synced" : syncStatus === "syncing" ? "Syncing progress" : "Saved on this device"}
          </span>
        </div>
        <div className="progress-stats">
          <ProgressStat icon={<Trophy />} label="Practice days" value={progress.totalPracticeDays} detail={`${progressStats.streak} day streak`} />
          <ProgressStat icon={<Target />} label="Scored repeats" value={progress.totalAttempts} detail={`${progressStats.averageScore}% recent avg`} />
          <ProgressStat icon={<Gauge />} label="All-time range" value={`${progressStats.bestSpan} st`} detail={formatRange(progress.bestLowMidi, progress.bestHighMidi)} />
        </div>
        <div className="history-bars" aria-label="Recent practice history">
          {progressStats.daysForChart.map((day) => <div className="history-day" key={day.date}><span style={{ height: `${day.height}%` }} /><small>{day.label}</small></div>)}
        </div>
      </section>
      <section className="range-history" aria-label="Dated voice range history">
        <div><p className="eyebrow">Your range over time</p><h2>A dated record of what your voice reached.</h2><p>Only steady sounds held for at least a moment are included. It is a record, not a target.</p></div>
        {progress.days.length ? <ol>{progress.days.map((day) => <li key={day.date}><time dateTime={day.date}>{formatHistoryDate(day.date)}</time><span>{day.highMidi === null ? "No stable high note saved" : `Highest stable pitch: ${midiToNoteName(day.highMidi)}`}</span><small>{day.lowMidi === null ? "" : `${midiToNoteName(day.lowMidi)} to ${midiToNoteName(day.highMidi)}${day.comfort ? ` · Felt ${day.comfort}` : ""}`}</small></li>)}</ol> : <p className="muted">Your dated range history begins after your first steady practice sound.</p>}
      </section>
      <section className="private-vault progress-vault" aria-label="Private recordings">
        <div>
          <p className="eyebrow">Private recordings</p>
          <h2>Your practice library.</h2>
          <p>Voice notes are encrypted before upload and only unlock with your FemmeVoice passphrase.</p>
          <small>{formatStorage(vaultUsage.used)} of {formatStorage(vaultUsage.limit)} free private space used</small>
        </div>
        <div className="vault-actions">
          <button className={vaultRecording ? "primary-action" : "auth-action"} onClick={vaultRecording ? stopPrivateRecording : startPrivateRecording}>
            {vaultRecording ? <Square /> : <Circle />}{vaultRecording ? "Stop and save" : "Record a note"}
          </button>
          {vaultRecording && <button className="auth-action" onClick={discardPrivateRecording}>Discard take</button>}
          {vaultStatus && <p>{vaultStatus}</p>}
        </div>
        {savedRecordings.length > 0 ? <div className="saved-recordings">
          {savedRecordings.map((recording) => <div key={recording.recording_id || recording.id}><span><strong>{recording.label}</strong><small>{Math.max(1, Math.round(recording.duration_ms / 1000))} sec</small></span><button onClick={() => playPrivateRecording(recording)} disabled={playingRecording === (recording.recording_id || recording.id)}>{playingRecording === (recording.recording_id || recording.id) ? "Playing..." : "Play"}</button><button className="icon-action" onClick={() => removePrivateRecording(recording)} aria-label={`Delete ${recording.label}`}><Trash2 /></button></div>)}
        </div> : <p className="vault-empty">Your saved practice notes will appear here.</p>}
      </section>
      </>}

      {activeView === "learn" && <section className="learning-library" aria-label="Voice-training learning library">
        <div className="library-heading">
          <div>
            <p className="eyebrow">Learning library</p>
            <h2>Learn one useful thing, then try it.</h2>
            <p>This is a map, not homework. Choose one small idea, explore it gently, and return when you are curious about the next one.</p>
          </div>
          <span>{LEARNING_RESOURCES.length} carefully selected starting points</span>
        </div>

        <div className="library-path" aria-label="A simple starting path">
          <article><b>1</b><strong>Listen</strong><span>Learn to hear one sound difference before trying to control it.</span></article>
          <article><b>2</b><strong>Explore</strong><span>Make a small, easy change with hums, vowels, or a short tone.</span></article>
          <article><b>3</b><strong>Use it</strong><span>Carry one comfortable change into a short phrase or ordinary conversation.</span></article>
        </div>

        <div className="resource-filter" role="tablist" aria-label="Resource topics">
          {RESOURCE_FILTERS.map((filter) => (
            <button
              className={resourceFilter === filter.id ? "selected" : ""}
              key={filter.id}
              onClick={() => setResourceFilter(filter.id)}
              role="tab"
              aria-selected={resourceFilter === filter.id}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="resource-grid" role="tabpanel">
          {visibleResources.map((resource) => (
            <a href={resource.href} target="_blank" rel="noreferrer" key={resource.label}>
              <span>{resource.kind}</span>
              <h3>{resource.label} <ExternalLink /></h3>
              <p>{resource.detail}</p>
            </a>
          ))}
        </div>
      </section>}

      {activeView === "account" && <>
      <section className="account-page" aria-label="Account settings">
        <div>
          <p className="eyebrow">Private account</p>
          <h2>{authInfo.authenticated ? `Signed in as ${authInfo.user?.display_name || authInfo.user?.username}` : "Keep your progress with you."}</h2>
          <p>{authInfo.authenticated ? "Your practice history syncs privately to this account." : "Create an account to keep your training history across devices. No email address is required."}</p>
        </div>
        <div className="account-page-actions">
          {authInfo.authenticated ? <button className="auth-action" onClick={signOut}>Sign out</button> : <><button className="primary-action" onClick={() => setAccountMode("register")}>Create account</button><button className="auth-action" onClick={() => setAccountMode("login")}>Sign in</button></>}
          {!authInfo.authenticated && <a className="migration-link" href="/api/auth/migration">Transfer an existing training account before 1 Aug 2026</a>}
        </div>
      </section>
      <div className="account-shortcuts" aria-label="Account help and privacy">
        <button onClick={() => navigateTo("feedback")}><MessageCircle /> Share feedback</button>
        <button onClick={() => navigateTo("privacy")}><ShieldCheck /> Privacy policy</button>
      </div>

      {authInfo.authenticated && <section className="data-rights" aria-label="Your data controls">
        <div>
          <p className="eyebrow">Your data</p>
          <h3>Export or erase your account</h3>
          <p>Download the account and progress we hold for you, or permanently delete your FemmeVoice account and synced progress.</p>
        </div>
        <div>
          <button className="auth-action" onClick={downloadPersonalData}>Download my data</button>
          <button className="danger-action" onClick={erasePersonalData}>Delete account and data</button>
        </div>
        {privacyStatus && <p className="privacy-status">{privacyStatus}</p>}
      </section>}

      {authInfo.authenticated && <section className="data-rights" aria-label="Email settings">
        <div>
          <p className="eyebrow">Recovery email</p>
          <h3>{authInfo.user?.email_verified ? "Verified email address" : "Add a recovery email"}</h3>
          <p>{authInfo.user?.email_verified ? authInfo.user.email : "A verified email will be used for future password recovery and account notices."}</p>
        </div>
        <form className="email-form" onSubmit={addAccountEmail}>
          <input type="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} placeholder="you@example.com" disabled={emailSubmitting} required />
          <button className="primary-action" disabled={emailSubmitting}>{emailSubmitting ? "Sending verification..." : "Send verification"}</button>
        </form>
      </section>}

      {authInfo.authenticated && <section className="data-rights private-vault-settings" aria-label="Private recording vault">
        <div>
          <p className="eyebrow">Private recording vault</p>
          <h3>{vaultKeyRef.current ? "Vault unlocked" : "Unlock your recordings"}</h3>
          <p>Your passphrase unlocks recordings in this browser session. FemmeVoice never receives it when opening your clips.</p>
        </div>
        {!vaultKeyRef.current && <form className="email-form" onSubmit={unlockPrivateVault}>
          <input type="password" autoComplete="current-password" value={vaultPassphrase} onChange={(event) => setVaultPassphrase(event.target.value)} placeholder="Your FemmeVoice passphrase" required />
          <button className="primary-action">Unlock vault</button>
        </form>}
        {vaultStatus && <p className="privacy-status">{vaultStatus}</p>}
      </section>}

      <section className="account-settings-grid" aria-label="All account settings">
        <article>
          <p className="eyebrow">Profile</p>
          <h3>FemmeVoice identity</h3>
          <dl><div><dt>Username</dt><dd>{authInfo.user?.username || "Local practice"}</dd></div><div><dt>Progress</dt><dd>{syncStatus === "synced" ? "Synced" : "On this device"}</dd></div></dl>
        </article>
        <article>
          <p className="eyebrow">Training default</p>
          <h3>Session pace</h3>
          <div className="tier-options compact-options">
            {Object.entries(PRACTICE_TIERS).map(([id, tier]) => <button className={practiceTier === id ? "tier-option selected" : "tier-option"} key={id} onClick={() => setPracticeTier(id)} aria-pressed={practiceTier === id}><strong>{tier.label}</strong><span>{tier.minutes} min</span></button>)}
          </div>
          <p>{activeTier.description}</p>
        </article>
        <article>
          <p className="eyebrow">Your intention</p>
          <h3>What matters most right now?</h3>
          <div className="goal-options">
            {Object.entries(TRAINING_GOALS).map(([id, goal]) => <button className={trainingGoal === id ? "selected" : ""} key={id} onClick={() => setTrainingGoal(id)} aria-pressed={trainingGoal === id}><strong>{goal.label}</strong><span>{goal.detail}</span></button>)}
          </div>
        </article>
        <article>
          <p className="eyebrow">Range & calibration</p>
          <h3>Keep it personal</h3>
          <label className="setting-toggle">
            <input type="checkbox" checked={showExtendedRange} onChange={(event) => setShowExtendedRange(event.target.checked)} />
            <span aria-hidden="true" />
            <strong>Show extended upper range to F5</strong>
          </label>
          <label className="setting-toggle">
            <input type="checkbox" checked={gentleDisplay} onChange={(event) => setGentleDisplay(event.target.checked)} />
            <span aria-hidden="true" />
            <strong>Gentle display: hide note names, Hz, cents, and scores</strong>
          </label>
          <label className="setting-toggle">
            <input type="checkbox" checked={autoRecord} onChange={(event) => setAutoRecord(event.target.checked)} />
            <span aria-hidden="true" />
            <strong>Automatically record voiced practice when my vault is unlocked</strong>
          </label>
          <button className="account-link" onClick={recalibrateComfortAnchor}>Recalibrate from my easy hum</button>
          <p>The next steady hum becomes your starting anchor. No preset pitch is required.</p>
        </article>
        <article>
          <p className="eyebrow">Privacy summary</p>
          <h3>What FemmeVoice remembers</h3>
          <dl><div><dt>Audio</dt><dd>Only when you choose to save it</dd></div><div><dt>Stored</dt><dd>Account, progress, preferences</dd></div><div><dt>Retention</dt><dd>Until you delete it</dd></div></dl>
        </article>
      </section>

      <button className="account-link privacy-link" onClick={() => navigateTo("privacy")}>Read the full privacy policy</button>
      </>}

      {activeView === "privacy" && <section className="privacy-page" aria-label="FemmeVoice privacy policy">
        <div className="privacy-policy-heading"><ShieldCheck /><div><p className="eyebrow">Privacy policy</p><h2>Your voice stays yours.</h2><p>Effective 15 July 2026. FemmeVoice is a practice companion, not a diagnostic or therapy service.</p></div></div>
        <div className="privacy-policy-text">
          <section><h3>Who is responsible</h3><p>Emilia Vuorenmaa is the controller for FemmeVoice. Contact: <a href="mailto:emilia@luova.club">emilia@luova.club</a>.</p></section>
          <section><h3>What we collect and why</h3><p>We collect the username you choose, a salted passphrase hash, optional verified recovery email, device identifier, practice progress, settings, and limited session and security data. We use this to provide your account, sync progress, keep the service secure, and send verification email only when you ask us to.</p></section>
          <section><h3>Microphone and recordings</h3><p>Pitch analysis happens in your browser. FemmeVoice does not record or upload audio unless you explicitly turn on automatic recording or start a recording yourself. When the private vault is unlocked and automatic recording is enabled, FemmeVoice records voiced parts of practice and skips quiet gaps. Before an audio note is uploaded, it is encrypted in your browser. We store the encrypted audio plus the label, date, duration, file type, size, and technical encryption information needed to retrieve it. We cannot play the audio.</p></section>
          <section><h3>Your control</h3><p>You can turn automatic recording off in Settings, discard a take, delete individual recordings, export account and progress data, or permanently delete your account. Account data stays until deletion; security records are kept only as long as needed for security and operations.</p></section>
          <section><h3>Sharing and security</h3><p>Only infrastructure providers needed to host FemmeVoice and its database process data for us. We do not sell data, use advertising, or profile people for marketing. We use HTTPS, secure session cookies, CSRF protection, password hashing, access controls, and data minimisation. No security measure is absolute.</p></section>
          <section><h3>Your rights</h3><p>You can ask for access, correction, restriction, portability, or object to processing through the contact above. You may also lodge a complaint with your local data-protection authority; in Finland, this is the Office of the Data Protection Ombudsman.</p></section>
        </div>
      </section>}

      {activeView === "feedback" && <section className="feedback-page" aria-label="Send FemmeVoice feedback">
        <div className="feedback-note"><MessageCircle /><div><p className="eyebrow">Help shape FemmeVoice</p><h2>What should feel better?</h2><p>Do not include passwords, private recordings, or urgent medical information. Safety concerns are welcome and will be prioritised.</p></div></div>
        <form className="feedback-form" onSubmit={sendFeedback}>
          <label>Kind of feedback<select value={feedbackForm.category} onChange={(event) => setFeedbackForm((form) => ({ ...form, category: event.target.value }))}><option value="idea">Feature idea</option><option value="bug">Something is broken</option><option value="resource">Resource or exercise suggestion</option><option value="safety">Safety concern</option><option value="other">Something else</option></select></label>
          <label>Message<textarea value={feedbackForm.message} onChange={(event) => setFeedbackForm((form) => ({ ...form, message: event.target.value }))} minLength="10" maxLength="4000" placeholder="What happened, what did you expect, or what would help?" required /></label>
          <div className="feedback-actions"><button className="primary-action" disabled={feedbackSubmitting}>{feedbackSubmitting ? "Sending feedback..." : "Send feedback"}</button>{feedbackStatus && <p>{feedbackStatus}</p>}</div>
        </form>
      </section>}

      {accountMode && (
        <div className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
          <form onSubmit={submitAccount} className="account-form">
            <button type="button" className="modal-close" onClick={() => setAccountMode(null)} aria-label="Close account dialog">x</button>
            <p className="eyebrow">FemmeVoice account</p>
            <h2 id="account-title">{accountMode === "register" ? "Save your progress privately" : "Welcome back"}</h2>
            <p>{accountMode === "register" ? "Choose a FemmeVoice username and a long, unique passphrase. You can add a recovery email after creating your account." : "Sign in with your FemmeVoice username and passphrase. Old LuovaAuth credentials need a one-time transfer first."}</p>
            <label>Username<input autoComplete="username" value={accountForm.username} onChange={(event) => setAccountForm((form) => ({ ...form, username: event.target.value }))} required /></label>
            <label>Passphrase<input type="password" autoComplete={accountMode === "register" ? "new-password" : "current-password"} value={accountForm.password} onChange={(event) => setAccountForm((form) => ({ ...form, password: event.target.value }))} required /></label>
            {accountMode === "register" && <label>Confirm passphrase<input type="password" autoComplete="new-password" value={accountForm.confirmation} onChange={(event) => setAccountForm((form) => ({ ...form, confirmation: event.target.value }))} required /></label>}
            {accountError && <p className="account-error">{accountError}</p>}
            <button className="primary-action" disabled={accountSubmitting}>{accountSubmitting ? "Working..." : accountMode === "register" ? "Create private account" : "Sign in"}</button>
            <button type="button" className="account-switch" onClick={() => { setAccountMode(accountMode === "register" ? "login" : "register"); setAccountError(""); }}>{accountMode === "register" ? "Already have an account? Sign in" : "New here? Create an account"}</button>
            <a className="migration-link" href="/api/auth/migration">Transfer an existing Luova training account before 1 Aug 2026</a>
            <small>By continuing, you acknowledge the privacy notes on this page.</small>
          </form>
        </div>
      )}
    </main>
  );
}

function summarizeSession(history, current, dailySession) {
  const voiced = history.filter((sample) => sample.frequency && sample.clarity > 0.35).slice(-50);
  if (voiced.length < 8) {
    return {
      stability: 0,
      stabilityLabel: "Waiting for",
      effortLabel: current.volume > 0.2 ? "High" : "Easy",
    };
  }
  const midiValues = voiced.map((sample) => 69 + 12 * Math.log2(sample.frequency / 440));
  const mean = midiValues.reduce((sum, value) => sum + value, 0) / midiValues.length;
  const spread = Math.sqrt(midiValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / midiValues.length);
  const stability = Math.round(Math.max(0, Math.min(100, 100 - spread * 95)));
  const effortLabel = current.volume > 0.2 ? "Too loud" : current.volume > 0.12 ? "Strong" : "Easy";
  const attemptsBonus = Math.min(8, dailySession.attempts.length);
  return {
    stability: Math.min(100, stability + attemptsBonus),
    stabilityLabel: stability > 78 ? "Steady" : stability > 50 ? "Settling" : "Wobbly",
    effortLabel,
  };
}

function summarizeProgress(progress) {
  const bestSpan = semitoneSpan(progress.bestLowMidi, progress.bestHighMidi);
  const scoredDays = progress.days.filter((day) => day.bestScore !== null);
  const recentScores = scoredDays.slice(0, 7).map((day) => day.bestScore);
  const averageScore = recentScores.length
    ? Math.round(recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length)
    : 0;
  const daysForChart = buildDayChart(progress.days);
  return {
    bestSpan,
    streak: calculateStreak(progress.days),
    averageScore,
    daysForChart,
  };
}

function buildDailyComparison(days, todaySession) {
  const today = {
    date: dayKey(),
    lowMidi: todaySession.lowMidi,
    highMidi: todaySession.highMidi,
  };
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = [
    yesterdayDate.getFullYear(),
    String(yesterdayDate.getMonth() + 1).padStart(2, "0"),
    String(yesterdayDate.getDate()).padStart(2, "0"),
  ].join("-");
  const yesterday = days.find((day) => day.date === yesterdayKey);
  const range = semitoneSpan(today.lowMidi, today.highMidi);
  const base = {
    highNote: today.highMidi === null ? "--" : midiToNoteName(today.highMidi),
    highDetail: today.highMidi === null ? "Warm up to map it" : "Held steadily for 0.4 sec",
    range: range ? `${range} st` : "--",
    rangeDetail: range ? "Comfort range mapped" : "Keep it gentle",
  };

  if (today.highMidi === null) {
    return { ...base, tone: "neutral", title: "There is no number to chase today.", message: "Make one easy hum when you are ready. The comparison begins only after your voice has had a chance to warm up." };
  }
  if (!yesterday?.highMidi) {
    return { ...base, tone: "neutral", title: "Today is your starting point.", message: "This is a note from one practice day, not a limit or a verdict. Let the next session meet you where you are." };
  }

  const difference = today.highMidi - yesterday.highMidi;
  const percent = Math.round((midiToFrequency(today.highMidi) / midiToFrequency(yesterday.highMidi) - 1) * 100);
  if (difference >= 0.5) {
    return {
      ...base,
      tone: "up",
      title: `Your highest easy note is ${percent}% higher than yesterday’s.`,
      message: `That is about ${difference.toFixed(1)} semitone${difference >= 1.5 ? "s" : ""} higher. Keep the easy feeling; a higher note only matters when it is repeatable.`,
      highDetail: `${midiToNoteName(yesterday.highMidi)} yesterday`,
    };
  }
  if (difference <= -0.5) {
    return {
      ...base,
      tone: "gentle",
      title: "A quieter range day is still real practice.",
      message: `Today’s highest easy note is below yesterday’s, and that is normal. Sleep, hydration, stress, and warmup all change the voice. Stay with what feels clear, then rest.`,
      highDetail: `${midiToNoteName(yesterday.highMidi)} yesterday`,
    };
  }
  return {
    ...base,
    tone: "steady",
    title: "Your highest easy note is steady from yesterday.",
    message: "Consistency is useful information. Keep working with this comfortable area instead of pushing just to make the chart move.",
    highDetail: `${midiToNoteName(yesterday.highMidi)} yesterday`,
  };
}

function formatSessionTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatStorage(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatHistoryDate(date) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function recordingAad(username, recordingId, mimeType) {
  return `femmevoice-private-recording:v1:${username}:${recordingId}:${mimeType}`;
}

function buildSessionPlan(tier, seconds) {
  const targetSeconds = tier.minutes * 60;
  const percent = Math.max(4, Math.min(100, Math.round((seconds / targetSeconds) * 100)));
  const remainingSeconds = Math.max(0, targetSeconds - seconds);
  if (remainingSeconds === 0) {
    return {
      percent,
      message: "You reached today’s planned practice time. Cool down, drink water, and let the voice rest.",
    };
  }
  if (seconds === 0) {
    return {
      percent,
      message: `${tier.description} Start with warmups, then do a few scored repeats.`,
    };
  }
  const remaining = Math.ceil(remainingSeconds / 60);
  return {
    percent,
    message: `${remaining} minute${remaining === 1 ? "" : "s"} left. Keep everything gentle enough that you could still chat afterward.`,
  };
}

function getBreakReminder(tier, session) {
  const acknowledged = new Set(session.breakAcknowledged ?? []);
  if (session.minutes >= tier.minutes) {
    const id = `done-${tier.minutes}`;
    if (acknowledged.has(id)) return null;
    return {
      id,
      kind: "done",
      title: "Stop while it still feels easy",
      text: "You hit the plan for today. Do a soft slide down, sip water, and save the next reps for tomorrow.",
    };
  }
  const nextBreakMinute = Math.floor(session.minutes / tier.breakEvery) * tier.breakEvery;
  if (nextBreakMinute >= tier.breakEvery) {
    const id = `break-${nextBreakMinute}`;
    if (!acknowledged.has(id)) {
      return {
        id,
        kind: "break",
        title: "Take a quiet reset",
        text: "Rest for 60-90 seconds. Swallow, loosen the jaw, breathe low, and restart only if the voice still feels clear.",
      };
    }
  }
  return null;
}

function buildDayChart(days) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const today = new Date();
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const day = byDate.get(key);
    const score = day?.bestScore ?? 0;
    const range = semitoneSpan(day?.lowMidi, day?.highMidi);
    return {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      height: Math.max(8, Math.min(100, score || range * 7 || 0)),
      active: Boolean(day),
    };
  });
}

function calculateStreak(days) {
  const practiced = new Set(days.map((day) => day.date));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, "0"),
      String(cursor.getDate()).padStart(2, "0"),
    ].join("-");
    if (!practiced.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getTargetExplanation({ exerciseMode, targetIndex, comfortAnchorMidi, targetMidi, lastScore }) {
  if (exerciseMode === "resonance-step") {
    return {
      title: `A steady reference at ${midiToNoteName(targetMidi)}`,
      text: "This note is only an anchor so you can hear changes in brightness without changing everything at once.",
      change: "This target follows the highest easy note you mapped today. Change it manually whenever it stops feeling easy.",
    };
  }
  if (exerciseMode === "speech-floor") {
    return {
      title: `A speech-friendly reference at ${midiToNoteName(targetMidi)}`,
      text: "Speech naturally moves around. Aim near this note, then let the phrase have normal movement instead of holding it flat.",
      change: "This reference uses today’s lower mapped note when available, so it stays connected to your usable voice.",
    };
  }
  const base = comfortAnchorMidi === null ? "a gentle starter note" : `your easy-hum anchor, ${midiToNoteName(comfortAnchorMidi)}`;
  if (lastScore?.matched) {
    return {
      title: `One small step above ${base}`,
      text: "You made a close, steady match, so the ladder offered the next small interval. It is an invitation, not a requirement.",
      change: "The target changes only after a close, easy 3-second match, or when you press the arrow buttons. Go back any time.",
    };
  }
  return {
    title: `Starting from ${base}`,
    text: "The app waits for an easy hum, then begins just a little above it. It is training control and comfort before range.",
    change: targetIndex === 0
      ? "Give the mic a few seconds of a clear, easy hum. A close, steady match unlocks one small step upward."
      : "The target changes only after a close, easy 3-second match, or when you press the arrow buttons. Go back any time.",
  };
}

function getBeginnerInstruction({ activeStep, listening, current, currentCents, recordingAttempt, lastScore }) {
  if (!listening) {
    return {
      title: "Click Start mic, then make a tiny comfortable sound.",
      text: "You do not need to know your range yet. The app will detect notes as you hum and will keep today’s comfortable range for you.",
      action: "First move: press Start mic.",
      why: "Localhost will ask for microphone permission. Your audio stays in the browser.",
    };
  }
  if (!current.frequency) {
    return {
      title: "Make a soft hum until the note appears.",
      text: "Try mmm or ee at normal speaking volume. If nothing shows up, move a little closer to the mic.",
      action: "Give me 2-3 seconds of steady sound.",
      why: "The coach needs a stable note before it can give useful feedback.",
    };
  }
  if (recordingAttempt) {
    return {
      title: "Hold the sound gently until the bar finishes.",
      text: "Do not chase the meter. Keep the throat easy, the sound small, and the buzz forward.",
      action: "Keep going, no extra volume.",
      why: "A calm, repeatable voice matters more than forcing a perfect score.",
    };
  }
  if (lastScore?.matched) {
    return {
      title: "Nice. Keep the feeling, not just the note.",
      text: "You matched the target well. Now try saying the short phrase while preserving the same light resonance.",
      action: "Move to Speech or try the next pitch.",
      why: "Voice training sticks when the exercise becomes speech.",
    };
  }
  if (currentCents !== null && Math.abs(currentCents) > 45 && activeStep === "pitch") {
    return {
      title: currentCents > 0 ? "You are above the target. Let it settle." : "You are below the target. Lift lightly.",
      text: "Use the tone as a reference, then adjust gently. Avoid squeezing upward or dropping into a heavy voice.",
      action: "Play tone, then Score repeat.",
      why: "Small adjustments train control faster than big jumps.",
    };
  }
  if (activeStep === "warmup") {
    return {
      title: "Warm up like you are waking the voice up.",
      text: "Use quiet hums and slides. The goal is easy vibration, not range or loudness.",
      action: "Hum softly for 20-30 seconds.",
      why: "A relaxed start makes the rest of practice safer and more accurate.",
    };
  }
  if (activeStep === "resonance") {
    return {
      title: "Make the same pitch feel brighter.",
      text: "Try ee or ih, smile slightly with the eyes, and feel the buzz closer to lips and teeth.",
      action: "Keep pitch steady while changing shape.",
      why: "Resonance is a major cue for feminine perception and everyday comfort.",
    };
  }
  if (activeStep === "speech") {
    return {
      title: "Now turn the sound into a tiny sentence.",
      text: 'Say "hey, I am here" lightly. If the phrase drops, go back to one easy hum and try again.',
      action: "Speak it, then score another repeat.",
      why: "The real goal is a voice you can use outside drills.",
    };
  }
  if (activeStep === "cooldown") {
    return {
      title: "Finish with a voice that still feels easy.",
      text: "Use a quiet downward slide or gentle hum, then stop. You do not need another scored repeat today.",
      action: "Release the sound and take a break.",
      why: "A calm finish helps you notice fatigue early and keeps practice sustainable.",
    };
  }
  return {
    title: "You are ready for a scored repeat.",
    text: "Play the tone once, repeat it on a light vowel, and let the coach score the attempt.",
    action: "Press Score repeat.",
    why: "The score checks accuracy and steadiness, while coach notes help you adjust the next try.",
  };
}

function Metric({ icon, label, value, detail }) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ProgressStat({ icon, label, value, detail }) {
  return (
    <article>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PracticeCard({ number, title, text }) {
  return (
    <div>
      <b>{number}</b>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function Readout({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
