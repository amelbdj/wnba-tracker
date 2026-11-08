import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import satori from "satori";
import { fill, textFor } from "./shareText.js";

// The 1200x630 preview images for teams, players and leagues. Layouts are
// built as plain element trees (what satori turns into SVG) and then drawn to
// a PNG by resvg. Everything here is pure: the handler (api/og.js) looks the
// data up and hands it in, so a card can be rendered from a fixture.

export const CARD = { width: 1200, height: 630 };

const FONT_FILES = [
  ["Bebas Neue", 400, "BebasNeue-Regular.ttf"],
  ["Inter", 500, "Inter-Medium.ttf"],
  ["Inter", 700, "Inter-Bold.ttf"],
];

let fonts;
function loadFonts() {
  fonts ||= FONT_FILES.map(([name, weight, file]) => ({
    name,
    weight,
    style: "normal",
    data: readFileSync(new URL(`./fonts/${file}`, import.meta.url)),
  }));
  return fonts;
}

const BRAND_BLUE = "2f5cf0";
const BRAND_PURPLE = "7a3ae6";
const INK = "#ffffff";
const MUTED = "#b4bae3";

// ---- colours -----------------------------------------------------------------
const toRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

// A team colour to glow behind its card: ESPN's hex, lightened when it is too
// dark to show on the dark background, and the brand purple if it isn't a hex.
export function accentFor(hex) {
  if (!/^[0-9a-f]{6}$/i.test(hex || "")) return BRAND_PURPLE;
  const [r, g, b] = toRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance >= 0.18) return hex.toLowerCase();
  const lift = (c) => Math.round(c + (255 - c) * 0.45);
  return [lift(r), lift(g), lift(b)].map((c) => c.toString(16).padStart(2, "0")).join("");
}

const rgba = (hex, alpha) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// The bundled fonts cover Latin-1 (é, ñ, ü, ø, å…) but not the rest of Latin
// Extended (Š, Ł, Ğ, Ć…), which would be drawn as "NO GLYPH" boxes — and
// international players and teams have such letters. Those are written with
// their plain base letter instead; everything the fonts can draw is kept.
const SPECIAL = { Ł: "L", ł: "l", Đ: "D", đ: "d", ı: "i", İ: "I", Ħ: "H", ħ: "h", Ŀ: "L", ŀ: "l" };

export function drawable(value) {
  return Array.from(String(value ?? ""))
    .map((ch) => {
      if (ch.charCodeAt(0) <= 0xff) return ch;
      if (SPECIAL[ch]) return SPECIAL[ch];
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return base.charCodeAt(0) <= 0xff ? base : ch;
    })
    .join("");
}

// ---- element helpers -----------------------------------------------------------
const el = (type, style, children, props = {}) => ({ type, props: { style, children, ...props } });
const div = (style, children) => el("div", { display: "flex", ...style }, children);
const text = (style, value) => el("div", { display: "flex", ...style }, value);

// Big names shrink with their length so they stay on one or two lines.
export function nameSize(name = "") {
  const n = name.length;
  if (n <= 12) return 150;
  if (n <= 18) return 124;
  if (n <= 26) return 100;
  if (n <= 36) return 82;
  return 66;
}

// ---- shared frame --------------------------------------------------------------
function frame(accent, children) {
  return div(
    {
      width: CARD.width,
      height: CARD.height,
      position: "relative",
      flexDirection: "column",
      fontFamily: "Inter",
      color: INK,
      backgroundColor: "#070a16",
      backgroundImage: [
        `radial-gradient(circle at 22% 50%, ${rgba(accent, 0.5)}, ${rgba(accent, 0)} 55%)`,
        `radial-gradient(circle at 100% 0%, ${rgba(BRAND_PURPLE, 0.35)}, ${rgba(BRAND_PURPLE, 0)} 50%)`,
        "linear-gradient(135deg, #0a0d1f, #070a16)",
      ].join(", "),
    },
    [
      ...children,
      // brand footer
      div(
        {
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 34,
          alignItems: "center",
          justifyContent: "space-between",
        },
        [
          text({ fontFamily: "Bebas Neue", fontSize: 34, letterSpacing: 3, color: INK }, "FRONTROW"),
          text({ fontWeight: 700, fontSize: 22, letterSpacing: 1, color: "#8d94c9" }, "thefrontrow.fr"),
        ],
      ),
      div(
        {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 12,
          backgroundImage: `linear-gradient(90deg, #${BRAND_BLUE}, #${BRAND_PURPLE})`,
        },
        [],
      ),
    ],
  );
}

