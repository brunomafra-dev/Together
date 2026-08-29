import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "../context/FinanceContext";
import type { FinancialRoutine } from "../context/FinanceContext";
import { formatLocalDate, parseLocalDate } from "../utils/financialCycles";
import {
  CYCLE_MODE_LABELS,
  INCOME_MODE_LABELS,
  suggestedFinancialCycle,
} from "../utils/financialRoutine";

const incomeDescriptions: Record<FinancialRoutine["incomeMode"], string> = {
  fixed: "Salário, aposentadoria ou outra renda previsível.",
  variable: "Entradas mudam ao longo do mês, como Uber ou trabalhos autônomos.",
  mixed: "Existe uma base mensal e também entram valores extras.",
};

export function FinancialOnboarding() {
  const { household, categories, paymentMethods, updateFinancialRoutine } = useFinance();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [routine, setRoutine] = useState<FinancialRoutine>(() => ({
    incomeMode: household?.incomeMode ?? "fixed",
    primaryIncomeDay: household?.primaryIncomeDay ?? 5,
    cycleMode: household?.cycleMode ?? "payment_day",
    cycleCloseDay: household?.cycleCloseDay ?? null,
  }));
  const preview = useMemo(
    () => suggestedFinancialCycle(formatLocalDate(new Date()), routine),
    [routine],
  );
  const totalSteps = 4;

  const validDay = (day: number | null) => day !== null && day >= 1 && day <= 31;

  if (!household || household.onboardingCompletedAt) return null;

  const normalizedRoutine = (): FinancialRoutine => {
    if (routine.cycleMode === "payment_day" && !validDay(routine.primaryIncomeDay)) {
      return { ...routine, primaryIncomeDay: 5 };
    }
    if (routine.cycleMode === "custom_day" && !validDay(routine.cycleCloseDay)) {
      return { ...routine, cycleCloseDay: 5 };
    }
    return routine;
  };

  const finish = async (skip = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const nextRoutine = normalizedRoutine();
      await updateFinancialRoutine(nextRoutine, true);
      toast.success(
        skip ? "Você pode refazer o guia pelo Perfil." : "Rotina financeira configurada.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="financial-onboarding-title"
      className="fixed inset-0 z-[80] overflow-y-auto bg-stone-950/55 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="mx-auto my-4 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-10">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-6 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-emerald-100">
                <Sparkles className="h-4 w-4" /> Guia inicial do Together
              </div>
              <h1 id="financial-onboarding-title" className="text-2xl font-semibold">
                Vamos organizar sua rotina financeira
              </h1>
              <p className="mt-2 text-sm text-emerald-50">
                São quatro passos curtos usando a forma como você realmente recebe e paga.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void finish(true)}
              className="shrink-0 text-xs text-emerald-100 underline underline-offset-4 hover:text-white"
            >
              Fazer depois
            </button>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {Array.from({ length: totalSteps }, (_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full ${index <= step ? "bg-white" : "bg-white/25"}`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[390px] p-6 sm:p-8">
          {step === 0 && (
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Como o dinheiro entra?</h2>
              <p className="mt-1 text-sm text-stone-500">Isso adapta as orientações do app.</p>
              <div className="mt-5 grid gap-3">
                {(["fixed", "variable", "mixed"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setRoutine((current) => ({
                        ...current,
                        incomeMode: mode,
                        primaryIncomeDay:
                          mode === "variable" ? null : (current.primaryIncomeDay ?? 5),
                        cycleMode: mode === "variable" ? "manual" : current.cycleMode,
                      }))
                    }
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      routine.incomeMode === mode
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-stone-200 hover:border-emerald-200"
                    }`}
                  >
                    <p className="font-medium text-stone-900">{INCOME_MODE_LABELS[mode]}</p>
                    <p className="mt-1 text-sm text-stone-500">{incomeDescriptions[mode]}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-semibold text-stone-900">Quando você recebe?</h2>
              </div>
              {routine.incomeMode === "variable" ? (
                <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
                  <p className="font-medium text-cyan-950">
                    Sua renda não precisa ter um dia fixo.
                  </p>
                  <p className="mt-2 text-sm text-cyan-800">
                    Registre cada entrada quando receber. Você poderá fechar o ciclo manualmente ou
                    escolher um dia só para organizar os relatórios.
                  </p>
                </div>
              ) : (
                <label className="mt-5 block rounded-2xl border border-stone-200 p-5">
                  <span className="text-sm font-medium text-stone-900">
                    Dia principal do recebimento
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={routine.primaryIncomeDay ?? ""}
                    onChange={(event) =>
                      setRoutine((current) => ({
                        ...current,
                        primaryIncomeDay: Number(event.target.value) || null,
                      }))
                    }
                    className="mt-3 w-full rounded-xl border border-stone-200 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="mt-2 block text-xs text-stone-500">
                    Exemplo: se você recebe dia 05 e paga as contas nesse dia, informe 5.
                  </span>
                </label>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-semibold text-stone-900">Quando seu mês vira?</h2>
              </div>
              <div className="mt-5 grid gap-3">
                {(["payment_day", "custom_day", "manual"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={mode === "payment_day" && routine.primaryIncomeDay === null}
                    onClick={() => setRoutine((current) => ({ ...current, cycleMode: mode }))}
                    className={`rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                      routine.cycleMode === mode
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-stone-200 hover:border-emerald-200"
                    }`}
                  >
                    <p className="font-medium text-stone-900">{CYCLE_MODE_LABELS[mode]}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {mode === "payment_day"
                        ? "O ciclo termina no dia do recebimento e o próximo começa no dia seguinte."
                        : mode === "custom_day"
                          ? "Escolha um dia diferente para encerrar relatórios e orçamento."
                          : "Ideal para renda irregular: você fecha quando fizer sentido."}
                    </p>
                  </button>
                ))}
              </div>
              {routine.cycleMode === "custom_day" && (
                <label className="mt-4 block">
                  <span className="text-sm text-stone-600">Dia da virada</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={routine.cycleCloseDay ?? ""}
                    onChange={(event) =>
                      setRoutine((current) => ({
                        ...current,
                        cycleCloseDay: Number(event.target.value) || null,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-semibold text-stone-900">Seu Together está pronto</h2>
              </div>
              {preview ? (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-sm text-emerald-800">Exemplo do ciclo atual</p>
                  <p className="mt-1 text-lg font-semibold capitalize text-emerald-950">
                    {format(parseLocalDate(preview.labelDate), "MMMM 'financeiro'", {
                      locale: ptBR,
                    })}
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    {format(parseLocalDate(preview.startDate), "dd/MM/yyyy")} a{" "}
                    {format(parseLocalDate(preview.endDate), "dd/MM/yyyy")}
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-5 text-sm text-cyan-900">
                  Seu ciclo será manual. O Together continuará mostrando datas de cartão e ajudará
                  você a decidir quando fechar.
                </div>
              )}
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  [
                    paymentMethods.some((method) => method.type === "credit_card"),
                    "Configure seus cartões",
                  ],
                  [categories.length > 0, "Revise suas categorias"],
                  [false, "Registre a primeira entrada"],
                  [false, "Adicione o primeiro gasto"],
                ].map(([done, label]) => (
                  <div
                    key={String(label)}
                    className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-3 text-sm text-stone-700"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-500"}`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : "·"}
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-6 py-4 sm:px-8">
          <button
            type="button"
            disabled={step === 0 || saving}
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-0"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>
          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setStep((current) => Math.min(current + 1, totalSteps - 1))}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void finish()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> {saving ? "Salvando..." : "Concluir configuração"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
