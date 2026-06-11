import { describe, it, expect } from "vitest";
import { groupEventPeople } from "@/lib/people/queries";

describe("groupEventPeople", () => {
  it("groups photo ids per person and counts them", () => {
    const { people, photoIdsByPerson } = groupEventPeople([
      { personId: "p1", name: "พี่หนึ่ง", photoId: "a" },
      { personId: "p1", name: "พี่หนึ่ง", photoId: "b" },
      { personId: "p2", name: "น้องแพร", photoId: "a" },
    ]);
    expect(photoIdsByPerson).toEqual({ p1: ["a", "b"], p2: ["a"] });
    expect(people).toEqual([
      { id: "p1", name: "พี่หนึ่ง", count: 2 },
      { id: "p2", name: "น้องแพร", count: 1 },
    ]);
  });

  it("sorts by count desc, then name asc on ties", () => {
    const { people } = groupEventPeople([
      { personId: "b", name: "Bee", photoId: "1" },
      { personId: "a", name: "Ann", photoId: "2" },
    ]);
    expect(people.map((p) => p.id)).toEqual(["a", "b"]); // tie on count=1 → name asc
  });

  it("returns empty structures for no rows", () => {
    expect(groupEventPeople([])).toEqual({ people: [], photoIdsByPerson: {} });
  });
});
