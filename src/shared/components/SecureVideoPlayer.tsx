import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { resolveStorageUrl } from "@/lib/storageUrl";

function isYouTube(u: string) { return /youtu\.?be/.test(u); }
function isVimeo(u: string) { return /vimeo\.com/.test(u); }

function toSecureEmbed(u: string, opts: { youtubeNoCookie: boolean }) {
  try {
    if (isYouTube(u)) {
      const url = new URL(u);
      let id = "";
      if (url.hostname.includes("youtu.be")) id = url.pathname.replace(/^\//, "");
      else if (url.pathname.startsWith("/embed/")) id = url.pathname.replace("/embed/", "");
      else if (url.pathname.startsWith("/shorts/")) id = url.pathname.replace("/shorts/", "");
      else id = url.searchParams.get("v") ?? "";
      if (!id) return u;
      const host = opts.youtubeNoCookie ? "www.youtube-nocookie.com" : "www.youtube.com";
      const params = new URLSearchParams({
        modestbranding: "1",
        rel: "0",
        showinfo: "0",
        iv_load_policy: "3",
        fs: "1",
        playsinline: "1",
        disablekb: "0",
      });
      const t = url.searchParams.get("t") ?? url.searchParams.get("start");
      if (t) {
        const m = /^(\d+)(s)?$/.exec(t);
        params.set("start", m ? m[1] : String(parseInt(t, 10) || 0));
      }
      return `https://${host}/embed/${id}?${params.toString()}`;
    }
    if (isVimeo(u)) {
      const url = new URL(u);
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://player.vimeo.com/video/${id}?dnt=1&pip=0&title=0&byline=0&portrait=0` : u;
    }
  } catch { /* noop */ }
  return u;
}

type SecuritySettings = {
  disable_downloads: boolean;
  dynamic_watermark: boolean;
  screen_record_deterrence: boolean;
  youtube_nocookie: boolean;
};

const DEFAULTS: SecuritySettings = {
  disable_downloads: true,
  dynamic_watermark: true,
  screen_record_deterrence: true,
  youtube_nocookie: true,
};

export interface SecureVideoPlayerProps {
  url: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  className?: string;
  courseId?: string;
  lessonId?: string;
  workspaceId?: string;
}

/**
 * Wraps native/iframe video playback with:
 * - Watermark overlay (rotating every 10s) with the viewer's full name
 * - Disabled context menu, drag, picture-in-picture, native download UI
 * - YouTube nocookie + modest branding for embeds
 * - Screen recording deterrence (PrintScreen, getDisplayMedia, visibility)
 * - Best-effort audit logging to video_access_logs
 */
export function SecureVideoPlayer({
  url, videoRef, className, courseId, lessonId, workspaceId,
}: SecureVideoPlayerProps) {
  const { user } = useAuth();
  const { membership } = useWorkspace() as any;
  const wsId = workspaceId || membership?.workspace_id;
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULTS);
  const [fullName, setFullName] = useState<string>("");
  const [pos, setPos] = useState({ top: 12, left: 12 });
  const [warning, setWarning] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const startedLoggedRef = useRef(false);

  // Load workspace settings + viewer name
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (wsId) {
        const { data } = await supabase
          .from("video_security_settings")
          .select("disable_downloads,dynamic_watermark,screen_record_deterrence,youtube_nocookie")
          .eq("workspace_id", wsId)
          .maybeSingle();
        if (!cancelled && data) setSettings({ ...DEFAULTS, ...(data as any) });
      }
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancelled) setFullName((prof as any)?.full_name || user.email || "");
      }
    })();
    return () => { cancelled = true; };
  }, [wsId, user?.id]);

  const embedUrl = useMemo(
    () => (isYouTube(url) || isVimeo(url) ? toSecureEmbed(url, { youtubeNoCookie: settings.youtube_nocookie }) : null),
    [url, settings.youtube_nocookie],
  );

  // Files stored in the private `lesson-files` bucket need a signed URL, a
  // plain public URL returns 400 and the player shows an endless spinner.
  const [playableUrl, setPlayableUrl] = useState(url);
  useEffect(() => {
    let cancelled = false;
    if (embedUrl) { setPlayableUrl(url); return; }
    setPlayableUrl(url);
    (async () => {
      const resolved = await resolveStorageUrl(url);
      if (!cancelled && resolved) setPlayableUrl(resolved);
    })();
    return () => { cancelled = true; };
  }, [url, embedUrl]);

  // Audit log helper
  const logEvent = async (event_type: string, details: Record<string, any> = {}) => {
    if (!user?.id) return;
    try {
      await supabase.from("video_access_logs").insert({
        workspace_id: wsId ?? null,
        user_id: user.id,
        course_id: courseId ?? null,
        lesson_id: lessonId ?? null,
        event_type,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        details,
      } as any);
    } catch { /* ignore */ }
  };

  // Move watermark every 10s
  useEffect(() => {
    if (!settings.dynamic_watermark) return;
    const move = () => {
      const el = overlayRef.current;
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      setPos({
        top: Math.max(4, Math.floor(Math.random() * Math.max(1, h - 60))),
        left: Math.max(4, Math.floor(Math.random() * Math.max(1, w - 220))),
      });
    };
    move();
    const t = window.setInterval(move, 10_000);
    return () => window.clearInterval(t);
  }, [settings.dynamic_watermark]);

  // Screen-record deterrence: PrintScreen + visibility
  useEffect(() => {
    if (!settings.screen_record_deterrence) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || (e.shiftKey && (e.metaKey || e.ctrlKey) && (e.key === "3" || e.key === "4" || e.key === "5"))) {
        setWarning("Screen recording is prohibited.");
        logEvent("printscreen_attempt", { key: e.key });
        window.setTimeout(() => setWarning(null), 4000);
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        const v = videoRef?.current;
        if (v && !v.paused) v.pause();
      }
    };
    // Detect display capture API usage (best-effort, fires only if site script invokes it)
    const md = (navigator.mediaDevices as any);
    let originalGDM: any;
    if (md && typeof md.getDisplayMedia === "function") {
      originalGDM = md.getDisplayMedia.bind(md);
      md.getDisplayMedia = async (...args: any[]) => {
        setWarning("Screen recording is prohibited.");
        logEvent("screen_record_attempt", {});
        window.setTimeout(() => setWarning(null), 4000);
        return originalGDM(...args);
      };
    }
    window.addEventListener("keyup", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("visibilitychange", onVis);
      if (md && originalGDM) md.getDisplayMedia = originalGDM;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.screen_record_deterrence]);

  // Attach native <video> event listeners for audit
  useEffect(() => {
    const el = videoRef?.current;
    if (!el || embedUrl) return;
    const onPlay = () => {
      if (!startedLoggedRef.current) {
        startedLoggedRef.current = true;
        logEvent("video_start", { duration: el.duration || null });
      }
    };
    const onEnd = () => logEvent("video_complete", { duration: el.duration || null });
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      logEvent("context_menu_blocked", {});
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("ended", onEnd);
    el.addEventListener("contextmenu", onContext as any);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("contextmenu", onContext as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedUrl, videoRef?.current]);

  const watermarkText = useMemo(() => {
    const stamp = new Date().toLocaleString();
    return `${fullName || "Viewer"} • ${stamp}`;
  }, [fullName, pos]); // recompute when position moves (every 10s)

  const protectedHandlers = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      logEvent("context_menu_blocked", {});
    },
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  };

  return (
    <div className={className} {...protectedHandlers} style={{ position: "absolute", inset: 0 }}>
      {embedUrl ? (
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin"
          title="Secure video player"
        />
      ) : (
        <video
          ref={videoRef}
          src={playableUrl}
          controls
          controlsList={settings.disable_downloads ? "nodownload noplaybackrate noremoteplayback" : undefined}
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full bg-black"
          preload="metadata"
          playsInline
        />
      )}

      {/* Watermark overlay */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden">
        {settings.dynamic_watermark && fullName && (
          <div
            className="absolute select-none rounded bg-black/30 px-2 py-1 text-[11px] font-medium tracking-wide text-white/85 backdrop-blur-sm transition-all duration-700"
            style={{ top: pos.top, left: pos.left, mixBlendMode: "screen" }}
          >
            {watermarkText}
          </div>
        )}
        {warning && (
          <div className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-red-600/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
            {warning}
          </div>
        )}
      </div>
    </div>
  );
}

export default SecureVideoPlayer;