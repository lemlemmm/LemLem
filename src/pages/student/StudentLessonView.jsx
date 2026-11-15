import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import StatusBadge from '../../components/StatusBadge';
import JoinButton from '../../components/JoinButton';
import LessonMaterialItem from '../../components/LessonMaterialItem';

export default function StudentLessonView() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const [lesson, setLesson] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: l } = await supabase.from('lessons').select('*, groups(name)').eq('id', id).maybeSingle();
      setLesson(l);
      if (l && l.status === 'completed') {
        const { data: m } = await supabase
          .from('lesson_materials').select('*').eq('lesson_id', id).order('sort_order').order('title');
        setMaterials(m || []);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (!lesson) return <p className="muted">{t('lesson.notFound')}</p>;

  const unlocked = lesson.status === 'completed';

  return (
    <>
      <p><Link className="link" to="/student/lessons">← {t('lesson.back')}</Link></p>
      <h1>{lesson.title}</h1>
      <p className="muted">{fmtDateTime(lesson.starts_at, lang)} · {lesson.groups?.name}</p>
      <p><StatusBadge status={lesson.status} /></p>

      {!unlocked && (
        <div className="card locked">
          <div className="lock-icon">🔒</div>
          <h2>{t('student.locked')}</h2>
          <p>{t('student.lockedText')}</p>
          <JoinButton lesson={lesson} />
        </div>
      )}

      {unlocked && (
        <>
          {lesson.homework_note && (
            <div className="card">
              <h2>{t('student.homework')}</h2>
              <div className="pre">{lesson.homework_note}</div>
            </div>
          )}
          {materials.length === 0 && <p className="muted">{t('student.noMaterials')}</p>}
          {materials.map((m) => <LessonMaterialItem key={m.id} m={m} />)}
        </>
      )}
    </>
  );
}