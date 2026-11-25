"use strict";

(() => {
  const euroFormat = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  });

  const datumFormat = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  function formatiereDatum(wert) {
    // Lokale Mitternacht verhindert eine Verschiebung auf den Vortag.
    return datumFormat.format(new Date(wert + "T00:00:00"));
  }

  async function ladeJSON(adresse) {
    let antwort;

    try {
      antwort = await fetch(adresse);
    } catch {
      throw new Error(
        "Der Server ist nicht erreichbar. Bitte prüfe, ob er läuft."
      );
    }

    if (!antwort.ok) {
      const fehler = await antwort.json().catch(() => null);

      throw new Error(
        fehler?.fehler || "Die Daten konnten nicht geladen werden."
      );
    }

    return antwort.json();
  }

  function starteStartseite() {
    const bundeslandFeld = document.getElementById("bundesland");
    const kategorieFeld = document.getElementById("kategorie");
    const eventGrid = document.querySelector(".event-grid");

    const kartenVorlage = document
      .getElementById("event-karten-vorlage")
      .content.querySelector(".event-card");

    const filterStatus = document.getElementById("filter-status");
    const hinweis = document.getElementById("keine-events");
    const kategorieStatus = document.getElementById("kategorie-status");
    const vorschau = document.getElementById("auswahl-vorschau");

    let letzteAnfrage = 0;

    function erstelleKarte(event) {
      const karte = kartenVorlage.cloneNode(true);

      const bild = karte.querySelector(".event-image");
      bild.src = event.bild;
      bild.alt = event.alt_bild;

      const datum = karte.querySelector(".event-date");
      datum.dateTime = event.datum;
      datum.textContent = formatiereDatum(event.datum);

      karte.querySelector("h2").textContent = event.name;
      karte.querySelector(".event-city").textContent = event.stadt;

      karte.querySelector(".event-price").textContent =
        euroFormat.format(event.preis_cent / 100);

      const details = karte.querySelector(".details-button");
      details.href = "event.html?id=" + encodeURIComponent(event.id);
      details.setAttribute("aria-label", "Details zu " + event.name);

      return karte;
    }

    async function ladeEvents() {
      const anfrage = ++letzteAnfrage;

      const parameter = new URLSearchParams({
        bundesland: bundeslandFeld.value,
        kategorie: kategorieFeld.value
      });

      eventGrid.replaceChildren();
      eventGrid.setAttribute("aria-busy", "true");

      hinweis.textContent = "Events werden geladen …";
      hinweis.hidden = false;

      filterStatus.textContent = "Events werden geladen.";

      try {
        const events = await ladeJSON("/api/events?" + parameter);

        // Bei schnellem Filterwechsel zählt nur die neueste Anfrage.
        if (anfrage !== letzteAnfrage) return;

        if (!Array.isArray(events)) {
          throw new Error("Ungültige Serverantwort.");
        }

        for (const event of events) {
          eventGrid.append(erstelleKarte(event));
        }

        filterStatus.textContent = `${events.length} Events gefunden.`;

        hinweis.textContent =
          "Für diese Kombination aus Bundesland und Kategorie gibt es aktuell keine Events.";

        hinweis.hidden = events.length > 0;
      } catch {
        if (anfrage !== letzteAnfrage) return;

        eventGrid.replaceChildren();

        hinweis.textContent =
          "Die Events konnten nicht geladen werden. Bitte prüfe, ob der Server läuft, und versuche es erneut.";

        hinweis.hidden = false;
        filterStatus.textContent = hinweis.textContent;
      } finally {
        if (anfrage === letzteAnfrage) {
          eventGrid.setAttribute("aria-busy", "false");
        }
      }
    }

    async function ladeKategorien() {
      try {
        const kategorien = await ladeJSON("/api/kategorien");

        if (!Array.isArray(kategorien)) {
          throw new Error("Ungültige Serverantwort.");
        }

        const optionen = [new Option("Alle Kategorien", "")];

        for (const kategorie of kategorien) {
          optionen.push(
            new Option(kategorie.name, String(kategorie.id))
          );
        }

        kategorieFeld.replaceChildren(...optionen);
        kategorieFeld.disabled = false;
      } catch {
        kategorieFeld.replaceChildren(
          new Option("Kategorien nicht verfügbar", "")
        );

        kategorieStatus.textContent =
          "Die Kategorien konnten nicht geladen werden. Bitte lade die Seite neu, sobald der Server erreichbar ist.";

        kategorieStatus.hidden = false;
      }
    }

    bundeslandFeld.addEventListener("change", () => {
      vorschau.textContent = bundeslandFeld.value;
      ladeEvents();
    });

    kategorieFeld.addEventListener("change", ladeEvents);

    ladeEvents();
    ladeKategorien();
  }

  async function starteDetailseite() {
    const hauptinhalt = document.querySelector(".event-detail");
    const inhalt = document.getElementById("event-inhalt");
    const status = document.getElementById("detail-status");

    const parameter = new URLSearchParams(window.location.search);
    const ids = parameter.getAll("id");
    const id = ids[0] ?? "";

    function zeigeFehler(nachricht) {
      inhalt.hidden = true;

      status.textContent = nachricht;
      status.setAttribute("role", "alert");
      status.hidden = false;

      document.title = "Event konnte nicht geladen werden – EventHub";
    }

    if (ids.length === 0 || id === "") {
      zeigeFehler(
        "Es wurde keine Event-ID angegeben. Bitte wähle eine Veranstaltung in der Übersicht aus."
      );
      return;
    }

    if (
      ids.length !== 1
      || !/^[1-9]\d*$/.test(id)
      || !Number.isSafeInteger(Number(id))
    ) {
      zeigeFehler(
        "Die Event-ID ist ungültig. Bitte wähle eine Veranstaltung in der Übersicht aus."
      );
      return;
    }

    hauptinhalt.setAttribute("aria-busy", "true");

    try {
      const event = await ladeJSON(
        "/api/events/" + encodeURIComponent(id)
      );

      if (!event || Number(event.id) !== Number(id)) {
        throw new Error(
          "Die Serverantwort enthält nicht die angeforderte Veranstaltung."
        );
      }

      document.getElementById("detail-name").textContent = event.name;

      const datum = document.getElementById("detail-datum");
      datum.dateTime = event.datum;
      datum.textContent = formatiereDatum(event.datum);

      document.getElementById("detail-ort").textContent =
        event.ort ? event.ort + ", " + event.stadt : event.stadt;

      document.getElementById("detail-preis").textContent =
        euroFormat.format(event.preis_cent / 100) + " pro Ticket";

      document.getElementById("detail-text").textContent =
        event.beschreibung;

      const bild = document.getElementById("detail-bild");
      bild.src = event.bild;
      bild.alt = event.alt_bild;

      document.getElementById("detail-buchen").href =
        "buchung.html?id=" + encodeURIComponent(event.id);

      document.title = event.name + " – EventHub";

      inhalt.hidden = false;
      status.hidden = true;
    } catch (fehler) {
      zeigeFehler(
        fehler instanceof SyntaxError
          ? "Die Veranstaltungsdaten konnten nicht gelesen werden. Bitte versuche es erneut."
          : fehler.message
      );
    } finally {
      hauptinhalt.setAttribute("aria-busy", "false");
    }
  }

  if (document.getElementById("bundesland")) {
    starteStartseite();
  }

  if (document.getElementById("event-inhalt")) {
    starteDetailseite();
  }
})();