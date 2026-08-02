import { getSupabaseUser } from "./client";

// ─── Global Search ──────────────────────────────────────────────────────────
// ─── Global Search ──────────────────────────────────────────────────────────
export interface SearchResult {
    id: string;
    type: "debt" | "transaction" | "goal" | "wishlist" | "receivable" | "account";
    title: string;
    subtitle: string;
    href: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const { supabase, userId } = await getSupabaseUser();
    const like = `%${q}%`;

    const [debts, transactions, goals, wishlist, receivables, accounts] = await Promise.all([
        supabase.from("debts").select("id, name, lender").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("transactions").select("id, name, amount").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("goals").select("id, name, target_amount").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("wishlists").select("id, name, price").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("receivables").select("id, name, borrower, total_amount").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("accounts").select("id, name, type, initial_balance").eq("user_id", userId).ilike("name", like).limit(5),
    ]);

    const results: SearchResult[] = [];

    (debts.data ?? []).forEach((d) =>
        results.push({ id: d.id, type: "debt", title: d.name, subtitle: `Utang • ${d.lender}`, href: "/debts" })
    );
    (transactions.data ?? []).forEach((t) =>
        results.push({
            id: t.id, type: "transaction", title: t.name,
            subtitle: `Transaksi • Rp ${Number(t.amount).toLocaleString("id-ID")}`, href: "/transactions",
        })
    );
    (goals.data ?? []).forEach((g) =>
        results.push({
            id: g.id, type: "goal", title: g.name,
            subtitle: `Tujuan • Rp ${Number(g.target_amount).toLocaleString("id-ID")}`, href: "/goals",
        })
    );
    (wishlist.data ?? []).forEach((w) =>
        results.push({
            id: w.id, type: "wishlist", title: w.name,
            subtitle: `Wishlist • Rp ${Number(w.price).toLocaleString("id-ID")}`, href: "/wishlist",
        })
    );
    (receivables.data ?? []).forEach((r) =>
        results.push({ id: r.id, type: "receivable", title: r.name, subtitle: `Piutang • ${r.borrower}`, href: "/receivables" })
    );
    (accounts.data ?? []).forEach((a) =>
        results.push({ id: a.id, type: "account", title: a.name, subtitle: `Akun • ${a.type}`, href: "/accounts" })
    );

    return results;
}