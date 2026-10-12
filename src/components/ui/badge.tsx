import { cn } from "@/lib/utils";

const tones = {
  amber: "border-amber/40 bg-amber/10 text-amber",
  teal: "border-teal/40 bg-teal/10 text-teal",
  rose: "border-rose/40 bg-rose/10 text-rose",
  dim: "border-line bg-surface2 text-muted",
  brass: "border-brass/40 bg-brass/10 text-brass",
};

export function Badge({
  children,
  tone = "dim",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-4", tones[tone], className)}>
      {children}
    </span>
  );
}
