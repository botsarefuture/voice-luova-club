import { useState } from "react";
import { Download, Headphones, HelpCircle, Image as ImageIcon, Lightbulb, Mic, MessageCircle, PlayCircle, ScrollText } from "lucide-react";

export function BlockRenderer({ block, lesson, response = {}, onResponse, paused = false }) {
  const content = block.content ?? {};
  const disabled = paused;

  return (
    <section className={`lesson-block lesson-block-${block.type}`} aria-labelledby={`block-title-${block.id}`}>
      <header className="lesson-block-header">
        <p className="eyebrow">{block.metadata.label ?? block.type.replaceAll("_", " ")}</p>
        <h3 id={`block-title-${block.id}`}>{block.metadata.title ?? "Learning step"}</h3>
        {block.durationMinutes > 0 && <span>{block.durationMinutes} min</span>}
      </header>
      {block.safety.note && <p className="lesson-inline-safety"><strong>Take care:</strong> {block.safety.note}</p>}
      <BlockBody block={block} lesson={lesson} content={content} response={response} onResponse={onResponse} disabled={disabled} />
    </section>
  );
}

function BlockBody({ block, lesson, content, response, onResponse, disabled }) {
  switch (block.type) {
    case "text":
      return <p>{content.text}</p>;
    case "rich_text":
      return <RichText nodes={content.nodes} />;
    case "image":
      return <ImageBlock block={block} content={content} />;
    case "video":
      return <VideoBlock block={block} content={content} />;
    case "audio":
      return <AudioBlock block={block} content={content} />;
    case "reflection":
      return (
        <label className="lesson-field">
          <span>{content.prompt}</span>
          <textarea value={response.text ?? ""} onChange={(event) => onResponse({ text: event.target.value })} disabled={disabled} rows="4" />
        </label>
      );
    case "quiz":
      return <QuizBlock content={content} response={response} onResponse={onResponse} disabled={disabled} />;
    case "interactive_exercise":
      return <ActivityBlock icon={PlayCircle} content={content} response={response} onResponse={onResponse} disabled={disabled} />;
    case "reading":
      return <ReadingBlock content={content} response={response} onResponse={onResponse} disabled={disabled} />;
    case "conversation_prompt":
      return <ConversationBlock content={content} response={response} onResponse={onResponse} disabled={disabled} />;
    case "recording":
      return <RecordingBlock content={content} response={response} onResponse={onResponse} disabled={disabled} />;
    case "resource_download":
      return <ResourceBlock content={content} />;
    case "checkpoint":
      return <CheckpointBlock content={content} />;
    case "why_this":
      return <WhyThisBlock lesson={lesson} block={block} content={content} />;
    default:
      return <p role="alert">This learning block is not available in this version of FemmeVoice.</p>;
  }
}

