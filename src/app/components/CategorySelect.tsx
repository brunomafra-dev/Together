import { useFinance } from "../context/FinanceContext";

interface CategorySelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  className?: string;
}

export function CategorySelect({
  value,
  onChange,
  placeholder = "Selecione uma categoria",
  className = "",
}: CategorySelectProps) {
  const { categories } = useFinance();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-stone-900 ${className}`}
    >
      <option value="">{placeholder}</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </select>
  );
}
