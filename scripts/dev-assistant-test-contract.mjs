export const ASSISTANT_E2E_SCOPE = "cureocity-assistant-role-regression-v1";
export const ASSISTANT_E2E_CREDENTIAL_FILE = ".env.assistant-e2e.local";

export const ASSISTANT_E2E_ACCOUNTS = [
  { role: "Super Admin", slug: "super_admin", featureFlag: "STAFF_COPILOT_SUPER_ADMIN_ENABLED", requiresExternalAi: true },
  { role: "Administrator", slug: "administrator", featureFlag: "STAFF_COPILOT_ADMINISTRATOR_ENABLED", inputRole: "combobox", inputName: "Administrator workflow", submitName: "Prepare governance checklist" },
  { role: "Manager", slug: "manager", featureFlag: "STAFF_COPILOT_MANAGER_ENABLED", inputRole: "combobox", inputName: "Manager workflow", submitName: "Prepare operations checklist" },
  { role: "Medical Director", slug: "medical_director", featureFlag: "STAFF_COPILOT_MEDICAL_DIRECTOR_ENABLED", inputRole: "combobox", inputName: "Review workflow", submitName: "Prepare review checklist" },
  { role: "Front Desk", slug: "front_desk", featureFlag: "STAFF_COPILOT_FRONT_DESK_ENABLED", inputRole: "combobox", inputName: "Front Desk workflow", submitName: "Prepare operational checklist" },
  { role: "Doctor", slug: "doctor", featureFlag: "STAFF_COPILOT_DOCTOR_ENABLED", inputRole: "combobox", inputName: "Doctor workflow", submitName: "Prepare workflow checklist" },
  { role: "Dietitian", slug: "dietitian", featureFlag: "STAFF_COPILOT_DIETITIAN_ENABLED", inputRole: "combobox", inputName: "Dietitian review workflow", submitName: "Prepare review checklist" },
  { role: "Fitness Trainer", slug: "fitness_trainer", featureFlag: "STAFF_COPILOT_FITNESS_TRAINER_ENABLED", inputRole: "combobox", inputName: "Fitness Trainer workflow", submitName: "Prepare trainer checklist" },
  { role: "Health Coach", slug: "health_coach", featureFlag: "HEALTH_COACH_COPILOT_ENABLED", requiresExternalAi: true },
  { role: "Psychologist", slug: "psychologist", featureFlag: "STAFF_COPILOT_PSYCHOLOGIST_ENABLED", inputRole: "combobox", inputName: "Psychologist workflow", submitName: "Prepare workflow checklist" },
  { role: "Finance", slug: "finance", featureFlag: "STAFF_COPILOT_FINANCE_ENABLED", inputRole: "combobox", inputName: "Finance process", submitName: "Prepare process checklist" },
  { role: "HR", slug: "hr", featureFlag: "STAFF_COPILOT_HR_ENABLED", inputRole: "combobox", inputName: "HR process", submitName: "Prepare process checklist" },
  { role: "Staff", slug: "staff", featureFlag: "STAFF_COPILOT_STAFF_ENABLED", inputRole: "textbox", inputName: "Which Cureocity area do you want to find?", submitName: "Prepare navigation checklist" },
];

export function credentialPrefix(slug) {
  return `ASSISTANT_E2E_${slug.toUpperCase()}`;
}

export function syntheticEmail(slug) {
  return `dev.assistant.${slug.replaceAll("_", ".")}@cureocity.test`;
}

export function syntheticName(role) {
  return `Development Assistant ${role}`;
}

export function isSafeDevelopmentSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && (url.hostname === "127.0.0.1" || url.hostname === "localhost")
      && url.port === "54321";
  } catch {
    return false;
  }
}

export function isSafeDevelopmentAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && (url.hostname === "127.0.0.1" || url.hostname === "localhost")
      && url.port === "3000";
  } catch {
    return false;
  }
}

export function parseEnvFile(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function expectedAssistantAvailability(account, developmentEnv) {
  if (developmentEnv.CUREOCITY_ASSISTANT_DISABLED === "true") return false;
  if (developmentEnv[account.featureFlag] !== "true") return false;
  if (account.requiresExternalAi && !developmentEnv.OPENAI_API_KEY) return false;
  return true;
}
