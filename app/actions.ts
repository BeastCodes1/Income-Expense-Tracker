"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string };

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

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (!error) revalidatePath("/dashboard");
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
