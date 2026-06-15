import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const page = parseInt(searchParams.get("page") ?? "1");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("transactions")
      .select("*, category:categories(*)", { count: "exact" })
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type && type !== "all") {
      query = query.eq("type", type);
    }

    const search = searchParams.get("search");
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const dateFrom = searchParams.get("date_from");
    if (dateFrom) query = query.gte("date", dateFrom);

    const dateTo = searchParams.get("date_to");
    if (dateTo) query = query.lte("date", dateTo);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      data,
      count,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, type, amount, date, category_id, payment_method, description, status, debt_id } = body;

    if (!name || !type || !amount || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        name, type, amount, date,
        category_id: category_id || null,
        payment_method: payment_method ?? "transfer",
        description: description || null,
        status: status ?? "completed",
        debt_id: debt_id || null,
      })
      .select("*, category:categories(*)")
      .single();

    if (error) throw error;

    // If debt payment, also record in debt_payments and update debt
    if (type === "debt_payment" && debt_id) {
      await supabase.from("debt_payments").insert({
        debt_id,
        transaction_id: data.id,
        amount,
        date,
      });
      // Trigger will auto-update debt.total_paid
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
