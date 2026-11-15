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
  taglineEn: string;
  taglineAr: string;
  features: string[];
  monthlyFee: number; // EUR
}

export const PROFESSIONS: Profession[] = [
  { key: "fahrschule", nameDe: "Fahrschule", nameEn: "Driving School", nameAr: "مدرسة سياقة", icon: "🚗", color: "#2563eb", taglineDe: "Schüler, Trainer, Fahrzeuge & Theorie-Fortschritt", taglineEn: "Students, instructors, vehicles & theory progress", taglineAr: "طلاب ومدربون ومركبات وتقدم النظري", features: ["Theorie-API", "Fahrstunden-Tracking", "Autobahn/Nacht/Überland", "Erinnerungen"], monthlyFee: 49 },
  { key: "friseur", nameDe: "Friseur / Salon", nameEn: "Hair Salon", nameAr: "صالون حلاقة", icon: "✂️", color: "#db2777", taglineDe: "Online-Termine, Services & Kartenzahlung am Terminal", taglineEn: "Online booking, services & card payments", taglineAr: "حجز أونلاين وخدمات ودفع بالبطاقة", features: ["Online-Buchung", "Service-Katalog", "Terminal-Payment"], monthlyFee: 29 },
  { key: "kiosk", nameDe: "Kiosk / Supermarkt", nameEn: "Kiosk / Supermarket", nameAr: "كشك / سوبرماركت", icon: "🛒", color: "#16a34a", taglineDe: "Barcode-Kasse, Lager & Low-Stock-Alarm", taglineEn: "Barcode checkout, inventory & low-stock alerts", taglineAr: "كاشير بالباركود ومخزون وتنبيهات النقص", features: ["Barcode-POS", "Lagerwarnung", "KI-Nachbestellung"], monthlyFee: 39 },
  { key: "design", nameDe: "Designagentur", nameEn: "Design Agency", nameAr: "شركة تصميم", icon: "🎨", color: "#7c3aed", taglineDe: "Kunden, Projekte, Tasks & Deadlines", taglineEn: "Clients, projects, tasks & deadlines", taglineAr: "عملاء ومشاريع ومهام ومواعيد تسليم", features: ["Projektmanagement", "Deadline-Reminder", "Angebot → Rechnung"], monthlyFee: 59 },
  { key: "steuerbuero", nameDe: "Steuerbüro", nameEn: "Tax Office", nameAr: "مكتب محاسبة", icon: "🧾", color: "#0f766e", taglineDe: "Mandanten-Mappe, DATEV-Export & fehlende Belege", taglineEn: "Client files, DATEV export & missing receipts", taglineAr: "ملفات العملاء وتصدير DATEV والإيصالات الناقصة", features: ["Accountant ID", "DATEV-Export", "Mandantenportal"], monthlyFee: 79 },
  { key: "bekleidung", nameDe: "Bekleidung", nameEn: "Clothing Store", nameAr: "محلات الألبسة", icon: "👕", color: "#ea580c", taglineDe: "Varianten nach Größe & Farbe, Barcode auf jedem Teil", taglineEn: "Size & colour variants, barcode on every item", taglineAr: "مقاسات وألوان وباركود لكل قطعة", features: ["Größe/Farbe-Varianten", "Barcode", "Lager pro Variante"], monthlyFee: 39 },
  { key: "praxis", nameDe: "Praxis / Zahnarzt", nameEn: "Medical / Dental Practice", nameAr: "عيادة", icon: "🩺", color: "#0891b2", taglineDe: "Warteschlangen-Tickets, Termine & Patientenakte", taglineEn: "Queue tickets, appointments & patient files", taglineAr: "تذاكر انتظار ومواعيد وملفات المرضى", features: ["Ticket-Queue", "Wartezimmer-Anzeige", "Art. 9 DSGVO"], monthlyFee: 69 },
  { key: "apotheke", nameDe: "Apotheke", nameEn: "Pharmacy", nameAr: "صيدلية", icon: "💊", color: "#dc2626", taglineDe: "Online-Bestellung, Rezept-Hinweis & saisonale Tipps", taglineEn: "Online orders, prescription flow & seasonal tips", taglineAr: "طلبات أونلاين ووصفات طبية ونصائح موسمية", features: ["Online-Order-Link", "Rezept-Flow", "Saison-Tipps"], monthlyFee: 59 },
  { key: "kuenstler", nameDe: "Künstler", nameEn: "Artists & Musicians", nameAr: "فنانون ومطربون", icon: "🎤", color: "#9333ea", taglineDe: "Gigs, Verträge, Anzahlung & Rechnungen", taglineEn: "Gigs, contracts, deposits & invoices", taglineAr: "حفلات وعقود وعربون وفواتير", features: ["Gig-Kalender", "Verträge", "Anzahlung-Tracking"], monthlyFee: 29 },
  { key: "restaurant", nameDe: "Restaurant", nameEn: "Restaurant", nameAr: "مطعم", icon: "🍽️", color: "#b45309", taglineDe: "Speisekarte, Kasse & Lieferando/Uber Eats/Wolt", taglineEn: "Menu, POS & delivery platform orders", taglineAr: "قائمة طعام وكاشير وطلبات منصات التوصيل", features: ["Menü-Verwaltung", "Multi-Plattform-Orders", "Kasse"], monthlyFee: 49 },
  { key: "beauty", nameDe: "Beauty / Nagelstudio", nameEn: "Beauty / Nail Studio", nameAr: "تجميل / أظافر", icon: "💅", color: "#ec4899", taglineDe: "Termine mit E-Mail an den Inhaber bei jeder Buchung", taglineEn: "Bookings with instant owner notifications", taglineAr: "حجوزات مع إشعار فوري للمالك", features: ["Online-Termine", "Service-Preise", "Inhaber-Alert"], monthlyFee: 29 },
  { key: "buchhandlung", nameDe: "Buchhandlung", nameEn: "Bookstore", nameAr: "مكتبة", icon: "📚", color: "#65a30d", taglineDe: "Online-Shop & Bücher-Ausleihe mit Mahnung & Strafe", taglineEn: "Online shop & library loans with late fees", taglineAr: "متجر أونلاين وإعارة كتب مع غرامات التأخير", features: ["Online-Shop", "Ausleihe", "Verspätungsgebühr"], monthlyFee: 39 },
  { key: "schule", nameDe: "Schule", nameEn: "School", nameAr: "مدرسة", icon: "🎓", color: "#4f46e5", taglineDe: "Klassen, Stundenpläne, Hausaufgaben & Ankündigungen", taglineEn: "Classes, timetables, homework & announcements", taglineAr: "صفوف وجداول وواجبات وإعلانات", features: ["Stundenplan", "Hausaufgaben", "Minderjährigenschutz"], monthlyFee: 69 },
  { key: "baeckerei", nameDe: "Bäckerei", nameEn: "Bakery", nameAr: "فرن / مخبز", icon: "🥖", color: "#d97706", taglineDe: "Mehl → Brot-Menge nach Rezept, Einkauf & Gewinn", taglineEn: "Recipe-based flour planning, purchasing & profit", taglineAr: "تخطيط الطحين حسب الوصفة والمشتريات والأرباح", features: ["Rezept-Rechner", "Einkauf/Verkauf", "Gewinn"], monthlyFee: 39 },
];

export const professionByKey = (k: string) => PROFESSIONS.find((p) => p.key === k) ?? PROFESSIONS[0];
export const professionName = (p: Profession, lang: "de" | "en" | "ar") => (lang === "en" ? p.nameEn : lang === "ar" ? p.nameAr : p.nameDe);
export const professionTagline = (p: Profession, lang: "de" | "en" | "ar") => (lang === "en" ? p.taglineEn : lang === "ar" ? p.taglineAr : p.taglineDe);

