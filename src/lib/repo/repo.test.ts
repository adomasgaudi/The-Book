import { describe, expect, it } from "vitest";
import { latestStamp } from "./repo";
describe("latestStamp", () => {
  it("picks the newest yyyy-MM-dd stamp and ignores junk", () => {
    expect(latestStamp(["2026-09-18 10:00", "", "abc", "2026-09-20 17:57", undefined, "2026-09-20"])).toBe("2026-09-20 17:57");
    expect(latestStamp([])).toBe("");
  });
});
