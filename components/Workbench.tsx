"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { EnrichedLead } from "@/lib/types";
import { LeadListItem } from "./LeadListItem";
import { LeadDetailPane } from "./LeadDetailPane";
import { Radar, Search, Upload, Download, ChevronRight, X } from "lucide-react";

type TierFilter = "all" | "hot" | "warm" | "nurture" | "park";

interface Props {
  leads: EnrichedLead[];
}

// Split-pane workbench. Left: filterable, keyboard-navigable list.
// Right: selected lead detail. URL param ?id= keeps selection deep-linkable.
//
// Keyboard shortcuts (visible in the footer):
//   j / ↓   next lead
//   k / ↑   prev lead
//   /       focus search
//   Esc     clear search / blur
//   e       open email client for selected lead
//   c       copy selected email address

export function Workbench({ leads }: Props) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<TierFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(leads[0]?.id ?? null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Derive the filtered + tier-sorted list.
  const tierOrder: Record<EnrichedLead["score"]["tier"], number> = { hot: 0, warm: 1, nurture: 2, park: 3 };
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...leads].sort((a, b) => {
      const t = tierOrder[a.score.tier] - tierOrder[b.score.tier];
      if (t !== 0) return t;
      return b.score.total - a.score.total;
    });
    return sorted.filter((l) => {
      if (tier !== "all" && l.score.tier !== tier) return false;
      if (!q) return true;
      return (
        l.input.company.toLowerCase().includes(q) ||
        l.input.name.toLowerCase().includes(q) ||
        l.input.email.toLowerCase().includes(q) ||
        l.input.city.toLowerCase().includes(q) ||
        l.input.state.toLowerCase().includes(q)
      );
    });
    // tierOrder in the sort closure can't escape here, leaving silent on lint
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, query, tier]);

  // Tier counts for the filter chips
  const counts = useMemo(() => {
    const c: Record<TierFilter, number> = { all: leads.length, hot: 0, warm: 0, nurture: 0, park: 0 };
    for (const l of leads) c[l.score.tier]++;
    return c;
  }, [leads]);

  const selected = useMemo(
    () => filtered.find((l) => l.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  // Auto-select first item when the filter changes
  useEffect(() => {
    if (!selected && filtered[0]) setSelectedId(filtered[0].id);
    if (selected && !filtered.find((l) => l.id === selected.id) && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selected]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "Escape") {
        if (isInput) (target as HTMLElement).blur();
        if (query) setQuery("");
        return;
      }
      if (isInput) return; // don't steal typing

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const idx = filtered.findIndex((l) => l.id === selected?.id);
        const next = filtered[Math.min(filtered.length - 1, idx + 1)];
        if (next) setSelectedId(next.id);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = filtered.findIndex((l) => l.id === selected?.id);
        const prev = filtered[Math.max(0, idx - 1)];
        if (prev) setSelectedId(prev.id);
        return;
      }
      if (e.key === "e" && selected?.draftEmail) {
        e.preventDefault();
        const m = `mailto:${encodeURIComponent(selected.input.email)}?subject=${encodeURIComponent(selected.draftEmail.subject)}&body=${encodeURIComponent(selected.draftEmail.body)}`;
        window.location.href = m;
        return;
      }
      if (e.key === "c" && selected) {
        e.preventDefault();
        navigator.clipboard.writeText(selected.input.email).catch(() => {});
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected, query]);

  return (
    <div className="h-screen flex flex-col bg-[var(--ink-50)]">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--ink-200)] bg-[var(--ink-0)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Radar className="w-[18px] h-[18px] text-[var(--ink-900)]" />
          <span className="font-semibold text-[14px] tracking-tight">Elise Lead Radar</span>
          <span className="text-[11px] text-[var(--ink-400)] hidden md:inline ml-1">
            inbound enrichment · "why now?" detection
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/upload" className="btn btn-secondary btn-sm">
            <Upload className="w-3.5 h-3.5" /> Add leads
          </Link>
          <a href="/api/export" className="btn btn-secondary btn-sm">
            <Download className="w-3.5 h-3.5" /> Export
          </a>
        </div>
      </header>

      {/* Body: split pane */}
      <div className="flex-1 flex min-h-0">
        {/* Left — list */}
        <aside className="w-[380px] flex-shrink-0 border-r border-[var(--ink-200)] bg-[var(--ink-0)] flex flex-col min-h-0">
          {/* Search */}
          <div className="p-2.5 border-b border-[var(--ink-200)] flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-400)]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search leads…"
                className="input pl-7 pr-16 text-[12px] py-1.5"
              />
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-400)] hover:text-[var(--ink-900)]"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <span className="kbd absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">/</span>
              )}
            </div>

            {/* Tier filters */}
            <div className="flex items-center gap-1 mt-2 overflow-x-auto scroll-thin">
              <FilterChip label="All" count={counts.all} active={tier === "all"} onClick={() => setTier("all")} />
              <FilterChip label="Hot" count={counts.hot} active={tier === "hot"} onClick={() => setTier("hot")} tone="tier-hot" />
              <FilterChip label="Warm" count={counts.warm} active={tier === "warm"} onClick={() => setTier("warm")} tone="tier-warm" />
              <FilterChip label="Nurture" count={counts.nurture} active={tier === "nurture"} onClick={() => setTier("nurture")} tone="tier-nurture" />
              <FilterChip label="Park" count={counts.park} active={tier === "park"} onClick={() => setTier("park")} tone="tier-park" />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto scroll-thin min-h-0">
            {filtered.length === 0 ? (
              <EmptyList hasQuery={!!query || tier !== "all"} />
            ) : (
              filtered.map((l) => (
                <LeadListItem
                  key={l.id}
                  lead={l}
                  selected={selected?.id === l.id}
                  onSelect={() => setSelectedId(l.id)}
                />
              ))
            )}
          </div>

          {/* Footer — shortcut hints */}
          <div className="border-t border-[var(--ink-200)] px-3 py-2 flex items-center gap-3 text-[10px] text-[var(--ink-500)] flex-shrink-0">
            <span className="inline-flex items-center gap-1"><span className="kbd">j</span><span className="kbd">k</span>nav</span>
            <span className="inline-flex items-center gap-1"><span className="kbd">/</span>search</span>
            <span className="inline-flex items-center gap-1"><span className="kbd">e</span>email</span>
            <span className="inline-flex items-center gap-1"><span className="kbd">c</span>copy</span>
          </div>
        </aside>

        {/* Right — detail */}
        <main className="flex-1 min-w-0 bg-[var(--ink-0)]">
          {selected ? (
            <LeadDetailPane lead={selected} />
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--ink-500)] text-sm">
              <div className="text-center">
                <ChevronRight className="w-5 h-5 mx-auto mb-2 opacity-50" />
                Select a lead
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterChip({
  label, count, active, onClick, tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap
        ${active
          ? "bg-[var(--ink-950)] text-white border-[var(--ink-950)]"
          : `bg-[var(--ink-0)] text-[var(--ink-600)] border-[var(--ink-200)] hover:border-[var(--ink-400)]`
        }
      `}
    >
      {!active && tone && <span className={`w-1.5 h-1.5 rounded-full accent-${label.toLowerCase()}`} />}
      {label}
      <span className={`num text-[10px] ${active ? "text-white/70" : "text-[var(--ink-400)]"}`}>{count}</span>
    </button>
  );
}

function EmptyList({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="p-8 text-center">
      <Radar className="w-8 h-8 mx-auto mb-2 text-[var(--ink-300)]" />
      {hasQuery ? (
        <>
          <p className="text-[13px] text-[var(--ink-700)] font-medium">No matches</p>
          <p className="text-[11px] text-[var(--ink-500)] mt-0.5">Try a different search or clear filters.</p>
        </>
      ) : (
        <>
          <p className="text-[13px] text-[var(--ink-700)] font-medium">No leads yet</p>
          <p className="text-[11px] text-[var(--ink-500)] mt-1 mb-3">Add leads to start triaging.</p>
          <Link href="/upload" className="btn btn-primary btn-sm">Add a lead</Link>
        </>
      )}
    </div>
  );
}
