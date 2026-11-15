import { supabase } from './supabase';

export const safeName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

// Opens a private file from the 'materials' bucket in a new tab (link valid for 2 minutes)
export async function openStorageFile(path) {
  const w = window.open('', '_blank'); // opened first so phones do not block it
  const { data, error } = await supabase.storage.from('materials').createSignedUrl(path, 120);
  if (error || !data?.signedUrl) {
    if (w) w.close();
    throw new Error(error?.message || 'Could not open the file');
  }
  if (w) { w.opener = null; w.location.href = data.signedUrl; }
  else window.location.href = data.signedUrl;
}