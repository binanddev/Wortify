import { t as tr, useLocale } from "../../i18n/index.js";
import { Link, Icon } from "../../components/ui/ui.jsx";
const places = [
 ["flashcard", "cards", "Flashcards", "Card collection"],
 ["practice", "book", "Practice", "Quest board"],
 ["explore", "search", "Explore", "World map"],
 ["create", "edit", "Create", "Workshop"],
 ["profile", "user", "Journey", "Character journal"],
 ["classes", "class", "Classes", "Party hall"],
 ["settings", "settings", "Settings", "Game settings"],
];
export default function ThemeTrail({ theme, lang, section }) {
  useLocale();
 const rpg = theme === "rpg";
 return <details className="theme-trail" open={section === "flashcard" || section === "profile"}>
  <summary><span className="theme-trail-title">{rpg ? tr("Adventure journal") : tr("My study notebook")}</span><span>{rpg ? tr("Quick travel") : tr("Open tabs")}</span></summary>
  <nav aria-label={rpg ? tr("Adventure destinations") : tr("Notebook tabs")}>
   {places.map(([path,icon,label,quest]) => <Link key={path} to={`/${lang}/${path}`} aria-current={section === path ? "page" : undefined} title={tr(label)}><Icon name={icon}/><span>{tr(rpg ? quest : label)}</span></Link>)}
  </nav>
 </details>;
}
