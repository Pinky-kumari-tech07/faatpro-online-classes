import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Receipt, Download, Eye, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { coursePricingService } from "@/services/supabase/coursePricingService";
import { downloadInvoice, previewInvoice, loadInvoiceBrandingOpts } from "@/modules/finance/invoiceUtils";

const fmt = (n: any, c = "INR") => coursePricingService.formatPrice(Number(n ?? 0), c);

export default function OrdersPage() {
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const workspaceId = membership?.workspace.id;
  const isAdmin = ["organization_admin", "super_admin", "staff"].includes(String((membership as any)?.role));

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", user?.id, workspaceId, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from("payments")
        .select("id, created_at, status, provider, amount, total_amount, currency, coupon_code, discount_amount, tax_amount, course_id, student_id, courses(title, slug), profiles!payments_student_id_fkey(full_name, email), invoices(id, invoice_number, pdf_url)")
        .order("created_at", { ascending: false });
      if (isAdmin && workspaceId) q = q.eq("workspace_id", workspaceId);
      else q = q.eq("student_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleInvoice = async (paymentId: string, mode: "view" | "download") => {
    const { data: inv } = await supabase.from("invoices").select("*").eq("payment_id", paymentId).maybeSingle();
    if (!inv) return;
    const opts = await loadInvoiceBrandingOpts(workspaceId);
    if (mode === "view") await previewInvoice(inv, opts);
    else await downloadInvoice(inv, opts);
  };

  const colCount = isAdmin ? 9 : 8;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> {isAdmin ? "All orders" : "My orders"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{isAdmin ? "Every order in the workspace." : "Your enrollment purchases and invoices."}</p>
      </div>

      {!isLoading && orders.length === 0 ? (
        <Card className="border-border p-10 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <ShoppingBag className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">No orders yet</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {isAdmin ? "No orders have been placed in this workspace yet." : "You haven't purchased any courses yet."}
          </p>
          {!isAdmin && (
            <Button asChild className="mt-5">
              <Link to="/courses">Browse courses</Link>
            </Button>
          )}
        </Card>
      ) : (
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Order #</th>
                {isAdmin && <th className="text-left p-3">Customer</th>}
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Coupon</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={colCount} className="p-3">
                      <div className="h-6 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : orders.map((o: any) => {
                const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
                return (
                <tr key={o.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                  {isAdmin && (
                    <td className="p-3">
                      <div className="text-sm">{o.profiles?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.profiles?.email ?? ""}</div>
                    </td>
                  )}
                  <td className="p-3">
                    {o.courses?.slug ? (
                      <Link to={`/courses/${o.courses.slug}`} className="hover:text-primary">{o.courses?.title ?? "Course"}</Link>
                    ) : (o.courses?.title ?? "—")}
                  </td>
                  <td className="p-3 text-xs capitalize">{o.provider === "offline" ? "Offline" : o.provider === "razorpay" ? "Razorpay" : o.provider ?? "—"}</td>
                  <td className="p-3 text-xs">{o.coupon_code ? <Badge variant="secondary">{o.coupon_code}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-right font-medium">{fmt(o.total_amount ?? o.amount, o.currency ?? "INR")}</td>
                  <td className="p-3">
                    <Badge variant={o.status === "succeeded" ? "default" : o.status === "pending" ? "secondary" : "destructive"} className="capitalize">{o.status}</Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    {inv ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title={`View ${inv.invoice_number}`} onClick={() => handleInvoice(o.id, "view")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Download PDF" onClick={() => handleInvoice(o.id, "download")}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not available</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}