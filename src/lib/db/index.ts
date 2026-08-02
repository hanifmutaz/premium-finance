// Barrel re-export — semua import lama `from "@/lib/db"` tetap jalan tanpa
// perlu diubah satu-satu di seluruh app. Isinya dipecah per domain di folder
// ini (db/*.ts) biar tiap file gampang dibaca & di-maintain, tapi API publik
// (nama fungsi yang di-export) PERSIS sama seperti db.ts yang lama.
export * from "./client";
export * from "./categories";
export * from "./accounts";
export * from "./budget-sync";
export * from "./transactions";
export * from "./debts";
export * from "./goals";
export * from "./wishlist";
export * from "./dashboard";
export * from "./recurring";
export * from "./forecast";
export * from "./receivables";
export * from "./budgets";
export * from "./notifications";
export * from "./search";
