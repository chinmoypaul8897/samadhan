import {
  Construction,
  Droplets,
  Trash2,
  Zap,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";

export type ServiceGroup =
  | "roads"
  | "water"
  | "sanitation"
  | "electricity"
  | "other";

// Client slice of serviceCatalog/{serviceCode} (data-shapes.md §3).
export type ServiceCategory = {
  serviceCode: string;
  serviceName: string;
  group: ServiceGroup;
  defaultDepartment: string;
  slaHours: number;
  hazardDefault: boolean;
};

export const GROUP_ICON: Record<ServiceGroup, LucideIcon> = {
  roads: Construction,
  water: Droplets,
  sanitation: Trash2,
  electricity: Zap,
  other: CircleHelp,
};

export const GROUP_LABEL: Record<ServiceGroup, string> = {
  roads: "Roads",
  water: "Water",
  sanitation: "Sanitation",
  electricity: "Electricity",
  other: "Other",
};
