import { useEffect, useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck,
  Clock3,
  Layers3,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { ExpandableSection } from "./ExpandableSection";
import { Layout } from "./Layout";
import { formatBRL, useFinance } from "../context/FinanceContext";
import { CategorySelect } from "./CategorySelect";

type Commitment = {
  id: string;
  paymentMethodId: string | null;
  categoryId: string;
  itemName: string;
  installmentValue: number;
  currentInstallment: number;
  totalInstallments: number;
  responsiblePerson: string;
  notes: string;
  startedAt: string;
  status: "active" | "finished" | "late";
};

type PaymentMethodBucket = {
  id: string;
  name: string;
  totalLimit: number;
  billExpenses: number;
  billInstallments: number;
  expenseLimitUsed: number;
  commitmentLimitUsed: number;
  commitments: Commitment[];
};

function statusTone(status: Commitment["status"]) {
  switch (status) {
    case "finished":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case "late":
      return "border-rose-100 bg-rose-50 text-rose-700";
    default:
      return "border-sky-100 bg-sky-50 text-sky-700";
  }
}

function limitTone(available: number, totalLimit: number) {
  const ratio = totalLimit > 0 ? available / totalLimit : 1;
  if (ratio <= 0.15) return "border-rose-100 bg-rose-50 text-rose-900";
  if (ratio <= 0.35) return "border-amber-100 bg-amber-50 text-amber-900";
  return "border-emerald-100 bg-emerald-50 text-emerald-900";
}

function billingKeyForPurchase(date: string, closingDay?: number | null) {
  const purchaseDate = new Date(`${date}T00:00:00`);
  const billDate =
    purchaseDate.getDate() > (closingDay || 31) ? addMonths(purchaseDate, 1) : purchaseDate;

  return `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, "0")}`;
}

function dueKeyForPurchase(date: string, closingDay?: number | null) {
  const [year, month] = billingKeyForPurchase(date, closingDay).split("-").map(Number);
  const dueDate = addMonths(new Date(year, month - 1, 1), 1);

  return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function remainingInstallments(commitment: Commitment) {
  if (commitment.status === "finished") return 0;
  return Math.max(commitment.totalInstallments - commitment.currentInstallment, 0);
}

function remainingCommitmentAmount(commitment: Commitment) {
  return commitment.installmentValue * remainingInstallments(commitment);
}

function currentCommitmentDue(commitment: Commitment) {
  return remainingInstallments(commitment) > 0 ? commitment.installmentValue : 0;
}

function commitmentEndDate(commitment: Commitment, nextBillDate: Date) {
  const remaining = remainingInstallments(commitment);
  if (remaining === 0) return "Concluído";

  return format(addMonths(nextBillDate, remaining - 1), "MMM/yyyy", {
    locale: ptBR,
  });
}

export function Installments() {
  const {
    paymentMethods,
    financialCommitments: commitments,
    expenses,
    household,
    categories,
    activeCycle,
    deleteFinancialCommitment,
  } = useFinance();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<Commitment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const creditCardMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === "credit_card"),
    [paymentMethods],
  );
  const activeMonthDate = new Date(activeCycle.year, activeCycle.month - 1, 1);
  const nextBillDate = addMonths(activeMonthDate, 1);
  const nextBillKey = monthKey(nextBillDate);
  const nextBillLabel = format(nextBillDate, "MMMM 'de' yyyy", { locale: ptBR });

  const buckets = useMemo<PaymentMethodBucket[]>(() => {
    return creditCardMethods.map((method) => {
      const methodCommitments = commitments.filter(
        (commitment) => commitment.paymentMethodId === method.id,
      );
      const methodExpenses = expenses.filter((expense) => expense.card === method.id);

      return {
        id: method.id,
        name: method.name,
        totalLimit: method.limitAmount ?? 0,
        billExpenses: methodExpenses
          .filter(
            (expense) => dueKeyForPurchase(expense.date, method.closingDay) === nextBillKey,
          )
          .reduce((sum, expense) => sum + expense.amount, 0),
        billInstallments: methodCommitments.reduce(
          (sum, commitment) => sum + currentCommitmentDue(commitment),
          0,
        ),
        expenseLimitUsed: methodExpenses
          .filter((expense) => dueKeyForPurchase(expense.date, method.closingDay) >= nextBillKey)
          .reduce((sum, expense) => sum + expense.amount, 0),
        commitmentLimitUsed: methodCommitments.reduce(
          (sum, commitment) => sum + remainingCommitmentAmount(commitment),
          0,
        ),
        commitments: methodCommitments,
      };
    });
  }, [commitments, creditCardMethods, expenses, nextBillKey]);

  const noCardCommitments = useMemo(
    () => commitments.filter((commitment) => !commitment.paymentMethodId),
    [commitments],
  );

  const totalLimit = buckets.reduce((sum, bucket) => sum + bucket.totalLimit, 0);
  const expensesLimitUsed = buckets.reduce((sum, bucket) => sum + bucket.expenseLimitUsed, 0);
  const installmentsLimitUsed = buckets.reduce((sum, bucket) => sum + bucket.commitmentLimitUsed, 0);
  const usedLimit = expensesLimitUsed + installmentsLimitUsed;
  const availableLimit = Math.max(totalLimit - usedLimit, 0);
  const currentBillTotal = buckets.reduce(
    (sum, bucket) => sum + bucket.billExpenses + bucket.billInstallments,
    0,
  );
  const noCardMonthlyTotal = noCardCommitments.reduce(
    (sum, commitment) => sum + currentCommitmentDue(commitment),
    0,
  );
  const activeInstallments = commitments.filter((commitment) => commitment.status !== "finished").length;
  const totalRemainingInstallments = commitments.reduce(
    (sum, commitment) => sum + remainingInstallments(commitment),
    0,
  );
  const maxRemainingInstallments = Math.max(
    ...commitments.map((commitment) => remainingInstallments(commitment)),
    0,
  );
  const estimatedEndDate =
    maxRemainingInstallments > 0
      ? format(addMonths(activeMonthDate, maxRemainingInstallments), "MMMM 'de' yyyy", {
          locale: ptBR,
        })
      : "Sem parcelas abertas";

  const handleDeleteCommitment = async (id: string) => {
    if (!window.confirm("Excluir este parcelamento?")) return;

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
            <p className="mt-1 text-sm text-stone-600">
              Cartões, limite usado hoje e próxima fatura.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-medium text-emerald-700 transition-colors hover:bg-emerald-100 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Novo parcelamento
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Layers3} label="Parcelamentos ativos" value={String(activeInstallments)} />
          <SummaryCard
            icon={CalendarCheck}
            label="Parcelas restantes"
            value={String(totalRemainingInstallments)}
          />
          <SummaryCard icon={Wallet} label={`Fatura ${nextBillLabel}`} value={formatBRL(currentBillTotal)} />
          <SummaryCard icon={Clock3} label="Término estimado" value={estimatedEndDate} capitalize />
        </div>

        <ExpandableSection
          title="Resumo geral"
          summary={`${buckets.length} cartões · ${formatBRL(currentBillTotal)} próxima fatura · ${formatBRL(availableLimit)} livre`}
          defaultOpen
        >
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricBlock label="Limite total" value={formatBRL(totalLimit)} />
            <MetricBlock label="Usado em compras" value={formatBRL(expensesLimitUsed)} />
            <MetricBlock label="Usado em parcelas" value={formatBRL(installmentsLimitUsed)} />
            <MetricBlock
              label="Limite disponível"
              value={formatBRL(availableLimit)}
              className={limitTone(availableLimit, totalLimit)}
            />
          </div>

          <div className="mt-6 space-y-5">
            {buckets.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center">
                <p className="text-sm text-stone-500">Nenhum cartão cadastrado ainda.</p>
              </div>
            ) : (
              buckets.map((bucket) => (
                <CardSummary
                  key={bucket.id}
                  bucket={bucket}
                  deletingId={deletingId}
                  onDelete={handleDeleteCommitment}
                  onEdit={setEditingCommitment}
                  nextBillDate={nextBillDate}
                  categories={categories}
                  nextBillLabel={nextBillLabel}
                />
              ))
            )}
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Fora do cartão"
          summary={
            noCardCommitments.length > 0
              ? `${noCardCommitments.length} parcelamentos · ${formatBRL(noCardMonthlyTotal)}/mês`
              : "Nenhum parcelamento fora do cartão"
          }
          defaultOpen={noCardCommitments.length > 0}
        >
          <div className="space-y-3">
            {noCardCommitments.length === 0 ? (
              <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
                Nenhum parcelamento fora do cartão cadastrado.
              </p>
            ) : (
              noCardCommitments.map((commitment) => (
                <CommitmentRow
                  key={commitment.id}
                  commitment={commitment}
                  deletingId={deletingId}
                  nextBillDate={nextBillDate}
                  categories={categories}
                  onEdit={setEditingCommitment}
                  onDelete={handleDeleteCommitment}
                />
              ))
            )}
          </div>
        </ExpandableSection>
      </div>

      {showAddForm && (
        <AddCommitmentModal
          paymentMethods={creditCardMethods}
          onClose={() => setShowAddForm(false)}
        />
      )}
      {editingCommitment && (
        <AddCommitmentModal
          paymentMethods={creditCardMethods}
          commitment={editingCommitment}
          onClose={() => setEditingCommitment(null)}
        />
      )}
    </Layout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  capitalize = false,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p
        className={`break-words text-2xl font-semibold text-stone-900 sm:text-3xl ${
          capitalize ? "capitalize" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  className = "border-stone-200 bg-stone-50 text-stone-950",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <p className="text-xs uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold sm:text-2xl">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function CardSummary({
  bucket,
  deletingId,
  onEdit,
  onDelete,
  nextBillDate,
  categories,
  nextBillLabel,
}: {
  bucket: PaymentMethodBucket;
  deletingId: string | null;
  onEdit: (commitment: Commitment) => void;
  onDelete: (id: string) => Promise<void>;
  nextBillDate: Date;
  categories: ReturnType<typeof useFinance>["categories"];
  nextBillLabel: string;
}) {
  const used = bucket.expenseLimitUsed + bucket.commitmentLimitUsed;
  const available = Math.max(bucket.totalLimit - used, 0);
  const usagePercent = bucket.totalLimit > 0 ? Math.min((used / bucket.totalLimit) * 100, 100) : 0;

  return (
    <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 shrink-0 text-stone-500" />
            <h3 className="break-words text-lg font-semibold text-stone-950">{bucket.name}</h3>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Fatura {nextBillLabel}: {formatBRL(bucket.billExpenses + bucket.billInstallments)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px] xl:grid-cols-4">
          <MiniMetric label="Limite" value={formatBRL(bucket.totalLimit)} />
          <MiniMetric label="Compras" value={formatBRL(bucket.expenseLimitUsed)} />
          <MiniMetric label="Parcelas" value={formatBRL(bucket.commitmentLimitUsed)} />
          <MiniMetric label="Disponível" value={formatBRL(available)} />
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${usagePercent}%` }} />
      </div>

      <div className="mt-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h4 className="text-sm font-semibold text-stone-900">Parcelas deste cartão</h4>
          <p className="text-xs text-stone-500">
            A cada parcela paga, o saldo em aberto reduz e o limite volta.
          </p>
        </div>
        <div className="space-y-3">
          {bucket.commitments.length === 0 ? (
            <p className="rounded-xl bg-white p-4 text-sm text-stone-500">
              Nenhuma parcela cadastrada neste cartão.
            </p>
          ) : (
            bucket.commitments.map((commitment) => (
              <CommitmentRow
                key={commitment.id}
                commitment={commitment}
                deletingId={deletingId}
                nextBillDate={nextBillDate}
                categories={categories}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>
    </article>
  );
}

function CommitmentRow({
  commitment,
  deletingId,
  nextBillDate,
  categories,
  onEdit,
  onDelete,
}: {
  commitment: Commitment;
  deletingId: string | null;
  nextBillDate: Date;
  categories: ReturnType<typeof useFinance>["categories"];
  onEdit: (commitment: Commitment) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const remaining = remainingInstallments(commitment);
  const remainingAmount = remainingCommitmentAmount(commitment);
  const progress =
    commitment.totalInstallments > 0
      ? Math.min((commitment.currentInstallment / commitment.totalInstallments) * 100, 100)
      : 0;
  const categoryName = categories.find((category) => category.id === commitment.categoryId)?.name || "Sem categoria";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-semibold text-stone-950">{commitment.itemName}</p>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(
                commitment.status,
              )}`}
            >
              {commitment.status === "finished"
                ? "Concluído"
                : commitment.status === "late"
                  ? "Em atraso"
                  : "Ativo"}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {categoryName} - {commitment.currentInstallment} de {commitment.totalInstallments} pagas, {remaining} restantes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(commitment)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-[0_0_18px_rgba(16,185,129,0.16)]"
            aria-label="Editar parcelamento"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void onDelete(commitment.id)}
            disabled={deletingId === commitment.id}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-[0_0_18px_rgba(244,63,94,0.16)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Excluir parcelamento"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MiniMetric label="Valor da parcela" value={formatBRL(commitment.installmentValue)} />
        <MiniMetric label="Próxima fatura" value={formatBRL(currentCommitmentDue(commitment))} />
        <MiniMetric label="Saldo em aberto" value={formatBRL(remainingAmount)} />
        <MiniMetric label="Termina em" value={commitmentEndDate(commitment, nextBillDate)} />
        <MiniMetric label="Responsável" value={commitment.responsiblePerson || "Sem responsável"} />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      {commitment.notes && <p className="mt-3 text-sm text-stone-600">{commitment.notes}</p>}
    </div>
  );
}

function AddCommitmentModal({
  paymentMethods,
  commitment,
  onClose,
}: {
  paymentMethods: ReturnType<typeof useFinance>["paymentMethods"];
  commitment?: Commitment;
  onClose: () => void;
}) {
  const { household, addFinancialCommitment, updateFinancialCommitment } = useFinance();
  const [paymentMethodId, setPaymentMethodId] = useState(
    commitment?.paymentMethodId ?? "",
  );
  const [itemName, setItemName] = useState(commitment?.itemName ?? "");
  const [categoryId, setCategoryId] = useState(commitment?.categoryId ?? "");
  const [installmentValue, setInstallmentValue] = useState(
    commitment ? String(commitment.installmentValue).replace(".", ",") : "",
  );
  const [currentInstallment, setCurrentInstallment] = useState(
    commitment ? String(commitment.currentInstallment) : "0",
  );
  const [totalInstallments, setTotalInstallments] = useState(
    commitment ? String(commitment.totalInstallments) : "1",
  );
  const [responsiblePerson, setResponsiblePerson] = useState(
    commitment?.responsiblePerson ?? household?.partnerNames[0] ?? "",
  );
  const [notes, setNotes] = useState(commitment?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const partnerOptions = useMemo(
    () => (household?.partnerNames ?? []).filter((name) => name.trim().length > 0),
    [household?.partnerNames],
  );

  useEffect(() => {
    if (!responsiblePerson && partnerOptions[0]) {
      setResponsiblePerson(partnerOptions[0]);
    }
  }, [partnerOptions, responsiblePerson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(installmentValue.replace(",", "."));
    const total = parseInt(totalInstallments, 10) || 1;
    const current = Math.min(Math.max(parseInt(currentInstallment, 10) || 0, 0), total);
    if (!itemName.trim() || !amount) return;

    setSaving(true);
    try {
      const payload = {
        paymentMethodId: paymentMethodId || null,
        categoryId,
        itemName: itemName.trim(),
        installmentValue: amount,
        currentInstallment: current,
        totalInstallments: total,
        responsiblePerson: responsiblePerson.trim() || "Sem responsável",
        notes: notes.trim(),
        startedAt: commitment?.startedAt ?? new Date().toISOString().split("T")[0],
        status: commitment?.status ?? "active",
      };

      if (commitment) {
        await updateFinancialCommitment(commitment.id, payload);
      } else {
        await addFinancialCommitment(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-stone-950">
              {commitment ? "Editar parcelamento" : "Novo parcelamento"}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Ajuste parcelas, valor e forma de pagamento.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">
                Item
              </label>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">
                Categoria
              </label>
              <CategorySelect value={categoryId} onChange={setCategoryId} placeholder="Selecione a categoria" />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">
                Valor da parcela
              </label>
              <input
                value={installmentValue}
                onChange={(e) => setInstallmentValue(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">
                Forma de pagamento
              </label>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Fora do cartão / boleto / acordo</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">
                Parcelas pagas
              </label>
              <input
                value={currentInstallment}
                onChange={(e) => setCurrentInstallment(e.target.value)}
                type="number"
                min="0"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-stone-500">
                Use 0 quando nenhuma parcela foi paga ainda.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">
                Total de parcelas
              </label>
              <input
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(e.target.value)}
                type="number"
                min="1"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">
                Responsável
              </label>
              <select
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {partnerOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">
                Observações
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Salvando..." : commitment ? "Salvar edição" : "Salvar parcelamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
