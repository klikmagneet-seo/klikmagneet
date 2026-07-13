"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface AiRevision {
  id: string;
  commentId: string;
  originalText: string;
  proposedText: string;
  status: string;
  createdAt: string;
}

interface Comment {
  id: string;
  documentId: string;
  reviewLinkId: string | null;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  commentText: string;
  authorName: string | null;
  status: string;
  createdAt: string;
  aiRevisions: AiRevision[];
}

interface DocumentInfo {
  id: string;
  title: string;
  targetKeyword: string;
  content: string;
}

// ---------------------------------------------------------------------------
// HTML highlight injection
// ---------------------------------------------------------------------------

function wrapFirstTextOccurrence(
  node: Node,
  text: string,
  commentId: string,
  index: number
): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    const content = node.textContent || "";
    const i = content.indexOf(text);
    if (i === -1) return false;
    const d = node.ownerDocument!;
    const mark = d.createElement("mark");
    mark.setAttribute("data-comment-id", commentId);
    mark.setAttribute("data-index", String(index));
    mark.className = "comment-mark";
    mark.textContent = text;
    const parent = node.parentNode!;
    if (i > 0) parent.insertBefore(d.createTextNode(content.slice(0, i)), node);
    parent.insertBefore(mark, node);
    if (i + text.length < content.length)
      parent.insertBefore(d.createTextNode(content.slice(i + text.length)), node);
    parent.removeChild(node);
    return true;
  }
  if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName !== "MARK") {
    for (const child of Array.from(node.childNodes)) {
      if (wrapFirstTextOccurrence(child, text, commentId, index)) return true;
    }
  }
  return false;
}

function buildAnnotatedHtml(
  html: string,
  comments: Comment[],
  getIndex: (id: string) => number
): string {
  if (typeof window === "undefined" || !html) return html || "";
  const doc = new DOMParser().parseFromString(html || "<p></p>", "text/html");
  comments.forEach((c) => {
    if (c.selectedText?.trim())
      wrapFirstTextOccurrence(doc.body, c.selectedText, c.id, getIndex(c.id));
  });
  return doc.body.innerHTML;
}

// ---------------------------------------------------------------------------
// CommentCard — standalone component so its own state never causes remounts
// ---------------------------------------------------------------------------

interface CommentCardProps {
  comment: Comment;
  index: number;
  isActive: boolean;
  onActivate: () => void;
  revisingId: string | null;
  resolvingId: string | null;
  acceptingId: string | null;
  rejectingId: string | null;
  onAiRevise: (id: string) => void;
  onResolve: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onManualEdit: (commentId: string, proposedText: string) => Promise<void>;
}

