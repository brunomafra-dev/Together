export type LocalDateString = string;

export type LocalDateInput = LocalDateString | Date;

export interface CreditCardBillingDates {
  closingDate: LocalDateString;
  dueDate: LocalDateString;
}

export interface PaymentMethodBillingConfig {
  type?: string | null;
  closingDay?: number | null;
  dueDay?: number | null;
}

export interface ExpenseDateLike {
  date: LocalDateInput;
}

export interface ExpenseCycleDateLike extends ExpenseDateLike {
  invoiceClosingDate?: LocalDateString | null;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const padDatePart = (value: number, length = 2) => String(value).padStart(length, "0");

const createLocalDate = (year: number, monthIndex: number, day: number) => {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, monthIndex, day);
  return date;
};

const assertValidDate = (date: Date) => {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date.");
  }
};

const assertBillingDay = (day: number, fieldName: "closingDay" | "dueDay") => {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(`${fieldName} must be an integer between 1 and 31.`);
  }
};

const copyAsLocalDate = (date: Date) => {
  assertValidDate(date);
  return createLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
};

const toLocalDate = (value: LocalDateInput) =>
  typeof value === "string" ? parseLocalDate(value) : copyAsLocalDate(value);

const lastDayOfMonth = (year: number, monthIndex: number) =>
  createLocalDate(year, monthIndex + 1, 0).getDate();

const dateAtConfiguredDay = (year: number, monthIndex: number, configuredDay: number) =>
  createLocalDate(year, monthIndex, Math.min(configuredDay, lastDayOfMonth(year, monthIndex)));

const compareLocalDates = (left: Date, right: Date) => left.getTime() - right.getTime();

/** Parses an exact YYYY-MM-DD value as a local calendar date (never as UTC). */
export function parseLocalDate(value: LocalDateString): Date {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid local date "${value}". Expected YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = createLocalDate(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new RangeError(`Invalid local date "${value}".`);
  }

  return date;
}

/** Formats a Date with local calendar fields, without converting it to UTC. */
export function formatLocalDate(date: Date): LocalDateString {
  assertValidDate(date);
  return `${padDatePart(date.getFullYear(), 4)}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate(),
  )}`;
}

export function isLocalDateString(value: unknown): value is LocalDateString {
  if (typeof value !== "string" || !LOCAL_DATE_PATTERN.test(value)) return false;

  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

export function previousLocalDate(date: LocalDateInput): LocalDateString {
  const result = toLocalDate(date);
  result.setDate(result.getDate() - 1);
  return formatLocalDate(result);
}

export function nextLocalDate(date: LocalDateInput): LocalDateString {
  const result = toLocalDate(date);
  result.setDate(result.getDate() + 1);
  return formatLocalDate(result);
}

/** Adds whole calendar months, clamping to the last valid day in the target month. */
export function addLocalMonths(date: LocalDateInput, months: number): LocalDateString {
  if (!Number.isInteger(months)) {
    throw new RangeError("Months must be an integer.");
  }

  const source = toLocalDate(date);
  const targetMonth = createLocalDate(source.getFullYear(), source.getMonth() + months, 1);
  return formatLocalDate(
    dateAtConfiguredDay(targetMonth.getFullYear(), targetMonth.getMonth(), source.getDate()),
  );
}

/** Returns end - start in whole calendar days, unaffected by daylight-saving changes. */
export function daysBetweenLocalDates(startDate: LocalDateInput, endDate: LocalDateInput): number {
  const start = toLocalDate(startDate);
  const end = toLocalDate(endDate);
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDay - startDay) / 86_400_000);
}

/** Provisional end for a cycle: the day before the same date in the following month. */
export function defaultCycleEnd(startDate: LocalDateInput): LocalDateString {
  return previousLocalDate(addLocalMonths(startDate, 1));
}

/**
 * Display horizon for a manually open cycle. It preserves the normal monthly
 * projection, but extends through today when the user deliberately keeps the
 * cycle open longer instead of silently hiding newer transactions.
 */
