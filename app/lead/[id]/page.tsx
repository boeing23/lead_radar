import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead } from "@/lib/storage";
import { LeadDetailPane } from "@/components/LeadDetailPane";
import { Radar, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

// Deep-link / share target. The main UX is the Workbench split-pane at /.
// This route exists so a rep can forward a URL to a teammate and land
// directly on a specific lead.
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return notFound();

  return (
    <div className="h-screen flex flex-col bg-[var(--ink-50)]">
      <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--ink-200)] bg-[var(--ink-0)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/" className="btn btn-ghost btn-sm">
            <ArrowLeft className="w-3.5 h-3.5" /> All leads
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Radar className="w-[18px] h-[18px] text-[var(--ink-900)]" />
          <span className="font-semibold text-[14px] tracking-tight">Elise Lead Radar</span>
        </div>
      </header>
      <main className="flex-1 min-h-0 bg-[var(--ink-0)]">
        <LeadDetailPane lead={lead} />
      </main>
    </div>
  );
}
