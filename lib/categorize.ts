export const CATEGORIES = {
  income: ["Salary", "Freelance", "Business", "Investment", "Gift", "Other"],
  expense: [
    "Housing", "Food", "Transport", "Bills", "Shopping",
    "Health", "Entertainment", "Education", "Travel", "Other",
  ],
} as const;

export type TransactionKind = keyof typeof CATEGORIES;

type Rule = [RegExp, string];

const EXPENSE_RULES: Rule[] = [
  [/rent|mortgage|landlord|property tax|condo/i, "Housing"],
  [/hydro|electric|internet|rogers|bell|telus|shaw|utility|utilities|phone plan|insurance/i, "Bills"],
  [/uber(?! eats)|lyft|taxi|transit|presto|fuel|gas station|shell|petro|esso|parking|car wash/i, "Transport"],
  [/tim hortons|mcdonald|starbucks|restaurant|cafe|coffee|grocery|groceries|loblaws|sobeys|metro|costco|pizza|doordash|skip the dishes|uber eats/i, "Food"],
  [/amazon|walmart|store|shop|mall|canadian tire|best buy|ikea/i, "Shopping"],
  [/pharmacy|shoppers drug|dental|clinic|doctor|hospital|health|optom|physio/i, "Health"],
  [/netflix|spotify|disney|cinema|movie|theatre|game|steam|playstation|xbox/i, "Entertainment"],
  [/tuition|college|university|course|textbook|school/i, "Education"],
  [/flight|air canada|westjet|hotel|airbnb|booking|travel|vacation/i, "Travel"],
];

const INCOME_RULES: Rule[] = [
  [/payroll|salary|wages|employer|deposit/i, "Salary"],
  [/freelance|invoice|contract/i, "Freelance"],
  [/interest|dividend|investment|capital gain/i, "Investment"],
  [/refund|gift|rebate/i, "Gift"],
];

/**
 * Map an imported category onto one this app understands. A category we already
 * know wins; otherwise the description is searched for a familiar merchant or
 * keyword. Anything still unmatched is filed under Other rather than rejecting
 * the row, which is what bank exports need.
 */
export function resolveCategory(
  kind: TransactionKind,
  rawCategory: string,
  description: string,
): { category: string; guessed: boolean } {
  const trimmed = rawCategory.trim();
  const canonical = CATEGORIES[kind].find(
    (category) => category.toLowerCase() === trimmed.toLowerCase(),
  );
  if (canonical) return { category: canonical, guessed: false };

  const haystack = `${trimmed} ${description}`;
  const rules = kind === "expense" ? EXPENSE_RULES : INCOME_RULES;
  for (const [pattern, category] of rules) {
    if (pattern.test(haystack)) return { category, guessed: true };
  }

  return { category: "Other", guessed: true };
}
