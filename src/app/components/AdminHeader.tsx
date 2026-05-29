import { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import logo from "../../imports/image.png";
import UserAccountMenu from "./UserAccountMenu";

interface AdminHeaderProps {
  title: string;
  description: string;
  backTo: string;
  rightSlot?: ReactNode;
}

export default function AdminHeader({
  title,
  description,
  backTo,
  rightSlot,
}: AdminHeaderProps) {
  return (
    <div className="bg-black text-white p-4 sm:p-6 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link to={backTo} className="hover:opacity-80 transition-opacity flex-shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <img
            src={logo}
            alt="Ukiyo"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl leading-tight truncate">{title}</h1>
            <p className="text-sm opacity-80 leading-snug line-clamp-2">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {rightSlot}
          <UserAccountMenu />
        </div>
      </div>
    </div>
  );
}
