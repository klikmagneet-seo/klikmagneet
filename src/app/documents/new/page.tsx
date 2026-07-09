"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSelectedClientId } from "@/lib/clientContext";

export default function NewDocument() {
  const router = useRouter();
  const [targetKeyword, setTargetKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const id = getSelectedClientId();
    if (!id) {
      router.replace("/clients");
      return;
    }
    setClientId(id);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!targetKeyword.trim()) {
      setError("Vul een doelzoekwoord in");
      return;
    }

    if (!clientId) {
      router.replace("/clients");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim(),
          title: title.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fout bij het aanmaken van document");
      }

      const document = await response.json();
      router.push(`/documents/${document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
      setLoading(false);
    }
  }

  if (!clientId) {
    return null;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Terug naar dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nieuw document</h1>
        <p className="text-gray-500 mt-1">
          Maak een nieuw AI-document aan door een zoekwoord in te voeren
        </p>
      </div>

      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="targetKeyword"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Doelzoekwoord{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              id="targetKeyword"
              type="text"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="Bijv. beste laminaatvloer kopen"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Het primaire zoekwoord waarop dit artikel moet scoren
            </p>
          </div>

          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Titel{" "}
              <span className="text-gray-400 font-normal">(optioneel)</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Laat leeg om het zoekwoord als titel te gebruiken"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Interne naam voor dit document
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !targetKeyword.trim()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Aanmaken...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Document aanmaken
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Info */}
      <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl p-6">
        <h3 className="font-semibold text-indigo-900 mb-3">
          Hoe werkt het?
        </h3>
        <ol className="space-y-2 text-sm text-indigo-700">
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">1.</span>
            <span>Voer een zoekwoord in en maak het document aan</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">2.</span>
            <span>
              Klik op &ldquo;Genereer brief&rdquo; om een contentbrief te
              maken met subtopics, vragen en structuur
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">3.</span>
            <span>
              Klik op &ldquo;Genereer tekst&rdquo; om een volledig SEO-artikel
              te schrijven op basis van de brief
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">4.</span>
            <span>
              Bewerk de gegenereerde tekst en sla hem op
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
