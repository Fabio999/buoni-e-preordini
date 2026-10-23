import { createFileRoute } from "@tanstack/react-router";
import { PlanningPage } from "@/components/planning/PlanningPage";

export const Route = createFileRoute("/task-calendario")({
  head: () => ({ meta: [
    { title: "Task — Mana Flask" },
    { name: "description", content: "Attività, checklist, responsabili e scadenze Mana Flask, con eventi in programma separati." },
    { property: "og:title", content: "Task — Mana Flask" },
    { property: "og:description", content: "Gestisci le attività del negozio e consulta gli eventi in programma." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <PlanningPage mode="tasks" />,
});