export function Header() {
  return (
    <header
      className="border-b border-[#185FA5] bg-[#0C2340] text-white shadow-sm"
      role="banner"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-0.5 px-4 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:px-6 lg:px-8">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
          DITA Converter
        </h1>
        <p className="text-sm font-medium text-white/90 sm:text-right">
          BNY Hackathon 2026
        </p>
      </div>
    </header>
  );
}
