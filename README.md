# Income & Expense Tracker

A starter full-stack personal finance app using Next.js App Router, TypeScript, Supabase Auth/Postgres, and Vercel.

## Features
- Email/password sign-up, sign-in, sign-out, and password reset
- Cloud-persisted transactions
- Income, expenses, categories, dates, notes
- Search and month filtering
- Summary cards and recurring schedules
- Month-over-month income, expense, and net-balance comparisons
- Monthly budgets by expense category, progress bars, and 80% / over-budget warnings
- Responsive dashboard layouts for mobile and desktop
- Persistent light and dark themes
- Row Level Security: users can only access their own records

## 1. Requirements
- Node.js 20.9+ recommended
- npm
- A Supabase project
- A Vercel account for deployment (optional during local development)

## 2. Create Supabase project
1. Create a project at https://database.new
2. Open **Project Settings → API** (or the Connect/API Keys page).
3. Copy the Project URL and publishable key.
4. In Supabase **SQL Editor**, run all SQL in `supabase/schema.sql`. If you already have an existing database, run `supabase/recurring_transactions.sql` and `supabase/budgets.sql` in the SQL Editor to add those feature tables (the scripts are safe to run more than once).

Do not use a `service_role` key in the browser or commit any secrets. This app uses the publishable key and RLS.

## 3. Configure Auth URLs
In Supabase **Authentication → URL Configuration**:
- Site URL for local development: `http://localhost:3000`
- Add Redirect URL: `http://localhost:3000/auth/callback`
- For production, also add `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback` and set Site URL to your production URL when ready.

In Authentication email settings, ensure email confirmation is configured as you prefer. With confirmation enabled, a new user must click the email link before signing in.

## 4. Run locally
```bash
cp .env.example .env.local
# Edit .env.local and set your real Supabase URL and publishable key.
npm install
npm run dev
```
Open http://localhost:3000.

## 5. Deploy to Vercel
1. Push this project to a GitHub repository.
2. Import the repository in https://vercel.com/new.
3. Add these environment variables in Vercel Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (your production origin, e.g. `https://your-app.vercel.app`)
4. Deploy.
5. Add `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback` to Supabase Auth Redirect URLs.
6. Redeploy if environment variables were added after the first deployment.

## Notes
- Data is saved to Supabase Postgres. Logging in on another device loads the same account's records.
- The dashboard re-fetches after each successful create/update/delete. Budgets are scoped to the selected month and compare against recorded expenses in each category. This is save-on-change; it is not offline-first or realtime multi-tab sync.
- This starter does not connect to bank accounts or initiate payments.
- For production, configure email deliverability, rate limits, backups, and a custom domain as needed.
