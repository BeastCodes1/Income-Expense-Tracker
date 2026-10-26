import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Dashboard } from "@/app/dashboard/ui";
import { SessionTimeout } from "@/app/dashboard/session-timeout";
import { Wallet, LogOut } from "lucide-react";

export type Transaction = {
  id: string;
  user_id: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
  created_at: string;
};

export type RecurringTransaction = {
  id: string;
  user_id: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  frequency: "weekly" | "biweekly" | "monthly" | "yearly";
  start_date: string;
  next_due_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category: string;
  month: string;
  amount: number;
  created_at: string;
  updated_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [transactionResult, recurringResult, budgetResult] = await Promise.all([
    supabase.from("transactions")
      .select("id,user_id,kind,amount,category,description,transaction_date,created_at")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("recurring_transactions")
      .select("id,user_id,kind,amount,category,description,frequency,start_date,next_due_date,end_date,active,created_at")
      .order("next_due_date", { ascending: true }),
    supabase.from("budgets")
      .select("id,user_id,category,month,amount,created_at,updated_at")
      .order("month", { ascending: false }),
  ]);

  const transactions = (transactionResult.data ?? []).map((item) => ({
    ...item,
    amount: Number(item.amount),
  })) as Transaction[];
  const recurringTransactions = (recurringResult.data ?? []).map((item) => ({
    ...item,
    amount: Number(item.amount),
  })) as RecurringTransaction[];
  const budgets = (budgetResult.data ?? []).map((item) => ({
    ...item,
    amount: Number(item.amount),
  })) as Budget[];

  return (
    <main className="shell py-7 md:py-10">
      <SessionTimeout />
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-600 p-3 text-white"><Wallet size={23} /></div>
          <div><p className="text-xl font-bold">Pocket Ledger</p><p className="muted text-sm">Your personal money dashboard</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm muted">{user.email}</span>
          <form action={signOut}><button className="btn btn-light" type="submit"><LogOut size={16} /> Log out</button></form>
        </div>
      </header>
      {transactionResult.error && <div className="card p-4 text-rose-700 mb-5">Could not load transactions. Check your Supabase setup.</div>}
      {recurringResult.error && <div className="card p-4 text-rose-700 mb-5">Could not load recurring schedules. Check that the recurring-transactions SQL setup is complete.</div>}
      {budgetResult.error && <div className="card p-4 text-amber-800 mb-5">Budgets are not available yet. Run <code>supabase/budgets.sql</code> in your Supabase SQL Editor, then refresh this page.</div>}
      <Dashboard initialTransactions={transactions} initialRecurring={recurringTransactions} initialBudgets={budgets} />
      <p className="muted text-xs text-center mt-8">Your records are stored in your Supabase account. Keep your login credentials private.</p>
    </main>
  );
}
