import { LESSON_SCHEMA_VERSION } from "../schema.js";

const COMMON_METADATA = {
  programId: "gender-affirming-voice",
  pathIds: ["foundations"],
  unitId: "arrival-and-listening",
  status: "available",
};

const COMMON_SAFETY = {
  note: "Nothing here needs to be pushed, held, recorded, or completed perfectly.",
  stopSignals: ["pain", "persistent hoarseness", "unusual fatigue", "difficulty breathing or swallowing"],
  lowerIntensityAlternative: "You can choose the listening-only route, repeat an easier activity, or stop for today. The lesson still counts as yours.",
};

const VOICE_HEALTH_EVIDENCE = {
  id: "voice-health",
  label: "Comfort, rest, and responding to worrying voice changes",
  level: "Clinical consensus",
  citation: "UCSF Gender Affirming Health Program, Vocal health; NIDCD, Taking care of your voice.",
  limitation: "This is general voice-care guidance, not a diagnosis or personal medical advice.",
  reviewedAt: "2026-07-17",
  reviewerRole: "Content editor",
  conflictOfInterest: "None declared.",
};

const GOAL_LED_EVIDENCE = {
  id: "goal-led-communication",
  label: "Goal-led gender-affirming voice and communication",
  level: "Clinical consensus",
  citation: "American Speech-Language-Hearing Association, Gender affirming voice and communication.",
  limitation: "People, languages, cultures, and communication goals differ. This does not define a correct or feminine voice.",
  reviewedAt: "2026-07-17",
  reviewerRole: "Content editor",
  conflictOfInterest: "None declared.",
};

const MULTIDIMENSIONAL_EVIDENCE = {
  id: "multidimensional-voice",
  label: "Voice perception and training are multidimensional",
  level: "Moderate evidence",
  citation: "Papp (2018), Voice, articulation, and prosody in gender perception; systematic reviews in the FemmeVoice Research Guide (R3, R4, R8).",
  limitation: "Studies are limited and often context-specific. No single feature predicts how every listener will perceive a voice.",
  reviewedAt: "2026-07-17",
  reviewerRole: "Content editor",
  conflictOfInterest: "None declared.",
};

