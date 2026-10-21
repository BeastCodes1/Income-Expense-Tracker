"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp, requestPasswordReset, updatePassword, type ActionState } from "@/app/actions";
import { LoaderCircle } from "lucide-react";

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-rose-50 text-rose-700 p-3 text-sm">{state.error}</p>;
  if (state.success) return <p role="status" className="rounded-lg bg-emerald-50 text-emerald-800 p-3 text-sm">{state.success}</p>;
  return null;
}

function Submit({ label }: { label: string }) {
  return <button className="btn btn-primary w-full" type="submit"><span>{label}</span></button>;
}

export function AuthForm({ mode }: { mode: "login" | "signup" | "reset" | "new-password" }) {
  const action = mode === "login" ? signIn : mode === "signup" ? signUp : mode === "reset" ? requestPasswordReset : updatePassword;
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const title = mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Choose a new password";
  const subtitle = mode === "login" ? "Sign in to see your saved transactions." : mode === "signup" ? "Start keeping your money organized." : mode === "reset" ? "We'll email you a secure reset link." : "Use at least 8 characters.";

  return <main className="shell min-h-screen flex items-center justify-center py-10">
    <div className="card w-full max-w-md p-6 sm:p-8">
      <Link href="/" className="text-indigo-600 text-sm font-semibold">← Pocket Ledger</Link>
      <h1 className="text-3xl font-bold mt-6">{title}</h1>
      <p className="muted mt-2 mb-6">{subtitle}</p>
      <form action={formAction} className="space-y-4">
        {mode !== "new-password" ? <div><label className="label" htmlFor="email">Email address</label><input className="field" id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></div> : null}
        {mode === "login" || mode === "signup" ? <div><label className="label" htmlFor="password">Password</label><input className="field" id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters"/></div> : null}
        {mode === "new-password" ? <div><label className="label" htmlFor="password">New password</label><input className="field" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters"/></div> : null}
        <Feedback state={state}/>
        <button className="btn btn-primary w-full" type="submit" disabled={pending}>{pending ? <LoaderCircle size={17} className="animate-spin"/> : null}{pending ? "Please wait…" : mode === "login" ? "Log in" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Update password"}</button>
      </form>
      <div className="mt-5 text-sm muted space-y-2">
        {mode === "login" ? <><p><Link className="text-indigo-600 font-semibold" href="/forgot-password">Forgot your password?</Link></p><p>New here? <Link className="text-indigo-600 font-semibold" href="/signup">Create an account</Link></p></> : null}
        {mode === "signup" ? <p>Already registered? <Link className="text-indigo-600 font-semibold" href="/login">Log in</Link></p> : null}
        {mode === "reset" || mode === "new-password" ? <p><Link className="text-indigo-600 font-semibold" href="/login">Back to log in</Link></p> : null}
      </div>
    </div>
  </main>;
}
