import test from "node:test";
import assert from "node:assert/strict";
import {
  filterClassroomItems,
  deadlineState,
  localDeadlineInput,
  visibleAssignments,
  assignmentDueValue,
} from "../src/features/account/classroom-model.js";
test("classroom search matches multiple words and owners while retaining original titles", () => {
  const classes = [
    { title: "Deutsch A1", owner: "Frau Mai" },
    { title: "Deutsch B1", owner: "Herr An" },
    { title: "English A1", owner: "Frau Mai" },
  ];
  assert.deepEqual(filterClassroomItems(classes, " DEUTSCH  Mai "), [
    classes[0],
  ]);
  assert.equal(filterClassroomItems(classes, "").length, 3);
  assert.equal(
    filterClassroomItems([{ username: "MinhTien" }], "minh").length,
    1,
  );
});
test("assignment filters distinguish overdue, future and undated content without inventing completion", () => {
  const now = Date.parse("2026-10-28T10:00:00Z"),
    items = [
      { title: "Past practice", due_at: "2026-10-27T10:00:00Z" },
      { title: "Future practice", due_at: "2026-10-29T10:00:00Z" },
      { title: "Undated practice", due_at: null },
    ];
  assert.equal(deadlineState(items[0].due_at, now), "overdue");
  assert.equal(deadlineState(items[1].due_at, now), "scheduled");
  assert.equal(deadlineState(null, now), "none");
  assert.equal(deadlineState("bad-date", now), "none");
  assert.deepEqual(visibleAssignments(items, "practice", "overdue", now), [
    items[0],
  ]);
  assert.deepEqual(visibleAssignments(items, "future", "scheduled", now), [
    items[1],
  ]);
  assert.equal(visibleAssignments(items, "practice", "all", now).length, 3);
});
test("editing an unchanged deadline preserves its exact instant and clearing it remains optional", () => {
  const original = "2026-10-28T10:30:27.123Z",
    input = localDeadlineInput(original);
  assert.equal(assignmentDueValue(input, original), original);
  assert.equal(assignmentDueValue("", original), null);
  assert.equal(localDeadlineInput("bad-date"), "");
  const changed = "2026-10-29T14:35";
  assert.equal(
    new Date(assignmentDueValue(changed, original)).getTime(),
    new Date(changed).getTime(),
  );
  assert.throws(
    () => assignmentDueValue("invalid", original),
    /valid assignment deadline/,
  );
});
