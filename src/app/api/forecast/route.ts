import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateForecast } from "@/lib/calculations";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { monthly_income, fixed_expenses, debt_allocation, savings_allocation } = body;

    if (!monthly_income || !fixed_expenses) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get total active debt from DB
    const { data: debts } = await supabase
      .from("debts")
      .select("remaining")
      .eq("user_id", user.id)
      .eq("status", "active");

    const totalDebt = (debts ?? []).reduce((s: number, d: { remaining: number }) => s + d.remaining, 0);

    const result = generateForecast(
      { monthly_income, fixed_expenses, debt_allocation: debt_allocation ?? 0, savings_allocation: savings_allocation ?? 0 },
      totalDebt,
      12
    );

    // Save snapshot
    await supabase.from("forecast_snapshots").insert({
      user_id: user.id,
      monthly_income,
      fixed_expenses,
      debt_allocation: debt_allocation ?? 0,
      savings_allocation: savings_allocation ?? 0,
      result_json: result,
    });

    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
