export type TransactionKind = 'income' | 'expense';
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export type Transaction = {
  id: string;
  user_id: string;
  kind: TransactionKind;
  amount: number | string;
  category: string;
  description: string;
  transaction_date: string;
  created_at?: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category: string;
  month: string;
  amount: number | string;
};

export type RecurringTransaction = {
  id: string;
  user_id: string;
  kind: TransactionKind;
  amount: number | string;
  category: string;
  description: string;
  frequency: RecurrenceFrequency;
  start_date: string;
  next_due_date: string;
  end_date: string | null;
  active: boolean;
};

export const CATEGORIES: Record<TransactionKind, string[]> = {
  income: ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'],
  expense: [
    'Housing',
    'Food',
    'Transport',
    'Bills',
    'Shopping',
    'Health',
    'Entertainment',
    'Education',
    'Travel',
    'Other',
  ],
};

export const money = (amount: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);

export const today = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const currentMonth = () => today().slice(0, 7);

export function recentMonths(count: number, endMonth = currentMonth()) {
  const [year, month] = endMonth.split('-').map(Number);
  const end = new Date(year, month - 1, 1);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end.getFullYear(), end.getMonth() - count + index + 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function nextMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function transactionsToCsv(transactions: Transaction[]) {
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const rows = [
    ['Date', 'Type', 'Category', 'Description', 'Amount (CAD)'],
    ...transactions.map((transaction) => [
      transaction.transaction_date,
      transaction.kind,
      transaction.category,
      transaction.description ?? '',
      Number(transaction.amount).toFixed(2),
    ]),
  ];

  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function nextOccurrence(
  date: string,
  frequency: RecurrenceFrequency
) {
  const next = new Date(`${date}T12:00:00`);
  const originalDay = next.getDate();

  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'biweekly') next.setDate(next.getDate() + 14);

  if (frequency === 'monthly') {
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDay = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0
    ).getDate();
    next.setDate(Math.min(originalDay, lastDay));
  }

  if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);

  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-');
}

export function projectedRecurringTotal(
  schedules: RecurringTransaction[],
  month: string
) {
  let total = 0;
  const todayDate = today();
  const monthEnd = `${month}-31`;

  for (const schedule of schedules) {
    if (!schedule.active) continue;

    let date = schedule.next_due_date;
    let safety = 0;

    while (date.slice(0, 7) <= month && date <= monthEnd && safety < 5000) {
      safety += 1;

      if (
        date.slice(0, 7) === month &&
        date >= todayDate &&
        (!schedule.end_date || date <= schedule.end_date)
      ) {
        const amount = Number(schedule.amount);
        total += schedule.kind === 'income' ? amount : -amount;
      }

      if (schedule.end_date && date >= schedule.end_date) break;
      date = nextOccurrence(date, schedule.frequency);
    }
  }

  return total;
}

export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00`).toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
  });
