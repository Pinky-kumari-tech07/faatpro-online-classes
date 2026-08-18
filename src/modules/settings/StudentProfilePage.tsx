import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Camera, Loader2, User, GraduationCap, Phone, ShieldCheck, BookOpen, Award, TrendingUp, CalendarDays, Trash2, KeyRound, Smartphone, AlertTriangle, ClipboardCopy } from "lucide-react";
import { BrandedCoverBanner } from "@/shared/components/BrandedCoverBanner";
import { ActiveSessionsList } from "@/modules/security/ActiveSessionsList";
import BillingAddressForm, { BillingAddress, EMPTY_BILLING } from "@/modules/finance/BillingAddressForm";
import { Receipt } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { institutionService } from "@/services/supabase";

const ODISHA_CITIES = [
  "Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri",
  "Balasore", "Bhadrak", "Baripada", "Jharsuguda", "Jeypore", "Angul",
  "Dhenkanal", "Kendrapara", "Paradip", "Rayagada", "Koraput", "Sundargarh",
  "Jagatsinghpur", "Bargarh", "Bolangir", "Phulbani", "Nabarangpur",
  "Kendujhar", "Nayagarh", "Talcher", "Other",
];
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Delhi","Jammu & Kashmir","Ladakh","Puducherry",
  "Chandigarh","Andaman & Nicobar","Dadra & Nagar Haveli","Lakshadweep",
];
const COUNTRIES = ["India", "United States", "United Kingdom", "Canada", "Australia", "UAE", "Singapore", "Other"];

const PHONE_RE = /^[0-9]{10}$/;

type StudentProfile = {
  user_id: string;
  workspace_id: string | null;
  gender: string | null;
  date_of_birth: string | null;
  university_name: string | null;
  academic_session: string | null;
  course_program: string | null;
  branch: string | null;
  semester: string | null;
  roll_number: string | null;
  registration_number: string | null;
  whatsapp_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pin_code: string | null;
  institution_id?: string | null;
  institution_code?: string | null;
};

const EMPTY: Partial<StudentProfile> = {
  gender: "", date_of_birth: "", university_name: "", academic_session: "",
  course_program: "", branch: "", semester: "", roll_number: "", registration_number: "",
  whatsapp_number: "", address: "", city: "", state: "", country: "", pin_code: "",
  institution_id: null, institution_code: "",
};