const pill = (label, accent) =>
  div(
    {
      alignSelf: "flex-start",
      padding: "9px 22px",
      borderRadius: 999,
      backgroundColor: rgba(accent, 0.28),
      border: `1.5px solid ${rgba(accent, 0.7)}`,
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: INK,
    },
    label,
  );

const title = (name) =>
  text(
    {
      fontFamily: "Bebas Neue",
      fontSize: nameSize(name),
      lineHeight: 1.0,
      letterSpacing: 2,
      color: INK,
      marginTop: 22,
      maxWidth: 680,
      lineClamp: 2,
    },
    name,
  );

const tagline = (value) => text({ fontWeight: 500, fontSize: 28, color: MUTED, marginTop: 20 }, value);

// Layout: a round picture/logo on the left, text on the right.
function twoColumns(accent, left, right) {
  return frame(accent, [
    div(
      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", paddingLeft: 64, paddingRight: 64, paddingBottom: 50 },
      [
        div({ width: 400, alignItems: "center", justifyContent: "center", flexShrink: 0 }, left),
        div({ flexDirection: "column", justifyContent: "center", marginLeft: 36, flex: 1 }, right),
      ],
    ),
  ]);
}

const logoImage = (src, size) => el("img", { width: size, height: size, objectFit: "contain" }, undefined, { src, width: size, height: size });

function picture(src, size, accent, { round = true } = {}) {
  return div(
    {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round ? size : 40,
      overflow: "hidden",
      backgroundColor: "rgba(255, 255, 255, 0.07)",
      border: `4px solid ${rgba(accent, 0.75)}`,
    },
    round ? el("img", { width: size, height: size, objectFit: "cover", objectPosition: "50% 0%" }, undefined, { src, width: size, height: size }) : logoImage(src, Math.round(size * 0.78)),
  );
}

function initialsBadge(initials, size, accent) {
  return div(
    {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: size,
      border: `4px solid ${rgba(accent, 0.75)}`,
      backgroundImage: `linear-gradient(160deg, ${rgba(accent, 0.55)}, ${rgba(BRAND_PURPLE, 0.35)})`,
      fontFamily: "Bebas Neue",
      fontSize: Math.round(size * 0.46),
      letterSpacing: 4,
    },
    initials,
  );
}

// ---- the cards -------------------------------------------------------------------

// data: { name, leagueName, color, logo (data URI) }
export function teamCard(lang, data) {
  const t = textFor(lang).card;
  const accent = accentFor(data.color);
  return twoColumns(
    accent,
    data.logo ? [picture(data.logo, 340, accent, { round: false })] : [],
    [pill(drawable(data.leagueName), accent), title(drawable(data.name)), tagline(t.teamTagline)],
  );
}

