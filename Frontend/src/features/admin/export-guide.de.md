# Admin-Anleitung: Daten exportieren und wiederherstellen

Wortify 1.14.0. Nur aktive Superuser können Website-Exporte erstellen.

## Werkzeug öffnen und Vorlage wählen

Als Admin anmelden → Verwaltung → Sicherung & Import. Der Website-Export steht oberhalb des separaten Notfall-Exports und Kontoimports. Diese Anleitung lässt sich hier lesen und herunterladen.

- Alle Lerninhalte: sämtliche Konten, öffentliche und private Karteikarten, Übungen/Theorie, Lesetexte und gespeicherte Medien. Enthält auch Systemquellen ohne Kontozuordnung. Ohne Kontoprofile und persönlichen Lernverlauf.
- Öffentliche Lerninhalte: öffentliche Inhalte und noch nicht übernommene öffentliche Systemlesetexte. Private übergeordnete Ordner behalten nur Struktur und Namen.
- Inhalte und Konten: Identitäten, Profile, Einstellungen, Gruppen/Berechtigungen, Klassen und optional Fortschritt/Verwaltungsprotokoll. Passwort-Hashes bleiben standardmäßig ausgeschaltet.
- Nur Konten: Konten, Profile, Lerneinstellungen, Designs und Berechtigungen ohne Lerninhalte. Medien einschalten, um Profil-/Designbilder zu behalten.

Für ein vollständiges Lernarchiv alle Konten, Bereiche und Sprachen sowie beide Sichtbarkeiten wählen, Datumsfilter leer lassen und Medien einschalten. Für einen Lernenden Inhalte und Konten wählen, das Konto markieren und bei Bedarf den Fortschritt aktivieren.

## Filter und Kontenauswahl

Practice umfasst alle Übungs- und Theoriearten einschließlich Diktat. Es gibt keine getrennten Grammatik-/Hören-/Schreiben-/Sprechen-Filter. Antwortvarianten, Erklärungen, verschachtelte Aufgaben, Reihenfolge und Ordnerstruktur bleiben erhalten.

Datumsfilter verwenden die letzte Änderung, ersatzweise das Erstellungsdatum. Tabellen ohne Datum werden nicht nach Datum gefiltert. Zugehörige Datensätze und übergeordnete Ordner dürfen außerhalb des Zeitraums liegen. Diese Filter erzeugen keine automatisch zusammenführbare inkrementelle Sicherung.

Alle Konten ignoriert die Kontosuche. Passende Konten berücksichtigt alle Treffer über sämtliche Seiten. Ausgewählte Konten behält Markierungen beim Seitenwechsel; Diese Seite auswählen markiert nur die sichtbare Seite.

Lerninhalte werden nach Eigentümer, Fortschritt nach Lernendem gefiltert. Fortschritt kann auf öffentliche Inhalte anderer Autoren verweisen, die nicht im Export liegen; reference/unresolved.json dokumentiert solche Verweise. Systemquellen sind nur bei Alle Konten enthalten, werden bei ausschließlich privaten Exporten weggelassen und auf gewählte Bereiche begrenzt. Quellen können bereits importierte Inhalte wiederholen; nicht doppelt als eigenständige Lektionen zählen.

## Zusätzliche Daten

Ohne Kontoidentitäten entfernt strukturierte Eigentümer-/Kontoverknüpfungen und persönlichen Verlauf. Inhalts-IDs bleiben erhalten. Freitext, Dateinamen und URLs können personenbezogene Angaben enthalten. Kontoverweise behalten bewahrt IDs; für vollständige Kontodatensätze Inhalte und Konten wählen.

Medien umfasst gespeicherte Uploads und erzeugte Karteikarten-Sprachdateien. Externe Bild-/Audio-URLs bleiben Links. Browser-Sprachausgabe und ausschließlich lokal gespeicherte Aufnahmen sind keine Serverdaten. Ein Export ohne Medien kann keine Dateiinhalte wiederherstellen.

