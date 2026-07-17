import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Eye, FilePlus2, Save, Send, ShieldCheck, Stamp, Trash2 } from "lucide-react";
import { listAcademyAdminCourses, listAcademyAdminLessons, loadAcademyAdminLesson, publishAcademyAdminCourse, publishAcademyAdminLesson, reviewAcademyAdminCourse, reviewAcademyAdminLesson, saveAcademyAdminCourse, saveAcademyAdminLesson, submitAcademyAdminCourseForReview, submitAcademyAdminLessonForReview } from "../api";
import { ACADEMY_COURSES } from "./catalog";
import { FOUNDATIONS_LESSONS } from "./content/foundations";
import LessonPlayer from "./LessonPlayer";
import { validateLesson } from "./schema";
import { BLOCK_TYPES, getBlockDefinition } from "./blockRegistry";

const completionKinds = ["manual", "optional", "response", "quiz", "activity"];

export default function AdminAcademy({ roles }) {
  const [records, setRecords] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [courseStatus, setCourseStatus] = useState("draft");
  const [courseReview, setCourseReview] = useState({ decision: "approved", content_checked: false, research_checked: false, accessibility_checked: false, note: "" });
  const [comparison, setComparison] = useState(null);
  const [lessonStatus, setLessonStatus] = useState("draft");
  const [review, setReview] = useState({ decision: "approved", content_checked: false, research_checked: false, accessibility_checked: false, note: "" });
  const [changeNote, setChangeNote] = useState("");
  const [status, setStatus] = useState("Loading Academy revisions...");
  const [preview, setPreview] = useState(false);
  const [advancedJson, setAdvancedJson] = useState("");
  const validation = useMemo(() => lesson ? validateLesson(lesson) : { valid: false, errors: ["Choose or create a lesson draft."] }, [lesson]);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try {
      const [lessonPayload, coursePayload] = await Promise.all([listAcademyAdminLessons(), listAcademyAdminCourses()]);
      setRecords(lessonPayload.lessons ?? []);
      setCourses(coursePayload.courses ?? []);
      setStatus(lessonPayload.lessons?.length ? "" : "No saved Academy revisions yet. Start with a Foundations reference lesson below.");
    } catch (error) { setStatus(error.message); }
  }

  function setLessonDraft(next, message) {
    setLesson(next);
    setAdvancedJson(JSON.stringify(next, null, 2));
    if (message) setStatus(message);
  }

  function startFoundationsReference(index = 0) {
    const reference = structuredClone(FOUNDATIONS_LESSONS[index]);
    setLessonDraft(reference, `${reference.title} loaded as an editable draft. Review its evidence, safety, and accessibility before saving.`);
    setChangeNote("Imported the current Foundations lesson as an editable draft.");
    setLessonStatus("draft");
    setReview({ decision: "approved", content_checked: false, research_checked: false, accessibility_checked: false, note: "" });
    setComparison(null);
    setPreview(false);
  }

  async function openRecord(record) {
    try {
      const payload = await loadAcademyAdminLesson(record.lesson_id, record.version);
      setLessonDraft(payload.lesson, `Editing ${record.title}, version ${record.version}.`);
      setChangeNote(payload.change_note ?? "");
      setLessonStatus(payload.status ?? "draft");
      setReview(payload.review ?? { decision: "approved", content_checked: false, research_checked: false, accessibility_checked: false, note: "" });
      setComparison(null);
      setPreview(false);
    } catch (error) { setStatus(error.message); }
  }

  async function saveDraft() {
    if (!lesson || !validation.valid) return;
    try {
      setStatus("Saving draft...");
      await saveAcademyAdminLesson(lesson.id, lesson.version, lesson, changeNote);
      setLessonStatus("draft");
      setStatus("Draft saved. A reviewer must confirm content, research, and accessibility before it can be published.");
      refresh();
    } catch (error) { setStatus(error.message); }
  }

  async function submitForReview() {
    if (!lesson || !validation.valid) return;
    try {
      setStatus("Requesting review...");
      const result = await submitAcademyAdminLessonForReview(lesson.id, lesson.version);
      setLessonStatus(result.status);
      setStatus("Review requested. The lesson stays private until a reviewer and publisher complete their checks.");
      refresh();
    } catch (error) { setStatus(error.message); }
  }

  async function completeReview() {
    if (!lesson) return;
    try {
      setStatus("Saving review...");
      const result = await reviewAcademyAdminLesson(lesson.id, lesson.version, review);
      setLessonStatus(result.status);
      setReview(result.review);
      setStatus(result.review.decision === "approved" ? "Review approved. A publisher can now publish this immutable revision." : "Changes requested. The author can revise the draft and request review again.");
      refresh();
    } catch (error) { setStatus(error.message); }
  }

  async function publishRevision() {
    if (!lesson) return;
    try {
      setStatus("Publishing revision...");
      const result = await publishAcademyAdminLesson(lesson.id, lesson.version);
      setLessonStatus(result.status);
      setStatus("Published. This revision is now immutable; create a new version for a material change.");
      refresh();
    } catch (error) { setStatus(error.message); }
  }

  function setCourseDraft(next, message) {
    setCourse(next);
    if (message) setStatus(message);
  }

  function startFoundationsCourse() {
    const reference = ACADEMY_COURSES.find((item) => item.slug === "foundations");
    setCourseDraft({
      id: reference.slug,
      slug: reference.slug,
      title: reference.title,
      summary: reference.summary,
      locale: "en",
      estimatedMinutes: reference.estimatedMinutes,
      lessonIds: reference.lessons.map((item) => item.slug),
      tags: ["foundations", "transfeminine"],
      prerequisiteCourseIds: [],
    }, "Foundations course loaded with its current lesson order.");
    setCourseStatus("draft"); setCourseReview({ decision: "approved", content_checked: false, research_checked: false, accessibility_checked: false, note: "" });
  }

  function openCourse(record) {
    setCourseDraft(structuredClone(record.course), `Editing ${record.course.title}.`);
    setCourseStatus(record.status ?? "draft"); setCourseReview(record.review ?? { decision: "approved", content_checked: false, research_checked: false, accessibility_checked: false, note: "" });
  }

  function updateCourse(mutator) {
    if (!course) return;
    const next = structuredClone(course);
    mutator(next);
    setCourseDraft(next);
  }

  async function saveCourse() {
    if (!course || !roles.includes("author")) return;
    try {
      setStatus("Saving course draft...");
      await saveAcademyAdminCourse(course.id, course);
      setCourseStatus("draft");
      setStatus("Course draft saved with its lesson order.");
      refresh();
    } catch (error) { setStatus(error.message); }
  }

  async function courseTransition(action) {
    if (!course) return;
    try {
      const result = action === "submit" ? await submitAcademyAdminCourseForReview(course.id) : action === "review" ? await reviewAcademyAdminCourse(course.id, courseReview) : await publishAcademyAdminCourse(course.id);
      setCourseStatus(result.status); if (result.review) setCourseReview(result.review); setStatus(action === "publish" ? "Course published. Learners can receive it only with its complete published lesson path." : "Course workflow updated."); refresh();
    } catch (error) { setStatus(error.message); }
  }

  function updateLesson(mutator) {
    if (!lesson) return;
    const next = structuredClone(lesson);
    mutator(next);
    setLessonDraft(next);
  }

  async function loadComparison(record) {
    if (!record) { setComparison(null); return; }
    try {
      const payload = await loadAcademyAdminLesson(record.lesson_id, record.version);
      setComparison({ record, lesson: payload.lesson, changeNote: payload.change_note ?? "" });
    } catch (error) { setStatus(error.message); }
  }

  function applyAdvancedJson() {
    try {
      const parsed = JSON.parse(advancedJson);
      setLessonDraft(parsed, "Advanced structured document applied. Review validation before saving.");
    } catch { setStatus("The advanced structured document is not valid JSON yet."); }
  }

  if (preview && lesson && validation.valid) return <LessonPlayer lesson={lesson} courseTitle="Admin preview" onExit={() => setPreview(false)} />;

  return <section className="admin-academy-page" aria-labelledby="admin-academy-title">
    <header><BookOpen aria-hidden="true" /><div><p className="eyebrow">Academy authoring</p><h2 id="admin-academy-title">Build lessons with their evidence and access needs in view.</h2><p>Roles: {roles.join(", ") || "none"}. Published revisions stay immutable; make a new version for a material change.</p></div></header>
    <div className="admin-academy-grid">
      <aside aria-label="Saved Academy revisions"><div className="admin-academy-list-heading"><h3>Revisions</h3><button type="button" className="icon-action" onClick={() => startFoundationsReference()} aria-label="Start from a Foundations lesson"><FilePlus2 /></button></div><label className="admin-reference-select">Foundations reference<select value="" onChange={(event) => event.target.value && startFoundationsReference(Number(event.target.value))}><option value="">Choose a lesson...</option>{FOUNDATIONS_LESSONS.map((reference, index) => <option value={index} key={reference.id}>{reference.title}</option>)}</select></label>{records.length ? <ol>{records.map((record) => <li key={`${record.lesson_id}:${record.version}`}><button type="button" onClick={() => openRecord(record)}><strong>{record.title}</strong><span>v{record.version} · {record.status}</span></button></li>)}</ol> : <p className="lesson-muted">No server drafts yet.</p>}</aside>
      <div className="admin-academy-editor">
        {!lesson ? <EmptyAuthoringState onStart={() => startFoundationsReference()} /> : <>
          <LessonDetails lesson={lesson} onChange={updateLesson} />
          <EvidenceEditor lesson={lesson} onChange={updateLesson} />
          <BlockEditor lesson={lesson} onChange={updateLesson} />
          <RevisionComparison lesson={lesson} records={records} comparison={comparison} onCompare={loadComparison} />
          <PublishingWorkflow lesson={lesson} lessonStatus={lessonStatus} review={review} onReviewChange={setReview} roles={roles} onSubmit={submitForReview} onReview={completeReview} onPublish={publishRevision} />
          <details className="admin-advanced-json"><summary>Advanced structured document</summary><p>Use this only for carefully reviewed schema-level changes. Normal lesson authoring happens in the forms above.</p><textarea aria-label="Advanced lesson document" value={advancedJson} onChange={(event) => setAdvancedJson(event.target.value)} rows="16" spellCheck="false" /><button type="button" className="secondary-action" onClick={applyAdvancedJson}>Apply advanced changes</button></details>
          <label>Change note<textarea value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="What changed, and why?" rows="3" maxLength="4000" /></label>
          <div className="admin-academy-actions"><button type="button" className="secondary-action" onClick={() => setPreview(true)} disabled={!validation.valid}><Eye /> Preview lesson</button><button type="button" className="primary-action" onClick={saveDraft} disabled={!validation.valid || !roles.includes("author")}><Save /> Save draft</button></div>
        </>}
        <p className={validation.valid ? "admin-validation valid" : "admin-validation"}><ShieldCheck aria-hidden="true" />{validation.valid ? "Ready for draft save. The server will validate this shape again." : validation.errors.join(" ")}</p>
        {status && <p className="privacy-status" role="status">{status}</p>}
      </div>
    </div>
    <CourseEditor course={course} records={records} courses={courses} onStart={startFoundationsCourse} onOpen={openCourse} onChange={updateCourse} onSave={saveCourse} canAuthor={roles.includes("author")} status={courseStatus} review={courseReview} onReviewChange={setCourseReview} roles={roles} onTransition={courseTransition} />
  </section>;
}

