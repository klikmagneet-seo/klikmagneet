"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

interface BrandSettings {
  toneOfVoice: string;
  preferredWords: string[];
  forbiddenWords: string[];
  styleRules: string;
}

interface StyleExample {
  id: string;
  clientId: string;
  title: string;
  content: string;
  aiStyleSummary: string | null;
  createdAt: string;
}

// ---- Tag Input Component ----
function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(value: string) {
    const trimmed = value.trim().replace(/,+$/, "").trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div
      className="min-h-[42px] flex flex-wrap gap-2 items-center border border-gray-300 rounded-lg px-3 py-2 bg-white cursor-text focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-sm font-medium px-2.5 py-0.5 rounded-full"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            className="ml-0.5 text-indigo-500 hover:text-indigo-700 focus:outline-none"
            aria-label={`Verwijder ${tag}`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => {
          const val = e.target.value;
          if (val.endsWith(",")) {
            addTag(val);
          } else {
            setInputValue(val);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue);
        }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400"
      />
    </div>
  );
}

// ---- Main Settings Page ----
export default function SettingsPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);

  // Brand settings state
  const [settings, setSettings] = useState<BrandSettings>({
    toneOfVoice: "",
    preferredWords: [],
    forbiddenWords: [],
    styleRules: "",
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Style examples state
  const [examples, setExamples] = useState<StyleExample[]>([]);
  const [examplesLoading, setExamplesLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [addingExample, setAddingExample] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Read clientId from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("klikmagneet_client_id");
    if (!stored) {
      router.push("/clients");
      return;
    }
    setClientId(stored);
  }, [router]);

  // Load settings when clientId is set
  useEffect(() => {
    if (!clientId) return;

    setSettingsLoading(true);
    fetch(`/api/clients/${clientId}/settings`)
      .then((r) => r.json())
      .then((data: BrandSettings) => {
        setSettings(data);
      })
      .catch((err) => console.error("Error loading settings:", err))
      .finally(() => setSettingsLoading(false));
  }, [clientId]);

  // Load style examples when clientId is set
  useEffect(() => {
    if (!clientId) return;
    loadExamples();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function loadExamples() {
    if (!clientId) return;
    setExamplesLoading(true);
    fetch(`/api/clients/${clientId}/style-examples`)
      .then((r) => r.json())
      .then((data: StyleExample[]) => setExamples(data))
      .catch((err) => console.error("Error loading style examples:", err))
      .finally(() => setExamplesLoading(false));
  }

  async function saveSettings() {
    if (!clientId) return;
    setSettingsSaving(true);
    setSettingsSaved(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function addExample() {
    if (!clientId) return;
    if (!newTitle.trim() || !newContent.trim()) {
      setAddError("Vul zowel een titel als de tekst in.");
      return;
    }
    setAddError(null);
    setAddingExample(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/style-examples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Er is een fout opgetreden");
      }
      setNewTitle("");
      setNewContent("");
      loadExamples();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Er is een fout opgetreden");
    } finally {
      setAddingExample(false);
    }
  }

  async function deleteExample(exampleId: string) {
    if (!clientId) return;
    try {
      const res = await fetch(
        `/api/clients/${clientId}/style-examples/${exampleId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Verwijderen mislukt");
      setExamples((prev) => prev.filter((e) => e.id !== exampleId));
    } catch (err) {
      console.error("Error deleting example:", err);
    }
  }

  if (!clientId) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Instellingen</h1>
        <p className="text-gray-500 mt-1">
          Configureer de schrijfstijl en kennisbank voor deze klant
        </p>
      </div>

      {/* Section 1: Schrijfstijl */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Schrijfstijl
        </h2>

        {settingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tone of voice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tone of voice
              </label>
              <textarea
                value={settings.toneOfVoice}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, toneOfVoice: e.target.value }))
                }
                placeholder="Bijv.: vriendelijk en toegankelijk, maar professioneel. Gebruik actieve zinnen."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Voorkeurswoorden */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Voorkeurswoorden
              </label>
              <TagInput
                tags={settings.preferredWords}
                onChange={(tags) =>
                  setSettings((s) => ({ ...s, preferredWords: tags }))
                }
                placeholder="Voeg woord toe en druk op Enter of komma..."
              />
              <p className="text-xs text-gray-400 mt-1">
                Druk op Enter of komma om een woord toe te voegen
              </p>
            </div>

            {/* Verboden woorden */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Verboden woorden
              </label>
              <TagInput
                tags={settings.forbiddenWords}
                onChange={(tags) =>
                  setSettings((s) => ({ ...s, forbiddenWords: tags }))
                }
                placeholder="Voeg verboden woord toe en druk op Enter of komma..."
              />
              <p className="text-xs text-gray-400 mt-1">
                Druk op Enter of komma om een woord toe te voegen
              </p>
            </div>

            {/* Overige schrijfregels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Overige schrijfregels
              </label>
              <textarea
                value={settings.styleRules}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, styleRules: e.target.value }))
                }
                placeholder="Bijv.: schrijf altijd in jij-vorm, vermijd jargon, max 2 zinnen per alinea"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveSettings}
                disabled={settingsSaving}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {settingsSaving && (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Instellingen opslaan
              </button>
              {settingsSaved && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Opgeslagen
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Voorbeeldteksten */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Voorbeeldteksten
        </h2>

        {/* Existing examples */}
        {examplesLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : examples.length === 0 ? (
          <p className="text-sm text-gray-500 mb-6">
            Nog geen voorbeeldteksten toegevoegd. Voeg hieronder een tekst toe om de AI te helpen de schrijfstijl van deze klant te leren.
          </p>
        ) : (
          <div className="space-y-4 mb-6">
            {examples.map((example) => (
              <div
                key={example.id}
                className="border border-gray-200 rounded-lg p-4 relative"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {example.title}
                  </h3>
                  <button
                    onClick={() => deleteExample(example.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                    title="Verwijder voorbeeldtekst"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {example.content.slice(0, 100)}
                  {example.content.length > 100 ? "..." : ""}
                </p>
                {example.aiStyleSummary && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      AI-stijlanalyse
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {example.aiStyleSummary}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new example form */}
        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Voorbeeldtekst toevoegen
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Titel
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Bijv.: Nieuwsbrief oktober 2024"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tekst
              </label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Plak hier een voorbeeldtekst van deze klant..."
                rows={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            {addError && (
              <p className="text-sm text-red-600">{addError}</p>
            )}

            <button
              onClick={addExample}
              disabled={addingExample}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingExample ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyseren...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Opslaan &amp; analyseren
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
