import axios from "axios";
import type {
  ChatResponse,
  Lead,
  Message,
  PublicTenant,
  Tenant,
} from "./types";

/**
 * Resolve the API base at runtime so the embed iframe can be pointed at any
 * backend via `?api=` (set by widget.js from its data-api attribute), falling
 * back to the build-time env, then localhost.
 */
function resolveApiBase(): string {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) return fromQuery.replace(/\/$/, "");
  } catch {
    /* non-browser context */
  }
  return (
    (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000"
  ).replace(/\/$/, "");
}

export const API_BASE = resolveApiBase();

const ADMIN_KEY = (import.meta.env.VITE_ADMIN_API_KEY as string) || "";

const client = axios.create({ baseURL: API_BASE });
const adminClient = axios.create({
  baseURL: API_BASE,
  headers: { "X-Admin-Key": ADMIN_KEY },
});

// ── Public (widget) ──
export async function sendChat(payload: {
  tenant_id: string;
  conversation_id: string | null;
  message: string;
  is_test?: boolean;
}): Promise<ChatResponse> {
  const { data } = await client.post("/chat", payload);
  return data;
}

export async function getPublicTenant(id: string): Promise<PublicTenant> {
  const { data } = await client.get(`/tenant/${id}`);
  return data;
}

export async function getDefaultTenant(): Promise<PublicTenant> {
  const { data } = await client.get(`/default-tenant`);
  return data;
}

export async function captureEmail(conversationId: string, email: string) {
  const { data } = await client.post(`/leads/${conversationId}/email`, { email });
  return data;
}

export async function markBooked(conversationId: string) {
  const { data } = await client.post(`/leads/${conversationId}/booked`, {});
  return data;
}

// ── Admin ──
export async function listTenants(): Promise<Tenant[]> {
  const { data } = await adminClient.get("/admin/tenants");
  return data;
}

export async function getTenant(id: string): Promise<Tenant> {
  const { data } = await adminClient.get(`/admin/tenants/${id}`);
  return data;
}

export async function createTenant(body: Partial<Tenant>): Promise<Tenant> {
  const { data } = await adminClient.post("/tenant", body);
  return data;
}

export async function updateTenant(id: string, body: Partial<Tenant>): Promise<Tenant> {
  const { data } = await adminClient.put(`/tenant/${id}`, body);
  return data;
}

export async function deleteTenant(id: string) {
  const { data } = await adminClient.delete(`/tenant/${id}`);
  return data;
}

export async function listLeads(params?: {
  include_test?: boolean;
  tenant_id?: string;
  priority?: string;
}): Promise<Lead[]> {
  const { data } = await adminClient.get("/leads", { params });
  return data;
}

export async function getLeadDetail(conversationId: string): Promise<{
  lead: Lead;
  conversation: { id: string; state: string };
  messages: Message[];
}> {
  const { data } = await adminClient.get(`/leads/${conversationId}`);
  return data;
}

export async function deleteConversation(conversationId: string) {
  const { data } = await adminClient.delete(`/conversation/${conversationId}`);
  return data;
}
