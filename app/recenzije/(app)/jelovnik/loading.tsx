import { Skeleton } from "@/components/recenzije/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Učitavanje jelovnika">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <Skeleton className="mt-8 h-56 w-full" />
      <Skeleton className="mt-6 h-11 w-full" />
      <div className="mt-6 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
