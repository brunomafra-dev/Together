import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

type ExpandableSectionProps = {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  actions?: ReactNode;
};

export function ExpandableSection({
  title,
  summary,
  children,
  defaultOpen = false,
  className = "",
  contentClassName = "",
  actions,
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section className={`overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-600">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
          <span className="min-w-0">
            <span className="block break-words text-base font-semibold text-stone-950 sm:text-lg">{title}</span>
            {summary ? <span className="mt-1 block break-words text-sm text-stone-500">{summary}</span> : null}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
      {open ? (
        <div id={contentId} className={`border-t border-stone-100 p-4 sm:p-5 ${contentClassName}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
