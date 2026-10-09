import { Skeleton } from "@/components/recenzije/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Učitavanje plakata">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="border border-border bg-surface-2 p-4 sm:p-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Skeleton className="mx-auto aspect-[210/297] w-full max-w-[440px]" />
        </div>
        <Skeleton className="h-64 lg:col-start-2 lg:row-start-1" />
        <Skeleton className="h-56 lg:col-start-2 lg:row-start-2" />
      </div>
    </div>
  );
}
