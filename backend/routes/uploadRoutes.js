import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import { processCourseContent } from '../services/courseIntelligenceService.js';

dotenv.config();

const router = express.Router();

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 1000000000 } // 1GB Limit
});

async function extractTextFromUpload(file) {
    if (!file) return '';

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.txt', '.md', '.json', '.csv', '.html'].includes(ext)) {
        return fs.readFileSync(file.path, 'utf8');
    }

    if (ext === '.pdf') {
        try {
            const pdfParse = (await import('pdf-parse')).default;
            const parsed = await pdfParse(file.path);
            return parsed.text || '';
        } catch (error) {
            console.warn('PDF parsing is unavailable in this environment:', error.message);
            return '';
        }
    }

    if (ext === '.docx') {
        try {
            const mammoth = await import('mammoth');
            const parsed = await mammoth.extractRawText({ path: file.path });
            return parsed.value || '';
        } catch (error) {
            console.warn('DOCX parsing is unavailable in this environment:', error.message);
            return '';
        }
    }

    return '';
}

router.post('/', protect, upload.any(), async (req, res) => {
    try {
        const file = req.files?.[0] || req.file;
        const { courseId, lessonId, title, type, content } = req.body;

        if (!file && !content) {
            return res.status(400).json({ success: false, message: 'Please upload a file or provide content text' });
        }

        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        let result = null;
        let extractedText = content || '';

        if (file) {
            const isVideo = file.mimetype?.startsWith('video');
            const folder = isVideo ? 'edot/videos' : 'edot/files';

            result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_large(file.path, {
                    folder,
                    resource_type: 'auto',
                    type: isVideo ? 'authenticated' : 'upload',
                    chunk_size: 6000000
                }, (error, uploadResult) => {
                    if (error) reject(error);
                    else resolve(uploadResult);
                });
            });

            extractedText = extractedText || (await extractTextFromUpload(file));
        }

        let intelligenceDocument = null;
        if (courseId && extractedText.trim()) {
            try {
                intelligenceDocument = await processCourseContent({
                    courseId,
                    lessonId,
                    content: extractedText,
                    title: title || file?.originalname || 'Uploaded learning material',
                    type: type || 'document'
                });
            } catch (processingError) {
                console.warn('Course intelligence processing failed:', processingError.message);
            }
        }

        try {
            if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (unlinkErr) {
            console.error('Failed to clean up temp file:', unlinkErr);
        }

        const isVideo = file?.mimetype?.startsWith('video');
        const optimizedUrl = result
            ? cloudinary.url(result.public_id, {
                resource_type: isVideo ? 'video' : 'image',
                secure: true,
                fetch_format: 'auto',
                quality: 'auto'
            })
            : null;

        res.json({
            success: true,
            secure_url: optimizedUrl,
            filePath: optimizedUrl,
            raw_url: result?.secure_url || null,
            public_id: result?.public_id || null,
            duration: result?.duration || 0,
            extractedText: extractedText || '',
            intelligence: intelligenceDocument ? { id: intelligenceDocument.id, status: intelligenceDocument.status } : null
        });
    } catch (error) {
        console.error('Upload error:', error);

        if (req.file?.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
                console.error('Failed to clean up temp file on error:', unlinkErr);
            }
        }

        res.status(500).json({ success: false, message: error.message || 'Server error during upload' });
    }
});

export default router;
