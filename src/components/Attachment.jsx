import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import FileLink from './FileLink';

// Shows an image inline, or a button for any other file
export default function Attachment({ path, name, type }) {
  const isImage = (type || '').startsWith('image/');
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isImage) return undefined;
    let off = false;
    supabase.storage.from('materials').createSignedUrl(path, 3600).then(({ data }) => {
      if (off) return;
      if (data?.signedUrl) setUrl(data.signedUrl);
      else setFailed(true);
    });
    return () => { off = true; };
  }, [path, isImage]);

  if (isImage && !failed) {
    if (!url) return <span className="muted">…</span>;
    return (
      <img
        src={url}
        alt={name || ''}
        className="chat-img"
        onClick={() => window.open(url, '_blank', 'noopener')}
        onError={() => setFailed(true)}
      />
    );
  }
  return <FileLink path={path} name={name} />;
}