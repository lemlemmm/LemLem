import { useState } from 'react';
import { useLang } from '../i18n/LanguageContext';

const SOURCES = ['/mascot/logo.png', '/mascot/idle.png'];

export default function Logo() {
  const { t } = useLang();
  const [i, setI] = useState(0);
  return (
    <div className="logo">
      {i < SOURCES.length ? (
        <img src={SOURCES[i]} alt="" className="logo-img" onError={() => setI(i + 1)} />
      ) : (
        <span>🐹</span>
      )}
      <span>{t('app.name')}</span>
    </div>
  );
}