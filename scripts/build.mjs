import { cp, mkdir, rm } from "node:fs/promises";

const files = ["index.html", "styles.css", "app.js", "vcf.js", "i18n.js", "LICENSE"];
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all(files.map((file) => cp(file, `dist/${file}`)));
console.log(`Built ${files.length} files into dist/`);
