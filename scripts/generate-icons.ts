import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Regenerates every PNG icon and iOS splash screen from the master SVG, and
// rewrites the splash <link> tags in index.html. Outputs are committed, so
// this only needs running after public/icons/icon.svg changes.

const SOURCE = "public/icons/icon.svg";
const ICON_DIR = "public/icons";
const SPLASH_DIR = "public/splash";
const INDEX_HTML = "src/index.html";
/** Matches the icon background and the manifest background_color. */
const BACKGROUND = "#16181c";
/** Icon width as a fraction of the splash screen width. */
const SPLASH_ICON_SCALE = 0.5;

const ICONS: { file: string; size: number }[] = [
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "favicon-32.png", size: 32 },
];

/**
 * iPhone screens in portrait CSS pixels. iOS only shows a startup image whose
 * media query matches the device exactly, so add new models here.
 */
const IPHONE_SCREENS: { width: number; height: number; ratio: number }[] = [
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max, 17 Pro Max
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 428, height: 926, ratio: 3 }, // 12 Pro Max, 13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12 mini, 13 mini
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 375, height: 667, ratio: 2 }, // 8, SE (2nd and 3rd gen)
];

const SPLASH_START = "<!-- splash:start -->";
const SPLASH_END = "<!-- splash:end -->";

async function main(): Promise<void> {
  const svg = await readFile(SOURCE);

  for (const { file, size } of ICONS) {
    await sharp(svg, { density: 300 })
      .resize(size, size)
      .flatten({ background: BACKGROUND })
      .png()
      .toFile(`${ICON_DIR}/${file}`);
  }

  await rm(SPLASH_DIR, { recursive: true, force: true });
  await mkdir(SPLASH_DIR, { recursive: true });
  const links: string[] = [];
  for (const { width, height, ratio } of IPHONE_SCREENS) {
    const pixelWidth = width * ratio;
    const pixelHeight = height * ratio;
    const iconSize = Math.round(pixelWidth * SPLASH_ICON_SCALE);
    const icon = await sharp(svg, { density: 300 })
      .resize(iconSize, iconSize)
      .png()
      .toBuffer();
    const file = `splash-${pixelWidth}x${pixelHeight}.png`;
    await sharp({
      create: {
        width: pixelWidth,
        height: pixelHeight,
        channels: 3,
        background: BACKGROUND,
      },
    })
      .composite([{ input: icon, gravity: "center" }])
      .png({ palette: true })
      .toFile(`${SPLASH_DIR}/${file}`);
    links.push(
      `<link rel="apple-touch-startup-image" media="(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)" href="splash/${file}" />`,
    );
  }

  const html = await readFile(INDEX_HTML, "utf8");
  const start = html.indexOf(SPLASH_START);
  const end = html.indexOf(SPLASH_END);
  if (start < 0 || end < start) {
    throw new Error(
      `${INDEX_HTML} needs ${SPLASH_START} and ${SPLASH_END} markers.`,
    );
  }
  const indent = "    ";
  const block = [SPLASH_START, ...links, SPLASH_END].join(`\n${indent}`);
  await writeFile(
    INDEX_HTML,
    html.slice(0, start) + block + html.slice(end + SPLASH_END.length),
  );

  console.log(
    `Generated ${ICONS.length} icons and ${IPHONE_SCREENS.length} splash screens.`,
  );
}

void main().catch((error: unknown) => {
  console.error("Icon generation failed:", error);
  process.exitCode = 1;
});
