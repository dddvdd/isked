"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface EventPopularityDatum {
  name: string;
  bookings: number;
  views: number;
}

export interface DayDistributionDatum {
  day: string;
  bookings: number;
}

export interface HourDistributionDatum {
  hour: string;
  bookings: number;
}

export function AnalyticsChartsClient({
  popularEvents,
  byDayOfWeek,
  byHourOfDay,
}: {
  popularEvents: EventPopularityDatum[];
  byDayOfWeek: DayDistributionDatum[];
  byHourOfDay: HourDistributionDatum[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Popular Event Types</CardTitle>
          <CardDescription>
            Confirmed bookings vs. booking page views per event type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {popularEvents.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Create an event type to start collecting booking analytics.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularEvents}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar
                    dataKey="views"
                    name="Page Views"
                    fill="#c4b39e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="bookings"
                    name="Confirmed Bookings"
                    fill="#0e9aa7"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings by Day of Week</CardTitle>
          <CardDescription>
            Activity distribution across weekdays in your timezone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar
                  dataKey="bookings"
                  name="Bookings"
                  fill="#0e9aa7"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings by Hour of Day</CardTitle>
          <CardDescription>
            Peak meeting start hours in your primary timezone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHourOfDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" fontSize={11} interval={2} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar
                  dataKey="bookings"
                  name="Bookings"
                  fill="#3b2920"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

