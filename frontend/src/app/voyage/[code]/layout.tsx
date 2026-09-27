import type { Metadata } from "next";

export const metadata: Metadata = { title: "Voyage" };

export default function Layout({ children }: LayoutProps<"/voyage/[code]">) {
  return children;
}
