import multer from 'multer';
import path from 'path';

// Files are held in memory and streamed straight to Cloudinary — nothing is
// written to the server's (ephemeral) disk.
const storage = multer.memoryStorage();

const imageOnlyFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else {
    const err: any = new Error('Only JPG, PNG, GIF or WebP photos are allowed');
    err.status = 400;
    cb(err);
  }
};

export const menuUpload = multer({ storage, fileFilter: imageOnlyFilter, limits: { fileSize: 5 * 1024 * 1024 } });
