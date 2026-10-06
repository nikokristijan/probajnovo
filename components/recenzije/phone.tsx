import { cn } from "@/lib/recenzije/utils";

/** A plain phone frame showing an SMS thread. Pure markup, usable on server and client. */
export function PhoneMockup({
  sender,
  messages,
  className,
}: {
  sender: string;
  messages: { text: string; from?: "business" | "client"; time?: string }[];
  className?: string;
}) {
  const linkify = (t: string) =>
    t.split(/(https?:\/\/\S+)/g).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <span key={i} className="break-all text-[#7cc4ff] underline">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[290px] rounded-[44px] border border-[#2c332f] bg-[#050606] p-2.5 shadow-[0_30px_80px_-30px_rgb(47_210_127/0.35)]",
        className
      )}
      aria-label="SMS preview"
    >
      <div className="overflow-hidden rounded-[36px] bg-[#0e1110]">
        <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-medium text-foreground/80">
          <span>9:41</span>
          <span className="h-5 w-20 rounded-full bg-black" aria-hidden />
          <span>5G</span>
        </div>
        <div className="flex flex-col items-center border-b border-white/5 pb-3 pt-2">
          <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
            {sender.trim()[0]?.toUpperCase() ?? "N"}
          </span>
          <span className="mt-1 max-w-[80%] truncate text-xs text-foreground/80">{sender}</span>
        </div>
        <div className="flex min-h-[300px] flex-col gap-2 px-3 py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.from === "client" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] px-3 py-2 text-[13px] leading-snug",
                  m.from === "client" ? "rounded-br-md bg-[#2f7cf6] text-white" : "rounded-bl-md bg-[#262a28] text-[#eef2ef]"
                )}
              >
                {m.text ? linkify(m.text) : <span className="text-foreground/40">Your message…</span>}
              </div>
            </div>
          ))}
          {messages[0]?.time && <p className="mt-1 text-center text-[10px] text-foreground/40">{messages[0].time}</p>}
        </div>
      </div>
    </div>
  );
}
