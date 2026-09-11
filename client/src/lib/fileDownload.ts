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

/** Downloads a protected file and hands the actual bytes—not its URL—to iOS. */
export async function saveAuthenticatedFile(url: string, suggestedName: string) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  const name = ensureFileExtension(suggestedName, blob.type);
  const file = new File([blob], name, {
    type: blob.type || "application/octet-stream",
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

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
