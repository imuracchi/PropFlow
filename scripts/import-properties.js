#!/usr/bin/env node
/**
 * 物件CSV一括インポートスクリプト（一回限り）
 *
 * 使い方:
 *   USER_ID=<登録者のユーザーID> DATABASE_URL=<接続先> node scripts/import-properties.js 物件一覧.csv
 *
 * ファイルエンコーディング:
 *   UTF-8(BOM有り)・UTF-8・Shift-JISいずれも自動判定を試みます。
 *   Shift-JISの場合は iconv-lite が必要: npm install --no-save iconv-lite
 */

const mysql = require("mysql2/promise");
const fs = require("fs");

let iconv = null;
try { iconv = require("iconv-lite"); } catch (_) {}

const CSV_FILE = process.argv[2];
const USER_ID = parseInt(process.env.USER_ID || "0", 10);
const DATABASE_URL = process.env.DATABASE_URL;

if (!CSV_FILE) { console.error("使い方: node scripts/import-properties.js <CSVファイル>"); process.exit(1); }
if (!USER_ID) { console.error("USER_ID 環境変数を設定してください"); process.exit(1); }
if (!DATABASE_URL) { console.error("DATABASE_URL 環境変数を設定してください"); process.exit(1); }

// --- CSV パース ---
function parseCSVLine(line) {
  const fields = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  fields.push(cur.trim());
  return fields;
}

// --- 数値変換 ---
function parsePrice(s) {
  if (!s || s === "-") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : Math.round(n * 10000);
}

function parseYield(s) {
  if (!s || s === "-") return null;
  const n = parseFloat(s.replace("%", ""));
  return isNaN(n) ? null : n;
}

function parseArea(s) {
  if (!s || s === "-") return { area: null, ratio: null };
  const numMatch = s.match(/^[\d,]+\.?\d*/);
  const area = numMatch ? parseFloat(numMatch[0].replace(/,/g, "")) : null;
  const ratioMatch = s.match(/(\d+%\/\d+%)/);
  return { area: isNaN(area) ? null : area, ratio: ratioMatch ? ratioMatch[1] : null };
}

// --- メイン ---
async function main() {
  const rawBuf = fs.readFileSync(CSV_FILE);

  // エンコーディング判定: BOM有りUTF-8 → UTF-8 → Shift-JIS
  let content;
  if (rawBuf[0] === 0xEF && rawBuf[1] === 0xBB && rawBuf[2] === 0xBF) {
    content = rawBuf.slice(3).toString("utf8");
  } else if (iconv) {
    // Shift-JISで試みて、読めなければUTF-8
    const sjis = iconv.decode(rawBuf, "Shift_JIS");
    content = sjis.includes("物件") ? sjis : rawBuf.toString("utf8");
  } else {
    content = rawBuf.toString("utf8");
  }

  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  console.log("ヘッダー:", header.join(" | "));

  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("DB接続完了");

  let inserted = 0, skipped = 0;

  // 地区判定: 土地セクションかどうか
  let currentSection = "";

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const [
      district,      // 地区
      name,          // 物件名
      priceRaw,      // 価格(万円)
      yieldRaw,      // 利回り
      status,        // 入居状況
      station,       // 最寄駅
      walkRaw,       // 徒歩・距離
      address,       // 所在地
      structure,     // 構造
      buildingAge,   // 築年
      landAreaRaw,   // 土地面積
      buildingAreaRaw, // 建物面積
    ] = cols;

    // セクションヘッダー行のスキップ（物件名が空 or 価格が空で住所も空）
    if (!name || name === "物件名") { skipped++; continue; }
    if (!priceRaw && !address) { currentSection = district || currentSection; skipped++; continue; }

    // 地区を更新
    if (district) currentSection = district;

    const price = parsePrice(priceRaw);
    const estimatedYield = parseYield(yieldRaw);
    const { area: landArea, ratio: landRatio } = parseArea(landAreaRaw);
    const { area: buildingArea } = parseArea(buildingAreaRaw);
    const transport = [station, walkRaw].filter(t => t && t !== "-").join(" ");

    // 物件種別
    const isLandSection = currentSection.includes("土地") || currentSection.includes("その他");
    const type = (isLandSection && !buildingArea) ? "土地" : "区分マンション";

    // 備考: 入居状況 + 建蔽率/容積率
    const remarkParts = [];
    if (status && status !== "-") remarkParts.push(`入居状況: ${status}`);
    if (landRatio) remarkParts.push(`建蔽率/容積率: ${landRatio}`);
    const remarks = remarkParts.length ? remarkParts.join(" / ") : null;

    try {
      await conn.execute(
        `INSERT INTO properties
           (userId, name, address, type, price, estimatedYield, landArea, buildingArea,
            transport, structure, buildingAge, remarks, published, status, negotiation, deleted, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'available', '固定', 0, NOW(), NOW())`,
        [
          USER_ID,
          name,
          address || district || "",
          type,
          price,
          estimatedYield,
          landArea,
          buildingArea,
          transport || null,
          structure || null,
          buildingAge || null,
          remarks,
        ]
      );
      inserted++;
      console.log(`[OK] ${name} / ${type} / ${price ? (price / 10000).toLocaleString() + "万円" : "価格未定"}`);
    } catch (err) {
      console.error(`[ERROR] ${name}: ${err.message}`);
      skipped++;
    }
  }

  await conn.end();
  console.log(`\n完了: ${inserted}件 登録, ${skipped}件 スキップ`);
}

main().catch(err => { console.error("致命的エラー:", err); process.exit(1); });
