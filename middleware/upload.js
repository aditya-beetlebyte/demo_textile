import multer from 'multer';

const memory = multer.memoryStorage();

export const completionUpload = multer({
  storage: memory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file || !file.mimetype.startsWith('image/')) {
      const err = new Error('Only image uploads are allowed');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});
