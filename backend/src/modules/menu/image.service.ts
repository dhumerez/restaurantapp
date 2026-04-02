import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import crypto from "crypto";
import { env } from "../../config/env.js";

const MAX_WIDTH = 800;
const QUALITY = 80;

let s3: S3Client | null = null;

function getClient(): S3Client {
  if (s3) return s3;

  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY || !env.R2_SECRET_KEY || !env.R2_BUCKET) {
    throw new Error("R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET env vars.");
  }

  s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
    },
  });
  return s3;
}

export async function processAndUpload(
  buffer: Buffer,
  restaurantId: string,
  menuItemId: string,
): Promise<string> {
  const processed = await sharp(buffer)
    .resize(MAX_WIDTH, MAX_WIDTH, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  const hash = crypto.createHash("md5").update(processed).digest("hex").slice(0, 8);
  const key = `menu/${restaurantId}/${menuItemId}-${hash}.webp`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
      Body: processed,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${env.R2_PUBLIC_URL}/${key}`;
}

export async function deleteImage(imageUrl: string): Promise<void> {
  const publicUrl = env.R2_PUBLIC_URL;
  if (!publicUrl || !imageUrl.startsWith(publicUrl)) return;

  const key = imageUrl.slice(publicUrl.length + 1); // strip leading /
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
    }),
  );
}
