export type ProfileCompletionInput = {
  full_name?: string | null;
  phone?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  avatar_url?: string | null;
  university_name?: string | null;
};

// Only the learner's full name is mandatory. Everything else is optional
// and contributes only to the informational completion percentage.
const REQUIRED_KEYS = ["full_name"] as const;
const OPTIONAL_KEYS = ["avatar_url", "phone", "country", "state", "city", "university_name"] as const;

function filled(v: unknown) {
  return typeof v === "string" ? v.trim().length > 0 : !!v;
}

export function getProfileCompletion(input: ProfileCompletionInput) {
  const all = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];
  const total = all.length;
  const done = all.reduce((n, k) => n + (filled((input as any)[k]) ? 1 : 0), 0);
  const percent = Math.round((done / total) * 100);
  const missingRequired = REQUIRED_KEYS.filter((k) => !filled((input as any)[k]));
  return {
    percent,
    isComplete: missingRequired.length === 0,
    missingRequired: missingRequired as string[],
  };
}

export const REQUIRED_PROFILE_FIELDS = REQUIRED_KEYS;