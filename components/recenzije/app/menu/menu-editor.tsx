"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, FileText, FolderPlus, Info, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import {
  createCategoryAction,
  createItemAction,
  deleteCategoryAction,
  deleteItemAction,
  moveCategoryAction,
  moveItemAction,
  setItemAvailableAction,
  updateCategoryAction,
  updateItemAction,
} from "@/lib/recenzije/actions/menu";
import { Button } from "@/components/recenzije/ui/button";
import { Dialog, DialogContent, Switch } from "@/components/recenzije/ui/dialog";
import { Alert, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, Textarea } from "@/components/recenzije/ui/primitives";
import { formatPriceCents, priceCentsToInput } from "@/lib/recenzije/menu-format";
import { plural, type CategoryDTO, type ItemDTO } from "./menu-types";

type CatDialog = { mode: "create" } | { mode: "edit"; category: CategoryDTO } | null;
type ItemTarget = { mode: "create"; categoryId: string } | { mode: "edit"; item: ItemDTO; categoryId: string };
type ItemDialog = (ItemTarget & { nonce: number }) | null;
type DeleteTarget = { kind: "category"; id: string; name: string; items: number } | { kind: "item"; id: string; name: string } | null;

/** Polja uz koja se greška prikazuje u obrascu stavke; za sve ostalo greška ide u obavijest. */
const ITEM_FIELDS = ["name", "price", "description", "allergens", "categoryId", "nameEn", "descriptionEn"];

function IconBtn({ label, onClick, disabled, children, danger }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean }) {
  return (
    <Button type="button" size="icon" variant="ghost" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={danger ? "hover:text-danger" : undefined}>
      {children}
    </Button>
  );
}

