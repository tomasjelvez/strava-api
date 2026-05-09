import { EventDetailView } from "./event-detail-view";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventDetailView eventId={eventId} />;
}
