import { NotificationsList } from '@/src/screens/NotificationsList';
import { teacherRouteFor } from '@/src/notifications/teacherRoutes';

export default function TeacherNotificationsRoute() {
  return <NotificationsList audience="teacher" routeFor={(n) => teacherRouteFor(n.type, n.data)} emptyText="When your work is reviewed, goes live, or a colleague hands you something, it shows up here." />;
}
