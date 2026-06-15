export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-low flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-text-primary flex items-center justify-center">
              <span className="text-background font-bold text-sm">PF</span>
            </div>
            <span className="text-xl font-semibold text-text-primary tracking-tight">
              Premium Finance
            </span>
          </div>
          <p className="text-text-secondary text-sm">Pusat kendali keuangan pribadi</p>
        </div>
        {children}
      </div>
    </div>
  );
}
