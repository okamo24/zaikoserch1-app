import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile } = await requireUser();

  return (
    <AppShell role={profile?.role ?? "user"} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
