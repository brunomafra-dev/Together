import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Home, CreditCard, Calendar, UserCircle, Heart, Target, Moon, Sun } from "lucide-react";
import { useFinance } from "../context/FinanceContext";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { household, settings } = useFinance();
  const isActive = (path: string) => location.pathname === path;
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem("together:theme") === "dark");
  const partnerNames = (household?.partnerNames ?? settings.partnerNames).filter(Boolean);
  const coupleName = partnerNames.length > 0 ? partnerNames.join(" & ") : "";
  const initials = partnerNames
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
    { to: "/", label: "Hoje", icon: Home },
    { to: "/goals", label: "Metas", icon: Target },
    { to: "/installments", label: "Parcelas", icon: CreditCard },
    { to: "/future", label: "Impacto futuro", icon: Calendar },
    { to: "/settings", label: "Perfil", icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white/80 backdrop-blur border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600">
                  <Heart className="h-3.5 w-3.5 text-white" fill="white" />
                </div>
                <span className="hidden text-sm font-medium text-stone-900 min-[380px]:inline">Together</span>
              </div>
              {coupleName ? (
                <div className="flex min-w-0 items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-2 py-1.5 sm:gap-2.5 sm:px-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {household?.avatarUrl ? (
                      <img src={household.avatarUrl} alt={coupleName} className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <span className="block max-w-[128px] truncate text-sm font-semibold text-stone-700 sm:max-w-[260px]">
                    {coupleName}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden gap-1 lg:flex">
                {navItems.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive(to)
                        ? "bg-stone-100 text-stone-900"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 inline mr-1.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDarkMode((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-900"
                aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 pb-28 pt-6 sm:px-6 lg:py-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition-colors ${
                isActive(to)
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{label === "Impacto futuro" ? "Futuro" : label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
