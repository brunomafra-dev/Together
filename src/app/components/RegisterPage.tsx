import { useState } from "react";
import { ArrowRight, Heart, Lock, Mail, ShieldQuestion, User } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "./AuthLayout";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visiblePassword, setVisiblePassword] = useState(false);
  const { signUp, user, loading, error } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordsMatch) return;
    await signUp(name.trim(), email.trim(), password);
    navigate("/", { replace: true });
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[455px] text-center">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00b88a] shadow-[0_16px_28px_rgba(0,184,138,0.18)]">
          <Heart className="h-7 w-7 fill-white text-white" strokeWidth={1.8} />
        </div>

        <h1 className="mx-auto max-w-[18ch] text-[2.25rem] font-medium leading-[1.08] tracking-[-0.04em] text-[#111827] sm:text-[3rem]">
          Criem o Together do jeito de vocês.
        </h1>

        <p className="mx-auto mt-5 max-w-[32ch] text-[1.02rem] leading-7 text-[#68707a]">
          Um espaço simples e acolhedor para organizar a vida financeira em casal.
        </p>

        <section className="mt-10 overflow-hidden rounded-[2rem] border border-[#e6e2dd] bg-white shadow-[0_22px_60px_rgba(15,23,42,0.07)]">
          <div className="px-6 pb-6 pt-9 sm:px-8">
            <form className="space-y-5 text-left" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-[0.92rem] font-medium uppercase tracking-[0.16em] text-[#6b7280]">
                  Nome
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  <Input
                    aria-label="Nome"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    className="h-[54px] rounded-2xl border-[#e5e7eb] bg-white pl-11 pr-4 text-[1rem] text-[#334155] shadow-none focus-visible:ring-0"
                    placeholder="Bruno"
                  />
                </div>
              </div>

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
                    className="h-[54px] rounded-2xl border-[#00cc7a] bg-white pl-11 pr-4 text-[1rem] text-[#334155] shadow-none focus-visible:ring-0"
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
                    autoComplete="new-password"
                    className="h-[54px] rounded-2xl border-[#e5e7eb] bg-white pl-11 pr-12 text-[1rem] tracking-[0.24em] text-[#334155] shadow-none focus-visible:ring-0"
                    placeholder="********"
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

              <div className="space-y-2">
                <label className="text-[0.92rem] font-medium uppercase tracking-[0.16em] text-[#6b7280]">
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  <Input
                    aria-label="Confirmar senha"
                    type={visiblePassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="h-[54px] rounded-2xl border-[#e5e7eb] bg-white pl-11 pr-4 text-[1rem] tracking-[0.24em] text-[#334155] shadow-none focus-visible:ring-0"
                    placeholder="********"
                  />
                </div>
              </div>

              {!passwordsMatch && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  As senhas precisam ser iguais.
                </p>
              )}

              {error && (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || !passwordsMatch}
                className="h-[48px] w-full rounded-2xl bg-[#00a56f] text-[1.02rem] font-semibold text-white shadow-[0_14px_28px_rgba(0,165,111,0.24)] hover:bg-[#0b9a69] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Criando..." : "Criar conta"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>

          <div className="border-t border-[#e6e2dd] px-6 py-7 text-center sm:px-8">
            <p className="text-[0.98rem] text-[#6b7280]">
              Já tem conta?{" "}
              <Link to="/login" className="font-semibold text-[#0f766e] hover:underline">
                Entrar
              </Link>
            </p>
          </div>
        </section>
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
