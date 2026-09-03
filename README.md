# Offertenvergleich

Web-App zum Vergleichen von Subunternehmer- und Lieferanten-Offerten (PDF) nach NPK-Position.

- Läuft komplett im Browser, es werden keine Dateien an einen Server geschickt. Projekte (inkl. der
  Original-PDFs) werden lokal per IndexedDB gespeichert und bleiben nach einem Neuladen erhalten.
- Ein Hauptprojekt kann mehrere Unterprojekte/Bereiche enthalten (z.B. verschiedene NPK-Kapitel), jeder
  Bereich hat eigene Offerten und einen eigenen Vergleich.
- PDFs werden automatisch nach Positionen (NPK-Nr., Bezeichnung, Menge, Einheit, Einheitspreis, Total)
  durchsucht. Automatisch erkannte Zeilen sind gelb markiert und lassen sich direkt in der Tabelle
  korrigieren.
- Eingescannte PDFs ohne Textebene werden automatisch per Texterkennung (OCR) gelesen (Worker, WASM-Engine
  und deutsche Sprachdaten liegen lokal in `public/tesseract/`, kein externes CDN nötig). OCR-Ergebnisse
  sind deutlich unzuverlässiger als normale Text-PDFs, besonders bei Zahlen aus schlecht gescannten
  Tabellen - die App markiert solche Offerten und die Werte sollten gegen das Original-PDF geprüft werden.
- Positionen werden über alle Offerten anhand der NPK-Nummer automatisch gruppiert; falsch zugeordnete
  Zeilen lassen sich über ein Auswahlfeld in der Vergleichstabelle manuell umhängen.
- Jede Zeile lässt sich per Klick auf "PDF" bis zur Original-Seite im Quell-PDF zurückverfolgen.
- Der Vergleich lässt sich als Excel-Datei exportieren.

## Entwicklung

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
