// Baut die Oberfläche (React) zu einer einzelnen HTML-Datei: dist-app/index.html (wie Netzwerkplaner und Stromplaner)
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist-app");

async function build() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, "src", "renderer", "index.jsx")],
    bundle: true,
    format: "iife",
    minify: process.argv.includes("--minify"),
    loader: { ".jsx": "jsx", ".js": "jsx", ".svg": "text" },
    jsx: "transform",
    define: { "process.env.NODE_ENV": '"production"', __APP_VERSION__: JSON.stringify(pkg.version) },
    write: false,
    logLevel: "warning",
  });
  const css = fs.readFileSync(path.join(ROOT, "src", "renderer", "styles.css"), "utf8");
  const html =
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; img-src 'self' data: blob:; connect-src 'self' https://api.github.com">` +
    `<link rel="icon" href="data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, "assets", "app-icon", "icon.svg")).toString("base64")}">` +
    `<title>Advanced LAN</title><style>${css}</style></head>` +
    `<body><div id="root"></div><script>\n${result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
  console.log(`Build erfolgreich: dist-app/index.html (${Math.round(html.length / 1024)} KB)`);
}

build().catch((e) => { console.error("Build fehlgeschlagen:", e.message); process.exit(1); });
