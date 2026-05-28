import { cn } from "@/lib/utils";
import type { ComponentType, SVGProps } from "react";

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

export function EmptyState({
  icon: Icon,
  message,
  className,
}: {
  icon?: HeroIcon;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
      )}
      <p className="text-sm text-zinc-400 dark:text-zinc-500">{message}</p>
    </div>
  );
}
