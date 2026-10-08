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
 const rpg = theme === "rpg";
 return <details className="theme-trail" open={section === "flashcard" || section === "profile"}>
  <summary><span className="theme-trail-title">{rpg ? "Adventure journal" : "My study notebook"}</span><span>{rpg ? "Quick travel" : "Open tabs"}</span></summary>
  <nav aria-label={rpg ? "Adventure destinations" : "Notebook tabs"}>
   {places.map(([path,icon,label,quest]) => <Link key={path} to={`/${lang}/${path}`} aria-current={section === path ? "page" : undefined} title={label}><Icon name={icon}/><span>{rpg ? quest : label}</span></Link>)}
  </nav>
 </details>;
}
