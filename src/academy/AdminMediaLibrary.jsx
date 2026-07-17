import { useEffect, useMemo, useState } from "react";
import { CopyPlus, Image as ImageIcon, Languages, Plus, Save, Send, ShieldCheck, Stamp } from "lucide-react";
import { listAcademyAdminMedia, loadAcademyAdminMedia, publishAcademyAdminMedia, reviewAcademyAdminMedia, saveAcademyAdminMedia, submitAcademyAdminMediaForReview } from "../api";
import { createBlankMediaAsset, createMediaLocalization, createNextMediaRevision, MEDIA_KINDS, validateMediaAsset } from "./mediaSchema";

const EMPTY_REVIEW = { decision: "approved", content_checked: false, research_checked: false, accessibility_checked: false, note: "" };

export default function AdminMediaLibrary({ roles }) {
  const [records, setRecords] = useState([]);
  const [asset, setAsset] = useState(null);
  const [assetStatus, setAssetStatus] = useState("draft");
  const [review, setReview] = useState(EMPTY_REVIEW);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("Loading media library...");
  const draftValidation = useMemo(() => validateMediaAsset(asset), [asset]);
  const publicationValidation = useMemo(() => validateMediaAsset(asset, { publicationReady: true }), [asset]);
  const editable = assetStatus === "draft" && roles.includes("author");

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try {
      const payload = await listAcademyAdminMedia();
      setRecords(payload.assets ?? []);
      setStatus(payload.assets?.length ? "" : "No governed media assets yet.");
    } catch (error) { setStatus(error.message); }
  }

  function startAsset(next, message) {
    setAsset(next);
    setAssetStatus("draft");
    setReview({ ...EMPTY_REVIEW });
    setSaved(false);
    setStatus(message);
  }

  async function openRecord(record) {
    try {
      const payload = await loadAcademyAdminMedia(record.asset_id, record.version, record.locale);
      setAsset(payload.asset);
      setAssetStatus(payload.status);
      setReview(payload.review ?? payload.asset.review ?? EMPTY_REVIEW);
      setSaved(true);
      setStatus(`Editing ${payload.asset.title}, version ${payload.asset.version} (${payload.asset.locale}).`);
    } catch (error) { setStatus(error.message); }
  }

  function update(mutator) {
    const next = structuredClone(asset);
    mutator(next);
    setAsset(next);
    setSaved(false);
  }

  async function saveDraft() {
    if (!draftValidation.valid || !roles.includes("author")) return;
    try {
      setStatus("Saving media draft...");
      await saveAcademyAdminMedia(asset.id, asset.version, asset.locale, asset);
      setAssetStatus("draft");
      setSaved(true);
      setStatus("Media draft saved. It remains private until review and publication.");
      refresh();
    } catch (error) { setStatus(error.message); }
  }

  async function transition(action) {
    try {
      const result = action === "submit"
        ? await submitAcademyAdminMediaForReview(asset.id, asset.version, asset.locale)
        : action === "review"
          ? await reviewAcademyAdminMedia(asset.id, asset.version, asset.locale, review)
          : await publishAcademyAdminMedia(asset.id, asset.version, asset.locale);
      setAssetStatus(result.status);
      if (result.review) {
        setReview(result.review);
        setAsset((current) => ({ ...current, review: { decision: result.review.decision, content_checked: true, research_checked: true, accessibility_checked: true, note: result.review.note } }));
      }
      setStatus(action === "publish" ? "Published. This media revision is now immutable." : "Media workflow updated.");
      refresh();
    } catch (error) { setStatus(error.message); }
  }

  return <section className="admin-media-library" aria-labelledby="admin-media-title">
    <header><ImageIcon aria-hidden="true" /><div><p className="eyebrow">Educational media</p><h3 id="admin-media-title">Keep every teaching asset reviewable and replaceable.</h3><p>Files stay separate from their governed metadata. Learners receive only published revisions with their required accessible alternatives.</p></div></header>
    <div className="admin-media-layout">
      <aside aria-label="Saved media revisions"><div className="admin-media-list-heading"><strong>Media revisions</strong>{roles.includes("author") && <button type="button" className="secondary-action" onClick={() => startAsset(createBlankMediaAsset(), "New media draft created locally.")}><Plus /> New asset</button>}</div>{records.length ? <ol>{records.map((record) => <li key={`${record.asset_id}:${record.version}:${record.locale}`}><button type="button" onClick={() => openRecord(record)}><strong>{record.title}</strong><span>{record.kind} · {record.locale} · v{record.version} · {formatStatus(record.status)}</span></button></li>)}</ol> : <p className="lesson-muted">No saved media revisions.</p>}</aside>
      {!asset ? <div className="admin-media-empty"><h4>Create or choose an asset</h4><p>Start with the illustration, audio, video, document, transcript, and rights information you already have. Review happens only after the draft is complete.</p></div> : <div className="admin-media-editor">
        <div className="admin-section-heading"><div><p className="eyebrow">{formatStatus(assetStatus)}</p><h4>{asset.title}</h4></div>{assetStatus === "published" && roles.includes("author") && <div className="admin-media-revision-actions"><button type="button" className="secondary-action" onClick={() => startAsset(createNextMediaRevision(asset), `Version ${asset.version + 1} created as a private replacement draft.`)}><CopyPlus /> New version</button><button type="button" className="secondary-action" onClick={() => startAsset(createMediaLocalization(asset), "Localization draft created. Set its locale and localized accessibility text before saving.")}><Languages /> Localize</button></div>}</div>
        <fieldset className="admin-media-fields" disabled={!editable}><legend className="sr-only">Media metadata</legend><div className="admin-form-grid"><MediaField label="Title" value={asset.title} onChange={(value) => update((next) => { next.title = value; })} required /><MediaField label="Asset ID" value={asset.id} onChange={(value) => update((next) => { next.id = value; })} required /><MediaField label="Version" value={asset.version} type="number" min="1" onChange={(value) => update((next) => { next.version = Number(value); })} required /><MediaField label="Locale" value={asset.locale} onChange={(value) => update((next) => { next.locale = value; })} required /><label>Kind<select value={asset.kind} onChange={(event) => update((next) => { next.kind = event.target.value; })}>{MEDIA_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select></label><MediaField label="Source path" value={asset.source} onChange={(value) => update((next) => { next.source = value; })} hint="Use a same-origin path such as /academy/media/example.jpg." required /><MediaField label="MIME type" value={asset.mimeType} onChange={(value) => update((next) => { next.mimeType = value; })} required /><MediaField label="Byte size" value={asset.byteSize} type="number" min="0" onChange={(value) => update((next) => { next.byteSize = Number(value); })} required /><MediaField label="SHA-256 checksum" value={asset.checksum} onChange={(value) => update((next) => { next.checksum = value; })} required /></div>
        <div className="admin-form-columns"><fieldset><legend>Rights</legend><MediaField label="Owner" value={asset.rights.owner} onChange={(value) => update((next) => { next.rights.owner = value; })} required /><MediaField label="License" value={asset.rights.license} onChange={(value) => update((next) => { next.rights.license = value; })} required /><MediaField label="Attribution" value={asset.rights.attribution} onChange={(value) => update((next) => { next.rights.attribution = value; })} multiline /><MediaField label="Original source URL" value={asset.rights.sourceUrl} onChange={(value) => update((next) => { next.rights.sourceUrl = value; })} /></fieldset><fieldset><legend>Accessible alternatives</legend>{asset.kind === "image" && <MediaField label="Alternative text" value={asset.accessibility.alternative} onChange={(value) => update((next) => { next.accessibility.alternative = value; })} multiline required />}{["audio", "video"].includes(asset.kind) && <MediaField label="Transcript" value={asset.accessibility.transcript} onChange={(value) => update((next) => { next.accessibility.transcript = value; })} multiline required />}{asset.kind === "video" && <MediaField label="Captions URL" value={asset.accessibility.captions} onChange={(value) => update((next) => { next.accessibility.captions = value; })} required />}<MediaField label="Long description" value={asset.accessibility.longDescription} onChange={(value) => update((next) => { next.accessibility.longDescription = value; })} multiline /></fieldset></div></fieldset>
        <p className={draftValidation.valid ? "admin-validation valid" : "admin-validation"}><ShieldCheck aria-hidden="true" />{assetStatus === "published" ? "Published revisions are read-only. Create a new version or localization to make changes." : assetStatus !== "draft" ? "This revision is read-only while it moves through review and publication." : !draftValidation.valid ? draftValidation.errors.join(" ") : publicationValidation.valid ? "Ready to save and submit for review." : `Draft can be saved. Before review: ${publicationValidation.errors.join(" ")}`}</p>
        <div className="admin-media-actions">{editable && <><button type="button" className="primary-action" disabled={!draftValidation.valid} onClick={saveDraft}><Save /> Save media draft</button><button type="button" className="secondary-action" disabled={!publicationValidation.valid || !saved} onClick={() => transition("submit")}><Send /> Submit for review</button></>}{assetStatus === "review_requested" && roles.includes("reviewer") && <MediaReview review={review} onChange={setReview} onSubmit={() => transition("review")} />}{assetStatus === "in_review" && roles.includes("publisher") && <button type="button" className="primary-action" onClick={() => transition("publish")}><Stamp /> Publish media</button>}</div>
      </div>}
    </div>
    {status && <p className="privacy-status" role="status">{status}</p>}
  </section>;
}

