const express = require("express");
const Database = require("better-sqlite3");
const path = require("node:path");

const app = express();

const db = new Database(path.join(__dirname, "db", "eventhub.db"), {
  fileMustExist: true
});

db.pragma("foreign_keys = ON");

// Ort, Bundesland und Kategorie werden über ihre Fremdschlüssel verbunden.
const eventAbfrage = `
  SELECT e.id, e.name, e.beschreibung, e.datum,
         o.name AS ort, o.stadt, b.name AS bundesland,
         e.preis_cent, e.bild, e.alt_bild,
         e.kategorie_id, k.name AS kategorie
  FROM events AS e
  JOIN orte AS o ON e.ort_id = o.id
  JOIN bundeslaender AS b ON o.bundesland_id = b.id
  JOIN kategorie AS k ON e.kategorie_id = k.id
`;

// Ein leerer Filterwert lässt alle Bundesländer bzw. Kategorien zu.
const eventsMitFilter = db.prepare(`
  ${eventAbfrage}
  WHERE (@bundesland = '' OR b.name = @bundesland)
    AND (@kategorie = '' OR e.kategorie_id = @kategorie)
  ORDER BY e.datum, e.id
`);

const eventNachId = db.prepare(`
  ${eventAbfrage}
  WHERE e.id = ?
`);

const alleKategorien = db.prepare(`
  SELECT id, name
  FROM kategorie
  ORDER BY name
`);

function istGueltigeId(wert) {
  return typeof wert === "string"
    && /^[1-9]\d*$/.test(wert)
    && Number.isSafeInteger(Number(wert));
}

// Kategorien aus SQLite laden.
app.get("/api/kategorien", (req, res) => {
  res.json(alleKategorien.all());
});

// Veranstaltungen laden und optional filtern.
app.get("/api/events", (req, res) => {
  const bundesland = req.query.bundesland ?? "";
  const kategorie = req.query.kategorie ?? "";

  if (typeof bundesland !== "string") {
    return res.status(400).json({
      fehler: "Bitte genau ein Bundesland angeben."
    });
  }

  if (
    typeof kategorie !== "string"
    || (kategorie !== "" && !istGueltigeId(kategorie))
  ) {
    return res.status(400).json({
      fehler: "Bitte eine gültige Kategorie-ID angeben."
    });
  }

  const events = eventsMitFilter.all({
    bundesland,
    kategorie: kategorie === "" ? "" : Number(kategorie)
  });

  res.json(events);
});

// Eine einzelne Veranstaltung anhand ihrer ID laden.
app.get("/api/events/:id", (req, res) => {
  if (!istGueltigeId(req.params.id)) {
    return res.status(400).json({
      fehler: "Bitte eine gültige Event-ID angeben."
    });
  }

  const event = eventNachId.get(Number(req.params.id));

  if (!event) {
    return res.status(404).json({
      fehler: "Event nicht gefunden."
    });
  }

  res.json(event);
});

// Event 125 verweist in SQLite auf .jpg.
// Die vorhandene Bilddatei endet jedoch auf .jpeg.
// Datenbank und Bilddatei bleiben unverändert.
app.get("/images/Museumnacht.jpg", (req, res) => {
  res.sendFile("Museumnacht.jpeg", {
    root: path.join(__dirname, "public", "images")
  });
});

// HTML, CSS, JavaScript und Bilder ausliefern.
app.use(express.static(path.join(__dirname, "public")));

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`EventHub läuft unter http://localhost:${port}`);
});