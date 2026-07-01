import { createClient } from '@supabase/supabase-js';

const BUCKET = 'crm-files';

function bucket() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ).storage.from(BUCKET);
}

export async function uploadFile(storedName: string, buffer: Buffer, mimeType: string) {
  const { error } = await bucket().upload(storedName, buffer, { contentType: mimeType });
  if (error) throw error;
}

export async function downloadFile(storedName: string): Promise<Blob> {
  const { data, error } = await bucket().download(storedName);
  if (error) throw error;
  return data;
}

export async function deleteFile(storedName: string) {
  const { error } = await bucket().remove([storedName]);
  if (error) throw error;
}
