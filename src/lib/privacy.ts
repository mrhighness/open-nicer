import type { Profile } from "./types";

export type PrivacySettings = {
  discoverable: boolean;
  allow_incoming_messages: boolean;
  show_online_status: boolean;
};

export function privacyFromProfile(p: Profile): PrivacySettings {
  return {
    discoverable: p.discoverable ?? true,
    allow_incoming_messages: p.allow_incoming_messages ?? true,
    show_online_status: p.show_online_status ?? true,
  };
}

export function isDiscoverable(p: Profile): boolean {
  return p.discoverable !== false;
}

export function allowsIncomingMessages(p: Profile): boolean {
  return p.allow_incoming_messages !== false;
}

export function shouldShowOnline(p: Profile): boolean {
  return p.show_online_status !== false;
}
