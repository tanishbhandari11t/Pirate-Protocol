import type { Metadata } from "next";

export const metadata: Metadata = { title: "Design System" };

export default function Layout({ children }: LayoutProps<"/design">) {
  return children;
}
