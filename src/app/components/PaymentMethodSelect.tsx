import { useFinance } from "../context/FinanceContext";

const DEFAULT_PAYMENT_METHODS = [
  { id: "default-pix", name: "Pix" },
  { id: "default-money", name: "Dinheiro" },
  { id: "default-debit", name: "Débito" },
];

interface PaymentMethodSelectProps {
  value: string;
  onChange: (methodId: string) => void;
  placeholder?: string;
  className?: string;
}

export function PaymentMethodSelect({
  value,
  onChange,
  placeholder = "Selecione a forma de pagamento",
  className = "",
}: PaymentMethodSelectProps) {
  const { paymentMethods } = useFinance();
  const paymentOptions = paymentMethods.length > 0 ? paymentMethods : DEFAULT_PAYMENT_METHODS;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-stone-900 ${className}`}
    >
      <option value="">{placeholder}</option>
      {paymentOptions.map((method) => (
        <option key={method.id} value={method.id}>
          {method.name}
        </option>
      ))}
    </select>
  );
}
