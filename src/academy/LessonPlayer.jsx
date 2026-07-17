import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CirclePause, Play, ShieldCheck } from "lucide-react";
import { BlockRenderer } from "./BlockRenderer";
import { advanceLessonProgress, canCompleteBlock, createLessonProgress, createLessonResumeStore, moveLessonProgress } from "./lessonProgress";
import { normalizeLesson, validateLesson } from "./schema";

export default function LessonPlayer({ lesson: lessonSource, courseTitle = "Academy", onExit }) {
  const lesson = useMemo(() => normalizeLesson(lessonSource), [lessonSource]);
  const validation = useMemo(() => validateLesson(lesson), [lesson]);
  const resumeStore = useMemo(() => createLessonResumeStore(), []);
  const [lessonState, setLessonState] = useState({ blockIndex: 0, completedBlockIds: [], isComplete: false });
  const [responses, setResponses] = useState({});
  const [paused, setPaused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const lessonHeadingRef = useRef(null);
  const completionHeadingRef = useRef(null);

  useEffect(() => {
    setHydrated(false);
    const resume = resumeStore.load(lesson);
    setLessonState(createLessonProgress(lesson, resume ?? {}));
    setResponses({});
    setPaused(false);
    setHydrated(true);
  }, [lesson.id, lesson.version, resumeStore]);

  useEffect(() => {
    if (hydrated) resumeStore.save(lesson, lessonState);
  }, [hydrated, lesson, lessonState, resumeStore]);

  const progress = useMemo(() => createLessonProgress(lesson, lessonState), [lesson, lessonState]);
  const currentBlock = lesson.blocks[progress.blockIndex];
  const response = responses[currentBlock?.id] ?? {};
  const canContinue = currentBlock ? canCompleteBlock(currentBlock, response) : false;

  useEffect(() => {
    if (hydrated && !progress.isComplete) lessonHeadingRef.current?.focus({ preventScroll: true });
  }, [hydrated, lesson.id, lesson.version, progress.isComplete]);

  useEffect(() => {
    if (hydrated && progress.isComplete) completionHeadingRef.current?.focus({ preventScroll: true });
  }, [hydrated, progress.isComplete]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (["input", "textarea", "select", "button"].includes(tag) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" && progress.blockIndex > 0) setLessonState((state) => moveLessonProgress(lesson, state, -1));
      if (event.key === "ArrowRight" && canContinue && !paused) advance();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canContinue, paused, progress.blockIndex]);

  if (!validation.valid) {
    return <section className="lesson-player lesson-error" role="alert"><h2>This lesson needs an update.</h2><p>FemmeVoice will not show incomplete learning content.</p><ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul><button type="button" className="auth-action" onClick={onExit}><ArrowLeft /> Back to Academy</button></section>;
  }

  function updateResponse(nextResponse) {
    setResponses((current) => ({ ...current, [currentBlock.id]: { ...(current[currentBlock.id] ?? {}), ...nextResponse } }));
  }

  function advance() {
    if (!canContinue || paused) return;
    setLessonState((state) => advanceLessonProgress(lesson, state));
  }

  if (progress.isComplete) {
    return <section className="lesson-player lesson-complete" aria-labelledby="lesson-complete-title"><CheckCircle2 aria-hidden="true" /><p className="eyebrow">Lesson complete</p><h2 id="lesson-complete-title" ref={completionHeadingRef} tabIndex="-1">{lesson.metadata.completionMessage ?? "You reached the end of this lesson."}</h2><p>You can return to the course now, or take a break. Nothing needs to be repeated today.</p><button type="button" className="auth-action" onClick={onExit}><ArrowLeft /> Back to {courseTitle}</button></section>;
  }

  return <section className="lesson-player" aria-labelledby="lesson-player-title" tabIndex="-1">
    <header className="lesson-player-header">
      <button type="button" className="academy-back" onClick={onExit}><ArrowLeft /> Back to {courseTitle}</button>
      <p className="eyebrow">{courseTitle}</p>
      <h2 id="lesson-player-title" ref={lessonHeadingRef} tabIndex="-1">{lesson.title}</h2>
      <p>{lesson.objective}</p>
      <div className="lesson-progress-row"><div className="lesson-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.percentage} aria-valuetext={`Step ${progress.currentBlock} of ${progress.totalBlocks}`}><span style={{ width: `${progress.percentage}%` }} /></div><span>Step {progress.currentBlock} of {progress.totalBlocks}</span></div>
    </header>
    <aside className="lesson-safety"><ShieldCheck aria-hidden="true" /><div><strong>{lesson.safety.note}</strong><p>{lesson.safety.lowerIntensityAlternative}</p></div></aside>
    <p className="sr-only" aria-live="polite">{paused ? "Lesson paused." : `Step ${progress.currentBlock} of ${progress.totalBlocks}: ${currentBlock.metadata.title}.`}</p>
    <BlockRenderer block={currentBlock} lesson={lesson} response={response} onResponse={updateResponse} paused={paused} />
    <footer className="lesson-player-controls" aria-label="Lesson controls">
      <button type="button" className="secondary-action" disabled={progress.blockIndex === 0 || paused} onClick={() => setLessonState((state) => moveLessonProgress(lesson, state, -1))}><ArrowLeft /> Previous</button>
      <button type="button" className="lesson-pause" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? <Play /> : <CirclePause />}<span>{paused ? "Resume" : "Pause"}</span></button>
      <button type="button" className="primary-action" disabled={!canContinue || paused} onClick={advance}>{progress.blockIndex === progress.totalBlocks - 1 ? "Finish lesson" : "Continue"}<ArrowRight /></button>
    </footer>
    {!canContinue && <p className="lesson-requirement" role="status">{completionHint(currentBlock)}</p>}
  </section>;
}

function completionHint(block) {
  if (block.completion.kind === "response") return "Add a reflection to continue, or go back if you want to change your answer.";
  if (block.completion.kind === "quiz") return "Choose an answer to continue.";
  if (block.completion.kind === "activity") return "Mark the activity as tried to continue.";
  return "This step is not ready to continue yet.";
}