function CommentCard({
  comment, index, isActive, onActivate,
  revisingId, resolvingId, acceptingId, rejectingId,
  onAiRevise, onResolve, onAccept, onReject, onManualEdit,
}: CommentCardProps) {
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const [applying, setApplying] = useState(false);

  const pendingRevision = comment.aiRevisions.find((r) => r.status === "pending");
  const isOpen = comment.status === "open";

  async function applyManual() {
    if (!manualText.trim()) return;
    setApplying(true);
    try {
      await onManualEdit(comment.id, manualText);
      setShowManual(false);
      setManualText("");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className={`bg-white border rounded-xl overflow-hidden transition-all ${
        isActive ? "border-indigo-400 ring-2 ring-indigo-200" : "border-gray-200"
      }`}
    >
      {/* Header: number + selected text */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 cursor-pointer" onClick={onActivate}>
        <div className="flex items-start gap-2">
          <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-white text-xs font-bold mt-0.5">
            {index}
          </span>
          <p className="text-sm text-yellow-900 italic">&ldquo;{comment.selectedText}&rdquo;</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-sm text-gray-800 mb-2">{comment.commentText}</p>
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          <span>{comment.authorName || "Anoniem"}</span>
          <span>·</span>
          <span>
            {new Date(comment.createdAt).toLocaleDateString("nl-NL", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </span>
          <span>·</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isOpen ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
            {isOpen ? "Open" : "Opgelost"}
          </span>
        </div>
      </div>

      {/* Actions */}
      {pendingRevision ? (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI-voorstel
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs font-medium text-red-600 mb-1.5">Origineel</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">{pendingRevision.originalText}</div>
            </div>
            <div>
              <p className="text-xs font-medium text-green-600 mb-1.5">Voorstel</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900">{pendingRevision.proposedText}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onAccept(pendingRevision.id)}
              disabled={acceptingId === pendingRevision.id}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              {acceptingId === pendingRevision.id
                ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Accepteren...</>
                : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Accepteren</>}
            </button>
            <button
              onClick={() => onReject(pendingRevision.id)}
              disabled={rejectingId === pendingRevision.id}
              className="flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              {rejectingId === pendingRevision.id ? "Afwijzen..." : "Afwijzen"}
            </button>
          </div>
        </div>
      ) : isOpen ? (
        <div className="border-t border-gray-100 px-4 py-3">
          {showManual ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Handmatige aanpassing</p>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={4}
                autoFocus
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Typ de gewenste tekst hier..."
              />
              <div className="flex gap-2">
                <button
                  onClick={applyManual}
                  disabled={!manualText.trim() || applying}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {applying
                    ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Toepassen...</>
                    : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Toepassen</>}
                </button>
                <button
                  onClick={() => { setShowManual(false); setManualText(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:text-gray-800 border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => onAiRevise(comment.id)}
                disabled={revisingId === comment.id}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                {revisingId === comment.id
                  ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>AI verwerkt...</>
                  : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>AI past aan</>}
              </button>
              <button
                onClick={() => { setShowManual(true); setManualText(comment.selectedText); }}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Handmatig aanpassen
              </button>
              <button
                onClick={() => onResolve(comment.id)}
                disabled={resolvingId === comment.id}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                {resolvingId === comment.id ? "Oplossen..." : "Markeer als opgelost"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CommentsPage() {
  const params = useParams();
  const id = params.id as string;

  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [docRes, commentsRes] = await Promise.all([
        fetch(`/api/documents/${id}`),
        fetch(`/api/documents/${id}/comments`),
      ]);
      if (!docRes.ok) throw new Error("Document niet gevonden");
      if (!commentsRes.ok) throw new Error("Fout bij ophalen opmerkingen");
      const doc = await docRes.json();
      const commentsData = await commentsRes.json();
      setDocInfo({ id: doc.id, title: doc.title, targetKeyword: doc.targetKeyword, content: doc.content || "" });
      setComments(commentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAiRevise(commentId: string) {
    setRevisingId(commentId);
    setActionError(null);
    try {
      const res = await fetch(`/api/comments/${commentId}/ai-revise`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Fout bij AI-revisie");
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setRevisingId(null);
    }
  }

  async function handleResolve(commentId: string) {
    setResolvingId(commentId);
    setActionError(null);
    try {
      const res = await fetch(`/api/comments/${commentId}/resolve`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json()).error || "Fout bij oplossen");
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setResolvingId(null);
    }
  }

  async function handleAccept(revisionId: string) {
    setAcceptingId(revisionId);
    setActionError(null);
    try {
      const res = await fetch(`/api/ai-revisions/${revisionId}/accept`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Fout bij accepteren");
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleReject(revisionId: string) {
    setRejectingId(revisionId);
    setActionError(null);
    try {
      const res = await fetch(`/api/ai-revisions/${revisionId}/reject`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Fout bij afwijzen");
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setRejectingId(null);
    }
  }

  async function handleManualEdit(commentId: string, proposedText: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/comments/${commentId}/manual-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedText }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Fout bij toepassen");
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Onbekende fout");
      throw err;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" />
          </svg>
          Laden...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-700">{error}</p>
          <Link href="/dashboard" className="mt-3 text-sm text-red-600 underline">Terug naar dashboard</Link>
        </div>
      </div>
    );
  }

  const openComments = comments.filter((c) => c.status === "open");
  const resolvedComments = comments.filter((c) => c.status === "resolved");
  const allCommentsSorted = [...openComments, ...resolvedComments];

  const annotatedHtml = useMemo(() => {
    if (!docInfo?.content) return "";
    return buildAnnotatedHtml(
      docInfo.content,
      allCommentsSorted,
      (id) => allCommentsSorted.findIndex((c) => c.id === id) + 1
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docInfo?.content, comments]);

  // Update active mark styling without re-computing HTML
  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current
      .querySelectorAll(".comment-mark[data-active]")
      .forEach((m) => m.removeAttribute("data-active"));
    if (activeCommentId) {
      previewRef.current
        .querySelector(`.comment-mark[data-comment-id="${activeCommentId}"]`)
        ?.setAttribute("data-active", "true");
    }
  }, [activeCommentId, annotatedHtml]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/documents/${id}`} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{docInfo?.title || "Document"} — Opmerkingen</h1>
            {docInfo?.targetKeyword && <p className="text-xs text-gray-500 mt-0.5">{docInfo.targetKeyword}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            <span>{openComments.length} open</span>
            <span>·</span>
            <span>{resolvedComments.length} opgelost</span>
          </div>
        </div>
      </div>

      {/* Main */}
      {comments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Geen opmerkingen</h3>
          <p className="text-gray-500 text-sm max-w-sm">
            Er zijn nog geen opmerkingen op dit document. Deel een reviewlink om feedback te ontvangen.
          </p>
          <Link href={`/documents/${id}`} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 underline">
            Terug naar document
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: annotated document */}
          <div className="flex-1 overflow-auto bg-gray-50 border-r border-gray-200 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Document met opmerkingen</p>
            <div
              className="bg-white border border-gray-200 rounded-xl p-6"
              onClick={(e) => {
                const mark = (e.target as Element).closest(".comment-mark");
                if (!mark) return;
                const commentId = mark.getAttribute("data-comment-id");
                setActiveCommentId(activeCommentId === commentId ? null : commentId);
                if (commentId) {
                  globalThis.document
                    ?.getElementById(`comment-${commentId}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
              }}
            >
              <div
                ref={previewRef}
                className="article-body text-sm"
                dangerouslySetInnerHTML={{ __html: annotatedHtml }}
              />
            </div>
          </div>

          {/* Right: comment cards */}
          <div className="w-[420px] flex-shrink-0 overflow-auto p-6">
            {actionError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{actionError}</div>
            )}

            {openComments.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">{openComments.length}</span>
                  Open opmerkingen
                </h2>
                <div className="space-y-4">
                  {openComments.map((c) => (
                    <CommentCard
                      key={c.id}
                      comment={c}
                      index={allCommentsSorted.findIndex((x) => x.id === c.id) + 1}
                      isActive={activeCommentId === c.id}
                      onActivate={() => setActiveCommentId(activeCommentId === c.id ? null : c.id)}
                      revisingId={revisingId}
                      resolvingId={resolvingId}
                      acceptingId={acceptingId}
                      rejectingId={rejectingId}
                      onAiRevise={handleAiRevise}
                      onResolve={handleResolve}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      onManualEdit={handleManualEdit}
                    />
                  ))}
                </div>
              </section>
            )}

            {resolvedComments.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">{resolvedComments.length}</span>
                  Opgeloste opmerkingen
                </h2>
                <div className="space-y-4 opacity-70">
                  {resolvedComments.map((c) => (
                    <CommentCard
                      key={c.id}
                      comment={c}
                      index={allCommentsSorted.findIndex((x) => x.id === c.id) + 1}
                      isActive={activeCommentId === c.id}
                      onActivate={() => setActiveCommentId(activeCommentId === c.id ? null : c.id)}
                      revisingId={revisingId}
                      resolvingId={resolvingId}
                      acceptingId={acceptingId}
                      rejectingId={rejectingId}
                      onAiRevise={handleAiRevise}
                      onResolve={handleResolve}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      onManualEdit={handleManualEdit}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
