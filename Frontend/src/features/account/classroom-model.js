export function filterClassroomItems(items, query = "") {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) =>
    words.every((word) =>
      `${item.title || item.username || ""} ${item.owner || ""}`
        .toLocaleLowerCase()
        .includes(word),
    ),
  );
}
export function deadlineState(value, now = Date.now()) {
  if (!value) return "none";
  const due = Date.parse(value);
  if (!Number.isFinite(due)) return "none";
  return due < now ? "overdue" : "scheduled";
}
export function localDeadlineInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
export function visibleAssignments(items, query, filter, now = Date.now()) {
  return filterClassroomItems(items, query).filter(
    (item) => filter === "all" || deadlineState(item.due_at, now) === filter,
  );
}

export function assignmentDueValue(input, original) {
  if (!input) return null;
  if (original && input === localDeadlineInput(original)) return original;
  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error("Choose a valid assignment deadline.");
  return parsed.toISOString();
}
