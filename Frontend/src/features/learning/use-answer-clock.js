import { useEffect, useRef } from "react";
import { ActiveClock } from "./active-clock.js";
export function useAnswerClock(key, enabled = true) {
  const root = useRef(null),
    clock = useRef(new ActiveClock());
  useEffect(() => {
    const current = new ActiveClock();
    clock.current = current;
    let visible = true;
    const update = () =>
      enabled && visible && !document.hidden
        ? current.resume()
        : current.pause();
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting;
              update();
            },
            { threshold: 0.25 },
          )
        : null;
    if (root.current) observer?.observe(root.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      current.pause();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [key, enabled]);
  return { root, read: () => clock.current.read() };
}
