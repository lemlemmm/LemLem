import { supabase } from './supabase';

// Calls the secure Edge Function and returns a readable error message
export async function callStudentFunction(body) {
  const { data, error } = await supabase.functions.invoke('manage-students', { body });
  if (error) {
    let message = error.message;
    try {
      const j = await error.context.json();
      if (j?.error) message = j.error;
    } catch (_) { /* keep default message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}