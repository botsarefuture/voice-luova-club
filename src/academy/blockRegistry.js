export const BLOCK_TYPES = Object.freeze([
  "text",
  "rich_text",
  "image",
  "video",
  "audio",
  "reflection",
  "quiz",
  "interactive_exercise",
  "reading",
  "conversation_prompt",
  "recording",
  "resource_download",
  "checkpoint",
  "why_this",
]);

export const BLOCK_DEFINITIONS = Object.freeze({
  text: { label: "Text", interactive: false },
  rich_text: { label: "Rich text", interactive: false },
  image: { label: "Image", interactive: false, requiresAlternative: true },
  video: { label: "Video", interactive: false, requiresTranscript: true, requiresCaptions: true },
  audio: { label: "Audio", interactive: false, requiresTranscript: true },
  reflection: { label: "Reflection", interactive: true },
  quiz: { label: "Quiz", interactive: true },
  interactive_exercise: { label: "Interactive exercise", interactive: true },
  reading: { label: "Reading passage", interactive: true },
  conversation_prompt: { label: "Conversation prompt", interactive: true },
  recording: { label: "Recording activity", interactive: true, recordingOptional: true },
  resource_download: { label: "Resource download", interactive: false },
  checkpoint: { label: "Checkpoint", interactive: false },
  why_this: { label: "Why this? evidence panel", interactive: false },
});

export function getBlockDefinition(type) {
  return BLOCK_DEFINITIONS[type] ?? null;
}
