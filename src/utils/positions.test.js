import { describe, expect, it } from "vitest";
import { translatePosition } from "./positions";

const t = (key) => `t:${key}`;

describe("translatePosition", () => {
  it("translates football's positions, whatever ESPN's capitalisation", () => {
    expect(translatePosition("Goalkeeper", t)).toBe("t:positionNames.goalkeeper");
    expect(translatePosition("defender", t)).toBe("t:positionNames.defender");
    expect(translatePosition("Midfielder", t)).toBe("t:positionNames.midfielder");
    expect(translatePosition("Forward", t)).toBe("t:positionNames.forward");
    expect(translatePosition("Attacker", t)).toBe("t:positionNames.forward");
  });

  it("leaves other sports' positions as ESPN names them", () => {
    expect(translatePosition("Guard", t)).toBe("Guard");
    expect(translatePosition("Outside Hitter", t)).toBe("Outside Hitter");
    expect(translatePosition(undefined, t)).toBeUndefined();
  });
});
