"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientContext } from "@/components/ClientContext";

interface Client {
  id: string;
  name: string;
  industry?: string | null;
  createdAt: string;
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-blue-500",
  "bg-teal-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-red-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ClientsPage() {
  const router = useRouter();
  const { setClient } = useClientContext();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New client form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Fout bij het ophalen van klanten");
      const data: Client[] = await res.json();
      setClients(data);
      if (data.length === 0) {
        setShowForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(client: Client) {
    setClient({ id: client.id, name: client.name, industry: client.industry });
    router.push("/dashboard");
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!newName.trim()) {
      setFormError("Naam is verplicht");
      return;
    }

    try {
      setFormLoading(true);
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          industry: newIndustry.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fout bij het aanmaken van de klant");
      }

      const created: Client = await res.json();
      setClient({ id: created.id, name: created.name, industry: created.industry });
      router.push("/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Onbekende fout");
      setFormLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Klanten</h1>
        <p className="text-gray-500 mt-1">
          Selecteer een klant om mee te werken of maak een nieuwe klant aan
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-gray-500">
            <svg
              className="w-5 h-5 animate-spin"
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
            Klanten laden...
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchClients}
            className="mt-3 text-sm text-red-600 underline hover:no-underline"
          >
            Probeer opnieuw
          </button>
        </div>
      ) : (
        <>
          {/* Client grid */}
          {clients.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {clients.map((client) => {
                const avatarColor = getAvatarColor(client.name);
                return (
                  <div
                    key={client.id}
                    className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div
                        className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}
                      >
                        <span className="text-white text-lg font-bold uppercase">
                          {client.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-gray-900 truncate">
                          {client.name}
                        </h2>
                        {client.industry && (
                          <p className="text-sm text-gray-500 truncate">
                            {client.industry}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelect(client)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                    >
                      Selecteer
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state when no clients */}
          {clients.length === 0 && !showForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center mb-8">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nog geen klanten
              </h3>
              <p className="text-gray-500 mb-6">
                Maak je eerste klant aan om te beginnen.
              </p>
            </div>
          )}

          {/* Add new client button */}
          {clients.length > 0 && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 border border-dashed border-gray-300 hover:border-indigo-400 text-gray-500 hover:text-indigo-600 px-5 py-3 rounded-xl text-sm font-medium transition-colors mb-8"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Nieuwe klant
            </button>
          )}

          {/* New client form */}
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {clients.length === 0 ? "Eerste klant aanmaken" : "Nieuwe klant"}
              </h2>
              <form onSubmit={handleCreateClient} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                    {formError}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="clientName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Naam <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="clientName"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Bijv. Acme BV"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    htmlFor="clientIndustry"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Branche{" "}
                    <span className="text-gray-400 font-normal">(optioneel)</span>
                  </label>
                  <input
                    id="clientIndustry"
                    type="text"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    placeholder="Bijv. E-commerce, Bouw, Zorg"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={formLoading || !newName.trim()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    {formLoading ? (
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
                      "Klant aanmaken"
                    )}
                  </button>
                  {clients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setNewName("");
                        setNewIndustry("");
                        setFormError(null);
                      }}
                      className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
                      Annuleren
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