function EmptyAuthoringState({ onStart }) {
  return <section className="admin-empty-authoring"><h3>Start with a real lesson</h3><p>Load a Foundations reference to edit it through the structured authoring controls. No microphone, learner, or production content is changed until you save a draft.</p><button type="button" className="primary-action" onClick={onStart}><FilePlus2 /> Load Foundations welcome</button></section>;
}

function LessonDetails({ lesson, onChange }) {
  const update = (field, value) => onChange((next) => { next[field] = value; });
  const updateMetadata = (field, value) => onChange((next) => { next.metadata[field] = value; });
  const updateSafety = (field, value) => onChange((next) => { next.safety[field] = value; });
  const updateAccessibility = (field, value) => onChange((next) => { next.accessibility[field] = value; });
  return <section className="admin-form-section" aria-labelledby="lesson-details-title"><div><p className="eyebrow">Lesson details</p><h3 id="lesson-details-title">Give learners a clear, calm starting point.</h3></div><div className="admin-form-grid"><Field label="Lesson title" value={lesson.title} onChange={(value) => update("title", value)} required /><Field label="Slug" value={lesson.slug} onChange={(value) => update("slug", value)} required hint="Stable web identifier, for example: first-listening." /><Field label="Lesson ID" value={lesson.id} onChange={(value) => update("id", value)} required /><Field label="Version" value={lesson.version} type="number" min="1" onChange={(value) => update("version", numberOrZero(value))} required /><Field label="Locale" value={lesson.locale} onChange={(value) => update("locale", value)} required /><Field label="Estimated minutes" value={lesson.metadata.estimatedMinutes ?? ""} type="number" min="0" onChange={(value) => updateMetadata("estimatedMinutes", numberOrZero(value))} /><Field label="Learning objective" value={lesson.objective ?? ""} onChange={(value) => update("objective", value)} multiline /><Field label="Completion message" value={lesson.metadata.completionMessage ?? ""} onChange={(value) => updateMetadata("completionMessage", value)} multiline /><Field label="Tags" value={(lesson.metadata.tags ?? []).join(", ")} onChange={(value) => updateMetadata("tags", commaList(value))} hint="Comma separated. Visible only to authors for now." /><Field label="Translation locales" value={(lesson.translations ?? []).map((translation) => typeof translation === "string" ? translation : translation.locale).join(", ")} onChange={(value) => update("translations", commaList(value).map((locale) => ({ locale })))} hint="Translation-ready locale references; translated content stays in a separate revision." /></div><div className="admin-form-columns"><fieldset><legend>Voice and learner safety</legend><Field label="Safety note" value={lesson.safety.note ?? ""} onChange={(value) => updateSafety("note", value)} multiline /><Field label="Stop signals" value={(lesson.safety.stopSignals ?? []).join(", ")} onChange={(value) => updateSafety("stopSignals", commaList(value))} hint="Comma separated, e.g. pain, persistent hoarseness." /><Field label="Lower-intensity alternative" value={lesson.safety.lowerIntensityAlternative ?? ""} onChange={(value) => updateSafety("lowerIntensityAlternative", value)} multiline /></fieldset><fieldset><legend>Lesson accessibility</legend><Field label="Text alternative or access note" value={lesson.accessibility.alternative ?? ""} onChange={(value) => updateAccessibility("alternative", value)} multiline /><Field label="Reduced-motion alternative" value={lesson.accessibility.reducedMotionAlternative ?? ""} onChange={(value) => updateAccessibility("reducedMotionAlternative", value)} multiline /></fieldset></div></section>;
}

