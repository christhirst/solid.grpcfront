import { useParams } from "@solidjs/router";
import PublicDashboardPage from "~/components/dashboard/PublicDashboardPage";

export default function LegacyPublicDashboard() {
  const params = useParams<{ id: string }>();
  return <PublicDashboardPage endpoint={`/api/dashboards/${encodeURIComponent(params.id)}`} />;
}
