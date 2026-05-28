import { cn } from "@/lib/utils";

type Variant = "face" | "banned" | "blocked";

const variantClasses: Record<Variant, string> = {
  face: "bg-black/60 text-white",
  banned: "bg-rose-600/90 text-white",
  blocked: "bg-rose-600/80 text-white",
};

export function PhotoBadge({
  variant,
  children,
  className,
}: {
  variant: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded px-1 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
