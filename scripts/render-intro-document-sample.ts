import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1.5 });
await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap');
*{box-sizing:border-box}body{margin:0;background:#e2e8f0;font-family:"Noto Sans JP",sans-serif;color:#1a1a1a}
.stage{width:1200px;height:900px;position:relative;overflow:hidden;background:linear-gradient(135deg,#eef2f6,#dce4ec)}
.documents{position:relative;width:1120px;height:860px;margin:20px auto}.page{position:absolute;left:28px;top:6px;z-index:3;width:600px;height:848px;background:#fff;padding:36px 42px;box-shadow:0 18px 45px rgba(15,38,65,.24);font-size:9px;line-height:1.5}
.mini-page{position:absolute;width:430px;height:608px;background:#fff;padding:25px 30px;box-shadow:0 16px 38px rgba(15,38,65,.2);font-size:7px}.map-page{right:72px;top:32px;z-index:1;transform:rotate(1.5deg)}.route-page{right:8px;bottom:18px;z-index:2;transform:rotate(-1deg)}
.mini-page .hdr{padding-bottom:7px;margin-bottom:10px}.mini-page .logo{font-size:11px}.mini-page .mt{font-size:14px;font-weight:700;color:#2b5c94;border-bottom:2px solid #2b5c94;padding-bottom:5px;margin-bottom:10px}.mini-page .ma{color:#475569;margin-bottom:8px}.fake-map{position:relative;height:390px;overflow:hidden;border:1px solid #c8d6e5;background-color:#eef2e8;background-image:linear-gradient(28deg,transparent 47%,#fff 48%,#fff 52%,transparent 53%),linear-gradient(112deg,transparent 46%,#d7e5ef 47%,#d7e5ef 54%,transparent 55%),linear-gradient(165deg,transparent 48%,#fff 49%,#fff 52%,transparent 53%);background-size:92px 74px,130px 110px,110px 86px}.fake-map:after{content:"P";position:absolute;left:48%;top:44%;display:grid;place-items:center;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#d64242;color:#fff;font-size:12px;font-weight:700}.fake-map:before{content:"P";position:absolute;left:48%;top:44%;z-index:1;width:28px;text-align:center;line-height:28px;color:#fff;font-size:12px;font-weight:700}
.route-map{height:355px}.route-line{position:absolute;left:52px;top:270px;width:285px;height:95px;border-top:5px solid #4285f4;border-right:5px solid #4285f4;transform:rotate(-18deg);border-radius:0 30px 0 0}.route-label{margin-top:10px;padding:8px 10px;background:#f0f5fa;border:1px solid #c8d6e5;color:#334155;font-size:9px;font-weight:700}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2b5c94;padding-bottom:10px;margin-bottom:14px}
.logo{font-size:16px;font-weight:700;color:#173f70}.hdr-r{font-size:8px;color:#64748b}.ttl{text-align:center;font-size:18px;font-weight:700;color:#2b5c94;letter-spacing:4px;margin-bottom:12px}
.pn{text-align:center;font-size:15px;font-weight:700;padding:8px 12px;background:#f0f5fa;border:1px solid #c8d6e5;margin-bottom:10px}
.cards{display:flex;gap:8px;margin-bottom:12px}.cd{flex:1;border:1px solid #c8d6e5;border-radius:4px;padding:6px 8px;text-align:center}.cd.pr{border-color:#2b5c94;background:#2b5c94;color:#fff}.cd-l{font-size:8px;color:#64748b;letter-spacing:1px}.cd-v{font-size:13px;font-weight:700;margin-top:1px}.cd.pr .cd-l{color:#cbd8e7}
.cmt{background:#f8fafc;border:1px solid #c8d6e5;border-left:3px solid #2b5c94;padding:8px 10px;margin-bottom:12px}.cmt b{display:block;margin-bottom:3px;color:#2b5c94}
.sec{font-weight:700;color:#2b5c94;background:#f0f5fa;padding:5px 8px;margin:11px 0 6px}table{width:100%;border-collapse:collapse;border:1px solid #c8d6e5}th,td{border:1px solid #c8d6e5;padding:4px 7px;vertical-align:top}th{background:#f0f5fa;color:#334155;font-weight:600;width:66px;white-space:nowrap}.ft{text-align:center;font-size:8px;color:#94a3b8;border-top:1px solid #c8d6e5;padding-top:6px;margin-top:14px}
</style></head><body><div class="stage"><div class="documents"><div class="mini-page map-page"><div class="hdr"><div class="logo">株式会社サンプル不動産</div><div class="hdr-r">出力日: 2026/8/26</div></div><div class="mt">所在地地図</div><div class="ma">📍 東京都○○区（紹介用サンプル）</div><div class="fake-map"></div><div class="ft">株式会社サンプル不動産 - 物件紹介資料</div></div><div class="mini-page route-page"><div class="hdr"><div class="logo">株式会社サンプル不動産</div><div class="hdr-r">出力日: 2026/8/26</div></div><div class="mt">交通アクセス</div><div class="route-label">🚃 ○○線「○○」駅 徒歩8分</div><div class="fake-map route-map"><div class="route-line"></div></div><div class="ft">株式会社サンプル不動産 - 物件紹介資料</div></div><div class="page">
<div class="hdr"><div class="logo">株式会社サンプル不動産</div><div class="hdr-r">出力日: 2026/8/26</div></div>
<div class="ttl">物 件 概 要 書</div><div class="pn">サンプルレジデンス</div>
<div class="cards"><div class="cd pr"><div class="cd-l">売出価格</div><div class="cd-v">1億8,500万円</div></div><div class="cd"><div class="cd-l">土地面積</div><div class="cd-v">245.80㎡</div></div><div class="cd"><div class="cd-l">建物延床面積</div><div class="cd-v">518.42㎡</div></div></div>
<div class="cmt"><b>紹介コメント</b>駅徒歩圏内、周辺環境と収益性のバランスに優れた一棟収益物件です。</div>
<div class="sec">物件概要</div><table>
<tr><th>所在地</th><td colspan="3">東京都○○区（紹介用サンプル）</td></tr><tr><th>地番</th><td>○○番○</td><th>物件種別</th><td>一棟マンション</td></tr><tr><th>交通</th><td colspan="3">○○線「○○」駅 徒歩8分</td></tr><tr><th>売出価格</th><td colspan="3">1億8,500万円</td></tr><tr><th>土地面積</th><td>245.80㎡（74.35坪）</td><th>建物延床面積</th><td>518.42㎡（156.82坪）</td></tr><tr><th>地目</th><td>宅地</td><th>権利</th><td>所有権</td></tr><tr><th>構造</th><td>鉄筋コンクリート造</td><th>築年数</th><td>2018年</td></tr><tr><th>接道</th><td colspan="3">南側公道</td></tr><tr><th>用途地域</th><td>第一種住居地域</td><th>防火指定</th><td>準防火地域</td></tr><tr><th>備考</th><td colspan="3">本資料に記載の情報はすべて紹介用サンプルです。</td></tr></table>
<div class="sec">お問い合わせ先</div><table><tr><th>会社名</th><td>株式会社サンプル不動産</td></tr><tr><th>担当者</th><td>営業担当</td></tr><tr><th>TEL</th><td>00-0000-0000</td></tr><tr><th>E-mail</th><td>sample@example.com</td></tr></table>
<div class="ft">株式会社サンプル不動産 - 物件紹介資料</div></div></div>
</div></body></html>`, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "client/public/intro-v2-document-sample.png" });
await browser.close();
