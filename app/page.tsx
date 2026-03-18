import { redirect } from "next/navigation";

interface HomeProps {
  searchParams?: Promise<{
    code?: string;
    next?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};

  if (params.code) {
    const next = params.next ?? "/chat";
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}&next=${encodeURIComponent(next)}`);
  }

  redirect("/chat");
}
