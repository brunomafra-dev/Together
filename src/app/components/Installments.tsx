import { useEffect, useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, CircleDollarSign, Clock3, Layers3, Plus, Sparkles, TrendingDown, Trash2, Wallet } from "lucide-react";
import { Layout } from "./Layout";
import { formatBRL, useFinance } from "../context/FinanceContext";
import * as financeService from "../../services/financeService";

type PaymentMethodBucket = {
  id: string;
  name: string;
  totalLimit: number;
  commitments: Array<{
    id: string;
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

const FALLBACK_COMMITMENTS = [
  { id: "1", paymentMethodId: "pm-nubank-bruno", paymentMethod: "Nubank Bruno", itemName: "Sofá", installmentValue: 240, currentInstallment: 5, totalInstallments: 12, responsiblePerson: "Você", notes: "Sala de estar, compra feita no começo do semestre.", startedAt: "2025-02-01", status: "active" as const },
  { id: "2", paymentMethodId: "pm-nubank-bruno", paymentMethod: "Nubank Bruno", itemName: "TV", installmentValue: 180, currentInstallment: 8, totalInstallments: 10, responsiblePerson: "Esposa", notes: "Sala principal. Faltam poucas parcelas.", startedAt: "2024-11-01", status: "active" as const },
  { id: "3", paymentMethodId: "pm-inter-esposa", paymentMethod: "Inter da Esposa", itemName: "Máquina de Lavar", installmentValue: 150, currentInstallment: 12, totalInstallments: 12, responsiblePerson: "Você", notes: "Concluída no mês passado.", startedAt: "2024-01-01", status: "finished" as const },
  { id: "4", paymentMethodId: "pm-xp-spouse", paymentMethod: "XP da Esposa", itemName: "Celular", installmentValue: 220, currentInstallment: 2, totalInstallments: 18, responsiblePerson: "Esposa", notes: "Uso pessoal, compra recente.", startedAt: "2025-04-01", status: "active" as const },
];

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

export function Installments() {
  const { paymentMethods } = useFinance();
  const [commitments, setCommitments] = useState(FALLBACK_COMMITMENTS);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      const householdId = await financeService.getUserHouseholdId();
      if (!householdId) return;
      const rows = await financeService.fetchFinancialCommitments(householdId).catch(() => []);
      if (rows.length > 0) {
        setCommitments(
          rows.map((row) => {
            const method = paymentMethods.find((m) => m.id === row.paymentMethodId);
            return {
              id: row.id,
              paymentMethodId: row.paymentMethodId,
              paymentMethod: method?.name || "Sem forma de pagamento",
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
      }
    };
    void load();
  }, [paymentMethods]);

  const buckets = useMemo<PaymentMethodBucket[]>(() => {
    const source =
      paymentMethods.length > 0
        ? paymentMethods.map((method) => ({ id: method.id, name: method.name, totalLimit: method.limitAmount ?? 0 }))
        : Array.from(new Map(commitments.map((c) => [c.paymentMethodId, { id: c.paymentMethodId, name: c.paymentMethod, totalLimit: 0 }])).values());

    return source.map((method) => {
      const methodCommitments = commitments.filter((c) => c.paymentMethodId === method.id);
      return { ...method, commitments: methodCommitments };
    });
  }, [paymentMethods, commitments]);

  const totalLimit = buckets.reduce((sum, bucket) => sum + bucket.totalLimit, 0);
  const committedLimit = buckets.reduce((sum, bucket) => sum + bucket.commitments.reduce((sum, c) => sum + c.installmentValue, 0), 0);
  const availableLimit = Math.max(totalLimit - committedLimit, 0);
  const activeInstallments = commitments.filter((c) => c.status !== "finished").length;
  const remainingInstallments = commitments.filter((c) => c.status !== "finished").reduce((sum, c) => sum + Math.max(c.totalInstallments - c.currentInstallment, 0), 0);
  const estimatedEndDate = commitments.length ? format(addMonths(new Date(), Math.max(...commitments.filter((c) => c.status !== "finished").map((c) => Math.max(c.totalInstallments - c.currentInstallment, 0)), 0)), "MMMM 'de' yyyy", { locale: ptBR }) : "Sem previsão";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Parcelas</h1>
            <p className="mt-1 text-sm text-stone-600">Compromissos financeiros recorrentes do casal</p>
            <p className="mt-1 text-xs text-stone-500">Agrupado por forma de pagamento para mostrar o poder de compra disponível.</p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-white transition-colors hover:bg-stone-800">
            <Plus className="h-4 w-4" />
            Novo compromisso
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-6"><div className="mb-2 flex items-center gap-2 text-xs text-stone-500"><Layers3 className="h-4 w-4" />Active Installments</div><p className="text-3xl font-semibold text-stone-900">{activeInstallments}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6"><div className="mb-2 flex items-center gap-2 text-xs text-stone-500"><CalendarCheck className="h-4 w-4" />Remaining Installments</div><p className="text-3xl font-semibold text-stone-900">{remainingInstallments}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6"><div className="mb-2 flex items-center gap-2 text-xs text-stone-500"><TrendingDown className="h-4 w-4" />Monthly Commitment Value</div><p className="text-3xl font-semibold text-stone-900">{formatBRL(committedLimit)}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6"><div className="mb-2 flex items-center gap-2 text-xs text-stone-500"><Clock3 className="h-4 w-4" />Estimated End Date</div><p className="text-3xl font-semibold capitalize text-stone-900">{estimatedEndDate}</p></div>
        </div>

        <div className="space-y-6">
          {buckets.map((bucket) => {
            const committed = bucket.commitments.reduce((sum, c) => sum + c.installmentValue, 0);
            const available = Math.max(bucket.totalLimit - committed, 0);
            return (
              <section key={bucket.id} className="space-y-4">
                <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-stone-500" /><h3 className="text-xl font-semibold text-stone-950">{bucket.name}</h3></div>
                      <p className="text-sm text-stone-600">Veja o limite total, comprometido e disponível para esta forma de pagamento.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Total Limit</p><p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(bucket.totalLimit)}</p></div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Committed Limit</p><p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(committed)}</p></div>
                      <div className={`rounded-2xl border p-4 ${limitTone(available, bucket.totalLimit)}`}><p className="text-xs uppercase tracking-[0.16em] opacity-70">Available Limit</p><p className="mt-2 text-2xl font-semibold">{formatBRL(available)}</p></div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {bucket.commitments.length > 0 ? bucket.commitments.map((commitment) => {
                    const remaining = Math.max(commitment.totalInstallments - commitment.currentInstallment, 0);
                    const endDate = format(addMonths(new Date(commitment.startedAt), remaining), "MMMM 'de' yyyy", { locale: ptBR });
                    const progress = Math.min((commitment.currentInstallment / commitment.totalInstallments) * 100, 100);
                    return (
                      <article key={commitment.id} className="group rounded-2xl border border-stone-200 bg-white p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2"><h4 className="font-medium text-stone-900">{commitment.itemName}</h4><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(commitment.status)}`}>{commitment.status === "finished" ? "Concluído" : commitment.status === "late" ? "Em atraso" : "Ativo"}</span></div>
                            <p className="text-xs text-stone-500"><span className="font-medium text-stone-600">{commitment.responsiblePerson}</span> · {commitment.paymentMethod} · termina em {endDate}</p>
                          </div>
                          <button type="button" className="text-stone-400 transition-all hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                          <div><p className="mb-1 text-xs text-stone-500">Item Name</p><p className="font-semibold text-stone-900">{commitment.itemName}</p></div>
                          <div><p className="mb-1 text-xs text-stone-500">Payment Method</p><p className="font-semibold text-stone-900">{commitment.paymentMethod}</p></div>
                          <div><p className="mb-1 text-xs text-stone-500">Installment Value</p><p className="font-semibold text-stone-900">{formatBRL(commitment.installmentValue)}</p></div>
                          <div><p className="mb-1 text-xs text-stone-500">Responsible Person</p><p className="font-semibold text-stone-900">{commitment.responsiblePerson}</p></div>
                        </div>
                        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                          <div><p className="mb-1 text-xs text-stone-500">Current Installment</p><p className="font-semibold text-stone-900">{commitment.currentInstallment} de {commitment.totalInstallments}</p></div>
                          <div><p className="mb-1 text-xs text-stone-500">Total Installments</p><p className="font-semibold text-stone-900">{commitment.totalInstallments}</p></div>
                          <div><p className="mb-1 text-xs text-stone-500">Remaining</p><p className="font-semibold text-stone-900">{remaining} mês{remaining === 1 ? "" : "es"}</p></div>
                          <div><p className="mb-1 text-xs text-stone-500">Estimated End</p><p className="font-semibold text-stone-900">{endDate}</p></div>
                        </div>
                        <div className="mb-4 rounded-2xl bg-stone-50 p-4"><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-500"><CircleDollarSign className="h-4 w-4" />Notes</div><p className="text-sm text-stone-700">{commitment.notes}</p></div>
                        <div><div className="mb-2 flex justify-between text-xs"><span className="text-stone-600">{commitment.status === "finished" ? "Compromisso encerrado" : commitment.status === "late" ? "Acompanhar atrasos" : "No ritmo esperado"}</span><span className="text-stone-500">{commitment.currentInstallment} de {commitment.totalInstallments}</span></div><div className="h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all" style={{ width: `${progress}%` }} /></div></div>
                      </article>
                    );
                  }) : <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center"><p className="text-sm text-stone-400">Nenhum compromisso ativo nesta forma de pagamento.</p></div>}
                </div>
              </section>
            );
          })}
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Sparkles className="h-5 w-5" /></div><div><h3 className="text-xl font-medium text-stone-950">Impact Analysis</h3><p className="text-sm text-stone-600">Estrutura local pronta para projeções futuras</p></div></div>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/70 p-4 text-sm text-stone-700">Esta base já calcula o poder de compra disponível por cartão e pode ser usada depois para projeções de impacto financeiro.</div>
          </div>
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><Wallet className="h-5 w-5" /></div><div><h3 className="text-xl font-medium text-stone-950">Resumo geral</h3><p className="text-sm text-stone-600">Visão consolidada do limite disponível no momento</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Total Limit</p><p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(totalLimit)}</p></div><div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Committed Limit</p><p className="mt-2 text-2xl font-semibold text-stone-950">{formatBRL(committedLimit)}</p></div><div className={`rounded-2xl border p-4 ${limitTone(availableLimit, totalLimit)}`}><p className="text-xs uppercase tracking-[0.16em] opacity-70">Available Limit</p><p className="mt-2 text-2xl font-semibold">{formatBRL(availableLimit)}</p></div></div>
          </div>
        </section>
      </div>
      {showAddForm && <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddForm(false)} />}
    </Layout>
  );
}
