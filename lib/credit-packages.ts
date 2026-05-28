// lib/credit-packages.ts

export type EventTier = "starter" | "gallery" | "studio";

export type TierConfig = {
  creditCost: number;
  storageLimitGb: number;
  linkActiveDays: number;
  dataRetentionDays: number;
  label: string;
  description: string;
};

export const TIER_CONFIG: Record<EventTier, TierConfig> = {
  starter: {
    creditCost: 199,
    storageLimitGb: 5,
    linkActiveDays: 3,
    dataRetentionDays: 7,
    label: "Starter",
    description: "5 GB · link 3 วัน · เก็บข้อมูล 7 วัน",
  },
  gallery: {
    creditCost: 499,
    storageLimitGb: 20,
    linkActiveDays: 5,
    dataRetentionDays: 14,
    label: "Gallery",
    description: "20 GB · link 5 วัน · เก็บข้อมูล 14 วัน",
  },
  studio: {
    creditCost: 999,
    storageLimitGb: 50,
    linkActiveDays: 7,
    dataRetentionDays: 30,
    label: "Studio",
    description: "50 GB · link 7 วัน · เก็บข้อมูล 30 วัน · Highlight Reel",
  },
};

export const WELCOME_BONUS_CREDITS = 199;

export const EVENT_TIERS = Object.keys(TIER_CONFIG) as EventTier[];

export function isValidTier(value: string): value is EventTier {
  return EVENT_TIERS.includes(value as EventTier);
}
