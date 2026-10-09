import Link from "next/link";
import { Shell } from "@/components/shell";

export default function NotFound() {
  return (
    <Shell>
      <h1 className="text-xl font-semibold">That record is not in the dataset</h1>
      <p className="mt-2 text-sm text-muted">The account or opportunity id does not match a loaded row.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-brass">
        Back to the dashboard
      </Link>
    </Shell>
  );
}
