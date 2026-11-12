"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionsCsv, transactionsToCsv } from "@/lib/transactions-csv";

export type ActionState = { error?: string; success?: string };

export async function exportTransactionsCsv(): Promise<{ error?: string; csv?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const transactions = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("transactions")
      .select("kind,amount,category,description,transaction_date")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + 499);
    if (error) return { error: "Could not export transactions. Please try again." };

    transactions.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }

  if (transactions.length === 0) return { error: "There are no transactions to export yet." };
  return { csv: transactionsToCsv(transactions) };
}

export async function importTransactionsCsv(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const csv = formData.get("csv");
  if (typeof csv !== "string") return { error: "Choose a CSV file to import." };

  const parsed = parseTransactionsCsv(csv);
  if (parsed.error) return { error: parsed.error };

  const { error } = await supabase
    .from("transactions")
    .insert(parsed.transactions.map((transaction) => ({
      ...transaction,
      user_id: user.id,
    })));
  if (error) return { error: `Could not import transactions: ${error.message}` };

  revalidatePath("/dashboard");
  const guessedNote = parsed.guessed > 0
    ? ` ${parsed.guessed} row${parsed.guessed === 1 ? " was" : "s were"} filed from the description (or Other) because the category didn't match.`
    : "";
  return { success: `Imported ${parsed.transactions.length} transaction${parsed.transactions.length === 1 ? "" : "s"}.${guessedNote}` };
}

function safeRedirectPath(value: FormDataEntryValue | null, fallback = "/dashboard") {
  const path = typeof value === "string" ? value : fallback;
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) return { error: "Enter a valid email and a password of at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect("/dashboard");
  return { success: "Account created. Check your email for a confirmation link, then sign in." };
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Unable to sign in. Check your details and confirm your email if required." };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: error.message };
  return { success: "If an account matches that address, a password reset email will be sent." };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset session is missing or expired. Request a new reset link." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function saveTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const transaction_date = String(formData.get("transaction_date") ?? "");

  if (!["income", "expense"].includes(kind)) return { error: "Choose income or expense." };
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99 || !/^\d+(\.\d{1,2})?$/.test(amountRaw)) return { error: "Enter a positive amount with up to 2 decimal places." };
  if (category.length < 1 || category.length > 60) return { error: "Choose a category (maximum 60 characters)." };
  if (description.length > 240) return { error: "Description must be 240 characters or fewer." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction_date) || Number.isNaN(Date.parse(`${transaction_date}T00:00:00Z`))) return { error: "Choose a valid transaction date." };

  const payload = { kind, amount, category, description, transaction_date };
  const result = id
    ? await supabase.from("transactions").update(payload).eq("id", id).select("id").maybeSingle()
    : await supabase.from("transactions").insert({ ...payload, user_id: user.id }).select("id").single();

  if (result.error) return { error: "Could not save the transaction. Please try again." };
  if (!result.data) return { error: "Transaction not found or you do not have permission to edit it." };
  revalidatePath("/dashboard");
  return { success: id ? "Transaction updated." : "Transaction saved." };
}

export async function deleteTransaction(formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing transaction ID." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "Could not delete this transaction. Please try again." };
  revalidatePath("/dashboard");
  return { success: "Transaction deleted." };
}

export async function restoreTransaction(formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const amount = Number(String(formData.get("amount") ?? ""));
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const transaction_date = String(formData.get("transaction_date") ?? "");
  const created_at = String(formData.get("created_at") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { error: "That transaction can no longer be restored." };
  }
  if (!["income", "expense"].includes(kind)) return { error: "Could not restore the transaction." };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) {
    return { error: "Could not restore the transaction." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)) {
    return { error: "Could not restore the transaction." };
  }

  const { error } = await supabase.from("transactions").insert({
    id,
    user_id: user.id,
    kind,
    amount,
    category,
    description,
    transaction_date,
    ...(created_at && !Number.isNaN(Date.parse(created_at)) ? { created_at } : {}),
  });

  if (error) return { error: "Could not restore the transaction. It may already exist." };
  revalidatePath("/dashboard");
  return { success: "Transaction restored." };
}