function MediaReview({ review, onChange, onSubmit }) {
  const ready = review.content_checked && review.research_checked && review.accessibility_checked;
  return <fieldset className="admin-review-form"><legend>Media review</legend><label><input type="checkbox" checked={review.content_checked} onChange={(event) => onChange({ ...review, content_checked: event.target.checked })} /> Teaching content checked</label><label><input type="checkbox" checked={review.research_checked} onChange={(event) => onChange({ ...review, research_checked: event.target.checked })} /> Research claims checked</label><label><input type="checkbox" checked={review.accessibility_checked} onChange={(event) => onChange({ ...review, accessibility_checked: event.target.checked })} /> Accessible alternatives checked</label><label>Decision<select value={review.decision} onChange={(event) => onChange({ ...review, decision: event.target.value })}><option value="approved">Approve for publication</option><option value="changes_requested">Request changes</option></select></label><MediaField label="Review note" value={review.note} onChange={(value) => onChange({ ...review, note: value })} multiline /><button type="button" className="primary-action" disabled={!ready} onClick={onSubmit}><ShieldCheck /> Save media review</button></fieldset>;
}

function MediaField({ label, value, onChange, multiline = false, required = false, hint, ...props }) {
  const controls = { value: value ?? "", onChange: (event) => onChange(event.target.value), required, ...props };
  return <label className={multiline ? "admin-field admin-field-wide" : "admin-field"}>{label}{multiline ? <textarea {...controls} rows="4" /> : <input {...controls} />}{hint && <span className="field-hint">{hint}</span>}</label>;
}

function formatStatus(status) {
  return ({ draft: "Draft", review_requested: "Review requested", in_review: "Approved for publication", published: "Published" })[status] ?? status;
}
