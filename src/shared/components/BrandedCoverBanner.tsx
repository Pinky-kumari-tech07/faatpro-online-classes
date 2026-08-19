import React from "react";

interface BrandedCoverBannerProps {
  role: string;
  brand?: string;
}

/**
 * Pure-CSS branded cover banner used on profile pages.
 * Renders a soft Navy→Red tinted gradient with a large watermark
 * "FAATPRO" / "{ROLE}" typography on the left. No images, no SVGs.
 */
export function BrandedCoverBanner({ role, brand = "FAATPRO" }: BrandedCoverBannerProps) {
  const roleLabel = (role || "MEMBER").toUpperCase();
  // Tighter tracking for longer role names so they never get cropped on mobile.
  const trackingClass = roleLabel.length >= 9 ? "tracking-[0.25em]" : "tracking-[0.45em]";

  return (
    <div
      className="relative overflow-hidden h-[140px] sm:h-[170px] md:h-[190px] lg:h-[210px]"
      style={{
        background:
          "linear-gradient(120deg, #EEF4FF 0%, #F4EEF8 55%, #F9EEF6 100%)",
      }}
      aria-hidden="true"
    >
      {/* Abstract pattern: soft radial blobs in brand colours */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 88% 18%, rgba(220,38,38,0.10), transparent 45%), radial-gradient(circle at 12% 110%, rgba(15,32,76,0.10), transparent 50%)",
        }}
      />

      {/* Watermark typography */}
      <div className="absolute inset-0 flex flex-col justify-center pl-4 sm:pl-8 md:pl-12 select-none">
        <span
          className="font-black leading-none text-[2.25rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] tracking-tight"
          style={{ color: "#0F204C", opacity: 0.1 }}
        >
          {brand}
        </span>
        <span
          className={`mt-1 sm:mt-2 font-extrabold uppercase text-[0.75rem] sm:text-[1rem] md:text-[1.25rem] lg:text-[1.5rem] ${trackingClass}`}
          style={{ color: "#DC2626", opacity: 0.12 }}
        >
          {roleLabel}
        </span>
      </div>
    </div>
  );
}

export default BrandedCoverBanner;