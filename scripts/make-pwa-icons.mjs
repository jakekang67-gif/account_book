import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(
  process.env.USERPROFILE ?? "",
  ".cursor",
  "projects",
  "c-Users-Desktop-account-book",
  "assets",
  "pwa-icon.jpg",
);

await Promise.all([
  sharp(src).resize(192, 192).png().toFile(path.join(root, "public/icons/icon-192.png")),
  sharp(src).resize(512, 512).png().toFile(path.join(root, "public/icons/icon-512.png")),
  sharp(src)
    .resize(180, 180)
    .png()
    .toFile(path.join(root, "public/icons/apple-touch-icon.png")),
]);

console.log("icons ready");
