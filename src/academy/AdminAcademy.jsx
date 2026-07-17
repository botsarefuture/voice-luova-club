import { useEffect, useMemo, useState } from "react";
import { BookOpen, Eye, FilePlus2, Save, ShieldCheck } from "lucide-react";
import { listAcademyAdminLessons, loadAcademyAdminLesson, saveAcademyAdminLesson } from "../api";
import { FOUNDATIONS_LESSONS } from "./content/foundations";
import LessonPlayer from "./LessonPlayer";
import { validateLesson } from "./schema";

export default function AdminAcademy({ roles }) {
  const [records, setRecords] = useState([]);
  const [draft, setDraft] = useState(null);
  const [changeNote, setChangeNote] = useState("");
  const [status, setStatus] = useState("Loading Academy revisions…");
  const [preview, setPreview] = useState(false);
  const parsed = useMemo(() => parseDraft(draft), [draft]);
  const validation = useMemo(() => parsed.lesson ? validateLesson(parsed.lesson) : { valid: false, errors: [parsed.error ?? "Choose or create a lesson draft."] }, [parsed]);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try {
      const payload = await listAcademyAdminLessons();
      setRecords(payload.lessons ?? []);
      setStatus(payload.lessons?.length ? "" : "No saved Academy revisions yet. Start with the Foundations reference lesson below.");
    } catch (error) { setStatus(error.message); }
  }

  function startFoundationsReference() {
    setDraft(JSON.stringify(FOUNDATIONS_LESSONS[0], null, 2));
    setChangeNote("Imported the current Foundations welcome lesson as an editable draft.");
    setPreview(false);
    setStatus("Foundations reference loaded. Review the evidence, safety, and accessibility fields before saving.");
  }

  async function openRecord(record) {
    try {
      const payload = await loadAcademyAdminLesson(record.lesson_id, record.version);
      setDraft(JSON.stringify(payload.lesson, null, 2));
      setChangeNote(payload.change_note ?? "");
      setPreview(false);
      setStatus(`Editing ${record.title}, version ${record.version}.`);
    } catch (error) { setStatus(error.message); }
  }

  async function saveDraft() {
    if (!parsed.lesson || !validation.valid) return;
    try {
      setStatus("Saving draft…");
      await saveAcademyAdminLesson(parsed.lesson.id, parsed.lesson.version, parsed.lesson, changeNote);
      setStatus("Draft saved. A reviewer must confirm content, research, and accessibility before it can be published.");
      refresh();
    } catch (error) { setStatus(error.message); }
  }

  if (preview && parsed.lesson && validation.valid) return <LessonPlayer lesson={parsed.lesson} courseTitle="Admin preview" onExit={() => setPreview(false)} />;

  return <section className="admin-academy-page" aria-labelledby="admin-academy-title">
    <header><BookOpen aria-hidden="true" /><div><p className="eyebrow">Academy authoring</p><h2 id="admin-academy-title">Build lessons with their evidence and access needs in view.</h2><p>Roles: {roles.join(", ") || "none"}. Published revisions stay immutable; make a new version for a material change.</p></div></header>
    <div className="admin-academy-grid">
      <aside aria-label="Saved Academy revisions"><div className="admin-academy-list-heading"><h3>Revisions</h3><button type="button" className="icon-action" onClick={startFoundationsReference} aria-label="Start from the Foundations welcome lesson"><FilePlus2 /></button></div>{records.length ? <ol>{records.map((record) => <li key={`${record.lesson_id}:${record.version}`}><button type="button" onClick={() => openRecord(record)}><strong>{record.title}</strong><span>v{record.version} · {record.status}</span></button></li>)}</ol> : <p className="lesson-muted">No server drafts yet.</p>}</aside>
      <div className="admin-academy-editor">
        <label>Lesson document<textarea value={draft ?? ""} onChange={(event) => setDraft(event.target.value)} placeholder="Start from the Foundations reference lesson." spellCheck="false" rows="24" /></label>
        <label>Change note<textarea value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="What changed, and why?" rows="3" maxLength="4000" /></label>
        <div className="admin-academy-actions"><button type="button" className="secondary-action" onClick={() => setPreview(true)} disabled={!validation.valid}><Eye /> Preview lesson</button><button type="button" className="primary-action" onClick={saveDraft} disabled={!validation.valid || !roles.includes("author")}><Save /> Save draft</button></div>
        <p className={validation.valid ? "admin-validation valid" : "admin-validation"}><ShieldCheck aria-hidden="true" />{validation.valid ? "Ready for draft save. The server will validate this shape again." : validation.errors.join(" ")}</p>
        {status && <p className="privacy-status">{status}</p>}
      </div>
    </div>
  </section>;
}

function parseDraft(value) {
  if (!value?.trim()) return { lesson: null, error: "Choose or create a lesson draft." };
  try { return { lesson: JSON.parse(value), error: null }; } catch { return { lesson: null, error: "The lesson document is not valid JSON yet." }; }
}
