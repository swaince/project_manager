import type {
  CommunicationChannel,
  CommunicationStatus,
  ProjectStatus,
  RequirementStatus,
} from "@/types/models";

const projectStatusClasses: Record<ProjectStatus, string> = {
  negotiating:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pending_start:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  paused:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  delivered:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  archived: "bg-muted text-muted-foreground",
};

export function projectStatusClass(status: ProjectStatus): string {
  return projectStatusClasses[status];
}

const requirementStatusClasses: Record<RequirementStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  clarifying:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  confirmed:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  designing:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  developing:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  on_hold:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  cancelled:
    "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

export function requirementStatusClass(status: RequirementStatus): string {
  return requirementStatusClasses[status];
}

const communicationChannelClasses: Record<CommunicationChannel, string> = {
  wechat:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  meeting:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  phone:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  email:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  other: "bg-muted text-muted-foreground",
};

export function communicationChannelClass(
  channel: CommunicationChannel,
): string {
  return communicationChannelClasses[channel];
}

const communicationStatusClasses: Record<CommunicationStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  archived: "bg-muted text-muted-foreground",
};

export function communicationStatusClass(status: CommunicationStatus): string {
  return communicationStatusClasses[status];
}
