import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <PageHeader
      eyebrow="Admin"
      title="Control room"
      description="Users, draws, charities, winners and reporting."
    />
  );
}
