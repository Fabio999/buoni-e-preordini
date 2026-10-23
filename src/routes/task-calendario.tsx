import { createFileRoute } from "@tanstack/react-router";
import { PlanningPage } from "@/components/planning/PlanningPage";

export const Route = createFileRoute("/task-calendario")({
  head: () => ({ meta: [
    { title: "Task — Mana Flask" },
    { name: "description", content: "Attività, checklist, responsabili e scadenze del negozio Mana Flask." },
    { property: "og:title", content: "Task — Mana Flask" },
    { property: "og:description", content: "Gestisci le attività, le checklist e le scadenze del negozio Mana Flask." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <PlanningPage mode="tasks" />,
});