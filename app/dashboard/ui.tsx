
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTransaction,
  saveTransaction,
  saveRecurringTransaction,
  deleteRecurringTransaction,
  saveBudget,
  deleteBudget,
  exportTransactionsCsv,
  importTransactionsCsv,
  type ActionState,
} from "@/app/actions";
import type {
  Transaction,
  RecurringTransaction,
  Budget,
} from "@/app/dashboard/page";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CalendarDays,
  LoaderCircle,
  Repeat,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Download,
  Upload,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "@/app/theme-provider";

const CATEGORIES = {
  income: ["Salary", "Freelance", "Business", "Investment", "Gift", "Other"],
  expense: [
    "Housing", "Food", "Transport", "Bills", "Shopping",
    "Health", "Entertainment", "Education", "Travel", "Other",
  ],
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function totalsForMonth(transactions: Transaction[], month: string) {
  return transactions.reduce(
    (totals, transaction) => {
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
        !transaction.transaction_date.startsWith(month)
      ) {
        return totals;
      }
      const amount = Number(transaction.amount);
      if (transaction.kind === "income") totals.income += amount;
      if (transaction.kind === "expense") totals.expenses += amount;
      return totals;
    },
    { income: 0, expenses: 0 },
  );
}

function describeMonthChange(current: number, previous: number) {
  const difference = current - previous;
  if (difference === 0) return "No change from last month";
  return `${difference > 0 ? "Up" : "Down"} ${money(Math.abs(difference))} vs last month`;
}

function monthNow() {
  return today().slice(0, 7);
}

function nextOccurrence(
  date: string,
  frequency: RecurringTransaction["frequency"],
) {
  const d = new Date(`${date}T12:00:00`);
  const originalDay = d.getDate();

  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  if (frequency === "biweekly") d.setDate(d.getDate() + 14);

  if (frequency === "monthly") {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(originalDay, lastDay));
  }

  if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function projectedRecurringTotal(
  schedules: RecurringTransaction[],
  month: string,
) {
  let total = 0;
  const todayDate = today();
  const monthEnd = `${month}-31`;

  for (const schedule of schedules) {
    if (!schedule.active) continue;

    let date = schedule.next_due_date;
    let safety = 0;

    while (date.slice(0, 7) <= month && date <= monthEnd && safety < 5000) {
      safety++;

      if (
        date.slice(0, 7) === month &&
        date >= todayDate &&
        (!schedule.end_date || date <= schedule.end_date)
      ) {
        total += schedule.kind === "income"
          ? Number(schedule.amount)
          : -Number(schedule.amount);
      }

      if (schedule.end_date && date >= schedule.end_date) break;
      date = nextOccurrence(date, schedule.frequency);
    }
  }

  return total;
}

const panel = "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-slate-300 hover:shadow-md sm:p-6";
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function AnimatedPresence({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!open && !mounted) return null;

  return (
    <div
      className={`animated-presence ${open ? "motion-enter" : "motion-exit"}`}
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.animationName === "panel-exit" &&
          !open
        ) {
          setMounted(false);
        }
      }}
    >
      {children}
    </div>
  );
}

