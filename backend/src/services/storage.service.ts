import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'insightforge-reports';

let supabase: any = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL !== 'https://your-supabase-url.supabase.co') {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export async function uploadReportPDF(reportId: number, buffer: Buffer): Promise<string> {
  const fileName = `report_${reportId}_${Date.now()}.pdf`;

  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(fileName, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        console.log(`Uploaded report ${reportId} to Supabase: ${publicUrlData.publicUrl}`);
        return publicUrlData.publicUrl;
      }
    } catch (err) {
      console.warn('Supabase storage upload failed, falling back to local file storage:', err);
    }
  }

  // Fallback to local storage
  const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, buffer);

  const localUrl = `http://localhost:5000/uploads/${fileName}`;
  console.log(`Uploaded report ${reportId} to local storage: ${localUrl}`);
  return localUrl;
}
