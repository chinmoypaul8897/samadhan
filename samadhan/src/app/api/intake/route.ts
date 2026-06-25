import { NextResponse } from "next/server";

// C2 STUB. The real Genkit intake flow (Perceive→Locate→Dedup→Route→Act) is built
// in C3 as `export const POST = appRoute(intakeFlow)`. The request contract is
// FROZEN here as the Genkit-shaped {data:{reportId}} envelope so the C3 swap keeps
// the same client contract. Response body is irrelevant — the kick is fire-and-forget
// and the report's onSnapshot trace drives the UI.
export async function POST(req: Request) {
  let reportId: string | undefined;
  try {
    const body = await req.json();
    reportId = body?.data?.reportId;
  } catch {
    /* fall through to 400 */
  }

  if (!reportId || typeof reportId !== "string") {
    return NextResponse.json(
      { error: "data.reportId required", code: "bad_request" },
      { status: 400 },
    );
  }

  return NextResponse.json({ result: { accepted: true, reportId } });
}
