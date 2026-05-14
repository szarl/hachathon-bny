import { AppSidebar } from "@/app/components/AppSidebar";
import { Header } from "@/app/components/Header";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-[#EEF2F7] font-sans text-zinc-900">
      <AppSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
