export type CsvTransaction = {
  kind: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
};

const HEADERS = ["Date", "Type", "Category", "Description", "Amount (CAD)"];
const CATEGORIES = {
  income: ["Salary", "Freelance", "Business", "Investment", "Gift", "Other"],
  expense: [
    "Housing", "Food", "Transport", "Bills", "Shopping",
    "Health", "Entertainment", "Education", "Travel", "Other",
  ],
};
const MAX_IMPORT_ROWS = 1000;
const MAX_IMPORT_SIZE = 1024 * 1024;

export function transactionsToCsv(transactions: CsvTransaction[]) {
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const rows = [
    HEADERS,
    ...transactions.map((transaction) => [
      transaction.transaction_date,
      transaction.kind,
      transaction.category,
      transaction.description ?? "",
      Number(transaction.amount).toFixed(2),
    ]),
  ];

  return rows.map((row) => row.map(escape).join(",")).join("\r\n");
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
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
      } else {
        value += character;
      }
    } else if (afterQuote && character === ",") {
      row.push(value);
      value = "";
      afterQuote = false;
    } else if (afterQuote && (character === "\n" || character === "\r")) {
      if (character === "\r" && csv[index + 1] === "\n") index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      afterQuote = false;
    } else if (afterQuote) {
      return { rows: [], error: "The CSV contains unexpected characters after a quoted field." };
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === '"') {
      return { rows: [], error: "The CSV contains an invalid quote in an unquoted field." };
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && csv[index + 1] === "\n") index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) return { rows: [], error: "The CSV contains an unclosed quoted field." };
  if (row.length > 0 || value.length > 0 || afterQuote) {
    row.push(value);
    rows.push(row);
  }

  return { rows, error: null };
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function parseTransactionsCsv(csv: string) {
  if (csv.length > MAX_IMPORT_SIZE) {
    return { transactions: [], error: "CSV files must be 1 MB or smaller." };
  }

  const parsed = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  if (parsed.error) return { transactions: [], error: parsed.error };

  const rows = parsed.rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length < 2) {
    return { transactions: [], error: "The CSV must include a header and at least one transaction." };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const indexes = HEADERS.map((header) => headers.indexOf(header.toLowerCase()));
  if (indexes.some((index) => index < 0)) {
    return {
      transactions: [],
      error: `CSV must include these columns: ${HEADERS.join(", ")}.`,
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { transactions: [], error: `Import up to ${MAX_IMPORT_ROWS} transactions at a time.` };
  }

  const transactions: CsvTransaction[] = [];
  const errors: string[] = [];

  for (const [index, row] of dataRows.entries()) {
    const lineNumber = index + 2;
    const get = (column: number) => (row[indexes[column]] ?? "").trim();
    const date = get(0);
    const kind = get(1).toLowerCase();
    const category = get(2);
    const description = row[indexes[3]] ?? "";
    const amountText = get(4);
    const amount = Number(amountText);

    if (!validDate(date)) errors.push(`Row ${lineNumber}: enter a valid date as YYYY-MM-DD.`);
    if (kind !== "income" && kind !== "expense") {
      errors.push(`Row ${lineNumber}: type must be income or expense.`);
    }
    if (
      kind === "income" || kind === "expense"
        ? !CATEGORIES[kind].includes(category)
        : false
    ) {
      errors.push(`Row ${lineNumber}: "${category}" is not a valid ${kind} category.`);
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) {
      errors.push(`Row ${lineNumber}: enter a positive amount with up to 2 decimal places.`);
    }
    if (description.length > 240) {
      errors.push(`Row ${lineNumber}: description must be 240 characters or fewer.`);
    }
    if (row.length <= Math.max(...indexes)) {
      errors.push(`Row ${lineNumber}: this row is missing one or more columns.`);
    }

    if (
      validDate(date) &&
      (kind === "income" || kind === "expense") &&
      CATEGORIES[kind].includes(category) &&
      /^\d+(\.\d{1,2})?$/.test(amountText) &&
      Number.isFinite(amount) &&
      amount > 0 &&
      amount <= 9999999999.99 &&
      description.length <= 240 &&
      row.length > Math.max(...indexes)
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
    const suffix = remaining > 0 ? ` And ${remaining} more issue${remaining === 1 ? "" : "s"}.` : "";
    return { transactions: [], error: `${visibleErrors.join(" ")}${suffix}` };
  }

  return { transactions, error: null };
}
