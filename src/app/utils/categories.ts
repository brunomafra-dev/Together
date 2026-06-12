export const normalizeCategoryName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?\uFFFD]/g, "")
    .toLowerCase()
    .trim();

export const canonicalCategoryName = (name: string) => {
  const hasMojibakeMarker = name.includes(String.fromCharCode(0xc3)) || name.includes("\uFFFD");
  const normalized = normalizeCategoryName(name);
  if (/alimenta/i.test(name) || name.includes("Alimenta?") || (name.includes("Alimenta") && hasMojibakeMarker)) {
    return "Alimentação";
  }
  if (/sa[?\uFFFD]/i.test(name) || name.includes("Sa?") || (name.includes("Sa") && hasMojibakeMarker)) {
    return "Saúde";
  }
  if (normalized.includes("aliment")) return "Alimentação";
  if (normalized.includes("sade") || normalized.includes("saude")) return "Saúde";
  return name.trim();
};

export const dedupeCategories = <T extends { id: string; name: string }>(categories: T[]) =>
  Array.from(
    categories
      .reduce((acc, category) => {
        const displayName = canonicalCategoryName(category.name);
        const key = normalizeCategoryName(displayName);
        if (!acc.has(key)) acc.set(key, { ...category, name: displayName } as T);
        return acc;
      }, new Map<string, T>())
      .values(),
  );
