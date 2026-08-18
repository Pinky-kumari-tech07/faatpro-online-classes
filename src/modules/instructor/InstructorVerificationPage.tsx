import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, Loader2, User as UserIcon, GraduationCap, ShieldCheck, Landmark, Phone,
  CheckCircle2, Clock, XCircle, AlertCircle, Send, Briefcase, BookOpen, Link2, FileText,
} from "lucide-react";
import { BrandedCoverBanner } from "@/shared/components/BrandedCoverBanner";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import {
  instructorProfileService, INSTRUCTOR_VALIDATION as V, maskAadhaar,
  type InstructorProfile,
} from "@/services/supabase";
import { DocumentField, MultiDocumentField } from "@/modules/settings/instructor/DocumentField";
import { cn } from "@/lib/utils";

// Small red asterisk used to flag required fields inline with a <Label>.
const Req = () => <span className="text-destructive ml-0.5" aria-hidden>*</span>;

// Map each required field name -> the tab it lives on, so we can auto-switch
// to the tab that contains the first invalid field before scrolling to it.
const FIELD_TAB: Record<string, string> = {
  full_name: "personal",
  date_of_birth: "personal",
  gender: "personal",
  highest_qualification: "professional",
  years_experience: "professional",
  specialization: "professional",
  subjects: "teaching",
  bio: "teaching",
  avatar_url: "personal",
  government_id_url: "uploads",
  registration_mobile: "contact",
  account_holder_name: "banking",
  bank_account_number: "banking",
  ifsc_code: "banking",
  bank_name: "banking",
  address: "contact",
  city: "contact",
  state: "contact",
  pin_code: "contact",
};

type FormState = Partial<InstructorProfile> & { full_name?: string; bio?: string; avatar_url?: string };

