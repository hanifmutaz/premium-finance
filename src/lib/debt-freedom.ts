/**
 * Hitung berapa bulan lagi sampai `remaining` lunas kalau bayar
 * `monthlyPayment` tiap bulan. Return null kalau gak bisa diestimasi
 * (monthlyPayment <= 0 padahal masih ada sisa utang).
 */
export function monthsToPayoff(remaining: number, monthlyPayment: number): number | null {
    if (remaining <= 0) return 0;
    if (monthlyPayment <= 0) return null;
    return Math.ceil(remaining / monthlyPayment);
}

/**
 * Tambah N bulan ke sebuah tanggal (dari hari ini kalau `from` gak diisi).
 * Dipakai buat proyeksi "estimasi tanggal bebas utang".
 */
export function addMonths(months: number, from: Date = new Date()): Date {
    const d = new Date(from.getFullYear(), from.getMonth() + months, from.getDate());
    return d;
}

export interface FreedomSimulation {
    baselineMonths: number | null;
    simulatedMonths: number | null;
    monthsAdvanced: number | null; // baselineMonths - simulatedMonths, null kalau salah satunya gak bisa diestimasi
    baselineDate: Date | null;
    simulatedDate: Date | null;
}

/**
 * Simulasi "kalau nambah bayar Rp X/bulan, bebas utang maju berapa bulan?"
 * extraPayment boleh 0 (buat nampilin baseline aja tanpa simulasi).
 */
export function simulateExtraPayment(
    remaining: number,
    avgMonthlyPayment: number,
    extraPayment: number,
    from: Date = new Date(),
): FreedomSimulation {
    const baselineMonths = monthsToPayoff(remaining, avgMonthlyPayment);
    const simulatedMonths = monthsToPayoff(remaining, avgMonthlyPayment + Math.max(0, extraPayment));

    const monthsAdvanced =
        baselineMonths !== null && simulatedMonths !== null
            ? baselineMonths - simulatedMonths
            : null;

    return {
        baselineMonths,
        simulatedMonths,
        monthsAdvanced,
        baselineDate: baselineMonths !== null ? addMonths(baselineMonths, from) : null,
        simulatedDate: simulatedMonths !== null ? addMonths(simulatedMonths, from) : null,
    };
}