const express = require("express");
const Database = require("better-sqlite3");
const path = require("node:path");

const app = express();
const db = new Database(path.join(__dirname, "db", "eventhub.db"), {
  fileMustExist: true
});
db.pragma("foreign_keys = ON");

const eventAbfrage = `
  SELECT e.id, e.name, e.beschreibung, e.datum, o.stadt,
         e.preis_cent, e.bild, e.alt_bild
  FROM events AS e
  JOIN orte AS o ON e.ort_id = o.id
  JOIN bundeslaender AS b ON o.bundesland_id = b.id
`;

const alleEvents = db.prepare(`${eventAbfrage} ORDER BY e.datum, e.id`);
const eventsNachBundesland = db.prepare(`
  ${eventAbfrage} WHERE b.name = ? ORDER BY e.datum, e.id
`);
const eventNachId = db.prepare(`${eventAbfrage} WHERE e.id = ?`);

app.get("/api/events", (req, res) => {
  const bundesland = req.query.bundesland ?? "";
  if (typeof bundesland !== "string") {
    return res.status(400).json({ fehler: "Bitte genau ein Bundesland angeben." });
  }

  const events = bundesland === ""
    ? alleEvents.all()
    : eventsNachBundesland.all(bundesland);

  res.json(events);
});

app.get("/api/events/:id", (req, res) => {
  const event = eventNachId.get(req.params.id);
  if (!event) {
    return res.status(404).json({ fehler: "Event nicht gefunden." });
  }

  res.json(event);
});

app.use(express.static(path.join(__dirname, "public")));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`EventHub läuft unter http://localhost:${port}`);
});
