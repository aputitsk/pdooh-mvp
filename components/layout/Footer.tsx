import ArcFeeSignal from "@/components/layout/ArcFeeSignal";

const arcLinks = [
  {
    label: "Arc",
    href: "https://www.arc.io/",
  },
  {
    label: "Docs",
    href: "https://docs.arc.io/",
  },
  {
    label: "Explorer",
    href: "https://testnet.arcscan.app/",
  },
];

export default function Footer() {
  return (
    <footer className="px-6 py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 md:flex-row md:gap-5">
        <ArcFeeSignal />
        <nav aria-label="Arc resources" className="flex items-center gap-2">
          {arcLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#9bdcff] transition hover:border-[#4F8CFF]/35 hover:bg-[#10284D]/35 hover:text-[#cfe8ff]"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
