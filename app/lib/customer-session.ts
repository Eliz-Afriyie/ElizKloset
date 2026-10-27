"use client";
import { createContext, useContext } from "react";
import { unwrapStore } from "./store-api";
export type CustomerUser = { id: string | number; email?: string | null; first_name?: string; last_name?: string; phone?: string; display_name?: string };
export function parseCustomerUser(value: unknown): CustomerUser {
  const data = unwrapStore(value) as Record<string, unknown>;
  const user = (data?.user ?? data) as CustomerUser;
  if (!user || !["string", "number"].includes(typeof user.id) || (typeof user.email !== "string" && typeof user.phone !== "string")) throw new Error("The account service returned an unsupported profile. Please contact the store.");
  const raw = user as CustomerUser & Record<string, unknown>;
  const text = (...values: unknown[]) => values.find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const first = text(raw.first_name, raw.firstName, raw.firstname)?.trim();
  const last = text(raw.last_name, raw.lastName, raw.lastname)?.trim();
  const display = [first, last].filter(Boolean).join(" ") || text(raw.display_name, raw.displayName, raw.name, raw.full_name, raw.fullName)?.trim() || user.email?.split("@")[0] || user.phone || "Your account";
  return { ...user, first_name: first, last_name: last, display_name: display };
}
export type CustomerSessionValue = {
  user: CustomerUser | null; loading: boolean; error: string;
  refresh: (signal?: AbortSignal) => Promise<CustomerUser | null>;
  loadProfile: (signal?: AbortSignal) => Promise<CustomerUser>;
  requestSignOut: () => void;
  requireUser: (reason: string, afterSignIn?: () => void) => Promise<CustomerUser | null>;
  getUser: () => CustomerUser | null;
};
export const CustomerSessionContext = createContext<CustomerSessionValue>({ user: null, loading: true, error: "", refresh: async () => null, loadProfile: async () => { throw new Error("Please sign in."); }, requestSignOut() {}, requireUser: async () => null, getUser: () => null });
export const useCustomerSession = () => useContext(CustomerSessionContext);