const BOARDS = ["HSC", "CBSE", "ICSE", "State Board", "Other"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
  "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi",
  "Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

function StatusBadge({ status, submitted }: { status?: InstructorProfile["verification_status"]; submitted: boolean }) {
  if (!submitted) return <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />Draft</Badge>;
  if (!status || status === "pending") return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending review</Badge>;
  if (status === "approved") return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
  return <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white"><AlertCircle className="h-3 w-3" />Needs changes</Badge>;
}

function TagInput({ value, onChange, placeholder, disabled }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          disabled={disabled}
        />
        <Button type="button" variant="outline" onClick={add} disabled={disabled || !draft.trim()}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              {!disabled && (
                <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="ml-0.5 hover:text-destructive" aria-label={`Remove ${t}`}>×</button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InstructorVerificationPage() {
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const [tab, setTab] = useState("personal");
  const [confirmAccount, setConfirmAccount] = useState("");
  // Field-level validation errors surfaced under each input on submit.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Refs for every validated field so we can scroll & focus the first invalid.
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const setRef = useCallback(
    (name: string) => (el: HTMLElement | null) => {
      fieldRefs.current[name] = el;
    },
    [],
  );

  const profileQ = useQuery({
    enabled: !!user?.id,
    queryKey: ["instructor-verification-full", user?.id],
    queryFn: async () => {
      const [{ data: profile, error: pErr }, ip] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        instructorProfileService.getMine(user!.id),
      ]);
      if (pErr) throw pErr;
      return { profile, ip };
    },
  });

  useEffect(() => {
    if (!profileQ.data) return;
    const p: any = profileQ.data.profile ?? {};
    const ip: any = profileQ.data.ip ?? {};
    setForm({
      full_name: p.full_name ?? "",
      bio: p.bio ?? "",
      avatar_url: p.avatar_url ?? "",
      date_of_birth: ip.date_of_birth ?? "",
      gender: ip.gender ?? "",
      institution: ip.institution ?? "",
      passing_year: ip.passing_year ?? null,
      years_experience: ip.years_experience ?? null,
      specialization: ip.specialization ?? "",
      subjects: ip.subjects ?? [],
      languages: ip.languages ?? [],
      linkedin_url: ip.linkedin_url ?? "",
      website_url: ip.website_url ?? "",
      youtube_url: ip.youtube_url ?? "",
      resume_url: ip.resume_url ?? null,
      government_id_url: ip.government_id_url ?? null,
      board_type: ip.board_type ?? "",
      board_certificate_url: ip.board_certificate_url ?? null,
      highest_qualification: ip.highest_qualification ?? "",
      highest_qualification_certificate_url: ip.highest_qualification_certificate_url ?? null,
      additional_certifications: ip.additional_certifications ?? [],
      aadhaar_number: ip.aadhaar_number ?? "",
      aadhaar_front_url: ip.aadhaar_front_url ?? null,
      aadhaar_back_url: ip.aadhaar_back_url ?? null,
      pan_number: ip.pan_number ?? "",
      pan_card_url: ip.pan_card_url ?? null,
      account_holder_name: ip.account_holder_name ?? "",
      bank_account_number: ip.bank_account_number ?? "",
      ifsc_code: ip.ifsc_code ?? "",
      bank_name: ip.bank_name ?? "",
      branch_name: ip.branch_name ?? "",
      bank_document_url: ip.bank_document_url ?? null,
      upi_id: ip.upi_id ?? "",
      registration_mobile: ip.registration_mobile ?? p.phone ?? "",
      whatsapp_number: ip.whatsapp_number ?? "",
      alternative_contact: ip.alternative_contact ?? "",
      address: ip.address ?? "",
      city: ip.city ?? "",
      state: ip.state ?? "",
      country: ip.country ?? "India",
      pin_code: ip.pin_code ?? "",
      verification_status: ip.verification_status,
      verification_notes: ip.verification_notes ?? null,
      submitted_at: ip.submitted_at ?? null,
    } as FormState);
  }, [profileQ.data]);

  useEffect(() => {
    if (form.bank_account_number && !confirmAccount) setConfirmAccount(form.bank_account_number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.bank_account_number]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submitted = !!form.submitted_at;
  const status = form.verification_status;
  // Editing is locked when the profile has been submitted and is either
  // still pending review or already approved. If admin rejected or asked
  // for changes we unlock so the instructor can update and resubmit.
  const editable = !submitted || status === "rejected" || status === "resubmission_required";
  const lock = !editable;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (form.aadhaar_number && !V.aadhaar(form.aadhaar_number)) e.aadhaar = "Must be 12 digits";
    if (form.pan_number && !V.pan(form.pan_number)) e.pan = "Format: ABCDE1234F";
    if (form.ifsc_code && !V.ifsc(form.ifsc_code)) e.ifsc = "Must be 11 characters (e.g. HDFC0001234)";
    if (form.upi_id && !V.upi(form.upi_id)) e.upi = "Format: name@bank";
    if (form.registration_mobile && !V.phone(form.registration_mobile)) e.mobile = "Must be 10 digits";
    if (form.whatsapp_number && !V.phone(form.whatsapp_number)) e.whatsapp = "Must be 10 digits";
    if (form.pin_code && !V.pin(form.pin_code)) e.pin = "Must be 6 digits";
    if (form.bank_account_number) {
      if (!confirmAccount) e.confirm = "Please re-enter the account number to confirm";
      else if (confirmAccount !== form.bank_account_number) e.confirm = "Account numbers don't match";
    }
    return e;
  }, [form, confirmAccount]);

  // Build a full per-field error map covering both "required" and "invalid format".
  // Returns { fieldName: humanMessage } for every field that fails.
  const validateAll = useCallback((): Record<string, string> => {
    const fe: Record<string, string> = {};
    // Required
    if (!form.full_name?.trim()) fe.full_name = "Full name is required.";
    if (!form.avatar_url) fe.avatar_url = "Profile photo is required.";
    if (!form.date_of_birth) fe.date_of_birth = "Date of birth is required.";
    if (!form.gender) fe.gender = "Gender is required.";
    if (!form.highest_qualification?.trim()) fe.highest_qualification = "Education / qualification is required.";
    if (form.years_experience == null || Number.isNaN(Number(form.years_experience))) {
      fe.years_experience = "Teaching experience is required.";
    }
    if (!form.specialization?.trim()) fe.specialization = "Specialization is required.";
    if (!(form.subjects && form.subjects.length)) fe.subjects = "Add at least one subject you teach.";
    if (!form.bio?.trim()) fe.bio = "A short bio is required.";
    if (!form.government_id_url && !form.aadhaar_front_url) {
      fe.government_id_url = "Government ID is required.";
    }
    if (!form.registration_mobile) fe.registration_mobile = "Mobile number is required.";
    else if (!V.phone(form.registration_mobile)) fe.registration_mobile = "Enter a valid 10-digit mobile number.";
    if (!form.address?.trim()) fe.address = "Address is required.";
    if (!form.city?.trim()) fe.city = "City is required.";
    if (!form.state) fe.state = "State is required.";
    if (!form.pin_code) fe.pin_code = "PIN code is required.";
    else if (!V.pin(form.pin_code)) fe.pin_code = "PIN code must be 6 digits.";
    // Bank details
    if (!form.account_holder_name?.trim()) fe.account_holder_name = "Account holder name is required.";
    if (!form.bank_name?.trim()) fe.bank_name = "Bank name is required.";
    if (!form.bank_account_number) fe.bank_account_number = "Bank account number is required.";
    if (!form.ifsc_code) fe.ifsc_code = "IFSC code is required.";
    else if (!V.ifsc(form.ifsc_code)) fe.ifsc_code = "IFSC must be 11 characters (e.g. HDFC0001234).";
    // Format-only checks (non-required)
    if (form.aadhaar_number && !V.aadhaar(form.aadhaar_number)) fe.aadhaar_number = "Aadhaar must be 12 digits.";
    if (form.pan_number && !V.pan(form.pan_number)) fe.pan_number = "PAN format: ABCDE1234F.";
    if (form.whatsapp_number && !V.phone(form.whatsapp_number)) fe.whatsapp_number = "Must be 10 digits.";
    if (form.upi_id && !V.upi(form.upi_id)) fe.upi_id = "Format: name@bank.";
    // Confirm account number
    if (form.bank_account_number) {
      if (!confirmAccount) fe.confirmAccount = "Please re-enter the account number to confirm.";
      else if (confirmAccount !== form.bank_account_number) fe.confirmAccount = "Account numbers don't match.";
    }
    return fe;
  }, [form, confirmAccount]);

  const focusFirstInvalid = useCallback((fe: Record<string, string>) => {
    const first = Object.keys(fe)[0];
    if (!first) return;
    const targetTab = FIELD_TAB[first];
    if (targetTab && targetTab !== tab) setTab(targetTab);
    // Wait for the tab panel to mount before scrolling/focusing.
    setTimeout(() => {
      const el = fieldRefs.current[first];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = el.matches("input,select,textarea,button")
          ? (el as HTMLElement)
          : (el.querySelector("input,select,textarea,button") as HTMLElement | null);
        focusable?.focus?.();
      }
    }, 80);
  }, [tab]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      const { error: pErr } = await supabase.from("profiles").update({
        full_name: form.full_name || null,
        bio: form.bio || null,
        avatar_url: form.avatar_url || null,
        phone: form.registration_mobile || null,
      } as any).eq("id", user.id);
      if (pErr) throw pErr;

      const wsId = membership?.workspace.id ?? null;
      await instructorProfileService.upsertMine(user.id, wsId, {
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        institution: form.institution || null,
        passing_year: form.passing_year ?? null,
        years_experience: form.years_experience ?? null,
        specialization: form.specialization || null,
        subjects: form.subjects ?? [],
        languages: form.languages ?? [],
        linkedin_url: form.linkedin_url || null,
        website_url: form.website_url || null,
        youtube_url: form.youtube_url || null,
        resume_url: form.resume_url ?? null,
        government_id_url: form.government_id_url ?? null,
        board_type: form.board_type || null,
        board_certificate_url: form.board_certificate_url ?? null,
        highest_qualification: form.highest_qualification || null,
        highest_qualification_certificate_url: form.highest_qualification_certificate_url ?? null,
        additional_certifications: form.additional_certifications ?? [],
        aadhaar_number: form.aadhaar_number || null,
        aadhaar_front_url: form.aadhaar_front_url ?? null,
        aadhaar_back_url: form.aadhaar_back_url ?? null,
        pan_number: form.pan_number ? form.pan_number.toUpperCase() : null,
        pan_card_url: form.pan_card_url ?? null,
        account_holder_name: form.account_holder_name || null,
        bank_account_number: form.bank_account_number || null,
        ifsc_code: form.ifsc_code ? form.ifsc_code.toUpperCase() : null,
        bank_name: form.bank_name || null,
        branch_name: form.branch_name || null,
        bank_document_url: form.bank_document_url ?? null,
        upi_id: form.upi_id || null,
        registration_mobile: form.registration_mobile || null,
        whatsapp_number: form.whatsapp_number || null,
        alternative_contact: form.alternative_contact || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        pin_code: form.pin_code || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Draft saved" });
      qc.invalidateQueries({ queryKey: ["instructor-verification-full", user?.id] });
    },
    onError: (e: any) => {
      // Surface the raw backend/database/API error to the console so the
      // instructor (or support) can see exactly what failed.
      console.error("[instructor-verification] save failed:", e);
      toast({
        title: "Save failed",
        description: e?.message || e?.error_description || String(e),
        variant: "destructive",
      });
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      // Save current changes then flip the submitted flag.
      await save.mutateAsync();
      await instructorProfileService.submitForReview(user.id);
    },
    onSuccess: () => {
      setFieldErrors({});
      toast({ title: "Verification submitted successfully." });
      qc.invalidateQueries({ queryKey: ["instructor-verification-full", user?.id] });
    },
    onError: (e: any) => {
      console.error("[instructor-verification] submit failed:", e);
      toast({
        title: "Couldn't submit",
        description: e?.message || e?.error_description || String(e),
        variant: "destructive",
      });
    },
  });

  // Entry point wired to the "Submit for verification" button. Validates
  // every required field, shows inline errors, scrolls to the first invalid
  // input, and only calls the mutation when the form is clean.
  const handleSubmitClick = () => {
    const fe = validateAll();
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) {
      focusFirstInvalid(fe);
      return;
    }
    submit.mutate();
  };

  const handleSaveClick = () => {
    // Keep format-only errors visible while saving a draft, but do not block
    // the save on required-field completeness.
    const fe = validateAll();
    const formatOnly: Record<string, string> = {};
    for (const k of ["aadhaar_number","pan_number","whatsapp_number","upi_id","ifsc_code","pin_code","registration_mobile","confirmAccount"]) {
      if (fe[k]) formatOnly[k] = fe[k];
    }
    setFieldErrors(formatOnly);
    if (Object.keys(formatOnly).length > 0) {
      focusFirstInvalid(formatOnly);
      return;
    }
    save.mutate();
  };

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast({ title: "Please upload an image", variant: "destructive" });
    if (file.size > 2 * 1024 * 1024) return toast({ title: "Max 2 MB", variant: "destructive" });
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      set("avatar_url", data.publicUrl);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      qc.invalidateQueries({ queryKey: ["current-user-profile"] });
      qc.invalidateQueries({ queryKey: ["profile-name", user.id] });
      toast({ title: "Photo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const initials = (form.full_name || profileQ.data?.profile?.email || "I").slice(0, 2).toUpperCase();

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-32">
      <Card className="overflow-hidden border-border/60 shadow-sm rounded-2xl">
        <BrandedCoverBanner role="Instructor" />
        <div className="px-4 sm:px-6 pb-5 -mt-14 sm:-mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                <AvatarImage src={form.avatar_url || undefined} alt={form.full_name} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || lock}
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md hover:opacity-90 disabled:opacity-60"
                aria-label="Change photo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{form.full_name || "Your name"}</h1>
              <p className="text-sm text-muted-foreground truncate">{form.specialization || form.highest_qualification || "Instructor"}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap"><StatusBadge status={status} submitted={submitted} /></div>
            </div>
          </div>

          {status === "resubmission_required" && form.verification_notes && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-sm">
              <p className="font-medium mb-0.5">Reviewer requested changes</p>
              <p className="text-muted-foreground">{form.verification_notes}</p>
            </div>
          )}
          {status === "rejected" && form.verification_notes && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <p className="font-medium mb-0.5">Application rejected</p>
              <p className="text-muted-foreground">{form.verification_notes}</p>
            </div>
          )}
          {lock && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 text-sm flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium">{status === "approved" ? "Profile approved — details are locked" : "Submitted — editing locked while under review"}</p>
                <p className="text-muted-foreground">Contact support if you need to update any information.</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <TabsList className="w-full flex overflow-x-auto justify-start">
          <TabsTrigger value="personal"><UserIcon className="h-4 w-4 mr-1.5" />Personal</TabsTrigger>
          <TabsTrigger value="professional"><Briefcase className="h-4 w-4 mr-1.5" />Professional</TabsTrigger>
          <TabsTrigger value="teaching"><BookOpen className="h-4 w-4 mr-1.5" />Teaching</TabsTrigger>
          <TabsTrigger value="academic"><GraduationCap className="h-4 w-4 mr-1.5" />Academic</TabsTrigger>
          <TabsTrigger value="uploads"><FileText className="h-4 w-4 mr-1.5" />Uploads</TabsTrigger>
          <TabsTrigger value="kyc"><ShieldCheck className="h-4 w-4 mr-1.5" />KYC</TabsTrigger>
          <TabsTrigger value="banking"><Landmark className="h-4 w-4 mr-1.5" />Banking</TabsTrigger>
          <TabsTrigger value="contact"><Phone className="h-4 w-4 mr-1.5" />Contact</TabsTrigger>
          <TabsTrigger value="social"><Link2 className="h-4 w-4 mr-1.5" />Social</TabsTrigger>
        </TabsList>

        {/* PERSONAL */}
        <TabsContent value="personal" className="mt-4">
          <Card className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div ref={setRef("full_name")}>
                <Label>Full name<Req /></Label>
                <Input
                  value={form.full_name ?? ""}
                  onChange={(e) => set("full_name", e.target.value)}
                  disabled={lock}
                  className={cn(fieldErrors.full_name && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.full_name && <p className="text-xs text-destructive mt-1">{fieldErrors.full_name}</p>}
              </div>
              <div>
                <Label>Email</Label>
                <Input value={profileQ.data?.profile?.email ?? ""} disabled />
              </div>
              <div ref={setRef("date_of_birth")}>
                <Label>Date of birth<Req /></Label>
                <Input
                  type="date"
                  value={form.date_of_birth ?? ""}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                  disabled={lock}
                  className={cn(fieldErrors.date_of_birth && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.date_of_birth && <p className="text-xs text-destructive mt-1">{fieldErrors.date_of_birth}</p>}
              </div>
              <div ref={setRef("gender")}>
                <Label>Gender<Req /></Label>
                <Select value={form.gender ?? ""} onValueChange={(v) => set("gender", v)} disabled={lock}>
                  <SelectTrigger className={cn(fieldErrors.gender && "border-destructive focus-visible:ring-destructive")}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldErrors.gender && <p className="text-xs text-destructive mt-1">{fieldErrors.gender}</p>}
              </div>
              <div ref={setRef("avatar_url")} className="sm:col-span-2">
                {fieldErrors.avatar_url && (
                  <p className="text-xs text-destructive">{fieldErrors.avatar_url} Use the camera button on your photo above.</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* PROFESSIONAL */}
        <TabsContent value="professional" className="mt-4">
          <Card className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div ref={setRef("highest_qualification")}>
                <Label>Highest qualification<Req /></Label>
                <Input
                  value={form.highest_qualification ?? ""}
                  onChange={(e) => set("highest_qualification", e.target.value)}
                  placeholder="e.g. B.Tech, M.Tech, MBA, PhD"
                  disabled={lock}
                  className={cn(fieldErrors.highest_qualification && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.highest_qualification && <p className="text-xs text-destructive mt-1">{fieldErrors.highest_qualification}</p>}
              </div>
              <div>
                <Label>Institution</Label>
                <Input value={form.institution ?? ""} onChange={(e) => set("institution", e.target.value)} placeholder="University / College name" disabled={lock} />
              </div>
              <div>
                <Label>Passing year</Label>
                <Input type="number" min={1950} max={new Date().getFullYear()} value={form.passing_year ?? ""} onChange={(e) => set("passing_year", e.target.value ? Number(e.target.value) : null)} disabled={lock} />
              </div>
              <div ref={setRef("years_experience")}>
                <Label>Years of experience<Req /></Label>
                <Input
                  type="number" min={0} max={70}
                  value={form.years_experience ?? ""}
                  onChange={(e) => set("years_experience", e.target.value ? Number(e.target.value) : null)}
                  disabled={lock}
                  className={cn(fieldErrors.years_experience && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.years_experience && <p className="text-xs text-destructive mt-1">{fieldErrors.years_experience}</p>}
              </div>
              <div ref={setRef("specialization")} className="sm:col-span-2">
                <Label>Specialization<Req /></Label>
                <Input
                  value={form.specialization ?? ""}
                  onChange={(e) => set("specialization", e.target.value)}
                  placeholder="e.g. Financial Accounting, Corporate Law"
                  disabled={lock}
                  className={cn(fieldErrors.specialization && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.specialization && <p className="text-xs text-destructive mt-1">{fieldErrors.specialization}</p>}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* TEACHING */}
        <TabsContent value="teaching" className="mt-4">
          <Card className="p-6 space-y-5">
            <div ref={setRef("subjects")}>
              <Label>Subjects you teach<Req /></Label>
              <TagInput value={form.subjects ?? []} onChange={(v) => set("subjects", v)} placeholder="Add subject and press Enter" disabled={lock} />
              {fieldErrors.subjects && <p className="text-xs text-destructive mt-1">{fieldErrors.subjects}</p>}
            </div>
            <div>
              <Label>Languages</Label>
              <TagInput value={form.languages ?? []} onChange={(v) => set("languages", v)} placeholder="English, Hindi, ..." disabled={lock} />
            </div>
            <div ref={setRef("bio")}>
              <Label>Bio<Req /></Label>
              <Textarea
                rows={5}
                value={form.bio ?? ""}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="Brief introduction shown to students"
                disabled={lock}
                className={cn(fieldErrors.bio && "border-destructive focus-visible:ring-destructive")}
              />
              {fieldErrors.bio && <p className="text-xs text-destructive mt-1">{fieldErrors.bio}</p>}
            </div>
          </Card>
        </TabsContent>

        {/* ACADEMIC */}
        <TabsContent value="academic" className="mt-4">
          <Card className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Board certification type</Label>
                <Select value={form.board_type ?? ""} onValueChange={(v) => set("board_type", v)} disabled={lock}>
                  <SelectTrigger><SelectValue placeholder="Select board" /></SelectTrigger>
                  <SelectContent>
                    {BOARDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DocumentField label="Board certificate" userId={user.id} folder="qualification" value={form.board_certificate_url} onChange={(p) => set("board_certificate_url", p)} disabled={lock} />
              <DocumentField label="Highest qualification certificate" userId={user.id} folder="qualification" value={form.highest_qualification_certificate_url} onChange={(p) => set("highest_qualification_certificate_url", p)} disabled={lock} />
            </div>
            <MultiDocumentField label="Additional certifications (optional)" userId={user.id} folder="qualification" value={form.additional_certifications ?? []} onChange={(v) => set("additional_certifications", v)} disabled={lock} />
          </Card>
        </TabsContent>

        {/* UPLOADS */}
        <TabsContent value="uploads" className="mt-4">
          <Card className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <DocumentField label="Resume / CV" userId={user.id} folder="qualification" value={form.resume_url} onChange={(p) => set("resume_url", p)} disabled={lock} helper="PDF preferred" />
              <div ref={setRef("government_id_url")} className={cn(fieldErrors.government_id_url && "ring-2 ring-destructive rounded-md p-1")}>
                <DocumentField label="Government ID *" userId={user.id} folder="aadhaar" value={form.government_id_url} onChange={(p) => set("government_id_url", p)} disabled={lock} helper="Aadhaar, Passport or Driving License" />
                {fieldErrors.government_id_url && <p className="text-xs text-destructive mt-1">{fieldErrors.government_id_url}</p>}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* KYC */}
        <TabsContent value="kyc" className="mt-4">
          <Card className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div ref={setRef("aadhaar_number")}>
                <Label>Aadhaar number</Label>
                <Input
                  value={form.aadhaar_number ?? ""}
                  onChange={(e) => set("aadhaar_number", e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="12 digits" inputMode="numeric" disabled={lock}
                  className={cn((fieldErrors.aadhaar_number || errors.aadhaar) && "border-destructive focus-visible:ring-destructive")}
                />
                {(fieldErrors.aadhaar_number || errors.aadhaar) && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.aadhaar_number || errors.aadhaar}</p>
                )}
                {form.aadhaar_number && V.aadhaar(form.aadhaar_number) && (
                  <p className="text-xs text-muted-foreground mt-1">On file: {maskAadhaar(form.aadhaar_number)}</p>
                )}
              </div>
              <div ref={setRef("pan_number")}>
                <Label>PAN number</Label>
                <Input
                  value={form.pan_number ?? ""}
                  onChange={(e) => set("pan_number", e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="ABCDE1234F"
                  className={cn("uppercase", (fieldErrors.pan_number || errors.pan) && "border-destructive focus-visible:ring-destructive")}
                  disabled={lock}
                />
                {(fieldErrors.pan_number || errors.pan) && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.pan_number || errors.pan}</p>
                )}
              </div>
              <DocumentField label="Aadhaar — front" userId={user.id} folder="aadhaar" value={form.aadhaar_front_url} onChange={(p) => set("aadhaar_front_url", p)} disabled={lock} />
              <DocumentField label="Aadhaar — back" userId={user.id} folder="aadhaar" value={form.aadhaar_back_url} onChange={(p) => set("aadhaar_back_url", p)} disabled={lock} />
              <DocumentField label="PAN card" userId={user.id} folder="pan" value={form.pan_card_url} onChange={(p) => set("pan_card_url", p)} disabled={lock} />
            </div>
          </Card>
        </TabsContent>

        {/* BANKING */}
        <TabsContent value="banking" className="mt-4">
          <Card className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div ref={setRef("account_holder_name")}>
                <Label>Account holder name<Req /></Label>
                <Input value={form.account_holder_name ?? ""} onChange={(e) => set("account_holder_name", e.target.value)} disabled={lock}
                  className={cn(fieldErrors.account_holder_name && "border-destructive focus-visible:ring-destructive")} />
                {fieldErrors.account_holder_name && <p className="text-xs text-destructive mt-1">{fieldErrors.account_holder_name}</p>}
              </div>
              <div ref={setRef("bank_name")}>
                <Label>Bank name<Req /></Label>
                <Input value={form.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} disabled={lock}
                  className={cn(fieldErrors.bank_name && "border-destructive focus-visible:ring-destructive")} />
                {fieldErrors.bank_name && <p className="text-xs text-destructive mt-1">{fieldErrors.bank_name}</p>}
              </div>
              <div ref={setRef("bank_account_number")}>
                <Label>Account number<Req /></Label>
                <Input
                  value={form.bank_account_number ?? ""}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); set("bank_account_number", v); if (confirmAccount) setConfirmAccount(""); }}
                  inputMode="numeric" autoComplete="off" disabled={lock}
                  className={cn(fieldErrors.bank_account_number && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.bank_account_number && <p className="text-xs text-destructive mt-1">{fieldErrors.bank_account_number}</p>}
              </div>
              <div ref={setRef("confirmAccount")}>
                <Label>Confirm account number</Label>
                <Input value={confirmAccount} onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="off" onPaste={(e) => e.preventDefault()} placeholder="Re-enter account number" disabled={lock}
                  className={cn((fieldErrors.confirmAccount || errors.confirm) && "border-destructive focus-visible:ring-destructive")} />
                {(fieldErrors.confirmAccount || errors.confirm) && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.confirmAccount || errors.confirm}</p>
                )}
              </div>
              <div ref={setRef("ifsc_code")}>
                <Label>IFSC code<Req /></Label>
                <Input value={form.ifsc_code ?? ""} onChange={(e) => set("ifsc_code", e.target.value.toUpperCase().slice(0, 11))} placeholder="HDFC0001234"
                  className={cn("uppercase", (fieldErrors.ifsc_code || errors.ifsc) && "border-destructive focus-visible:ring-destructive")}
                  disabled={lock} />
                {(fieldErrors.ifsc_code || errors.ifsc) && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.ifsc_code || errors.ifsc}</p>
                )}
              </div>
              <div>
                <Label>Branch name</Label>
                <Input value={form.branch_name ?? ""} onChange={(e) => set("branch_name", e.target.value)} disabled={lock} />
              </div>
              <div ref={setRef("upi_id")}>
                <Label>UPI ID (optional)</Label>
                <Input value={form.upi_id ?? ""} onChange={(e) => set("upi_id", e.target.value)} placeholder="name@bank" disabled={lock}
                  className={cn((fieldErrors.upi_id || errors.upi) && "border-destructive focus-visible:ring-destructive")} />
                {(fieldErrors.upi_id || errors.upi) && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.upi_id || errors.upi}</p>
                )}
              </div>
              <DocumentField label="Cancelled cheque / passbook" userId={user.id} folder="bank" value={form.bank_document_url} onChange={(p) => set("bank_document_url", p)} disabled={lock} />
            </div>
          </Card>
        </TabsContent>

        {/* CONTACT */}
        <TabsContent value="contact" className="mt-4">
          <Card className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div ref={setRef("registration_mobile")}>
                <Label>Registration mobile<Req /></Label>
                <Input value={form.registration_mobile ?? ""} onChange={(e) => set("registration_mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="tel" disabled={lock}
                  className={cn((fieldErrors.registration_mobile || errors.mobile) && "border-destructive focus-visible:ring-destructive")} />
                {(fieldErrors.registration_mobile || errors.mobile) && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.registration_mobile || errors.mobile}</p>
                )}
              </div>
              <div ref={setRef("whatsapp_number")}>
                <Label>WhatsApp number</Label>
                <Input value={form.whatsapp_number ?? ""} onChange={(e) => set("whatsapp_number", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="tel" disabled={lock}
                  className={cn((fieldErrors.whatsapp_number || errors.whatsapp) && "border-destructive focus-visible:ring-destructive")} />
                {(fieldErrors.whatsapp_number || errors.whatsapp) && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.whatsapp_number || errors.whatsapp}</p>
                )}
              </div>
              <div>
                <Label>Alternative contact (optional)</Label>
                <Input value={form.alternative_contact ?? ""} onChange={(e) => set("alternative_contact", e.target.value)} disabled={lock} />
              </div>
              <div ref={setRef("address")} className="sm:col-span-2">
                <Label>Address<Req /></Label>
                <Textarea rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} disabled={lock}
                  className={cn(fieldErrors.address && "border-destructive focus-visible:ring-destructive")} />
                {fieldErrors.address && <p className="text-xs text-destructive mt-1">{fieldErrors.address}</p>}
              </div>
              <div ref={setRef("city")}>
                <Label>City<Req /></Label>
                <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} disabled={lock}
                  className={cn(fieldErrors.city && "border-destructive focus-visible:ring-destructive")} />
                {fieldErrors.city && <p className="text-xs text-destructive mt-1">{fieldErrors.city}</p>}
              </div>
              <div ref={setRef("state")}>
                <Label>State<Req /></Label>
                <Select value={form.state ?? ""} onValueChange={(v) => set("state", v)} disabled={lock}>
                  <SelectTrigger className={cn(fieldErrors.state && "border-destructive focus-visible:ring-destructive")}><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldErrors.state && <p className="text-xs text-destructive mt-1">{fieldErrors.state}</p>}
              </div>
              <div>
                <Label>Country</Label>
                <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} disabled={lock} />
              </div>
              <div ref={setRef("pin_code")}>
                <Label>PIN code<Req /></Label>
                <Input value={form.pin_code ?? ""} onChange={(e) => set("pin_code", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} disabled={lock}
                  className={cn((fieldErrors.pin_code || errors.pin) && "border-destructive focus-visible:ring-destructive")} />
                {(fieldErrors.pin_code || errors.pin) && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.pin_code || errors.pin}</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* SOCIAL */}
        <TabsContent value="social" className="mt-4">
          <Card className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Optional — public links shown on your instructor profile.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>LinkedIn</Label>
                <Input value={form.linkedin_url ?? ""} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…" disabled={lock} />
              </div>
              <div>
                <Label>Website</Label>
                <Input value={form.website_url ?? ""} onChange={(e) => set("website_url", e.target.value)} placeholder="https://…" disabled={lock} />
              </div>
              <div>
                <Label>YouTube</Label>
                <Input value={form.youtube_url ?? ""} onChange={(e) => set("youtube_url", e.target.value)} placeholder="https://youtube.com/@…" disabled={lock} />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground min-w-0 flex-1">
            {lock ? (
              <span>Locked — {status === "approved" ? "approved by admin" : "under review"}</span>
            ) : Object.keys(fieldErrors).length ? (
              <span className="text-destructive">Please fix the highlighted fields.</span>
            ) : (
              <span>Complete all required fields, then submit for verification.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveClick} disabled={save.isPending || lock}>
              {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving</> : "Save draft"}
            </Button>
            <Button
              onClick={handleSubmitClick}
              disabled={submit.isPending || lock}
              size="lg"
            >
              {submit.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />{status === "resubmission_required" || status === "rejected" ? "Resubmit" : "Submit for verification"}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}