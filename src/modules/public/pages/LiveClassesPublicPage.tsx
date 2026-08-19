import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Video, Users, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { savePostLoginRedirect } from "@/lib/authRedirect";

export default function LiveClassesPublicPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  // Same redirect-preservation pattern used by the Courses flow: send guests to
  // login with ?next=, and send authenticated users straight to the live-class
  // area without bouncing them through /register or /login again.
  const goToLiveClass = () => {
    const target = "/app/live-classes";
    if (user) {
      nav(target);
      return;
    }
    savePostLoginRedirect(target);
    nav(`/auth/login?next=${encodeURIComponent(target)}`);
  };
  const { data = [] } = useQuery({
    queryKey: ["public-live-classes"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_live_classes", { _limit: 24 });
      return (data ?? []).map((r: any) => ({
        ...r,
        courses: r.course_title ? { title: r.course_title } : null,
        profiles: r.instructor_name ? { full_name: r.instructor_name } : null,
      }));
    },
  });
  const items: any[] = data;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="max-w-2xl">
        <Badge variant="secondary" className="mb-3">Live learning</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Mentor-led live classes</h1>
        <p className="mt-3 text-muted-foreground">Join scheduled sessions with instructors, ask questions in real time, and access recordings afterwards.</p>
        <div className="mt-5 flex gap-3">
          {user ? (
            <Button asChild><Link to="/app/live-classes">Open live classes <ArrowRight className="h-4 w-4" /></Link></Button>
          ) : (
            <Button asChild><Link to={`/auth/register?next=${encodeURIComponent("/app/live-classes")}`}>Join the academy <ArrowRight className="h-4 w-4" /></Link></Button>
          )}
          <Button asChild variant="outline"><Link to="/courses">Browse courses</Link></Button>
        </div>
      </div>
      {items.length === 0 ? (
        <Card className="mt-10 p-10 text-center border-dashed">
          <Video className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <div className="font-semibold">No live classes are currently scheduled.</div>
          <div className="text-sm text-muted-foreground mt-1">Please check back soon.</div>
        </Card>
      ) : (
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((c) => {
          const d = new Date(c.starts_at);
          const isFree = !c.price || Number(c.price) === 0;
          return (
            <Card key={c.id} className="overflow-hidden border-border">
              {c.banner_url || c.thumbnail_url ? (
                <img src={c.banner_url ?? c.thumbnail_url} alt={c.title} className="w-full aspect-video object-cover" />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-primary/10 to-primary/5 grid place-items-center">
                  <Video className="h-10 w-10 text-primary/60" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={isFree ? "secondary" : "default"} className={isFree ? "bg-success/15 text-success" : ""}>{isFree ? "Free" : `₹${c.price}`}</Badge>
                  {c.courses?.title && <span className="truncate">{c.courses.title}</span>}
                </div>
                <div className="mt-2 font-semibold leading-tight">{c.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">with {c.profiles?.full_name ?? "FAATPRO Instructor"}</div>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {d.toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  {c.max_participants ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.max_participants} seats</span>
                  ) : <span />}
                  <Button size="sm" onClick={goToLiveClass}>Register</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}