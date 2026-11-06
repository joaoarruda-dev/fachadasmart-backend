import multer from "multer";

const MB = 1024 * 1024;
export const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * MB,  // por arquivo
    files: 4,
    fieldSize: 15 * MB, // logoElements vem como base64 em campo de texto (padrão do multer é 1MB)
  },
  fileFilter: (_req, file, cb) => {
    if (TIPOS_ACEITOS.includes(file.mimetype)) return cb(null, true);
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", `${file.fieldname} (tipo ${file.mimetype} não suportado)`));
  },
});

export default upload;
