import { readLeads } from "@/lib/storage";
import { Workbench } from "@/components/Workbench";

export const dynamic = "force-dynamic";

export default async function Home() {
  const leads = await readLeads();
  return <Workbench leads={leads} />;
}
