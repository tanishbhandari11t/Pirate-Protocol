import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create Crew" };

export default function Layout({ children }: LayoutProps<"/crew/create">) {
  return children;
}
