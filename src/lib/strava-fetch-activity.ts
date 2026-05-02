import { stravaApiGetForUser } from "@/lib/strava-connection";

/** Pass-through GET `GET /activities/:id`; caller checks `response.ok`. */
export function fetchStravaActivityDetail(
  userId: string,
  activityId: number
): Promise<Response> {
  return stravaApiGetForUser(userId, `/activities/${activityId}`);
}
