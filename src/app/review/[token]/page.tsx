"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";

interface ReviewDocument {
  id: string;
  title: string;
  content: string;
  targetKeyword: string;
}

interface ReviewComment {
  id: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  commentText: string;
  authorName: string | null;
  status: string;
  createdAt: string;
}

interface SelectionState {
  startOffset: number;
  endOffset: number;
  selectedText: string;
  rect: DOMRect;
}

// ---------------------------------------------------------------------------
// DOM helpers — char offset for recording new selections
// ---------------------------------------------------------------------------

function getCharOffset(container: Element, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(container, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

// ---------------------------------------------------------------------------
// HTML highlight injection — wraps first occurrence of selectedText with <mark>
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
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).tagName !== "MARK"
  ) {
    for (const child of Array.from(node.childNodes)) {
      if (wrapFirstTextOccurrence(child, text, commentId, index)) return true;
    }
  }
  return false;
}

function buildAnnotatedHtml(
  html: string,
  comments: ReviewComment[]
): string {
  if (typeof window === "undefined" || !html) return html || "";
  const doc = new DOMParser().parseFromString(html || "<p></p>", "text/html");
  comments.forEach((c, i) => {
    if (c.selectedText?.trim())
      wrapFirstTextOccurrence(doc.body, c.selectedText, c.id, i + 1);
  });
  return doc.body.innerHTML;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ReviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [reviewDoc, setReviewDoc] = useState<ReviewDocument | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  const fetchReview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/review/${token}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fout bij het laden van de review");
        return;
      }
      const data = await res.json();
      setReviewDoc(data.document);
      setComments(data.comments);
    } catch {
      setError("Fout bij het laden van de review");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  // Rebuild annotated HTML whenever content or comments change
  const annotatedHtml = useMemo(
    () => buildAnnotatedHtml(reviewDoc?.content || "", comments),
    [reviewDoc?.content, comments]
  );

  // Update active mark styling via direct DOM attribute (avoids full re-render)
  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current
      .querySelectorAll(".comment-mark[data-active]")
      .forEach((m) => m.removeAttribute("data-active"));
    if (activeTooltip) {
      contentRef.current
        .querySelector(`.comment-mark[data-comment-id="${activeTooltip}"]`)
        ?.setAttribute("data-active", "true");
    }
  }, [activeTooltip, annotatedHtml]);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) {
      setSelection(null);
      return;
    }
    const selectedText = sel.toString();
    if (!selectedText.trim()) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const container = contentRef.current;
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const startOffset = getCharOffset(container, range.startContainer, range.startOffset);
    const endOffset = getCharOffset(container, range.endContainer, range.endOffset);
    const rect = range.getBoundingClientRect();
    setSelection({ startOffset, endOffset, selectedText, rect });
    setShowForm(false);
    setActiveTooltip(null);
  }

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const mark = (e.target as Element).closest(".comment-mark");
    if (mark) {
      const commentId = mark.getAttribute("data-comment-id");
      const rect = mark.getBoundingClientRect();
      if (activeTooltip === commentId) {
        setActiveTooltip(null);
        setTooltipRect(null);
      } else {
        setActiveTooltip(commentId);
        setTooltipRect(rect);
      }
      // Clear text selection when clicking a mark
      window.getSelection()?.removeAllRanges();
      setSelection(null);
    } else {
      setActiveTooltip(null);
      setTooltipRect(null);
    }
  }

  async function submitComment() {
    if (!selection || !commentText.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/review/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          selectedText: selection.selectedText,
          commentText: commentText.trim(),
          authorName: authorName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fout bij het plaatsen van opmerking");
      }
      setSubmitSuccess(true);
      setShowForm(false);
      setSelection(null);
      setCommentText("");
      setAuthorName("");
      window.getSelection()?.removeAllRanges();
      await fetchReview();
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setSubmitting(false);
    }
  }

  function cancelComment() {
    setShowForm(false);
    setSelection(null);
    setCommentText("");
    setAuthorName("");
    setSubmitError(null);
    window.getSelection()?.removeAllRanges();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" />
          </svg>
          Document laden...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md text-center px-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Toegang niet mogelijk</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!reviewDoc) return null;

  const activeComment = comments.find((c) => c.id === activeTooltip);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{reviewDoc.title || "Naamloos document"}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Trefwoord: <span className="font-medium">{reviewDoc.targetKeyword}</span>
                {" · "}
                <span className="text-indigo-600">Selecteer tekst om een opmerking te plaatsen</span>
              </p>
            </div>
            {comments.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {comments.length} opmerking{comments.length !== 1 ? "en" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Success banner */}
      {submitSuccess && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-2 text-green-700 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Opmerking geplaatst. Bedankt voor je feedback!
          </div>
        </div>
      )}

      {/* Article content */}
      <div className="max-w-3xl mx-auto px-6 py-10 relative">
        <div
          ref={contentRef}
          onMouseUp={handleMouseUp}
          onClick={handleContentClick}
          className="article-body text-lg select-text"
          style={{ userSelect: "text" }}
          dangerouslySetInnerHTML={{ __html: annotatedHtml }}
        />

        {/* Floating "add comment" button */}
        {selection && !showForm && (
          <div
            className="fixed z-30"
            style={{
              top: Math.max(selection.rect.top + window.scrollY - 48, 8),
              left: selection.rect.left + selection.rect.width / 2 - 80,
            }}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setShowForm(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Opmerking toevoegen
            </button>
          </div>
        )}

        {/* Floating comment tooltip */}
        {activeComment && tooltipRect && (
          <div
            className="fixed z-20 w-72 bg-gray-900 text-white text-xs rounded-xl p-4 shadow-xl"
            style={{
              top: tooltipRect.top + window.scrollY - 8,
              left: tooltipRect.left,
              transform: "translateY(-100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeComment.authorName && (
              <p className="font-semibold mb-1">{activeComment.authorName}</p>
            )}
            <p>{activeComment.commentText}</p>
            <p className="mt-2 text-gray-400 text-[11px]">
              {new Date(activeComment.createdAt).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        )}

        {/* Comment form modal */}
        {showForm && selection && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Opmerking toevoegen</h2>
              <p className="text-sm text-gray-500 mb-4">
                Over: &ldquo;
                <span className="text-gray-700 italic">
                  {selection.selectedText.length > 80
                    ? selection.selectedText.slice(0, 80) + "…"
                    : selection.selectedText}
                </span>
                &rdquo;
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Naam (optioneel)
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Jouw naam"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Opmerking <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Schrijf hier je opmerking..."
                    rows={4}
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-red-600 mt-2">{submitError}</p>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim() || submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? "Plaatsen..." : "Plaatsen"}
                </button>
                <button
                  onClick={cancelComment}
                  className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800 border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close tooltip */}
      {activeTooltip && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setActiveTooltip(null); setTooltipRect(null); }}
        />
      )}
    </div>
  );
}
