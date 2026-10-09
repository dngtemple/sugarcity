import { v2 as cloudinary } from 'cloudinary';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export const isCloudinaryConfigured = (): boolean =>
  !!(CLOUD_NAME && API_KEY && API_SECRET);

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
} else {
  console.warn(
    '[cloudinary] CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / ' +
      'CLOUDINARY_API_SECRET are not all set — file uploads will fail until ' +
      'they are configured.'
  );
}

const assertConfigured = () => {
  if (!isCloudinaryConfigured()) {
    const err: any = new Error('File storage is not configured');
    err.status = 503;
    throw err;
  }
};

function uploadStream(buffer: Buffer, options: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) return reject(err || new Error('Cloudinary upload failed'));
      resolve(result);
    });
    stream.end(buffer);
  });
}

// Menu images are public. The ready-to-use delivery URL is stored directly so
// the client/admin can render it without any server round-trip.
export async function uploadMenuImage(buffer: Buffer): Promise<string> {
  assertConfigured();
  const result = await uploadStream(buffer, {
    folder: 'sugarcity/menu',
    type: 'upload',
    resource_type: 'image',
  });
  return result.secure_url as string;
}

// Best-effort delete of a menu image, given the secure_url stored on the item.
// Values that aren't Cloudinary delivery URLs yield no public_id and are skipped.
export async function deleteMenuImage(imageUrl: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  const publicId = publicIdFromUrl(imageUrl);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type: 'upload' });
  } catch (err) {
    console.error('[cloudinary] failed to delete menu image:', (err as Error).message);
  }
}

// Pull the public_id out of a delivery URL we generated, e.g.
// https://res.cloudinary.com/<cloud>/image/upload/v123/sugarcity/menu/abc.jpg
function publicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  return match ? match[1] : null;
}
