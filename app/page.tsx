import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  Gift,
  Heart,
  ScanFace,
  Share2,
  Sparkles,
  Sun,
  Quote,
} from "lucide-react";
import { Reveal } from "./_reveal";
import { TIER_CONFIG, EVENT_TIERS, WELCOME_BONUS_CREDITS } from "@/lib/credit-packages";

/**
 * Public marketing landing — "Warm Editorial" specimen.
 * Warm linen base (approachable) + editorial Cormorant scale + champagne-gold
 * accents (premium). Motion: on-load reveal in the hero, scroll-triggered
 * reveals below the fold (see _reveal.tsx + globals.css), all reduced-motion safe.
 * Palette: linen #FDFBF7 · espresso #271A12 · sun #F97316 · sage #84A98C · gold #A16207.
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
        <Pricing />
        <Stories />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

// ─── Nav ────────────────────────────────────────────────────────────────────

function SiteNav() {
  const links = [
    ["#concept", "Our Heart"],
    ["#process", "The Journey"],
    ["#demo", "Find Your Face"],
    ["#pricing", "Packages"],
    ["#stories", "Happy Guests"],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-[#EBDFC9] bg-[#FDFBF7]/85 backdrop-blur">
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
          {links.map(([href, label]) => (
            <a key={href} href={href} className="transition-colors hover:text-[#A16207]">
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full px-3 py-2 text-sm font-medium text-[#5C4A3A] transition-colors hover:text-[#A16207]"
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
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#FFEDD5] blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-40 h-96 w-96 rounded-full bg-[#F4F7F4] blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <span className="reveal-up inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#A16207]">
            <span className="h-px w-8 bg-[#C9A227]" />
            Every smile, reunited
          </span>

          <h1
            className="reveal-up font-heading font-light tracking-tight text-[#271A12]"
            style={{ animationDelay: "80ms", fontSize: "clamp(3rem,6vw,6.25rem)", lineHeight: 0.98 }}
          >
            Reunite with your{" "}
            <span className="italic bg-gradient-to-r from-[#FB923C] to-[#EA580C] bg-clip-text text-transparent">
              precious moments.
            </span>
          </h1>

          <p
            className="reveal-up max-w-lg text-base leading-relaxed text-[#5C4A3A] sm:text-lg"
            style={{ animationDelay: "160ms" }}
          >
            เซลฟี่ครั้งเดียว เจอรูปตัวเองทุกใบในงาน — แจกรูปอีเวนต์ด้วยใบหน้า
            ง่าย อบอุ่น และเป็นส่วนตัว ไม่ต้องไล่หาในอัลบั้มรวมพันรูปอีกต่อไป
          </p>

          <div className="reveal-up flex flex-wrap items-center gap-5" style={{ animationDelay: "240ms" }}>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-10px_rgba(234,88,12,0.5)] transition-transform hover:-translate-y-0.5"
            >
              เริ่มใช้งานฟรี
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#demo" className="group inline-flex items-center gap-2 text-sm font-semibold text-[#3D2A1D]">
              <span className="border-b-2 border-[#C9A227] pb-0.5 transition-colors group-hover:border-[#A16207]">
                ดูวิธีใช้งาน
              </span>
              <ArrowRight className="h-4 w-4 text-[#A16207] transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          <dl className="reveal-up grid max-w-md grid-cols-3 gap-6 border-t border-[#EFE2CE] pt-6" style={{ animationDelay: "320ms" }}>
            <Stat value="12,000+" label="Smiling guests" />
            <Stat value="350+" label="Cozy weddings" />
            <Stat value="< 5 วิ" label="Search time" />
          </dl>
        </div>

        <HeroGallery />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1">
      <dt className="font-heading text-3xl font-medium leading-none text-[#271A12]">{value}</dt>
      <dd className="text-xs tracking-wide text-[#7A6A59]">{label}</dd>
    </div>
  );
}

/**
 * Editorial photo-grid hero visual — hints the product (face-match reveal)
 * using the shared `.photo-reveal` stagger from globals.css. One tile is the
 * matched "you", ringed in champagne gold.
 */
