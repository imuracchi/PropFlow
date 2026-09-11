function isAppleMobileBrowser() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function ensureFileExtension(name: string, mimeType: string) {
  const extension =
    mimeType === "application/pdf"
      ? ".pdf"
      : mimeType === "application/zip"
        ? ".zip"
        : mimeType === "image/jpeg"
          ? ".jpg"
          : mimeType === "image/png"
            ? ".png"
            : mimeType === "image/webp"
              ? ".webp"
              : "";
  if (!extension || name.toLowerCase().endsWith(extension)) return name;
  return `${name}${extension}`;
}

function inferMimeType(name: string, responseType: string) {
  if (responseType && responseType !== "application/octet-stream")
    return responseType;
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".zip")) return "application/zip";
  if (/\.(jpe?g)$/.test(lowerName)) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  return responseType || "application/octet-stream";
}

/** Downloads a protected file and hands the actual bytes—not its URL—to iOS. */
export async function saveAuthenticatedFile(url: string, suggestedName: string) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const downloadBlob = await response.blob();
  const mimeType = inferMimeType(
    suggestedName,
    response.headers.get("X-File-Mime-Type") ?? downloadBlob.type
  );
  const name = ensureFileExtension(suggestedName, mimeType);
  const file = new File([downloadBlob], name, {
    type: mimeType,
  });

  if (
    isAppleMobileBrowser() &&
    typeof navigator.share === "function" &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Some embedded iOS browsers expose Web Share but reject files. In that
      // case, continue with a blob URL so the URL text itself is never saved.
    }
  }

  // Keep the server's application/octet-stream type for this fallback. This
  // prevents embedded iOS viewers from reopening a PDF preview and sharing
  // its URL instead of downloading the bytes.
  const objectUrl = URL.createObjectURL(downloadBlob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
