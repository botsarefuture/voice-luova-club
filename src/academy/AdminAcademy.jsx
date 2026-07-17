import { useEffect, useMemo, useState } from "react";
import { BookOpen, Eye, FilePlus2, Save, ShieldCheck } from "lucide-react";
import { listAcademyAdminLessons, loadAcademyAdminLesson, saveAcademyAdminLesson } from "../api";
import { FOUNDATIONS_LESSONS } from "./content/foundations";
import LessonPlayer from "./LessonPlayer";
import { validateLesson } from "./schema";
import { BLOCK_TYPES } from "./blockRegistry";

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

  function updateBlocks(mutator) {
    if (!parsed.lesson) return;
    const next = structuredClone(parsed.lesson);
    mutator(next.blocks);
    setDraft(JSON.stringify(next, null, 2));
  }

  function addBlock(type) {
    updateBlocks((blocks) => blocks.push(createBlock(type, blocks.length + 1)));
  }

  if (preview && parsed.lesson && validation.valid) return <LessonPlayer lesson={parsed.lesson} courseTitle="Admin preview" onExit={() => setPreview(false)} />;

  return <section className="admin-academy-page" aria-labelledby="admin-academy-title">
    <header><BookOpen aria-hidden="true" /><div><p className="eyebrow">Academy authoring</p><h2 id="admin-academy-title">Build lessons with their evidence and access needs in view.</h2><p>Roles: {roles.join(", ") || "none"}. Published revisions stay immutable; make a new version for a material change.</p></div></header>
    <div className="admin-academy-grid">
      <aside aria-label="Saved Academy revisions"><div className="admin-academy-list-heading"><h3>Revisions</h3><button type="button" className="icon-action" onClick={startFoundationsReference} aria-label="Start from the Foundations welcome lesson"><FilePlus2 /></button></div>{records.length ? <ol>{records.map((record) => <li key={`${record.lesson_id}:${record.version}`}><button type="button" onClick={() => openRecord(record)}><strong>{record.title}</strong><span>v{record.version} · {record.status}</span></button></li>)}</ol> : <p className="lesson-muted">No server drafts yet.</p>}</aside>
      <div className="admin-academy-editor">
        <label>Lesson document<textarea value={draft ?? ""} onChange={(event) => setDraft(event.target.value)} placeholder="Start from the Foundations reference lesson." spellCheck="false" rows="24" /></label>
        {parsed.lesson && <section className="admin-blocks" aria-label="Lesson block order"><div><h3>Blocks</h3><select aria-label="Add block type" defaultValue="" onChange={(event) => { if (event.target.value) { addBlock(event.target.value); event.target.value = ""; } }}><option value="">Add a block…</option>{BLOCK_TYPES.map((type) => <option value={type} key={type}>{type.replaceAll("_", " ")}</option>)}</select></div><ol>{parsed.lesson.blocks.map((block, index) => <li key={block.id}><span><strong>{index + 1}. {block.metadata?.title || block.id}</strong><small>{block.type}</small></span><div><button type="button" className="icon-action" disabled={index === 0} onClick={() => updateBlocks((blocks) => [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]])} aria-label={`Move ${block.metadata?.title || block.id} earlier`}>↑</button><button type="button" className="icon-action" disabled={index === parsed.lesson.blocks.length - 1} onClick={() => updateBlocks((blocks) => [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]])} aria-label={`Move ${block.metadata?.title || block.id} later`}>↓</button><button type="button" className="icon-action danger-action" onClick={() => updateBlocks((blocks) => blocks.splice(index, 1))} aria-label={`Remove ${block.metadata?.title || block.id}`}>×</button></div></li>)}</ol></section>}
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

function createBlock(type, index) {
  const id = `${type.replaceAll("_", "-")}-${index}`;
  const base = { id, type, version: 1, metadata: { label: "New step", title: "New lesson step" }, durationMinutes: 1, completion: { kind: "manual" }, accessibility: {}, safety: {}, evidenceRefs: [], content: {} };
  const content = { text: { text: "Write this explanation." }, reflection: { prompt: "What did you notice?" }, interactive_exercise: { instructions: "Describe the gentle activity.", actionLabel: "I tried this" }, reading: { passage: "Write a short passage." }, conversation_prompt: { prompt: "Write an optional prompt." }, recording: { prompt: "Recording is optional." }, checkpoint: { message: "Write a calm next step." }, why_this: { prompt: "Explain why this step exists." }, resource_download: { href: "#resource", label: "Resource" }, quiz: { prompt: "Write a question.", options: [{ id: "option-a", label: "Option A", correct: true }, { id: "option-b", label: "Option B", correct: false }], explanation: "Explain the answer." }, rich_text: { nodes: [{ type: "paragraph", children: [{ type: "text", value: "Write this explanation." }] }] }, image: { src: "/academy/placeholder.jpg" }, audio: { src: "/academy/placeholder.mp3" }, video: { src: "/academy/placeholder.mp4" } };
  if (type === "image") base.accessibility = { alternative: "Describe the image." };
  if (type === "audio") base.accessibility = { transcript: "Write a transcript." };
  if (type === "video") base.accessibility = { transcript: "Write a transcript.", captions: "/academy/placeholder.vtt" };
  return { ...base, content: content[type] ?? {} };
}
