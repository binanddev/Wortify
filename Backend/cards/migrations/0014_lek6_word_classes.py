from django.db import migrations
from django.utils import timezone


WORD_CLASSES = {
    "Cụm động từ": [
        'einen Termin einhalten',
        'außer Haus sein',
    ],
    "Động từ": [
        'beraten (er berät, hat beraten)',
        'klappen (Hier klappt gar nichts!)',
        'zurückkommen (er kommt zurück, ist zurückgekommen)',
        'erleben',
        'nutzen (eine Chance nutzen)',
        'bereuen (eine Entscheidung nicht bereuen)',
        'lächeln',
        'stören (Störe ich?)',
        'hinterlassen (er hinterlässt, hat hinterlassen) (eine Nachricht hinterlassen)',
        'ausrichten (Können Sie etwas ausrichten?)',
        'zurückrufen (er ruft zurück, hat zurückgerufen)',
        'zunehmen (er nimmt zu, hat zugenommen)',
        'mithelfen (er hilft mit, hat mitgeholfen)',
    ],
    "Động từ phản thân": [
        'sich beeilen',
        'sich konzentrieren',
        'sich verändern',
    ],
    "Cụm trạng từ": [
        'hin und zurück',
        'auf keinen Fall',
    ],
    "Tính từ": [
        'einfach (Nur einfach, bitte!)',
        'preiswert',
        'fantastisch',
        'professionell (eine professionelle Trainerin)',
        'beruflich',
        'komplett (beruflich komplett neu anfangen)',
        'selbstständig (sich selbstständig machen)',
        'erfolgreich',
        'finanziell (das finanzielle Risiko)',
        'deutlich (Sprechen Sie deutlich!)',
        'hektisch (nicht hektisch werden)',
        'virtuell',
        'erreichbar (immer erreichbar sein)',
        'fest (kein festes Büro haben)',
        'befristet (einen befristeten Vertrag haben)',
        'mobil',
        'lebenslang',
        'problemlos',
        'möglich (Ist das möglich?)',
        'häufig',
        'komisch',
        'unnötig',
        'schwanger',
    ],
    "Cụm danh từ": [
        'eine Fahrkarte für die Zweite Klasse',
    ],
    "Trạng từ": [
        'nebeneinander (zwei Plätze nebeneinander)',
        'mehr (Sie ist selbstständig und hat keinen Chef mehr.)',
        'nun (Was machen wir nun?)',
    ],
    "Câu hỏi": [
        'Wo möchten Sie sitzen: am Gang oder Fenster?',
    ],
    "Cụm từ": [
        'in Ordnung',
        'also gut',
    ],
    "Giới từ": [
        'unter (Reservierungen unter ...)',
    ],
    "Từ chỉ lượng": [
        'einige',
    ],
    "Danh từ": [
        'die Tätigkeit',
        'der Ärger (Sg.)',
        'die Bahn, -en',
        'der Fahrplan, -e',
        'die Zugverbindung, -en',
        'die Durchsage, -n',
        'der Wagen, -',
        'die Geschäftsreise, -n',
        'der Schalter, -',
        'die Hinfahrt (Sg.)',
        'die Rückfahrt (Sg.)',
        'die Klasse, -n',
        'der Gang, -e',
        'die Ermäßigung, -en',
        'die Band, -s',
        'der Musiker, -',
        'die Sängerin, -nen',
        'das Album, Alben',
        'der Trainer, -',
        'der Berufswunsch, -e',
        'der Neuanfang, -e',
        'die Chance, -n',
        'die Umwelt (Sg.)',
        'das Plastik (Sg.)',
        'das Gehalt, -er',
        'das Risiko, Risiken',
        'die Übersetzerin, -nen',
        'der Chirurg, -en',
        'das Herz, -en',
        'die Oberärztin, -nen',
        'der Leiter, -',
        'der Lastwagen, -',
        'der Lkw, -s',
        'die Freiheit (Sg.)',
        'das Telefonat, -e',
        'der Anrufer, -',
        'der Anrufbeantworter, -',
        'das Blatt, -er (ein Blatt Papier bereitlegen)',
        'der Arbeitstag, -e',
        'der Betrieb, -e',
        'die Fabrik, -en',
        'die Maschine, -n',
        'der Roboter, -',
        'die Digitalisierung (Sg.)',
        'der Austausch (Sg.)',
        'die Zusammenarbeit (Sg.)',
        'das Wissen (Sg.)',
        'die Kompetenz, -en',
        'die Hausarbeit, -en',
        'das Bier, -e',
        'der Schritt, -e',
        'der Feiertag, -e',
        'das Jahrhundert, -e',
    ],
}


def fill_word_classes(apps, schema_editor):
    cards = apps.get_model("cards", "Card").objects.using(schema_editor.connection.alias)
    missing = cards.filter(deck__language="de", deck__title="Lek 6", part_of_speech="")
    now = timezone.now()
    for label, terms in WORD_CLASSES.items():
        missing.filter(german_text__in=terms).update(part_of_speech=label, updated_at=now)


class Migration(migrations.Migration):
    dependencies = [("cards", "0013_deck_operation")]
    operations = [migrations.RunPython(fill_word_classes, migrations.RunPython.noop)]
