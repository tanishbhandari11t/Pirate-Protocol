import type { Metadata } from "next";

export const metadata: Metadata = { title: "Waiting Room" };

export default function Layout({ children }: LayoutProps<"/lobby/[code]">) {
  return children;
}
