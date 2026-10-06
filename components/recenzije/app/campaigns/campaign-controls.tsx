"use client";

import { useState, useTransition } from "react";
import { CircleStop, Pause, Play, Rocket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCampaignAction, setCampaignStatusAction } from "@/lib/recenzije/actions/campaigns";
import { Button } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent } from "@/components/recenzije/ui/dialog";

export function CampaignControls({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const run = (s: "ACTIVE" | "PAUSED" | "COMPLETED") =>
    start(async () => {
      const r = await setCampaignStatusAction(id, s);
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  return (
    <>
      {status === "DRAFT" && (
        <Button loading={pending} onClick={() => run("ACTIVE")}>
          <Rocket /> Pokreni
        </Button>
      )}
      {status === "ACTIVE" && (
        <Button variant="secondary" loading={pending} onClick={() => run("PAUSED")}>
          <Pause /> Pauziraj
        </Button>
      )}
      {status === "PAUSED" && (
        <Button loading={pending} onClick={() => run("ACTIVE")}>
          <Play /> Nastavi
        </Button>
      )}
      {(status === "ACTIVE" || status === "PAUSED") && (
        <Button variant="outline" disabled={pending} onClick={() => run("COMPLETED")}>
          <CircleStop /> Završi
        </Button>
      )}
      <Button variant="ghost" size="icon" aria-label="Obriši kampanju" onClick={() => setConfirm(true)}>
        <Trash2 />
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Obrisati kampanju?" description="Zakazane poruke iz ove kampanje se otkazuju. Već poslane poruke ostaju u popisu.">
          <form action={deleteCampaignAction.bind(null, id)} className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
              Odustani
            </Button>
            <Button type="submit" variant="danger">
              Obriši
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
