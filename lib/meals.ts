export const MEALS = [
  { key: "breakfast", label: "Breakfast", icon: "🍳" },
  { key: "lunch", label: "Lunch", icon: "🍲" },
  { key: "snack", label: "Snack", icon: "🍎" },
  { key: "dinner", label: "Dinner", icon: "🍽️" },
] as const;

export type MealLog = {
  id?: string;
  client_id: string;
  date: string;
  meal: string;
  description: string | null;
  review: string | null;
  doubt: string | null;
  doubt_answer: string | null;
  nudged: boolean;
};