export function Dashboard({
  initialTransactions,
  initialRecurring,
  initialBudgets,
}: {
  initialTransactions: Transaction[];
  initialRecurring: RecurringTransaction[];
  initialBudgets: Budget[];
}) {
  const router = useRouter();
  const { theme: activeTheme } = useTheme();
  const dark = activeTheme === "dark";

  const [transactions, setTransactions] = useState(initialTransactions);
  const [recurring, setRecurring] = useState(initialRecurring);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [month, setMonth] = useState(monthNow());
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minimumAmount, setMinimumAmount] = useState("");
  const [maximumAmount, setMaximumAmount] = useState("");
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvMessage, setCsvMessage] = useState<ActionState>({});
  const csvToolsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => setTransactions(initialTransactions), [initialTransactions]);
  useEffect(() => setRecurring(initialRecurring), [initialRecurring]);
  useEffect(() => setBudgets(initialBudgets), [initialBudgets]);
  useEffect(() => {
    if (csvMessage.error || csvMessage.success) {
      csvToolsRef.current?.setAttribute("open", "");
    }
  }, [csvMessage]);

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function exportCsv() {
    if (exporting || importing) return;
    setExporting(true);
    setCsvMessage({});

    try {
      const result = await exportTransactionsCsv();
      if (result.error) {
        setCsvMessage({ error: result.error });
        return;
      }
      if (!result.csv) {
        setCsvMessage({ error: "Could not export transactions. Please try again." });
        return;
      }

      const url = URL.createObjectURL(
        new Blob(["\uFEFF", result.csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions-${today()}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCsvMessage({ success: "Transactions exported." });
    } catch (error) {
      setCsvMessage({
        error: error instanceof Error ? error.message : "Could not export transactions.",
      });
    } finally {
      setExporting(false);
    }
  }

  async function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || importing || exporting) return;

    setImporting(true);
    setCsvMessage({});

    try {
      const formData = new FormData();
      formData.set("csv", await file.text());
      const result = await importTransactionsCsv({}, formData);
      setCsvMessage(
        result.success
          ? { success: `${result.success} Importing adds new records; it does not update existing transactions.` }
          : result,
      );
      if (result.success) refresh();
    } catch (error) {
      setCsvMessage({
        error: error instanceof Error ? error.message : "Could not import this CSV file.",
      });
    } finally {
      setImporting(false);
    }
  }

  const visible = useMemo(
    () =>
      transactions.filter(
        (transaction) => {
          const amount = Number(transaction.amount);
          return (
            transaction.transaction_date.startsWith(month) &&
            `${transaction.category} ${transaction.description} ${transaction.kind}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()) &&
            (kindFilter === "all" || transaction.kind === kindFilter) &&
            (categoryFilter === "all" || transaction.category === categoryFilter) &&
            (!dateFrom || transaction.transaction_date >= dateFrom) &&
            (!dateTo || transaction.transaction_date <= dateTo) &&
            (!minimumAmount || amount >= Number(minimumAmount)) &&
            (!maximumAmount || amount <= Number(maximumAmount))
          );
        },
      ),
    [transactions, month, query, kindFilter, categoryFilter, dateFrom, dateTo, minimumAmount, maximumAmount],
  );
  const transactionCategories = useMemo(
    () => [...new Set(transactions.map((transaction) => transaction.category))].sort(),
    [transactions],
  );

  const activeFilterCount = [
    kindFilter !== "all",
    categoryFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
    Boolean(minimumAmount),
    Boolean(maximumAmount),
  ].filter(Boolean).length;

  function clearAdvancedFilters() {
    setKindFilter("all");
    setCategoryFilter("all");
    setDateFrom("");
    setDateTo("");
    setMinimumAmount("");
    setMaximumAmount("");
  }

  const income = visible
    .filter((t) => t.kind === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = visible
    .filter((t) => t.kind === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = income - expenses;
  const projectedBalance = balance + projectedRecurringTotal(recurring, month);
  const validSelectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const comparisonMonth = validSelectedMonth ? previousMonth(month) : "";
  const comparisonMonthLabel = comparisonMonth
    ? new Date(`${comparisonMonth}-15T12:00:00`).toLocaleDateString("en-CA", {
        month: "long",
        year: "numeric",
      })
    : "";
  const currentMonthTotals = totalsForMonth(transactions, month);
  const previousMonthTotals = totalsForMonth(transactions, comparisonMonth);

  const expensesByCategory = visible.reduce<Record<string, number>>((totals, t) => {
    if (t.kind === "expense") {
      totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount);
    }
    return totals;
  }, {});

  const monthBudgets = budgets.filter((b) => b.month.slice(0, 7) === month);
  const totalBudget = monthBudgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const budgetedSpend = monthBudgets.reduce(
    (sum, b) => sum + (expensesByCategory[b.category] ?? 0),
    0,
  );

  const topCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const monthLabel = new Date(`${month}-15T12:00:00`).toLocaleDateString(
    "en-CA",
    { month: "long", year: "numeric" },
  );

  async function removeTransaction(id: string) {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    setBusyId(id);
    const fd = new FormData();
    fd.set("id", id);
    const result = await deleteTransaction(fd);

await deleteTransaction(fd);

setTransactions((old) => old.filter((t) => t.id !== id));
    setBusyId(null);
  }

  async function removeRecurring(id: string) {
    if (!window.confirm("Delete this recurring schedule?")) return;
    setBusyId(id);
    const fd = new FormData();
    fd.set("id", id);
    const result = await deleteRecurringTransaction(fd);

    if (result?.error) {
      window.alert(result.error);
    } else {
      setRecurring((old) => old.filter((t) => t.id !== id));
      refresh();
    }
    setBusyId(null);
  }

  async function removeBudget(budget: Budget) {
    if (!window.confirm(`Delete the ${budget.category} budget?`)) return;
    setBusyId(budget.id);
    const fd = new FormData();
    fd.set("id", budget.id);
    const result = await deleteBudget(fd);

    if (result?.error) {
      window.alert(result.error);
    } else {
      setBudgets((old) => old.filter((b) => b.id !== budget.id));
      refresh();
    }
    setBusyId(null);
  }

  const theme = dark
    ? "bg-slate-950 text-slate-100 [--muted:#a1a1aa] [--panel:#111827] [--line:#293548]"
    : "bg-slate-50 text-slate-900 [--muted:#64748b] [--panel:#ffffff] [--line:#e2e8f0]";

  const panelClass = dark
    ? "rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-slate-700 hover:shadow-md sm:p-6"
    : panel;

  const textMuted = dark ? "text-slate-400" : "text-slate-500";
  const tableRow = dark
    ? "border-b border-slate-800 last:border-0"
    : "border-b border-slate-100 last:border-0";

  return (
    <div className={`dashboard-theme dashboard-page-enter ${dark ? "theme-dark" : ""} ${theme} -mx-4 min-h-screen px-4 py-6 sm:-mx-6 sm:px-6 md:py-9`}>
      <div className="dashboard-content-enter mx-auto max-w-7xl space-y-7">

        {/* Dashboard heading */}
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700">
              <Sparkles size={14} /> YOUR MONEY, MADE CLEARER
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Overview</h1>
            <p className={`mt-2 ${textMuted}`}>
              Here’s your financial picture for {monthLabel}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Choose month"
              className={`${field} w-auto`}
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button
              type="button"
              className={primaryButton}
              onClick={() => {
                setEditing(null);
                setShowTransactionForm(true);
              }}
            >
              <Plus size={17} /> Add transaction
            </button>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Income" amount={income} icon={<ArrowDownLeft size={21} />} tone="green" dark={dark} />
          <SummaryCard title="Expenses" amount={expenses} icon={<ArrowUpRight size={21} />} tone="rose" dark={dark} />
          <SummaryCard title="Net balance" amount={balance} icon={<Wallet size={21} />} tone="indigo" dark={dark} />
          <SummaryCard title="Projected balance" amount={projectedBalance} icon={<TrendingUp size={21} />} tone="violet" dark={dark} />
        </section>

        <section className={panelClass}>
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight">Month-over-month</h2>
            <p className={`mt-1 text-sm ${textMuted}`}>
              {comparisonMonth
                ? `${monthLabel} compared with ${comparisonMonthLabel}. Full-month totals; transaction filters don&apos;t affect this comparison.`
                : "Choose a valid month to compare monthly totals."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Income",
                current: currentMonthTotals.income,
                previous: previousMonthTotals.income,
                color: dark ? "text-emerald-300" : "text-emerald-700",
              },
              {
                label: "Expenses",
                current: currentMonthTotals.expenses,
                previous: previousMonthTotals.expenses,
                color: dark ? "text-rose-300" : "text-rose-700",
              },
              {
                label: "Net balance",
                current: currentMonthTotals.income - currentMonthTotals.expenses,
                previous: previousMonthTotals.income - previousMonthTotals.expenses,
                color: dark ? "text-indigo-300" : "text-indigo-700",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-2xl border p-4 ${dark ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50/70"}`}
              >
                <p className={`text-sm font-semibold ${textMuted}`}>{item.label}</p>
                <p className={`mt-2 text-xl font-extrabold ${item.color}`}>
                  {money(item.current)}
                </p>
                <p className={`mt-1 text-xs ${textMuted}`}>
                  {describeMonthChange(item.current, item.previous)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Spending insights */}
        <section className={panelClass}>
          <div className="mb-5 flex items-start gap-3">
            <span className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
              <TrendingUp size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Spending insights</h2>
              <p className={`mt-1 text-sm ${textMuted}`}>
                Where your recorded money went this month.
              </p>
            </div>
          </div>

          {topCategories.length === 0 ? (
            <p className={`${textMuted} rounded-2xl border border-dashed p-6 text-center text-sm`}>
              Add an expense to see your spending breakdown.
            </p>
          ) : (
            <div className="space-y-5">
              {topCategories.map(([category, amount]) => {
                const percent = expenses > 0 ? (amount / expenses) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold">{category}</span>
                      <span className={textMuted}>
                        {money(amount)} · {Math.round(percent)}%
                      </span>
                    </div>
                    <div className={`h-2.5 overflow-hidden rounded-full ${dark ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Budgets */}
        <section className={panelClass}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <PiggyBank size={22} />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Monthly budgets</h2>
                <p className={`mt-1 text-sm ${textMuted}`}>Plan ahead and keep spending on track.</p>
              </div>
            </div>
            <button
              type="button"
              className={primaryButton}
              onClick={() => {
                setEditingBudget(null);
                setShowBudgetForm((v) => !v);
              }}
            >
              {showBudgetForm ? <X size={17} /> : <Plus size={17} />}
              {showBudgetForm ? "Cancel" : "Set a budget"}
            </button>
          </div>

          <AnimatedPresence open={showBudgetForm}>
            <BudgetForm
              key={editingBudget?.id ?? "new-budget"}
              month={month}
              budget={editingBudget}
              dark={dark}
              onCancel={() => {
                setShowBudgetForm(false);
                setEditingBudget(null);
              }}
              onSaved={() => {
                setShowBudgetForm(false);
                setEditingBudget(null);
                refresh();
              }}
            />
          </AnimatedPresence>

          {monthBudgets.length > 0 && (
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Total budget" value={money(totalBudget)} dark={dark} />
              <MiniStat label="Spent in budgeted categories" value={money(budgetedSpend)} dark={dark} />
              <MiniStat
                label="Budget remaining"
                value={money(totalBudget - budgetedSpend)}
                dark={dark}
                valueClass={budgetedSpend > totalBudget ? "text-rose-500" : "text-emerald-500"}
              />
            </div>
          )}

          {monthBudgets.length === 0 ? (
            <div className={`rounded-2xl border border-dashed p-8 text-center ${dark ? "border-slate-700" : "border-slate-200"}`}>
              <PiggyBank size={30} className="mx-auto text-indigo-400" />
              <p className="mt-3 font-bold">Give your money a plan</p>
              <p className={`mx-auto mt-2 max-w-md text-sm ${textMuted}`}>
                Create category limits for food, housing, transport, and more. Your recorded expenses will be compared with each limit.
              </p>
              <button
                type="button"
                className={`${secondaryButton} mt-4`}
                onClick={() => setShowBudgetForm(true)}
              >
                <Plus size={16} /> Create your first budget
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {monthBudgets.map((budget) => {
                const spent = expensesByCategory[budget.category] ?? 0;
                const limit = Number(budget.amount);
                const percent = limit > 0 ? (spent / limit) * 100 : 0;
                const over = percent >= 100;
                const near = percent >= 80 && !over;

                return (
                  <div key={budget.id} className={`rounded-2xl border p-4 ${dark ? "border-slate-700" : "border-slate-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{budget.category}</p>
                        <p className={`mt-1 text-sm ${textMuted}`}>
                          {money(spent)} of {money(limit)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={secondaryButton}
                          aria-label={`Edit ${budget.category} budget`}
                          onClick={() => {
                            setEditingBudget(budget);
                            setShowBudgetForm(true);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className={secondaryButton}
                          aria-label={`Delete ${budget.category} budget`}
                          disabled={busyId === budget.id}
                          onClick={() => void removeBudget(budget)}
                        >
                          {busyId === budget.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>

                    <div
                      className={`mt-4 h-2.5 overflow-hidden rounded-full ${dark ? "bg-slate-800" : "bg-slate-100"}`}
                      role="progressbar"
                      aria-valuenow={Math.round(Math.min(percent, 100))}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${budget.category} budget used`}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${over ? "bg-rose-500" : near ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className={textMuted}>{Math.round(percent)}% used</span>
                      <span className="font-semibold">{money(limit - spent)} left</span>
                    </div>

                    <p className={`mt-3 flex items-center gap-2 text-sm ${over ? "text-rose-500" : near ? "text-amber-500" : "text-emerald-500"}`}>
                      {over ? <AlertTriangle size={15} /> : near ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      {over
                        ? `Over budget by ${money(spent - limit)}`
                        : near
                          ? "You've used at least 80% of this budget"
                          : "You're within this budget"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recurring transactions */}
        <section className={panelClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-violet-100 p-3 text-violet-700">
                <Repeat size={22} />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Recurring transactions</h2>
                <p className={`mt-1 text-sm ${textMuted}`}>
                  {recurring.length} saved schedule{recurring.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={primaryButton}
              onClick={() => setShowRecurringForm((v) => !v)}
            >
              {showRecurringForm ? <X size={17} /> : <Plus size={17} />}
              {showRecurringForm ? "Cancel" : "Add recurring"}
            </button>
          </div>

          <AnimatedPresence open={showRecurringForm}>
            <RecurringForm
              dark={dark}
              onCancel={() => setShowRecurringForm(false)}
              onSaved={() => {
                setShowRecurringForm(false);
                refresh();
              }}
            />
          </AnimatedPresence>

          {recurring.length === 0 ? (
            <p className={`py-6 text-center text-sm ${textMuted}`}>
              Add regular salary payments, rent, bills, or other recurring income and expenses.
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {recurring.map((t) => (
                  <article
                    key={t.id}
                    className={`rounded-2xl border p-4 ${dark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold">{t.description || t.category}</p>
                        <p className={`mt-1 text-xs capitalize ${textMuted}`}>{t.kind} · {t.category}</p>
                      </div>
                      <p className={`shrink-0 text-right font-bold whitespace-nowrap ${t.kind === "income" ? "text-emerald-500" : ""}`}>
                        {t.kind === "income" ? "+" : "−"}{money(Number(t.amount))}
                      </p>
                    </div>
                    <div className={`mt-3 flex justify-between gap-3 border-t pt-3 text-sm ${dark ? "border-slate-800" : "border-slate-100"}`}>
                      <span className="capitalize">{t.frequency}</span>
                      <span className={textMuted}>Next: {t.next_due_date}</span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className={secondaryButton}
                        aria-label={`Delete ${t.description || t.category} recurring schedule`}
                        disabled={busyId === t.id}
                        onClick={() => void removeRecurring(t.id)}
                      >
                        {busyId === t.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className={textMuted}>
                      <th className="pb-3 pr-4 font-medium">Schedule</th>
                      <th className="pb-3 pr-4 font-medium">Frequency</th>
                      <th className="pb-3 pr-4 font-medium">Next due</th>
                      <th className="pb-3 pr-4 text-right font-medium">Amount</th>
                      <th className="pb-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map((t) => (
                      <tr key={t.id} className={tableRow}>
                        <td className="py-4 pr-4">
                          <p className="font-semibold">{t.description || t.category}</p>
                          <p className={`mt-1 text-xs capitalize ${textMuted}`}>{t.kind} · {t.category}</p>
                        </td>
                        <td className="py-4 pr-4 capitalize">{t.frequency}</td>
                        <td className={`py-4 pr-4 ${textMuted}`}>{t.next_due_date}</td>
                        <td className={`py-4 pr-4 text-right font-bold whitespace-nowrap ${t.kind === "income" ? "text-emerald-500" : ""}`}>
                          {t.kind === "income" ? "+" : "−"}{money(Number(t.amount))}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            type="button"
                            className={secondaryButton}
                            aria-label="Delete recurring schedule"
                            disabled={busyId === t.id}
                            onClick={() => void removeRecurring(t.id)}
                          >
                            {busyId === t.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className={`mt-4 text-xs ${textMuted}`}>
            Projected balance includes scheduled amounts due from today through the selected month. Recurring schedules are projections and do not automatically create posted transactions.
          </p>
        </section>

        {/* Transaction history */}
        <section className={panelClass}>
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Transactions</h2>
              <p className={`mt-1 text-sm ${textMuted}`}>
                {visible.length} record{visible.length === 1 ? "" : "s"} · {monthLabel}
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search size={17} className={`absolute left-3 top-3 ${textMuted}`} />
              <input
                className={`${field} pl-9`}
                placeholder="Search transactions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <details className={`mb-5 rounded-2xl border p-4 ${dark ? "border-slate-700" : "border-slate-200"}`}>
            <summary className="disclosure-summary flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={16} />
              More filters
              {activeFilterCount > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${dark ? "bg-slate-700 text-slate-200" : "bg-indigo-50 text-indigo-700"}`}>
                  {activeFilterCount} active
                </span>
              )}
              <ChevronDown className="disclosure-chevron ml-auto" size={16} aria-hidden="true" />
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-kind-filter">Type</label>
                <select
                  className={field}
                  id="transaction-kind-filter"
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}
                >
                  <option value="all">All types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-category-filter">Category</label>
                <select
                  className={field}
                  id="transaction-category-filter"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {transactionCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-date-from">From date</label>
                <input
                  className={field}
                  id="transaction-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    const nextDateFrom = event.target.value;
                    setDateFrom(nextDateFrom);
                    if (dateTo && nextDateFrom > dateTo) setDateTo("");
                  }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-date-to">To date</label>
                <input
                  className={field}
                  id="transaction-date-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-minimum-amount">Minimum amount (CAD)</label>
                <input
                  className={field}
                  id="transaction-minimum-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="No minimum"
                  value={minimumAmount}
                  onChange={(event) => setMinimumAmount(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-maximum-amount">Maximum amount (CAD)</label>
                <input
                  className={field}
                  id="transaction-maximum-amount"
                  type="number"
                  min={minimumAmount || "0"}
                  step="0.01"
                  placeholder="No maximum"
                  value={maximumAmount}
                  onChange={(event) => setMaximumAmount(event.target.value)}
                />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className={`${secondaryButton} mt-4`}
                onClick={clearAdvancedFilters}
              >
                Clear filters
              </button>
            )}
          </details>

          <details
            ref={csvToolsRef}
            className={`mb-5 rounded-2xl border p-4 ${dark ? "border-slate-700" : "border-slate-200"}`}
          >
            <summary className="disclosure-summary flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              <Upload size={16} />
              Import or export CSV
              <ChevronDown className="disclosure-chevron ml-auto" size={16} aria-hidden="true" />
            </summary>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButton}
                onClick={() => void exportCsv()}
                disabled={exporting || importing}
              >
                <Download size={16} /> {exporting ? "Exporting..." : "Export CSV"}
              </button>
              <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${importing || exporting ? "pointer-events-none opacity-60" : ""}`}>
                <Upload size={16} /> {importing ? "Importing..." : "Import CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="Import transactions from CSV"
                  disabled={importing || exporting}
                  onChange={(event) => void importCsv(event)}
                />
              </label>
            </div>
            <p className={`mt-3 text-xs ${textMuted}`}>
              Imports add new transactions from a CSV exported by Pocket Ledger.
            </p>
            {csvMessage.error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{csvMessage.error}</p>}
            {csvMessage.success && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{csvMessage.success}</p>}
          </details>

          {visible.length === 0 ? (
            <div className="py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <CalendarDays size={25} />
              </span>
              <h3 className="mt-4 font-bold">No transactions found</h3>
              <p className={`mt-2 text-sm ${textMuted}`}>
                Try another month or search term, or add a transaction.
              </p>
              <button
                type="button"
                className={`${primaryButton} mt-4`}
                onClick={() => {
                  setEditing(null);
                  setShowTransactionForm(true);
                }}
              >
                <Plus size={17} /> Add transaction
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {visible.map((t) => (
                  <article
                    key={t.id}
                    className={`rounded-2xl border p-4 ${dark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.kind === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {t.kind === "income" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
                        </span>
                        <div className="min-w-0">
                          <p className="break-words font-semibold">{t.description || t.category}</p>
                          <p className={`mt-1 text-xs capitalize ${textMuted}`}>{t.kind}</p>
                        </div>
                      </div>
                      <p className={`shrink-0 text-right font-bold whitespace-nowrap ${t.kind === "income" ? "text-emerald-500" : ""}`}>
                        {t.kind === "income" ? "+" : "−"}{money(Number(t.amount))}
                      </p>
                    </div>
                    <div className={`mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm ${dark ? "border-slate-800" : "border-slate-100"}`}>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${dark ? "bg-slate-800" : "bg-slate-100"}`}>{t.category}</span>
                      <span className={`text-right ${textMuted}`}>
                        {new Date(`${t.transaction_date}T12:00:00`).toLocaleDateString("en-CA", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className={secondaryButton}
                        aria-label={`Edit ${t.description || t.category}`}
                        onClick={() => {
                          setEditing(t);
                          setShowTransactionForm(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={secondaryButton}
                        aria-label={`Delete ${t.description || t.category}`}
                        disabled={busyId === t.id}
                        onClick={() => void removeTransaction(t.id)}
                      >
                        {busyId === t.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead>
                    <tr className={textMuted}>
                      <th className="pb-3 pr-4 font-medium">Transaction</th>
                      <th className="pb-3 pr-4 font-medium">Category</th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 pr-4 text-right font-medium">Amount</th>
                      <th className="pb-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((t) => (
                      <tr key={t.id} className={tableRow}>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.kind === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                              {t.kind === "income" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
                            </span>
                            <div>
                              <p className="font-semibold">{t.description || t.category}</p>
                              <p className={`mt-1 text-xs capitalize ${textMuted}`}>{t.kind}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${dark ? "bg-slate-800" : "bg-slate-100"}`}>
                            {t.category}
                          </span>
                        </td>
                        <td className={`py-4 pr-4 whitespace-nowrap ${textMuted}`}>
                          {new Date(`${t.transaction_date}T12:00:00`).toLocaleDateString("en-CA", {
                            year: "numeric", month: "short", day: "numeric",
                          })}
                        </td>
                        <td className={`py-4 pr-4 text-right font-bold whitespace-nowrap ${t.kind === "income" ? "text-emerald-500" : ""}`}>
                          {t.kind === "income" ? "+" : "−"}{money(Number(t.amount))}
                        </td>
                        <td className="py-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className={`${secondaryButton} mr-2`}
                            aria-label="Edit transaction"
                            onClick={() => {
                              setEditing(t);
                              setShowTransactionForm(true);
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={secondaryButton}
                            aria-label="Delete transaction"
                            disabled={busyId === t.id}
                            onClick={() => void removeTransaction(t.id)}
                          >
                            {busyId === t.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <footer className={`flex flex-wrap items-center justify-between gap-3 px-1 text-xs ${textMuted}`}>
          <span>Made for clearer money decisions.</span>
          <span>{refreshing ? "Refreshing saved data..." : "Your dashboard uses your saved records."}</span>
        </footer>
      </div>

      {showTransactionForm && (
        <TransactionForm
          key={editing?.id ?? "new-transaction"}
          transaction={editing}
          dark={dark}
          onClose={() => setShowTransactionForm(false)}
          onSaved={(updated) => {
            setTransactions((old) =>
              updated.id.startsWith("local-")
                ? [updated, ...old]
                : old.map((t) => t.id === updated.id ? updated : t),
            );
            refresh();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  icon,
  tone,
  dark,
}: {
  title: string;
  amount: number;
  icon: React.ReactNode;
  tone: "green" | "rose" | "indigo" | "violet";
  dark: boolean;
}) {
  const colors = {
    green: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700",
    violet: "bg-violet-100 text-violet-700",
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${dark ? "border-slate-800 bg-slate-900" : "border-slate-200/80 bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>{title}</p>
        <span className={`rounded-2xl p-3 ${colors[tone]}`}>{icon}</span>
      </div>
      <p className={`mt-5 break-words text-2xl font-black tracking-tight sm:text-3xl ${amount < 0 ? "text-rose-500" : ""}`}>
        {money(amount)}
      </p>
      <p className={`mt-2 text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>Selected month · CAD</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  dark,
  valueClass = "",
}: {
  label: string;
  value: string;
  dark: boolean;
  valueClass?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${dark ? "bg-slate-800" : "bg-slate-50"}`}>
      <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-2 break-words text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function BudgetForm({
  month,
  budget,
  dark,
  onCancel,
  onSaved,
}: {
  month: string;
  budget: Budget | null;
  dark: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(budget?.category ?? "Food");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveBudget(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={submit} className={`mb-5 space-y-4 rounded-2xl border p-4 ${dark ? "border-slate-700 bg-slate-800" : "border-indigo-100 bg-indigo-50/50"}`}>
      <input type="hidden" name="month" value={month} />
      {budget && <input type="hidden" name="category" value={category} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="budget-category">Category</label>
          <select
            className={field}
            id="budget-category"
            name={budget ? undefined : "category"}
            value={category}
            disabled={Boolean(budget)}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.expense.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="budget-amount">Monthly limit (CAD)</label>
          <input
            className={field}
            id="budget-amount"
            name="amount"
            type="number"
            min="0.01"
            max="9999999999.99"
            step="0.01"
            defaultValue={budget ? Number(budget.amount).toFixed(2) : ""}
            placeholder="e.g. 450.00"
            required
          />
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button>
        <button type="submit" className={primaryButton} disabled={pending}>
          {pending && <LoaderCircle size={16} className="animate-spin" />}
          {pending ? "Saving..." : budget ? "Update budget" : "Save budget"}
        </button>
      </div>
    </form>
  );
}

function RecurringForm({
  dark,
  onCancel,
  onSaved,
}: {
  dark: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Housing");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result: ActionState = await saveRecurringTransaction(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={submit} className={`mb-5 space-y-4 rounded-2xl border p-4 ${dark ? "border-slate-700" : "border-slate-200"}`}>
      <h3 className="font-bold">New recurring schedule</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="recurring-kind">Type</label>
          <select className={field} id="recurring-kind" name="kind" value={kind} onChange={(e) => {
            const next = e.target.value as "income" | "expense";
            setKind(next);
            setCategory(next === "income" ? "Salary" : "Housing");
          }}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="recurring-amount">Amount (CAD)</label>
          <input className={field} id="recurring-amount" name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" placeholder="0.00" required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="recurring-category">Category</label>
          <select className={field} id="recurring-category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES[kind].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="recurring-frequency">Frequency</label>
          <select className={field} id="recurring-frequency" name="frequency" defaultValue="monthly">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every two weeks</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="recurring-description">Description</label>
          <input className={field} id="recurring-description" name="description" maxLength={240} placeholder="e.g. Monthly rent" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="recurring-start">First due date</label>
          <input className={field} id="recurring-start" name="start_date" type="date" defaultValue={today()} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="recurring-end">End date (optional)</label>
          <input className={field} id="recurring-end" name="end_date" type="date" />
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button>
        <button type="submit" className={primaryButton} disabled={pending}>
          {pending && <LoaderCircle size={16} className="animate-spin" />}
          {pending ? "Saving..." : "Save schedule"}
        </button>
      </div>
    </form>
  );
}

function TransactionForm({
  transaction,
  dark,
  onClose,
  onSaved,
}: {
  transaction: Transaction | null;
  dark: boolean;
  onClose: () => void;
  onSaved: (t: Transaction) => void;
}) {
  const [kind, setKind] = useState<"income" | "expense">(transaction?.kind ?? "expense");
  const [category, setCategory] = useState(transaction?.category ?? "Food");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);

  function close(force = false) {
    if ((!pending || force) && !closing) setClosing(true);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result: ActionState = await saveTransaction({}, fd);

      if (result?.error) {
        setError(result.error);
        return;
      }

      const id = String(fd.get("id") ?? "");
      const updated: Transaction = {
        id: id || `local-${Date.now()}`,
        user_id: transaction?.user_id ?? "",
        kind,
        amount: Number(fd.get("amount")),
        category,
        description: String(fd.get("description") ?? "").trim(),
        transaction_date: String(fd.get("transaction_date") ?? ""),
        created_at: transaction?.created_at ?? new Date().toISOString(),
      };

      onSaved(updated);
      close(true);
    });
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm ${closing ? "pointer-events-none transaction-modal-exit" : "transaction-modal-enter"}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === "modal-exit") {
          onClose();
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="transaction-title" className={`transaction-modal-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border p-6 shadow-2xl ${dark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-white bg-white text-slate-900"}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="transaction-title" className="text-xl font-black">
              {transaction ? "Edit transaction" : "Add transaction"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Enter the details below.</p>
          </div>
          <button type="button" className={secondaryButton} onClick={() => close()} disabled={pending || closing} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input type="hidden" name="id" value={transaction?.id ?? ""} />
          <input type="hidden" name="kind" value={kind} />

          <div>
            <label className="mb-2 block text-sm font-semibold">Transaction type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setKind("expense"); setCategory("Food"); }} className={`rounded-xl border p-3 font-semibold ${kind === "expense" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200"}`}>
                <ArrowUpRight size={17} className="mr-2 inline" /> Expense
              </button>
              <button type="button" onClick={() => { setKind("income"); setCategory("Salary"); }} className={`rounded-xl border p-3 font-semibold ${kind === "income" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200"}`}>
                <ArrowDownLeft size={17} className="mr-2 inline" /> Income
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-amount">Amount (CAD)</label>
            <input className={field} id="transaction-amount" name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" defaultValue={transaction ? Number(transaction.amount).toFixed(2) : ""} placeholder="0.00" required />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-category">Category</label>
            <select className={field} id="transaction-category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES[kind].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-description">Description (optional)</label>
            <input className={field} id="transaction-description" name="description" maxLength={240} defaultValue={transaction?.description ?? ""} placeholder="e.g. Groceries" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold" htmlFor="transaction-date">Date</label>
            <input className={field} id="transaction-date" name="transaction_date" type="date" defaultValue={transaction?.transaction_date ?? today()} required />
          </div>

          {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-700">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" className={`${secondaryButton} flex-1`} onClick={() => close()} disabled={pending || closing}>Cancel</button>
            <button type="submit" className={`${primaryButton} flex-1`} disabled={pending}>
              {pending && <LoaderCircle size={16} className="animate-spin" />}
              {pending ? "Saving..." : transaction ? "Save changes" : "Save transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
