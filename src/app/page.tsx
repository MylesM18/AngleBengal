import { redirect } from "next/navigation";

import { readResume } from "@/lib/resume/store";

// The redirect target comes from the database per request (D-156).
export const dynamic = "force-dynamic";

/**
 * The front door lands where the owner left off (D-156): readResume returns
 * only validated in-app tab paths and null on any failure, so the fallback
 * is the old behavior exactly.
 */
export default async function RootPage() {
  const resume = await readResume();
  redirect(resume?.path ?? "/learn");
}
