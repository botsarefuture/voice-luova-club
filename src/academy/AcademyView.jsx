import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { ACADEMY_COURSES, formatCourseDuration, getAcademyCourse } from "./catalog";
import LessonPlayer from "./LessonPlayer";
import { getFoundationsLesson } from "./content/foundations";

export default function AcademyView({ courseSlug, lessonSlug, onOpenCourse, onBack }) {
  const course = courseSlug ? getAcademyCourse(courseSlug) : null;
  const lesson = courseSlug === "foundations" && lessonSlug ? getFoundationsLesson(lessonSlug) : null;

  if (course && lesson) {
    return <LessonPlayer key={`${lesson.id}:${lesson.version}`} lesson={lesson} courseTitle={course.title} onExit={() => onOpenCourse(course.slug)} />;
  }

  if (course && lessonSlug) {
    return <section className="academy-page academy-not-found" aria-labelledby="academy-not-found-title"><p className="eyebrow">Academy</p><h2 id="academy-not-found-title">That lesson is not available.</h2><p>The course map has the lessons that are ready to open.</p><button type="button" className="auth-action" onClick={() => onOpenCourse(course.slug)}><ArrowLeft /> Back to course</button></section>;
  }

  if (courseSlug && !course) {
    return (
      <section className="academy-page academy-empty" aria-labelledby="academy-not-found-title">
        <p className="eyebrow">Academy</p>
        <h2 id="academy-not-found-title">That course is not available.</h2>
        <p>It may have moved, or the link may be incomplete. The Academy home has the current course map.</p>
        <button type="button" className="auth-action" onClick={onBack}><ArrowLeft /> Academy home</button>
      </section>
    );
  }

  if (course) return <CourseOverview course={course} onBack={onBack} onOpenLesson={(nextLessonSlug) => onOpenCourse(course.slug, nextLessonSlug)} />;

  return (
    <section className="academy-page" aria-labelledby="academy-title">
      <header className="academy-heading">
        <div>
          <p className="eyebrow">FemmeVoice Academy</p>
          <h2 id="academy-title">Learn one small thing. Keep what feels like you.</h2>
          <p>Structured, research-literate voice learning that starts with your goals, your comfort, and a pace that fits real life.</p>
        </div>
        <BookOpen aria-hidden="true" />
      </header>

      <section className="academy-principles" aria-label="Academy principles">
        <article><ShieldCheck aria-hidden="true" /><strong>Comfort leads</strong><span>Pause, repeat, or take an easier route whenever you need.</span></article>
        <article><CheckCircle2 aria-hidden="true" /><strong>No perfect score</strong><span>Progress means noticing, practising, and choosing what serves you.</span></article>
        <article><Clock3 aria-hidden="true" /><strong>Made for real days</strong><span>Lessons will split into useful sessions without making you start over.</span></article>
      </section>

      <section className="academy-catalogue" aria-label="Academy courses">
        {ACADEMY_COURSES.map((item) => (
          <article className={`academy-course academy-course-${item.status}`} key={item.slug}>
            <div className="academy-course-topline"><p className="eyebrow">{item.eyebrow}</p><span>{item.status === "available" ? "Ready" : "Planned"}</span></div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <dl>
              <div><dt>For</dt><dd>{item.audience}</dd></div>
              <div><dt>Learning time</dt><dd>{formatCourseDuration(item.estimatedMinutes)}</dd></div>
              <div><dt>Evidence</dt><dd>{item.evidenceLevel}</dd></div>
            </dl>
            {item.status === "available" ? (
              <button type="button" className="primary-action" onClick={() => onOpenCourse(item.slug)}>Start Foundations <ArrowRight /></button>
            ) : (
              <p className="academy-coming-soon">This course will appear here when its lessons have been reviewed.</p>
            )}
          </article>
        ))}
      </section>

      <aside className="academy-transparency" aria-label="Academy evidence and privacy">
        <ShieldCheck aria-hidden="true" />
        <div><strong>Built in the open</strong><p>Every future lesson will show its evidence level, sources, reviewer information, and limits. Recording is never required to learn here.</p></div>
      </aside>
    </section>
  );
}

function CourseOverview({ course, onBack, onOpenLesson }) {
  return (
    <section className="academy-page academy-course-page" aria-labelledby="academy-course-title">
      <button type="button" className="academy-back" onClick={onBack}><ArrowLeft /> Academy home</button>
      <header className="academy-heading academy-course-heading">
        <div>
          <p className="eyebrow">{course.eyebrow}</p>
          <h2 id="academy-course-title">{course.title}</h2>
          <p>{course.summary}</p>
        </div>
        <div className="academy-course-meta"><span>{course.lessonCount} lessons</span><span>{formatCourseDuration(course.estimatedMinutes)}</span></div>
      </header>

      <aside className="academy-safety-note"><ShieldCheck aria-hidden="true" /><div><strong>Comfort-first course</strong><p>{course.safetyNote}</p></div></aside>

      <section className="academy-lesson-map" aria-labelledby="academy-lesson-map-title">
        <div><p className="eyebrow">Start here</p><h3 id="academy-lesson-map-title">Four gentle lessons are ready when you are.</h3><p>Each one is short, saves a safe place to return to, and works without a microphone or recording.</p></div>
        <ol>
          {course.lessons.map((lesson, index) => (
            <li key={lesson.slug}>
              <span>{index + 1}</span>
              <div><strong>{lesson.title}</strong><p>{lesson.objective}</p><small>{lesson.durationMinutes} min guided learning</small></div>
              {lesson.status === "available" ? <button type="button" className="academy-lesson-start" aria-label={`Start ${lesson.title}`} onClick={() => onOpenLesson(lesson.slug)}>Start <ArrowRight /></button> : <em>In review</em>}
            </li>
          ))}
          {Array.from({ length: Math.max(0, course.lessonCount - course.lessons.length) }, (_, index) => (
            <li className="academy-lesson-future" key={`future-${index}`}><span>{course.lessons.length + index + 1}</span><div><strong>Lesson in review</strong><p>Content, evidence, safety, and accessibility review come before release.</p></div></li>
          ))}
        </ol>
      </section>

      <aside className="academy-transparency" aria-label="Course evidence">
        <BookOpen aria-hidden="true" />
        <div><strong>{course.evidenceLevel}</strong><p>Last curriculum review: {course.lastReviewed ?? "Not scheduled"}. Learn why FemmeVoice uses a recommendation, and what it cannot promise, in the Evidence Guide.</p></div>
      </aside>
    </section>
  );
}