export async function deleteTransactions(formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let ids: unknown;
  try {
    ids = JSON.parse(String(formData.get("ids") ?? ""));
  } catch {
    return { error: "Choose the transactions to delete." };
  }

  if (!Array.isArray(ids) || ids.length === 0) return { error: "Choose at least one transaction." };
  if (ids.length > 500) return { error: "Delete up to 500 transactions at a time." };

  const valid = ids.filter(
    (id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
  );
  if (valid.length === 0) return { error: "Choose the transactions to delete." };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .in("id", valid)
    .eq("user_id", user.id);

  if (error) return { error: "Could not delete the selected transactions. Please try again." };
  revalidatePath("/dashboard");
  return { success: `Deleted ${valid.length} transaction${valid.length === 1 ? "" : "s"}.` };
}

export async function saveRecurringTransaction(
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const kind = String(formData.get("kind") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "") || null;

  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

  if (!["income", "expense"].includes(kind)) {
    return { error: "Choose income or expense." };
  }

  if (
    !amountRaw ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 9999999999.99 ||
    !/^\d+(\.\d{1,2})?$/.test(amountRaw)
  ) {
    return { error: "Enter a valid positive amount with up to 2 decimal places." };
  }

  if (!category || category.length > 60) {
    return { error: "Enter a category of up to 60 characters." };
  }

  if (description.length > 240) {
    return { error: "Description must be 240 characters or fewer." };
  }

  if (!["weekly", "biweekly", "monthly", "yearly"].includes(frequency)) {
    return { error: "Choose a valid recurrence frequency." };
  }

  if (!validDate(startDate)) {
    return { error: "Choose a valid start date." };
  }

  if (endDate && (!validDate(endDate) || endDate < startDate)) {
    return { error: "The end date must be on or after the start date." };
  }

  const { error } = await supabase
    .from("recurring_transactions")
    .insert({
      user_id: user.id,
      kind,
      amount,
      category,
      description,
      frequency,
      start_date: startDate,
      next_due_date: startDate,
      end_date: endDate,
    });

  if (error) {
    console.error("Recurring transaction save failed:", error.message);
    return {
      error: "Could not save the recurring schedule. Check that the Supabase SQL setup has completed.",
    };
  }

  revalidatePath("/dashboard");
  return { success: "Recurring schedule saved." };
}

export async function deleteRecurringTransaction(
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");

  if (!id) return { error: "Missing recurring transaction ID." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("recurring_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { error: "Could not delete the recurring schedule." };
  }

  revalidatePath("/dashboard");
  return { success: "Recurring schedule deleted." };
}


export async function saveBudget(formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const category = String(formData.get("category") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);
  const month = String(formData.get("month") ?? "");
  const allowedCategories = [
    "Housing", "Food", "Transport", "Bills", "Shopping",
    "Health", "Entertainment", "Education", "Travel", "Other",
  ];

  if (!allowedCategories.includes(category)) {
    return { error: "Choose a valid expense category." };
  }
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99 || !/^\d+(\.\d{1,2})?$/.test(amountRaw)) {
    return { error: "Enter a positive budget amount with up to 2 decimal places." };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return { error: "Choose a valid budget month." };
  }

  const { error } = await supabase.from("budgets").upsert({
    user_id: user.id,
    category,
    amount,
    month: `${month}-01`,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,category,month" });

  if (error) {
    console.error("Budget save failed:", error.message);
    return { error: "Could not save the budget. Make sure you ran supabase/budgets.sql in Supabase." };
  }

  revalidatePath("/dashboard");
  return { success: "Budget saved." };
}

export async function deleteBudget(formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing budget ID." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "Could not delete this budget." };
  revalidatePath("/dashboard");
  return { success: "Budget deleted." };
}