Lernfortschritt benötigt Kontoverknüpfungen. Kontoweite LearningEvent-Ereignisse können über die gewählten Bereiche hinaus verweisen. Verwaltungsprotokolle sind bei Inhalte und Konten verfügbar. Passwort-Hashes müssen ausdrücklich gewählt werden; Klartextpasswörter werden nie exportiert. Ohne Hash ist nach Wiederherstellung ein neues Passwort nötig. Archive mit Konten/Hashes verschlüsselt und zugriffsbeschränkt aufbewahren.

## Prüfen und herunterladen

Export prüfen → Anzahlen und Hinweise kontrollieren → Dokumentierte ZIP herunterladen. Die Seite geöffnet lassen. Änderungen der Auswahl löschen die Vorschau. Nachträgliche Inhaltsänderungen können die endgültigen Anzahlen beeinflussen; das Manifest im ZIP ist maßgeblich. Der Export ändert keine Website-Inhalte und wird protokolliert.

Grenzen: 2 GiB entpackt, 500.000 Datensätze, weniger als 100.000 Dateien. Große Auswahlen nach Konten, Sprache oder Bereich aufteilen. Während großer Exporte Medien möglichst nicht bearbeiten/löschen.

## Inhalt des ZIP-Archivs

README.md ist der Einstieg. RESTORE.md und ANALYSIS.md erklären Wiederherstellung und Analyse. manifest.json enthält Zeitpunkt, Filter, Migrationen, Anzahlen und SHA-256-Prüfsummen. Bei Exporten ohne Kontoverknüpfung werden Kontosuchtext und ausgewählte Konto-IDs nicht gespeichert. SCHEMA.json beschreibt Felder und Beziehungen. INDEX.csv listet Dateien und Anzahlen. data/ enthält UTF-8-JSON mit ursprünglichen IDs und verschachtelten Inhalten. media/ enthält gewählte Dateiinhalte. reference/ dokumentiert Medienzuordnungen, externe Verweise und begrenzte Systemquellen.

Das vollständige ZIP aufbewahren. Daten anhand von Modell und ursprünglicher ID verknüpfen; verschachtelte Inhalte erhalten. Vor Wiederherstellung Prüfsummen kontrollieren.

## Wiederherstellung und Fehler

Das neue wortify-site-export-Format kann nicht im vorhandenen ZIP-Import hochgeladen werden. Eine zuständige Fachperson muss RESTORE.md folgen: passende Migrationen, isolierte Datenbank und Medienablage, Zuordnung der IDs/Konten/Berechtigungen sowie Prüfung vor Umstellung. Inhalte ohne Eigentümer benötigen ein Zielkonto.

Für die vorhandene Kontowiederherstellung den separaten Notfall-Export verwenden und portable Benutzer-ZIPs/Medien sowie bei Bedarf Passwort-Hashes einschalten. ZIP importieren → Konten/Berechtigungen prüfen → Wiederherstellung bestätigen. Vorhandene Benutzernamen blockieren den gesamten Import; es wird nichts überschrieben. Lerninhalte entstehen als private Kopien. Ohne Hash neue Passwörter setzen. Fehlende Berechtigungszuordnungen in alten Archiven erfordern einen neuen Export. Notfallimporte sind auf 512 MB und 1.000 Konten je Vorgang begrenzt; kontenübergreifende Verweise, Klassenmitgliedschaften, Protokolle und Sitzungen werden nicht unverändert wiederhergestellt.

Bei fehlenden Rechten als aktiver Admin anmelden. Bei leeren Ergebnissen Kontofilter ändern. Ungültige Datumsangaben korrigieren und mindestens einen Lernbereich wählen. Fehlende Mediendateien lassen den Export fehlschlagen: Speicher reparieren oder zunächst nur Metadaten sichern. Bei Größenlimits/Zeitüberschreitungen Auswahl teilen und erneut versuchen. Unvollständige Downloads oder falsche Prüfsummen nicht zur Wiederherstellung verwenden. Bei Importfehlern das ZIP-Format prüfen.

Quellcode, statische Dateien, Bereitstellungskonfiguration, Datenbank-Metadaten und Servergeheimnisse separat sichern. Sitzungen, Zurücksetzungstokens und Import-API-Schlüssel sind ausgeschlossen. Nach Wiederherstellung Berechtigungen, Sichtbarkeit, Antworten, Ordnerbäume, Medien und Fortschritt prüfen.
