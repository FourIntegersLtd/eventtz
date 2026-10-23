import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type ParticipantRole = "client" | "vendor";

export type ParticipantDispute = components["schemas"]["DisputePublic"];

function participantDisputesPath(role: ParticipantRole, suffix: string): string {
  return `/api/v1/${role}/${suffix}`;
}

export async function fetchParticipantBookingDisputes(
  role: ParticipantRole,
  bookingId: string,
): Promise<ParticipantDispute[]> {
  const { data } = await api.get<components["schemas"]["DisputesListResponse"]>(
    participantDisputesPath(role, `booking-requests/${bookingId}/disputes`),
  );
  return data.disputes ?? [];
}

export async function postParticipantBookingDispute(
  role: ParticipantRole,
  bookingId: string,
  summary: string,
): Promise<ParticipantDispute> {
  const { data } = await api.post<components["schemas"]["CreateDisputeResponse"]>(
    participantDisputesPath(role, `booking-requests/${bookingId}/disputes`),
    { summary } satisfies components["schemas"]["CreateDisputeBody"],
  );
  return data.dispute;
}

export const PARTICIPANT_DISPUTES_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export async function fetchParticipantDisputesPage(
  role: ParticipantRole,
  offset = 0,
  limit = PARTICIPANT_DISPUTES_PAGE_SIZE,
): Promise<{
  disputes: ParticipantDispute[];
  total: number;
  offset: number;
  limit: number;
  open_count: number;
}> {
  const { data } = await api.get<components["schemas"]["DisputesListResponse"]>(
    participantDisputesPath(role, "disputes"),
    { params: { offset, limit } },
  );
  return {
    disputes: data.disputes ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
    open_count: data.open_count ?? 0,
  };
}

export async function fetchParticipantDispute(
  role: ParticipantRole,
  disputeId: string,
): Promise<ParticipantDispute> {
  const { data } = await api.get<components["schemas"]["DisputeDetailResponse"]>(
    participantDisputesPath(role, `disputes/${encodeURIComponent(disputeId)}`),
  );
  return data.dispute;
}

export async function fetchClientBookingDisputes(bookingId: string): Promise<ParticipantDispute[]> {
  return fetchParticipantBookingDisputes("client", bookingId);
}

export async function postClientBookingDispute(
  bookingId: string,
  summary: string,
): Promise<ParticipantDispute> {
  return postParticipantBookingDispute("client", bookingId, summary);
}

export async function fetchVendorBookingDisputes(bookingId: string): Promise<ParticipantDispute[]> {
  return fetchParticipantBookingDisputes("vendor", bookingId);
}

export async function postVendorBookingDispute(
  bookingId: string,
  summary: string,
): Promise<ParticipantDispute> {
  return postParticipantBookingDispute("vendor", bookingId, summary);
}

export async function fetchClientDispute(disputeId: string): Promise<ParticipantDispute> {
  return fetchParticipantDispute("client", disputeId);
}

export async function fetchVendorDispute(disputeId: string): Promise<ParticipantDispute> {
  return fetchParticipantDispute("vendor", disputeId);
}