export function openCycleReferenceEnd(
  startDate: LocalDateInput,
  today: LocalDateInput = new Date(),
): LocalDateString {
  const plannedEnd = defaultCycleEnd(startDate);
  const todayDate = formatLocalDate(toLocalDate(today));
  return todayDate > plannedEnd ? todayDate : plannedEnd;
}

/** Checks cycle bounds inclusively. A null end date represents an open cycle. */
export function isDateWithinCycle(
  date: LocalDateInput,
  cycleStart: LocalDateInput,
  cycleEnd?: LocalDateInput | null,
): boolean {
  const candidate = toLocalDate(date);
  const start = toLocalDate(cycleStart);
  if (cycleEnd == null) return compareLocalDates(candidate, start) >= 0;

  const end = toLocalDate(cycleEnd);
  if (compareLocalDates(end, start) < 0) {
    throw new RangeError("Cycle end date cannot be before its start date.");
  }

  if (compareLocalDates(candidate, start) < 0) return false;
  return compareLocalDates(candidate, end) <= 0;
}

/**
 * Assigns a purchase to its card statement and payment date.
 * A purchase on the closing date stays on that statement; only later purchases roll forward.
 */
export function getCreditCardBillingDates(
  purchaseDate: LocalDateInput,
  closingDay: number,
  dueDay: number,
): CreditCardBillingDates {
  assertBillingDay(closingDay, "closingDay");
  assertBillingDay(dueDay, "dueDay");

  const purchase = toLocalDate(purchaseDate);
  let closing = dateAtConfiguredDay(purchase.getFullYear(), purchase.getMonth(), closingDay);

  if (compareLocalDates(purchase, closing) > 0) {
    closing = dateAtConfiguredDay(purchase.getFullYear(), purchase.getMonth() + 1, closingDay);
  }

  let due = dateAtConfiguredDay(closing.getFullYear(), closing.getMonth(), dueDay);
  if (compareLocalDates(due, closing) <= 0) {
    due = dateAtConfiguredDay(closing.getFullYear(), closing.getMonth() + 1, dueDay);
  }

  return {
    closingDate: formatLocalDate(closing),
    dueDate: formatLocalDate(due),
  };
}

export function getCreditCardClosingDate(
  purchaseDate: LocalDateInput,
  closingDay: number,
): LocalDateString {
  assertBillingDay(closingDay, "closingDay");

  const purchase = toLocalDate(purchaseDate);
  let closing = dateAtConfiguredDay(purchase.getFullYear(), purchase.getMonth(), closingDay);
  if (compareLocalDates(purchase, closing) > 0) {
    closing = dateAtConfiguredDay(purchase.getFullYear(), purchase.getMonth() + 1, closingDay);
  }

  return formatLocalDate(closing);
}

export function getCreditCardDueDate(
  purchaseDate: LocalDateInput,
  closingDay: number,
  dueDay: number,
): LocalDateString {
  return getCreditCardBillingDates(purchaseDate, closingDay, dueDay).dueDate;
}

/**
 * Calculates the competence date before an expense is persisted: the statement
 * closing date for configured credit cards, or the purchase date otherwise.
 */
export function getExpenseEffectiveDate(
  expenseOrDate: ExpenseDateLike | LocalDateInput,
  paymentMethod?: PaymentMethodBillingConfig | null,
): LocalDateString {
  const purchaseDate =
    typeof expenseOrDate === "object" && !(expenseOrDate instanceof Date)
      ? expenseOrDate.date
      : expenseOrDate;

  if (paymentMethod?.type !== "credit_card" || paymentMethod.closingDay == null) {
    return formatLocalDate(toLocalDate(purchaseDate));
  }

  return getCreditCardClosingDate(purchaseDate, paymentMethod.closingDay);
}

/**
 * Returns the date that assigns a saved expense to a financial cycle.
 * Card purchases use the frozen statement closing date; all other purchases
 * use their purchase date. The due date remains payment information only.
 */
export function getExpenseCycleDate(expense: ExpenseCycleDateLike): LocalDateString {
  if (isLocalDateString(expense.invoiceClosingDate)) return expense.invoiceClosingDate;
  return formatLocalDate(toLocalDate(expense.date));
}

export const previousDay = previousLocalDate;
export const nextDay = nextLocalDate;
export const isDateInCycle = isDateWithinCycle;
