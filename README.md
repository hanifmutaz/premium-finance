# Premium Finance

Aplikasi manajemen keuangan pribadi berbasis web — modern, premium, mobile-first.

## Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth
- **Charts**: Recharts
- **State**: Zustand (persist)
- **Deploy**: Vercel + Supabase

## Fitur

- Dashboard ringkasan keuangan lengkap
- Manajemen Transaksi (CRUD, filter, search, export)
- Manajemen Utang + catat pembayaran otomatis
- Target Pelunasan dengan kalkulasi otomatis
- Wishlist + estimasi kemampuan beli
- Forecast keuangan 12 bulan (3 skenario)
- Financial Health Score (A–E)
- Laporan + Export PDF/Excel/CSV
- Notifikasi & reminder
- PWA ready (installable di Android/iOS)
- Responsive: Desktop, Tablet, Mobile

## Setup

### 1. Clone & install

```bash
git clone https://github.com/yourname/premium-finance.git
cd premium-finance
npm install
```

### 2. Environment

```bash
cp .env.local.example .env.local
```

Isi dengan kredensial Supabase lo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Setup database Supabase

1. Buka [supabase.com](https://supabase.com) → buat project baru
2. Buka **SQL Editor**
3. Copy-paste isi file `supabase-schema.sql` → Run
4. Aktifkan **Authentication > Email** di Supabase Dashboard

### 4. Jalankan dev server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

> **Demo mode**: masukkan email & password apapun di halaman login untuk bypass auth dan langsung masuk dashboard dengan data dummy.

## Deploy ke Vercel

```bash
# Push ke GitHub dulu
git add .
git commit -m "initial commit"
git push origin main
```

1. Buka [vercel.com](https://vercel.com) → Import repo
2. Tambahkan environment variables (sama seperti `.env.local`)
3. Deploy!

## Struktur Folder

```
src/
├── app/
│   ├── (auth)/           # Login, Register
│   ├── (dashboard)/      # Dashboard, Transactions, Debts, Goals, Wishlist, Forecast, Reports, Settings
│   └── api/              # REST API routes
├── components/
│   ├── layout/           # Sidebar, Header, MobileNav
│   ├── dashboard/        # StatCards, Charts, Widgets
│   ├── transactions/     # TransactionFormModal
│   ├── debts/            # DebtPaymentModal
│   └── shared/           # Skeleton, Badges, ProgressBar, EmptyState, ConfirmDialog
├── lib/
│   ├── supabase/         # client.ts, server.ts, middleware.ts
│   ├── mock-data.ts      # Data dummy untuk development
│   └── calculations.ts   # Logic keuangan otomatis
├── hooks/                # Custom React hooks
├── store/                # Zustand global state
├── types/                # TypeScript types
└── utils/                # Helper functions
```

## Integrasi Data

Semua modul saling terhubung:

```
Bayar Utang
    ↓
DebtPaymentModal → recordDebtPayment() [Zustand]
    ↓
  ┌─────────────────────────────────┐
  │ Auto-update:                    │
  │ • debts.total_paid / remaining  │
  │ • transactions (entry baru)     │
  │ • dashboardStats (refresh)      │
  │ • DB: debt_payments insert      │
  │ • DB trigger: sync_debt_payment │
  └─────────────────────────────────┘
```

## PWA

App bisa di-install di Android/iOS:
- Android: Chrome → "Add to Home Screen"
- iOS: Safari → Share → "Add to Home Screen"
