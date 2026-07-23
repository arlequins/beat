import type { LucideIcon } from "lucide-react";

export function StatBlock(props: {
  change: string;
  icon: LucideIcon;
  label: string;
  tone?: "blue" | "green" | "pink" | "yellow";
  value: string;
}) {
  const Icon = props.icon;
  const tones = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    green:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    pink: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
    yellow: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };

  return (
    <div className="bg-background flex min-w-0 flex-col-reverse justify-between gap-3 rounded-lg border p-4 shadow-xs sm:flex-row sm:items-start sm:p-5">
      <div>
        <p className="text-muted-foreground text-[11px] font-medium uppercase sm:text-xs">
          {props.label}
        </p>
        <p className="mt-1.5 text-xl font-semibold sm:mt-2 sm:text-2xl">
          {props.value}
        </p>
        <p className="text-muted-foreground mt-1 hidden text-xs sm:block">
          {props.change}
        </p>
      </div>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-md ${tones[props.tone ?? "blue"]}`}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
    </div>
  );
}
