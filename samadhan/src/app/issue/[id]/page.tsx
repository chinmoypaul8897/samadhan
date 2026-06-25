import { IssueDetail } from "@/components/issue/IssueDetail";

// The tracked issue (data-shapes §6). Public (isPublic) — shareable. params is async
// in Next 16. Shown inside the app shell (top bar + bottom nav), not full-focus.
export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IssueDetail issueId={id} />;
}
