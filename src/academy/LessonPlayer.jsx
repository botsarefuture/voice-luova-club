import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CirclePause, Play, ShieldCheck } from "lucide-react";
import { BlockRenderer } from "./BlockRenderer";
import { canCompleteBlock, createLessonResumeStore } from "./lessonProgress";
import { normalizeLesson, validateLesson } from "./schema";

export default function LessonPlayer({ lesson: lessonSource, onExit }) {
  const lesson = useMemo(() => normalizeLesson(lessonSource), [lessonSource]);
  const validation = useMemo(() => validateLesson(lesson), [lesson]);
  const resumeStore = useMemo(() => createLessonResumeStore(), []);
  const [blockIndex, setBlockIndex] = useState(0);
  const [completedBlockIds, setCompletedBlockIds] = useState([]);
  const [responses, setResponses] = useState({});
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    const resume = resumeStore.load(lesson);
    setBlockIndex(resume?.blockIndex ?? 0);
    setCompletedBlockIds(resume?.completedBlockIds ?? []);
    setResponses({});
    setPaused(false);
    setFinished(false);
    setHydrated(true);
  }, [lesson.id, lesson.version, resumeStore]);

  useEffect(() => {
    if (hydrated && !finished) resumeStore.save(lesson, { blockIndex, completedBlockIds });
  }, [blockIndex, completedBlockIds, finished, hydrated, lesson, resumeStore]);

  const currentBlock = lesson.blocks[blockIndex];
  const response = responses[currentBlock?.id] ?? {};
  const canContinue = currentBlock ? canCompleteBlock(currentBlock, response) : false;
  const progress = lesson.blocks.length ? Math.round((completedBlockIds.length / lesson.blocks.length) * 100) : 0;

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (["input", "textarea", "select", "button"].includes(tag) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" && blockIndex > 0) setBlockIndex((index) => index - 1);
      if (event.key === "ArrowRight" && canContinue && !paused) advance();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blockIndex, canContinue, paused]);

  if (!validation.valid) {
    return <section className="lesson-player lesson-error" role="alert"><h2>This lesson needs an update.</h2><p>FemmeVoice will not show incomplete learning content.</p><ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul><button type="button" className="auth-action" onClick={onExit}><ArrowLeft /> Back to Academy</button></section>;
  }

  function updateResponse(nextResponse) {
    setResponses((current) => ({ ...current, [currentBlock.id]: { ...(current[currentBlock.id] ?? {}), ...nextResponse } }));
  }

  function advance() {
    if (!canContinue || paused) return;
    setCompletedBlockIds((current) => current.includes(currentBlock.id) ? current : [...current, currentBlock.id]);
    if (blockIndex === lesson.blocks.length - 1) {
      setFinished(true);
      return;
    }
    setBlockIndex((index) => index + 1);
  }

  if (finished) {
    return <section className="lesson-player lesson-complete" aria-labelledby="lesson-complete-title"><CheckCircle2 aria-hidden="true" /><p className="eyebrow">Preview complete</p><h2 id="lesson-complete-title">You reached the end of this lesson-player preview.</h2><p>This was a technical example, not Foundations curriculum. The full learner progress system arrives in Milestone 3.</p><button type="button" className="auth-action" onClick={onExit}><ArrowLeft /> Back to Academy</button></section>;
  }

  return <section className="lesson-player" aria-labelledby="lesson-player-title">
    <header className="lesson-player-header">
      <button type="button" className="academy-back" onClick={onExit}><ArrowLeft /> Back to course</button>
      <p className="eyebrow">Lesson player preview</p>
      <h2 id="lesson-player-title">{lesson.title}</h2>
      <p>{lesson.objective}</p>
      <div className="lesson-progress-row"><div className="lesson-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><span>{blockIndex + 1} of {lesson.blocks.length}</span></div>
    </header>
    <aside className="lesson-safety"><ShieldCheck aria-hidden="true" /><div><strong>{lesson.safety.note}</strong><p>{lesson.safety.lowerIntensityAlternative}</p></div></aside>
    <p className="sr-only" aria-live="polite">{paused ? "Lesson paused." : `Step ${blockIndex + 1} of ${lesson.blocks.length}: ${currentBlock.metadata.title}.`}</p>
    <BlockRenderer block={currentBlock} lesson={lesson} response={response} onResponse={updateResponse} paused={paused} />
    <footer className="lesson-player-controls" aria-label="Lesson controls">
      <button type="button" className="secondary-action" disabled={blockIndex === 0 || paused} onClick={() => setBlockIndex((index) => index - 1)}><ArrowLeft /> Previous</button>
      <button type="button" className="lesson-pause" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? <Play /> : <CirclePause />}<span>{paused ? "Resume" : "Pause"}</span></button>
      <button type="button" className="primary-action" disabled={!canContinue || paused} onClick={advance}>{blockIndex === lesson.blocks.length - 1 ? "Finish preview" : "Continue"}<ArrowRight /></button>
    </footer>
    {!canContinue && <p className="lesson-requirement" role="status">{completionHint(currentBlock)}</p>}
  </section>;
}

function completionHint(block) {
  if (block.completion.kind === "response") return "Add a short reflection to continue, or go back if you want to change your answer.";
  if (block.completion.kind === "quiz") return "Choose an answer to continue.";
  if (block.completion.kind === "activity") return "Mark the activity as tried to continue.";
  return "This step is not ready to continue yet.";
}