function RichText({ nodes = [] }) {
  return <div className="lesson-rich-text">{nodes.map((node, index) => {
    if (node.type === "heading") return <h4 key={index}>{renderInline(node.children)}</h4>;
    if (node.type === "list") return <ul key={index}>{node.items?.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
    return <p key={index}>{renderInline(node.children)}</p>;
  })}</div>;
}

function renderInline(children = []) {
  return children.map((child, index) => {
    if (child.type === "strong") return <strong key={index}>{child.value}</strong>;
    if (child.type === "emphasis") return <em key={index}>{child.value}</em>;
    if (child.type === "link") return <a key={index} href={child.href} target="_blank" rel="noreferrer">{child.value}</a>;
    return <span key={index}>{child.value}</span>;
  });
}

function ImageBlock({ block, content }) {
  const [failed, setFailed] = useState(false);
  if (!content.src || failed) return <UnavailableMedia icon={ImageIcon} label="Image" alternative={block.accessibility.alternative} />;
  return <figure className="lesson-media"><img src={content.src} alt={block.accessibility.alternative} onError={() => setFailed(true)} />{content.caption && <figcaption>{content.caption}</figcaption>}</figure>;
}

function VideoBlock({ block, content }) {
  const [failed, setFailed] = useState(false);
  if (!content.src || failed) return <UnavailableMedia icon={PlayCircle} label="Video" alternative={block.accessibility.transcript} />;
  return <div className="lesson-media"><video controls preload="metadata" src={content.src} onError={() => setFailed(true)} aria-describedby={`media-transcript-${block.id}`}>
    <track kind="captions" srcLang={content.captionLanguage ?? "en"} src={block.accessibility.captions} label="Captions" default />
  </video><MediaTranscript block={block} /></div>;
}

function AudioBlock({ block, content }) {
  const [failed, setFailed] = useState(false);
  if (!content.src || failed) return <UnavailableMedia icon={Headphones} label="Audio" alternative={block.accessibility.transcript} />;
  return <div className="lesson-media"><audio controls preload="metadata" src={content.src} onError={() => setFailed(true)} aria-describedby={`media-transcript-${block.id}`} /><MediaTranscript block={block} /></div>;
}

function MediaTranscript({ block }) {
  return <details id={`media-transcript-${block.id}`}><summary>Transcript</summary><p>{block.accessibility.transcript}</p></details>;
}

function UnavailableMedia({ icon: Icon, label, alternative }) {
  return <div className="lesson-media-unavailable" role="status"><Icon aria-hidden="true" /><div><strong>{label} is not available here.</strong><p>{alternative || "An accessible alternative was not provided."}</p></div></div>;
}

function QuizBlock({ content, response, onResponse, disabled }) {
  const selected = content.options?.find((option) => option.id === response.selectedOptionId);
  return <fieldset className="lesson-options"><legend>{content.prompt}</legend>{content.options?.map((option) => (
    <label key={option.id} className={response.selectedOptionId === option.id ? "selected" : ""}>
      <input type="radio" name="lesson-quiz" value={option.id} checked={response.selectedOptionId === option.id} disabled={disabled} onChange={() => onResponse({ selectedOptionId: option.id })} />
      <span>{option.label}</span>
    </label>
  ))}{selected && <p className={selected.correct ? "lesson-answer-correct" : "lesson-answer-try-again"}><strong>{selected.correct ? "That is right." : "A useful moment to reconsider."}</strong> {content.explanation}</p>}</fieldset>;
}

function ActivityBlock({ icon: Icon, content, response, onResponse, disabled }) {
  return <div className="lesson-activity"><Icon aria-hidden="true" /><div><p>{content.instructions}</p><button type="button" className="secondary-action" disabled={disabled} onClick={() => onResponse({ tried: true })}>{response.tried ? "Marked as tried" : content.actionLabel ?? "I tried this"}</button></div></div>;
}

function ReadingBlock({ content, response, onResponse, disabled }) {
  return <div className="lesson-reading"><ScrollText aria-hidden="true" /><blockquote>{content.passage}</blockquote><button type="button" className="secondary-action" disabled={disabled} onClick={() => onResponse({ tried: true })}>{response.tried ? "Marked as read" : "Mark as read"}</button></div>;
}

function ConversationBlock({ content, response, onResponse, disabled }) {
  return <div className="lesson-conversation"><MessageCircle aria-hidden="true" /><p>{content.prompt}</p><label className="lesson-field"><span>Optional response</span><textarea value={response.text ?? ""} onChange={(event) => onResponse({ text: event.target.value })} disabled={disabled} rows="3" /></label></div>;
}

function RecordingBlock({ content, response, onResponse, disabled }) {
  return <div className="lesson-recording"><Mic aria-hidden="true" /><div><p>{content.prompt}</p><p className="lesson-muted">Recording is optional. This lesson can continue without microphone access.</p><button type="button" className="secondary-action" disabled={disabled} onClick={() => onResponse({ tried: true })}>{response.tried ? "Continue without recording" : "Skip recording"}</button></div></div>;
}

function ResourceBlock({ content }) {
  return <a className="lesson-resource" href={content.href} download={content.downloadName || true}><Download aria-hidden="true" /><span><strong>{content.label}</strong><small>{content.description}</small></span></a>;
}

function CheckpointBlock({ content }) {
  return <div className="lesson-checkpoint"><HelpCircle aria-hidden="true" /><p>{content.message}</p></div>;
}

function WhyThisBlock({ lesson, block, content }) {
  const references = lesson.evidence.filter((item) => block.evidenceRefs.includes(item.id));
  return <details className="lesson-why-this"><summary><Lightbulb aria-hidden="true" /> {content.prompt || "Why this?"}</summary>{references.length ? <ul>{references.map((reference) => <li key={reference.id}><strong>{reference.level}:</strong> {reference.label}. {reference.citation}<br /><span>{reference.limitation}</span></li>)}</ul> : <p>No specific evidence reference is attached to this block.</p>}</details>;
}