// data: { name, leagueName, color, logo, headshot, subtitle (team · position · #), stats: [{ label, value }], season }
export function playerCard(lang, data) {
  const t = textFor(lang).card;
  const accent = accentFor(data.color);
  const stats = (data.stats || []).slice(0, 3);

  return twoColumns(
    accent,
    data.headshot ? [picture(data.headshot, 330, accent)] : data.initials ? [initialsBadge(data.initials, 330, accent)] : [],
    [
      pill(drawable(data.leagueName), accent),
      title(drawable(data.name)),
      text({ fontWeight: 500, fontSize: 30, color: MUTED, marginTop: 16, alignItems: "center" }, [
        data.logo ? el("img", { width: 40, height: 40, objectFit: "contain", marginRight: 12 }, undefined, { src: data.logo, width: 40, height: 40 }) : null,
        drawable(data.subtitle),
      ].filter(Boolean)),
      stats.length > 0
        ? div({ marginTop: 30, alignItems: "flex-end" }, [
            ...stats.map((s) =>
              div(
                { flexDirection: "column", marginRight: 44 },
                [
                  text({ fontFamily: "Bebas Neue", fontSize: 84, lineHeight: 1, color: INK }, s.value),
                  text({ fontWeight: 700, fontSize: 20, letterSpacing: 2, color: MUTED, marginTop: 2 }, s.label),
                ],
              ),
            ),
            data.season ? text({ fontWeight: 500, fontSize: 20, color: "#8d94c9", marginBottom: 10 }, fill(t.season, { year: data.season })) : null,
          ].filter(Boolean))
        : tagline(data.tagline ?? t.playerTagline),
    ],
  );
}

const ICON_STROKE = "#ffffff";

function sportIcon(sport, size, accent) {
  // Football: a pentagon with seams. Volleyball: the three curved panels around
  // the centre, one drawn and rotated twice. Basketball: the cross and the two
  // side seams.
  const lines =
    sport === "soccer"
      ? [
          // the pentagon in the middle and a seam from each corner to the edge
          { d: "M50 33 L66.2 44.7 L60 63.7 L40 63.7 L33.8 44.7 Z", fill: ICON_STROKE },
          { d: "M50 33 L50 4" },
          { d: "M66.2 44.7 L93.8 35.8" },
          { d: "M60 63.7 L77 87.2" },
          { d: "M40 63.7 L23 87.2" },
          { d: "M33.8 44.7 L6.2 35.8" },
        ]
      : sport === "volleyball"
      ? [0, 120, 240].map((angle) => ({ d: "M50 5 C 30 20 28 40 50 50 C 62 55 78 54 93 44", transform: `rotate(${angle} 50 50)` }))
      : [
          { d: "M50 4 L50 96" },
          { d: "M4 50 L96 50" },
          { d: "M18 16 C 40 38 40 62 18 84" },
          { d: "M82 16 C 60 38 60 62 82 84" },
        ];

  return el(
    "svg",
    {},
    [
      el("circle", {}, undefined, { cx: 50, cy: 50, r: 46, fill: rgba(accent, 0.25), stroke: ICON_STROKE, strokeWidth: 3 }),
      ...lines.map((line) =>
        el("path", {}, undefined, { fill: "none", stroke: ICON_STROKE, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", ...line }),
      ),
    ],
    { width: size, height: size, viewBox: "0 0 100 100" },
  );
}

// data: { leagueName, sport, section }
export function leagueCard(lang, data) {
  const t = textFor(lang).card;
  const accent = BRAND_PURPLE;
  return twoColumns(
    accent,
    [sportIcon(data.sport, 300, accent)],
    [pill(t.sectionPill[data.section] ?? t.sectionPill[""], accent), title(drawable(data.leagueName)), tagline(t.leagueTagline)],
  );
}

// ---- rendering ----------------------------------------------------------------------
// Cards are sent as JPEG, not PNG: smooth gradients and photos make PNGs of
// 250-400 KB, and WhatsApp drops preview images much past 300 KB. A quality-88
// JPEG is a fraction of that and looks the same at this size.
const JPEG_QUALITY = 88;

export async function renderCard(tree) {
  const svg = await satori(tree, { ...CARD, fonts: loadFonts() });
  const rendered = new Resvg(svg, { fitTo: { mode: "width", value: CARD.width } }).render();
  const { data } = jpeg.encode(
    { data: rendered.pixels, width: rendered.width, height: rendered.height },
    JPEG_QUALITY,
  );
  return data;
}
