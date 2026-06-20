import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/utils";
import type { Transaction } from "@/types";

interface ExportSummary {
    income: number;
    expense: number;
    net: number;
}

interface ExportMeta {
    periodLabel: string;
    generatedAt: string;
}

function paymentMethodLabel(method: string) {
    const map: Record<string, string> = {
        cash: "Tunai",
        transfer: "Transfer Bank",
        credit_card: "Kartu Kredit",
        debit_card: "Kartu Debit",
        "e-wallet": "E-Wallet",
        other: "Lainnya",
    };
    return map[method] ?? method;
}

function typeLabel(type: string) {
    const map: Record<string, string> = {
        income: "Pemasukan",
        expense: "Pengeluaran",
        debt_payment: "Bayar Utang",
        transfer: "Transfer",
    };
    return map[type] ?? type;
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export function exportToExcel(transactions: Transaction[], summary: ExportSummary, meta: ExportMeta) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryRows = [
        ["NOXOMOR Ledger - Laporan Keuangan"],
        [`Periode: ${meta.periodLabel}`],
        [`Dibuat: ${meta.generatedAt}`],
        [],
        ["Ringkasan", ""],
        ["Total Pemasukan", summary.income],
        ["Total Pengeluaran", summary.expense],
        ["Net Cash Flow", summary.net],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 24 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan");

    // Sheet 2: Transaction detail
    const txHeader = ["Tanggal", "Nama", "Tipe", "Kategori", "Metode Pembayaran", "Nominal"];
    const txRows = transactions.map((tx) => [
        tx.date,
        tx.name,
        typeLabel(tx.type),
        tx.category?.name ?? "—",
        paymentMethodLabel(tx.payment_method),
        tx.type === "income" ? tx.amount : -tx.amount,
    ]);
    const txSheet = XLSX.utils.aoa_to_sheet([txHeader, ...txRows]);
    txSheet["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, txSheet, "Detail Transaksi");

    // Sheet 3: Category breakdown (expenses only)
    const categoryMap: Record<string, number> = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
        const cat = t.category?.name ?? "Lainnya";
        categoryMap[cat] = (categoryMap[cat] ?? 0) + t.amount;
    });
    const catRows = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => [name, value]);
    const catSheet = XLSX.utils.aoa_to_sheet([["Kategori", "Total Pengeluaran"], ...catRows]);
    catSheet["!cols"] = [{ wch: 24 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, catSheet, "Per Kategori");

    const filename = `Laporan_NOXOMOR_${meta.periodLabel.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, filename);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
export function exportToPDF(transactions: Transaction[], summary: ExportSummary, meta: ExportMeta) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("NOXOMOR Ledger", 14, 18);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Laporan Keuangan", 14, 25);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Periode: ${meta.periodLabel}`, 14, 31);
    doc.text(`Dibuat: ${meta.generatedAt}`, 14, 36);

    // Summary boxes
    const boxY = 44;
    const boxWidth = (pageWidth - 28 - 10) / 3;
    const summaryItems = [
        { label: "Total Pemasukan", value: summary.income, color: [34, 197, 94] },
        { label: "Total Pengeluaran", value: summary.expense, color: [239, 68, 68] },
        { label: "Net Cash Flow", value: summary.net, color: summary.net >= 0 ? [34, 197, 94] : [239, 68, 68] },
    ];

    summaryItems.forEach((item, i) => {
        const x = 14 + i * (boxWidth + 5);
        doc.setDrawColor(220);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, boxY, boxWidth, 20, 2, 2, "FD");
        doc.setFontSize(7.5);
        doc.setTextColor(120);
        doc.text(item.label, x + 3, boxY + 6);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(item.color[0], item.color[1], item.color[2]);
        doc.text(formatCurrency(item.value, true), x + 3, boxY + 15);
        doc.setFont("helvetica", "normal");
    });

    // Category breakdown table
    const categoryMap: Record<string, number> = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
        const cat = t.category?.name ?? "Lainnya";
        categoryMap[cat] = (categoryMap[cat] ?? 0) + t.amount;
    });
    const catRows = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

    let nextY = boxY + 30;

    if (catRows.length > 0) {
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Distribusi Pengeluaran per Kategori", 14, nextY);

        autoTable(doc, {
            startY: nextY + 4,
            head: [["Kategori", "Total"]],
            body: catRows.map(([name, value]) => [name, formatCurrency(value, true)]),
            theme: "plain",
            headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            columnStyles: { 1: { halign: "right" } },
            margin: { left: 14, right: 14 },
        });

        nextY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Transaction detail table
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Detail Transaksi", 14, nextY);

    autoTable(doc, {
        startY: nextY + 4,
        head: [["Tanggal", "Nama", "Tipe", "Kategori", "Nominal"]],
        body: transactions.map((tx) => [
            tx.date,
            tx.name,
            typeLabel(tx.type),
            tx.category?.name ?? "—",
            `${tx.type === "income" ? "+" : "-"}${formatCurrency(tx.amount, true)}`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 4: { halign: "right" } },
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
            const pageCount = (doc as any).internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Halaman ${(doc as any).internal.getCurrentPageInfo().pageNumber} / ${pageCount}`,
                pageWidth - 30,
                doc.internal.pageSize.getHeight() - 8
            );
        },
    });

    const filename = `Laporan_NOXOMOR_${meta.periodLabel.replace(/\s+/g, "_")}.pdf`;
    doc.save(filename);
}

// ─── CSV Export (bonus, simple) ────────────────────────────────────────────────
export function exportToCSV(transactions: Transaction[]) {
    const header = ["Tanggal", "Nama", "Tipe", "Kategori", "Metode Pembayaran", "Nominal"];
    const rows = transactions.map((tx) => [
        tx.date,
        tx.name,
        typeLabel(tx.type),
        tx.category?.name ?? "—",
        paymentMethodLabel(tx.payment_method),
        String(tx.type === "income" ? tx.amount : -tx.amount),
    ]);

    const csvContent = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Transaksi_NOXOMOR_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}