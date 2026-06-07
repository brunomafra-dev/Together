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

type PaymentMethodBucket = {
  id: string;
  name: string;
  totalLimit: number;
  cardExpenseTotal: number;
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

function billingKeyForPurchase(date: string, closingDay?: number | null) {
  const purchaseDate = new Date(`${date}T00:00:00`);
  const billDate = purchaseDate.getDate() > (closingDay || 31) ? addMonths(purchaseDate, 1) : purchaseDate;
  return `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, "0")}`;
}

export function Installments() {
  const { paymentMethods, financialCommitments: commitments, expenses, fixedExpenses, settings, household, deleteFinancialCommitment } = useFinance();
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const creditCardMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === "credit_card"),
    [paymentMethods],
  );
  const currentBillKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const buckets = useMemo<PaymentMethodBucket[]>(() => {
    if (creditCardMethods.length === 0) return [];

    return creditCardMethods.map((method) => ({
      id: method.id,
      name: method.name,
      totalLimit: method.limitAmount ?? 0,
      cardExpenseTotal: expenses
        .filter((expense) => expense.card === method.id && billingKeyForPurchase(expense.date, method.closingDay) === currentBillKey)
        .reduce((sum, expense) => sum + expense.amount, 0),
      commitments: commitments.filter((commitment) => commitment.paymentMethodId === method.id),
    }));
  }, [creditCardMethods, commitments, expenses]);

  const totalLimit = buckets.reduce((sum, bucket) => sum + bucket.totalLimit, 0);
  const committedLimit = buckets.reduce(
    (sum, bucket) => sum + bucket.cardExpenseTotal,
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

  const handleDeleteCommitment = async (id: string) => {
    if (!window.confirm("Excluir este compromisso?")) return;

    setDeletingId(id);
    try {
      await deleteFinancialCommitment(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-stone-900">Parcelas</h1>
            <p className="mt-1 text-sm text-stone-600">Compromissos financeiros do casal</p>
            <p className="mt-1 text-xs text-stone-500">Agrupado por forma de pagamento para mostrar o poder de compra disponível.</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-white transition-colors hover:bg-stone-800 sm:w-auto"
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
            <p className="break-words text-2xl font-semibold text-stone-900 sm:text-3xl">{formatBRL(committedLimit)}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <Clock3 className="h-4 w-4" />
              Término estimado
            </div>
            <p className="break-words text-2xl font-semibold capitalize text-stone-900 sm:text-3xl">{estimatedEndDate}</p>
          </div>
        </div>

        <div className="space-y-6">
          {buckets.length > 0 ? (
            buckets.map((bucket) => {
              const committed = bucket.cardExpenseTotal;
              const available = Math.max(bucket.totalLimit - committed, 0);
              return (
                <section key={bucket.id} className="space-y-4">
                  <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Wallet className="h-5 w-5 text-stone-500" />
                          <h3 className="min-w-0 break-words text-xl font-semibold text-stone-950">{bucket.name}</h3>
                        </div>
                        <p className="text-sm text-stone-600">Veja o limite total, comprometido e disponível para esta forma de pagamento.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Limite total</p>
                          <p className="mt-2 break-words text-xl font-semibold text-stone-950 sm:text-2xl">{formatBRL(bucket.totalLimit)}</p>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Limite comprometido</p>
                          <p className="mt-2 break-words text-xl font-semibold text-stone-950 sm:text-2xl">{formatBRL(committed)}</p>
                        </div>
                        <div className={`rounded-2xl border p-4 ${limitTone(available, bucket.totalLimit)}`}>
                          <p className="text-xs uppercase tracking-[0.16em] opacity-70">Limite disponível</p>
                          <p className="mt-2 break-words text-xl font-semibold sm:text-2xl">{formatBRL(available)}</p>
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
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="min-w-0 break-words font-medium text-stone-900">{commitment.itemName}</h4>
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(commitment.status)}`}>
                                    {commitment.status === "finished" ? "Concluído" : commitment.status === "late" ? "Em atraso" : "Ativo"}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-500">
                                  <span className="font-medium text-stone-600">{commitment.responsiblePerson}</span> · {bucket.name} · termina em {endDate}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleDeleteCommitment(commitment.id)}
                                disabled={deletingId === commitment.id}
                                className="text-stone-400 transition-all hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Excluir compromisso"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mb-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Nome do item</p>
                                <p className="break-words font-semibold text-stone-900">{commitment.itemName}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Forma de pagamento</p>
                                <p className="break-words font-semibold text-stone-900">{bucket.name}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Valor da parcela</p>
                                <p className="break-words font-semibold text-stone-900">{formatBRL(commitment.installmentValue)}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-stone-500">Pessoa responsável</p>
                                <p className="break-words font-semibold text-stone-900">{commitment.responsiblePerson}</p>
                              </div>
                            </div>

                            <div className="mb-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
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
                                <p className="break-words font-semibold text-stone-900">{endDate}</p>
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
                              <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs">
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
                <p className="mt-2 break-words text-xl font-semibold text-stone-950 sm:text-2xl">{formatBRL(monthlyIncome)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Contas fixas</p>
                <p className="mt-2 break-words text-xl font-semibold text-stone-950 sm:text-2xl">{formatBRL(monthlyFixedExpenses)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Sobra estimada</p>
                <p className="mt-2 break-words text-xl font-semibold text-stone-950 sm:text-2xl">{formatBRL(estimatedBalance)}</p>
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
                <p className="mt-2 break-words text-xl font-semibold text-stone-950 sm:text-2xl">{formatBRL(totalLimit)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Limite comprometido</p>
                <p className="mt-2 break-words text-xl font-semibold text-stone-950 sm:text-2xl">{formatBRL(committedLimit)}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${limitTone(availableLimit, totalLimit)}`}>
                <p className="text-xs uppercase tracking-[0.16em] opacity-70">Limite disponível</p>
                <p className="mt-2 break-words text-xl font-semibold sm:text-2xl">{formatBRL(availableLimit)}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {projections.map((projection) => (
                <div key={projection.monthLabel} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-stone-900 capitalize">{projection.monthLabel}</p>
                    <p className="text-xs text-stone-500">Projeção mensal</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-stone-500">Contas fixas</p>
                      <p className="mt-1 break-words text-sm font-semibold text-stone-900">{formatBRL(projection.fixedExpenses)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-stone-500">Parcelas</p>
                      <p className="mt-1 break-words text-sm font-semibold text-stone-900">{formatBRL(projection.commitments)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-stone-500">Sobra estimada</p>
                      <p className="mt-1 break-words text-sm font-semibold text-stone-900">{formatBRL(projection.estimatedBalance)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {showAddForm && (
        <AddCommitmentModal
          paymentMethods={creditCardMethods}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </Layout>
  );
}

function AddCommitmentModal({
  paymentMethods,
  onClose,
}: {
  paymentMethods: ReturnType<typeof useFinance>["paymentMethods"];
  onClose: () => void;
}) {
  const { household, addFinancialCommitment } = useFinance();
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [itemName, setItemName] = useState("");
  const [installmentValue, setInstallmentValue] = useState("");
  const [currentInstallment, setCurrentInstallment] = useState("1");
  const [totalInstallments, setTotalInstallments] = useState("1");
  const [responsiblePerson, setResponsiblePerson] = useState(household?.partnerNames[0] || "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!paymentMethodId && paymentMethods.length > 0) {
      setPaymentMethodId(paymentMethods[0].id);
    }
  }, [paymentMethodId, paymentMethods]);

  useEffect(() => {
    if (!responsiblePerson && household?.partnerNames[0]) {
      setResponsiblePerson(household.partnerNames[0]);
    }
  }, [household?.partnerNames, responsiblePerson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(installmentValue.replace(",", "."));
    const current = parseInt(currentInstallment, 10) || 1;
    const total = parseInt(totalInstallments, 10) || 1;
    if (!paymentMethodId || !itemName.trim() || !amount) return;

    setSaving(true);
    try {
      await addFinancialCommitment({
        paymentMethodId,
        itemName: itemName.trim(),
        installmentValue: amount,
        currentInstallment: current,
        totalInstallments: total,
        responsiblePerson: responsiblePerson.trim() || "Sem responsável",
        notes: notes.trim(),
        startedAt: new Date().toISOString().split("T")[0],
        status: "active",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-stone-950">Novo compromisso</h2>
            <p className="mt-0.5 text-xs text-stone-500">Adicione um compromisso financeiro ao cartão/forma de pagamento.</p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <Trash2 className="h-5 w-5 rotate-45" />
          </button>
        </div>

        <form className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Item</label>
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Valor da parcela</label>
              <input value={installmentValue} onChange={(e) => setInstallmentValue(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Forma de pagamento</label>
              <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                <option value="">Selecione</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Parcela atual</label>
              <input value={currentInstallment} onChange={(e) => setCurrentInstallment(e.target.value)} type="number" min="1" className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Total de parcelas</label>
              <input value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} type="number" min="1" className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Responsável</label>
              <input value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Observações</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              <Plus className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar compromisso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
