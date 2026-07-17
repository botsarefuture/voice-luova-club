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
  Github,
  HeartPulse,
  Inbox,
  KeyRound,
  Mic,
  MessageCircle,
  Music2,
  PauseCircle,
  RotateCcw,
  ScrollText,
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
  frequencyToMidiExact,
  midiToFrequency,
  midiToNoteName,
  semitoneSpan,
} from "./audio";
import { deleteAccount, downloadPrivateRecording, exportAccountData, listPrivateRecordings, loadAdminFeedback, loadCloudProgress, loadMe, loadReminderSettings, loginAccount, logoutAccount, registerAccount, removePrivateRecording as deletePrivateRecording, requestEmailVerification, saveCloudProgress, saveReminderSettings, submitFeedback, uploadPrivateRecording } from "./api";
import { buildCoachTips, scoreAttempt, TARGET_MATCH_TOLERANCE_CENTS } from "./coach";
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
import AcademyView from "./academy/AcademyView";
import { academyRoute, parseAppRoute } from "./academy/routes";
import { APP_VERSION } from "./version";

const EXERCISE_STEPS = [0, 1, 2, 3, 5, 7, 8, 10, 12];
const DEFAULT_COMFORT_ANCHOR = 52;
const MAX_TRAINING_MIDI = 77;
const MIN_SPEECH_REFERENCE_MIDI = 50; // D3: an exercise floor, never a gender requirement.
const REMINDER_DAYS = [
  { value: 0, label: "Mon" }, { value: 1, label: "Tue" }, { value: 2, label: "Wed" }, { value: 3, label: "Thu" },
  { value: 4, label: "Fri" }, { value: 5, label: "Sat" }, { value: 6, label: "Sun" },
];

const APP_VIEWS = [
  { id: "today", label: "Today", icon: HeartPulse },
  { id: "practice", label: "Practice", icon: Waves },
  { id: "progress", label: "Progress", icon: Activity },
  { id: "academy", label: "Academy", icon: BookOpen },
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "guide", label: "Guide", icon: ScrollText },
  { id: "account", label: "Settings", icon: UserRound },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "feedback", label: "Feedback", icon: MessageCircle },
  { id: "admin-feedback", label: "Feedback inbox", icon: Inbox },
];
const MAIN_VIEW_IDS = new Set(["today", "practice", "progress", "academy", "learn", "guide"]);