function HeroGallery() {
  const tiles = [
    { wide: true, from: "#FFE8D1", to: "#FFD9B0" },
    { from: "#F0E7DA", to: "#E7D8C3" },
    { you: true, from: "#E7F0E8", to: "#D7E7DA" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        className="reveal-up rounded-[2rem] border border-[#F0E2D0] bg-white/70 p-5 shadow-[0_30px_80px_-30px_rgba(124,45,18,0.4)] backdrop-blur-sm"
        style={{ animationDelay: "200ms" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-heading text-lg text-[#271A12]">รูปของคุณในงานนี้</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#84A98C]/15 px-2.5 py-1 text-xs font-medium text-[#354F52]">
            <Sparkles className="h-3 w-3" /> เจอแล้ว 3
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t, i) => (
            <div
              key={i}
              className={`photo-reveal relative overflow-hidden rounded-xl ${t.wide ? "col-span-2 aspect-[16/9]" : "aspect-square"}`}
              style={{ animationDelay: `${300 + i * 110}ms`, backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
            >
              {t.you && (
                <>
                  <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[#C9A227] ring-inset" />
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-[#A16207]">
                    <ScanFace className="h-3 w-3" /> คุณ
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-5 -right-5 h-28 w-28 rounded-full bg-[#FB923C]/20 blur-2xl" />
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
    <section id="concept" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <SectionHead
          badge="The vibe & spirit"
          title="หัวใจของ PixPresent"
          sub="เทคโนโลยีที่ทรงพลัง ห่อหุ้มด้วยความรู้สึกอบอุ่นและเป็นมิตร"
        />
      </Reveal>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 90} className="h-full">
            <div className="group h-full rounded-3xl border border-[#EFE2CE] bg-white/70 p-8 backdrop-blur-sm transition-transform hover:-translate-y-1">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#A16207] ring-1 ring-[#EFD9B8]">
                <f.icon className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <h3 className="mt-6 font-heading text-2xl font-light text-[#271A12]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5C4A3A]">{f.body}</p>
            </div>
          </Reveal>
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
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <SectionHead
            badge="The 3-step smile journey"
            title="สัมผัสประสบการณ์ง่าย ๆ ใน 3 ขั้นตอน"
            sub="ตั้งแต่เซลฟี่ครั้งแรกจนได้รูปกลับบ้าน ใช้เวลาไม่ถึงนาที"
          />
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 90} className="h-full">
              <div className="relative flex h-full flex-col rounded-3xl border border-[#DCE7DC] bg-white/80 p-8">
                <span className="font-heading text-5xl font-light leading-none text-[#C9A227]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#84A98C]/15 text-[#354F52]">
                  <s.icon className="h-6 w-6" strokeWidth={1.5} />
                </span>
                <h3 className="mt-5 font-heading text-2xl font-light text-[#271A12]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5C4A3A]">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Demo teaser ────────────────────────────────────────────────────────────

function DemoTeaser() {
  const tiles = ["#FFEDD5", "#F0E7DA", "#E7F0E8"];
  return (
    <section id="demo" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal className="space-y-6">
          <SectionHead
            align="left"
            badge="Live interactive preview"
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
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-10px_rgba(234,88,12,0.5)] transition-transform hover:-translate-y-0.5"
          >
            สร้างงานแรกของคุณ
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        {/* static mock of the guest face-search zone */}
        <Reveal delay={120}>
          <div className="rounded-[2rem] border border-[#F0E2D0] bg-white/70 p-6 shadow-[0_30px_80px_-30px_rgba(124,45,18,0.35)] backdrop-blur-sm">
            <p className="font-heading text-lg text-[#271A12]">ค้นหารูปของคุณในงานนี้</p>
            <div className="mt-4 flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#E7D7C3] bg-[#FFF7ED]">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-inner">
                <ScanFace className="h-8 w-8 text-[#A16207]" strokeWidth={1.5} />
              </span>
              <p className="text-xs text-[#7A6A59]">แตะเพื่อถ่ายเซลฟี่ของคุณ</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {tiles.map((c, n) => (
                <div
                  key={n}
                  className="photo-reveal aspect-square rounded-xl"
                  style={{ animationDelay: `${n * 110}ms`, backgroundImage: `linear-gradient(135deg, ${c}, #F4F7F4)` }}
                />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function DemoPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#84A98C]/20 text-[#354F52]">
        <ArrowRight className="h-2.5 w-2.5" />
      </span>
      {children}
    </li>
  );
}

// ─── Pricing / packages ─────────────────────────────────────────────────────

/**
 * Packages section — renders the real event tiers straight from
 * `lib/credit-packages.ts` (TIER_CONFIG) so prices stay in sync with the app.
 * "Gallery" is the highlighted sweet spot; specs come from each tier's
 * `description` (split on the bullet separator).
 */
function Pricing() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <SectionHead
          badge="Packages"
          title="จ่ายต่องาน ไม่มีรายเดือน"
          sub="1 เครดิต = 1 บาท · เลือกแพ็กเกจตามขนาดงาน · จ่ายเฉพาะตอนเปิดงานจริง"
        />
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {EVENT_TIERS.map((key, i) => {
          const tier = TIER_CONFIG[key];
          const featured = key === "gallery";
          const specs = tier.description.split("·").map((s) => s.trim());
          return (
            <Reveal key={key} delay={i * 90} className="h-full">
              <div
                className={`relative flex h-full flex-col rounded-3xl p-8 ${
                  featured
                    ? "border-2 border-[#C9A227] bg-white shadow-[0_30px_80px_-40px_rgba(124,45,18,0.45)]"
                    : "border border-[#EFE2CE] bg-white/70 backdrop-blur-sm"
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FB923C] to-[#EA580C] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                    <Sparkles className="h-3 w-3" /> แนะนำ
                  </span>
                )}
                <h3 className="font-heading text-2xl font-light text-[#271A12]">{tier.label}</h3>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-heading text-5xl font-medium leading-none text-[#271A12]">
                    {tier.creditCost.toLocaleString()}
                  </span>
                  <span className="text-sm text-[#7A6A59]">เครดิต / งาน</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-[#5C4A3A]">
                  {specs.map((spec) => (
                    <li key={spec} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#A16207]" strokeWidth={2.5} />
                      <span>{spec}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${
                    featured
                      ? "bg-gradient-to-br from-[#FB923C] to-[#EA580C] text-white shadow-[0_14px_30px_-10px_rgba(234,88,12,0.5)]"
                      : "border border-[#E7D7C3] bg-white text-[#3D2A1D] hover:border-[#C9A227]"
                  }`}
                >
                  เลือก {tier.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal>
        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-sm text-[#7A6A59]">
          <Gift className="h-4 w-4 text-[#A16207]" />
          สมัครวันนี้รับ {WELCOME_BONUS_CREDITS.toLocaleString()} เครดิตฟรี — เปิดงาน Starter ได้เลยโดยไม่ต้องจ่าย
        </p>
      </Reveal>
    </section>
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
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <SectionHead
            badge="Heartwarming success stories"
            title="ความประทับใจแสนอบอุ่นจากทุกครอบครัว"
            sub="เสียงจริงจากเจ้าของงานและแขกที่ได้สัมผัส PixPresent"
          />
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {stories.map((s, i) => (
            <Reveal key={s.name} delay={i * 90} className="h-full">
              <figure className="flex h-full flex-col gap-5 rounded-3xl border border-[#F0E2D0] bg-white/80 p-8 backdrop-blur-sm">
                <Quote className="h-9 w-9 text-[#C9A227]" />
                <blockquote className="font-heading text-xl font-light leading-relaxed text-[#3D2A1D]">
                  “{s.quote}”
                </blockquote>
                <figcaption className="mt-auto border-t border-[#EFE2CE] pt-4">
                  <p className="font-heading text-lg text-[#271A12]">{s.name}</p>
                  <p className="text-sm text-[#7A6A59]">{s.sub}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ──────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#7C2D12] via-[#9A3412] to-[#EA580C] px-8 py-16 text-center shadow-xl sm:px-16 sm:py-24">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-56 w-56 rounded-full bg-[#FCD34D]/10 blur-3xl" />
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Bring PixPresent to your event
          </span>
          <h2
            className="mx-auto mt-6 max-w-2xl font-heading font-light leading-[1.05] text-white"
            style={{ fontSize: "clamp(2.25rem,4vw,3.75rem)" }}
          >
            ให้ทุกคนในงานได้เจอรูปของตัวเอง
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/80 sm:text-base">
            สร้างงานแรกได้ฟรี ใช้เวลาไม่กี่นาที — เชื่อมต่อ Google Drive, sync รูป
            แล้วแชร์ลิงก์ให้แขกได้เลย
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
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
      </Reveal>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="border-t border-[#EBDFC9] bg-[#FDFBF7]">
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
          <Link href="/login" className="transition-colors hover:text-[#A16207]">
            เข้าสู่ระบบ
          </Link>
          <a href="#" className="transition-colors hover:text-[#A16207]">
            Privacy
          </a>
          <a href="#" className="transition-colors hover:text-[#A16207]">
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
  const wrap = align === "center" ? "mx-auto items-center text-center" : "items-start text-left";
  return (
    <div className={`flex max-w-2xl flex-col gap-4 ${wrap}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#A16207]">
        {badge}
      </span>
      <h2
        className="font-heading font-light leading-[1.05] tracking-tight text-[#271A12]"
        style={{ fontSize: "clamp(2.25rem,4vw,3.75rem)" }}
      >
        {title}
      </h2>
      {sub && <p className="text-base leading-relaxed text-[#5C4A3A]">{sub}</p>}
    </div>
  );
}
