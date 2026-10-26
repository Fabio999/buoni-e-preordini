import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/saldo")({
  beforeLoad: () => {
    throw redirect({ to: "/clienti", search: { tab: "buoni" }, replace: true });
  },
});
