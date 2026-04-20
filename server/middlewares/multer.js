import multer from 'multer';
import fs from 'fs';
import path from 'path';

const uploadDir = 'public/resumes';   // Better to use a dedicated subfolder

// Ensure the directory exists (create it if not)
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);   // Use the variable for clarity
    },
    filename: function (req, file, cb) {
        // Better filename: timestamp + original extension (safer)
        const ext = path.extname(file.originalname);
        const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
        cb(null, filename);
    }
});

export const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 5 * 1024 * 1024   // 5MB
    },
    fileFilter: function (req, file, cb) {
        // Only allow PDFs
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});