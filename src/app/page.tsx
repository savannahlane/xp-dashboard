import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { Shell } from "@/components/shell";
import { DataError } from "@/components/states";
import { loadBook } from "@/lib/book";
import { toDashboardDTO } from "@/lib/dto";
import { buildDashboard, filterFromSearch } from "@/lib/query";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string | string[]; xp?: string | string[] }>;
}) {
  await connection();
  const params = await searchParams;
  const loaded = loadBook();
  if (!loaded.ok) {
    return (
      <Shell>
        <DataError />
      </Shell>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const model = buildDashboard(loaded.book, filterFromSearch(params), today);
  return (
    <Shell>
      <Dashboard dto={toDashboardDTO(model)} />
    </Shell>
  );
}
