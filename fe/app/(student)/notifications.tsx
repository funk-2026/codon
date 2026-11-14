import { NotificationsList } from '@/src/screens/NotificationsList';
import { routeFromNotification } from '@/src/notifications/logic';

export default function NotificationsRoute() {
  return <NotificationsList routeFor={(n) => routeFromNotification(n.data)} emptyText="Updates about your reports and streak will show up here." />;
}
