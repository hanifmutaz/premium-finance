export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-low flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <img
              src="/icons/logo.png"
              alt="NOXOMOR Ledger"
              className="w-9 h-9 rounded-md object-cover"
            />
            <span className="text-xl font-semibold text-text-primary tracking-tight">
              NOXOMOR Ledger
            </span>
          </div>
          <p className="text-text-secondary text-sm">Pusat kendali keuangan pribadi</p>
        </div>
        {children}
      </div>
    </div>
  );
}