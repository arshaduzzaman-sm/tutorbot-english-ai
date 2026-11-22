import { notFound } from "next/navigation";
import { PlacementRunner } from "@/components/placement/placement-runner";
import { PlacementQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Placement test" };
export const dynamic = "force-dynamic";

export default async function PlacementPage() {
  const { accessToken } = await requireSession("/placement");
  const data = await serverQuery(accessToken, PlacementQuery);
  if (!data.placementTest) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <PlacementRunner test={data.placementTest} levels={data.learningLevels} />
    </div>
  );
}
