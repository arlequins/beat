import { cn } from "@acme/ui";

export function PageHeader(props: {
  actions?: React.ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6",
        props.className,
      )}
    >
      <div className="min-w-0">
        {props.eyebrow && (
          <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
            {props.eyebrow}
          </p>
        )}
        <h1 className="text-foreground text-[1.65rem] font-semibold leading-tight sm:text-3xl">
          {props.title}
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
          {props.description}
        </p>
      </div>
      {props.actions && (
        <div className="flex w-full shrink-0 items-center gap-2 [&>*]:flex-1 sm:w-auto sm:[&>*]:flex-none">
          {props.actions}
        </div>
      )}
    </header>
  );
}
