import TeacherDashboard from './teacher/TeacherDashboard';
import StudentDashboard from './student/StudentDashboard';

export default function Dashboard({ role }) {
  return role === 'teacher' ? <TeacherDashboard /> : <StudentDashboard />;
}