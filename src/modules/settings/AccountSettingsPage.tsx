import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/shared/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Camera, Loader2, Trash2, KeyRound, User as UserIcon } from "lucide-react";

const PHONE_RE = /^[0-9]{10}$/;

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", avatar_url: "" });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  const authProvider = (user?.app_metadata as any)?.provider as string | undefined;
  const isOAuthUser = !!authProvider && authProvider !== "email";

  const profileQ = useQuery({
    enabled: !!user?.id,
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,email,full_name,phone,avatar_url").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profileQ.data) {
      setForm({
        full_name: profileQ.data.full_name ?? "",
        phone: profileQ.data.phone ?? "",
        avatar_url: profileQ.data.avatar_url ?? "",
      });
    }
  }, [profileQ.data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (form.phone && !PHONE_RE.test(form.phone)) {
        throw new Error("Enter a valid 10-digit mobile number.");
      }
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name || null,
        phone: form.phone || null,
        avatar_url: form.avatar_url || null,
      }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Profile updated" });
      qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile-name", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["current-user-profile"] });
    },
    onError: (err: any) => toast({ title: "Couldn't save", description: err?.message, variant: "destructive" }),
  });

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      if (updErr) throw updErr;
      setForm((f) => ({ ...f, avatar_url: publicUrl }));
      qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
      qc.invalidateQueries({ queryKey: ["profile-name", user.id] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["current-user-profile"] });
      toast({ title: "Photo updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleChangePassword() {
    if (isOAuthUser) {
      toast({ title: "Password managed by provider", description: `You signed in with ${authProvider}. Change your password there.`, variant: "destructive" });
      return;
    }
    if (!pwd.current) {
      toast({ title: "Enter current password", variant: "destructive" });
      return;
    }
    if (!pwd.next || pwd.next.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    try {
      const email = user?.email;
      if (!email) throw new Error("Missing account email.");
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: pwd.current });
      if (verifyErr) {
        toast({ title: "Current password is incorrect", variant: "destructive" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) {
        toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Password updated" });
      setPwd({ current: "", next: "", confirm: "" });
    } finally {
      setSavingPwd(false);
    }
  }

  const initials = (form.full_name || profileQ.data?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal profile and password.</p>
      </header>

      {/* Profile */}
      <Card className="p-6 space-y-6 border-border shadow-none">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          Profile
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border">
            <AvatarImage src={form.avatar_url || undefined} alt={form.full_name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
              {form.avatar_url ? "Replace" : "Upload"}
            </Button>
            {form.avatar_url && (
              <Button variant="ghost" size="sm" onClick={async () => {
                setForm((f) => ({ ...f, avatar_url: "" }));
                if (user) {
                  await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
                  qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
                  qc.invalidateQueries({ queryKey: ["profile-name", user.id] });
                  qc.invalidateQueries({ queryKey: ["profile"] });
                  qc.invalidateQueries({ queryKey: ["current-user-profile"] });
                }
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Remove
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Your full name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" value={profileQ.data?.email ?? user?.email ?? ""} readOnly disabled />
            <p className="text-[11px] text-muted-foreground">Changing email is handled through authentication.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="phone"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              placeholder="10-digit mobile number"
            />
            {form.phone && !PHONE_RE.test(form.phone) && (
              <p className="text-[11px] text-destructive">Enter a 10-digit mobile number.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-6 space-y-6 border-border shadow-none">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Security
        </div>

        {isOAuthUser ? (
          <p className="text-sm text-muted-foreground">
            You signed in with <span className="font-medium capitalize">{authProvider}</span>. Manage your password through your identity provider.
          </p>
        ) : (
          <>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cur_pwd">Current password</Label>
                <Input id="cur_pwd" type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_pwd">New password</Label>
                <Input id="new_pwd" type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf_pwd">Confirm new password</Label>
                <Input id="conf_pwd" type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={savingPwd}>
                {savingPwd && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update password
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}