import Link from "next/link";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="block">
            <span className="block text-[15px] font-semibold tracking-tight">Book of Business</span>
            <span className="block text-xs text-dim">Experience Partner retention</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            <Link href="/" className="rounded px-3 py-1.5 text-muted hover:bg-surface2 hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/#data-gaps" className="rounded px-3 py-1.5 text-muted hover:bg-surface2 hover:text-foreground">
              Data gaps
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
