import { describe, expect, test } from "bun:test";
import { parseCfInput } from "./problems";

describe("parseCfInput", () => {
  test("parses standard Codeforces contest URLs", () => {
    expect(
      parseCfInput("https://codeforces.com/contest/1/problem/A", "cpp")
    ).toEqual({
      ref: {
        contestId: 1,
        index: "A",
        isGym: false,
      },
      internalId: "1A-cpp",
    });
  });

  test("parses group contest URLs", () => {
    expect(
      parseCfInput(
        "https://codeforces.com/group/EW9LgKVDr6/contest/517960/problem/P",
        "cpp"
      )
    ).toEqual({
      ref: {
        contestId: 517960,
        index: "P",
        isGym: false,
        groupCode: "EW9LgKVDr6",
      },
      internalId: "517960P-cpp",
    });
  });
});
