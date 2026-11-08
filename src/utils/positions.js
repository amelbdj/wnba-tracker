// ESPN names positions in English ("Goalkeeper"); football's four are shown in
// the user's language, anything else (basketball's "Guard"…) as ESPN has it.
const FOOTBALL = {
  goalkeeper: "goalkeeper",
  defender: "defender",
  midfielder: "midfielder",
  forward: "forward",
  attacker: "forward",
};

export function translatePosition(name, t) {
  const key = FOOTBALL[String(name || "").toLowerCase()];
  return key ? t(`positionNames.${key}`) : name;
}
