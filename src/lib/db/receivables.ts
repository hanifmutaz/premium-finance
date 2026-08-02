import { getSupabaseUser } from "./client";
import { addTransaction, updateTransaction } from "./transactions";
import type { Receivable } from "@/types";

// ─── Receivables (Piutang) ────────────────────────────────────────────────────
export async function getReceivables() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("receivables")
        .select("*, account:accounts(*)")
        .eq("user_id", userId)
        .order("due_date", { ascending: true });
    if (error) throw error;
    return data;
}

export async function addReceivable(recv: {
    name: string; borrower: string; total_amount: number;
    start_date: string; due_date: string; priority: string; notes?: string;
    account_id: string;
}) {
    const { supabase, userId } = await getSupabaseUser();

    // Piutang keluar = uang beneran ninggalin salah satu akun kita. Dicatat
    // sebagai transaksi "receivable_out" (bukan "expense") — pola yang sama
    // kayak debt_payment: ngurangin saldo akun & kehitung cash-out bulanan,
    // tapi TIDAK ikut breakdown kategori pengeluaran.
    const tx = await addTransaction({
        type: "receivable_out",
        name: `Piutang: ${recv.name}`,
        description: `Dipinjamkan ke ${recv.borrower}`,
        amount: recv.total_amount,
        date: recv.start_date,
        payment_method: "transfer",
        status: "completed",
        account_id: recv.account_id,
    });

    const { data, error } = await supabase
        .from("receivables")
        .insert({ ...recv, user_id: userId, total_received: 0, status: "active", transaction_id: tx.id })
        .select("*, account:accounts(*)")
        .single();
    if (error) throw error;
    return data;
}

export async function recordReceivablePayment(receivableId: string, amount: number, accountId: string, notes?: string) {
    const { supabase } = await getSupabaseUser();
    // Get current data
    const { data: recv, error: fetchErr } = await supabase
        .from("receivables")
        .select("*")
        .eq("id", receivableId)
        .single();
    if (fetchErr) throw fetchErr;

    const newReceived = Number(recv.total_received) + amount;
    const newRemaining = Math.max(0, Number(recv.total_amount) - newReceived);
    const newStatus = newRemaining === 0 ? "completed" : recv.status;

    const { data, error } = await supabase
        .from("receivables")
        .update({ total_received: newReceived, status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", receivableId)
        .select("*, account:accounts(*)")
        .single();
    if (error) throw error;

    const today = new Date().toISOString().split("T")[0];

    // Auto-create income transaction lewat addTransaction (bukan insert
    // manual) supaya account_id ke-set & saldo akun penerima ke-update
    // konsisten dengan alur transaksi lainnya.
    const tx = await addTransaction({
        type: "income",
        name: `Piutang Diterima: ${recv.name}`,
        description: notes || `Pembayaran piutang dari ${recv.borrower}`,
        amount,
        date: today,
        payment_method: "transfer",
        status: "completed",
        account_id: accountId,
    });

    // Log payment
    await supabase.from("receivable_payments").insert({
        receivable_id: receivableId,
        amount,
        date: today,
        notes,
        account_id: accountId,
        transaction_id: tx.id,
    });

    return data;
}

export async function deleteReceivable(id: string) {
    const { supabase } = await getSupabaseUser();
    // Catatan: transaksi "receivable_out" & "income" yang udah kebentuk dari
    // piutang ini TIDAK ikut kehapus — uang emang beneran udah pindah di
    // masa lalu, jadi riwayat kas di akun tetap harus akurat walau catatan
    // piutangnya dihapus.
    const { error } = await supabase.from("receivables").delete().eq("id", id);
    if (error) throw error;
}

export async function updateReceivable(id: string, recv: {
    name: string; borrower: string; total_amount: number;
    start_date: string; due_date: string; priority: string; notes?: string;
    account_id?: string;
}) {
    const { supabase } = await getSupabaseUser();

    // Ambil data lama dulu buat tau apa yang berubah & buat validasi.
    const { data: existing, error: fetchErr } = await supabase
        .from("receivables")
        .select("*")
        .eq("id", id)
        .single();
    if (fetchErr) throw fetchErr;

    // Nominal gak boleh diturunin di bawah yang udah kebayar — bakal bikin
    // total_received > total_amount (piutang "lunas lebih").
    if (recv.total_amount < Number(existing.total_received)) {
        throw new Error(
            `Nominal gak boleh kurang dari Rp${Number(existing.total_received).toLocaleString("id-ID")} yang udah diterima`
        );
    }

    const { data, error } = await supabase
        .from("receivables")
        .update({
            ...recv,
            // Samain status "completed" ulang terhadap total_amount BARU —
            // sama bug class-nya kayak goals: kalau gak di-recheck, piutang
            // yang udah "completed" bisa nyangkut statusnya pas total_amount
            // dinaikin (padahal sisa yang harus diterima balik lagi >0).
            // "overdue" sengaja gak disentuh — itu status manual/waktu.
            ...(existing.status === "active" || existing.status === "completed"
                ? { status: Number(existing.total_received) >= Number(recv.total_amount) ? "completed" : "active" }
                : {}),
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*, account:accounts(*)")
        .single();
    if (error) throw error;

    // Auto-sync transaksi "receivable_out" yang nempel, kalau nominal, akun,
    // atau tanggalnya berubah — biar saldo akun & catatan piutang tetap
    // konsisten satu sama lain.
    if (existing.transaction_id) {
        const amountChanged = Number(recv.total_amount) !== Number(existing.total_amount);
        const accountChanged = !!recv.account_id && recv.account_id !== existing.account_id;
        const dateChanged = recv.start_date !== existing.start_date;
        const nameChanged = recv.name !== existing.name || recv.borrower !== existing.borrower;

        if (amountChanged || accountChanged || dateChanged || nameChanged) {
            await updateTransaction(existing.transaction_id, {
                amount: recv.total_amount,
                account_id: recv.account_id,
                date: recv.start_date,
                name: `Piutang: ${recv.name}`,
                description: `Dipinjamkan ke ${recv.borrower}`,
            });
        }
    }

    return data as Receivable;
}