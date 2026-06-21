const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const now = new Date();
const pad = (value) => String(value).padStart(2, "0");
const buildNumber = [
  now.getFullYear(),
  pad(now.getMonth() + 1),
  pad(now.getDate()),
  ".",
  pad(now.getHours()),
  pad(now.getMinutes()),
  pad(now.getSeconds()),
].join("");

const updatedAt = [
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
].join(" ");

const output = `export const BUILD_INFO = {
  version: ${JSON.stringify(packageJson.version)},
  buildNumber: ${JSON.stringify(buildNumber)},
  updatedAt: ${JSON.stringify(updatedAt)},
} as const;
`;

fs.writeFileSync(path.join(root, "src", "buildInfo.ts"), output);
