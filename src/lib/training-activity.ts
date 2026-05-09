/**
 * Subset of Strava summary activity fields used by the Today training card.
 */
export type TrainingActivity = {
  id: number | string;
  name: string;
  type?: string;
  distance?: number;
  moving_time?: number;
  start_date?: string;
  average_heartrate?: number;
  source: "strava" | "mock";
};

const MOCK_TODAY_ACTIVITY: TrainingActivity = {
  id: "mock-today",
  name: "Intervals 5x1km",
  type: "Run",
  distance: 8400,
  moving_time: 41 * 60,
  start_date: undefined,
  average_heartrate: 168,
  source: "mock",
};

export function getMockTodayActivity(): TrainingActivity {
  return { ...MOCK_TODAY_ACTIVITY, start_date: new Date().toISOString() };
}
