import { Link } from "react-router-dom";
import logoAsset from "@/assets/faatpro-logo.png.asset.json";

interface AuthLogoProps {
  darkBg?: boolean;
  className?: string;
}

export default function AuthLogo({ darkBg = false, className = "" }: AuthLogoProps) {
  return (
    <Link to="/" className={`inline-flex items-center ${className}`}>
      <span
        className={
          darkBg
            ? "inline-flex items-center bg-white rounded-lg px-3 py-2 shadow-md"
            : "inline-flex items-center"
        }
      >
        <img
          src={logoAsset.url}
          alt="FAATPRO"
          className="h-8 sm:h-9 md:h-10 w-auto object-contain"
        />
      </span>
    </Link>
  );
}
