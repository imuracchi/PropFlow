const PDFJS_VERSION = "3.11.174";

export function openFilePreview(name: string, base64: string, w: Window | null) {
  if (!w) return;
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const ext = name.split(".").pop()?.toLowerCase() ?? "pdf";
  const mime = ext === "pdf" ? "application/pdf" : `image/${ext}`;
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);

  const toolbar = `
.toolbar{position:fixed;top:0;left:0;right:0;z-index:100;background:#2b5c94;padding:10px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.toolbar button{background:#fff;color:#2b5c94;border:none;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer}
.toolbar .title{color:#fff;font-size:13px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.frame-wrap{position:absolute;top:48px;left:0;right:0;bottom:0;overflow:auto}`;

  const body = mime === "application/pdf"
    ? `<div id="container" class="frame-wrap" style="background:#525659;text-align:center;">
<div id="status" style="color:#fff;padding:40px;font-family:sans-serif;">読み込み中...</div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js";
const container = document.getElementById("container");
pdfjsLib.getDocument("${url}").promise.then(async function(pdf) {
  document.getElementById("status").remove();
  const dpr = window.devicePixelRatio || 1;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const cssScale = (container.clientWidth - 16) / baseViewport.width;
    const viewport = page.getViewport({ scale: cssScale * dpr });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = (viewport.width / dpr) + "px";
    canvas.style.height = (viewport.height / dpr) + "px";
    canvas.style.display = "block";
    canvas.style.margin = "8px auto";
    canvas.style.background = "#fff";
    canvas.style.boxShadow = "0 1px 4px rgba(0,0,0,.3)";
    container.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  }
}).catch(function(err) {
  document.getElementById("status").textContent = "PDFの読み込みに失敗しました";
});
</script>`
    : `<div class="frame-wrap" style="background:#525659;"><img src="${url}" style="display:block;width:100%;height:auto;margin:0 auto;" /></div>`;

  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
${toolbar}
</style></head><body>
<div class="toolbar"><button onclick="window.close()">← 閉じる</button><span class="title">${name}</span></div>
${body}
</body></html>`);
  w.document.close();
}
