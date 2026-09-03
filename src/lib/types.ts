export interface PositionRow {
  id: string;
  /** NPK-Nummer bzw. Positionsnummer, z.B. "211.100" */
  code: string;
  description: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
  /** Seite im Original-PDF, auf der diese Zeile gefunden wurde (1-basiert) */
  page: number;
  /** Roh-Textzeile, wie sie im PDF extrahiert wurde (für Nachvollziehbarkeit) */
  rawText: string;
  /** true = automatisch erkannt und noch nicht von Hand geprüft */
  autoDetected: boolean;
}

export interface Offer {
  id: string;
  /** Name des Anbieters/Subunternehmers, z.B. Dateiname oder frei editierbar */
  name: string;
  fileName: string;
  /** Original-PDF als Bytes, für die Anzeige der Quelle */
  fileData: ArrayBuffer;
  pageCount: number;
  rows: PositionRow[];
  createdAt: number;
  /** true = mind. eine Seite hatte keine Textebene und wurde per OCR gelesen (weniger zuverlässig, besonders bei Zahlen) */
  ocrUsed?: boolean;
}

export interface MatchGroup {
  id: string;
  /** Führender NPK-Code der Gruppe (Referenz für die Vergleichstabelle) */
  code: string;
  description: string;
  /** offerId -> rowId, ordnet jeder Offerte höchstens eine Zeile dieser Gruppe zu */
  assignments: Record<string, string>;
}

/** Ein Bereich/Gewerk innerhalb eines Hauptprojekts, z.B. "132 Bohren und Trennen". */
export interface SubProject {
  id: string;
  name: string;
  offers: Offer[];
  groups: MatchGroup[];
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  subProjects: SubProject[];
  updatedAt: number;
}
