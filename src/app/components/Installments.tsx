import { useEffect, useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  Layers3,
  Plus,
  Sparkles,
  TrendingDown,
  Trash2,
  Wallet,
} from "lucide-react";
import { Layout } from "./Layout";
import { formatBRL, useFinance } from "../context/FinanceContext";
import * as financeService from "../../services/financeService";

type PaymentMethodBucket = {
  id: string;
  name: string;
  totalLimit: number;
  commitments: Array<{
    id: string;
    paymentMethodId: string;
    itemName: string;
    installmentValue: number;
    currentInstallment: number;
    totalInstallments: number;
    responsiblePerson: string;
    notes: string;
    startedAt: string;
    status: "active" | "finished" | "late";
  }>;
};

type MonthlyProjection = {
  monthLabel: string;
  fixedExpenses: number;
  commitments: number;
  estimatedBalance: number;
};

const EMPTY_COMMITMENTS: PaymentMethodBucket["commitments"] = [];

function limitTone(available: number, totalLimit: number) {
  const ratio = totalLimit > 0 ? available / totalLimit : 1;
  if (ratio <= 0.15) return "bg-rose-50 border-rose-100 text-rose-900";
  if (ratio <= 0.35) return "bg-amber-50 border-amber-100 text-amber-900";
  return "bg-emerald-50 border-emerald-100 text-emerald-900";
}

function statusTone(status: "active" | "finished" | "late") {
  switch (status) {
    case "finished":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "late":
      return "bg-rose-50 text-rose-700 border-rose-100";
    default:
      return "bg-sky-50 text-sky-700 border-sky-100";
  }
}

function monthLabelFromOffset(offset: number) {
  return format(addMonths(new Date(), offset), "MMMM 'de' yyyy", { locale: ptBR });
}

