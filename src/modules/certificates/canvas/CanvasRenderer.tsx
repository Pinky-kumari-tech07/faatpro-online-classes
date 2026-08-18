import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { type CanvasDesign, type AnyElement, substitute, PREVIEW_DATA } from "./types";

interface Props {
  design: CanvasDesign;
  data?: Record<string, any>;
  scale?: number;
  className?: string;
  innerRef?: React.Ref<HTMLDivElement>;
  /** When true, missing token values fall back to friendly sample data. Used inside the editor and template thumbnails. */
  preview?: boolean;
}

/**
 * Read-only renderer for a CanvasDesign. Used for previews, list thumbnails,
 * and PDF export (via html2canvas). Pure HTML/CSS so it screenshots cleanly.
 */
export function CanvasRenderer({ design, data = {}, scale = 1, className, innerRef, preview = false }: Props) {
  const mergedData = useMemo(
    () => (preview ? { ...PREVIEW_DATA, ...data } : data),
    [preview, data],
  );
  const bgStyle = useMemo(() => {
    const b = design.background;
    const layers: string[] = [];
    if (b.image) layers.push(`url("${b.image}") center/cover no-repeat`);
    if (b.gradient) {
      layers.push(`linear-gradient(${b.gradient.angle}deg, ${b.gradient.from}, ${b.gradient.to})`);
    }
    return {
      background: layers.length ? layers.join(", ") : b.color || "#ffffff",
      backgroundColor: !layers.length ? b.color || "#ffffff" : undefined,
    } as React.CSSProperties;
  }, [design.background]);

  const bgFilter = useMemo(() => {
    const b = design.background;
    const parts: string[] = [];
    if (b.brightness !== 1) parts.push(`brightness(${b.brightness})`);
    if (b.contrast !== 1) parts.push(`contrast(${b.contrast})`);
    if (b.blur) parts.push(`blur(${b.blur}px)`);
    return parts.join(" ");
  }, [design.background]);

  return (
    <div
      ref={innerRef}
      className={className}
      style={{
        width: design.width * scale,
        height: design.height * scale,
        position: "relative",
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 6px 24px -8px rgba(0,0,0,.18)",
      }}
    >
      {/* Background layer with filters */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          ...bgStyle,
          opacity: design.background.opacity,
          filter: bgFilter || undefined,
          transform: `scale(${design.background.scale}) rotate(${design.background.rotation}deg)`,
          transformOrigin: "center",
        }}
      />
      {/* Inner scaled stage */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: design.width,
          height: design.height,
        }}
      >
        {design.elements
          .filter((e) => !e.hidden)
          .map((el) => (
            <RenderEl key={el.id} el={el} data={mergedData} />
          ))}
      </div>
    </div>
  );
}

function RenderEl({ el, data }: { el: AnyElement; data: Record<string, any> }) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: `rotate(${el.rotation}deg) scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`,
    transformOrigin: "center",
    opacity: el.opacity,
    pointerEvents: "none",
  };

  if (el.type === "text") {
    const t = substitute(el.text, data);
    const display = el.uppercase ? t.toUpperCase() : t;
    return (
      <div
        style={{
          ...baseStyle,
          fontFamily: `"${el.fontFamily}", serif`,
          fontSize: el.fontSize,
          fontWeight: el.fontWeight,
          color: el.color,
          textAlign: el.align,
          letterSpacing: el.letterSpacing,
          lineHeight: el.lineHeight,
          fontStyle: el.italic ? "italic" : undefined,
          textShadow: el.shadow ? "0 2px 6px rgba(0,0,0,.25)" : undefined,
          WebkitTextStroke: el.outline ? "1px rgba(0,0,0,.45)" : undefined,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          display: "flex",
          alignItems: "center",
          justifyContent:
            el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
        }}
      >
        <div style={{ width: "100%" }}>{display}</div>
      </div>
    );
  }

  if (el.type === "image" || el.type === "logo" || el.type === "watermark") {
    return (
      <div style={baseStyle}>
        {el.src ? (
          <img
            src={el.src}
            alt=""
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              border: "1px dashed #c7c7c7",
              background: "#fafafa",
            }}
          />
        )}
      </div>
    );
  }

  if (el.type === "signature") {
    return (
      <div style={{ ...baseStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {el.src && (
          <img
            src={el.src}
            alt=""
            crossOrigin="anonymous"
            style={{ flex: 1, maxHeight: "60%", width: "auto", objectFit: "contain" }}
          />
        )}
        {el.showLine && (
          <div style={{ width: "100%", borderTop: "1px solid #333", margin: "4px 0" }} />
        )}
        {el.caption && (
          <div style={{ fontWeight: 600, fontSize: 14, fontFamily: "Inter, sans-serif" }}>
            {substitute(el.caption, data)}
          </div>
        )}
        {el.subCaption && (
          <div style={{ fontSize: 12, color: "#555", fontFamily: "Inter, sans-serif" }}>
            {substitute(el.subCaption, data)}
          </div>
        )}
      </div>
    );
  }

  if (el.type === "shape") {
    const common: React.CSSProperties = {
      width: "100%",
      height: "100%",
      background: el.fill,
      border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
      boxSizing: "border-box",
    };
    if (el.shape === "rectangle") {
      return (
        <div style={baseStyle}>
          <div style={{ ...common, borderRadius: el.radius ?? 0 }} />
        </div>
      );
    }
    if (el.shape === "circle") {
      return (
        <div style={baseStyle}>
          <div style={{ ...common, borderRadius: "50%" }} />
        </div>
      );
    }
    return (
      <div style={baseStyle}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points="50,0 100,100 0,100"
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
          />
        </svg>
      </div>
    );
  }

  if (el.type === "line") {
    return (
      <div style={baseStyle}>
        <div
          style={{
            width: "100%",
            height: el.strokeWidth || 2,
            background: el.stroke,
            marginTop: el.h / 2 - (el.strokeWidth || 2) / 2,
          }}
        />
      </div>
    );
  }

  if (el.type === "qr") {
    const value =
      el.value ||
      (data.verification_code
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/certificate/verify/${data.verification_code}`
        : "https://example.com");
    const size = Math.min(el.w, el.h);
    return (
      <div style={{ ...baseStyle, display: "grid", placeItems: "center", background: el.bg }}>
        <QRCodeSVG value={value} size={size} fgColor={el.fg} bgColor={el.bg} level="M" />
      </div>
    );
  }

  return null;
}