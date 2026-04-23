"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Upload, Radar, FileText } from "lucide-react";
import type { EnrichedLead, LeadInput } from "@/lib/types";

const SAMPLE: LeadInput = {
  name: "Alex Chen",
  email: "alex.chen@acme-residential.com",
  company: "Acme Residential",
  propertyAddress: "1234 Market St",
  city: "San Francisco",
  state: "CA",
  country: "USA",
};

export default function UploadPage() {
  const router = useRouter();
  const [form, setForm] = useState<LeadInput>({
    name: "", email: "", company: "",
    propertyAddress: "", city: "", state: "", country: "USA",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvProgress, setCsvProgress] = useState<{ done: number; total: number } | null>(null);

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "request failed" }));
      setError(j.error ?? "request failed");
      setBusy(false);
      return;
    }
    const enriched: EnrichedLead = await res.json();
    router.push(`/?id=${enriched.id}`);
    router.refresh();
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvBusy(true);
    setError(null);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const colIdx = (name: string) => header.indexOf(name);
    const rows: LeadInput[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const get = (key: string, alt?: string) =>
        cells[colIdx(key)] ?? (alt ? cells[colIdx(alt)] : "") ?? "";
      rows.push({
        name: get("name"),
        email: get("email"),
        company: get("company"),
        propertyAddress: get("propertyaddress", "property_address"),
        city: get("city"),
        state: get("state"),
        country: get("country") || "USA",
      });
    }
    setCsvProgress({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i++) {
      await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows[i]),
      });
      setCsvProgress({ done: i + 1, total: rows.length });
    }
    setCsvBusy(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--ink-50)]">
      <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--ink-200)] bg-[var(--ink-0)]">
        <Link href="/" className="btn btn-ghost btn-sm">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to pipeline
        </Link>
        <div className="flex items-center gap-2">
          <Radar className="w-[18px] h-[18px]" />
          <span className="font-semibold text-[14px] tracking-tight">Elise Lead Radar</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-[22px] font-semibold tracking-tight mb-1">Add leads</h1>
        <p className="text-[13px] text-[var(--ink-500)] mb-6">
          Enter a single lead or upload a CSV. Enrichment runs in 5-15 seconds per lead.
        </p>

        {/* CSV upload */}
        <div className="surface p-5 mb-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-[var(--ink-100)] flex-shrink-0">
              <FileText className="w-4 h-4 text-[var(--ink-700)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-[14px] mb-1">Upload CSV</h2>
              <p className="text-[12px] text-[var(--ink-600)] mb-3">
                Columns: <code className="text-[var(--ink-700)] bg-[var(--ink-100)] px-1 py-0.5 rounded text-[11px]">name, email, company, propertyAddress, city, state, country</code>
              </p>
              <label className={`btn ${csvBusy ? "btn-secondary" : "btn-primary"} btn-sm cursor-pointer`}>
                {csvBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enriching {csvProgress?.done}/{csvProgress?.total}…
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" /> Choose file
                  </>
                )}
                <input type="file" accept=".csv" className="hidden" onChange={handleCsv} disabled={csvBusy} />
              </label>
              <p className="text-[11px] text-[var(--ink-500)] mt-2">
                Or from CLI: <code className="text-[var(--ink-700)]">npm run enrich:csv -- data/sample-leads.csv</code>
              </p>
            </div>
          </div>
        </div>

        {/* Single lead form */}
        <form onSubmit={submitSingle} className="surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[14px]">Or add one manually</h2>
            <button
              type="button"
              className="text-[11px] text-[var(--ink-600)] hover:text-[var(--ink-950)] underline-offset-2 hover:underline"
              onClick={() => setForm(SAMPLE)}
            >
              fill sample
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <div className="col-span-2">
              <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
            </div>
            <div className="col-span-2">
              <Field label="Property address" value={form.propertyAddress} onChange={(v) => setForm({ ...form, propertyAddress: v })} />
            </div>
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="State (2-letter)" value={form.state} onChange={(v) => setForm({ ...form, state: v.toUpperCase() })} maxLength={2} />
              <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            </div>
          </div>

          {error && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enriching (10-30s)
              </>
            ) : (
              "Enrich lead"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        maxLength={maxLength}
        className="input mt-1"
      />
    </label>
  );
}
