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
  text: { label: "Text", interactive: false, requiredContent: ["text"] },
  rich_text: { label: "Rich text", interactive: false, requiredContent: ["nodes"] },
  image: { label: "Image", interactive: false, requiresAlternative: true },
  video: { label: "Video", interactive: false, requiresTranscript: true, requiresCaptions: true },
  audio: { label: "Audio", interactive: false, requiresTranscript: true },
  reflection: { label: "Reflection", interactive: true, requiredContent: ["prompt"] },
  quiz: { label: "Quiz", interactive: true, requiredContent: ["prompt", "options"] },
  interactive_exercise: { label: "Interactive exercise", interactive: true, requiredContent: ["instructions"] },
  reading: { label: "Reading passage", interactive: true, requiredContent: ["passage"] },
  conversation_prompt: { label: "Conversation prompt", interactive: true, requiredContent: ["prompt"] },
  recording: { label: "Recording activity", interactive: true, recordingOptional: true, requiredContent: ["prompt"] },
  resource_download: { label: "Resource download", interactive: false, requiredContent: ["href", "label"] },
  checkpoint: { label: "Checkpoint", interactive: false, requiredContent: ["message"] },
  why_this: { label: "Why this? evidence panel", interactive: false },
});

export function getBlockDefinition(type) {
  return BLOCK_DEFINITIONS[type] ?? null;
}
