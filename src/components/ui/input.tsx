import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-line bg-surface2 px-3 text-sm text-foreground placeholder:text-dim focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
