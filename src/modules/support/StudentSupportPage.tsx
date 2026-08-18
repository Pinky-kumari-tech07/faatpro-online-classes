import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { LifeBuoy, Send, CheckCircle2, Mail, MessageSquare, Sparkles, Ticket } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { TicketDialog } from "./AdminSupportTicketsPage";
import { formatDistanceToNow } from "date-fns";

const schema = z.object({
  subject: z.string().trim().min(2, "Please add a short subject").max(150),
  message: z.string().trim().min(5, "Please describe your issue").max(2000),
});

const TOPICS = [
  "Course access",
  "Payment / Invoice",
  "Certificate",
  "Live class",
  "Login / Account",
  "Other",
];

export default function StudentSupportPage() {
  const { user, profile } = useAuth() as any;
  const { membership } = useWorkspace();
  const wsId = membership?.workspace?.id ?? null;
  const qc = useQueryClient();

  const [topic, setTopic] = useState<string>("Course access");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const { data: myTickets = [] } = useQuery({
    queryKey: ["my-support-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user!.id)
        .order("last_activity_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("my-support-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-support-tickets"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" },
        () => qc.invalidateQueries({ queryKey: ["support-messages"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const send = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ subject, message });
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");

      const { data, error } = await supabase.rpc("create_support_ticket", {
        p_topic: topic,
        p_subject: parsed.data.subject,
        p_message: parsed.data.message,
      });
      if (error) {
        console.error("[support] create_support_ticket failed", error);
        throw error;
      }
      console.log("[support] ticket created", data);
      return data;
    },
    onSuccess: () => {
      setDone(true);
      setSubject("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
      toast.success("Ticket submitted");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not send message"),
  });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl text-white p-6 sm:p-8 shadow-md"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400" />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur grid place-items-center shrink-0">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Need help?</h1>
            <p className="text-sm opacity-90 mt-1 max-w-xl">
              Send a message directly to the admin team. We typically reply within 1 business day.
            </p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList>
          <TabsTrigger value="new">New ticket</TabsTrigger>
          <TabsTrigger value="mine">My tickets {myTickets.length > 0 && <Badge variant="secondary" className="ml-2">{myTickets.length}</Badge>}</TabsTrigger>
        </TabsList>
        <TabsContent value="new">
      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        {/* Form */}
        <Card className="p-5 sm:p-6 rounded-3xl border-border/60 shadow-none">
          {done ? (
            <div className="text-center py-10">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-600 grid place-items-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-bold">Message sent</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your message has been delivered to the admin team.
              </p>
              <Button
                onClick={() => setDone(false)}
                variant="outline"
                className="mt-5 rounded-full"
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Contact admin
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a topic, add a subject, and describe your issue.
                </p>
              </div>

              {/* Topic chips */}
              <div className="space-y-1.5">
                <Label className="text-xs">Topic</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map((t) => {
                    const active = topic === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTopic(t)}
                        className={
                          "px-3 h-8 rounded-full text-xs font-medium border transition-all " +
                          (active
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background text-foreground border-border hover:border-primary/40")
                        }
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary of your issue"
                  maxLength={150}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Describe what you need help with…"
                  maxLength={2000}
                  className="rounded-2xl resize-none"
                  required
                />
                <div className="text-[10px] text-muted-foreground text-right">{message.length}/2000</div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> Replies will be sent to{" "}
                  <span className="font-medium text-foreground">{user?.email}</span>
                </div>
                <Button type="submit" disabled={send.isPending} className="rounded-full">
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {send.isPending ? "Sending…" : "Send to admin"}
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Side tips */}
        <aside className="space-y-3">
          <Card className="p-4 rounded-3xl border-border/60 shadow-none">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white grid place-items-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="font-semibold text-sm">Tips for a fast reply</div>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>• Mention the course or lesson name.</li>
              <li>• Add error messages or screenshots context.</li>
              <li>• Tell us what you already tried.</li>
            </ul>
          </Card>

          <Card className="p-4 rounded-3xl border-border/60 shadow-none">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</div>
            <div className="mt-2 text-sm font-medium">{profile?.full_name ?? "Student"}</div>
            <div className="text-xs text-muted-foreground break-all">{user?.email}</div>
          </Card>
        </aside>
      </div>
        </TabsContent>
        <TabsContent value="mine">
          <Card className="p-4 rounded-3xl border-border/60 shadow-none">
            {myTickets.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Ticket className="h-8 w-8 mx-auto mb-2 opacity-40" />
                You haven't opened any tickets yet.
              </div>
            ) : (
              <ul className="divide-y">
                {myTickets.map((t: any) => (
                  <li key={t.id} className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 px-2 rounded" onClick={() => setOpenTicket(t.id)}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{t.ticket_number}</span>
                        <span className="font-medium text-sm truncate">{t.subject}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t.topic} • Updated {formatDistanceToNow(new Date(t.last_activity_at), { addSuffix: true })}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{t.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      <TicketDialog id={openTicket} onClose={() => setOpenTicket(null)} isAdmin={false} />
    </div>
  );
}