/** Uređivanje jelovnika: kategorije i stavke (dodaj, uredi, obriši, redoslijed gore/dolje, dostupnost). */
export function MenuEditor({
  categories,
  readOnly,
  hasExternalUrl,
  onGoImport,
}: {
  categories: CategoryDTO[];
  readOnly: boolean;
  hasExternalUrl: boolean;
  onGoImport: () => void;
}) {
  const [busy, run] = useTransition();
  const [catDialog, setCatDialog] = useState<CatDialog>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialog>(null);
  const [del, setDel] = useState<DeleteTarget>(null);
  const nonce = useRef(0);

  const totalItems = categories.reduce((n, c) => n + c.items.length, 0);

  function move(kind: "category" | "item", id: string, dir: "up" | "down") {
    run(async () => {
      const r = kind === "category" ? await moveCategoryAction(id, dir) : await moveItemAction(id, dir);
      if (!r.ok) toast.error(r.error);
    });
  }

  function openItem(d: ItemTarget) {
    nonce.current += 1;
    setItemDialog({ ...d, nonce: nonce.current });
  }

  function confirmDelete() {
    if (!del) return;
    const target = del;
    run(async () => {
      const r = target.kind === "category" ? await deleteCategoryAction(target.id) : await deleteItemAction(target.id);
      if (r.ok) {
        toast.success(r.message);
        setDel(null);
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {hasExternalUrl && (
        <Alert tone="blue" icon={Info} title="Stavke se trenutno ne prikazuju gostima">
          U Postavkama je upisana adresa vašeg jelovnika, pa gost nakon unosa broja ide na nju. Uklonite tu adresu ako želite prikazati ovaj jelovnik.
        </Alert>
      )}

      <Card>
        <CardHeader
          title="Kategorije i stavke"
          description={categories.length ? `${categories.length} ${plural(categories.length, "kategorija", "kategorije", "kategorija")}, ${totalItems} ${plural(totalItems, "stavka", "stavke", "stavki")}. Redoslijed je isti kao na stranici za goste.` : "Dodajte kategorije (npr. Pizze, Pića) i u njih stavke."}
          action={
            !readOnly && (
              <Button size="sm" variant="secondary" onClick={() => setCatDialog({ mode: "create" })}>
                <FolderPlus /> Nova kategorija
              </Button>
            )
          }
        />
        <CardBody className="space-y-4">
          {categories.length === 0 ? (
            <EmptyState
              className="py-10"
              icon={UtensilsCrossed}
              title="Jelovnik je prazan"
              description="Dodajte prvu kategoriju ili zalijepite tekst jelovnika u Brzi uvoz, pa se kategorije i stavke naprave same."
              action={
                !readOnly && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button onClick={() => setCatDialog({ mode: "create" })}>
                      <FolderPlus /> Dodaj kategoriju
                    </Button>
                    <Button variant="secondary" onClick={onGoImport}>
                      <FileText /> Brzi uvoz iz teksta
                    </Button>
                  </div>
                )
              }
            />
          ) : (
            categories.map((c, ci) => (
              <section key={c.id} className="min-w-0 border border-border" aria-label={c.name}>
                <header className="border-b border-border bg-surface-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-[15px] font-bold leading-snug">{c.name}</h3>
                      {c.nameEn && <p className="break-words text-xs text-subtle">EN: {c.nameEn}</p>}
                    </div>
                    <span className="label shrink-0 pt-1 text-muted">
                      {c.items.length} {plural(c.items.length, "stavka", "stavke", "stavki")}
                    </span>
                  </div>
                  {!readOnly && (
                    <div className="-ml-2 mt-2 flex flex-wrap items-center gap-x-0.5 gap-y-1">
                      <IconBtn label={`Pomakni kategoriju ${c.name} gore`} disabled={busy || ci === 0} onClick={() => move("category", c.id, "up")}>
                        <ArrowUp />
                      </IconBtn>
                      <IconBtn label={`Pomakni kategoriju ${c.name} dolje`} disabled={busy || ci === categories.length - 1} onClick={() => move("category", c.id, "down")}>
                        <ArrowDown />
                      </IconBtn>
                      <IconBtn label={`Uredi kategoriju ${c.name}`} onClick={() => setCatDialog({ mode: "edit", category: c })}>
                        <Pencil />
                      </IconBtn>
                      <IconBtn label={`Obriši kategoriju ${c.name}`} danger onClick={() => setDel({ kind: "category", id: c.id, name: c.name, items: c.items.length })}>
                        <Trash2 />
                      </IconBtn>
                      <Button size="sm" variant="outline" className="ml-auto" onClick={() => openItem({ mode: "create", categoryId: c.id })}>
                        <Plus /> Dodaj stavku
                      </Button>
                    </div>
                  )}
                </header>
                {c.items.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted">Kategorija je prazna. Gosti je ne vide dok u njoj nema stavki.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {c.items.map((it, ii) => (
                      <ItemRow
                        key={it.id}
                        item={it}
                        readOnly={readOnly}
                        busy={busy}
                        first={ii === 0}
                        last={ii === c.items.length - 1}
                        onMove={(dir) => move("item", it.id, dir)}
                        onEdit={() => openItem({ mode: "edit", item: it, categoryId: c.id })}
                        onDelete={() => setDel({ kind: "item", id: it.id, name: it.name })}
                      />
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </CardBody>
      </Card>

      <Dialog open={catDialog !== null} onOpenChange={(o) => !o && setCatDialog(null)}>
        <DialogContent title={catDialog?.mode === "edit" ? "Uredi kategoriju" : "Nova kategorija"} description="Npr. Pizze, Tjestenine, Topli napitci.">
          {catDialog && <CategoryForm category={catDialog.mode === "edit" ? catDialog.category : null} onDone={() => setCatDialog(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialog !== null} onOpenChange={(o) => !o && setItemDialog(null)}>
        <DialogContent title={itemDialog?.mode === "edit" ? "Uredi stavku" : "Nova stavka"} description="Cijena je u eurima, npr. 5,50." wide>
          {itemDialog && (
            <ItemForm
              key={itemDialog.nonce}
              item={itemDialog.mode === "edit" ? itemDialog.item : null}
              categoryId={itemDialog.categoryId}
              categories={categories}
              onDone={(again) => {
                if (again && itemDialog.mode === "create") openItem({ mode: "create", categoryId: itemDialog.categoryId });
                else setItemDialog(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={del !== null} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent
          title={del?.kind === "category" ? "Obrisati kategoriju?" : "Obrisati stavku?"}
          description={del ? (del.kind === "category" ? `„${del.name}” i ${del.items} ${plural(del.items, "stavka", "stavke", "stavki")} u njoj bit će trajno obrisani.` : `„${del.name}” bit će trajno obrisana.`) : undefined}
        >
          <p className="text-sm text-foreground/80">Ovo se ne može poništiti. Ako stavka samo trenutno nije u ponudi, bolje je isključiti „Dostupno”.</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setDel(null)}>
              Odustani
            </Button>
            <Button type="button" variant="danger" loading={busy} onClick={confirmDelete}>
              <Trash2 /> Obriši
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemRow({
  item,
  readOnly,
  busy,
  first,
  last,
  onMove,
  onEdit,
  onDelete,
}: {
  item: ItemDTO;
  readOnly: boolean;
  busy: boolean;
  first: boolean;
  last: boolean;
  onMove: (dir: "up" | "down") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pending, start] = useTransition();
  const [available, setAvailable] = useOptimistic(item.available);

  function toggle(next: boolean) {
    start(async () => {
      setAvailable(next);
      const r = await setItemAvailableAction(item.id, next);
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`break-words text-[15px] font-bold leading-snug ${available ? "" : "text-muted line-through decoration-1"}`}>{item.name}</p>
          {item.description && <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-muted">{item.description}</p>}
          {item.allergens && <p className="mt-1 break-words text-xs text-subtle">Alergeni: {item.allergens}</p>}
          {(item.nameEn || item.descriptionEn) && <p className="mt-1 break-words text-xs text-subtle">EN: {item.nameEn ?? item.name}</p>}
        </div>
        <p className="tabular shrink-0 pt-0.5 text-[15px] font-bold">{formatPriceCents(item.priceCents)}</p>
      </div>
      <div className="-ml-2 mt-1.5 flex flex-wrap items-center gap-x-0.5 gap-y-1">
        <label className="mr-1 flex min-h-10 cursor-pointer items-center gap-2 pl-2 pr-1 text-[13px]">
          <Switch checked={available} onCheckedChange={toggle} disabled={readOnly || pending} label={`${item.name}: dostupno gostima`} />
          <span className={available ? "text-foreground" : "text-muted"}>{available ? "Dostupno" : "Nedostupno"}</span>
        </label>
        {!readOnly && (
          <span className="ml-auto flex items-center gap-0.5">
            <IconBtn label={`Pomakni ${item.name} gore`} disabled={busy || first} onClick={() => onMove("up")}>
              <ArrowUp />
            </IconBtn>
            <IconBtn label={`Pomakni ${item.name} dolje`} disabled={busy || last} onClick={() => onMove("down")}>
              <ArrowDown />
            </IconBtn>
            <IconBtn label={`Uredi ${item.name}`} onClick={onEdit}>
              <Pencil />
            </IconBtn>
            <IconBtn label={`Obriši ${item.name}`} danger onClick={onDelete}>
              <Trash2 />
            </IconBtn>
          </span>
        )}
      </div>
    </li>
  );
}

function CategoryForm({ category, onDone }: { category: CategoryDTO | null; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(category?.name ?? "");
  const [nameEn, setNameEn] = useState(category?.nameEn ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const input = { name, nameEn: nameEn.trim() || null };
      const r = category ? await updateCategoryAction(category.id, input) : await createCategoryAction(input);
      if (r.ok) {
        toast.success(r.message);
        onDone();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Naziv" htmlFor="c-name" error={error ?? undefined}>
        <Input id="c-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" aria-invalid={error ? true : undefined} />
      </Field>
      <details className="border border-border bg-surface-2 px-3 py-2.5 [&[open]>summary]:mb-3" open={Boolean(category?.nameEn)}>
        <summary className="label flex min-h-6 cursor-pointer select-none items-center text-muted">Engleski</summary>
        <Field label="Naziv (engleski)" htmlFor="c-name-en" hint="Neobavezno. Vidi se kad gost prebaci jelovnik na EN.">
          <Input id="c-name-en" value={nameEn} maxLength={120} onChange={(e) => setNameEn(e.target.value)} autoComplete="off" />
        </Field>
      </details>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Odustani
        </Button>
        <Button type="submit" loading={pending}>
          {category ? "Spremi" : "Dodaj kategoriju"}
        </Button>
      </div>
    </form>
  );
}

function ItemForm({
  item,
  categoryId,
  categories,
  onDone,
}: {
  item: ItemDTO | null;
  categoryId: string;
  categories: CategoryDTO[];
  onDone: (again: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? priceCentsToInput(item.priceCents) : "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [allergens, setAllergens] = useState(item?.allergens ?? "");
  const [available, setAvailable] = useState(item?.available ?? true);
  const [cat, setCat] = useState(categoryId);
  const [nameEn, setNameEn] = useState(item?.nameEn ?? "");
  const [descriptionEn, setDescriptionEn] = useState(item?.descriptionEn ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const again = useRef(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const wantAgain = again.current;
    again.current = false;
    start(async () => {
      const input = {
        name,
        price,
        description: description.trim() || null,
        allergens: allergens.trim() || null,
        available,
        categoryId: cat,
        nameEn: nameEn.trim() || null,
        descriptionEn: descriptionEn.trim() || null,
      };
      const r = item ? await updateItemAction(item.id, input) : await createItemAction(cat, input);
      if (r.ok) {
        toast.success(r.message);
        onDone(wantAgain);
      } else {
        setErrors({ [r.field ?? "form"]: r.error });
        if (!r.field || !ITEM_FIELDS.includes(r.field)) toast.error(r.error);
      }
    });
  }

  const hasEnglish = Boolean(item?.nameEn || item?.descriptionEn);

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
        <Field label="Naziv" htmlFor="i-name" error={errors.name}>
          <Input id="i-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" aria-invalid={errors.name ? true : undefined} />
        </Field>
        <Field label="Cijena (€)" htmlFor="i-price" error={errors.price}>
          <Input
            id="i-price"
            value={price}
            inputMode="decimal"
            placeholder="5,50"
            maxLength={30}
            onChange={(e) => setPrice(e.target.value)}
            autoComplete="off"
            aria-invalid={errors.price ? true : undefined}
          />
        </Field>
      </div>
      <Field label="Opis" htmlFor="i-desc" error={errors.description} hint="Neobavezno, npr. sastojci.">
        <Textarea id="i-desc" rows={2} value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
      </Field>
      <Field label="Alergeni" htmlFor="i-all" error={errors.allergens} hint="Neobavezno, npr. gluten, mlijeko, jaja.">
        <Input id="i-all" value={allergens} maxLength={200} onChange={(e) => setAllergens(e.target.value)} autoComplete="off" />
      </Field>
      {categories.length > 1 && (
        <Field label="Kategorija" htmlFor="i-cat" error={errors.categoryId}>
          <Select id="i-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="size-5 accent-black" />
        <span>
          Dostupno gostima
          <span className="block text-xs text-muted">Isključeno: stavka ostaje na jelovniku s oznakom da trenutno nije u ponudi.</span>
        </span>
      </label>
      <details className="border border-border bg-surface-2 px-3 py-2.5 [&[open]>summary]:mb-3" open={hasEnglish}>
        <summary className="label flex min-h-6 cursor-pointer select-none items-center text-muted">Engleski</summary>
        <div className="space-y-4">
          <Field label="Naziv (engleski)" htmlFor="i-name-en" error={errors.nameEn}>
            <Input id="i-name-en" value={nameEn} maxLength={120} onChange={(e) => setNameEn(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Opis (engleski)" htmlFor="i-desc-en" error={errors.descriptionEn}>
            <Textarea id="i-desc-en" rows={2} value={descriptionEn} maxLength={400} onChange={(e) => setDescriptionEn(e.target.value)} className="min-h-16" />
          </Field>
        </div>
      </details>
      {errors.form && <p className="text-xs text-danger">{errors.form}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          Odustani
        </Button>
        {!item && (
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              again.current = true;
            }}
          >
            Spremi i dodaj novu
          </Button>
        )}
        <Button type="submit" loading={pending} onClick={() => (again.current = false)}>
          {item ? "Spremi" : "Dodaj stavku"}
        </Button>
      </div>
    </form>
  );
}
