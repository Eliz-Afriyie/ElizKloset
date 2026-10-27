import Skeleton from "../../../components/Skeleton";
import AdminAuthLayout from "../../ui/AdminAuthLayout";
export default function Loading() { return <AdminAuthLayout step={2} title="Verify your sign-in." introduction="Preparing verification."><Skeleton variant="form" label="Preparing verification" /></AdminAuthLayout>; }
