
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTransaction,
  saveTransaction,
  saveRecurringTransaction,
  deleteRecurringTransaction,
  type ActionState,
} from "@/app/actions";
import type {
  Transaction,
  RecurringTransaction,
} from "@/app/dashboard/page";
import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CalendarDays,
  LoaderCircle,
  Moon,
  Sun,
  Repeat,
} from "lucide-react";

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

function monthNow() {
  return today().slice(0, 7);
}

function nextOccurrence(date: string, frequency: RecurringTransaction["frequency"]) {
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

  if (frequency === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  }

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

export function Dashboard({
  initialTransactions,
  initialRecurring,
}: {
  initialTransactions: Transaction[];
  initialRecurring: RecurringTransaction[];
}) {
  const router = useRouter();

  const [transactions, setTransactions] = useState(initialTransactions);
  const [recurringTransactions, setRecurringTransactions] = useState(initialRecurring);
  const [month, setMonth] = useState(monthNow());
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteRecurringId, setDeleteRecurringId] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => setTransactions(initialTransactions), [initialTransactions]);

  useEffect(() => {
    setRecurringTransactions(initialRecurring);
  }, [initialRecurring]);

  useEffect(() => {
    setDark(localStorage.getItem("pocket-ledger-theme") === "dark");
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("pocket-ledger-theme", next ? "dark" : "light");
  }

  const visible = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.transaction_date.startsWith(month) &&
          `${t.category} ${t.description} ${t.kind}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [transactions, month, query],
  );

  const income = visible
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const expenses = visible
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const balance = income - expenses;

  const projectedBalance =
    balance + projectedRecurringTotal(recurringTransactions, month);

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function removeTransaction(id: string) {
    setDeleteId(id);
    const fd = new FormData();
    fd.set("id", id);

    const result = await deleteTransaction(fd);

    await deleteTransaction(fd);

setTransactions((old) => old.filter((t) => t.id !== id));
refresh();

setDeleteId(null);
  }

  async function removeRecurring(id: string) {
    if (!window.confirm("Delete this recurring schedule?")) return;

    setDeleteRecurringId(id);
    const fd = new FormData();
    fd.set("id", id);

    const result = await deleteRecurringTransaction(fd);

    if (result?.error) {
      window.alert(result.error);
    } else {
      setRecurringTransactions((old) => old.filter((t) => t.id !== id));
      refresh();
    }

    setDeleteRecurringId(null);
  }

  return (
    <div className={`dashboard-theme ${dark ? "theme-dark" : "theme-light"} p-4 md:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="muted mt-1">A clear picture of your money.</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button className="btn btn-light" onClick={toggleTheme}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            {dark ? "Light mode" : "Dark mode"}
          </button>

          <label className="sr-only" htmlFor="month">Month</label>
          <input
            id="month"
            aria-label="Filter by month"
            className="field"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: 165 }}
          />

          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus size={18} /> Add transaction
          </button>
        </div>
      </div>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Summary title="Income" amount={income} icon={<ArrowDownLeft size={20} />} tone="green" />
        <Summary title="Expenses" amount={expenses} icon={<ArrowUpRight size={20} />} tone="rose" />
        <Summary title="Net balance" amount={balance} icon={<WalletIcon />} tone="indigo" />
        <Summary title="Projected balance" amount={projectedBalance} icon={<Repeat size={20} />} tone="indigo" />
      </section>

      <section className="card p-4 md:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold">Recurring income & expenses</h2>
            <p className="muted text-sm mt-1">
              {recurringTransactions.length} schedule{recurringTransactions.length === 1 ? "" : "s"} saved
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowRecurringForm((v) => !v)}
          >
            {showRecurringForm ? <X size={17} /> : <Plus size={17} />}
            {showRecurringForm ? "Cancel" : "Add recurring"}
          </button>
        </div>

        {showRecurringForm && (
          <RecurringForm
            onCancel={() => setShowRecurringForm(false)}
            onSaved={() => {
              setShowRecurringForm(false);
              refresh();
            }}
          />
        )}

        {recurringTransactions.length === 0 ? (
          <p className="muted text-sm py-6 text-center">
            No recurring schedules yet. Add recurring rent, bills, salary, or other regular income.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="py-3 pr-3">Schedule</th>
                  <th className="py-3 pr-3">Frequency</th>
                  <th className="py-3 pr-3">Next due</th>
                  <th className="py-3 pr-3 text-right">Amount</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recurringTransactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-4 pr-3">
                      <div className="font-semibold">{t.description || t.category}</div>
                      <div className="muted text-xs mt-1">
                        {t.kind} · {t.category}
                      </div>
                    </td>
                    <td className="py-4 pr-3 capitalize">{t.frequency}</td>
                    <td className="py-4 pr-3 muted">{t.next_due_date}</td>
                    <td className={`py-4 pr-3 text-right font-bold whitespace-nowrap ${t.kind === "income" ? "text-emerald-600" : ""}`}>
                      {t.kind === "income" ? "+" : "−"}{money(Number(t.amount))}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        className="btn btn-danger !p-2"
                        title="Delete recurring schedule"
                        aria-label="Delete recurring schedule"
                        disabled={deleteRecurringId === t.id}
                        onClick={() => void removeRecurring(t.id)}
                      >
                        {deleteRecurringId === t.id
                          ? <LoaderCircle size={15} className="animate-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted text-xs mt-4">
          Projected balance adds future scheduled amounts due in the selected month to your recorded net balance.
          Schedules are projections; they do not automatically create posted transactions.
        </p>
      </section>

      <section className="card p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold">Transactions</h2>
            <p className="muted text-sm mt-1">
              {visible.length} record{visible.length === 1 ? "" : "s"} in {month}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-3 muted" size={17} />
            <input
              className="field pl-9"
              placeholder="Search transactions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto rounded-2xl bg-slate-100 p-4 w-fit">
              <CalendarDays size={25} />
            </div>
            <h3 className="font-bold mt-4">No transactions found</h3>
            <p className="muted text-sm mt-2">
              Add your first transaction or change the month filter.
            </p>
            <button
              className="btn btn-primary mt-4"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus size={17} /> Add transaction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="font-semibold py-3 pr-3">Transaction</th>
                  <th className="font-semibold py-3 pr-3">Category</th>
                  <th className="font-semibold py-3 pr-3">Date</th>
                  <th className="font-semibold py-3 pr-3 text-right">Amount</th>
                  <th className="font-semibold py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-4 pr-3">
                      <div className="font-semibold">{t.description || t.category}</div>
                      <div className="muted text-xs mt-1 capitalize">{t.kind}</div>
                    </td>
                    <td className="py-4 pr-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{t.category}</span>
                    </td>
                    <td className="py-4 pr-3 muted">
                      {new Date(`${t.transaction_date}T12:00:00`).toLocaleDateString("en-CA", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </td>
                    <td className={`py-4 pr-3 text-right font-bold whitespace-nowrap ${t.kind === "income" ? "text-emerald-600" : "text-slate-800"}`}>
                      {t.kind === "income" ? "+" : "−"}{money(Number(t.amount))}
                    </td>
                    <td className="py-4 text-right whitespace-nowrap">
                      <button
                        aria-label="Edit transaction"
                        title="Edit"
                        className="btn btn-light !p-2 mr-2"
                        onClick={() => {
                          setEditing(t);
                          setShowForm(true);
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label="Delete transaction"
                        title="Delete"
                        disabled={deleteId === t.id}
                        className="btn btn-danger !p-2"
                        onClick={() => {
                          if (window.confirm("Delete this transaction? This cannot be undone.")) {
                            void removeTransaction(t.id);
                          }
                        }}
                      >
                        {deleteId === t.id
                          ? <LoaderCircle size={15} className="animate-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <TransactionModal
          transaction={editing}
          onClose={() => setShowForm(false)}
          onSaved={(updated) => {
            setTransactions((old) =>
              updated.id.startsWith("local-")
                ? [updated, ...old]
                : old.map((t) => t.id === updated.id ? updated : t),
            );
            setShowForm(false);
            refresh();
          }}
        />
      )}

      {refreshing && <p className="text-xs muted mt-3">Refreshing saved data…</p>}
    </div>
  );
}

function RecurringForm({
  onCancel,
  onSaved,
}: {
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
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result: ActionState = await saveRecurringTransaction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={submit} className="border border-slate-200 rounded-xl p-4 mb-5 space-y-4">
      <h3 className="font-semibold">New recurring schedule</h3>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="recurring-kind">Type</label>
          <select
            className="field"
            id="recurring-kind"
            name="kind"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as "income" | "expense";
              setKind(next);
              setCategory(next === "income" ? "Salary" : "Housing");
            }}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="recurring-amount">Amount (CAD)</label>
          <input
            className="field"
            id="recurring-amount"
            name="amount"
            type="number"
            min="0.01"
            max="9999999999.99"
            step="0.01"
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="recurring-category">Category</label>
          <select
            className="field"
            id="recurring-category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES[kind].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="recurring-frequency">Frequency</label>
          <select className="field" id="recurring-frequency" name="frequency" defaultValue="monthly">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every two weeks</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="recurring-description">Description</label>
          <input
            className="field"
            id="recurring-description"
            name="description"
            maxLength={240}
            placeholder="e.g. Monthly rent"
          />
        </div>

        <div>
          <label className="label" htmlFor="recurring-start">First due date</label>
          <input
            className="field"
            id="recurring-start"
            name="start_date"
            type="date"
            defaultValue={today()}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="recurring-end">End date (optional)</label>
          <input className="field" id="recurring-end" name="end_date" type="date" />
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 text-rose-700 p-3 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button type="button" className="btn btn-light" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <LoaderCircle size={16} className="animate-spin" />}
          {pending ? "Saving…" : "Save recurring schedule"}
        </button>
      </div>
    </form>
  );
}

function WalletIcon() {
  return <span className="text-xl font-bold">$</span>;
}

function Summary({
  title,
  amount,
  icon,
  tone,
}: {
  title: string;
  amount: number;
  icon: ReactNode;
  tone: "green" | "rose" | "indigo";
}) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="muted text-sm font-medium">{title}</p>
        <span className={`rounded-xl p-2 ${styles[tone]}`}>{icon}</span>
      </div>
      <p className="text-2xl md:text-3xl font-bold mt-4 tracking-tight">{money(amount)}</p>
      <p className="muted text-xs mt-2">Selected month</p>
    </div>
  );
}

