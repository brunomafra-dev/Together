import { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Home, CreditCard, Calendar, Settings, Heart } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { to: "/", label: "Hoje", icon: Home },
    { to: "/installments", label: "Parcelas", icon: CreditCard },
    { to: "/future", label: "Impacto futuro", icon: Calendar },
    { to: "/settings", label: "Ajustes", icon: Settings },
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

            <div className="flex gap-1">
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
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
