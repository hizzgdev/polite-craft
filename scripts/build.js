#!/usr/bin/env node
/**
 * Copy src/ to dist/ for Chrome "Load unpacked".
 * No transpilation — plain MV3 extension files.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function rmRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      rmRecursive(full);
    } else {
      fs.unlinkSync(full);
    }
  }
  fs.rmdirSync(dir);
}

if (!fs.existsSync(SRC)) {
  console.error("build: src/ not found");
  process.exit(1);
}

rmRecursive(DIST);
copyRecursive(SRC, DIST);
console.log("build: copied src/ → dist/");
