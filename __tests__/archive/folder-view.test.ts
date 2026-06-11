import { describe, it, expect } from "vitest";
import { deriveFolderView } from "@/lib/archive/folder-view";

type P = { id: string; folder_path: string };
const photos: P[] = [
  { id: "a", folder_path: "" },
  { id: "b", folder_path: "พิธีเช้า" },
  { id: "c", folder_path: "พิธีเช้า" },
  { id: "d", folder_path: "พิธีเช้า/ช่วงเช้า" },
  { id: "e", folder_path: "ช่วงเย็น" },
];

describe("deriveFolderView", () => {
  it("at root: lists top folders with recursive counts + photos at root", () => {
    const v = deriveFolderView(photos, "");
    expect(v.photosHere.map((p) => p.id)).toEqual(["a"]);
    expect(v.subfolders).toEqual([
      { name: "พิธีเช้า", path: "พิธีเช้า", count: 3 },
      { name: "ช่วงเย็น", path: "ช่วงเย็น", count: 1 },
    ]);
  });

  it("inside a folder: lists its subfolders + photos directly in it", () => {
    const v = deriveFolderView(photos, "พิธีเช้า");
    expect(v.photosHere.map((p) => p.id)).toEqual(["b", "c"]);
    expect(v.subfolders).toEqual([{ name: "ช่วงเช้า", path: "พิธีเช้า/ช่วงเช้า", count: 1 }]);
  });

  it("leaf folder: photos, no subfolders", () => {
    const v = deriveFolderView(photos, "พิธีเช้า/ช่วงเช้า");
    expect(v.photosHere.map((p) => p.id)).toEqual(["d"]);
    expect(v.subfolders).toEqual([]);
  });
});
