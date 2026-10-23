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

export function previousMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 2, 1);
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

export type CsvTransaction = Pick<
  Transaction,
  'kind' | 'amount' | 'category' | 'description' | 'transaction_date'
>;

const CSV_HEADERS = ['Date', 'Type', 'Category', 'Description', 'Amount (CAD)'];
const MAX_CSV_IMPORT_ROWS = 1000;
const MAX_CSV_IMPORT_SIZE = 1024 * 1024;

function isTransactionKind(value: string): value is TransactionKind {
  return value === 'income' || value === 'expense';
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let afterQuote = false;

  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        value += character;
      }
    } else if (afterQuote && character === ',') {
      row.push(value);
      value = '';
      afterQuote = false;
    } else if (afterQuote && (character === '\n' || character === '\r')) {
      if (character === '\r' && csv[index + 1] === '\n') index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      afterQuote = false;
    } else if (afterQuote) {
      return {
        rows: [],
        error: 'The CSV contains unexpected characters after a quoted field.',
      };
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === '"') {
      return {
        rows: [],
        error: 'The CSV contains an invalid quote in an unquoted field.',
      };
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) {
    return { rows: [], error: 'The CSV contains an unclosed quoted field.' };
  }
  if (row.length > 0 || value.length > 0 || afterQuote) {
    row.push(value);
    rows.push(row);
  }

  return { rows, error: null };
}

export function parseTransactionsCsv(csv: string): {
  transactions: CsvTransaction[];
  error: string | null;
} {
  if (csv.length > MAX_CSV_IMPORT_SIZE) {
    return { transactions: [], error: 'CSV files must be 1 MB or smaller.' };
  }

  const parsed = parseCsvRows(csv.replace(/^\uFEFF/, ''));
  if (parsed.error) return { transactions: [], error: parsed.error };

  const rows = parsed.rows.filter((cells) =>
    cells.some((cell) => cell.trim() !== '')
  );
  if (rows.length < 2) {
    return {
      transactions: [],
      error: 'The CSV must include a header and at least one transaction.',
    };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const indexes = CSV_HEADERS.map((header) =>
    headers.indexOf(header.toLowerCase())
  );
  if (indexes.some((index) => index < 0)) {
    return {
      transactions: [],
      error: `CSV must include these columns: ${CSV_HEADERS.join(', ')}.`,
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CSV_IMPORT_ROWS) {
    return {
      transactions: [],
      error: `Import up to ${MAX_CSV_IMPORT_ROWS} transactions at a time.`,
    };
  }

  const transactions: CsvTransaction[] = [];
  const errors: string[] = [];
  const lastColumnIndex = Math.max(...indexes);

  for (const [index, cells] of dataRows.entries()) {
    const lineNumber = index + 2;
    const get = (column: number) => (cells[indexes[column]] ?? '').trim();
    const date = get(0);
    const kind = get(1).toLowerCase();
    const category = get(2);
    const description = cells[indexes[3]] ?? '';
    const amountText = get(4);
    const amount = Number(amountText);
    const validKind = isTransactionKind(kind);
    const validAmount =
      /^\d+(\.\d{1,2})?$/.test(amountText) &&
      Number.isFinite(amount) &&
      amount > 0 &&
      amount <= 9999999999.99;
    const validCategory = validKind && CATEGORIES[kind].includes(category);

    if (!validDate(date)) {
      errors.push(`Row ${lineNumber}: enter a valid date as YYYY-MM-DD.`);
    }
    if (!validKind) {
      errors.push(`Row ${lineNumber}: type must be income or expense.`);
    } else if (!validCategory) {
      errors.push(
        `Row ${lineNumber}: "${category}" is not a valid ${kind} category.`
      );
    }
    if (!validAmount) {
      errors.push(
        `Row ${lineNumber}: enter a positive amount with up to 2 decimal places.`
      );
    }
    if (description.length > 240) {
      errors.push(
        `Row ${lineNumber}: description must be 240 characters or fewer.`
      );
    }
    if (cells.length <= lastColumnIndex) {
      errors.push(`Row ${lineNumber}: this row is missing one or more columns.`);
    }

    if (
      validDate(date) &&
      validKind &&
      validCategory &&
      validAmount &&
      description.length <= 240 &&
      cells.length > lastColumnIndex
    ) {
      transactions.push({
        transaction_date: date,
        kind,
        category,
        description,
        amount,
      });
    }
  }

  if (errors.length > 0) {
    const visibleErrors = errors.slice(0, 10);
    const remaining = errors.length - visibleErrors.length;
    const suffix =
      remaining > 0
        ? ` And ${remaining} more issue${remaining === 1 ? '' : 's'}.`
        : '';
    return {
      transactions: [],
      error: `${visibleErrors.join(' ')}${suffix}`,
    };
  }

  return { transactions, error: null };
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
