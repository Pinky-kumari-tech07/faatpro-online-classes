import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LifeBuoy, Search, Send, User, Mail, Calendar, MessageSquare, Lock, Globe, Phone } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

type Status = "open" | "pending" | "resolved" | "closed";
const STATUS_LABELS: Record<Status, string> = {
  open: "Open", pending: "Pending", resolved: "Resolved", closed: "Closed",
};

function StatusBadge({ s }: { s: Status }) {
  const cls: Record<Status, string> = {
    open: "bg-red-100 text-red-700 border-red-200",
    pending: "bg-orange-100 text-orange-700 border-orange-200",
    resolved: "bg-green-100 text-green-700 border-green-200",
    closed: "bg-gray-200 text-gray-700 border-gray-300",
  };
  return <Badge variant="outline" className={cls[s]}>{STATUS_LABELS[s]}</Badge>;
}

export default function AdminSupportTicketsPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace?.id;
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [audience, setAudience] = useState<"all" | "students" | "instructors" | "website">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets", wsId],
    queryFn: async () => {
      // RLS already restricts to tickets in workspaces where the user is staff
      // (or tickets they own). Filtering by the admin's currently-active
      // workspace here hides tickets routed to other workspaces they manage.
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("last_activity_at", { ascending: false });
      if (error) {
        console.error("[support-tickets] load failed", error);
        throw error;
      }
      return data ?? [];
    },
    enabled: true,
  });

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel("support-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" },
        () => qc.invalidateQueries({ queryKey: ["support-tickets"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" },
        () => { qc.invalidateQueries({ queryKey: ["support-tickets"] }); qc.invalidateQueries({ queryKey: ["support-messages"] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tickets.filter((t: any) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (audience === "website" && t.type !== "website") return false;
      if (audience === "students" && !(t.user_role === "student" && t.type !== "website")) return false;
      if (audience === "instructors" && !(t.user_role === "instructor" && t.type !== "website")) return false;
      if (audience === "all") { /* no-op */ }
      if (!s) return true;
      return (
        t.ticket_number?.toLowerCase().includes(s) ||
        t.user_name?.toLowerCase().includes(s) ||
        t.user_email?.toLowerCase().includes(s) ||
        t.subject?.toLowerCase().includes(s)
      );
    });
  }, [tickets, filter, q, audience]);

  const counts = useMemo(() => {
    const c = { all: tickets.length, open: 0, pending: 0, resolved: 0, closed: 0 } as any;
    tickets.forEach((t: any) => { c[t.status] = (c[t.status] ?? 0) + 1; });
    return c;
  }, [tickets]);

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><LifeBuoy className="h-6 w-6 text-primary" /> Support Tickets</h1>
          <p className="text-sm text-muted-foreground">Manage support requests from students and instructors.</p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["all","open","pending","resolved","closed"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k as any)}
            className={`text-left rounded-xl border p-3 transition ${filter===k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
            <div className="text-xs text-muted-foreground capitalize">{k}</div>
            <div className="text-2xl font-bold mt-1">{counts[k] ?? 0}</div>
          </button>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-3">
          <Tabs value={audience} onValueChange={(v) => setAudience(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="instructors">Instructors</TabsTrigger>
              <TabsTrigger value="website" className="gap-1"><Globe className="h-3.5 w-3.5" /> Website Inquiry</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ticket, name or email" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No tickets found.</TableCell></TableRow>
              ) : filtered.map((t: any) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpenId(t.id)}>
                  <TableCell className="font-mono text-xs">{t.ticket_number}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{t.user_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{t.user_email}</div>
                  </TableCell>
                  <TableCell>
                    {t.type === "website" ? (
                      <Badge className="bg-sky-100 text-sky-700 border-sky-200 border gap-1"><Globe className="h-3 w-3" /> Website</Badge>
                    ) : (
                      <Badge variant="secondary" className="capitalize">{t.user_role}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{t.topic}</TableCell>
                  <TableCell className="text-sm max-w-[260px] truncate">{t.subject}</TableCell>
                  <TableCell><StatusBadge s={t.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.last_activity_at), { addSuffix: true })}</TableCell>
                  <TableCell><Button size="sm" variant="ghost">View</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <TicketDialog id={openId} onClose={() => setOpenId(null)} isAdmin />
    </div>
  );
}

export function TicketDialog({ id, onClose, isAdmin }: { id: string | null; onClose: () => void; isAdmin: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);

  const { data: ticket } = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_tickets").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["support-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_messages").select("*").eq("ticket_id", id!).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // Staff list for assignment
  const { data: staff = [] } = useQuery({
    queryKey: ["support-staff", ticket?.workspace_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("profile_id, role, profiles:profile_id(full_name, email)")
        .eq("workspace_id", ticket!.workspace_id)
        .in("role", ["organization_admin", "staff", "super_admin"])
        .eq("status", "active");
      return data ?? [];
    },
    enabled: !!ticket?.workspace_id && isAdmin,
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!reply.trim() || !ticket) return;
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user!.id,
        sender_role: isAdmin ? "admin" : (ticket.user_role ?? "student"),
        message: reply.trim(),
        is_internal: isAdmin ? internal : false,
      });
      if (error) throw error;
      // Auto-move status when admin replies non-internally
      if (isAdmin && !internal && ticket.status === "open") {
        await supabase.from("support_tickets").update({ status: "pending" }).eq("id", ticket.id);
      }
    },
    onSuccess: () => {
      setReply(""); setInternal(false);
      qc.invalidateQueries({ queryKey: ["support-messages", id] });
      qc.invalidateQueries({ queryKey: ["support-ticket", id] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
      toast.success("Reply sent");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("support_tickets").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket", id] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
      toast.success("Updated");
    },
  });

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{ticket?.ticket_number}</span>
            <span>{ticket?.subject}</span>
            {ticket && <StatusBadge s={ticket.status} />}
          </DialogTitle>
        </DialogHeader>

        {ticket && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Card className="p-3">
                <div className="font-semibold text-xs uppercase text-muted-foreground mb-2">User</div>
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {ticket.user_name}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {ticket.user_email}</div>
                {ticket.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {ticket.phone}</div>
                )}
                {ticket.type === "website" ? (
                  <Badge className="mt-2 bg-sky-100 text-sky-700 border-sky-200 border gap-1"><Globe className="h-3 w-3" /> Website Inquiry</Badge>
                ) : (
                  <Badge variant="secondary" className="capitalize mt-2">{ticket.user_role}</Badge>
                )}
              </Card>
              <Card className="p-3">
                <div className="font-semibold text-xs uppercase text-muted-foreground mb-2">Ticket</div>
                <div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Topic: {ticket.topic}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Created {format(new Date(ticket.created_at), "PP")}</div>
                {ticket.type === "website" && (
                  <>
                    {ticket.ip_address && (
                      <div className="text-xs text-muted-foreground mt-1">IP: {ticket.ip_address}</div>
                    )}
                    {ticket.user_agent && (
                      <div className="text-xs text-muted-foreground truncate" title={ticket.user_agent}>Browser: {ticket.user_agent}</div>
                    )}
                  </>
                )}
              </Card>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={ticket.status} onValueChange={(v) => update.mutate({ status: v })}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["open","pending","resolved","closed"] as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={ticket.assigned_to ?? "unassigned"} onValueChange={(v) => update.mutate({ assigned_to: v === "unassigned" ? null : v })}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Assign to" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staff.map((s: any) => (
                      <SelectItem key={s.profile_id} value={s.profile_id}>
                        {s.profiles?.full_name ?? s.profiles?.email ?? s.profile_id.slice(0,6)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isAdmin && ticket.status !== "closed" && (
              <Button size="sm" variant="outline" onClick={() => update.mutate({ status: "closed" })}>
                Close ticket
              </Button>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Conversation</h3>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {messages.map((m: any) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`rounded-lg p-3 text-sm border ${m.is_internal ? "bg-amber-50 border-amber-200" : mine ? "bg-primary/5 border-primary/20" : "bg-muted border-border"}`}>
                      <div className="flex items-center justify-between gap-2 mb-1 text-xs text-muted-foreground">
                        <span className="capitalize font-medium flex items-center gap-1">
                          {m.is_internal && <Lock className="h-3 w-3" />} {m.sender_role}
                        </span>
                        <span>{format(new Date(m.created_at), "PPp")}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{m.message}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {ticket.status !== "closed" && (
              <div className="space-y-2">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" rows={4} />
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {isAdmin && (
                    <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                      Internal note (hidden from user)
                    </label>
                  )}
                  <Button size="sm" disabled={!reply.trim() || sendReply.isPending} onClick={() => sendReply.mutate()}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Send
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}