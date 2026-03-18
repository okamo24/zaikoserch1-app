import { Suspense } from "react";
import { AuthConfirmClient } from "@/components/auth/auth-confirm-client";
import { sanitizeNextPath } from "@/lib/utils/navigation";

interface AuthConfirmPageProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export default async function AuthConfirmPage({
  searchParams,
}: AuthConfirmPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);

  return (
    <Suspense fallback={null}>
      <AuthConfirmClient nextPath={nextPath} />
    </Suspense>
  );
}