export function Installments() {
  const { paymentMethods, fixedExpenses, settings, household } = useFinance();
  const [commitments, setCommitments] = useState(EMPTY_COMMITMENTS);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      const householdId = await financeService.getUserHouseholdId();
      if (!householdId) return;

      const rows = await financeService.fetchFinancialCommitments(householdId).catch(() => []);
      if (rows.length > 0) {
        setCommitments(
        rows.map((row) => {
            return {
              id: row.id,
              paymentMethodId: row.paymentMethodId,
              itemName: row.itemName,
              installmentValue: row.installmentValue,
              currentInstallment: row.currentInstallment,
              totalInstallments: row.totalInstallments,
              responsiblePerson: row.responsiblePerson,
              notes: row.notes,
              startedAt: row.startedAt,
              status: row.status,
            };
          }),
        );
      } else {
        setCommitments(EMPTY_COMMITMENTS);
      }
    };

    void load();
  }, [paymentMethods]);

  const buckets = useMemo<PaymentMethodBucket[]>(() => {
    if (paymentMethods.length === 0) return [];

    return paymentMethods.map((method) => ({
      id: method.id,
      name: method.name,
      totalLimit: method.limitAmount ?? 0,
      commitments: commitments.filter((commitment) => commitment.paymentMethodId === method.id),
    }));
  }, [paymentMethods, commitments]);

  const totalLimit = buckets.reduce((sum, bucket) => sum + bucket.totalLimit, 0);
  const committedLimit = buckets.reduce(
    (sum, bucket) => sum + bucket.commitments.reduce((bucketSum, commitment) => bucketSum + commitment.installmentValue, 0),
    0,
  );
  const availableLimit = Math.max(totalLimit - committedLimit, 0);
  const activeInstallments = commitments.filter((commitment) => commitment.status !== "finished").length;
  const remainingInstallments = commitments
    .filter((commitment) => commitment.status !== "finished")
    .reduce((sum, commitment) => sum + Math.max(commitment.totalInstallments - commitment.currentInstallment, 0), 0);
  const estimatedEndDate = commitments.length
    ? format(
        addMonths(
          new Date(),
          Math.max(...commitments.filter((commitment) => commitment.status !== "finished").map((commitment) => Math.max(commitment.totalInstallments - commitment.currentInstallment, 0)), 0),
        ),
        "MMMM 'de' yyyy",
        { locale: ptBR },
      )
    : "Sem previsão";

  const monthlyFixedExpenses = fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthlyIncome = settings.monthlyIncome || household?.monthlyIncome || 0;
  const estimatedBalance = monthlyIncome - monthlyFixedExpenses - committedLimit;

  const projections: MonthlyProjection[] = Array.from({ length: 4 }, (_, index) => {
    const monthFixedExpenses = monthlyFixedExpenses;
    const monthCommitments = Math.max(committedLimit - index * Math.min(committedLimit * 0.12, committedLimit), 0);
    return {
      monthLabel: monthLabelFromOffset(index),
      fixedExpenses: monthFixedExpenses,
      commitments: monthCommitments,
      estimatedBalance: monthlyIncome - monthFixedExpenses - monthCommitments,
    };
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Parcelas</h1>
            <p className="mt-1 text-sm text-stone-600">Compromissos financeiros do casal</p>
            <p className="mt-1 text-xs text-stone-500">Agrupado por forma de pagamento para mostrar o poder de compra disponível.</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-white transition-colors hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Novo compromisso
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <Layers3 className="h-4 w-4" />
              Compromissos ativos
            </div>
            <p className="text-3xl font-semibold text-stone-900">{activeInstallments}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <CalendarCheck className="h-4 w-4" />
              Parcelas restantes
            </div>
            <p className="text-3xl font-semibold text-stone-900">{remainingInstallments}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <TrendingDown className="h-4 w-4" />
              Comprometimento mensal
            </div>
            <p className="text-3xl font-semibold text-stone-900">{formatBRL(committedLimit)}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <Clock3 className="h-4 w-4" />
              Término estimado
            </div>
            <p className="text-3xl font-semibold capitalize text-stone-900">{estimatedEndDate}</p>
          </div>
        </div>

        <div className="space-y-6">
          {buckets.length > 0 ? (
            buckets.map((bucket) => {
              const committed = bucket.commitments.reduce((sum, commitment) => sum + commitment.installmentValue, 0);
              const available = Math.max(bucket.totalLimit - committed, 0);
              return (
                <section key={bucket.id} className="space-y-4">
                  <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-5 w-5 text-stone-500" />
                          <h3 className="text-xl font-semibold text-stone-950">{bucket.name}</h3>
                        </div>
                        <p className="text-sm text-stone-600">Veja o limite total, comprometido e disponível para esta forma de pagamento.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Limite total</p>
                          <p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(bucket.totalLimit)}</p>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Limite comprometido</p>
                          <p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(committed)}</p>
                        </div>
                        <div className={`rounded-2xl border p-4 ${limitTone(available, bucket.totalLimit)}`}>
                          <p className="text-xs uppercase tracking-[0.16em] opacity-70">Limite disponível</p>
                          <p className="mt-2 text-2xl font-semibold">{formatBRL(available)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {bucket.commitments.length > 0 ? (
                      bucket.commitments.map((commitment, index) => {
                        const remaining = Math.max(commitment.totalInstallments - commitment.currentInstallment, 0);
                        const endDate = format(addMonths(new Date(commitment.startedAt), remaining), "MMMM 'de' yyyy", { locale: ptBR });
                        const progress = Math.min((commitment.currentInstallment / commitment.totalInstallments) * 100, 100);
                        return (
                          <article key={commitment.id ?? `${bucket.id}-${index}`} className="group rounded-2xl border border-stone-200 bg-white p-6">
                            <div className="mb-5 flex items-start justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-medium text-stone-900">{commitment.itemName}</h4>
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(commitment.status)}`}>
                                    {commitment.status === "finished" ? "Concluído" : commitment.status === "late" ? "Em atraso" : "Ativo"}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-500">
                                  <span className="font-medium text-stone-600">{commitment.responsiblePerson}</span> · {bucket.name} · termina em {endDate}
                                </p>
                              </div>
                              <button type="button" className="text-stone-400 transition-all hover:text-rose-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Nome do item</p>
                                <p className="font-semibold text-stone-900">{commitment.itemName}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Forma de pagamento</p>
                                <p className="font-semibold text-stone-900">{bucket.name}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Valor da parcela</p>
                                <p className="font-semibold text-stone-900">{formatBRL(commitment.installmentValue)}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Pessoa responsável</p>
                                <p className="font-semibold text-stone-900">{commitment.responsiblePerson}</p>
                              </div>
                            </div>

                            <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Parcela atual</p>
                                <p className="font-semibold text-stone-900">
                                  {commitment.currentInstallment} de {commitment.totalInstallments}
                                </p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Total de parcelas</p>
                                <p className="font-semibold text-stone-900">{commitment.totalInstallments}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Restantes</p>
                                <p className="font-semibold text-stone-900">
                                  {remaining} mês{remaining === 1 ? "" : "es"}
                                </p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Término estimado</p>
                                <p className="font-semibold text-stone-900">{endDate}</p>
                              </div>
                            </div>

                            <div className="mb-4 rounded-2xl bg-stone-50 p-4">
                              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-500">
                                <CircleDollarSign className="h-4 w-4" />
                                Observações
                              </div>
                              <p className="text-sm text-stone-700">{commitment.notes || "Sem observações registradas."}</p>
                            </div>

                            <div>
                              <div className="mb-2 flex justify-between text-xs">
                                <span className="text-stone-600">
                                  {commitment.status === "finished"
                                    ? "Compromisso encerrado"
                                    : commitment.status === "late"
                                      ? "Acompanhar atrasos"
                                      : "No ritmo esperado"}
                                </span>
                                <span className="text-stone-500">
                                  {commitment.currentInstallment} de {commitment.totalInstallments}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
                        <p className="text-sm text-stone-400">Nenhum compromisso ativo nesta forma de pagamento.</p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
              <p className="text-sm text-stone-500">
                Nenhum compromisso cadastrado ainda. Quando você adicionar, a tela vai mostrar os valores reais por forma de pagamento.
              </p>
            </div>
          )}
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-stone-950">Impacto futuro</h3>
                <p className="text-sm text-stone-600">O que já está comprometido nos próximos meses</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/70 p-4 text-sm text-stone-700">
              Esta base usa renda mensal combinada, contas fixas e compromissos ativos para estimar quanto sobra a cada mês.
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Renda combinada</p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(monthlyIncome)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Contas fixas</p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(monthlyFixedExpenses)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Sobra estimada</p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(estimatedBalance)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-stone-950">Resumo geral</h3>
                <p className="text-sm text-stone-600">Visão consolidada do limite disponível no momento</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Limite total</p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(totalLimit)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Limite comprometido</p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(committedLimit)}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${limitTone(availableLimit, totalLimit)}`}>
                <p className="text-xs uppercase tracking-[0.16em] opacity-70">Limite disponível</p>
                <p className="mt-2 text-2xl font-semibold">{formatBRL(availableLimit)}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {projections.map((projection) => (
                <div key={projection.monthLabel} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-stone-900 capitalize">{projection.monthLabel}</p>
                    <p className="text-xs text-stone-500">Projeção mensal</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-stone-500">Contas fixas</p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">{formatBRL(projection.fixedExpenses)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-stone-500">Parcelas</p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">{formatBRL(projection.commitments)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-stone-500">Sobra estimada</p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">{formatBRL(projection.estimatedBalance)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {showAddForm && <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddForm(false)} />}
    </Layout>
  );
}
