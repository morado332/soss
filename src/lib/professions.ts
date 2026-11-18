// 14 professions — each is an independent Module (Section 10).
// Adding a new profession = add one entry here + its module page. No core changes.
export type ProfessionKey =
  | "fahrschule" | "friseur" | "kiosk" | "design" | "steuerbuero" | "bekleidung"
  | "praxis" | "apotheke" | "kuenstler" | "restaurant" | "beauty" | "buchhandlung" | "schule" | "baeckerei"
  | "supermarkt" | "allgemein" | "haendler" | "bau" | "immobilien" | "cafe";

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
  { key: "kiosk", nameDe: "Kiosk", nameEn: "Kiosk", nameAr: "كشك", icon: "🛒", color: "#16a34a", taglineDe: "Barcode-Kasse, Lager & Low-Stock-Alarm", taglineEn: "Barcode checkout, inventory & low-stock alerts", taglineAr: "كاشير بالباركود ومخزون وتنبيهات النقص", features: ["Barcode-POS", "Lagerwarnung", "KI-Nachbestellung"], monthlyFee: 39 },
  { key: "design", nameDe: "Designagentur", nameEn: "Design Agency", nameAr: "شركة تصميم", icon: "🎨", color: "#7c3aed", taglineDe: "Kunden, Projekte, Tasks & Deadlines", taglineEn: "Clients, projects, tasks & deadlines", taglineAr: "عملاء ومشاريع ومهام ومواعيد تسليم", features: ["Projektmanagement", "Deadline-Reminder", "Angebot → Rechnung"], monthlyFee: 59 },
  { key: "steuerbuero", nameDe: "Steuerbüro", nameEn: "Tax Office", nameAr: "مكتب محاسبة", icon: "🧾", color: "#0f766e", taglineDe: "Mandanten-Mappe, DATEV-Export & fehlende Belege", taglineEn: "Client files, DATEV export & missing receipts", taglineAr: "ملفات العملاء وتصدير DATEV والإيصالات الناقصة", features: ["Accountant ID", "DATEV-Export", "Mandantenportal"], monthlyFee: 79 },
  { key: "bekleidung", nameDe: "Bekleidung", nameEn: "Clothing Store", nameAr: "محلات الألبسة", icon: "👕", color: "#ea580c", taglineDe: "Varianten nach Größe & Farbe, Barcode auf jedem Teil", taglineEn: "Size & colour variants, barcode on every item", taglineAr: "مقاسات وألوان وباركود لكل قطعة", features: ["Größe/Farbe-Varianten", "Barcode", "Lager pro Variante"], monthlyFee: 39 },
  { key: "praxis", nameDe: "Praxis / Klinik", nameEn: "Clinic / Practice", nameAr: "عيادة", icon: "🩺", color: "#0891b2", taglineDe: "Schnellaufnahme, Patienten, Rezepte, Labor & Termine", taglineEn: "Quick reception, patients, prescriptions, lab & appointments", taglineAr: "استقبال سريع ومرضى وروشتات وتحاليل ومواعيد", features: ["Schnellaufnahme", "Patientenakte", "Rezepte & Labor", "Art. 9 DSGVO"], monthlyFee: 69 },
  { key: "apotheke", nameDe: "Apotheke", nameEn: "Pharmacy", nameAr: "صيدلية", icon: "💊", color: "#dc2626", taglineDe: "Online-Bestellung, Rezept-Hinweis & saisonale Tipps", taglineEn: "Online orders, prescription flow & seasonal tips", taglineAr: "طلبات أونلاين ووصفات طبية ونصائح موسمية", features: ["Online-Order-Link", "Rezept-Flow", "Saison-Tipps"], monthlyFee: 59 },
  { key: "kuenstler", nameDe: "Künstler", nameEn: "Artists & Musicians", nameAr: "فنانون ومطربون", icon: "🎤", color: "#9333ea", taglineDe: "Gigs, Verträge, Anzahlung & Rechnungen", taglineEn: "Gigs, contracts, deposits & invoices", taglineAr: "حفلات وعقود وعربون وفواتير", features: ["Gig-Kalender", "Verträge", "Anzahlung-Tracking"], monthlyFee: 29 },
  { key: "restaurant", nameDe: "Restaurant", nameEn: "Restaurant", nameAr: "مطعم", icon: "🍽️", color: "#b45309", taglineDe: "Speisekarte, Kasse & Lieferando/Uber Eats/Wolt", taglineEn: "Menu, POS & delivery platform orders", taglineAr: "قائمة طعام وكاشير وطلبات منصات التوصيل", features: ["Menü-Verwaltung", "Multi-Plattform-Orders", "Kasse"], monthlyFee: 49 },
  { key: "beauty", nameDe: "Beauty / Nagelstudio", nameEn: "Beauty / Nail Studio", nameAr: "تجميل / أظافر", icon: "💅", color: "#ec4899", taglineDe: "Termine mit E-Mail an den Inhaber bei jeder Buchung", taglineEn: "Bookings with instant owner notifications", taglineAr: "حجوزات مع إشعار فوري للمالك", features: ["Online-Termine", "Service-Preise", "Inhaber-Alert"], monthlyFee: 29 },
  { key: "buchhandlung", nameDe: "Buchhandlung", nameEn: "Bookstore", nameAr: "مكتبة", icon: "📚", color: "#65a30d", taglineDe: "Online-Shop & Bücher-Ausleihe mit Mahnung & Strafe", taglineEn: "Online shop & library loans with late fees", taglineAr: "متجر أونلاين وإعارة كتب مع غرامات التأخير", features: ["Online-Shop", "Ausleihe", "Verspätungsgebühr"], monthlyFee: 39 },
  { key: "schule", nameDe: "Schule", nameEn: "School", nameAr: "مدرسة", icon: "🎓", color: "#4f46e5", taglineDe: "Klassen, Stundenpläne, Hausaufgaben & Ankündigungen", taglineEn: "Classes, timetables, homework & announcements", taglineAr: "صفوف وجداول وواجبات وإعلانات", features: ["Stundenplan", "Hausaufgaben", "Minderjährigenschutz"], monthlyFee: 69 },
  { key: "baeckerei", nameDe: "Bäckerei", nameEn: "Bakery", nameAr: "فرن / مخبز", icon: "🥖", color: "#d97706", taglineDe: "Mehl → Brot-Menge nach Rezept, Einkauf & Gewinn", taglineEn: "Recipe-based flour planning, purchasing & profit", taglineAr: "تخطيط الطحين حسب الوصفة والمشتريات والأرباح", features: ["Rezept-Rechner", "Einkauf/Verkauf", "Gewinn"], monthlyFee: 39 },
  { key: "supermarkt", nameDe: "Supermarkt", nameEn: "Supermarket", nameAr: "سوبر ماركت", icon: "🏪", color: "#15803d", taglineDe: "Barcode-Kasse, Lieferanten, Einkauf & Haltbarkeit", taglineEn: "Barcode POS, suppliers, purchasing & expiry dates", taglineAr: "كاشير بالباركود وموردون ومشتريات وتواريخ صلاحية", features: ["Barcode", "Haltbarkeit", "Einkauf", "Schulden-Alter"], monthlyFee: 49 },
  { key: "cafe", nameDe: "Cafeteria / Café", nameEn: "Cafeteria / Café", nameAr: "كافتيريا", icon: "☕", color: "#92400e", taglineDe: "Kasse, Menü, Tische, Aktionen & Personal", taglineEn: "POS, menu, tables, promotions & staff", taglineAr: "كاشير ومنيو وطاولات وعروض وموظفون", features: ["Menü-Bereiche", "Tische", "Aktionen", "Anwesenheit"], monthlyFee: 39 },
  { key: "allgemein", nameDe: "Allgemeines Unternehmen", nameEn: "General Business", nameAr: "أعمال عامة", icon: "🏢", color: "#475569", taglineDe: "Kunden, Projekte, Belege, Abschläge & Einkauf", taglineEn: "Customers, projects, vouchers, progress bills & purchasing", taglineAr: "عملاء ومشاريع وسندات ومستخلصات ومشتريات", features: ["Projekte", "Abschlagsrechnungen", "Belege"], monthlyFee: 49 },
  { key: "haendler", nameDe: "Händler / Großhandel", nameEn: "Trader / Wholesale", nameAr: "تاجر", icon: "⚖️", color: "#a16207", taglineDe: "Tagespreise, Lager, Lieferanten & offene Posten", taglineEn: "Daily prices, stock, suppliers & receivables", taglineAr: "سعر اليوم ومخزون وموردون وديون", features: ["Tagespreis", "Einkauf", "Schulden-Alter"], monthlyFee: 39 },
  { key: "bau", nameDe: "Bauunternehmen", nameEn: "Construction", nameAr: "مقاولات", icon: "🏗️", color: "#c2410c", taglineDe: "Projekte, Abschlagsrechnungen, Material & Lieferanten", taglineEn: "Projects, progress bills, materials & suppliers", taglineAr: "مشاريع ومستخلصات ومواد وموردون", features: ["Projekte", "Abschläge", "Material-Lager"], monthlyFee: 69 },
  { key: "immobilien", nameDe: "Immobilien", nameEn: "Real Estate", nameAr: "عقارات", icon: "🏠", color: "#0e7490", taglineDe: "Objekte, Verkäufer, Käufer & Besichtigungen", taglineEn: "Properties, sellers, buyers & viewings", taglineAr: "عقارات وبائعون ومشترون ومعاينات", features: ["Objekt-Bestand", "Besichtigungen", "Projekte"], monthlyFee: 59 },
];

export const professionByKey = (k: string) => PROFESSIONS.find((p) => p.key === k) ?? PROFESSIONS[0];
export const professionName = (p: Profession, lang: "de" | "en" | "ar") => (lang === "en" ? p.nameEn : lang === "ar" ? p.nameAr : p.nameDe);
export const professionTagline = (p: Profession, lang: "de" | "en" | "ar") => (lang === "en" ? p.taglineEn : lang === "ar" ? p.taglineAr : p.taglineDe);

