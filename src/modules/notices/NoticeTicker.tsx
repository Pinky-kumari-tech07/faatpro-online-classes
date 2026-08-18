import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { cn } from "@/lib/utils";

type Notice = {
  id: string;
  title: string;
  link_url: string | null;
  link_label: string | null;
  is_active: boolean;
  sort_order: number;
};

export function NoticeTicker() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id;
  const [idx, setIdx] = useState(0);

  const { data } = useQuery({
    enabled: !!wsId,
    queryKey: ["student-notices", wsId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("student_notices")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notice[];
    },
    refetchInterval: 60_000,
  });

  const notices = data ?? [];

  useEffect(() => {
    if (notices.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % notices.length), 5000);
    return () => clearInterval(t);
  }, [notices.length]);

  if (notices.length === 0) {
    return (
      <div className="flex-1 min-w-0 flex items-center gap-2 text-muted-foreground">
        <Megaphone className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-xs truncate">No new announcements right now.</span>
      </div>
    );
  }

  const n = notices[idx];
  const isExternal = n.link_url?.startsWith("http");

  return (
    <div className="flex-1 min-w-0 flex items-center gap-3 rounded-full bg-gradient-to-r from-primary/10 via-violet-500/10 to-fuchsia-500/10 px-3 py-1.5 border border-primary/15">
      <span className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white grid place-items-center shrink-0">
        <Megaphone className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0 overflow-hidden">
        <MarqueeOrFade key={n.id} text={n.title} />
      </div>
      {n.link_url && (
        isExternal ? (
          <a
            href={n.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1 rounded-full bg-background/80"
          >
            {n.link_label || "Open"} <ArrowRight className="h-3 w-3" />
          </a>
        ) : (
          <Link
            to={n.link_url}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1 rounded-full bg-background/80"
          >
            {n.link_label || "Open"} <ArrowRight className="h-3 w-3" />
          </Link>
        )
      )}
      {notices.length > 1 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {notices.map((_, i) => (
            <span key={i} className={cn("h-1.5 w-1.5 rounded-full transition-all", i === idx ? "bg-primary w-3" : "bg-primary/30")} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarqueeOrFade({ text }: { text: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    if (!wrapRef.current || !innerRef.current) return;
    setOverflow(innerRef.current.scrollWidth > wrapRef.current.clientWidth + 4);
  }, [text]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden">
      <span
        ref={innerRef}
        className={cn(
          "inline-block whitespace-nowrap text-sm font-medium",
          overflow && "animate-[marquee_18s_linear_infinite]"
        )}
        style={overflow ? { paddingLeft: "100%" } : undefined}
      >
        {text}
      </span>
    </div>
  );
}