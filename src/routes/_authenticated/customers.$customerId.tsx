import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/customers/$customerId",
)({
  component: CustomerProfilePage,
});

function CustomerProfilePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        Customer Profile
      </h1>

      <p>This page works.</p>
    </div>
  );
}