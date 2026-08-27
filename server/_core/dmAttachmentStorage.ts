import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DM_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
export const MAX_DM_ATTACHMENTS = 3;
export const DAILY_DM_UPLOAD_BYTES = 100 * 1024 * 1024;
export const DM_ATTACHMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function config() {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_DEFAULT_REGION || "auto";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey)
    throw new Error("DM attachment storage is not configured");
  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

function client() {
  const value = config();
  return new S3Client({
    endpoint: value.endpoint,
    region: value.region,
    credentials: {
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
    },
  });
}

export function decodeAndValidateDmAttachment(input: {
  fileName: string;
  dataBase64: string;
}) {
  const data = Buffer.from(input.dataBase64, "base64");
  if (!data.length || data.length > MAX_FILE_BYTES)
    throw new Error("ファイルは10MB以下にしてください");
  let mimeType: string | null = null;
  let extension: string | null = null;
  if (data.subarray(0, 5).toString() === "%PDF-")
    [mimeType, extension] = ["application/pdf", "pdf"];
  else if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    [mimeType, extension] = ["image/jpeg", "jpg"];
  else if (
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    [mimeType, extension] = ["image/png", "png"];
  else if (
    data.subarray(0, 4).toString() === "RIFF" &&
    data.subarray(8, 12).toString() === "WEBP"
  )
    [mimeType, extension] = ["image/webp", "webp"];
  if (!mimeType || !extension)
    throw new Error("PDF、JPEG、PNG、WebPのみ添付できます");
  const fileName =
    input.fileName.replace(/[\\/\0\r\n]/g, "_").slice(0, 255) ||
    `attachment.${extension}`;
  return { data, mimeType, fileName, extension };
}

export async function putDmAttachment(
  userId: number,
  input: { fileName: string; dataBase64: string }
) {
  const parsed = decodeAndValidateDmAttachment(input);
  const value = config();
  const objectKey = `dm/${userId}/${new Date().toISOString().slice(0, 10)}/${nanoid(24)}.${parsed.extension}`;
  await client().send(
    new PutObjectCommand({
      Bucket: value.bucket,
      Key: objectKey,
      Body: parsed.data,
      ContentType: parsed.mimeType,
    })
  );
  return {
    objectKey,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    size: parsed.data.length,
  };
}

export async function getDmAttachmentObject(objectKey: string) {
  const value = config();
  return client().send(
    new GetObjectCommand({ Bucket: value.bucket, Key: objectKey })
  );
}

export async function deleteDmAttachmentObject(objectKey: string) {
  const value = config();
  await client().send(
    new DeleteObjectCommand({ Bucket: value.bucket, Key: objectKey })
  );
}

export async function cleanupExpiredDmAttachments() {
  const db = await import("../db");
  let deleted = 0;
  const expired = await db.getExpiredDmAttachments(1000);
  for (const item of expired) {
    try {
      await deleteDmAttachmentObject(item.objectKey);
      await db.markDmAttachmentDeleted(item.id);
      deleted++;
    } catch (error) {
      console.error(`[dm-attachment-cleanup] id=${item.id}`, error);
    }
  }
  return deleted;
}
