import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { randomUUID } from 'crypto';

const BUCKET = 'admin-uploads';
const ALLOWED_FOLDERS = new Set(['avatars', 'merchants', 'products', 'gallery']);

export class AdminUploadsController {
    async upload(req: Request, res: Response) {
        try {
            const folderRaw = String(req.body?.folder || req.query?.folder || 'gallery').toLowerCase();
            const folder = ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : 'gallery';

            // Prefer multer-style file; also accept base64 data URL in JSON body
            const file = (req as any).file as
                | { buffer: Buffer; mimetype: string; originalname?: string }
                | undefined;

            let buffer: Buffer | null = null;
            let mime = 'image/jpeg';
            let ext = 'jpg';

            if (file?.buffer) {
                buffer = file.buffer;
                mime = file.mimetype || mime;
            } else if (typeof req.body?.data_url === 'string' && req.body.data_url.startsWith('data:')) {
                const match = /^data:([^;]+);base64,(.+)$/.exec(req.body.data_url);
                if (!match) {
                    return res.status(400).json({ success: false, message: 'Invalid data_url' });
                }
                mime = match[1];
                buffer = Buffer.from(match[2], 'base64');
            } else if (typeof req.body?.url === 'string' && /^https?:\/\//i.test(req.body.url)) {
                // Pass-through hosted URL without re-upload
                return res.status(200).json({
                    success: true,
                    message: 'URL accepted',
                    data: { url: String(req.body.url).trim(), folder },
                });
            }

            if (!buffer) {
                return res.status(400).json({
                    success: false,
                    message: 'Provide a file, data_url, or url',
                });
            }

            if (mime.includes('png')) ext = 'png';
            else if (mime.includes('webp')) ext = 'webp';
            else if (mime.includes('gif')) ext = 'gif';
            else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';

            const path = `${folder}/${randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
                contentType: mime,
                upsert: false,
            });

            if (error) {
                return res.status(400).json({ success: false, message: error.message, data: null });
            }

            const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
            return res.status(201).json({
                success: true,
                message: 'Uploaded',
                data: { url: publicData.publicUrl, path, folder },
            });
        } catch (e: any) {
            return res.status(500).json({ success: false, message: e.message || 'Upload failed' });
        }
    }
}
