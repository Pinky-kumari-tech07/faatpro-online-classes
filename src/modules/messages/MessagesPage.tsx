import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, MessagesSquare, Pencil, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import PageHeader from "@/modules/shared/PageHeader";

export default function MessagesPage() {
  const { membership } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;
  const me = user!.id;
  const qc = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ["conversations", me],
    queryFn: async () => {
      const { data: parts, error: pErr } = await supabase.from("conversation_participants")
        .select("conversation_id").eq("profile_id", me);
      if (pErr) console.error("[messages] participants error:", pErr);
      const ids = (parts ?? []).map((p: any) => p.conversation_id);
      if (!ids.length) return [];
      const { data: convs, error: cErr } = await supabase.from("conversations")
        .select("*").in("id", ids).order("last_message_at", { ascending: false });
      if (cErr) console.error("[messages] conversations error:", cErr);
      const { data: cps, error: cpErr } = await supabase.from("conversation_participants")
        .select("conversation_id, profile_id").in("conversation_id", ids);
      if (cpErr) console.error("[messages] all participants error:", cpErr);
      const profileIds = Array.from(new Set((cps ?? []).map((p: any) => p.profile_id)));
      const { data: profs } = profileIds.length
        ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", profileIds)
        : { data: [] as any[] };
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (convs ?? []).map((c: any) => ({
        ...c,
        participants: (cps ?? [])
          .filter((p: any) => p.conversation_id === c.id)
          .map((p: any) => ({ ...p, profile: profMap.get(p.profile_id) })),
      }));
    },
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*")
        .eq("conversation_id", activeId!).order("created_at", { ascending: true });
      if (error) { console.error("[messages] fetch error:", error); throw error; }
      const senderIds = Array.from(new Set((data ?? []).map((m: any) => m.sender_id)));
      const { data: profs } = senderIds.length
        ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", senderIds)
        : { data: [] as any[] };
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      console.log(`[messages] conv=${activeId} fetched=${data?.length ?? 0}`);
      return (data ?? []).map((m: any) => ({ ...m, sender: profMap.get(m.sender_id) }));
    },
  });

  // Auto-scroll + realtime
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase.channel(`msgs-${activeId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", activeId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, qc]);

  // Inbox-level realtime: refresh the sidebar when I'm added to a new
  // conversation OR any message lands in a conversation I'm part of.
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel(`inbox-${me}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_participants", filter: `profile_id=eq.${me}` },
        () => qc.invalidateQueries({ queryKey: ["conversations", me] }))
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          const convId = payload?.new?.conversation_id;
          // Cheap client-side filter: only bump the list if this message
          // belongs to a conversation the user already has loaded.
          const known = (conversations ?? []).some((c: any) => c.id === convId);
          if (known) qc.invalidateQueries({ queryKey: ["conversations", me] });
          else qc.invalidateQueries({ queryKey: ["conversations", me] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, qc, conversations]);

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("messages").insert({
        workspace_id: wsId, conversation_id: activeId!, sender_id: me, body,
      });
      if (error) throw error;
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeId!);
    },
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["messages", activeId] }); qc.invalidateQueries({ queryKey: ["conversations", me] }); },
    onError: (e: any) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const editMsg = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase.from("messages")
        .update({ body: editBody })
        .eq("id", editingId)
        .eq("sender_id", me);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null); setEditBody("");
      qc.invalidateQueries({ queryKey: ["messages", activeId] });
    },
    onError: (e: any) => toast({ title: "Edit failed", description: e.message, variant: "destructive" }),
  });

  const delMsg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("messages").delete().eq("id", id).eq("sender_id", me);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["messages", activeId] });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const titleOf = (c: any) => {
    if (c.title) return c.title;
    const others = (c.participants ?? []).filter((p: any) => p.profile_id !== me).map((p: any) => p.profile?.full_name).filter(Boolean).join(", ");
    return others || "Conversation";
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Messages" description="Direct messages with members of your workspace."
        actions={<Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> New message</Button>} />

      <Card className="border-border shadow-none grid md:grid-cols-[280px_1fr] min-h-[500px] overflow-hidden">
        <div className="border-r border-border overflow-y-auto">
          {(conversations ?? []).map((c: any) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={cn("w-full text-left p-3 border-b border-border hover:bg-muted/40", activeId === c.id && "bg-muted")}>
              <div className="font-medium text-sm truncate">{titleOf(c)}</div>
              <div className="text-xs text-muted-foreground">{new Date(c.last_message_at).toLocaleString()}</div>
            </button>
          ))}
          {(conversations ?? []).length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <MessagesSquare className="h-6 w-6 mx-auto mb-2 opacity-50" /> No conversations yet.
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeId && messagesLoading && (
              <div className="text-center text-muted-foreground text-sm">Loading messages…</div>
            )}
            {(messages ?? []).map((m: any) => {
              const mine = m.sender_id === me;
              const isEditing = editingId === m.id;
              return (
                <div key={m.id} className={cn("group max-w-[70%] p-3 rounded-lg text-sm relative", mine ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>
                  {!mine && <div className="text-xs font-medium mb-1 opacity-70">{m.sender?.full_name ?? "User"}</div>}
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="bg-background text-foreground"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editBody.trim()) editMsg.mutate();
                          if (e.key === "Escape") { setEditingId(null); setEditBody(""); }
                        }}
                      />
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingId(null); setEditBody(""); }}>
                          <X className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => editMsg.mutate()} disabled={!editBody.trim()}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                      {mine && (
                        <div className="absolute -top-2 right-1 opacity-0 group-hover:opacity-100 transition flex gap-1 bg-background border rounded-md shadow-sm">
                          <button className="p-1 hover:bg-muted rounded" title="Edit"
                            onClick={() => { setEditingId(m.id); setEditBody(m.body ?? ""); }}>
                            <Pencil className="h-3 w-3 text-foreground" />
                          </button>
                          <button className="p-1 hover:bg-muted rounded" title="Delete"
                            onClick={() => setDeletingId(m.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {activeId && !messagesLoading && (messages ?? []).length === 0 && (
              <div className="text-center text-muted-foreground py-20 text-sm">No messages yet. Say hi 👋</div>
            )}
            {!activeId && <div className="text-center text-muted-foreground py-20">Select a conversation</div>}
          </div>
          {activeId && (
            <div className="p-3 border-t border-border flex gap-2">
              <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…"
                onKeyDown={(e) => { if (e.key === "Enter" && body.trim()) send.mutate(); }} />
              <Button onClick={() => send.mutate()} disabled={!body.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </Card>

      {newOpen && <NewMessageDialog onClose={() => setNewOpen(false)} workspaceId={wsId} me={me}
        onCreated={(id) => { setActiveId(id); setNewOpen(false); qc.invalidateQueries({ queryKey: ["conversations", me] }); }} />}

      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>The message will be removed for everyone in this conversation.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && delMsg.mutate(deletingId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewMessageDialog({ onClose, workspaceId, me, onCreated }: any) {
  const [recipient, setRecipient] = useState("");
  const [first, setFirst] = useState("");
  const { data: members } = useQuery({
    queryKey: ["wm-pick", workspaceId],
    queryFn: async () => (await supabase.from("workspace_members")
      .select("profile_id, profiles:profile_id(full_name)")
      .eq("workspace_id", workspaceId).eq("status", "active")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      // Atomically find-or-create the single 1:1 thread; never duplicate.
      const { data: convId, error } = await supabase.rpc(
        "get_or_create_direct_conversation",
        { _workspace_id: workspaceId, _other_user: recipient },
      );
      if (error) throw error;
      if (first.trim()) {
        await supabase.from("messages").insert({
          workspace_id: workspaceId, conversation_id: convId, sender_id: me, body: first,
        });
        await supabase.from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", convId);
      }
      return convId as string;
    },
    onSuccess: (id) => onCreated(id),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New message</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Recipient</Label>
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger><SelectValue placeholder="Choose member" /></SelectTrigger>
              <SelectContent>
                {(members ?? []).filter((m: any) => m.profile_id !== me).map((m: any) => (
                  <SelectItem key={m.profile_id} value={m.profile_id}>{m.profiles?.full_name ?? "User"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Message</Label>
            <Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Optional first message…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!recipient}>Start conversation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}