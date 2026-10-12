import { useParams } from "@solidjs/router";
import PublicDashboardPage from "~/components/dashboard/PublicDashboardPage";

export default function NamedPublicDashboard() {
  const params = useParams<{ namespace: string; slug: string }>();
  return <PublicDashboardPage endpoint={`/api/dashboards/resolve?namespace=${encodeURIComponent(params.namespace)}&slug=${encodeURIComponent(params.slug)}`} />;
}
