import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminDisputesRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("tab", "disputes");
  const booking = sp.booking;
  const openedBy = sp.opened_by;
  if (typeof booking === "string" && booking) qs.set("booking", booking);
  if (typeof openedBy === "string" && openedBy) qs.set("opened_by", openedBy);
  redirect(`/admin/trust?${qs.toString()}`);
}
