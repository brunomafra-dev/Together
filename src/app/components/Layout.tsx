import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Moon, Sun } from "lucide-react";
import { useFinance } from "../context/FinanceContext";
import { FinancialOnboarding } from "./FinancialOnboarding";
import {
  CommitmentsIcon,
  CurrentCycleIcon,
  HouseholdIcon,
  MilestonesIcon,
  ProjectionIcon,
  TogetherMarkIcon,
} from "./TogetherIcons";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { household, settings } = useFinance();
  const isActive = (path: string) => location.pathname === path;
  const [darkMode, setDarkMode] = useState(
    () => window.localStorage.getItem("together:theme") === "dark",
  );
  const partnerNames = (household?.partnerNames ?? settings.partnerNames).filter(Boolean);
  const coupleName = partnerNames.length > 0 ? partnerNames.join(" & ") : "";
  const initials =
    partnerNames
      .map((name) => name.trim()[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "T";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("together:theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const navItems = [
    { to: "/", label: "Hoje", icon: CurrentCycleIcon },
    { to: "/goals", label: "Metas", icon: MilestonesIcon },
    { to: "/installments", label: "Cartões e parcelas", icon: CommitmentsIcon },
    { to: "/future", label: "Impacto futuro", icon: ProjectionIcon },
    { to: "/settings", label: "Perfil", icon: HouseholdIcon },
  ];

  return (
    <div className="together-shell min-h-screen bg-stone-50">
      <FinancialOnboarding
        key={[
          household?.id,
          household?.onboardingCompletedAt,
          household?.incomeMode,
          household?.primaryIncomeDay,
          household?.cycleMode,
          household?.cycleCloseDay,
        ].join(":")}
      />
      <nav className="together-topbar sticky top-0 z-10 border-b border-stone-200 bg-white/85 backdrop-blur dark:border-stone-800 dark:bg-stone-950/85">
        <div className="together-topbar-inner mx-auto max-w-5xl px-4 sm:px-6">
          <div className="together-header-row grid h-20 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 lg:flex lg:h-16 lg:justify-between">
            <Link
              to="/"
              className="col-start-1 flex min-w-0 shrink-0 items-center gap-2 lg:col-auto"
            >
              <div className="together-brand-mark flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-sm lg:h-8 lg:w-8 lg:rounded-xl">
                <TogetherMarkIcon className="h-5 w-5 text-white lg:h-[18px] lg:w-[18px]" />
              </div>
              <span className="hidden text-sm font-semibold text-stone-900 dark:text-white lg:inline">
                Together
              </span>
            </Link>

            {coupleName ? (
              <Link
                to="/settings"
                className="together-household col-start-2 mx-auto flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-stone-200 bg-white px-1.5 py-1 shadow-sm transition-colors hover:bg-stone-50 dark:!border-stone-700 dark:!bg-stone-950 dark:hover:!bg-stone-900 lg:col-auto lg:max-w-[250px]"
                aria-label="Abrir perfil do casal"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100 lg:h-8 lg:w-8">
                  {household?.avatarUrl ? (
                    <img
                      src={household.avatarUrl}
                      alt={coupleName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <span className="block min-w-0 truncate text-[15px] font-semibold text-stone-800 dark:!text-white lg:text-sm">
                  {coupleName}
                </span>
              </Link>
            ) : null}

            <div className="col-start-3 flex items-center gap-2 lg:col-auto">
              <div className="hidden gap-1 lg:flex">
                {navItems.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`together-desktop-nav-item inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      isActive(to)
                        ? "bg-stone-100 text-stone-900"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
                    }`}
                  >
                    <span className="together-nav-glyph">
                      <Icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDarkMode((current) => !current)}
                className="together-theme-toggle inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
                aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 pb-28 pt-6 sm:px-6 lg:py-8">{children}</main>

      <nav className="together-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/95 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`together-bottom-nav-item flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition-colors ${
                isActive(to)
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white"
              }`}
            >
              <span className="together-nav-glyph">
                <Icon className="h-5 w-5" />
              </span>
              <span className="max-w-full truncate">
                {label === "Impacto futuro"
                  ? "Futuro"
                  : label === "Cartões e parcelas"
                    ? "Cartões"
                    : label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
