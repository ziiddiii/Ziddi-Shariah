import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/investments")({
  head: () => ({
    meta: [
      { title: "Investment Centre — ZIIDI Shari'ah" },
      { name: "description", content: "Explore ZIIDI Shari'ah investment plans and manage your invested returns." },
      { property: "og:title", content: "Investment Centre — ZIIDI Shari'ah" },
      { property: "og:description", content: "Explore investment plans and manage your ZIIDI Shari'ah returns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvestmentsLayout,
});

function InvestmentsLayout() {
  return <Outlet />;
}