import type { Metadata } from "next";

export const metadata: Metadata = { title: "Join Crew" };

export default function Layout({ children }: LayoutProps<"/crew/join">) {
  return children;
}
