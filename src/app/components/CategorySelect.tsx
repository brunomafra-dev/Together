import { useFinance } from "../context/FinanceContext";
import { dedupeCategories } from "../utils/categories";

const DEFAULT_CATEGORY_NAMES = ["Moradia", "Alimenta\u00e7\u00e3o", "Gasolina", "Lazer", "Sa\u00fade", "Assinaturas", "Investimentos", "Outros"];

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
  const rawOptions = categories.length > 0
    ? categories
    : DEFAULT_CATEGORY_NAMES.map((name, index) => ({ id: `default-${index}`, name }));
  const categoryOptions = dedupeCategories(rawOptions);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-stone-900 ${className}`}
    >
      <option value="">{placeholder}</option>
      {categoryOptions.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </select>
  );
}