function TransactionModal({
  transaction,
  onClose,
  onSaved,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  onSaved: (t: Transaction) => void;
}) {
  const [kind, setKind] = useState<"income" | "expense">(transaction?.kind ?? "expense");
  const [category, setCategory] = useState(transaction?.category ?? "Food");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError("");

    startTransition(async () => {
      const state: ActionState = await saveTransaction({}, formData);

      if (state?.error) {
        setError(state.error);
        return;
      }

      const id = String(formData.get("id") ?? "");

      const local: Transaction = {
        id: id || `local-${Date.now()}`,
        user_id: transaction?.user_id ?? "",
        kind,
        amount: Number(formData.get("amount")),
        category,
        description: String(formData.get("description") ?? "").trim(),
        transaction_date: String(formData.get("transaction_date") ?? ""),
        created_at: transaction?.created_at ?? new Date().toISOString(),
      };

      onSaved(local);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/40 p-4 flex items-center justify-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 id="modal-title" className="text-xl font-bold">
              {transaction ? "Edit transaction" : "Add transaction"}
            </h2>
            <p className="muted text-sm mt-1">Your changes will be saved to the cloud.</p>
          </div>
          <button className="btn btn-light !p-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form action={submit} className="space-y-4">
          <input type="hidden" name="id" value={transaction?.id ?? ""} />

          <div>
            <label className="label">Transaction type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setKind("expense"); setCategory("Food"); }}
                className={`rounded-xl p-3 border font-semibold ${kind === "expense" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200"}`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => { setKind("income"); setCategory("Salary"); }}
                className={`rounded-xl p-3 border font-semibold ${kind === "income" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200"}`}
              >
                Income
              </button>
            </div>
            <input type="hidden" name="kind" value={kind} />
          </div>

          <div>
            <label className="label" htmlFor="amount">Amount (CAD)</label>
            <input className="field" id="amount" name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" defaultValue={transaction ? Number(transaction.amount).toFixed(2) : ""} placeholder="0.00" required />
          </div>

          <div>
            <label className="label" htmlFor="category">Category</label>
            <select className="field" id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES[kind].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="description">Description (optional)</label>
            <input className="field" id="description" name="description" maxLength={240} defaultValue={transaction?.description ?? ""} placeholder="e.g. October rent" />
          </div>

          <div>
            <label className="label" htmlFor="transaction_date">Date</label>
            <input className="field" id="transaction_date" name="transaction_date" type="date" defaultValue={transaction?.transaction_date ?? today()} required />
          </div>

          {error && <p role="alert" className="rounded-lg bg-rose-50 text-rose-700 p-3 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn btn-light flex-1" onClick={onClose}>Cancel</button>
            <button disabled={pending} type="submit" className="btn btn-primary flex-1">
              {pending && <LoaderCircle size={16} className="animate-spin" />}
              {pending ? "Saving…" : transaction ? "Save changes" : "Save transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
