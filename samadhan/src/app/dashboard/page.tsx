import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Samadhan — public civic impact",
  description:
    "Honest civic metrics for Bengaluru: resolution rate, median time-to-resolve, and a live hotspot map. From report to resolution.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