function PublishingWorkflow({ lesson, lessonStatus, review, onReviewChange, roles, onSubmit, onReview, onPublish }) {
  const canReview = roles.includes("reviewer") && lessonStatus === "review_requested";
  const canPublish = roles.includes("publisher") && lessonStatus === "in_review" && review.decision === "approved";
  const reviewComplete = review.content_checked && review.research_checked && review.accessibility_checked;
  return <section className="admin-form-section admin-publishing-workflow" aria-labelledby="publishing-title"><div><p className="eyebrow">Review and publishing</p><h3 id="publishing-title">Protect learners with a deliberate release path.</h3><p>Current revision: <strong>v{lesson.version}</strong> <span className={`academy-content-status status-${lessonStatus}`}>{formatContentStatus(lessonStatus)}</span></p></div>{lessonStatus === "published" ? <p className="admin-published-notice">This revision is published and immutable. Duplicate it with a new version before making a material change.</p> : <><div className="admin-workflow-actions">{roles.includes("author") && <button type="button" className="secondary-action" onClick={onSubmit}><Send /> Submit for review</button>}{canPublish && <button type="button" className="primary-action" onClick={onPublish}><Stamp /> Publish revision</button>}</div>{roles.includes("reviewer") && <fieldset className="admin-review-form" disabled={!canReview}><legend>Reviewer checks</legend><p>Review is available after an author submits this revision. Each check is required so evidence, access, and teaching quality are considered together.</p><label><input type="checkbox" checked={review.content_checked} onChange={(event) => onReviewChange({ ...review, content_checked: event.target.checked })} /> Content is clear, accurate, and supportive.</label><label><input type="checkbox" checked={review.research_checked} onChange={(event) => onReviewChange({ ...review, research_checked: event.target.checked })} /> Evidence references and limitations are appropriate.</label><label><input type="checkbox" checked={review.accessibility_checked} onChange={(event) => onReviewChange({ ...review, accessibility_checked: event.target.checked })} /> Accessibility alternatives are complete and usable.</label><label>Decision<select value={review.decision} onChange={(event) => onReviewChange({ ...review, decision: event.target.value })}><option value="approved">Approve for publication</option><option value="changes_requested">Request changes</option></select></label><Field label="Review note" value={review.note ?? ""} onChange={(value) => onReviewChange({ ...review, note: value })} multiline /><button type="button" className="primary-action" onClick={onReview} disabled={!canReview || !reviewComplete}><ShieldCheck /> Save review</button></fieldset>}</>}</section>;
}