export default function StudentProfilePage() {
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const workspaceId = membership?.workspace.id ?? null;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search] = useSearchParams();
  const initialTab = search.get("tab") || "personal";
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [dirty, setDirty] = useState(false);
  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePwd, setDeletePwd] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [billing, setBilling] = useState<BillingAddress>(EMPTY_BILLING);
  const [billingSaving, setBillingSaving] = useState(false);

  const authProvider = (user?.app_metadata as any)?.provider as string | undefined;
  const isOAuthUser = !!authProvider && authProvider !== "email";
  const providerLabel =
    authProvider === "google" ? "Google Account"
    : authProvider === "apple" ? "Apple Account"
    : authProvider === "microsoft" ? "Microsoft Account"
    : isOAuthUser ? `${authProvider?.[0]?.toUpperCase()}${authProvider?.slice(1)} Account`
    : "Email & Password";

  const profileQ = useQuery({
    enabled: !!user?.id,
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const studentQ = useQuery({
    enabled: !!user?.id,
    queryKey: ["my-student-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const institutionsQ = useQuery({
    queryKey: ["active-institutions"],
    queryFn: () => institutionService.listActiveAll(),
    staleTime: 60_000,
  });
  const [instOpen, setInstOpen] = useState(false);

  const enrollmentsQ = useQuery({
    enabled: !!user?.id,
    queryKey: ["my-enroll-count", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments")
        .select("id, enrolled_at, status").eq("student_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [pForm, setPForm] = useState({ full_name: "", phone: "", bio: "", avatar_url: "" });
  const [sForm, setSForm] = useState<Partial<StudentProfile>>(EMPTY);

  useEffect(() => {
    if (profileQ.data) {
      setPForm({
        full_name: profileQ.data.full_name ?? "",
        phone: profileQ.data.phone ?? "",
        bio: profileQ.data.bio ?? "",
        avatar_url: profileQ.data.avatar_url ?? "",
      });
      setBilling({
        billing_full_name: (profileQ.data as any).billing_full_name || profileQ.data.full_name || "",
        billing_address: (profileQ.data as any).billing_address || "",
        billing_city: (profileQ.data as any).billing_city || "",
        billing_state: (profileQ.data as any).billing_state || "",
        billing_country: (profileQ.data as any).billing_country || "India",
        billing_pin: (profileQ.data as any).billing_pin || "",
        billing_phone: (profileQ.data as any).billing_phone || profileQ.data.phone || "",
        billing_gstin: (profileQ.data as any).billing_gstin || "",
      });
    }
  }, [profileQ.data]);

  useEffect(() => {
    if (studentQ.data) {
      setSForm({
        ...EMPTY,
        ...studentQ.data,
        country: studentQ.data.country || "India",
        state: studentQ.data.state || "Odisha",
      });
    } else {
      setSForm((s) => ({ ...s, country: s.country || "India", state: s.state || "Odisha" }));
    }
  }, [studentQ.data]);

  // Mark dirty whenever forms change after initial load
  useEffect(() => {
    if (profileQ.data || studentQ.data) {
      const id = setTimeout(() => setDirty(true), 0);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pForm, sForm]);

  // Warn on unload if unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      // Phone validation
      if (pForm.phone && !PHONE_RE.test(pForm.phone)) {
        throw new Error("Mobile number must be exactly 10 digits");
      }
      if (sForm.whatsapp_number && !PHONE_RE.test(sForm.whatsapp_number)) {
        throw new Error("WhatsApp number must be exactly 10 digits");
      }
      const { error: pErr } = await supabase.from("profiles").update({
        full_name: pForm.full_name || null,
        phone: pForm.phone || null,
        bio: pForm.bio || null,
        avatar_url: pForm.avatar_url || null,
      } as any).eq("id", user.id);
      if (pErr) throw pErr;

      const payload = {
        user_id: user.id,
        workspace_id: workspaceId,
        gender: sForm.gender || null,
        date_of_birth: sForm.date_of_birth || null,
        university_name: sForm.university_name || null,
        academic_session: sForm.academic_session || null,
        course_program: sForm.course_program || null,
        branch: sForm.branch || null,
        semester: sForm.semester || null,
        roll_number: sForm.roll_number || null,
        registration_number: sForm.registration_number || null,
        whatsapp_number: sForm.whatsapp_number || null,
        address: sForm.address || null,
        city: sForm.city || null,
        state: sForm.state || null,
        country: sForm.country || null,
        pin_code: sForm.pin_code || null,
        institution_id: sForm.institution_id || null,
        institution_code: sForm.institution_code || null,
      };
      const { error: sErr } = await supabase
        .from("student_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (sErr) throw sErr;
    },
    onSuccess: () => {
      toast({ title: "Profile saved", description: "Your changes have been updated." });
      qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["my-student-profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["student-profile-banner", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile-name", user?.id] });
      setDirty(false);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") {
      toast({ title: "Type DELETE to continue", variant: "destructive" });
      return;
    }
    if (!isOAuthUser && !deletePwd) {
      toast({ title: "Enter your password", variant: "destructive" });
      return;
    }
    if (!user?.email) return;
    setDeleting(true);
    try {
      // Re-authenticate password users; OAuth users are verified by their active session.
      if (!isOAuthUser) {
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email: user.email, password: deletePwd,
        });
        if (authErr) throw new Error("Password is incorrect");
      }

      // Soft delete the profile
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ status: "deleted", deleted_at: new Date().toISOString() } as any)
        .eq("id", user.id);
      if (updErr) throw updErr;

      // Revoke all active sessions
      try {
        await supabase.rpc("revoke_all_user_sessions", {
          p_user_id: user.id,
          p_workspace_id: workspaceId,
        });
      } catch { /* non-blocking */ }

      await supabase.auth.signOut();
      toast({ title: "Account deleted", description: "Your account has been deactivated." });
      window.location.href = "/auth/login?deleted=1";
    } catch (e: any) {
      toast({ title: "Couldn't delete account", description: e?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

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
      setPForm((f) => ({ ...f, avatar_url: data.publicUrl }));
      toast({ title: "Photo uploaded", description: "Don't forget to save." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleChangePassword() {
    if (!pwd.next || pwd.next.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated" });
      setPwd({ next: "", confirm: "" });
    }
  }

  function removeAvatar() {
    setPForm((f) => ({ ...f, avatar_url: "" }));
  }

  function handleCopyFromContact() {
    setBilling((prev) => ({
      ...prev,
      billing_full_name: pForm.full_name || prev.billing_full_name,
      billing_phone: pForm.phone || prev.billing_phone,
      billing_address: sForm.address || prev.billing_address,
      billing_country: sForm.country || prev.billing_country,
      billing_state: sForm.state || prev.billing_state,
      billing_city: sForm.city || prev.billing_city,
      billing_pin: sForm.pin_code || prev.billing_pin,
      billing_gstin: prev.billing_gstin,
    }));
    toast({ title: "Billing details copied from Contact Information." });
  }

  async function saveBilling() {
    if (!user?.id) return;
    setBillingSaving(true);
    try {
      const { error } = await supabase.from("profiles").update(billing as any).eq("id", user.id);
      if (error) throw error;
      toast({ title: "Billing details saved" });
      qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setBillingSaving(false);
    }
  }

  const initials = (pForm.full_name || profileQ.data?.email || "U").slice(0, 2).toUpperCase();
  const enrollments = enrollmentsQ.data ?? [];
  const firstEnroll = enrollments.length ? enrollments.reduce((a, b) => (a.enrolled_at < b.enrolled_at ? a : b)) : null;
  const studentId = user?.id?.slice(0, 8).toUpperCase();
  const completed = enrollments.filter((e: any) => e.status === "completed").length;
  const progressPct = enrollments.length ? Math.round((completed / enrollments.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto pb-28 md:pb-12 px-3 sm:px-4">
      {/* Header card */}
      <Card className="overflow-hidden border-border/60 shadow-sm rounded-2xl">
        <BrandedCoverBanner role="Student" />
        <div className="px-4 sm:px-6 pb-5 -mt-14 sm:-mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                <AvatarImage src={pForm.avatar_url || undefined} alt={pForm.full_name} />
                <AvatarFallback className="text-xl bg-gradient-to-br from-primary/20 to-violet-500/20">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md hover:opacity-90 disabled:opacity-60"
                aria-label="Change photo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{pForm.full_name || "Your name"}</h1>
              <p className="text-sm text-muted-foreground truncate">
                {sForm.course_program || "Add your course / program"}
                {sForm.branch ? ` · ${sForm.branch}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="font-mono text-xs">ID: {studentId}</Badge>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">Active</Badge>
                <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300">
                  {progressPct}% progress
                </Badge>
              </div>
            </div>
            {pForm.avatar_url && (
              <Button variant="ghost" size="sm" onClick={removeAvatar} className="text-muted-foreground hidden sm:inline-flex">
                <Trash2 className="h-4 w-4 mr-1" /> Remove photo
              </Button>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty} size="lg" className="hidden md:inline-flex sm:self-end">
              {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving</> : "Save changes"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-background/85 backdrop-blur border-b border-border/40">
          <div className="overflow-x-auto no-scrollbar">
            <TabsList className="h-11 bg-muted/60 p-1 rounded-full inline-flex w-auto">
              <TabsTrigger value="personal" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:shadow">Personal</TabsTrigger>
              <TabsTrigger value="academic" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:shadow">Academic</TabsTrigger>
              <TabsTrigger value="contact" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:shadow">Contact</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:shadow">Billing</TabsTrigger>
              <TabsTrigger value="account" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:shadow">Account</TabsTrigger>
              <TabsTrigger value="security" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:shadow">Security</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="personal" className="mt-5">
          <Section icon={<User className="h-4 w-4" />} title="Personal information" desc="Basic details about you.">
            <Grid>
              <Field label="Full name">
                <Input value={pForm.full_name} onChange={(e) => setPForm({ ...pForm, full_name: e.target.value })} placeholder="Your full name" />
              </Field>
              <Field label="Gender">
                <Select value={sForm.gender || ""} onValueChange={(v) => setSForm({ ...sForm, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={sForm.date_of_birth || ""} onChange={(e) => setSForm({ ...sForm, date_of_birth: e.target.value })} />
              </Field>
              <Field label="Short bio" full>
                <Textarea rows={3} value={pForm.bio} onChange={(e) => setPForm({ ...pForm, bio: e.target.value })} placeholder="Tell us a bit about yourself" />
              </Field>
            </Grid>
          </Section>
        </TabsContent>

        <TabsContent value="academic" className="mt-5">
          <Section icon={<GraduationCap className="h-4 w-4" />} title="Academic information" desc="Your institution and program.">
            <Grid>
              <Field label="Institution">
                <Popover open={instOpen} onOpenChange={setInstOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={instOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {sForm.university_name || "Select institution"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
                    <Command>
                      <CommandInput placeholder="Search institutions..." />
                      <CommandList>
                        <CommandEmpty>
                          {institutionsQ.isLoading ? "Loading..." : "No matching institution."}
                        </CommandEmpty>
                        <CommandGroup>
                          {(institutionsQ.data || []).map((inst) => (
                            <CommandItem
                              key={inst.id}
                              value={`${inst.name} ${inst.code ?? ""} ${inst.city ?? ""}`}
                              onSelect={() => {
                                setSForm({
                                  ...sForm,
                                  institution_id: inst.id,
                                  institution_code: inst.code || null,
                                  university_name: inst.name,
                                });
                                setInstOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  sForm.institution_id === inst.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="text-sm">{inst.name}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {[inst.type, inst.city, inst.state].filter(Boolean).join(" · ")}
                                  {inst.code ? ` · ${inst.code}` : ""}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {sForm.institution_id && (
                  <button
                    type="button"
                    onClick={() =>
                      setSForm({
                        ...sForm,
                        institution_id: null,
                        institution_code: null,
                        university_name: "",
                      })
                    }
                    className="mt-1 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    Clear selection
                  </button>
                )}
              </Field>
              <Field label="Academic session">
                <Input placeholder="e.g. 2024-2025" value={sForm.academic_session || ""} onChange={(e) => setSForm({ ...sForm, academic_session: e.target.value })} />
              </Field>
              <Field label="Course / Program">
                <Input value={sForm.course_program || ""} onChange={(e) => setSForm({ ...sForm, course_program: e.target.value })} />
              </Field>
              <Field label="Branch / Department">
                <Input value={sForm.branch || ""} onChange={(e) => setSForm({ ...sForm, branch: e.target.value })} />
              </Field>
              <Field label="Semester / Year">
                <Input value={sForm.semester || ""} onChange={(e) => setSForm({ ...sForm, semester: e.target.value })} />
              </Field>
              <Field label="Roll number">
                <Input value={sForm.roll_number || ""} onChange={(e) => setSForm({ ...sForm, roll_number: e.target.value })} />
              </Field>
              <Field label="Registration number">
                <Input value={sForm.registration_number || ""} onChange={(e) => setSForm({ ...sForm, registration_number: e.target.value })} />
              </Field>
            </Grid>
          </Section>
        </TabsContent>

        <TabsContent value="contact" className="mt-5">
          <Section icon={<Phone className="h-4 w-4" />} title="Contact information" desc="How we can reach you.">
            <Grid>
              <Field label="Email address">
                <Input value={profileQ.data?.email ?? ""} disabled />
              </Field>
              <Field label="Mobile number">
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={pForm.phone}
                  onChange={(e) => setPForm({ ...pForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  placeholder="10-digit mobile number"
                />
                {pForm.phone && !PHONE_RE.test(pForm.phone) && (
                  <p className="text-[11px] text-destructive">Enter a 10-digit mobile number.</p>
                )}
              </Field>
              <Field label="WhatsApp number">
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={sForm.whatsapp_number || ""}
                  onChange={(e) => setSForm({ ...sForm, whatsapp_number: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  placeholder="10-digit WhatsApp number"
                />
                {sForm.whatsapp_number && !PHONE_RE.test(sForm.whatsapp_number) && (
                  <p className="text-[11px] text-destructive">Enter a 10-digit WhatsApp number.</p>
                )}
              </Field>
              <Field label="Address" full>
                <Textarea rows={2} value={sForm.address || ""} onChange={(e) => setSForm({ ...sForm, address: e.target.value })} />
              </Field>
              <Field label="Country">
                <Select value={sForm.country || "India"} onValueChange={(v) => setSForm({ ...sForm, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="State">
                <Select value={sForm.state || "Odisha"} onValueChange={(v) => setSForm({ ...sForm, state: v, city: v === "Odisha" ? (sForm.city || "") : "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="City">
                {sForm.state === "Odisha" ? (
                  <Select value={sForm.city || ""} onValueChange={(v) => setSForm({ ...sForm, city: v })}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {ODISHA_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={sForm.city || ""} onChange={(e) => setSForm({ ...sForm, city: e.target.value })} placeholder="Enter city" />
                )}
              </Field>
              <Field label="PIN / ZIP code">
                <Input value={sForm.pin_code || ""} onChange={(e) => setSForm({ ...sForm, pin_code: e.target.value })} />
              </Field>
            </Grid>
          </Section>
        </TabsContent>

        <TabsContent value="account" className="mt-5">
          <Section icon={<ShieldCheck className="h-4 w-4" />} title="Account overview" desc="Snapshot of your learning account.">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatTile icon={User} tone="from-sky-500/15 to-sky-500/5" label="Student ID" value={studentId ?? "—"} />
              <StatTile icon={CalendarDays} tone="from-violet-500/15 to-violet-500/5" label="Enrolled since" value={firstEnroll ? new Date(firstEnroll.enrolled_at).toLocaleDateString() : "—"} />
              <StatTile icon={BookOpen} tone="from-emerald-500/15 to-emerald-500/5" label="Courses" value={String(enrollments.length)} />
              <StatTile icon={Award} tone="from-amber-500/15 to-amber-500/5" label="Completed" value={String(completed)} />
              <StatTile icon={TrendingUp} tone="from-pink-500/15 to-pink-500/5" label="Progress" value={`${progressPct}%`} />
              <StatTile icon={ShieldCheck} tone="from-teal-500/15 to-teal-500/5" label="Status" value="Active" />
              <StatTile icon={KeyRound} tone="from-indigo-500/15 to-indigo-500/5" label="Login method" value={providerLabel} />
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="billing" className="mt-5">
          <Section
            icon={<Receipt className="h-4 w-4" />}
            title="Billing details"
            desc="Used on your GST invoices for course purchases. The state determines whether CGST+SGST or IGST applies."
            action={
              <Button variant="outline" size="sm" onClick={handleCopyFromContact} className="text-xs">
                <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
                Same as Contact Information
              </Button>
            }
          >
            <BillingAddressForm value={billing} onChange={setBilling} />
            <div className="flex justify-end mt-4">
              <Button onClick={saveBilling} disabled={billingSaving}>
                {billingSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving</> : "Save billing details"}
              </Button>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="security" className="mt-5 space-y-5">
          {isOAuthUser ? (
            <Section icon={<KeyRound className="h-4 w-4" />} title="Password" desc={`You signed in with ${providerLabel}. Manage your password with your identity provider.`}>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                Password changes aren't available for {providerLabel} sign-ins.
              </div>
            </Section>
          ) : (
            <Section icon={<KeyRound className="h-4 w-4" />} title="Change password" desc="Use 8+ characters with letters and numbers.">
              <Grid>
                <Field label="New password">
                  <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} placeholder="••••••••" />
                </Field>
                <Field label="Confirm new password">
                  <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} placeholder="••••••••" />
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <Button onClick={handleChangePassword} disabled={!pwd.next || !pwd.confirm}>Update password</Button>
                </div>
              </Grid>
            </Section>
          )}
          <Section icon={<Smartphone className="h-4 w-4" />} title="Device sessions" desc="Devices currently signed in to your account.">
            <ActiveSessionsList />
          </Section>

          <Card className="p-5 sm:p-6 border-destructive/40 bg-destructive/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-7 w-7 rounded-lg bg-destructive/15 text-destructive grid place-items-center">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Irreversible actions for your account.</p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-destructive/30 bg-background p-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">Delete account</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This action is permanent. Your courses, progress, messages and account data
                  will be deactivated. Certificates and payment history are preserved for verification.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)} className="shrink-0">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Account
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) { setDeleteConfirm(""); setDeletePwd(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Your account will be deactivated immediately and all
              active sessions will be signed out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete" className="text-xs">Type <span className="font-mono font-bold">DELETE</span> to continue</Label>
              <Input id="confirm-delete" autoComplete="off" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account type</Label>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{providerLabel}</span>
              </div>
            </div>
            {isOAuthUser ? (
              <p className="text-xs text-muted-foreground">
                You're signed in with {providerLabel}. No password is required — your active session confirms your identity.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pwd" className="text-xs">Enter your password</Label>
                <Input id="confirm-pwd" type="password" value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} placeholder="••••••••" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirm !== "DELETE" || (!isOAuthUser && !deletePwd)}
            >
              {deleting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</>) : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky save bar (mobile) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            {dirty ? "You have unsaved changes" : "All changes saved"}
          </p>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty} className="min-w-28">
            {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving</> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, desc, action, children }: { icon: React.ReactNode; title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6 border-border/60 shadow-sm rounded-2xl">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center">{icon}</span>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {desc && <p className="text-xs text-muted-foreground mb-5">{desc}</p>}
      {children}
    </Card>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-gradient-to-br ${tone} p-4`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-bold mt-1 truncate">{value}</p>
    </div>
  );
}