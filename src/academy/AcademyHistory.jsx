import { useState } from "react";
import { CalendarDays, Clock3, Download, FileText, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { summarizeAcademyHistory } from "./learnerHistory";

export default function AcademyHistory({ history, course, onDeleteHistory, onAddJournal }) {
  const [note, setNote] = useState("");
  const [ease, setEase] = useState("");
  const summary = summarizeAcademyHistory(history, course.slug, course.lessons);

  function submitJournal(event) {
    event.preventDefault();
    if (!note.trim()) return;
    onAddJournal({ note, ease: ease || null, courseSlug: course.slug });
    setNote("");
    setEase("");
  }

  function exportLocalHistory() {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "femmevoice-academy-history.json";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function deleteHistory() {
    if (window.confirm("Delete this Academy history from this device? This cannot be undone.")) onDeleteHistory();
  }

  return <section className="academy-history" aria-labelledby="academy-history-title">
    <header className="academy-history-heading">
      <div><p className="eyebrow">Your learning history</p><h3 id="academy-history-title">A record to look back on, not a score to keep up with.</h3><p>Only your own completed steps, active lesson time, and notes you choose to save appear here.</p></div>
      <CalendarDays aria-hidden="true" />
    </header>

    <div className="academy-history-stats" aria-label="Foundations learning summary">
      <HistoryStat icon={<Sparkles />} label="Available lessons completed" value={`${summary.completedLessons} of ${summary.totalLessons}`} detail={summary.completedLessons ? "Keep the parts that helped." : "Your first step is waiting."} />
      <HistoryStat icon={<Clock3 />} label="This week" value={formatLearningTime(summary.weekSeconds)} detail={summary.weekSeconds ? "Time you chose to spend here" : "No expectation to fill this."} />
      <HistoryStat icon={<FileText />} label="Last opened" value={summary.recentLesson?.lessonTitle ?? "Not yet"} detail={summary.recentLesson?.completed ? "Completed" : summary.recentLesson ? "A safe place is saved" : "Start whenever it feels right"} />
    </div>

    <div className="academy-history-calendar" role="list" aria-label="Academy activity over the last fourteen days">
      {summary.days.map((day) => <span key={day.date} role="listitem" className={day.activeSeconds ? "active" : ""} aria-label={`${formatShortDate(day.date)}: ${day.activeSeconds ? formatLearningTime(day.activeSeconds) : "no Academy activity"}`}><i style={{ height: `${Math.max(16, Math.min(100, day.activeSeconds ? 25 + Math.min(75, day.activeSeconds / 12) : 16))}%` }} /><small>{formatShortDate(day.date)}</small></span>)}
    </div>

    {summary.recentLessons.length > 0 && <details className="academy-recent-lessons"><summary>Recently opened lessons</summary><ol>{summary.recentLessons.map((lesson) => <li key={lesson.lessonId}><strong>{lesson.lessonTitle}</strong><span>{lesson.completed ? "Completed" : "Safe place saved"}</span><time dateTime={lesson.lastPracticedAt}>{formatLongDate(lesson.lastPracticedAt)}</time></li>)}</ol></details>}

    <form className="academy-journal" onSubmit={submitJournal}>
      <div><p className="eyebrow">Optional note</p><h4>What would you like to remember?</h4><p>A note stays on this device unless you explicitly turn on account sync.</p></div>
      <label><span>Your note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength="1000" rows="3" placeholder="A small win, a question, or simply “not today.”" /></label>
      <label><span>How did learning feel? Optional.</span><select value={ease} onChange={(event) => setEase(event.target.value)}><option value="">No label</option><option value="easy">Easy</option><option value="okay">Okay</option><option value="unsure">Unsure</option><option value="not-today">Not today</option></select></label>
      <button type="submit" className="secondary-action" disabled={!note.trim()}>Save private note</button>
    </form>

    {summary.journal.length > 0 && <details className="academy-journal-history"><summary>Your saved notes ({summary.journal.length})</summary><ol>{summary.journal.map((entry) => <li key={entry.id}><time dateTime={entry.createdAt}>{formatLongDate(entry.createdAt)}</time>{entry.ease && <span>{formatEase(entry.ease)}</span>}<p>{entry.note}</p></li>)}</ol></details>}

    <aside className="academy-history-privacy" aria-label="Academy history privacy">
      <ShieldCheck aria-hidden="true" />
      <div><strong>Saved on this device</strong><p>Academy history does not leave this device. Account sync is a separate, future choice; it is not enabled or collected here.</p></div>
      <div className="academy-history-actions">
        <button type="button" className="icon-action" onClick={exportLocalHistory} aria-label="Export Academy history"><Download /></button>
        <button type="button" className="icon-action danger-action" onClick={deleteHistory} aria-label="Delete Academy history"><Trash2 /></button>
      </div>
    </aside>
  </section>;
}

function HistoryStat({ icon, label, value, detail }) {
  return <article><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function formatLearningTime(seconds) {
  const minutes = Math.floor((seconds ?? 0) / 60);
  if (minutes > 0) return `${minutes} min`;
  return seconds ? "Less than a minute" : "No time yet";
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(`${date}T12:00:00`));
}

function formatLongDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved note" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatEase(value) {
  return ({ easy: "Easy", okay: "Okay", unsure: "Unsure", "not-today": "Not today" })[value] ?? value;
}
