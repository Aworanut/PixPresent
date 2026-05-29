import Link from "next/link";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="block mb-8 text-center text-xs font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:text-[#D4AF37] dark:hover:text-[#D4AF37] transition-all duration-300 font-mono"
        >
          PixPresent · FaceFind
        </Link>
        <div className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-8 sm:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
