// Read queries for the person-archive dashboard. These use the RLS-enforced
// user client (not service role): the `for all using (tenant_id =
// current_tenant_id())` policies scope every row to the logged-in tenant, so no
// manual tenant filter is needed here. Writes still go through service-role
// actions in lib/actions/people.ts.

import { createClient } from "@/lib/supabase/server";

export type PersonListItem = {
  id: string;
  name: string;
  note: string | null;
  photoCount: number;
};

export type PersonPhoto = {
  photoId: string;
  url: string | null;
  eventId: string;
  eventName: string;
  confidence: number | null;
};

export type PendingMatch = {
  id: string;
  photoId: string;
  url: string | null;
  eventId: string;
  eventName: string;
  confidence: number | null;
};

export async function listPeople(q?: string): Promise<PersonListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("people")
    .select("id, name, note, photo_people(count)")
    .order("name");
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    note: p.note,
    photoCount: (p.photo_people as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function getPerson(personId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, name, note")
    .eq("id", personId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPersonPhotos(
  personId: string,
  eventId?: string,
): Promise<PersonPhoto[]> {
  const supabase = await createClient();
  let query = supabase
    .from("photo_people")
    .select("photo_id, confidence, event_id, photos!inner(r2_web_url), events!inner(name)")
    .eq("person_id", personId)
    .eq("status", "confirmed")
    .order("confidence", { ascending: false });
  if (eventId) query = query.eq("event_id", eventId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((r) => ({
    photoId: r.photo_id,
    url: (r.photos as unknown as { r2_web_url: string | null }).r2_web_url,
    eventId: r.event_id,
    eventName: (r.events as unknown as { name: string }).name,
    confidence: r.confidence,
  }));
}

export async function getPendingMatches(personId: string): Promise<PendingMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photo_people")
    .select("id, photo_id, confidence, event_id, photos!inner(r2_web_url), events!inner(name)")
    .eq("person_id", personId)
    .eq("status", "pending")
    .order("confidence", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    photoId: r.photo_id,
    url: (r.photos as unknown as { r2_web_url: string | null }).r2_web_url,
    eventId: r.event_id,
    eventName: (r.events as unknown as { name: string }).name,
    confidence: r.confidence,
  }));
}

export async function getTenantEvents(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/** Count of pending (person × event) scan units — drives the scan runner banner. */
export async function getPendingScanCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("person_event_scans")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export type EventPerson = { id: string; name: string; count: number };
export type EventPeopleResult = {
  people: EventPerson[];
  photoIdsByPerson: Record<string, string[]>;
};

/** Group flat (person × photo) rows into a sorted people list + photo-id map. Pure. */
export function groupEventPeople(
  rows: { personId: string; name: string; photoId: string }[],
): EventPeopleResult {
  const photoIdsByPerson: Record<string, string[]> = {};
  const nameById: Record<string, string> = {};
  for (const r of rows) {
    (photoIdsByPerson[r.personId] ??= []).push(r.photoId);
    nameById[r.personId] = r.name;
  }
  const people = Object.keys(photoIdsByPerson)
    .map((id) => ({ id, name: nameById[id], count: photoIdsByPerson[id].length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { people, photoIdsByPerson };
}

/** Confirmed named people in an event, with per-person photo ids (RLS-scoped). */
export async function getEventPeople(eventId: string): Promise<EventPeopleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photo_people")
    .select("person_id, photo_id, people!inner(name)")
    .eq("event_id", eventId)
    .eq("status", "confirmed");
  if (error) throw error;

  const flat = (data ?? []).map((r) => ({
    personId: r.person_id,
    photoId: r.photo_id,
    name: (r.people as unknown as { name: string }).name,
  }));
  return groupEventPeople(flat);
}
