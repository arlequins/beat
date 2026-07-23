import { cn } from "@acme/ui";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}
