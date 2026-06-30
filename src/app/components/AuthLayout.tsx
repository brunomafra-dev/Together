import { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fbfaf8] text-[#1f2937]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 py-6 sm:px-6">
        <div className="flex w-full flex-1 items-center justify-center py-8">{children}</div>
      </div>
    </main>
  );
}
