import "./bio.css";
import { Globe, Send, MapPin, Phone, Mail, MessageCircle, Link2, ChevronRight, CalendarCheck, Music2 } from "lucide-react";

type IconC = (props: { className?: string }) => React.ReactNode;
const svg = (children: React.ReactNode): IconC => function BrandIcon({ className }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{children}</svg>;
};
const Instagram = svg(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></>);
const Facebook = svg(<path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H6.5v3.5H9V21h3.5v-8.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />);
const Youtube = svg(<><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" /></>);
const Linkedin = svg(<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5V16M8 7.5v.01M11.5 16v-5.5M11.5 13a2.5 2.5 0 0 1 5 0v3" /></>);
const XLogo = svg(<path d="M4 4l16 16M20 4 4 20" />);
type LucideIcon = IconC;

export type BioLink = { kind: string; label: string; url: string };
export type BioData = {
  display_name: string; headline?: string | null; bio?: string | null; avatar?: string | null; theme: string; links: BioLink[];
  phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null; address?: string | null;
};
const KIND_ICON: Record<string, LucideIcon> = { website: Globe, instagram: Instagram, facebook: Facebook, tiktok: Music2, youtube: Youtube, x: XLogo, linkedin: Linkedin, telegram: Send, maps: MapPin, custom: Link2 };

function Row({ href, icon: Icon, label, sub, external, ltr }: { href: string; icon: LucideIcon; label: string; sub?: string; external?: boolean; ltr?: boolean }) {
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})} className="bio-btn group flex w-full items-center justify-between rounded-2xl px-5 py-3.5">
      <span className="flex min-w-0 items-center gap-3.5">
        <span className="bio-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 text-start"><span className="block truncate text-sm font-semibold">{label}</span>{sub && <span dir={ltr ? "ltr" : undefined} className="bio-muted block truncate text-xs rtl:text-end">{sub}</span>}</span>
      </span>
      <ChevronRight className="bio-muted h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
    </a>
  );
}

/** The public profile card. Pure presentational: used for the public page and the live preview in the editor. */
export function BioCard({ p, labels, booking, children, footer, compact }: {
  p: BioData; labels: { call: string; whatsapp: string; email: string; website: string; address: string; book: string; bookSub: string };
  booking?: string | null; children?: React.ReactNode; footer?: React.ReactNode; compact?: boolean;
}) {
  const initials = p.display_name.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const wa = p.whatsapp?.replace(/[^0-9]/g, "");
  return (
    <div className={`bio flex w-full justify-center ${compact ? "min-h-[640px] rounded-3xl" : "min-h-dvh"}`} data-theme={p.theme}>
      <div className="bio-blob b1" /><div className="bio-blob b2" /><div className="bio-blob b3" />
      <div className="relative z-10 my-6 w-full max-w-[440px] p-4 sm:p-6">
        <div className="bio-glass flex flex-col items-center rounded-[44px] p-7 text-center sm:p-8">
          <div className="group relative mb-5">
            <div className="bio-ring absolute -inset-1 rounded-[32%] opacity-50 blur-lg transition duration-500 group-hover:opacity-85" />
            <div className="bio-avatar relative grid h-28 w-28 place-items-center overflow-hidden bg-white/10 p-1 sm:h-32 sm:w-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.avatar ? <img src={p.avatar} alt="" className="bio-avatar h-full w-full object-cover" /> : <span className="text-4xl font-bold">{initials}</span>}
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.display_name}</h1>
          {p.headline && <p className="mt-1 text-sm font-semibold">{p.headline}</p>}
          {p.bio && <p className="bio-muted mt-2 max-w-[320px] whitespace-pre-line text-xs leading-relaxed sm:text-sm">{p.bio}</p>}
          <div className="mt-7 w-full space-y-3.5">
            {booking && <Row href={booking} icon={CalendarCheck} label={labels.book} sub={labels.bookSub} />}
            {children}
            {p.links.map((l, i) => <Row key={i} href={l.url} icon={KIND_ICON[l.kind] ?? Link2} label={l.label} external />)}
            {p.phone && <Row href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`} icon={Phone} label={labels.call} sub={p.phone} ltr />}
            {wa && <Row href={`https://wa.me/${wa}`} icon={MessageCircle} label={labels.whatsapp} sub={p.whatsapp ?? ""} external ltr />}
            {p.email && <Row href={`mailto:${p.email}`} icon={Mail} label={labels.email} sub={p.email} />}
            {p.website && <Row href={p.website} icon={Globe} label={labels.website} sub={p.website.replace(/^https?:\/\//, "")} external />}
            {p.address && <Row href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`} icon={MapPin} label={labels.address} sub={p.address} external />}
          </div>
          {footer && <div className="bio-muted mt-8 text-xs font-medium">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
