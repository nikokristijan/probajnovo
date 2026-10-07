import { Suspense } from "react";
import { SearchX, Users } from "lucide-react";
import { AddClientDialog } from "@/components/recenzije/app/clients/add-client-dialog";
import { ImportClientsDialog } from "@/components/recenzije/app/clients/import-clients-dialog";
import { ClientFilters } from "@/components/recenzije/app/clients/client-filters";
import { ClientsTable } from "@/components/recenzije/app/clients/clients-table";
import { Pagination } from "@/components/recenzije/app/pagination";
import { Card, EmptyState, PageHeader } from "@/components/recenzije/ui/primitives";
import { requireOrg } from "@/lib/recenzije/session";
import { listClients } from "@/lib/recenzije/services/clients";

export const metadata = { title: "Klijenti" };

type SP = Record<string, string | undefined>;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  const data = await listClients(ctx.org.id, {
    q: sp.q,
    status: sp.status,
    service: sp.service,
    technician: sp.technician,
    sort: sp.sort,
    dir: sp.dir,
    page: Number(sp.page) || 1,
    pageSize: 10,
  });
  const filtered = Boolean(sp.q || sp.status || sp.service || sp.technician);

  return (
    <>
      <PageHeader
        kicker="Klijenti"
        title="Klijenti"
        description="Svi za koje ste radili i gdje su na putu do recenzije."
        actions={
          <>
            <ImportClientsDialog />
            <AddClientDialog services={data.serviceOptions} technicians={data.technicianOptions} openToClient />
          </>
        }
      />
      <Card className="overflow-hidden">
        {data.total === 0 && !filtered ? (
          <EmptyState
            icon={Users}
            title="Dodajte prvog klijenta"
            description="Dodajte klijenta nakon posla ili uvezite popis koji je tvrtka poslala. Zahtjev za recenziju šalje se sam."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ImportClientsDialog />
                <AddClientDialog services={data.serviceOptions} technicians={data.technicianOptions} openToClient />
              </div>
            }
          />
        ) : (
          <>
            <Suspense>
              <ClientFilters services={data.serviceOptions} technicians={data.technicianOptions} />
            </Suspense>
            {data.rows.length === 0 ? (
              <EmptyState icon={SearchX} title="Nema klijenata za ove filtere" description="Probajte drugu pretragu ili očistite filtere." />
            ) : (
              <Suspense>
                <ClientsTable rows={data.rows} />
              </Suspense>
            )}
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/recenzije/klijenti" params={sp} />
          </>
        )}
      </Card>
    </>
  );
}
