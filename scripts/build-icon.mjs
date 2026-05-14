#!/usr/bin/env node
// SVG → PNG → ICO 변환 (electron-builder가 OS별로 사용)
// Mac .icns는 electron-builder가 icon.png(1024)에서 자동 생성 가능

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "electron", "assets");
const SVG = join(ASSETS, "icon.svg");

const svgBuf = readFileSync(SVG);

// 1) 마스터 PNG (1024×1024) — Mac/Linux + ICO 입력
const png1024 = await sharp(svgBuf).resize(1024, 1024).png().toBuffer();
writeFileSync(join(ASSETS, "icon.png"), png1024);
console.log("✅ icon.png (1024×1024)");

// 2) Windows ICO (다중 해상도)
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = await Promise.all(
  icoSizes.map((size) => sharp(svgBuf).resize(size, size).png().toBuffer())
);
const ico = await pngToIco(pngBuffers);
writeFileSync(join(ASSETS, "icon.ico"), ico);
console.log(`✅ icon.ico (sizes: ${icoSizes.join(", ")})`);

// 3) Mac .icns는 electron-builder가 icon.png(1024)에서 자동 생성. 별도 변환 X.
console.log("ℹ️  Mac .icns는 electron-builder가 icon.png(1024)에서 자동 생성");
console.log(`\n📦 산출물 위치: ${ASSETS}`);
