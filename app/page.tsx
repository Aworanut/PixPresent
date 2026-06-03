import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Heart,
  ScanFace,
  Share2,
  Sparkles,
  Sun,
  Quote,
} from "lucide-react";

/**
 * Public marketing landing — "cozy" warm specimen.
 * Ported from facefind_cozy_landing.html into a static server component.
 * Palette: linen #FDFBF7 · espresso #271A12 · sun #F97316 · sage #84A98C.
 * Primary entry points to /signup and /login live in the nav, hero, and footer.
 */

const LINEN = "#FDFBF7";
const ESPRESSO = "#271A12";

export const metadata = {
  title: "PixPresent · แจกรูปงานอีเวนต์ด้วยใบหน้า",
  description:
    "ให้แขกในงานค้นเจอรูปตัวเองด้วยการเซลฟี่เพียงครั้งเดียว — แจกรูปอีเวนต์ด้วยใบหน้า ง่าย อบอุ่น และเป็นส่วนตัว",
};

export default function Home() {
  return (
    <div
      className="flex flex-1 flex-col font-sans"
      style={{ backgroundColor: LINEN, color: ESPRESSO }}
    >
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <Vibe />
        <Journey />
        <DemoTeaser />
        <Stories />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

// ─── Nav ────────────────────────────────────────────────────────────────────

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#EFE6D8] bg-[#FDFBF7]/85 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] text-white shadow-sm">
            <ScanFace className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="font-heading text-xl font-semibold tracking-tight text-[#271A12]">
            PixPresent
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm text-[#5C4A3A] md:flex">
          <a href="#concept" className="transition-colors hover:text-[#EA580C]">
            Our Heart
          </a>
          <a href="#process" className="transition-colors hover:text-[#EA580C]">
            The Journey
          </a>
          <a href="#demo" className="transition-colors hover:text-[#EA580C]">
            Find Your Face
          </a>
          <a href="#stories" className="transition-colors hover:text-[#EA580C]">
            Happy Guests
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full px-3 py-2 text-sm font-medium text-[#5C4A3A] transition-colors hover:text-[#EA580C]"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
          >
            เริ่มใช้งานฟรี
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* warm decorative glows */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#FFEDD5] blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-32 h-80 w-80 rounded-full bg-[#F4F7F4] blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#F5D9B8] bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#C2410C]">
            <Sparkles className="h-3.5 w-3.5" />
            Every smile, reunited instantly
          </span>

          <h1 className="font-heading text-5xl font-light leading-[1.05] tracking-tight text-[#271A12] sm:text-6xl">
            Reunite with Your{" "}
            <span className="bg-gradient-to-r from-[#FB923C] to-[#EA580C] bg-clip-text text-transparent">
              Precious Moments.
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-[#5C4A3A] sm:text-lg">
            PixPresent ช่วยให้แขกในงานของคุณค้นเจอรูปตัวเองด้วยการเซลฟี่เพียงครั้งเดียว
            — แจกรูปงานอีเวนต์ด้วยใบหน้า ง่าย อบอุ่น และเป็นส่วนตัว
            ไม่ต้องไล่หาในอัลบั้มรวมพันรูปอีกต่อไป
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5"
            >
              เริ่มใช้งานฟรี
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 rounded-full border border-[#E7D7C3] bg-white px-6 py-3 text-sm font-semibold text-[#3D2A1D] transition-colors hover:border-[#FB923C]"
            >
              ดูวิธีใช้งาน
            </a>
          </div>

          <dl className="grid max-w-md grid-cols-3 gap-4 pt-4">
            <Stat value="12,000+" label="Smiling Guests" />
            <Stat value="350+" label="Cozy Weddings" />
            <Stat value="< 5 วิ" label="Search Time" />
          </dl>
        </div>

        <HeroCard />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="font-heading text-2xl font-semibold text-[#EA580C]">
        {value}
      </dt>
      <dd className="text-xs text-[#7A6A59]">{label}</dd>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rounded-[2rem] border border-[#F0E2D0] bg-white p-6 shadow-[0_20px_60px_-25px_rgba(124,45,18,0.35)]">
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-[#FFF7ED] via-[#FFEDD5] to-[#F4F7F4]">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/70 shadow-inner">
            <ScanFace className="h-10 w-10 text-[#EA580C]" strokeWidth={1.5} />
          </span>
          <div className="space-y-1 text-center">
            <p className="font-heading text-lg text-[#271A12]">เซลฟี่ครั้งเดียว</p>
            <p className="text-xs text-[#7A6A59]">เจอรูปทุกใบที่มีคุณในงาน</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#84A98C]/15 px-3 py-1 text-xs font-medium text-[#354F52]">
            <Sparkles className="h-3 w-3" />
            ค้นหาเสร็จสิ้น!
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-[#FB923C]/20 blur-2xl" />
    </div>
  );
}

// ─── Vibe / features ────────────────────────────────────────────────────────

function Vibe() {
  const features = [
    {
      icon: ScanFace,
      title: "Warm Friendly Biometrics",
      body: "จดจำใบหน้าด้วย AWS Rekognition ที่แม่นยำ แต่ยังเคารพความเป็นส่วนตัวของทุกคน ลบข้อมูลได้ตามหลัก PDPA",
    },
    {
      icon: Sun,
      title: "Warm Sun-kissed Palette",
      body: "บรรยากาศอบอุ่นในทุกหน้าจอ ให้แขกรู้สึกเหมือนได้กลับไปอยู่ในช่วงเวลาดี ๆ ของงานอีกครั้ง",
    },
    {
      icon: Share2,
      title: "Share the Love Instantly",
      body: "แขกดาวน์โหลดและแชร์รูปของตัวเองได้ทันทีในไม่กี่วินาที ไม่ต้องรอ ไม่ต้องทวงในกลุ่มแชต",
    },
  ];

  return (
    <section id="concept" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHead
        badge="The Vibe & Spirit"
        title="หัวใจของ PixPresent"
        sub="เทคโนโลยีที่ทรงพลัง ห่อหุ้มด้วยความรู้สึกอบอุ่นและเป็นมิตร"
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-3xl border border-[#F0E2D0] bg-white p-7 shadow-sm transition-transform hover:-translate-y-1"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#EA580C]">
              <f.icon className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <h3 className="mt-5 font-heading text-xl text-[#271A12]">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5C4A3A]">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Journey ────────────────────────────────────────────────────────────────

function Journey() {
  const steps = [
    {
      icon: Camera,
      title: "เซลฟี่ผ่านมือถือ",
      body: "เปิดลิงก์งานที่ได้รับ แล้วถ่ายเซลฟี่หนึ่งรูป ไม่ต้องติดตั้งแอปใด ๆ",
    },
    {
      icon: ScanFace,
      title: "สแกนอัจฉริยะ",
      body: "ระบบจับคู่ใบหน้ากับรูปทั้งหมดในงานภายในไม่กี่วินาที",
    },
    {
      icon: Heart,
      title: "รับความอบอุ่นใจ",
      body: "เห็นเฉพาะรูปที่มีคุณ ดาวน์โหลดความทรงจำกลับบ้านได้ทันที",
    },
  ];

  return (
    <section id="process" className="bg-[#F4F7F4]">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <SectionHead
          badge="The 3-Step Smile Journey"
          title="สัมผัสประสบการณ์ง่าย ๆ ใน 3 ขั้นตอน"
          sub="ตั้งแต่เซลฟี่ครั้งแรกจนได้รูปกลับบ้าน ใช้เวลาไม่ถึงนาที"
        />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-3xl border border-[#DCE7DC] bg-white p-7 shadow-sm"
            >
              <span className="absolute right-6 top-6 font-heading text-4xl font-light text-[#84A98C]/40">
                {i + 1}
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#84A98C]/15 text-[#354F52]">
                <s.icon className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <h3 className="mt-5 font-heading text-xl text-[#271A12]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5C4A3A]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── Demo teaser ────────────────────────────────────────────────────────────

function DemoTeaser() {
  return (
    <section id="demo" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <SectionHead
            align="left"
            badge="Live Interactive Preview"
            title="ทดลองค้นหาด้วยใบหน้าแบบเรียลไทม์"
            sub="ประสบการณ์ฝั่งแขกที่ใช้งานง่ายจนไม่ต้องมีคู่มือ"
          />
          <ul className="space-y-3 text-sm text-[#5C4A3A]">
            <DemoPoint>อัปโหลดเซลฟี่ หรือเปิดกล้องสแกนสด</DemoPoint>
            <DemoPoint>เห็นเฉพาะรูปของตัวเอง คัดกรองความเป็นส่วนตัวอัตโนมัติ</DemoPoint>
            <DemoPoint>ดาวน์โหลดทั้งหมดเป็นไฟล์เดียวได้ในคลิกเดียว</DemoPoint>
          </ul>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5"
          >
            สร้างงานแรกของคุณ
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* static mock of the guest face-search zone */}
        <div className="rounded-[2rem] border border-[#F0E2D0] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(124,45,18,0.35)]">
          <p className="font-heading text-lg text-[#271A12]">ค้นหารูปของคุณในงานนี้</p>
          <div className="mt-4 flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#E7D7C3] bg-[#FFF7ED]">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-inner">
              <ScanFace className="h-8 w-8 text-[#EA580C]" strokeWidth={1.5} />
            </span>
            <p className="text-xs text-[#7A6A59]">แตะเพื่อถ่ายเซลฟี่ของคุณ</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((n) => (
              <div
                key={n}
                className="aspect-square rounded-xl bg-gradient-to-br from-[#FFEDD5] to-[#F4F7F4]"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#84A98C]/20 text-[#354F52]">
        <ArrowRight className="h-2.5 w-2.5" />
      </span>
      {children}
    </li>
  );
}

// ─── Stories ────────────────────────────────────────────────────────────────

function Stories() {
  const stories = [
    {
      quote:
        "แขกทุกคนได้รูปของตัวเองภายในวันงานเลย ไม่มีใครต้องทวงรูปในกลุ่มไลน์อีกต่อไป มันอบอุ่นมากที่ได้เห็นทุกคนยิ้มกับรูปของตัวเอง",
      name: "คุณวรวรรณ & นนทวัฒน์",
      sub: "เจ้าของงานแต่ง Tuscany Villa",
    },
    {
      quote:
        "I found every photo of myself in just a few seconds — it felt like magic, but warm and cozy. Absolutely lovely.",
      name: "Eleanor W.",
      sub: "แขกผู้มีเกียรติชาวอังกฤษ",
    },
  ];

  return (
    <section id="stories" className="bg-[#FFF7ED]">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <SectionHead
          badge="Heartwarming Success Stories"
          title="ความประทับใจแสนอบอุ่นจากทุกครอบครัว"
          sub="เสียงจริงจากเจ้าของงานและแขกที่ได้สัมผัส PixPresent"
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {stories.map((s) => (
            <figure
              key={s.name}
              className="flex flex-col gap-4 rounded-3xl border border-[#F0E2D0] bg-white p-7 shadow-sm"
            >
              <Quote className="h-7 w-7 text-[#FB923C]" />
              <blockquote className="text-base leading-relaxed text-[#3D2A1D]">
                “{s.quote}”
              </blockquote>
              <figcaption className="mt-auto">
                <p className="font-heading text-lg text-[#271A12]">{s.name}</p>
                <p className="text-sm text-[#7A6A59]">{s.sub}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ──────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#7C2D12] via-[#9A3412] to-[#EA580C] px-8 py-14 text-center shadow-xl sm:px-16 sm:py-20">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
          <Sparkles className="h-3.5 w-3.5" />
          Bring PixPresent to Your Special Event
        </span>
        <h2 className="mx-auto mt-5 max-w-2xl font-heading text-4xl font-light leading-tight text-white sm:text-5xl">
          ให้ทุกคนในงานได้เจอรูปของตัวเอง
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-white/80 sm:text-base">
          สร้างงานแรกได้ฟรี ใช้เวลาไม่กี่นาที — เชื่อมต่อ Google Drive, sync รูป
          แล้วแชร์ลิงก์ให้แขกได้เลย
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#9A3412] shadow-md transition-transform hover:-translate-y-0.5"
          >
            เริ่มใช้งานฟรี
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="border-t border-[#EFE6D8] bg-[#FDFBF7]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] text-white">
            <ScanFace className="h-3.5 w-3.5" />
          </span>
          <span className="font-heading text-lg font-semibold text-[#271A12]">
            PixPresent
          </span>
        </div>

        <p className="order-last text-xs tracking-wide text-[#9C8B79] sm:order-none">
          © 2026 PixPresent. All rights reserved.
        </p>

        <div className="flex items-center gap-5 text-sm text-[#5C4A3A]">
          <Link href="/login" className="transition-colors hover:text-[#EA580C]">
            เข้าสู่ระบบ
          </Link>
          <a href="#" className="transition-colors hover:text-[#EA580C]">
            Privacy
          </a>
          <a href="#" className="transition-colors hover:text-[#EA580C]">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Shared ─────────────────────────────────────────────────────────────────

function SectionHead({
  badge,
  title,
  sub,
  align = "center",
}: {
  badge: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
}) {
  const alignment = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-2xl space-y-3 ${alignment}`}>
      <span className="inline-flex items-center gap-2 rounded-full border border-[#F5D9B8] bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#C2410C]">
        {badge}
      </span>
      <h2 className="font-heading text-4xl font-light leading-tight text-[#271A12]">
        {title}
      </h2>
      {sub && <p className="text-base leading-relaxed text-[#5C4A3A]">{sub}</p>}
    </div>
  );
}
