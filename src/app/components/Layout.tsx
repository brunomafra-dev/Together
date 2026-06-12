import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Home, CreditCard, Calendar, UserCircle, Heart, Target, Moon, Sun } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem("together:theme") === "dark");

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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-white" fill="white" />
              </div>
              <span className="font-medium text-stone-900">Together</span>
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