export const FOUNDATIONS_LESSONS = [
  {
    schemaVersion: LESSON_SCHEMA_VERSION,
    id: "foundations-welcome",
    slug: "welcome-to-femmevoice",
    version: 1,
    locale: "en",
    translations: [],
    title: "Welcome to FemmeVoice",
    objective: "Choose a gentle starting point and learn what this space is for.",
    metadata: { ...COMMON_METADATA, estimatedMinutes: 8, completionMessage: "You chose a direction for your learning. That is a real first step." },
    accessibility: { alternative: "All activities in this lesson are available in text and do not need a microphone." },
    safety: COMMON_SAFETY,
    evidence: [GOAL_LED_EVIDENCE],
    blocks: [
      block("welcome", "rich_text", "Arrive", "You do not have to sound any particular way today.", 2, { kind: "manual" }, {
        nodes: [
          paragraph("FemmeVoice is a private place to ", strong("listen, experiment, and keep what feels useful"), ". It is not a test of your identity."),
          paragraph("You can use the microphone later, or never. You can pause halfway through. A quiet, curious start is enough."),
        ],
      }, ["goal-led-communication"]),
      block("choose-a-direction", "reflection", "Choose", "What would you like to have more of in your voice or communication?", 2, { kind: "response", minLength: 1 }, { prompt: "What would you like to have more of in your voice or communication? A few words are enough; “not sure” is welcome." }, []),
      block("what-to-expect", "text", "Understand", "What FemmeVoice can and cannot do", 1, { kind: "manual" }, {
        text: "This app can help you notice limited sound information, such as pitch and steadiness when you choose to use a microphone. It cannot tell whether a voice is feminine, healthy, authentic, or right for you. You decide what feels comfortable and worth keeping.",
      }, ["goal-led-communication"]),
      block("why-goals", "why_this", "Why this?", "Why begin with your own goal?", 1, { kind: "optional" }, {
        prompt: "Voice and communication work is most useful when it follows the person’s context and goals, rather than a universal target.",
      }, ["goal-led-communication"]),
      block("welcome-checkpoint", "checkpoint", "Leave well", "A small first win", 1, { kind: "manual" }, {
        message: "You do not need a baseline recording or a perfect plan. You now have a private place to start noticing what you want.",
      }),
    ],
  },
  {
    schemaVersion: LESSON_SCHEMA_VERSION,
    id: "foundations-safety-and-privacy",
    slug: "safety-privacy-and-pause",
    version: 1,
    locale: "en",
    translations: [],
    title: "Safety, privacy, and pause",
    objective: "Know the limits that protect your voice and your data before you practise.",
    metadata: { ...COMMON_METADATA, estimatedMinutes: 9, completionMessage: "You know the most important rule: comfort comes before completing a screen." },
    accessibility: { alternative: "This lesson is text-based and needs no microphone, sound, or recording." },
    safety: COMMON_SAFETY,
    evidence: [VOICE_HEALTH_EVIDENCE],
    blocks: [
      block("comfort-boundary", "rich_text", "Arrive", "Comfort is a boundary, not a score.", 2, { kind: "manual" }, {
        nodes: [
          paragraph("Stop and rest for pain, persistent hoarseness, unusual fatigue, trouble breathing or swallowing, or loss of voice. FemmeVoice cannot diagnose why a symptom is happening."),
          paragraph("A lower-energy day can be a listening day, a quiet reading day, or no practice day. Nothing is lost by pausing."),
        ],
      }, ["voice-health"]),
      block("privacy-basics", "text", "Privacy", "Your voice stays yours", 1, { kind: "manual" }, {
        text: "Live pitch analysis happens in this browser when you turn on the microphone. Recording is optional and off by default. The private recording vault is a separate opt-in setting; lessons never require it.",
      }),
      block("safety-check", "quiz", "Check", "What is the kindest next step if your voice feels painful or unusually tired?", 2, { kind: "quiz" }, {
        prompt: "What is the kindest next step if your voice feels painful or unusually tired?",
        options: [
          { id: "pause", label: "Pause, rest, and use appropriate clinical support if it persists", correct: true },
          { id: "push", label: "Push through until the exercise is complete", correct: false },
          { id: "record", label: "Record more samples to prove what happened", correct: false },
        ],
        explanation: "A lesson is never worth training through pain or worrying symptoms.",
        incorrectExplanation: "Do not push through pain or record more samples to prove it. Pause, rest, and seek appropriate clinical support if symptoms persist.",
      }, ["voice-health"]),
      block("safety-reading", "reading", "Say it your way", "A short boundary to keep", 1, { kind: "activity" }, {
        passage: "I can stop, repeat, or choose an easier route. My voice does not have to earn a grade today.",
      }),
      block("safety-checkpoint", "checkpoint", "Leave well", "You are in control", 1, { kind: "manual" }, {
        message: "Use the pause button whenever you need it. FemmeVoice saves a safe place to return to on this device.",
      }),
    ],
  },
  {
    schemaVersion: LESSON_SCHEMA_VERSION,
    id: "foundations-how-voice-works",
    slug: "how-voice-learning-works",
    version: 1,
    locale: "en",
    translations: [],
    title: "How voice learning works",
    objective: "Understand the few ideas that make early practice easier to explore without chasing a single number.",
    metadata: { ...COMMON_METADATA, estimatedMinutes: 10, completionMessage: "You learned the map without turning it into a rulebook." },
    accessibility: { alternative: "The lesson describes the voice pathway in plain text as well as the illustration." },
    safety: COMMON_SAFETY,
    evidence: [MULTIDIMENSIONAL_EVIDENCE],
    blocks: [
      block("voice-is-many-cues", "rich_text", "Understand", "A voice is more than pitch.", 2, { kind: "manual" }, {
        nodes: [
          paragraph("Pitch is one part of a voice. Listeners may also notice sound colour, loudness, rhythm, word shape, and the situation. None of those things makes a voice more or less valid."),
          paragraph("Early practice works best when you change ", strong("one small thing at a time"), ": perhaps listening, then a soft sound, then a short phrase."),
        ],
      }, ["multidimensional-voice"]),
      block("voice-pathway", "image", "Illustration", "A simple sound pathway", 2, { kind: "manual" }, {
        src: "/academy/voice-pathway.jpg",
        assetRef: { id: "voice-pathway", version: 1, locale: "en" },
        caption: "Air moves from the lungs, through the throat and mouth, and becomes sound. This is a simplified orientation image, not a diagnostic anatomy diagram.",
      }, [], {
        alternative: "A simplified side-profile illustration shows teal lungs and an upward teal airflow path through the throat and mouth, with soft coral sound waves leaving the lips.",
      }),
      block("listening-before-changing", "interactive_exercise", "Try", "Listen before changing anything", 2, { kind: "activity" }, {
        instructions: "For ten quiet seconds, notice an ordinary sound around you or your own breathing. Then make one easy, everyday hum only if it feels comfortable. You are only noticing, not trying to place it anywhere.",
        actionLabel: "I noticed something",
      }, ["multidimensional-voice"]),
      block("voice-map-why", "why_this", "Why this?", "Why not begin with a target note?", 1, { kind: "optional" }, {
        prompt: "Voice work includes more than a measured pitch, and a microphone cannot decide what is comfortable or affirming for you.",
      }, ["multidimensional-voice"]),
      block("voice-map-checkpoint", "checkpoint", "Leave well", "Keep the map light", 1, { kind: "manual" }, {
        message: "You only need a few ideas for now: sound starts with air, many cues work together, and your own comfort is information.",
      }),
    ],
  },
  {
    schemaVersion: LESSON_SCHEMA_VERSION,
    id: "foundations-first-listening",
    slug: "first-listening-and-gentle-exploration",
    version: 1,
    locale: "en",
    translations: [],
    title: "First listening and gentle exploration",
    objective: "Try one small, low-pressure sound experiment and notice what it is like to return to an ordinary phrase.",
    metadata: { ...COMMON_METADATA, estimatedMinutes: 12, completionMessage: "You noticed something about your sound. That is enough for today." },
    accessibility: { alternative: "Every exercise has a listening-only option and can be completed without microphone access." },
    safety: COMMON_SAFETY,
    evidence: [VOICE_HEALTH_EVIDENCE, MULTIDIMENSIONAL_EVIDENCE],
    blocks: [
      block("arrive-gently", "rich_text", "Arrive", "Small is the point.", 2, { kind: "manual" }, {
        nodes: [
          paragraph("Choose one route: listen only; make one soft closed-mouth hum; or make a quiet ", emphasis("vvv"), " sound. Keep your everyday volume. Stop while it still feels easy."),
          paragraph("There is no target note. This is not a warmup you have to get through. It is a short experiment."),
        ],
      }, ["voice-health"]),
      block("one-easy-sound", "interactive_exercise", "Experiment", "Try one easy sound", 2, { kind: "activity" }, {
        instructions: "Pick the listening-only route or one soft sound. Notice one detail: smoothness, effort, volume, vibration, or simply that you made a choice. Then stop for a breath.",
        actionLabel: "I tried my route",
      }, ["voice-health"]),
      block("transfer-line", "reading", "Transfer", "Bring it back to words", 2, { kind: "activity" }, {
        passage: "Hey, I am here. I have time. I can keep this easy.",
      }),
      block("conversation-choice", "conversation_prompt", "Optional context", "A private phrase for real life", 1, { kind: "manual" }, {
        prompt: "Optional: type a short phrase you might use in a message, call, game, or quiet moment. You do not need to say it aloud today.",
      }),
      block("ease-reflection", "reflection", "Reflect", "How did that route feel? You can write “easy”, “unsure”, “not today”, or anything else.", 2, { kind: "response", minLength: 1 }, { prompt: "How did that route feel? You can write “easy”, “unsure”, “not today”, or anything else." }, ["voice-health"]),
      block("first-sound-why", "why_this", "Why this?", "Why stop while it feels easy?", 1, { kind: "optional" }, {
        prompt: "Short, self-regulated experiments reduce pressure and leave room to notice comfort. FemmeVoice does not claim that one sound changes a voice.",
      }, ["voice-health", "multidimensional-voice"]),
      block("first-sound-checkpoint", "checkpoint", "Leave well", "That was enough.", 1, { kind: "manual" }, {
        message: "You do not have to go higher, louder, or longer. The next lesson will build on listening, not demand a bigger sound.",
      }),
    ],
  },
];

export function getFoundationsLesson(slug) {
  return FOUNDATIONS_LESSONS.find((lesson) => lesson.slug === slug) ?? null;
}

function block(id, type, label, title, durationMinutes, completion, content = {}, evidenceRefs = [], accessibility = {}) {
  return {
    id,
    type,
    version: 1,
    metadata: { label, title },
    durationMinutes,
    completion,
    accessibility,
    safety: {},
    evidenceRefs,
    content,
  };
}

function paragraph(...children) {
  return { type: "paragraph", children: children.map((value) => typeof value === "string" ? { type: "text", value } : value) };
}

function strong(value) {
  return { type: "strong", value };
}

function emphasis(value) {
  return { type: "emphasis", value };
}
