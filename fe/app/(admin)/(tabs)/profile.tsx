import { StaffProfileScreen } from '@/src/screens/StaffProfileScreen';
import { ROUTES } from '@/src/navigation/routes';

export default function AdminProfileTab() {
  return (
    <StaffProfileScreen
      roleLabel="Admin"
      canSwitchRole
      routes={{ manageDevices: ROUTES.admin.manageDevices, giveFeedback: ROUTES.admin.giveFeedback }}
    />
  );
}
