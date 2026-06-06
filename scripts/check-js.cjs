const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = [];

function collect(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === ".git" || entry.name === "node_modules") return;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(target);
    else if (/\.(?:js|cjs)$/.test(entry.name)) files.push(target);
  });
}

collect(root);
files.forEach((file) => execFileSync(process.execPath, ["--check", file], { stdio: "inherit" }));
console.log(`Checked ${files.length} JavaScript files.`);
