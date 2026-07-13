"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Brief {
  subtopics: string[];
  questions: string[];
  structure: string[];
  intent: string;
}

interface Document {
  id: string;
  title: string;
  targetKeyword: string;
  brief: Brief | null;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// SEO / GEO result types
// ---------------------------------------------------------------------------

interface SeoResult {
  score: number;
  checks: { passed: boolean; label: string }[];
}

interface GeoResult {
  directAnswerScore: number;
  directAnswerStatus: "good" | "average" | "poor";
  directAnswerFeedback: string;
  hasStatistics: boolean;
  hasSourceReferences: boolean;
  freshnessScore: number;
  freshnessStatus: "fresh" | "aging" | "stale" | "outdated";
  daysSinceUpdate: number;
  geoScore: number;
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Concept", className: "bg-gray-100 text-gray-700" },
  in_review: { label: "In review", className: "bg-yellow-100 text-yellow-700" },
  revised: { label: "Herzien", className: "bg-blue-100 text-blue-700" },
  published: { label: "Gepubliceerd", className: "bg-green-100 text-green-700" },
};

type EditingItem = { section: keyof Brief; index: number } | null;
type RightTab = "brief" | "seo" | "geo";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DocumentEditor() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");

  // Brief editing
  const [editedBrief, setEditedBrief] = useState<Brief | null>(null);
  const [briefEdited, setBriefEdited] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingBrief, setSavingBrief] = useState(false);

  // Generation states
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [briefError, setBriefError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Length options
  type LengthOption = "kort" | "medium" | "lang";
  type RewriteLength = "same" | "kort" | "medium" | "lang";
  const [lengthOption, setLengthOption] = useState<LengthOption>("medium");
  const [rewriteLength, setRewriteLength] = useState<RewriteLength>("same");

  // Rewrite / import mode
  type PasteMode = "rewrite" | "import";
  const [showRewrite, setShowRewrite] = useState(false);
  const [pasteMode, setPasteMode] = useState<PasteMode>("rewrite");
  const [rewriteText, setRewriteText] = useState("");
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // Direct import (own text)
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  // Review sharing
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [creatingReviewLink, setCreatingReviewLink] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Right panel tab
  const [rightTab, setRightTab] = useState<RightTab>("brief");

  // SEO state
  const [seoResult, setSeoResult] = useState<SeoResult | null>(null);
  const [loadingSeo, setLoadingSeo] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);

  // GEO state
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [schemaMarkup, setSchemaMarkup] = useState<string | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/dashboard");
          return;
        }
        throw new Error("Fout bij het ophalen van document");
      }
      const data = await response.json();
      setDocument(data);
      setContent(data.content || "");
      setTitle(data.title || "");
      if (data.brief) {
        setEditedBrief(data.brief);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Brief editing helpers
  function startEdit(section: keyof Brief, index: number, value: string) {
    setEditingItem({ section, index });
    setEditingValue(value);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  function commitEdit() {
    if (!editedBrief || !editingItem) return;
    const { section, index } = editingItem;
    if (section === "intent") return;
    const arr = [...(editedBrief[section] as string[])];
    if (editingValue.trim()) {
      arr[index] = editingValue.trim();
    } else {
      arr.splice(index, 1);
    }
    setEditedBrief({ ...editedBrief, [section]: arr });
    setBriefEdited(true);
    setEditingItem(null);
  }

  function deleteItem(section: keyof Brief, index: number) {
    if (!editedBrief || section === "intent") return;
    const arr = [...(editedBrief[section] as string[])];
    arr.splice(index, 1);
    setEditedBrief({ ...editedBrief, [section]: arr });
    setBriefEdited(true);
  }

  function addItem(section: keyof Brief) {
    if (!editedBrief || section === "intent") return;
    const arr = [...(editedBrief[section] as string[]), ""];
    setEditedBrief({ ...editedBrief, [section]: arr });
    setBriefEdited(true);
    setTimeout(() => {
      setEditingItem({ section, index: arr.length - 1 });
      setEditingValue("");
      editInputRef.current?.focus();
    }, 0);
  }

  function updateIntent(value: string) {
    if (!editedBrief) return;
    setEditedBrief({ ...editedBrief, intent: value });
    setBriefEdited(true);
  }

  async function saveBrief() {
    if (!editedBrief) return;
    setSavingBrief(true);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: editedBrief }),
      });
      if (!response.ok) throw new Error("Fout bij opslaan brief");
      setBriefEdited(false);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setSavingBrief(false);
    }
  }

  async function generateBrief() {
    setBriefError(null);
    setGeneratingBrief(true);
    try {
      const response = await fetch(`/api/documents/${id}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ length: lengthOption }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij het genereren van de brief");
      }
      const brief = await response.json();
      setDocument((prev) => (prev ? { ...prev, brief } : null));
      setEditedBrief(brief);
      setBriefEdited(false);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setGeneratingBrief(false);
    }
  }

  async function generateContent() {
    setGenerateError(null);
    setGeneratingContent(true);
    setContent("");
    try {
      const response = await fetch(`/api/documents/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ length: lengthOption }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij het genereren van de tekst");
      }
      if (!response.body) throw new Error("Geen streaming response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setContent(accumulated);
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      }
      setDocument((prev) =>
        prev ? { ...prev, content: accumulated, status: "in_review" } : null
      );
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setGeneratingContent(false);
    }
  }

  async function rewriteContent() {
    if (!rewriteText.trim()) return;
    setRewriteError(null);
    setRewriting(true);
    setContent("");
    try {
      const response = await fetch(`/api/documents/${id}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingText: rewriteText, lengthOption: rewriteLength }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij het herschrijven");
      }
      if (!response.body) throw new Error("Geen streaming response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setContent(accumulated);
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      }
      setShowRewrite(false);
      setRewriteText("");
    } catch (err) {
      setRewriteError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setRewriting(false);
    }
  }

  async function createReviewLink() {
    setCreatingReviewLink(true);
    try {
      const response = await fetch(`/api/documents/${id}/review-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij aanmaken reviewlink");
      }
      const link = await response.json();
      const url = `${window.location.origin}/review/${link.token}`;
      setReviewUrl(url);
      setShowShareModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setCreatingReviewLink(false);
    }
  }

  async function copyReviewUrl() {
    if (!reviewUrl) return;
    await navigator.clipboard.writeText(reviewUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  async function saveDocument() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij het opslaan");
      }
      const updated = await response.json();
      setDocument((prev) => (prev ? { ...prev, ...updated } : null));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Onbekende fout");
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(newStatus: string) {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error("Fout bij status bijwerken");
      const updated = await response.json();
      setDocument((prev) => (prev ? { ...prev, status: updated.status } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    }
  }

  async function runSeoCheck() {
    setSeoError(null);
    setLoadingSeo(true);
    try {
      const response = await fetch(`/api/documents/${id}/seo-check`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij de SEO-analyse");
      }
      const data = await response.json();
      setSeoResult(data);
    } catch (err) {
      setSeoError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoadingSeo(false);
    }
  }

  async function runGeoCheck() {
    setGeoError(null);
    setLoadingGeo(true);
    try {
      const response = await fetch(`/api/documents/${id}/geo-check`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij de GEO-analyse");
      }
      const data = await response.json();
      setGeoResult(data);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoadingGeo(false);
    }
  }

  async function generateSchemaMarkup() {
    setLoadingSchema(true);
    try {
      const response = await fetch(`/api/documents/${id}/schema-markup`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij het genereren van schema markup");
      }
      const data = await response.json();
      setSchemaMarkup(data.schemaMarkup);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoadingSchema(false);
    }
  }

  async function copySchemaMarkup() {
    if (!schemaMarkup) return;
    await navigator.clipboard.writeText(schemaMarkup);
    setSchemaCopied(true);
    setTimeout(() => setSchemaCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
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

  if (error && !document) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-700">{error}</p>
          <Link href="/dashboard" className="mt-3 text-sm text-red-600 underline hover:no-underline">
            Terug naar dashboard
          </Link>
        </div>
      </div>
    );
  }

  const brief = editedBrief;
  const statusInfo = statusConfig[document?.status || "draft"];
  const isWorking = generatingBrief || generatingContent || rewriting;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none w-full truncate focus:ring-0"
                placeholder="Documenttitel..."
              />
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{document?.targetKeyword}</span>
                <span className="text-gray-300">•</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <select
              value={document?.status || "draft"}
              onChange={(e) => updateStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="draft">Concept</option>
              <option value="in_review">In review</option>
              <option value="revised">Herzien</option>
              <option value="published">Gepubliceerd</option>
            </select>

            {/* Direct import toggle */}
            <button
              onClick={() => { setShowImport(!showImport); setShowRewrite(false); }}
              disabled={isWorking}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showImport
                  ? "bg-green-50 border-green-300 text-green-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Eigen tekst
            </button>

            {/* Rewrite toggle */}
            <button
              onClick={() => { setShowRewrite(!showRewrite); setShowImport(false); }}
              disabled={isWorking}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showRewrite
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Herschrijf
            </button>

            {/* Length picker */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {(["kort", "medium", "lang"] as LengthOption[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setLengthOption(opt)}
                  disabled={isWorking}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                    lengthOption === opt
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <button
              onClick={generateBrief}
              disabled={isWorking}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {generatingBrief ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Brief...</>
              ) : (
                "Genereer brief"
              )}
            </button>

            <button
              onClick={generateContent}
              disabled={!brief || isWorking}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              title={!brief ? "Genereer eerst een brief" : ""}
            >
              {generatingContent ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Genereren...</>
              ) : (
                "Genereer tekst"
              )}
            </button>

            <Link
              href={`/documents/${id}/comments`}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Opmerkingen
            </Link>

            <button
              onClick={createReviewLink}
              disabled={creatingReviewLink || isWorking}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {creatingReviewLink ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Link maken...</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Deel voor review
                </>
              )}
            </button>

            <button
              onClick={saveDocument}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                saveError
                  ? "bg-red-600 text-white"
                  : saveSuccess
                  ? "bg-green-600 text-white"
                  : "bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white"
              }`}
              title={saveError || undefined}
            >
              {saving ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Opslaan...</>
              ) : saveError ? (
                "Fout bij opslaan"
              ) : saveSuccess ? (
                "Opgeslagen!"
              ) : (
                "Opslaan"
              )}
            </button>
          </div>
        </div>

        {/* Save error bar */}
        {saveError && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {saveError}
          </div>
        )}
      </div>

      {/* Direct import panel */}
      {showImport && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-4">
          <div className="max-w-4xl">
            <p className="text-sm font-medium text-green-800 mb-2">
              Plak je eigen tekst — wordt 1:1 overgenomen, niets aangepast:
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Plak hier je tekst..."
              className="w-full h-40 p-3 text-sm border border-green-300 rounded-lg bg-white resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  if (!importText.trim()) return;
                  setContent(importText);
                  setShowImport(false);
                  setImportText("");
                }}
                disabled={!importText.trim()}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Importeer tekst
              </button>
              <button
                onClick={() => { setShowImport(false); setImportText(""); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800 border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rewrite / import panel */}
      {showRewrite && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="max-w-4xl">
            {/* Mode toggle */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex bg-amber-100 rounded-lg p-0.5">
                <button
                  onClick={() => setPasteMode("rewrite")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    pasteMode === "rewrite" ? "bg-white text-amber-900 shadow-sm" : "text-amber-700 hover:text-amber-900"
                  }`}
                >
                  AI herschrijven
                </button>
                <button
                  onClick={() => setPasteMode("import")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    pasteMode === "import" ? "bg-white text-amber-900 shadow-sm" : "text-amber-700 hover:text-amber-900"
                  }`}
                >
                  Importeren zonder aanpassing
                </button>
              </div>
            </div>

            <p className="text-sm font-medium text-amber-800 mb-2">
              {pasteMode === "rewrite"
                ? "Plak de tekst die je wil laten herschrijven:"
                : "Plak de tekst die je wil importeren (wordt niet aangepast):"}
            </p>
            <textarea
              value={rewriteText}
              onChange={(e) => setRewriteText(e.target.value)}
              placeholder={pasteMode === "rewrite" ? "Plak hier je bestaande tekst..." : "Plak hier je tekst..."}
              className="w-full h-32 p-3 text-sm border border-amber-300 rounded-lg bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {rewriteError && (
              <p className="text-sm text-red-600 mt-1">{rewriteError}</p>
            )}

            {/* Length picker — alleen bij herschrijven */}
            {pasteMode === "rewrite" && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs font-medium text-amber-800">Lengte:</span>
                <div className="flex gap-1 bg-amber-100 rounded-lg p-0.5">
                  {([
                    { value: "same", label: "Houd lengte" },
                    { value: "kort", label: "Kort" },
                    { value: "medium", label: "Medium" },
                    { value: "lang", label: "Lang" },
                  ] as { value: RewriteLength; label: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRewriteLength(opt.value)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        rewriteLength === opt.value
                          ? "bg-white text-amber-900 shadow-sm"
                          : "text-amber-700 hover:text-amber-900"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-2">
              {pasteMode === "rewrite" ? (
                <button
                  onClick={rewriteContent}
                  disabled={!rewriteText.trim() || rewriting}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {rewriting ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Herschrijven...</>
                  ) : (
                    "Herschrijf tekst"
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!rewriteText.trim()) return;
                    setContent(rewriteText);
                    setShowRewrite(false);
                    setRewriteText("");
                    setRewriteError(null);
                  }}
                  disabled={!rewriteText.trim()}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Importeer tekst
                </button>
              )}
              <button
                onClick={() => { setShowRewrite(false); setRewriteText(""); setRewriteError(null); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800 border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {generateError && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {generateError}
            </div>
          )}
          {(generatingContent || rewriting) && (
            <div className="mx-6 mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-indigo-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" />
              </svg>
              {rewriting ? "AI herschrijft de tekst..." : "AI schrijft het artikel..."} Dit kan 30–60 seconden duren.
            </div>
          )}
          <div className="flex-1 overflow-auto p-6">
            {content || generatingContent || rewriting ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={generatingContent || rewriting}
                className="w-full h-full min-h-[600px] p-4 border border-gray-200 rounded-xl text-gray-900 text-sm leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                placeholder="Gegenereerde tekst verschijnt hier..."
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Geen inhoud</h3>
                <p className="text-gray-500 text-sm max-w-sm">
                  {!brief
                    ? 'Klik op "Genereer brief" om te beginnen, of gebruik "Herschrijf" om bestaande tekst te verbeteren.'
                    : 'Klik op "Genereer tekst" of gebruik "Herschrijf" om bestaande tekst te verbeteren.'}
                </p>
              </div>
            )}
          </div>
          {content && (
            <div className="px-6 py-2 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">
                {content.trim().split(/\s+/).filter(Boolean).length} woorden • {content.length} tekens
              </span>
            </div>
          )}
        </div>

        {/* Share modal */}
        {showShareModal && reviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Reviewlink aangemaakt</h2>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Deel de onderstaande link met je reviewer. Zij kunnen direct opmerkingen toevoegen, zonder in te loggen.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={reviewUrl}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 focus:outline-none"
                />
                <button
                  onClick={copyReviewUrl}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    copySuccess
                      ? "bg-green-600 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Gekopieerd!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Kopieer
                    </>
                  )}
                </button>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <Link
                  href={`/documents/${id}/comments`}
                  className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                  onClick={() => setShowShareModal(false)}
                >
                  Opmerkingen bekijken &rarr;
                </Link>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Panel — tabbed */}
        <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-auto flex-shrink-0 flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
            {(["brief", "seo", "geo"] as RightTab[]).map((tab) => {
              const labels: Record<RightTab, string> = {
                brief: "Brief",
                seo: "SEO",
                geo: "GEO",
              };
              return (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                    rightTab === tab
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4">
            {/* ---- BRIEF TAB ---- */}
            {rightTab === "brief" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Contentbrief
                  </h2>
                  {briefEdited && (
                    <button
                      onClick={saveBrief}
                      disabled={savingBrief}
                      className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg transition-colors"
                    >
                      {savingBrief ? "Opslaan..." : "Opslaan"}
                    </button>
                  )}
                </div>

                {briefError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs mb-4">
                    {briefError}
                  </div>
                )}

                {generatingBrief ? (
                  <div className="flex flex-col items-center py-8 gap-3 text-gray-500">
                    <svg className="w-6 h-6 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" />
                    </svg>
                    <p className="text-sm">Brief genereren...</p>
                  </div>
                ) : brief ? (
                  <div className="space-y-5">
                    {/* Intent */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Zoekintentie</h3>
                      <textarea
                        value={brief.intent}
                        onChange={(e) => updateIntent(e.target.value)}
                        className="w-full text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Structure */}
                    <BriefSection
                      label="Artikelstructuur"
                      items={brief.structure}
                      section="structure"
                      editingItem={editingItem}
                      editingValue={editingValue}
                      editInputRef={editInputRef}
                      onStartEdit={startEdit}
                      onEditChange={setEditingValue}
                      onCommitEdit={commitEdit}
                      onCancelEdit={() => setEditingItem(null)}
                      onDelete={deleteItem}
                      onAdd={addItem}
                      renderPrefix={(item) => (
                        <span className="text-purple-400 text-xs font-semibold flex-shrink-0">
                          {item.startsWith("###") ? "H3" : item.startsWith("##") ? "H2" : "H1"}
                        </span>
                      )}
                      renderText={(item) => item.replace(/^#{1,3}\s*/, "")}
                    />

                    {/* Subtopics */}
                    <BriefSection
                      label="Subtopics"
                      items={brief.subtopics}
                      section="subtopics"
                      editingItem={editingItem}
                      editingValue={editingValue}
                      editInputRef={editInputRef}
                      onStartEdit={startEdit}
                      onEditChange={setEditingValue}
                      onCommitEdit={commitEdit}
                      onCancelEdit={() => setEditingItem(null)}
                      onDelete={deleteItem}
                      onAdd={addItem}
                      renderPrefix={(_, i) => (
                        <span className="text-indigo-400 font-semibold text-xs flex-shrink-0">{i + 1}.</span>
                      )}
                    />

                    {/* Questions */}
                    <BriefSection
                      label="Doelgroepvragen"
                      items={brief.questions}
                      section="questions"
                      editingItem={editingItem}
                      editingValue={editingValue}
                      editInputRef={editInputRef}
                      onStartEdit={startEdit}
                      onEditChange={setEditingValue}
                      onCommitEdit={commitEdit}
                      onCancelEdit={() => setEditingItem(null)}
                      onDelete={deleteItem}
                      onAdd={addItem}
                      renderPrefix={() => (
                        <span className="text-indigo-400 text-xs flex-shrink-0">?</span>
                      )}
                    />

                    <button
                      onClick={generateBrief}
                      disabled={isWorking}
                      className="w-full text-sm text-purple-600 hover:text-purple-800 py-2 border border-purple-200 hover:border-purple-400 rounded-lg transition-colors"
                    >
                      Brief opnieuw genereren
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500">
                      Nog geen brief. Klik op &ldquo;Genereer brief&rdquo; om te beginnen.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ---- SEO TAB ---- */}
            {rightTab === "seo" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    SEO-analyse
                  </h2>
                </div>

                <button
                  onClick={runSeoCheck}
                  disabled={loadingSeo}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {loadingSeo ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Analyseren...</>
                  ) : (
                    "SEO checken"
                  )}
                </button>

                {seoError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs">
                    {seoError}
                  </div>
                )}

                {seoResult && (
                  <div className="space-y-3">
                    {/* Total score */}
                    <div className={`rounded-xl p-4 text-center ${
                      seoResult.score >= 80
                        ? "bg-green-50 border border-green-200"
                        : seoResult.score >= 50
                        ? "bg-yellow-50 border border-yellow-200"
                        : "bg-red-50 border border-red-200"
                    }`}>
                      <div className={`text-4xl font-bold ${
                        seoResult.score >= 80
                          ? "text-green-600"
                          : seoResult.score >= 50
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}>
                        {seoResult.score}/100
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {seoResult.checks.filter(c => c.passed).length} van {seoResult.checks.length} checks geslaagd
                      </div>
                    </div>

                    {/* Checklist */}
                    <div className="space-y-2">
                      {seoResult.checks.map((check, i) => (
                        <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
                          check.passed
                            ? "bg-green-50 border-green-200 text-green-800"
                            : "bg-red-50 border-red-200 text-red-800"
                        }`}>
                          <span className="flex-shrink-0 mt-0.5 font-bold">
                            {check.passed ? "✓" : "✗"}
                          </span>
                          <span>{check.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!seoResult && !loadingSeo && !seoError && (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-xs">Klik op &ldquo;SEO checken&rdquo; om de analyse te starten.</p>
                  </div>
                )}
              </div>
            )}

            {/* ---- GEO TAB ---- */}
            {rightTab === "geo" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    GEO-module
                  </h2>
                </div>

                <button
                  onClick={runGeoCheck}
                  disabled={loadingGeo}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {loadingGeo ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Analyseren...</>
                  ) : (
                    "GEO checken"
                  )}
                </button>

                {geoError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs">
                    {geoError}
                  </div>
                )}

                {geoResult && (
                  <div className="space-y-3">
                    {/* GEO score */}
                    <div className={`rounded-xl p-4 text-center ${
                      geoResult.geoScore >= 70
                        ? "bg-blue-50 border border-blue-200"
                        : geoResult.geoScore >= 40
                        ? "bg-yellow-50 border border-yellow-200"
                        : "bg-red-50 border border-red-200"
                    }`}>
                      <div className={`text-4xl font-bold ${
                        geoResult.geoScore >= 70
                          ? "text-blue-600"
                          : geoResult.geoScore >= 40
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}>
                        {geoResult.geoScore}/100
                      </div>
                      <div className="text-xs text-gray-500 mt-1">GEO-score</div>
                    </div>

                    {/* Direct answer */}
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700">Directe beantwoording</span>
                        <span className={`text-xs font-bold ${
                          geoResult.directAnswerStatus === "good"
                            ? "text-green-600"
                            : geoResult.directAnswerStatus === "average"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}>
                          {geoResult.directAnswerScore}/100
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{geoResult.directAnswerFeedback}</p>
                    </div>

                    {/* Code-based checks */}
                    <div className="space-y-2">
                      <SeoCheckRow
                        status={geoResult.hasStatistics ? "good" : "bad"}
                        label="Statistieken"
                        detail={geoResult.hasStatistics ? "Cijfers/percentages aanwezig" : "Geen statistieken gevonden"}
                      />
                      <SeoCheckRow
                        status={geoResult.hasSourceReferences ? "good" : "bad"}
                        label="Bronvermeldingen"
                        detail={geoResult.hasSourceReferences ? "Bronnen aanwezig" : "Geen bronvermeldingen gevonden"}
                      />
                      <SeoCheckRow
                        status={
                          geoResult.freshnessStatus === "fresh"
                            ? "good"
                            : geoResult.freshnessStatus === "aging"
                            ? "warning"
                            : "bad"
                        }
                        label="Actualiteit"
                        detail={`${geoResult.daysSinceUpdate} dagen oud — ${
                          geoResult.freshnessStatus === "fresh"
                            ? "Actueel"
                            : geoResult.freshnessStatus === "aging"
                            ? "Verouderend"
                            : geoResult.freshnessStatus === "stale"
                            ? "Verouderd"
                            : "Sterk verouderd"
                        }`}
                      />
                    </div>

                    {/* Suggestions */}
                    {geoResult.suggestions.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-800 mb-2">Suggesties</p>
                        <ul className="space-y-1.5">
                          {geoResult.suggestions.map((s, i) => (
                            <li key={i} className="text-xs text-blue-700 flex gap-1.5">
                              <span className="flex-shrink-0 mt-0.5">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {!geoResult && !loadingGeo && !geoError && (
                  <div className="text-center py-6 text-gray-400">
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <p className="text-xs">Klik op &ldquo;GEO checken&rdquo; om de analyse te starten.</p>
                  </div>
                )}

                {/* Schema markup section */}
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={generateSchemaMarkup}
                    disabled={loadingSchema}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {loadingSchema ? (
                      <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4z" /></svg>Genereren...</>
                    ) : (
                      "Genereer Schema Markup"
                    )}
                  </button>

                  {schemaMarkup && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-700">JSON-LD Schema</span>
                        <button
                          onClick={copySchemaMarkup}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            schemaCopied
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                          }`}
                        >
                          {schemaCopied ? "Gekopieerd!" : "Kopieer"}
                        </button>
                      </div>
                      <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-auto max-h-64 leading-relaxed whitespace-pre-wrap break-all">
                        {schemaMarkup}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SEO check row helper component
// ---------------------------------------------------------------------------

function SeoCheckRow({
  status,
  label,
  detail,
}: {
  status: "good" | "warning" | "bad";
  label: string;
  detail: string;
}) {
  const icon =
    status === "good" ? (
      <span className="text-green-500 font-bold text-sm flex-shrink-0">&#10003;</span>
    ) : status === "warning" ? (
      <span className="text-yellow-500 font-bold text-sm flex-shrink-0">&#9888;</span>
    ) : (
      <span className="text-red-500 font-bold text-sm flex-shrink-0">&#10007;</span>
    );

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-start gap-2">
      {icon}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable brief section component (unchanged)
// ---------------------------------------------------------------------------

interface BriefSectionProps {
  label: string;
  items: string[];
  section: keyof Brief;
  editingItem: EditingItem;
  editingValue: string;
  editInputRef: React.RefObject<HTMLInputElement>;
  onStartEdit: (section: keyof Brief, index: number, value: string) => void;
  onEditChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (section: keyof Brief, index: number) => void;
  onAdd: (section: keyof Brief) => void;
  renderPrefix?: (item: string, index: number) => React.ReactNode;
  renderText?: (item: string) => string;
}

function BriefSection({
  label,
  items,
  section,
  editingItem,
  editingValue,
  editInputRef,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onAdd,
  renderPrefix,
  renderText,
}: BriefSectionProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label} ({items.length})
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => {
          const isEditing = editingItem?.section === section && editingItem?.index === i;
          return (
            <li key={i} className="group">
              {isEditing ? (
                <div className="flex gap-1 items-center">
                  <input
                    ref={editInputRef}
                    value={editingValue}
                    onChange={(e) => onEditChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCommitEdit();
                      if (e.key === "Escape") onCancelEdit();
                    }}
                    className="flex-1 text-sm border border-purple-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  <button onClick={onCommitEdit} className="text-green-600 hover:text-green-700 px-1 text-xs font-bold">&#10003;</button>
                  <button onClick={onCancelEdit} className="text-gray-400 hover:text-gray-600 px-1 text-xs">&#10007;</button>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 group-hover:border-gray-300 transition-colors">
                  {renderPrefix && renderPrefix(item, i)}
                  <span className="flex-1 text-sm text-gray-700 min-w-0">
                    {renderText ? renderText(item) : item}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => onStartEdit(section, i, renderText ? renderText(item) : item)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Bewerken"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(section, i)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Verwijderen"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        onClick={() => onAdd(section)}
        className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 border border-dashed border-gray-300 hover:border-gray-400 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Toevoegen
      </button>
    </div>
  );
}
