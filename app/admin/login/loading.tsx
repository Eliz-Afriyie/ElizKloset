import Skeleton from "../../components/Skeleton";
import AdminAuthLayout from "../ui/AdminAuthLayout";
export default function Loading() { return <AdminAuthLayout step={1} title="Welcome back." introduction="Preparing staff sign-in."><Skeleton variant="form" label="Loading staff sign-in" /></AdminAuthLayout>; }
