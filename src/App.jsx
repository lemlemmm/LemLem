import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import ComingSoon from './pages/ComingSoon';
import Notifications from './pages/Notifications';
import Groups from './pages/teacher/Groups';
import Students from './pages/teacher/Students';
import StudentDetail from './pages/teacher/StudentDetail';
import Schedule from './pages/teacher/Schedule';
import Lessons from './pages/teacher/Lessons';
import LessonDetail from './pages/teacher/LessonDetail';
import Attendance from './pages/teacher/Attendance';
import Payments from './pages/teacher/Payments';
import StudentPayments from './pages/teacher/StudentPayments';
import Homework from './pages/teacher/Homework';
import HomeworkDetail from './pages/teacher/HomeworkDetail';
import HomeworkSubmission from './pages/teacher/HomeworkSubmission';
import Tests from './pages/teacher/Tests';
import TestDetail from './pages/teacher/TestDetail';
import TestSubmission from './pages/teacher/TestSubmission';
import Messages from './pages/teacher/Messages';
import Progress from './pages/teacher/Progress';
import StudentSchedule from './pages/student/StudentSchedule';
import StudentLessons from './pages/student/StudentLessons';
import StudentLessonView from './pages/student/StudentLessonView';
import MyPayments from './pages/student/MyPayments';
import StudentHomework from './pages/student/StudentHomework';
import HomeworkDo from './pages/student/HomeworkDo';
import StudentTests from './pages/student/StudentTests';
import TestTake from './pages/student/TestTake';
import StudentMessages from './pages/student/StudentMessages';
import StudentSelfStudy from './pages/student/StudentSelfStudy';
import SelfStudyLesson from './pages/student/SelfStudyLesson';
import MyProgress from './pages/student/MyProgress';
import { useAuth } from './lib/AuthContext';
import { teacherNav, studentNav } from './lib/nav';
import Materials from './pages/teacher/Materials';
import StudentMaterials from './pages/student/StudentMaterials';

function HomeRedirect() {
  const { profile } = useAuth();
  return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} replace />;
}

// Sections not built yet get a placeholder. `built` lists sections that have real pages.
const placeholders = (keys, built = []) =>
  keys
    .filter((k) => !['dashboard', 'settings', ...built].includes(k))
    .map((k) => <Route key={k} path={k} element={<ComingSoon titleKey={`nav.${k}`} />} />);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />

      <Route path="/teacher" element={<ProtectedRoute role="teacher"><Layout role="teacher" /></ProtectedRoute>}>
        <Route index element={<Dashboard role="teacher" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="groups" element={<Groups />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="lessons/:id" element={<LessonDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/:id" element={<StudentPayments />} />
        <Route path="homework" element={<Homework />} />
        <Route path="homework/:id" element={<HomeworkDetail />} />
        <Route path="homework/:id/submissions/:studentId" element={<HomeworkSubmission />} />
        <Route path="tests" element={<Tests />} />
        <Route path="tests/:id" element={<TestDetail />} />
        <Route path="tests/:id/submissions/:studentId" element={<TestSubmission />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:studentId" element={<Messages />} />
        <Route path="progress" element={<Progress />} />
        <Route path="progress/:studentId" element={<Progress />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="materials" element={<Materials />} />
        {placeholders(teacherNav, [
          'groups', 'students', 'schedule', 'lessons', 'attendance', 'payments',
          'homework', 'tests', 'messages', 'progress', 'materials',
        ])}
      </Route>

      <Route path="/student" element={<ProtectedRoute role="student"><Layout role="student" /></ProtectedRoute>}>
        <Route index element={<Dashboard role="student" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="schedule" element={<StudentSchedule />} />
        <Route path="lessons" element={<StudentLessons />} />
        <Route path="lessons/:id" element={<StudentLessonView />} />
        <Route path="payments" element={<MyPayments />} />
        <Route path="homework" element={<StudentHomework />} />
        <Route path="homework/:id" element={<HomeworkDo />} />
        <Route path="tests" element={<StudentTests />} />
        <Route path="tests/:id" element={<TestTake />} />
        <Route path="messages" element={<StudentMessages />} />
        <Route path="selfstudy" element={<StudentSelfStudy />} />
        <Route path="selfstudy/:id" element={<SelfStudyLesson />} />
        <Route path="progress" element={<MyProgress />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="materials" element={<StudentMaterials />} />
        {placeholders(studentNav, [
          'schedule', 'lessons', 'payments', 'homework', 'tests', 'messages', 'selfstudy', 'progress', 'materials',
        ])}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}