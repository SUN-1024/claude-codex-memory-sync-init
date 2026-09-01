export type Severity = "info" | "warning" | "error";
export type CompatibilityMode = "native" | "bridge" | "manual" | "unsupported";
export type EvidenceLevel = "official-smoke" | "official" | "source-verified" | "provisional";

export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  repairable: boolean;
  path?: string;
  harness?: string;
}

export interface AdapterEndpoint {
  mode: CompatibilityMode;
  path?: string;
  mechanism?: string;
}

export interface HarnessAdapter {
  id: string;
  name: string;
  platforms: string[];
  detection: {
    commands: string[];
    projectMarkers: string[];
  };
  rules: AdapterEndpoint;
  skills: AdapterEndpoint;
  bridges: string[];
  evidence: {
    level: EvidenceLevel;
    docs: string[];
    verifiedVersion?: string;
    verifiedDate: string;
  };
}

export interface DoctorReport {
  schemaVersion: 1;
  version: string;
  target: string;
  healthy: boolean;
  changed: boolean;
  findings: Finding[];
  support: HarnessAdapter[];
}

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}
