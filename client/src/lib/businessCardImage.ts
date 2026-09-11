const MAX_LONG_EDGE = 2048;
const JPEG_QUALITY = 0.9;

export type NormalizedBusinessCard = {
  base64: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み込めませんでした"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした"));
    };
    image.src = url;
  });
}

/**
 * Applies the camera image's EXIF orientation, limits oversized photos, and
 * removes device-specific metadata before OCR and storage. The whole frame is
 * retained so that business-card edges are never cropped automatically.
 */
export async function normalizeBusinessCardImage(
  file: File
): Promise<NormalizedBusinessCard> {
  const source = await loadImage(file);
  const sourceWidth = source.naturalWidth;
  const sourceHeight = source.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("画像サイズを確認できませんでした");

  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を変換できませんでした");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      result => (result ? resolve(result) : reject(new Error("画像を変換できませんでした"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  );

  return {
    base64: await blobToBase64(blob),
    mimeType: "image/jpeg",
    width,
    height,
  };
}
