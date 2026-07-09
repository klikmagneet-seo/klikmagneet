"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClientContext } from "@/components/ClientContext";
import { getSelectedClientId } from "@/lib/clientContext";

interface Document {
  id: string;
  title: string;
  targetKeyword: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type TabView = "kanban" | "kalender" | "searchconsole";

const statusConfig: Record<
  string,
  { label: string; badgeClass: string; headerClass: string; dotClass: string }
> = {
  draft: {
    label: "Concept",
    badgeClass: "bg-gray-100 text-gray-700",
    headerClass: "bg-gray-200 text-gray-800",
    dotClass: "bg-gray-400",
  },
  in_review: {
    label: "In review",
    badgeClass: "bg-yellow-100 text-yellow-700",
    headerClass: "bg-yellow-200 text-yellow-800",
    dotClass: "bg-yellow-400",
  },
  revised: {
    label: "Herzien",
    badgeClass: "bg-blue-100 text-blue-700",
    headerClass: "bg-blue-200 text-blue-800",
    dotClass: "bg-blue-400",
  },
  published: {
    label: "Gepubliceerd",
    badgeClass: "bg-green-100 text-green-700",
    headerClass: "bg-green-200 text-green-800",
    dotClass: "bg-green-400",
  },
};

const KANBAN_COLUMNS: Array<{ status: string; label: string }> = [
  { status: "draft", label: "Concept" },
  { status: "in_review", label: "In review" },
  { status: "revised", label: "Herzien" },
  { status: "published", label: "Gepubliceerd" },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "vandaag";
  if (diffDays === 1) return "gisteren";
  if (diffDays < 7) return `${diffDays} dagen geleden`;
  if (diffDays < 14) return "1 week geleden";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weken geleden`;
  if (diffDays < 60) return "1 maand geleden";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} maanden geleden`;
  if (diffDays < 730) return "1 jaar geleden";
  return `${Math.floor(diffDays / 365)} jaar geleden`;
}

function getDaysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function RefreshBadge({ daysSince }: { daysSince: number }) {
  if (daysSince < 90) {
    return (
      <span className="inline-flex items-center gap-1 text-green-700 font-medium text-sm">
        <span>✓</span> Actueel
      </span>
    );
  }
  if (daysSince < 180) {
    return (
      <span className="inline-flex items-center gap-1 text-yellow-700 font-medium text-sm">
        <span>⚠</span> Binnenkort
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-700 font-medium text-sm">
      <span>✗</span> Verouderd — refresh
    </span>
  );
}

function KanbanView({ documents }: { documents: Document[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const config = statusConfig[col.status] ?? statusConfig.draft;
        const colDocs = documents.filter((d) => d.status === col.status);
        return (
          <div key={col.status} className="flex flex-col min-h-[400px]">
            {/* Column header */}
            <div
              className={`flex items-center justify-between px-4 py-2.5 rounded-t-lg font-semibold text-sm ${config.headerClass}`}
            >
              <span>{col.label}</span>
              <span className="bg-white bg-opacity-60 rounded-full px-2 py-0.5 text-xs font-bold">
                {colDocs.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 bg-gray-50 rounded-b-lg p-2 space-y-2 overflow-y-auto">
              {colDocs.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-gray-400 text-sm italic">
                  Geen documenten
                </div>
              ) : (
                colDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="block bg-white rounded-lg shadow-sm border border-gray-100 px-4 py-3 hover:shadow-md hover:border-indigo-200 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-gray-900 text-sm leading-snug group-hover:text-indigo-700 transition-colors">
                        {doc.title || "Naamloos document"}
                      </span>
                      <span
                        className={`mt-0.5 flex-shrink-0 w-2.5 h-2.5 rounded-full ${config.dotClass}`}
                      />
                    </div>
                    {doc.targetKeyword && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {doc.targetKeyword}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {formatRelativeDate(doc.updatedAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KalenderView({ documents }: { documents: Document[] }) {
  const sorted = [...documents].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
  );

  const needRefreshCount = sorted.filter(
    (d) => getDaysSince(d.updatedAt) >= 90
  ).length;

  return (
    <div>
      {/* Summary banner */}
      {needRefreshCount > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-amber-600 text-lg">⚠</span>
          <p className="text-amber-800 font-medium text-sm">
            {needRefreshCount}{" "}
            {needRefreshCount === 1 ? "document heeft" : "documenten hebben"}{" "}
            een refresh nodig
          </p>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500">Geen documenten gevonden.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Titel
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Keyword
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Laatste update
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Refresh nodig?
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((doc) => {
                const config =
                  statusConfig[doc.status] ?? statusConfig.draft;
                const daysSince = getDaysSince(doc.updatedAt);
                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="font-medium text-gray-900 hover:text-indigo-700 transition-colors"
                      >
                        {doc.title || "Naamloos document"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {doc.targetKeyword || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.badgeClass}`}
                      >
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {formatDate(doc.updatedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <RefreshBadge daysSince={daysSince} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface GscStatus {
  connected: boolean;
  siteUrl: string | null;
  lastSync: string | null;
  notConfigured?: boolean;
}

interface GscQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscPage {
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscData {
  topQueries: GscQuery[];
  topPages: GscPage[];
  clicksOverTime: { date: string; clicks: number }[];
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
}

function formatCtr(ctr: number): string {
  return (ctr * 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + "%";
}

function formatPosition(pos: number): string {
  return pos.toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function SearchConsoleView({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<GscStatus | null>(null);
  const [gscData, setGscData] = useState<GscData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, [clientId]);

  async function fetchStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/gsc/status`);
      const data: GscStatus = await res.json();
      setStatus(data);
      if (data.connected) {
        fetchGscData();
      }
    } finally {
      setLoadingStatus(false);
    }
  }

  async function fetchGscData() {
    const res = await fetch(`/api/clients/${clientId}/gsc/data`);
    if (res.ok) {
      const data: GscData = await res.json();
      setGscData(data);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/gsc/sync`, { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        setSyncMessage(`${result.rowsImported} rijen geïmporteerd.`);
        await fetchStatus();
      } else {
        setSyncMessage(result.error ?? "Synchronisatie mislukt.");
      }
    } catch {
      setSyncMessage("Synchronisatie mislukt.");
    } finally {
      setSyncing(false);
    }
  }

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Laden...
        </div>
      </div>
    );
  }

  if (status?.notConfigured) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Google-credentials niet ingesteld</h3>
        <p className="text-gray-500 text-sm mb-6">
          Voeg <code className="bg-gray-100 px-1 rounded">GOOGLE_CLIENT_ID</code> en{" "}
          <code className="bg-gray-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> toe aan je{" "}
          <code className="bg-gray-100 px-1 rounded">.env</code>-bestand. Maak deze aan via Google Cloud Console → APIs &amp; Services → Credentials.
        </p>
        <ol className="text-left text-sm text-gray-600 space-y-1 mb-6 list-decimal list-inside">
          <li>Ga naar <strong>console.cloud.google.com</strong></li>
          <li>Activeer de <strong>Google Search Console API</strong></li>
          <li>Maak OAuth 2.0-credentials aan (type: Web application)</li>
          <li>Voeg redirect URI toe en kopieer Client ID + Secret naar <code className="bg-gray-100 px-1 rounded">.env</code></li>
        </ol>
        <p className="text-xs text-gray-400">Herstart daarna de dev server en kom hier terug.</p>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Google Search Console</h3>
        <p className="text-gray-500 mb-6">
          Koppel Google Search Console om zoekprestaties te bekijken.
        </p>
        <a
          href={`/api/clients/${clientId}/gsc/connect`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Verbind Google Search Console
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection info bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-green-700 font-medium text-sm">
            <span>&#10003;</span> Verbonden
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-600 font-mono">{status.siteUrl}</span>
          {status.lastSync && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-400">
                Laatste sync: {new Date(status.lastSync).toLocaleString("nl-NL")}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {syncMessage && (
            <span className="text-sm text-gray-600">{syncMessage}</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync nu
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {gscData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: "Totaal clicks", value: gscData.totalClicks.toLocaleString("nl-NL"), color: "bg-blue-50 text-blue-700" },
              { label: "Totaal vertoningen", value: gscData.totalImpressions.toLocaleString("nl-NL"), color: "bg-indigo-50 text-indigo-700" },
              { label: "Gem. CTR", value: formatCtr(gscData.avgCtr), color: "bg-green-50 text-green-700" },
              { label: "Gem. positie", value: formatPosition(gscData.avgPosition), color: "bg-orange-50 text-orange-700" },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm font-medium mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Top queries table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Top zoekopdrachten</h3>
            </div>
            {gscData.topQueries.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-400 text-sm">Nog geen data beschikbaar. Doe een sync om data op te halen.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Zoekopdracht</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vertoningen</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Positie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gscData.topQueries.slice(0, 10).map((q) => (
                    <tr key={q.query} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-900 font-medium">{q.query}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{q.clicks.toLocaleString("nl-NL")}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{q.impressions.toLocaleString("nl-NL")}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{formatCtr(q.ctr)}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{formatPosition(q.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top pages table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Top pagina&#39;s</h3>
            </div>
            {gscData.topPages.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-400 text-sm">Nog geen data beschikbaar. Doe een sync om data op te halen.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">URL</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vertoningen</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Positie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gscData.topPages.slice(0, 10).map((p) => (
                    <tr key={p.pageUrl} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-900 font-medium max-w-xs truncate">
                        <a href={p.pageUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">{p.pageUrl}</a>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{p.clicks.toLocaleString("nl-NL")}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{p.impressions.toLocaleString("nl-NL")}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{formatCtr(p.ctr)}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{formatPosition(p.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { selectedClient } = useClientContext();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("kanban");

  useEffect(() => {
    const id = getSelectedClientId();
    if (!id) {
      router.replace("/clients");
      return;
    }
    setClientId(id);
  }, [router]);

  useEffect(() => {
    if (clientId) {
      fetchDocuments(clientId);
    }
  }, [clientId]);

  async function fetchDocuments(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${id}/documents`);
      if (!response.ok) {
        throw new Error("Fout bij het ophalen van documenten");
      }
      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }

  if (!clientId) {
    return null;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {selectedClient
              ? `Documenten voor ${selectedClient.name}`
              : "Beheer al je AI-gegenereerde documenten"}
          </p>
        </div>
        <Link
          href="/documents/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
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
          + Nieuw document
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Totaal",
            count: documents.length,
            color: "bg-indigo-50 text-indigo-700",
            icon: "📄",
          },
          {
            label: "Concept",
            count: documents.filter((d) => d.status === "draft").length,
            color: "bg-gray-50 text-gray-700",
            icon: "✏️",
          },
          {
            label: "In review",
            count: documents.filter((d) => d.status === "in_review").length,
            color: "bg-yellow-50 text-yellow-700",
            icon: "🔍",
          },
          {
            label: "Gepubliceerd",
            count: documents.filter((d) => d.status === "published").length,
            color: "bg-green-50 text-green-700",
            icon: "✅",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`${stat.color} rounded-xl p-4 flex items-center gap-3`}
          >
            <span className="text-2xl">{stat.icon}</span>
            <div>
              <div className="text-2xl font-bold">{stat.count}</div>
              <div className="text-sm font-medium">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setActiveTab("kanban")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === "kanban"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Kanban-bord
        </button>
        <button
          onClick={() => setActiveTab("kalender")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === "kalender"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Kalender / Refresh-overzicht
        </button>
        <button
          onClick={() => setActiveTab("searchconsole")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === "searchconsole"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Search Console
        </button>
      </div>

      {/* Content */}
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
            Documenten laden...
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => clientId && fetchDocuments(clientId)}
            className="mt-3 text-sm text-red-600 underline hover:no-underline"
          >
            Probeer opnieuw
          </button>
        </div>
      ) : activeTab === "searchconsole" ? (
        <SearchConsoleView clientId={clientId} />
      ) : documents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nog geen documenten
          </h3>
          <p className="text-gray-500 mb-6">
            Maak je eerste AI-gegenereerde document aan om te beginnen.
          </p>
          <Link
            href="/documents/new"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
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
            Nieuw document aanmaken
          </Link>
        </div>
      ) : activeTab === "kanban" ? (
        <KanbanView documents={documents} />
      ) : (
        <KalenderView documents={documents} />
      )}
    </div>
  );
}