function RevisionComparison({ lesson, records, comparison, onCompare }) {
  const revisions = records.filter((record) => record.lesson_id === lesson.id).sort((left, right) => right.version - left.version);
  const selectedVersion = comparison?.record.version ?? "";
  return <section className="admin-form-section admin-revision-comparison" aria-labelledby="revision-comparison-title"><div className="admin-section-heading"><div><p className="eyebrow">Revision history</p><h3 id="revision-comparison-title">Compare a saved version before you publish.</h3></div>{revisions.length > 0 && <label className="inline-select">Compare with<select value={selectedVersion} onChange={(event) => onCompare(revisions.find((record) => record.version === Number(event.target.value)))}><option value="">Choose saved version...</option>{revisions.filter((record) => record.version !== lesson.version).map((record) => <option key={record.version} value={record.version}>v{record.version} - {formatContentStatus(record.status)}</option>)}</select></label>}</div>{revisions.length === 0 ? <p className="lesson-muted">Save this draft to begin its revision history.</p> : <ol className="admin-revision-list">{revisions.map((record) => <li key={record.version}><strong>v{record.version}</strong><span>{formatContentStatus(record.status)}{record.updated_at ? ` - ${formatRevisionDate(record.updated_at)}` : ""}</span></li>)}</ol>}{comparison && <RevisionDiff current={lesson} previous={comparison.lesson} changeNote={comparison.changeNote} />}</section>;
}

function RevisionDiff({ current, previous, changeNote }) {
  const changes = [];
  addChange(changes, "Title", previous.title, current.title);
  addChange(changes, "Learning objective", previous.objective, current.objective);
  addChange(changes, "Estimated duration", previous.metadata?.estimatedMinutes, current.metadata?.estimatedMinutes);
  addChange(changes, "Safety note", previous.safety?.note, current.safety?.note);
  const previousBlockIds = previous.blocks.map((block) => block.id);
  const currentBlockIds = current.blocks.map((block) => block.id);
  if (previousBlockIds.join("|") !== currentBlockIds.join("|")) changes.push({ label: "Lesson flow", before: previousBlockIds.join(" -> ") || "No blocks", after: currentBlockIds.join(" -> ") || "No blocks" });
  if (previous.evidence.length !== current.evidence.length) changes.push({ label: "Evidence references", before: `${previous.evidence.length} linked`, after: `${current.evidence.length} linked` });
  return <div className="admin-revision-diff"><h4>Compared with v{previous.version}</h4>{changeNote && <p><strong>Saved change note:</strong> {changeNote}</p>}{changes.length ? <dl>{changes.map((change) => <div key={change.label}><dt>{change.label}</dt><dd><span>Before: {displayValue(change.before)}</span><span>Now: {displayValue(change.after)}</span></dd></div>)}</dl> : <p>No summary fields changed. Review individual block content before publishing.</p>}</div>;
}

