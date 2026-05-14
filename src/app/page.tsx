import { ConverterClient } from "@/app/ConverterClient";
import { Header } from "@/app/components/Header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#EEF2F7] font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <Header />
      <ConverterClient />
    </div>
  );
}
