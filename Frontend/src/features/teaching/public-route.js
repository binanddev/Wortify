const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const pattern = new RegExp(`^/(de|en)/classes/public/(${UUID})/?$`);
export function publicTeachingRoute(route) {
  const match = pattern.exec(route.split("?")[0]);
  return match ? { lang: match[1], token: match[2] } : null;
}