function initialRoute() {
  const route = parseAppRoute(window.location.hash);
  return {
    view: APP_VIEWS.some((item) => item.id === route.view) ? route.view : "today",
    academyCourseSlug: route.view === "academy" ? route.academyCourseSlug : null,
    academyLessonSlug: route.view === "academy" ? route.academyLessonSlug : null,
  };
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
      { title: "Let it move", text: "Speech is not a held note. Let the phrase rise, fall, or land naturally for its meaning." },
      { title: "Keep your style", text: "Choose what sounds like you. A wider contour is an option to explore, never a rule for femininity." },
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

const GUIDED_MATCH_GOALS = {
  pitch: 3,
  resonance: 2,
  speech: 2,
};

const INTONATION_PATTERNS = {
  statement: { label: "Statement", phrase: "I can make it today.", cue: "Let the important word carry a little movement, then allow the end to settle if that feels natural." },
  question: { label: "Question", phrase: "Can I make it today?", cue: "Let the question feel genuinely curious. A gentle lift at the end is one option, not an obligation." },
  emphasis: { label: "Emphasis", phrase: "I can make it today.", cue: "Say it three times, placing the focus on I, make, then today. Notice how the melody changes with meaning." },
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
  { category: "practice", label: "Intonation and gender perception", kind: "Research reading", detail: "A study of intonation in cis and gender-diverse speakers. Use it as context for personal exploration, not as a rulebook for how a woman must speak.", href: "https://pubmed.ncbi.nlm.nih.gov/24094799/" },
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

const RESEARCH_GUIDE = [
  {
    id: "purpose",
    topic: "What this guide is for",
    takeaway: "FemmeVoice is a practical, evidence-informed place to explore a voice that feels more like you. It is not a rulebook for womanhood or a promise about how strangers will perceive you.",
    practice: "Use the ideas here as small experiments. Keep what feels clear, comfortable, expressive, and personally affirming.",
    limit: "App feedback cannot measure every part of a voice or replace your own ears, your goals, or clinical care.",
    sources: [],
  },
  {
    id: "pitch",
    topic: "Pitch is useful, not the whole voice",
    takeaway: "Speaking pitch can affect how a voice is perceived, but resonance, vocal quality, articulation, prosody, and a listener's expectations matter too.",
    practice: "Use the pitch map as orientation. Build an easy speaking area before trying to hold a high note.",
    limit: "No single frequency can guarantee how another person will gender a voice.",
    sources: [
      { label: "Voice, articulation, and prosody systematic review", href: "https://pubs.asha.org/doi/10.1044/2017_JSLHR-S-17-0067" },
      { label: "Gender-affirming voice modification review", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10387149/" },
    ],
  },
  {
    id: "range-data",
    topic: "Sustained practice data should be interpretable",
    takeaway: "Voice-range work is more useful when collection is consistent and based on sustained phonation rather than one noisy instantaneous reading.",
    practice: "FemmeVoice keeps short steady sounds as explored pitch and uses longer holds only to advance a reference.",
    limit: "This app is not a clinical voice-range profile and cannot diagnose vocal health.",
    sources: [
      { label: "Voice Range Profile standardization study", href: "https://pubmed.ncbi.nlm.nih.gov/32402662/" },
      { label: "Shortened Voice Range Profile protocol", href: "https://pubmed.ncbi.nlm.nih.gov/34099353/" },
    ],
  },
  {
    id: "intonation",
    topic: "Intonation is meaning, not a rulebook",
    takeaway: "Pitch movement across phrases can contribute to how speech is heard. Its relationship to perceived gender is contextual and varies between people.",
    practice: "Use statement, question, and emphasis exercises to explore how you want meaning to sound. Keep contours that feel expressive and natural to you.",
    limit: "There is no universal feminine contour, and FemmeVoice does not grade any pattern as more feminine.",
    sources: [
      { label: "Intonation and gender perception", href: "https://pubmed.ncbi.nlm.nih.gov/24094799/" },
      { label: "Intonation parameters in gender-diverse people", href: "https://www.sciencedirect.com/science/article/pii/S0892199722004209" },
    ],
  },
  {
    id: "health",
    topic: "Comfort and vocal health come first",
    takeaway: "Training should be adjustable, repeatable, and stopped when pain, persistent scratchiness, or unusual hoarseness appears.",
    practice: "Use short sessions, rest breaks, gentle volume, and a reset to an easy hum. A quieter day is still useful practice.",
    limit: "Online guidance is not a substitute for a voice-specialized clinician, especially for ongoing symptoms.",
    sources: [
      { label: "UCSF vocal health guidance", href: "https://transcare.ucsf.edu/guidelines/vocal-health" },
      { label: "Speech therapy systematic review", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10363306/" },
    ],
  },
  {
    id: "app-data",
    topic: "Understanding your FemmeVoice data",
    takeaway: "Explored pitch is a short steady sound. Verified holds are longer checks near a reference. Neither is a score for femininity or worth.",
    practice: "Compare trends across gentle practice days, not one unusually high or low moment. Use recordings only if you chose to enable them.",
    limit: "Microphone quality, room noise, hydration, sleep, stress, and warmup can all change a reading.",
    sources: [],
  },
];

export default function App() {
  const [activeView, setActiveView] = useState(() => initialRoute().view);
  const [academyCourseSlug, setAcademyCourseSlug] = useState(() => initialRoute().academyCourseSlug);
  const [academyLessonSlug, setAcademyLessonSlug] = useState(() => initialRoute().academyLessonSlug);
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
  const [reminderSettings, setReminderSettings] = useState({ enabled: false, time: "18:00", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", days: [0, 1, 2, 3, 4, 5, 6], tone: "gentle" });
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderStatus, setReminderStatus] = useState("");
  const [feedbackForm, setFeedbackForm] = useState({ category: "idea", message: "" });
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState([]);
  const [adminFeedbackStatus, setAdminFeedbackStatus] = useState("");
  const [adminFeedbackLoading, setAdminFeedbackLoading] = useState(false);
  const [resourceFilter, setResourceFilter] = useState("start");
  const [showExtendedRange, setShowExtendedRange] = useState(() => loadProgress().showExtendedRange ?? false);
  const [gentleDisplay, setGentleDisplay] = useState(() => loadProgress().gentleDisplay ?? false);
  const [autoRecord, setAutoRecord] = useState(() => loadProgress().autoRecordConsent ?? false);
  const [trainingGoal, setTrainingGoal] = useState(() => loadProgress().trainingGoal ?? "comfort");
  const [historyRetentionDays, setHistoryRetentionDays] = useState(() => loadProgress().historyRetentionDays ?? 3650);
  const [targetMisses, setTargetMisses] = useState(0);
  const [practiceStyle, setPracticeStyle] = useState(() => loadProgress().practiceStyle ?? "guided");
  const [intonationPattern, setIntonationPattern] = useState("statement");
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
      return Math.min(MAX_TRAINING_MIDI, Math.max(45, Math.round(dailySession.highMidi)));
    }
    if (exerciseMode === "speech-floor") {
      const easySpeechAnchor = dailySession.comfortHighMidi ?? comfortAnchorMidi ?? dailySession.highMidi ?? DEFAULT_COMFORT_ANCHOR;
      return Math.min(MAX_TRAINING_MIDI, Math.max(MIN_SPEECH_REFERENCE_MIDI, Math.round(easySpeechAnchor)));
    }
    return Math.min(
      MAX_TRAINING_MIDI,
      (comfortAnchorMidi ?? DEFAULT_COMFORT_ANCHOR) + (EXERCISE_STEPS[targetIndex] ?? EXERCISE_STEPS[0]),
    );
  }, [comfortAnchorMidi, dailySession.comfortHighMidi, dailySession.highMidi, exerciseMode, targetIndex]);

  const targetFrequency = midiToFrequency(targetMidi);
  const targetLowFrequency = targetFrequency * 2 ** (-TARGET_MATCH_TOLERANCE_CENTS / 1200);
  const targetHighFrequency = targetFrequency * 2 ** (TARGET_MATCH_TOLERANCE_CENTS / 1200);
  const rememberedTargetMidi = Math.min(
    MAX_TRAINING_MIDI,
    (progress.comfortAnchorMidi ?? DEFAULT_COMFORT_ANCHOR)
      + (EXERCISE_STEPS[progress.lastTargetIndex] ?? EXERCISE_STEPS[0]),
  );
  const currentMidi = current.frequency ? frequencyToMidi(current.frequency) : null;
  const currentMidiExact = current.frequency ? frequencyToMidiExact(current.frequency) : null;
  const currentCents = current.frequency ? centsOff(current.frequency, targetFrequency) : null;
  const visualRangeMaxMidi = showExtendedRange ? 77 : 61;
  const visualRangePosition = Math.max(2, Math.min(98, ((currentMidiExact ?? 54) - 48) / (visualRangeMaxMidi - 48) * 100));
  const targetMapPosition = Math.max(2, Math.min(98, (targetMidi - 48) / (visualRangeMaxMidi - 48) * 100));
  const visualRangeLow = Math.max(0, Math.min(100, ((dailySession.lowMidi ?? 54) - 48) / (visualRangeMaxMidi - 48) * 100));
  const visualRangeHigh = Math.max(0, Math.min(100, ((dailySession.highMidi ?? dailySession.lowMidi ?? 54) - 48) / (visualRangeMaxMidi - 48) * 100));
  const sessionStats = useMemo(() => summarizeSession(history, current, dailySession), [history, current, dailySession]);
  const progressStats = useMemo(() => summarizeProgress(progress), [progress]);
  const recordingsByDate = useMemo(() => savedRecordings.reduce((groups, recording) => {
    const date = recordingDateKey(recording.created_at);
    groups.set(date, [...(groups.get(date) ?? []), recording]);
    return groups;
  }, new Map()), [savedRecordings]);
  const datedProgressHistory = useMemo(() => {
    const days = new Map(progress.days.map((day) => [day.date, day]));
    recordingsByDate.forEach((recordings, date) => {
      if (!days.has(date)) days.set(date, { date, lowMidi: null, highMidi: null, comfortLowMidi: null, comfortHighMidi: null, attempts: 0, minutes: 0, seconds: 0, recordingsOnly: recordings.length > 0 });
    });
    return [...days.values()].sort((a, b) => {
      if (a.date === "undated") return 1;
      if (b.date === "undated") return -1;
      return b.date.localeCompare(a.date);
    });
  }, [progress.days, recordingsByDate]);
  const hasPracticeHistory = progress.days.length > 0 || dailySession.attempts.length > 0 || dailySession.highMidi !== null;
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
    practiceStyle,
  });
  const visibleResources = resourceFilter === "all"
    ? LEARNING_RESOURCES
    : LEARNING_RESOURCES.filter((resource) => resource.category === resourceFilter);

  useEffect(() => {
    const handleHashChange = () => {
      const route = initialRoute();
      setActiveView(route.view);
      setAcademyCourseSlug(route.academyCourseSlug);
      setAcademyLessonSlug(route.academyLessonSlug);
    };
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
      historyRetentionDays,
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
      historyRetentionDays,
      practiceStyle,
    }));
  }, [targetIndex, activeStep, exerciseMode, practiceTier, comfortAnchorMidi, showExtendedRange, gentleDisplay, autoRecord, trainingGoal, historyRetentionDays, practiceStyle]);

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
          setHistoryRetentionDays(merged.historyRetentionDays ?? 3650);
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
    if (!authInfo.authenticated) {
      setReminderSettings({ enabled: false, time: "18:00", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", days: [0, 1, 2, 3, 4, 5, 6], tone: "gentle" });
      return;
    }
    let cancelled = false;
    loadReminderSettings()
      .then((settings) => {
        if (!cancelled) setReminderSettings(settings);
      })
      .catch(() => {
        if (!cancelled) setReminderStatus("Could not load reminder settings.");
      });
    return () => { cancelled = true; };
  }, [authInfo.authenticated]);

  useEffect(() => {
    if (activeView !== "admin-feedback" || !authInfo.user?.is_admin) return;
    let cancelled = false;
    setAdminFeedbackLoading(true);
    setAdminFeedbackStatus("");
    loadAdminFeedback()
      .then((payload) => {
        if (!cancelled) setAdminFeedback(payload.feedback ?? []);
      })
      .catch((error) => {
        if (!cancelled) setAdminFeedbackStatus(error.message);
      })
      .finally(() => {
        if (!cancelled) setAdminFeedbackLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeView, authInfo.user?.is_admin]);

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
      const midi = frequencyToMidiExact(analysis.frequency);
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
    const windowStart = time - 520;
    const window = [...rangeWindowRef.current, { midi, time }].filter((sample) => sample.time >= windowStart);
    rangeWindowRef.current = window;
    if (window.length < 8 || window[window.length - 1].time - window[0].time < 420) return;
    const notes = window.map((sample) => sample.midi);
    if (Math.max(...notes) - Math.min(...notes) > 0.9) return;
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
      const result = scoreAttempt({ targetFrequency, samples: attemptSamplesRef.current, allowContour: activeStep === "speech" });
      const stepDown = result.stableBelowTarget && activeStep === "pitch" && targetMisses >= 1 && targetIndex > 0;
      const achievedMidi = frequencyToMidi(targetFrequency * 2 ** (result.cents / 1200));
      const acceptedPitchMatch = result.matched && activeStep === "pitch";
      const nextTargetIndex = Math.min(EXERCISE_STEPS.length - 1, targetIndex + 1);
      const nextTargetMidi = Math.min(MAX_TRAINING_MIDI, (comfortAnchorMidi ?? DEFAULT_COMFORT_ANCHOR) + EXERCISE_STEPS[nextTargetIndex]);
      const enriched = {
        ...result,
        mode: exerciseMode,
        step: activeStep,
        time: Date.now(),
        adaptation: acceptedPitchMatch && nextTargetIndex > targetIndex
          ? `You held ${result.targetNote} comfortably enough. Moving to ${midiToNoteName(nextTargetMidi)} when you are ready.`
          : result.stableAboveTarget
          ? "You are already above this reference. Keep the target, take a breath, and give yourself time to let the next sound settle toward it."
          : stepDown ? "This note is not ready today. FemmeVoice moved back one comfortable step." : null,
        achievedMidi,
        advancedTo: acceptedPitchMatch && nextTargetIndex > targetIndex ? nextTargetMidi : null,
      };
      setLastScore(enriched);
      const guidedGoal = GUIDED_MATCH_GOALS[activeStep];
      const completedGuidedStage = practiceStyle === "guided" && result.matched && guidedGoal
        && ((dailySession.guidedStageMatches?.[activeStep] ?? 0) + 1 >= guidedGoal);
      setDailySession((session) => ({
        ...session,
        attempts: [...session.attempts.slice(-17), enriched],
        comfortLowMidi: result.matched ? (session.comfortLowMidi === null ? achievedMidi : Math.min(session.comfortLowMidi, achievedMidi)) : session.comfortLowMidi,
        comfortHighMidi: result.matched ? (session.comfortHighMidi === null ? achievedMidi : Math.max(session.comfortHighMidi, achievedMidi)) : session.comfortHighMidi,
        guidedStageMatches: result.matched && guidedGoal
          ? { ...(session.guidedStageMatches ?? {}), [activeStep]: (session.guidedStageMatches?.[activeStep] ?? 0) + 1 }
          : session.guidedStageMatches ?? {},
      }));
      if (acceptedPitchMatch) {
        setTargetMisses(0);
        setTargetIndex(nextTargetIndex);
      } else if (activeStep === "pitch") {
        if (result.stableAboveTarget) {
          setTargetMisses(0);
        } else if (stepDown) {
          setTargetIndex((index) => Math.max(0, index - 1));
          setTargetMisses(0);
        } else {
          setTargetMisses((misses) => misses + 1);
        }
      }
      if (completedGuidedStage) {
        const currentIndex = PRACTICE_FLOW.findIndex((step) => step.id === activeStep);
        const nextStep = PRACTICE_FLOW[currentIndex + 1];
        if (nextStep) window.setTimeout(() => selectPracticeStep(nextStep.id), 650);
      }
    }, 3000);
  }

  function resetDay() {
    const reset = { date: dayKey(), lowMidi: null, highMidi: null, comfortLowMidi: null, comfortHighMidi: null, attempts: [], minutes: 0, seconds: 0, breakAcknowledged: [], voiceCheck: "unset", guidedStep: "warmup", guidedCompleted: false, guidedStageMatches: {}, reflections: [] };
    setDailySession(reset);
    saveTodaySession(reset);
    setHistory([]);
    rangeWindowRef.current = [];
    setLastScore(null);
    setAttemptProgress(0);
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
    if (practiceStyle === "guided" && humDrillIndex === HUM_DRILLS.length - 1) {
      setHumDrillIndex(0);
      window.setTimeout(() => selectPracticeStep("pitch"), 350);
      return;
    }
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
    setAcademyCourseSlug(null);
    setAcademyLessonSlug(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateToAcademy(courseSlug = null, lessonSlug = null) {
    window.location.hash = academyRoute(courseSlug, lessonSlug);
    setActiveView("academy");
    setAcademyCourseSlug(courseSlug);
    setAcademyLessonSlug(lessonSlug);
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

  async function updateReminderSettings(event) {
    event.preventDefault();
    if (reminderSubmitting) return;
    try {
      setReminderSubmitting(true);
      setReminderStatus("");
      const settings = await saveReminderSettings(reminderSettings);
      setReminderSettings(settings);
      setReminderStatus(settings.enabled ? `Your ${settings.tone} reminder will arrive near ${settings.time} on ${formatReminderDays(settings.days)}. It will skip days where FemmeVoice already has practice saved.` : "Practice reminder emails are off.");
    } catch (error) {
      setReminderStatus(error.message);
    } finally {
      setReminderSubmitting(false);
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
          <p>{activeView === "practice" ? "One calm exercise at a time. Stop any time your voice stops feeling easy." : activeView === "progress" ? "Your practice history, range notes, and gentle next steps." : activeView === "academy" ? "A private, structured place to learn one useful thing at a time." : activeView === "learn" ? "Simple explanations first, then deeper resources whenever you want them." : activeView === "guide" ? "What FemmeVoice is based on, what its measurements mean, and where the evidence has limits." : activeView === "privacy" ? "A plain-language account of what FemmeVoice stores, why, and how you stay in control." : activeView === "feedback" ? "Tell us what feels useful, unclear, missing, or unsafe. Thoughtful feedback shapes FemmeVoice." : activeView === "admin-feedback" ? "Private feedback review for FemmeVoice administrators." : "Your private FemmeVoice account, preferences, and safety information."}</p>
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
        <Metric icon={<Music2 />} label="Detected now" value={gentleDisplay ? (current.frequency ? "Sound heard" : "Listening") : current.frequency ? formatPitchPosition(currentMidiExact) : "--"} detail={gentleDisplay ? "No note labels in gentle display" : formatFrequency(current.frequency)} />
        <Metric icon={<Gauge />} label="Comfortable matches" value={gentleDisplay ? (dailySession.comfortHighMidi === null ? "Not checked yet" : "Mapped") : formatRange(dailySession.comfortLowMidi, dailySession.comfortHighMidi)} detail={dailySession.comfortHighMidi === null ? "Match a note successfully to map this" : "Only successful, steady matches count"} />
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
        <div><p className="eyebrow">Practice style</p><h2>{practiceStyle === "guided" ? "Let FemmeVoice lead" : "Make the session your own"}</h2><p>{practiceStyle === "guided" ? "One small stage at a time. FemmeVoice moves on after comfortable practice, and you can stop whenever you need." : "Choose any stage, replay a reference, and work at your own pace."}</p></div>
        <div role="group" aria-label="Choose practice style">
          <button className={practiceStyle === "guided" ? "selected" : ""} onClick={enterGuidedPractice} aria-pressed={practiceStyle === "guided"}>Guided</button>
          <button className={practiceStyle === "free" ? "selected" : ""} onClick={() => setPracticeStyle("free")} aria-pressed={practiceStyle === "free"}>Free practice</button>
        </div>
      </section>
      {practiceStyle === "guided" && <section className="guided-route" aria-label="Guided session progress">
        <div><p className="eyebrow">Your session path</p><h3>{activePractice.label} now, then one gentle next step.</h3><p>Warmup changes after four easy drills. Pitch, brightness, and speech move forward after comfortable repeats, not perfect notes.</p></div>
        <ol>{PRACTICE_FLOW.map((step, index) => <li className={step.id === activeStep ? "current" : ""} key={step.id}><span>{index + 1}</span><strong>{step.label}</strong></li>)}</ol>
      </section>}
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
              <span>Reference</span>
              <strong>{gentleDisplay ? "Easy next step" : midiToNoteName(targetMidi)}</strong>
              <small>{gentleDisplay ? "Follow the tone by ear" : `${Math.round(targetFrequency)} Hz · accepts ${Math.round(targetLowFrequency)}-${Math.round(targetHighFrequency)} Hz`}</small>
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
                {recordingAttempt ? "Listening..." : activeStep === "speech" ? "Hold the phrase for 3 seconds" : activeStep === "resonance" ? "Hold near the reference" : "Hold near the reference for 3 seconds"}
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
              <span><i className="target-dot" /> A comfortable hold zone: about {Math.round(targetLowFrequency)}-{Math.round(targetHighFrequency)} Hz</span>
            </div>
          </section>

          {practiceStyle === "guided" && <section className="range-map guided-range-map guided-live-map" aria-label="Live pitch map">
            <div className="range-map-heading">
              <div>
                <p className="eyebrow">Live pitch map</p>
                <h3>See your voice and the next note together.</h3>
              </div>
              <span>{currentMidiExact === null ? "Waiting for sound" : `You: ${gentleDisplay ? "sound heard" : formatPitchPosition(currentMidiExact)}`}</span>
            </div>
            <div className="range-live-track" style={{ "--range-position": `${visualRangePosition}%`, "--target-position": `${targetMapPosition}%`, "--range-low": `${Math.min(visualRangeLow, visualRangeHigh)}%`, "--range-width": `${Math.max(1.2, Math.abs(visualRangeHigh - visualRangeLow))}%` }} aria-label={currentMidi === null ? "Waiting for a steady voice sound" : `Live pitch: ${gentleDisplay ? "detected" : midiToNoteName(currentMidi)}`}>
              <i className="range-track-blue" />
              <i className="range-track-gray" />
              <i className="range-track-pink" />
              {(dailySession.lowMidi !== null || dailySession.highMidi !== null) && <i className="range-today-window" />}
              <i className="range-target-marker" aria-label={`Reference ${midiToNoteName(targetMidi)}`} />
              <span className={currentMidi === null ? "range-live-dot waiting" : "range-live-dot"} />
            </div>
            <div className="range-map-legend">
              <span className="range-band blue"><b>{gentleDisplay ? "Lower" : "C3 - C#3"}</b> Lower reference</span>
              <span className="range-band gray"><b>{gentleDisplay ? "Middle" : "D3 - F3"}</b> Everyday reference</span>
              <span className="range-band pink"><b>{gentleDisplay ? "Lighter" : "F#3 - C#4"}</b> Light exploration</span>
              {showExtendedRange && <span className="range-band violet"><b>{gentleDisplay ? "Extended" : "D4 - F5"}</b> Optional exploration</span>}
            </div>
            <p>Your dot is your live pitch. The teal line is the reference, {gentleDisplay ? "the next gentle reference" : midiToNoteName(targetMidi)}. The pale window is the steady area FemmeVoice has heard today.</p>
          </section>}

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
                <button className="next-hum" onClick={nextHumDrill}>{practiceStyle === "guided" && humDrillIndex === HUM_DRILLS.length - 1 ? "Start pitch" : "Next hum"}</button>
                {practiceStyle === "free" && <button className="next-stage" onClick={advancePracticeStep}>Go to pitch <ChevronRight /></button>}
              </div>
            </div>
          ) : (
            <section className="stage-exercise" aria-label={`${activePractice.label} exercise`}>
              <div className="stage-exercise-heading">
                <div>
                  <p className="eyebrow">{activeStageExercise.eyebrow}</p>
                  <h3>{activePractice.title}</h3>
                </div>
                <span>{practiceStyle === "guided" && GUIDED_MATCH_GOALS[activeStep] ? `Round ${Math.min((dailySession.guidedStageMatches?.[activeStep] ?? 0) + 1, GUIDED_MATCH_GOALS[activeStep])} of ${GUIDED_MATCH_GOALS[activeStep]}` : activeStageExercise.duration}</span>
              </div>
              <p>{activePractice.prompt}</p>
              {(practiceStyle === "free" || activeStep === "cooldown") && <button className="next-stage" onClick={advancePracticeStep}>
                {practiceStyle === "guided" && activeStep === "cooldown" ? "Finish today" : activeStageExercise.nextLabel} <ChevronRight />
              </button>}
            </section>
          )}

          {practiceStyle === "guided" && dailySession.guidedCompleted && <section className="guided-complete" aria-label="Guided practice complete">
            <CheckCircle2 />
            <div><strong>That is enough for today.</strong><span>Your voice has had a complete gentle round. Keep the easy feeling, drink some water, and come back another day.</span></div>
            <button onClick={() => { setDailySession((session) => ({ ...session, guidedCompleted: false, guidedStep: "warmup", guidedStageMatches: {} })); setActiveStep("warmup"); setExerciseMode("comfort-ladder"); }}>Start another round</button>
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

          {practiceStyle === "free" && <div className="range-map" aria-label="Pitch reference range map">
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
          </div>}

          <div className="micro-drills" aria-label={`${activePractice.label} practice prompts`}>
            {activeStageExercise.cards.map((card, index) => (
              <PracticeCard key={card.title} number={String(index + 1)} title={card.title} text={card.text} />
            ))}
          </div>

          {activeStep === "speech" && <section className="intonation-lab" aria-label="Intonation practice">
            <div>
              <p className="eyebrow">Intonation lab</p>
              <h3>Let meaning move the melody.</h3>
              <p>FemmeVoice records pitch movement in your phrase, but it does not decide whether a contour sounds feminine. Pick the pattern that supports what you want to say.</p>
            </div>
            <div className="intonation-options" role="group" aria-label="Choose an intonation exercise">
              {Object.entries(INTONATION_PATTERNS).map(([id, pattern]) => <button key={id} className={intonationPattern === id ? "selected" : ""} onClick={() => setIntonationPattern(id)} aria-pressed={intonationPattern === id}><strong>{pattern.label}</strong><span>{pattern.phrase}</span></button>)}
            </div>
            <p className="intonation-cue"><strong>Try:</strong> &quot;{INTONATION_PATTERNS[intonationPattern].phrase}&quot; {INTONATION_PATTERNS[intonationPattern].cue}</p>
            {lastScore?.step === "speech" && lastScore.pitchTravelCents !== null && <p className="intonation-readout">Phrase movement: about {lastScore.pitchTravelCents} cents. This is information, not a grade.</p>}
          </section>}

          {lastScore && (
            <div className="score-card">
              <div className="score-ring" style={{ "--score": `${Math.min(100, (lastScore.sustainedMs ?? 0) / 30)}%` }}>
                <strong>{lastScore.sustainedMs ? `${(lastScore.sustainedMs / 1000).toFixed(1)}` : "--"}</strong>
                <span>sec held</span>
              </div>
              <div>
                <h3>{lastScore.label}</h3>
                <p>
                  {lastScore.cents !== null
                    ? `The goal is an easy, steady hold near ${lastScore.targetNote}, not perfect pitch. Keep only what felt sustainable.`
                    : "Try a longer, steadier sound so FemmeVoice has enough to work with."}
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
          <div><span>Highest explored pitch</span><strong>{dailyComparison.highNote}</strong><small>{dailyComparison.highDetail}</small></div>
          <div><span>Verified match area</span><strong>{dailyComparison.range}</strong><small>{dailyComparison.rangeDetail}</small></div>
        </div>
      </section>
      <section className="progress-dashboard" aria-label="Progress over time">
        <div className="progress-summary">
          <p className="eyebrow">Progress memory</p>
          <h2>{hasPracticeHistory ? gentleDisplay ? `Your last saved practice step was ${MODE_LABELS[progress.lastMode]}.` : `Last time you practised near ${midiToNoteName(rememberedTargetMidi)} in ${MODE_LABELS[progress.lastMode]}.` : "Your first practice is waiting for you."}</h2>
          <p>{hasPracticeHistory ? `Reliable hold area: ${formatReliableRange(progressStats.reliableLowMidi, progressStats.reliableHighMidi)}. This grows from comfortable sustained checks, not from hitting a perfect number.` : "Make one easy sound in Practice and FemmeVoice will begin a dated record of what you explored and held."}</p>
          <div className="measurement-explainer"><CheckCircle2 /><span>Explored pitch records a short steady sound. Verified holds need a longer comfortable check before FemmeVoice offers the next reference.</span></div>
          <span className={syncStatus === "synced" ? "sync-pill synced" : "sync-pill"}>
            {syncStatus === "synced" ? authInfo.authenticated ? "Account progress synced" : "Anonymous cloud synced" : syncStatus === "syncing" ? "Syncing progress" : "Saved on this device"}
          </span>
        </div>
        <div className="progress-stats">
          <ProgressStat icon={<Trophy />} label="Practice days" value={progress.totalPracticeDays} detail={`${progressStats.streak} day streak`} />
          <ProgressStat icon={<Target />} label="Practice checks" value={progress.totalAttempts} detail="Each one is a chance to find an easier hold" />
          <ProgressStat icon={<Gauge />} label="Reliable match area" value={formatReliableRange(progressStats.reliableLowMidi, progressStats.reliableHighMidi)} detail={progressStats.bestSpan ? `${progressStats.bestSpan} semitones across verified checks` : "Complete a sustained match to map this"} />
        </div>
        <div className="history-bars" aria-label="Recent practice history">
          {progressStats.daysForChart.map((day) => <div className="history-day" key={day.date}><span style={{ height: `${day.height}%` }} /><small>{day.label}</small></div>)}
        </div>
      </section>
      <section className="range-history" aria-label="Dated voice range history">
        <div><p className="eyebrow">Your practice by day</p><h2>Range, time, and private recordings in one place.</h2><p>Open a day to see the sounds you explored, time spent training, and any recordings you deliberately saved.</p></div>
        {datedProgressHistory.length ? <ol className="day-history-list">{datedProgressHistory.map((day) => {
          const recordings = recordingsByDate.get(day.date) ?? [];
          const trainingSeconds = day.seconds ?? (day.minutes ?? 0) * 60;
          return <li key={day.date}>
            <details>
              <summary>
                <time dateTime={day.date}>{formatHistoryDate(day.date)}</time>
                <span><strong>{formatTrainingTime(trainingSeconds)}</strong><small>{recordings.length ? `${recordings.length} private recording${recordings.length === 1 ? "" : "s"}` : "No private recordings saved"}</small></span>
              </summary>
              <div className="history-day-details">
                <div className="history-measurements">
                  <p><strong>Explored pitch</strong>{day.highMidi === null ? "No steady pitch saved" : formatReliableRange(day.lowMidi, day.highMidi)}</p>
                  <p><strong>Verified match</strong>{day.comfortHighMidi === null ? "No verified match yet" : `${formatReliableRange(day.comfortLowMidi, day.comfortHighMidi)}${day.comfort ? ` · Felt ${day.comfort}` : ""}`}</p>
                </div>
                {recordings.length > 0 ? <div className="history-recordings">
                  <div><strong>Private recordings</strong><small>Encrypted and only playable after you unlock your vault.</small></div>
                  {recordings.map((recording) => <div className="history-recording" key={recording.recording_id || recording.id}>
                    <span><strong>{recording.label}</strong><small>{Math.max(1, Math.round(recording.duration_ms / 1000))} sec</small></span>
                    <button onClick={() => playPrivateRecording(recording)} disabled={playingRecording === (recording.recording_id || recording.id)}>{playingRecording === (recording.recording_id || recording.id) ? "Playing..." : "Play"}</button>
                    <button className="icon-action" onClick={() => removePrivateRecording(recording)} aria-label={`Delete ${recording.label}`}><Trash2 /></button>
                  </div>)}
                </div> : <p className="history-no-recordings">No private recordings saved for this day. Recording stays off until you choose to save something.</p>}
              </div>
            </details>
          </li>;
        })}</ol> : <p className="muted">Your dated history begins after your first timed practice, steady sound, or saved recording.</p>}
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
        <p className="vault-empty">Your saved recordings appear under their practice day above. Unlock your private vault in Settings before recording or playing a clip.</p>
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

        <a className="community-link" href="https://discord.gg/Vh5N2WEJtU" target="_blank" rel="noreferrer"><MessageCircle /><span><strong>FemmeVoice community</strong><small>Ask questions, share what you are learning, and help shape the app.</small></span><ExternalLink /></a>

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

      {activeView === "academy" && <AcademyView
        courseSlug={academyCourseSlug}
        lessonSlug={academyLessonSlug}
        onOpenCourse={navigateToAcademy}
        onBack={() => navigateToAcademy()}
      />}

      {activeView === "guide" && <section className="research-guide" aria-label="FemmeVoice evidence guide">
        <div className="guide-heading">
          <div>
            <p className="eyebrow">Evidence guide</p>
            <h2>Research, translated into human practice.</h2>
            <p>This guide explains the ideas behind FemmeVoice, the limits of its measurements, and the sources we use. It is a living public document, not medical advice or a rulebook for how anyone should sound.</p>
          </div>
          <ScrollText />
        </div>

        <nav className="guide-toc" aria-label="Guide contents">
          <strong>Contents</strong>
          <ol>{RESEARCH_GUIDE.map((chapter, index) => <li key={chapter.id}><a href={`#${chapter.id}`}>{index + 1}. {chapter.topic}</a></li>)}</ol>
        </nav>

        <div className="guide-cards">
          {RESEARCH_GUIDE.map((chapter) => <article className="guide-card" id={chapter.id} key={chapter.id}>
            <p className="eyebrow">{chapter.topic}</p>
            <h3>{chapter.takeaway}</h3>
            <div className="guide-card-copy"><strong>Try this</strong><p>{chapter.practice}</p></div>
            <div className="guide-card-limit"><strong>Keep in mind</strong><p>{chapter.limit}</p></div>
            {chapter.sources.length > 0 && <div className="guide-card-sources"><strong>Sources</strong>{chapter.sources.map((source) => <a href={source.href} key={source.href} target="_blank" rel="noreferrer">{source.label} <ExternalLink /></a>)}</div>}
          </article>)}
        </div>

        <section className="contribution-panel" aria-label="Contribute to this guide">
          <div>
            <p className="eyebrow">Help improve this guide</p>
            <h3>Knowledge gets better when people can question it.</h3>
            <p>Suggest a source, flag wording that feels unclear or harmful, share a community resource, or improve the guide directly. We welcome lived experience alongside research, and label each clearly.</p>
          </div>
          <div className="contribution-actions">
            <a href="https://github.com/botsarefuture/FemmeVoice/blob/main/docs/research-guide.md" target="_blank" rel="noreferrer">Read the full guide <ExternalLink /></a>
            <a href="https://github.com/botsarefuture/FemmeVoice/issues/new?template=research-source.yml" target="_blank" rel="noreferrer">Suggest a source <ExternalLink /></a>
            <a href="https://github.com/botsarefuture/FemmeVoice/pulls" target="_blank" rel="noreferrer">Open a pull request <ExternalLink /></a>
            <a href="https://discord.gg/Vh5N2WEJtU" target="_blank" rel="noreferrer">Discuss in the community <MessageCircle /></a>
          </div>
          <small>Please include a direct link, describe what it supports, name conflicts of interest where known, and avoid advice that asks people to force or manually manipulate the larynx.</small>
        </section>
      </section>}

      {activeView === "account" && <>
      <section className="account-page" aria-label="Account settings">
        <div>
          <p className="eyebrow">Account & settings</p>
          <h2>{authInfo.authenticated ? `Hi, ${authInfo.user?.display_name || authInfo.user?.username}.` : "Keep your practice yours."}</h2>
          <p>{authInfo.authenticated ? "Your progress is synced privately. Start here whenever you want to change how FemmeVoice works for you." : "Create an account to keep your training history across devices. Email is optional and only needed for recovery or reminders."}</p>
        </div>
        <div className="account-page-actions">
          {authInfo.authenticated ? <button className="auth-action" onClick={signOut}>Sign out</button> : <><button className="primary-action" onClick={() => setAccountMode("register")}>Create account</button><button className="auth-action" onClick={() => setAccountMode("login")}>Sign in</button></>}
          {!authInfo.authenticated && <a className="migration-link" href="/api/auth/migration">Already used LuovaAuth? Transfer that training account before 1 Aug 2026</a>}
        </div>
      </section>
      <nav className="account-shortcuts" aria-label="Account links">
        <button onClick={() => navigateTo("feedback")}><MessageCircle /> Share feedback</button>
        <button onClick={() => navigateTo("privacy")}><ShieldCheck /> Privacy policy</button>
        {authInfo.user?.is_admin && <button onClick={() => navigateTo("admin-feedback")}><Inbox /> Feedback inbox</button>}
      </nav>

      {authInfo.authenticated && <section className="settings-band account-security" aria-label="Account and data controls">
        <div>
          <p className="eyebrow">Account safety</p>
          <h3>Your data is in your hands</h3>
          <p>Export the account and progress we hold for you, or permanently delete your FemmeVoice account and synced progress.</p>
        </div>
        <div>
          <button className="auth-action" onClick={downloadPersonalData}>Download my data</button>
          <button className="danger-action" onClick={erasePersonalData}>Delete account and data</button>
        </div>
        {privacyStatus && <p className="privacy-status">{privacyStatus}</p>}
      </section>}

      {authInfo.authenticated && <section className="settings-band" aria-label="Recovery email settings">
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

      {authInfo.authenticated && <section className="settings-band" aria-label="Practice reminder settings">
        <div>
          <p className="eyebrow">Practice reminders</p>
          <h3>Make practice easier to remember</h3>
          <p>{authInfo.user?.email_verified ? "Choose days and a time that fit your life. Reminders are opt-in, arrive near your local time, and stay quiet after you have already practised that day." : "Verify a recovery email first. FemmeVoice will never send practice reminders until you explicitly turn them on."}</p>
        </div>
        {authInfo.user?.email_verified ? <form className="email-form reminder-form" onSubmit={updateReminderSettings}>
          <label className="checkbox-row"><input type="checkbox" checked={reminderSettings.enabled} onChange={(event) => setReminderSettings((current) => ({ ...current, enabled: event.target.checked }))} /> Send me practice reminders</label>
          <label>Time<input type="time" value={reminderSettings.time} onChange={(event) => setReminderSettings((current) => ({ ...current, time: event.target.value }))} disabled={!reminderSettings.enabled || reminderSubmitting} /></label>
          <label>Reminder style<select value={reminderSettings.tone} onChange={(event) => setReminderSettings((current) => ({ ...current, tone: event.target.value }))} disabled={!reminderSettings.enabled || reminderSubmitting}><option value="gentle">Gentle and no-pressure</option><option value="steady">Steady practice cue</option><option value="encouraging">Encouraging nudge</option></select></label>
          <fieldset className="reminder-days" disabled={!reminderSettings.enabled || reminderSubmitting}><legend>Reminder days</legend><div>{REMINDER_DAYS.map((day) => <label key={day.value}><input type="checkbox" checked={reminderSettings.days.includes(day.value)} onChange={(event) => setReminderSettings((current) => ({ ...current, days: event.target.checked ? [...current.days, day.value].sort((a, b) => a - b) : current.days.filter((value) => value !== day.value) }))} /> {day.label}</label>)}</div></fieldset>
          <small className="reminder-help">No email is sent after FemmeVoice has already saved practice for that local day.</small>
          <button className="primary-action" disabled={reminderSubmitting || (reminderSettings.enabled && reminderSettings.days.length === 0)}>{reminderSubmitting ? "Saving..." : "Save reminder"}</button>
        </form> : null}
        {reminderStatus && <p className="privacy-status">{reminderStatus}</p>}
      </section>}

      {authInfo.authenticated && <section className="settings-band private-vault-settings" aria-label="Private recording vault">
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

      <section className="preferences-section" aria-label="Practice preferences">
        <div className="preferences-heading"><div><p className="eyebrow">Practice preferences</p><h2>Make FemmeVoice fit you.</h2><p>These choices change your own practice experience. They are not measurements of your voice or identity.</p></div><KeyRound /></div>
      <div className="account-settings-grid">
        <article>
          <p className="eyebrow">Profile</p>
          <h3>FemmeVoice identity</h3>
          <dl><div><dt>Username</dt><dd>{authInfo.user?.username || "Local practice"}</dd></div><div><dt>Progress</dt><dd>{authInfo.authenticated ? (syncStatus === "synced" ? "Account synced" : "Syncing") : "This device"}</dd></div></dl>
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
          <p className="eyebrow">Learning history</p>
          <h3>How long should FemmeVoice keep your dated range record?</h3>
          <div className="goal-options">
            {[{ value: 90, label: "3 months" }, { value: 365, label: "1 year" }, { value: 1095, label: "3 years" }, { value: 3650, label: "10 years" }].map((option) => <button className={historyRetentionDays === option.value ? "selected" : ""} key={option.value} onClick={() => setHistoryRetentionDays(option.value)} aria-pressed={historyRetentionDays === option.value}><strong>{option.label}</strong><span>{option.value === 3650 ? "Keep a long-term personal learning record." : "Older daily range entries are removed from FemmeVoice sync."}</span></button>)}
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
          <p>{autoRecord ? "Automatic recording is on: voiced practice will be encrypted and saved while your vault is unlocked." : "Automatic recording is off. FemmeVoice will not save audio unless you start a recording yourself."}</p>
          <button className="account-link" onClick={recalibrateComfortAnchor}>Recalibrate from my easy hum</button>
          <p>The next steady hum becomes your starting anchor. No preset pitch is required.</p>
        </article>
        <article>
          <p className="eyebrow">Privacy summary</p>
          <h3>What FemmeVoice remembers</h3>
          <dl><div><dt>Audio</dt><dd>Manual, or auto-record if enabled</dd></div><div><dt>Range history</dt><dd>{historyRetentionDays === 3650 ? "Up to 10 years" : `${Math.round(historyRetentionDays / 30)} months`}</dd></div><div><dt>Account & recordings</dt><dd>Until you delete them</dd></div></dl>
        </article>
      </div>
      </section>

      <button className="account-link privacy-link" onClick={() => navigateTo("privacy")}>Read the full privacy policy</button>
      <div className="app-meta-links">
        <a href="https://github.com/botsarefuture/FemmeVoice" target="_blank" rel="noreferrer"><Github /> FemmeVoice on GitHub <ExternalLink /></a>
        <p className="app-version">FemmeVoice v{APP_VERSION}</p>
      </div>
      </>}

      {activeView === "privacy" && <section className="privacy-page" aria-label="FemmeVoice privacy policy">
        <div className="privacy-policy-heading"><ShieldCheck /><div><p className="eyebrow">Privacy policy</p><h2>Your voice stays yours.</h2><p>Effective 15 July 2026. FemmeVoice is a practice companion, not a diagnostic or therapy service.</p></div></div>
        <div className="privacy-policy-text">
          <section><h3>Who is responsible</h3><p>Emilia Vuorenmaa is the controller for FemmeVoice. Contact: <a href="mailto:emilia@luova.club">emilia@luova.club</a>.</p></section>
          <section><h3>What we collect and why</h3><p>We collect the username you choose, a salted passphrase hash, optional verified recovery email, device identifier, practice progress, settings, and limited session and security data. We use this to provide your account, sync progress, keep the service secure, and send verification email only when you ask us to. We send practice reminder email only when you have explicitly enabled it in Settings, and use the saved practice date only to avoid sending a redundant reminder after you have already practised that day. Feedback is optional; we store its category, message, and submission time for up to one year so authorised FemmeVoice administrators can improve the product. The feedback inbox does not display the submitting account.</p></section>
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

      {activeView === "admin-feedback" && (authInfo.user?.is_admin ? <section className="admin-feedback-page" aria-label="Administrator feedback inbox">
        <div className="admin-feedback-heading"><Inbox /><div><p className="eyebrow">Administrator only</p><h2>Feedback inbox</h2><p>Feedback is shown without account identifiers. Treat messages as private, avoid copying them elsewhere, and use the safety category for urgent product concerns.</p></div></div>
        <div className="admin-feedback-summary"><strong>{adminFeedbackLoading ? "Loading feedback..." : `${adminFeedback.length} recent messages`}</strong><span>Newest first. FemmeVoice keeps feedback for up to one year.</span></div>
        {adminFeedbackStatus && <p className="alert">{adminFeedbackStatus}</p>}
        {!adminFeedbackLoading && !adminFeedbackStatus && <div className="admin-feedback-list">{adminFeedback.length > 0 ? adminFeedback.map((item) => <article key={item.id} className={`feedback-item feedback-${item.category}`}><div><span>{formatFeedbackCategory(item.category)}</span><time dateTime={item.created_at}>{formatFeedbackDate(item.created_at)}</time></div><p>{item.message}</p></article>) : <p className="admin-feedback-empty">No feedback has been received yet.</p>}</div>}
      </section> : <section className="admin-feedback-page"><h2>Administrator access required</h2><p>This area is not available for this account.</p></section>)}

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
  const reliableDays = progress.days.filter((day) => Number.isFinite(day.comfortLowMidi) && Number.isFinite(day.comfortHighMidi));
  const reliableLowMidi = reliableDays.length ? Math.min(...reliableDays.map((day) => day.comfortLowMidi)) : null;
  const reliableHighMidi = reliableDays.length ? Math.max(...reliableDays.map((day) => day.comfortHighMidi)) : null;
  const bestSpan = semitoneSpan(reliableLowMidi, reliableHighMidi);
  const scoredDays = progress.days.filter((day) => day.bestScore !== null);
  const recentScores = scoredDays.slice(0, 7).map((day) => day.bestScore);
  const averageScore = recentScores.length
    ? Math.round(recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length)
    : 0;
  const daysForChart = buildDayChart(progress.days);
  return {
    bestSpan,
    reliableLowMidi,
    reliableHighMidi,
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
    comfortLowMidi: todaySession.comfortLowMidi,
    comfortHighMidi: todaySession.comfortHighMidi,
  };
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = [
    yesterdayDate.getFullYear(),
    String(yesterdayDate.getMonth() + 1).padStart(2, "0"),
    String(yesterdayDate.getDate()).padStart(2, "0"),
  ].join("-");
  const yesterdayRecord = days.find((day) => day.date === yesterdayKey);
  const yesterday = yesterdayRecord ? {
    lowMidi: yesterdayRecord.comfortLowMidi,
    highMidi: yesterdayRecord.comfortHighMidi,
  } : null;
  const verifiedRange = semitoneSpan(today.comfortLowMidi, today.comfortHighMidi);
  const base = {
    highNote: today.highMidi === null ? "--" : midiToNoteName(today.highMidi),
    highDetail: today.highMidi === null ? "Make a short steady sound to map it" : "Captured from a short, steady sound",
    range: formatReliableRange(today.comfortLowMidi, today.comfortHighMidi),
    rangeDetail: verifiedRange ? "Successful match area" : today.comfortHighMidi === null ? "Complete a target match to map it" : "One verified note so far",
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

function formatReliableRange(lowMidi, highMidi) {
  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) return "--";
  if (lowMidi === highMidi) return midiToNoteName(highMidi);
  return formatRange(lowMidi, highMidi);
}

function formatPitchPosition(midi) {
  if (!Number.isFinite(midi)) return "--";
  const nearest = Math.round(midi);
  const cents = Math.round((midi - nearest) * 100);
  if (Math.abs(cents) < 10) return midiToNoteName(nearest);
  return `${midiToNoteName(nearest)} ${cents > 0 ? "+" : ""}${cents}c`;
}

function formatStorage(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatHistoryDate(date) {
  if (date === "undated") return "Earlier recordings";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function recordingDateKey(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "undated";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTrainingTime(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds ?? 0));
  if (!safeSeconds) return "No timed practice";
  if (safeSeconds < 60) return `${safeSeconds} sec of practice`;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes} min${remainder ? ` ${remainder} sec` : ""} of practice`;
}

function formatReminderDays(days) {
  const selected = REMINDER_DAYS.filter((day) => days.includes(day.value));
  if (selected.length === REMINDER_DAYS.length) return "every day";
  if (selected.length === 5 && selected.every((day) => day.value < 5)) return "weekdays";
  return selected.map((day) => day.label).join(", ");
}

function formatFeedbackCategory(category) {
  return ({ idea: "Feature idea", bug: "Bug", resource: "Resource", safety: "Safety", other: "Other" })[category] ?? "Feedback";
}

function formatFeedbackDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
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

function getTargetExplanation({ exerciseMode, targetIndex, comfortAnchorMidi, targetMidi, lastScore, practiceStyle }) {
  if (exerciseMode === "resonance-step") {
    return {
      title: `A steady reference at ${midiToNoteName(targetMidi)}`,
      text: "This note is only an anchor so you can hear changes in brightness without changing everything at once.",
      change: practiceStyle === "free" ? "This target follows the highest easy note you mapped today. Change it manually whenever it stops feeling easy." : "This target follows the highest easy note you mapped today. Keep it only while it feels easy.",
    };
  }
  if (exerciseMode === "speech-floor") {
    return {
      title: `Start speech around ${midiToNoteName(targetMidi)}, not your lowest note`,
      text: "Speech naturally moves around. This uses your easy-hum or verified area and never treats a low range boundary as a speech starting point.",
      change: "D3 is the lowest FemmeVoice will show as a speech reference. You do not need to hold speech flat or force yourself to reach any number.",
    };
  }
  const base = comfortAnchorMidi === null ? "a gentle starter note" : `your easy-hum anchor, ${midiToNoteName(comfortAnchorMidi)}`;
  if (lastScore?.matched) {
    return {
      title: `One small step above ${base}`,
      text: "You made a close, steady match, so the ladder offered the next small interval. It is an invitation, not a requirement.",
      change: practiceStyle === "free" ? "The reference changes after a comfortable hold, or when you press the arrow buttons. Go back any time." : "The reference changes after a comfortable hold. It is always okay to pause or return to a gentler sound.",
    };
  }
  return {
    title: `Starting from ${base}`,
    text: "The app waits for an easy hum, then begins just a little above it. It is training control and comfort before range.",
    change: targetIndex === 0
      ? "Give the mic a few seconds of a clear, easy hum. A comfortable hold offers one small step upward."
      : practiceStyle === "free" ? "The reference changes after a comfortable hold, or when you press the arrow buttons. Go back any time." : "The reference changes after a comfortable hold. It is always okay to pause or return to a gentler sound.",
  };
}

function getBeginnerInstruction({ activeStep, listening, current, currentCents, recordingAttempt, lastScore }) {
  if (!listening) {
    return {
      title: "Start with one tiny, comfortable sound.",
      text: "You do not need to know your range yet. The app will detect notes as you hum and will keep today’s comfortable range for you.",
      action: "First move: press Hold near the reference for 3 seconds.",
      why: "Your browser will ask for microphone permission. Your audio stays in the browser.",
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
