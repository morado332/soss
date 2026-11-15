// 14 professions — each is an independent Module (Section 10).
// Adding a new profession = add one entry here + its module page. No core changes.
export type ProfessionKey =
  | "fahrschule" | "friseur" | "kiosk" | "design" | "steuerbuero" | "bekleidung"
  | "praxis" | "apotheke" | "kuenstler" | "restaurant" | "beauty" | "buchhandlung" | "schule" | "baeckerei";

export interface Profession {
  key: ProfessionKey;
  nameDe: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  color: string;
  taglineDe: string;
  features: string[];
  monthlyFee: number; // EUR
}

export const PROFESSIONS: Profession[] = [
  { key: "fahrschule", nameDe: "Fahrschule", nameEn: "Driving School", nameAr: "مدرسة سياقة", icon: "🚗", color: "#2563eb", taglineDe: "Schüler, Trainer, Fahrzeuge & Theorie-Fortschritt", features: ["Theorie-API", "Fahrstunden-Tracking", "Autobahn/Nacht/Überland", "Erinnerungen"], monthlyFee: 49 },
  { key: "friseur", nameDe: "Friseur / Salon", nameEn: "Hair Salon", nameAr: "صالون حلاقة", icon: "✂️", color: "#db2777", taglineDe: "Online-Termine, Services & Kartenzahlung am Terminal", features: ["Online-Buchung", "Service-Katalog", "Terminal-Payment"], monthlyFee: 29 },
  { key: "kiosk", nameDe: "Kiosk / Supermarkt", nameEn: "Kiosk / Supermarket", nameAr: "كشك / سوبرماركت", icon: "🛒", color: "#16a34a", taglineDe: "Barcode-Kasse, Lager & Low-Stock-Alarm", features: ["Barcode-POS", "Lagerwarnung", "KI-Nachbestellung"], monthlyFee: 39 },
  { key: "design", nameDe: "Designagentur", nameEn: "Design Agency", nameAr: "شركة تصميم", icon: "🎨", color: "#7c3aed", taglineDe: "Kunden, Projekte, Tasks & Deadlines", features: ["Projektmanagement", "Deadline-Reminder", "Angebot → Rechnung"], monthlyFee: 59 },
  { key: "steuerbuero", nameDe: "Steuerbüro", nameEn: "Tax Office", nameAr: "مكتب محاسبة", icon: "🧾", color: "#0f766e", taglineDe: "Mandanten-Mappe, DATEV-Export & fehlende Belege", features: ["Accountant ID", "DATEV-Export", "Mandantenportal"], monthlyFee: 79 },
  { key: "bekleidung", nameDe: "Bekleidung", nameEn: "Clothing Store", nameAr: "محلات الألبسة", icon: "👕", color: "#ea580c", taglineDe: "Varianten nach Größe & Farbe, Barcode auf jedem Teil", features: ["Größe/Farbe-Varianten", "Barcode", "Lager pro Variante"], monthlyFee: 39 },
  { key: "praxis", nameDe: "Praxis / Zahnarzt", nameEn: "Medical / Dental Practice", nameAr: "عيادة", icon: "🩺", color: "#0891b2", taglineDe: "Warteschlangen-Tickets, Termine & Patientenakte", features: ["Ticket-Queue", "Wartezimmer-Anzeige", "Art. 9 DSGVO"], monthlyFee: 69 },
  { key: "apotheke", nameDe: "Apotheke", nameEn: "Pharmacy", nameAr: "صيدلية", icon: "💊", color: "#dc2626", taglineDe: "Online-Bestellung, Rezept-Hinweis & saisonale Tipps", features: ["Online-Order-Link", "Rezept-Flow", "Saison-Tipps"], monthlyFee: 59 },
  { key: "kuenstler", nameDe: "Künstler", nameEn: "Artists & Musicians", nameAr: "فنانون ومطربون", icon: "🎤", color: "#9333ea", taglineDe: "Gigs, Verträge, Anzahlung & Rechnungen", features: ["Gig-Kalender", "Verträge", "Anzahlung-Tracking"], monthlyFee: 29 },
  { key: "restaurant", nameDe: "Restaurant", nameEn: "Restaurant", nameAr: "مطعم", icon: "🍽️", color: "#b45309", taglineDe: "Speisekarte, Kasse & Lieferando/Uber Eats/Wolt", features: ["Menü-Verwaltung", "Multi-Plattform-Orders", "Kasse"], monthlyFee: 49 },
  { key: "beauty", nameDe: "Beauty / Nagelstudio", nameEn: "Beauty / Nail Studio", nameAr: "تجميل / أظافر", icon: "💅", color: "#ec4899", taglineDe: "Termine mit E-Mail an den Inhaber bei jeder Buchung", features: ["Online-Termine", "Service-Preise", "Inhaber-Alert"], monthlyFee: 29 },
  { key: "buchhandlung", nameDe: "Buchhandlung", nameEn: "Bookstore", nameAr: "مكتبة", icon: "📚", color: "#65a30d", taglineDe: "Online-Shop & Bücher-Ausleihe mit Mahnung & Strafe", features: ["Online-Shop", "Ausleihe", "Verspätungsgebühr"], monthlyFee: 39 },
  { key: "schule", nameDe: "Schule", nameEn: "School", nameAr: "مدرسة", icon: "🎓", color: "#4f46e5", taglineDe: "Klassen, Stundenpläne, Hausaufgaben & Ankündigungen", features: ["Stundenplan", "Hausaufgaben", "Minderjährigenschutz"], monthlyFee: 69 },
  { key: "baeckerei", nameDe: "Bäckerei", nameEn: "Bakery", nameAr: "فرن / مخبز", icon: "🥖", color: "#d97706", taglineDe: "Mehl → Brot-Menge nach Rezept, Einkauf & Gewinn", features: ["Rezept-Rechner", "Einkauf/Verkauf", "Gewinn"], monthlyFee: 39 },
];

export const professionByKey = (k: string) => PROFESSIONS.find((p) => p.key === k) ?? PROFESSIONS[0];

export const CORE_MODULES = [
  { key: "appointments", nameDe: "Termine & Buchung", desc: "Kalender, Mitarbeiter, Dauer, Konflikt-Schutz, öffentlicher Buchungslink" },
  { key: "reminders", nameDe: "Automatische Erinnerung", desc: "E-Mail / SMS / WhatsApp 24h & 1h vor Termin" },
  { key: "pos", nameDe: "Kasse (POS)", desc: "Bar, Karte via Terminal, Online — Touch-optimiert" },
  { key: "terminal", nameDe: "Kartenterminal", desc: "Stripe Terminal / SumUp pro Geschäft, Stripe Connect Split" },
  { key: "products", nameDe: "Produkte & Lager", desc: "Barcode (USB/Kamera), Low-Stock-Alarm" },
  { key: "invoices", nameDe: "Rechnungen (GoBD)", desc: "PDF, sequenziell, Storno statt Löschen, TSE/Fiskaly" },
  { key: "accountant", nameDe: "Steuerberater", desc: "Monatsversand automatisch, DATEV, XRechnung/ZUGFeRD" },
  { key: "ai", nameDe: "KI-Berater", desc: "Wochen-/Monatsbericht aus eigenen Daten (Claude API)" },
  { key: "notifications", nameDe: "Benachrichtigungen", desc: "In-App + E-Mail" },
  { key: "reports", nameDe: "Berichte", desc: "Umsatz, Gewinn, Top-Mitarbeiter, Vormonatsvergleich" },
];
