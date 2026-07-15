import type { Role } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "OpSpot Admin",
  agent: "OpSpot Agent",
  ops: "Ops Manager",
  site_manager: "Site Manager",
};
