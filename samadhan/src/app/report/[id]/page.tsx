import { ProcessingView } from "@/components/report/ProcessingView";

// Live processing screen for a single report. params is async in Next 16.
export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProcessingView reportId={id} />;
}
