import { createFileRoute } from "@tanstack/react-router";
import { PlanningPage } from "@/components/planning/PlanningPage";

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [
    { title: "Calendario — Mana Flask" },
    { name: "description", content: "Calendario degli eventi Mana Flask con orari, appuntamenti e date alternative." },
    { property: "og:title", content: "Calendario — Mana Flask" },
    { property: "og:description", content: "Consulta e modifica gli eventi del negozio nelle viste giorno, settimana e mese." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <PlanningPage mode="calendar" />,
});