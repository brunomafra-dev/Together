import { useMemo, useState } from "react";
import { ArrowRight, Check, Heart, Lock, Mail, ShieldQuestion } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "./AuthLayout";

const highlights = ["Gastos compartilhados", "Controle de parcelas", "Projeção financeira do mês"];

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visiblePassword, setVisiblePassword] = useState(false);
  const { signIn, user, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  const maskedPassword = useMemo(
    () => (visiblePassword ? password : password.replace(/./g, "•")),
    [password, visiblePassword],
  );

  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await signIn(email.trim(), password);
    navigate(from, { replace: true });
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[455px] text-center">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00b88a] shadow-[0_16px_28px_rgba(0,184,138,0.18)]">
          <Heart className="h-7 w-7 fill-white text-white" strokeWidth={1.8} />
        </div>

        <h1 className="mx-auto max-w-[18ch] text-[2.25rem] font-medium leading-[1.08] tracking-[-0.04em] text-[#111827] sm:text-[3rem]">
          O dinheiro do casal, finalmente organizado.
        </h1>

        <p className="mx-auto mt-5 max-w-[32ch] text-[1.02rem] leading-7 text-[#68707a]">
          Acompanhem gastos, parcelas e metas em um só lugar.
        </p>

        <section className="mt-10 overflow-hidden rounded-[2rem] border border-[#e6e2dd] bg-white shadow-[0_22px_60px_rgba(15,23,42,0.07)]">
          <div className="px-6 pb-6 pt-9 sm:px-8">
            <form className="space-y-6 text-left" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-[0.92rem] font-medium uppercase tracking-[0.16em] text-[#6b7280]">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  <Input
                    aria-label="E-mail"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="h-[54px] rounded-2xl border-[#00cc7a] bg-white pl-11 pr-4 text-[1rem] text-[#334155] shadow-none placeholder:text-[#94a3b8] focus-visible:ring-0"
                    placeholder="voces@email.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[0.92rem] font-medium uppercase tracking-[0.16em] text-[#6b7280]">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  <Input
                    aria-label="Senha"
                    type={visiblePassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="h-[54px] rounded-2xl border-[#e5e7eb] bg-white pl-11 pr-12 text-[1rem] tracking-[0.24em] text-[#334155] shadow-none placeholder:text-[#94a3b8] focus-visible:ring-0"
                    placeholder={maskedPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setVisiblePassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-[#0f766e] hover:underline"
                  >
                    {visiblePassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-[48px] w-full rounded-2xl bg-[#00a56f] text-[1.02rem] font-semibold text-white shadow-[0_14px_28px_rgba(0,165,111,0.24)] hover:bg-[#0b9a69] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Entrando..." : "Entrar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>

          <div className="border-t border-[#e6e2dd] px-6 py-7 text-center sm:px-8">
            <p className="text-[0.98rem] text-[#6b7280]">
              Primeira vez aqui?{" "}
              <Link to="/register" className="font-semibold text-[#0f766e] hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 text-[0.92rem] text-[#4b5563]">
          {highlights.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#dff7ee] text-[#00a56f]">
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[0.95rem] text-[#8b9198]">
          Controle financeiro compartilhado para casais.
        </p>
      </div>

      <button
        type="button"
        aria-label="Ajuda"
        className="fixed bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#dedad5] bg-white text-[#6b7280] shadow-[0_10px_24px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:text-[#111827]"
      >
        <ShieldQuestion className="h-5 w-5" />
      </button>
    </AuthLayout>
  );
}

