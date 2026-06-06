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
  X,
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

type CommitmentFormState = {
  itemName: string;
  paymentMethodId: string;
  installmentValue: string;
  currentInstallment: string;
  totalInstallments: string;
  responsiblePerson: string;
  notes: string;
};

const EMPTY_COMMITMENTS: PaymentMethodBucket["commitments"] = [];

const DEFAULT_FORM: CommitmentFormState = {
  itemName: "",
  paymentMethodId: "",
  installmentValue: "",
  currentInstallment: "1",
  totalInstallments: "12",
  responsiblePerson: "",
  notes: "",
};

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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<CommitmentFormState>(DEFAULT_FORM);

  const resolveHouseholdId = async () => household?.id ?? financeService.getUserHouseholdId();

  const refreshCommitments = async () => {
    const householdId = await resolveHouseholdId();
    if (!householdId) {
      setCommitments(EMPTY_COMMITMENTS);
      return;
    }

    const rows = await financeService.fetchFinancialCommitments(householdId).catch(() => []);
    setCommitments(
      rows.map((row) => ({
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
      })),
    );
  };

  useEffect(() => {
    void refreshCommitments();
  }, [household?.id]);

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
          Math.max(
            ...commitments
              .filter((commitment) => commitment.status !== "finished")
              .map((commitment) => Math.max(commitment.totalInstallments - commitment.currentInstallment, 0)),
            0,
          ),
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

  const openAddForm = () => {
    setFormError(null);
    setForm({
      itemName: "",
      paymentMethodId: paymentMethods[0]?.id || "",
      installmentValue: "",
      currentInstallment: "1",
      totalInstallments: "12",
      responsiblePerson: settings.partnerNames.find(Boolean) || "",
      notes: "",
    });
    setShowAddForm(true);
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setSaving(false);
    setFormError(null);
  };

  const handleAddCommitment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const householdId = await resolveHouseholdId();
    if (!householdId) {
      setFormError("Não foi possível identificar o household ativo.");
      return;
    }

    const installmentValue = Number(form.installmentValue.replace(",", "."));
    const currentInstallment = Number(form.currentInstallment);
    const totalInstallments = Number(form.totalInstallments);

    if (!form.itemName.trim()) {
      setFormError("Informe o nome do item.");
      return;
    }
    if (!form.paymentMethodId) {
      setFormError("Selecione uma forma de pagamento.");
      return;
    }
    if (!Number.isFinite(installmentValue) || installmentValue <= 0) {
      setFormError("Informe um valor válido para a parcela.");
      return;
    }
    if (!Number.isInteger(currentInstallment) || currentInstallment < 1) {
      setFormError("Informe a parcela atual corretamente.");
      return;
    }
    if (!Number.isInteger(totalInstallments) || totalInstallments < currentInstallment) {
      setFormError("O total de parcelas precisa ser maior ou igual à parcela atual.");
      return;
    }
    if (!form.responsiblePerson.trim()) {
      setFormError("Informe a pessoa responsável.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await financeService.addFinancialCommitment({
        householdId,
        paymentMethodId: form.paymentMethodId,
        itemName: form.itemName.trim(),
        installmentValue,
        currentInstallment,
        totalInstallments,
        responsiblePerson: form.responsiblePerson.trim(),
        notes: form.notes.trim(),
        startedAt: new Date().toISOString().slice(0, 10),
        status: "active",
      });

      await refreshCommitments();
      closeAddForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o compromisso.");
      setSaving(false);
    }
  };

  const handleDeleteCommitment = async (id: string) => {
    const confirmed = window.confirm("Deseja excluir este compromisso?");
    if (!confirmed) return;

    try {
      await financeService.deleteFinancialCommitment(id);
      await refreshCommitments();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível excluir o compromisso.");
    }
  };

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
            type="button"
            onClick={openAddForm}
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
                        const endDate = format(addMonths(new Date(commitment.startedAt), remaining), "MMMM 'de' yyyy", {
                          locale: ptBR,
                        });
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
                                  <span className="font-medium text-stone-600">{commitment.responsiblePerson}</span> · {bucket.name} · termina em{" "}
                                  {endDate}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleDeleteCommitment(commitment.id)}
                                className="text-stone-400 transition-all hover:text-rose-600"
                              >
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

      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={closeAddForm}
        >
          <div
            className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 border-b border-stone-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-stone-950">Novo compromisso</h2>
                  <p className="mt-1 text-sm text-stone-500">Cadastre um compromisso financeiro real para acompanhar o impacto mensal.</p>
                </div>
                <button type="button" onClick={closeAddForm} className="text-stone-400 hover:text-stone-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form
              className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
              onSubmit={(event) => {
                void handleAddCommitment(event);
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Nome do item</label>
                  <input
                    value={form.itemName}
                    onChange={(event) => setForm((prev) => ({ ...prev, itemName: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Sofá, TV, celular..."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Forma de pagamento</label>
                  <select
                    value={form.paymentMethodId}
                    onChange={(event) => setForm((prev) => ({ ...prev, paymentMethodId: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Selecione a forma de pagamento</option>
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Valor da parcela</label>
                  <input
                    value={form.installmentValue}
                    onChange={(event) => setForm((prev) => ({ ...prev, installmentValue: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Parcela atual</label>
                  <input
                    type="number"
                    min={1}
                    value={form.currentInstallment}
                    onChange={(event) => setForm((prev) => ({ ...prev, currentInstallment: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Total de parcelas</label>
                  <input
                    type="number"
                    min={1}
                    value={form.totalInstallments}
                    onChange={(event) => setForm((prev) => ({ ...prev, totalInstallments: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Pessoa responsável</label>
                  <input
                    value={form.responsiblePerson}
                    onChange={(event) => setForm((prev) => ({ ...prev, responsiblePerson: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Você, sua esposa, etc."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Observações</label>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className="min-h-[110px] w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Anotações sobre o compromisso"
                  />
                </div>
              </div>

              {formError && (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAddForm}
                  className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar compromisso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
