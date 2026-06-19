import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ExpandableSectionProps = {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  tone?: "emerald" | "indigo" | "amber" | "blue" | "rose" | "yellow" | "teal" | "pink";
};

const shouldOpenByDefault = (defaultOpen: boolean) => {
  if (!defaultOpen) return false;
  if (typeof window === "undefined") return defaultOpen;
  return window.matchMedia("(min-width: 640px)").matches;
};

export function ExpandableSection({
  title,
  summary,
  children,
  defaultOpen = false,
  className = "",
  contentClassName = "",
  actions,
  icon: Icon,
  tone,
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(() => shouldOpenByDefault(defaultOpen));
  const contentId = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const toneMap = {
    emerald: "border-emerald-100 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/60 dark:text-emerald-200",
    indigo: "border-indigo-100 bg-indigo-50/80 text-indigo-700 dark:border-indigo-500/35 dark:bg-indigo-950/60 dark:text-indigo-200",
    amber: "border-amber-100 bg-amber-50/80 text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/60 dark:text-amber-200",
    blue: "border-sky-100 bg-sky-50/80 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/60 dark:text-sky-200",
    rose: "border-rose-100 bg-rose-50/80 text-rose-700 dark:border-rose-500/35 dark:bg-rose-950/60 dark:text-rose-200",
    yellow: "border-yellow-100 bg-yellow-50/80 text-yellow-700 dark:border-yellow-500/35 dark:bg-yellow-950/60 dark:text-yellow-200",
    teal: "border-teal-100 bg-teal-50/80 text-teal-700 dark:border-teal-500/35 dark:bg-teal-950/60 dark:text-teal-200",
    pink: "border-pink-100 bg-pink-50/80 text-pink-700 dark:border-pink-500/35 dark:bg-pink-950/60 dark:text-pink-200",
  } as const;

  return (
    <section className={`overflow-hidden rounded-[1.4rem] border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950 ${className}`}>
      <div className="flex items-start justify-between gap-3 p-3.5 sm:p-4">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={contentId}
          className="group flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${tone && Icon ? toneMap[tone] : "border-stone-200 bg-stone-50 text-stone-600"}`}>
            {Icon ? <Icon className="h-5 w-5" /> : <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-[15px] font-semibold text-stone-950 dark:text-white sm:text-base">{title}</span>
            {summary ? <span className="mt-0.5 line-clamp-2 block break-words text-xs leading-snug text-stone-500 dark:text-stone-300 sm:text-sm">{summary}</span> : null}
          </span>
          <span className="hidden shrink-0 items-center gap-2 rounded-full bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600 transition-colors group-hover:bg-stone-100 sm:inline-flex">
            {open ? "Ocultar" : "Ver detalhes"}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {Icon ? (
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              aria-controls={contentId}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 sm:hidden"
              aria-label={open ? "Ocultar detalhes" : "Ver detalhes"}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div id={contentId} className={`border-t border-stone-100 p-4 sm:p-5 ${contentClassName}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
