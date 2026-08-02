import { getSupabaseUser } from "./client";
import type { Account, AccountType, AccountWithBalance, Transaction } from "@/types";

// ─── Accounts (Sumber Dana) ─────────────────────────────────────────────────
export async function getAccounts(): Promise<AccountWithBalance[]> {
    const { supabase, userId } = await getSupabaseUser();

    const [{ data: accounts, error: accError }, { data: txs, error: txError }] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", userId).order("created_at"),
        supabase.from("transactions").select("type, amount, date, account_id, to_account_id").eq("user_id", userId),
    ]);
    if (accError) throw accError;
    if (txError) throw txError;

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    // Saldo per akun = saldo_awal + semua transaksi yang nyentuh akun ini.
    // "transfer" itu khusus: ngurangin akun asal (account_id), nambahin akun
    // tujuan (to_account_id). Tipe lain (income/expense/debt_payment/saving/
    // receivable_out) cuma nyentuh satu akun (account_id) — income nambah,
    // sisanya (termasuk receivable_out, piutang keluar) ngurangin.
    return (accounts ?? []).map((acc) => {
        let balance = Number(acc.initial_balance);
        let monthly_expense = 0;
        (txs ?? []).forEach((t) => {
            const amt = Number(t.amount);
            if (t.type === "transfer") {
                if (t.account_id === acc.id) balance -= amt;
                if (t.to_account_id === acc.id) balance += amt;
            } else if (t.account_id === acc.id) {
                balance += t.type === "income" ? amt : -amt;

                // "Pengeluaran" di sini ngikutin definisi yang udah dipakai di
                // halaman Transaksi: semua tipe selain income & transfer
                // (expense, debt_payment, saving) — bukan cuma type="expense".
                if (t.type !== "income") {
                    const d = new Date(t.date);
                    if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
                        monthly_expense += amt;
                    }
                }
            }
        });
        return { ...acc, balance, monthly_expense } as AccountWithBalance;
    });
}

export async function addAccount(account: { name: string; type: AccountType; initial_balance: number; color?: string }) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("accounts")
        .insert({ ...account, user_id: userId })
        .select()
        .single();
    if (error) throw error;
    return data as Account;
}

export async function updateAccount(id: string, account: { name?: string; type?: AccountType; initial_balance?: number; color?: string }) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("accounts")
        .update({ ...account, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Account;
}

export async function deleteAccount(id: string) {
    const { supabase } = await getSupabaseUser();
    // Transaksi lama yang masih nempel ke akun ini TIDAK ikut terhapus —
    // cuma jadi "tanpa akun" (FK on delete set null).
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) throw error;
}

export async function transferBetweenAccounts(params: {
    from_account_id: string; to_account_id: string; amount: number; date: string; notes?: string;
}) {
    const { supabase, userId } = await getSupabaseUser();
    if (params.from_account_id === params.to_account_id) {
        throw new Error("Akun asal dan tujuan gak boleh sama");
    }
    const { data, error } = await supabase
        .from("transactions")
        .insert({
            user_id: userId,
            type: "transfer",
            name: "Transfer Antar Akun",
            description: params.notes || undefined,
            amount: params.amount,
            date: params.date,
            payment_method: "transfer",
            status: "completed",
            account_id: params.from_account_id,
            to_account_id: params.to_account_id,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Transaction;
}