function CourseEditor({ course, records, courses, onStart, onOpen, onChange, onSave, canAuthor, status, review, onReviewChange, roles, onTransition }) {
  const availableLessons = uniqueLessons(records);
  const savedCourseRecords = courses.filter((record) => record.course);
  const update = (field, value) => onChange((next) => { next[field] = value; });
  const moveLesson = (index, direction) => onChange((next) => { const target = index + direction; if (target < 0 || target >= next.lessonIds.length) return; [next.lessonIds[index], next.lessonIds[target]] = [next.lessonIds[target], next.lessonIds[index]]; });
  const removeLesson = (index) => onChange((next) => { next.lessonIds.splice(index, 1); });
  const addLesson = (lessonId) => onChange((next) => { if (lessonId && !next.lessonIds.includes(lessonId)) next.lessonIds.push(lessonId); });
  return <section className="admin-course-editor" aria-labelledby="admin-course-title"><div><p className="eyebrow">Course structure</p><h3 id="admin-course-title">Keep the learning path legible.</h3><p>Courses have an intentional order. Learners can pause, but authors should make the next useful step obvious.</p><button type="button" className="secondary-action" onClick={onStart}><FilePlus2 /> Load Foundations course</button>{savedCourseRecords.length > 0 && <div className="admin-saved-course-list"><strong>Saved drafts</strong>{savedCourseRecords.map((record) => <button type="button" key={record.course_id} onClick={() => onOpen(record)}>{record.course.title}<span>{record.status}</span></button>)}</div>}</div>{!course ? <div className="admin-course-empty"><p>Load the Foundations course to edit its metadata and order with structured controls.</p></div> : <div className="admin-course-form"><div className="admin-form-grid"><Field label="Course title" value={course.title} onChange={(value) => update("title", value)} required /><Field label="Slug" value={course.slug} onChange={(value) => update("slug", value)} required /><Field label="Course ID" value={course.id} onChange={(value) => update("id", value)} required /><Field label="Locale" value={course.locale} onChange={(value) => update("locale", value)} required /><Field label="Estimated minutes" value={course.estimatedMinutes} type="number" min="0" onChange={(value) => update("estimatedMinutes", numberOrZero(value))} required /><Field label="Tags" value={(course.tags ?? []).join(", ")} onChange={(value) => update("tags", commaList(value))} hint="Comma separated." /><Field label="Course summary" value={course.summary} onChange={(value) => update("summary", value)} multiline required /><Field label="Prerequisite course IDs" value={(course.prerequisiteCourseIds ?? []).join(", ")} onChange={(value) => update("prerequisiteCourseIds", commaList(value))} hint="Future-ready; not enforced for learners yet." /></div><section className="admin-course-lessons" aria-labelledby="course-lessons-title"><div className="admin-section-heading"><div><p className="eyebrow">Lesson order</p><h4 id="course-lessons-title">Build the route learners will follow.</h4></div><label className="inline-select">Add available lesson<select value="" onChange={(event) => { if (event.target.value) addLesson(event.target.value); }}><option value="">Choose a lesson...</option>{availableLessons.filter((item) => !course.lessonIds.includes(item.id)).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label></div>{course.lessonIds.length === 0 ? <p className="lesson-muted">Add at least one lesson to define this course.</p> : <ol className="admin-course-lesson-list">{course.lessonIds.map((lessonId, index) => { const item = availableLessons.find((candidate) => candidate.id === lessonId); return <li key={`${lessonId}-${index}`}><span><strong>{index + 1}. {item?.title ?? lessonId}</strong><small>{lessonId}</small></span><div><button type="button" className="icon-action" disabled={index === 0} onClick={() => moveLesson(index, -1)} aria-label={`Move ${item?.title ?? lessonId} earlier`}><ChevronUp /></button><button type="button" className="icon-action" disabled={index === course.lessonIds.length - 1} onClick={() => moveLesson(index, 1)} aria-label={`Move ${item?.title ?? lessonId} later`}><ChevronDown /></button><button type="button" className="icon-action danger-action" onClick={() => removeLesson(index)} aria-label={`Remove ${item?.title ?? lessonId} from this course`}><Trash2 /></button></div></li>; })}</ol>}</section><button type="button" className="primary-action" onClick={onSave} disabled={!canAuthor}><Save /> Save course draft</button><CourseWorkflow status={status} review={review} onReviewChange={onReviewChange} roles={roles} onTransition={onTransition} /></div>}</section>;
}

function CourseWorkflow({ status, review, onReviewChange, roles, onTransition }) { const ready = review.content_checked && review.research_checked && review.accessibility_checked; return <section className="admin-review-form"><strong>Course status: {formatContentStatus(status)}</strong>{status !== "published" && roles.includes("author") && <button type="button" className="secondary-action" onClick={() => onTransition("submit")}><Send /> Submit course for review</button>}{roles.includes("reviewer") && <><label><input type="checkbox" checked={review.content_checked} onChange={(event) => onReviewChange({ ...review, content_checked: event.target.checked })} /> Content checked</label><label><input type="checkbox" checked={review.research_checked} onChange={(event) => onReviewChange({ ...review, research_checked: event.target.checked })} /> Research checked</label><label><input type="checkbox" checked={review.accessibility_checked} onChange={(event) => onReviewChange({ ...review, accessibility_checked: event.target.checked })} /> Accessibility checked</label>{status === "review_requested" && <button type="button" className="primary-action" disabled={!ready} onClick={() => onTransition("review")}><ShieldCheck /> Approve course</button>}</>}{roles.includes("publisher") && status === "in_review" && review.decision === "approved" && <button type="button" className="primary-action" onClick={() => onTransition("publish")}><Stamp /> Publish course</button>}</section>; }

function EvidenceEditor({ lesson, onChange }) {
  const updateEvidence = (index, field, value) => onChange((next) => { next.evidence[index][field] = value; });
  const removeEvidence = (index) => onChange((next) => { const removed = next.evidence[index]?.id; next.evidence.splice(index, 1); next.blocks.forEach((block) => { block.evidenceRefs = block.evidenceRefs.filter((id) => id !== removed); }); });
  return <section className="admin-form-section" aria-labelledby="evidence-title"><div className="admin-section-heading"><div><p className="eyebrow">Research transparency</p><h3 id="evidence-title">Show why the lesson makes a recommendation.</h3></div><button type="button" className="secondary-action" onClick={() => onChange((next) => next.evidence.push({ id: `evidence-${next.evidence.length + 1}`, label: "", level: "Clinical consensus", citation: "", limitation: "" }))}>Add evidence</button></div>{lesson.evidence.length === 0 ? <p className="lesson-muted">No evidence is linked yet. Add it before giving learners a “Why this?” explanation.</p> : <div className="admin-repeater">{lesson.evidence.map((evidence, index) => <fieldset key={`${evidence.id}-${index}`}><legend>Evidence {index + 1}</legend><div className="admin-form-grid"><Field label="Reference ID" value={evidence.id} onChange={(value) => updateEvidence(index, "id", value)} required /><Field label="Short label" value={evidence.label} onChange={(value) => updateEvidence(index, "label", value)} required /><Field label="Evidence level" value={evidence.level} onChange={(value) => updateEvidence(index, "level", value)} required /><Field label="Citation" value={evidence.citation} onChange={(value) => updateEvidence(index, "citation", value)} multiline required /><Field label="Limitations" value={evidence.limitation} onChange={(value) => updateEvidence(index, "limitation", value)} multiline required /><Field label="Last reviewed" value={evidence.reviewedAt ?? ""} type="date" onChange={(value) => updateEvidence(index, "reviewedAt", value)} /><Field label="Reviewer role" value={evidence.reviewerRole ?? ""} onChange={(value) => updateEvidence(index, "reviewerRole", value)} /><Field label="Conflict of interest" value={evidence.conflictOfInterest ?? ""} onChange={(value) => updateEvidence(index, "conflictOfInterest", value)} /></div><button type="button" className="text-action danger-action" onClick={() => removeEvidence(index)}><Trash2 /> Remove evidence</button></fieldset>)}</div>}</section>;
}

function BlockEditor({ lesson, onChange }) {
  const updateBlock = (index, mutator) => onChange((next) => mutator(next.blocks[index], next));
  const moveBlock = (index, direction) => onChange((next) => { const target = index + direction; if (target < 0 || target >= next.blocks.length) return; [next.blocks[index], next.blocks[target]] = [next.blocks[target], next.blocks[index]]; });
  const removeBlock = (index) => onChange((next) => next.blocks.splice(index, 1));
  const addBlock = (type) => onChange((next) => next.blocks.push(createBlock(type, next.blocks.length + 1)));
  return <section className="admin-form-section admin-block-editor" aria-labelledby="blocks-title"><div className="admin-section-heading"><div><p className="eyebrow">Lesson flow</p><h3 id="blocks-title">One purposeful step at a time.</h3></div><label className="inline-select">Add block<select value="" onChange={(event) => { if (event.target.value) addBlock(event.target.value); }}><option value="">Choose a block...</option>{BLOCK_TYPES.map((type) => <option value={type} key={type}>{getBlockDefinition(type)?.label ?? type}</option>)}</select></label></div>{lesson.blocks.length === 0 ? <p className="lesson-muted">Add a block to begin the lesson flow.</p> : <ol className="admin-block-list">{lesson.blocks.map((block, index) => <li key={block.id}><div className="admin-block-toolbar"><span><strong>{index + 1}. {block.metadata?.title || block.id}</strong><small>{getBlockDefinition(block.type)?.label ?? block.type}</small></span><div><button type="button" className="icon-action" disabled={index === 0} onClick={() => moveBlock(index, -1)} aria-label={`Move ${block.metadata?.title || block.id} earlier`}><ChevronUp /></button><button type="button" className="icon-action" disabled={index === lesson.blocks.length - 1} onClick={() => moveBlock(index, 1)} aria-label={`Move ${block.metadata?.title || block.id} later`}><ChevronDown /></button><button type="button" className="icon-action danger-action" onClick={() => removeBlock(index)} aria-label={`Remove ${block.metadata?.title || block.id}`}><Trash2 /></button></div></div><BlockForm block={block} lessonEvidence={lesson.evidence} onChange={(mutator) => updateBlock(index, mutator)} /></li>)}</ol>}</section>;
}

function BlockForm({ block, lessonEvidence, onChange }) {
  const update = (field, value) => onChange((next) => { next[field] = value; });
  const updateMetadata = (field, value) => onChange((next) => { next.metadata[field] = value; });
  const updateContent = (field, value) => onChange((next) => { next.content[field] = value; });
  const updateSafety = (field, value) => onChange((next) => { next.safety[field] = value; });
  const updateAccess = (field, value) => onChange((next) => { next.accessibility[field] = value; });
  return <div className="admin-block-form"><div className="admin-form-grid"><Field label="Step title" value={block.metadata.title ?? ""} onChange={(value) => updateMetadata("title", value)} /><Field label="Short label" value={block.metadata.label ?? ""} onChange={(value) => updateMetadata("label", value)} /><Field label="Block ID" value={block.id} onChange={(value) => update("id", value)} required /><Field label="Duration (minutes)" value={block.durationMinutes ?? 0} type="number" min="0" onChange={(value) => update("durationMinutes", numberOrZero(value))} /><label>Completion requirement<select value={block.completion.kind} onChange={(event) => onChange((next) => { next.completion.kind = event.target.value; })}>{completionKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label><label>Evidence references<select multiple value={block.evidenceRefs ?? []} onChange={(event) => onChange((next) => { next.evidenceRefs = Array.from(event.target.selectedOptions, (option) => option.value); })}>{lessonEvidence.map((evidence) => <option key={evidence.id} value={evidence.id}>{evidence.label || evidence.id}</option>)}</select><span className="field-hint">Select all that apply.</span></label></div><BlockContentFields block={block} updateContent={updateContent} onChange={onChange} /><details className="admin-block-guidance"><summary>Safety and accessibility for this step</summary><div className="admin-form-columns"><fieldset><legend>Safety</legend><Field label="Safety note" value={block.safety.note ?? ""} onChange={(value) => updateSafety("note", value)} multiline /><Field label="Stop signals" value={(block.safety.stopSignals ?? []).join(", ")} onChange={(value) => updateSafety("stopSignals", commaList(value))} /><Field label="Lower-intensity alternative" value={block.safety.lowerIntensityAlternative ?? ""} onChange={(value) => updateSafety("lowerIntensityAlternative", value)} multiline /></fieldset><fieldset><legend>Accessibility</legend>{block.type === "image" && <Field label="Image alternative text" value={block.accessibility.alternative ?? ""} onChange={(value) => updateAccess("alternative", value)} multiline required />}{block.type === "audio" && <Field label="Audio transcript" value={block.accessibility.transcript ?? ""} onChange={(value) => updateAccess("transcript", value)} multiline required />}{block.type === "video" && <><Field label="Video transcript" value={block.accessibility.transcript ?? ""} onChange={(value) => updateAccess("transcript", value)} multiline required /><Field label="Captions URL" value={block.accessibility.captions ?? ""} onChange={(value) => updateAccess("captions", value)} required /></>}{!["image", "audio", "video"].includes(block.type) && <Field label="Access note" value={block.accessibility.alternative ?? ""} onChange={(value) => updateAccess("alternative", value)} multiline />}</fieldset></div></details></div>;
}

function BlockContentFields({ block, updateContent, onChange }) {
  const content = block.content;
  switch (block.type) {
    case "text": return <Field label="Text" value={content.text ?? ""} onChange={(value) => updateContent("text", value)} multiline required />;
    case "rich_text": return <Field label="Rich text" value={richTextToPlainText(content.nodes)} onChange={(value) => updateContent("nodes", plainTextToRichText(value))} multiline required hint="Each blank line starts a new paragraph. Use Advanced structured document only when inline formatting is needed." />;
    case "reflection":
    case "conversation_prompt":
    case "recording": return <Field label="Prompt" value={content.prompt ?? ""} onChange={(value) => updateContent("prompt", value)} multiline required />;
    case "interactive_exercise": return <div className="admin-form-grid"><Field label="Instructions" value={content.instructions ?? ""} onChange={(value) => updateContent("instructions", value)} multiline required /><Field label="Completion button" value={content.actionLabel ?? ""} onChange={(value) => updateContent("actionLabel", value)} /></div>;
    case "reading": return <Field label="Reading passage" value={content.passage ?? ""} onChange={(value) => updateContent("passage", value)} multiline required />;
    case "checkpoint": return <Field label="Checkpoint message" value={content.message ?? ""} onChange={(value) => updateContent("message", value)} multiline required />;
    case "why_this": return <Field label="Evidence explanation" value={content.prompt ?? ""} onChange={(value) => updateContent("prompt", value)} multiline />;
    case "resource_download": return <div className="admin-form-grid"><Field label="Resource label" value={content.label ?? ""} onChange={(value) => updateContent("label", value)} required /><Field label="Resource URL" value={content.href ?? ""} onChange={(value) => updateContent("href", value)} required /></div>;
    case "image": return <div className="admin-form-grid"><Field label="Image URL" value={content.src ?? ""} onChange={(value) => updateContent("src", value)} /><Field label="Caption" value={content.caption ?? ""} onChange={(value) => updateContent("caption", value)} multiline /></div>;
    case "audio":
    case "video": return <Field label={`${block.type === "audio" ? "Audio" : "Video"} URL`} value={content.src ?? ""} onChange={(value) => updateContent("src", value)} />;
    case "quiz": return <QuizFields block={block} updateContent={updateContent} onChange={onChange} />;
    default: return <p className="lesson-muted">This block does not currently need additional content.</p>;
  }
}

function QuizFields({ block, updateContent, onChange }) {
  const updateOption = (index, field, value) => onChange((next) => { next.content.options[index][field] = value; });
  return <div className="admin-repeater"><Field label="Question" value={block.content.prompt ?? ""} onChange={(value) => updateContent("prompt", value)} multiline required /><Field label="Correct-answer explanation" value={block.content.explanation ?? ""} onChange={(value) => updateContent("explanation", value)} multiline required /><Field label="Incorrect-answer safety feedback" value={block.content.incorrectExplanation ?? ""} onChange={(value) => updateContent("incorrectExplanation", value)} multiline hint="State the safe next step plainly; never imply an unsafe option is acceptable." />{(block.content.options ?? []).map((option, index) => <fieldset key={`${option.id}-${index}`}><legend>Option {index + 1}</legend><div className="admin-quiz-option"><Field label="Option label" value={option.label ?? ""} onChange={(value) => updateOption(index, "label", value)} required /><label><input type="radio" name={`${block.id}-correct`} checked={option.correct} onChange={() => onChange((next) => { next.content.options.forEach((item, optionIndex) => { item.correct = optionIndex === index; }); })} /> Correct answer</label><button type="button" className="text-action danger-action" disabled={block.content.options.length <= 2} onClick={() => onChange((next) => next.content.options.splice(index, 1))}><Trash2 /> Remove option</button></div></fieldset>)}<button type="button" className="secondary-action" onClick={() => onChange((next) => next.content.options.push({ id: `option-${next.content.options.length + 1}`, label: "", correct: false }))}>Add option</button></div>;
}

function Field({ label, value, onChange, multiline = false, hint, required = false, ...inputProps }) {
  const common = { value: value ?? "", onChange: (event) => onChange(event.target.value), required, ...inputProps };
  return <label className={multiline ? "admin-field admin-field-wide" : "admin-field"}>{label}{multiline ? <textarea {...common} rows="4" /> : <input {...common} />}{hint && <span className="field-hint">{hint}</span>}</label>;
}

function commaList(value) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function numberOrZero(value) { return value === "" ? 0 : Number(value); }
function formatContentStatus(status) { return ({ draft: "Draft", review_requested: "Review requested", in_review: "Approved for publication", published: "Published" })[status] ?? status; }
function formatRevisionDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(); }
function displayValue(value) { return value === undefined || value === null || value === "" ? "Not set" : String(value); }
function addChange(changes, label, before, after) { if (before !== after) changes.push({ label, before, after }); }
function uniqueLessons(records) {
  const staticLessons = FOUNDATIONS_LESSONS.map((lesson) => ({ id: lesson.slug, title: lesson.title }));
  const savedLessons = records.map((record) => ({ id: record.lesson_id, title: record.title }));
  return [...staticLessons, ...savedLessons].filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
}
function richTextToPlainText(nodes = []) { return nodes.map((node) => node.type === "list" ? node.items.map((item) => item.map((child) => child.value).join("")).join("\n") : (node.children ?? []).map((child) => child.value).join("")).join("\n\n"); }
function plainTextToRichText(value) { return value.split(/\n\s*\n/).map((paragraph) => ({ type: "paragraph", children: [{ type: "text", value: paragraph.trim() || " " }] })); }

function createBlock(type, index) {
  const id = `${type.replaceAll("_", "-")}-${index}`;
  const base = { id, type, version: 1, metadata: { label: "New step", title: "New lesson step" }, durationMinutes: 1, completion: { kind: "manual" }, accessibility: {}, safety: {}, evidenceRefs: [], content: {} };
  const content = { text: { text: "Write this explanation." }, reflection: { prompt: "What did you notice?" }, interactive_exercise: { instructions: "Describe the gentle activity.", actionLabel: "I tried this" }, reading: { passage: "Write a short passage." }, conversation_prompt: { prompt: "Write an optional prompt." }, recording: { prompt: "Recording is optional." }, checkpoint: { message: "Write a calm next step." }, why_this: { prompt: "Explain why this step exists." }, resource_download: { href: "#resource", label: "Resource" }, quiz: { prompt: "Write a question.", options: [{ id: "option-a", label: "Option A", correct: true }, { id: "option-b", label: "Option B", correct: false }], explanation: "Explain the answer.", incorrectExplanation: "Explain the safe next step." }, rich_text: { nodes: [{ type: "paragraph", children: [{ type: "text", value: "Write this explanation." }] }] }, image: { src: "/academy/placeholder.jpg", caption: "" }, audio: { src: "/academy/placeholder.mp3" }, video: { src: "/academy/placeholder.mp4" } };
  if (type === "image") base.accessibility = { alternative: "Describe the image." };
  if (type === "audio") base.accessibility = { transcript: "Write a transcript." };
  if (type === "video") base.accessibility = { transcript: "Write a transcript.", captions: "/academy/placeholder.vtt" };
  return { ...base, content: content[type] ?? {} };
}
