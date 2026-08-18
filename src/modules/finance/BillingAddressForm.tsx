import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES } from "./invoiceUtils";

export type BillingAddress = {
  billing_full_name: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_country: string;
  billing_pin: string;
  billing_phone: string;
  billing_gstin: string;
};

export const EMPTY_BILLING: BillingAddress = {
  billing_full_name: "",
  billing_address: "",
  billing_city: "",
  billing_state: "",
  billing_country: "India",
  billing_pin: "",
  billing_phone: "",
  billing_gstin: "",
};

export function isBillingValid(b: Partial<BillingAddress>): boolean {
  return !!(b.billing_full_name && b.billing_address && b.billing_city && b.billing_state && b.billing_country && b.billing_pin);
}

export default function BillingAddressForm({
  value, onChange,
}: {
  value: BillingAddress;
  onChange: (v: BillingAddress) => void;
}) {
  const set = (k: keyof BillingAddress, v: string) => onChange({ ...value, [k]: v });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Full Name *</Label>
        <Input value={value.billing_full_name} onChange={(e) => set("billing_full_name", e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Billing Address *</Label>
        <Textarea rows={2} value={value.billing_address} onChange={(e) => set("billing_address", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">City *</Label>
        <Input value={value.billing_city} onChange={(e) => set("billing_city", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">State *</Label>
        <Select value={value.billing_state} onValueChange={(v) => set("billing_state", v)}>
          <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Country *</Label>
        <Input value={value.billing_country} onChange={(e) => set("billing_country", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">PIN Code *</Label>
        <Input value={value.billing_pin} onChange={(e) => set("billing_pin", e.target.value.replace(/\D/g, "").slice(0, 6))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Mobile Number *</Label>
        <Input value={value.billing_phone} onChange={(e) => set("billing_phone", e.target.value.replace(/\D/g, "").slice(0, 15))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">GSTIN (optional, for B2B)</Label>
        <Input value={value.billing_gstin} onChange={(e) => set("billing_gstin", e.target.value.toUpperCase().slice(0, 15))} placeholder="22ABCDE1234F1Z5" />
      </div>
    </div>
  );
}
