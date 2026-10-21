import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Dashboard } from "@/app/dashboard/ui";
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
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("transactions")
    .select("id,user_id,kind,amount,category,description,transaction_date,created_at")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  const transactions = (data ?? []) as Transaction[];
  const {
  data: recurringData,
  error: recurringError,
} = await supabase
  .from("recurring_transactions")
  .select(
    "id,user_id,kind,amount,category,description,frequency,start_date,next_due_date,end_date,active,created_at"
  )
  .order("next_due_date", { ascending: true });

const recurringTransactions = (recurringData ?? []).map((item) => ({
  ...item,
  amount: Number(item.amount),
})) as RecurringTransaction[];

  return <main className="shell py-7 md:py-10">
    <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-600 p-3 text-white"><Wallet size={23}/></div><div><p className="text-xl font-bold">Pocket Ledger</p><p className="muted text-sm">Your personal money dashboard</p></div></div>
      <div className="flex items-center gap-3"><span className="hidden sm:block text-sm muted">{user.email}</span><form action={signOut}><button className="btn btn-light" type="submit"><LogOut size={16}/> Log out</button></form></div>
    </header>
    {error ? <div className="card p-4 text-rose-700 mb-5">Could not load transactions. Check that you ran `supabase/schema.sql` in your Supabase project.</div> : null}
    <Dashboard
  initialTransactions={transactions}
  initialRecurring={recurringTransactions}
/>
    <p className="muted text-xs text-center mt-8">Your records are stored in your Supabase account. Keep your login credentials private.</p>
  </main>;
}
