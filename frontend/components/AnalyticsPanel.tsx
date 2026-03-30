"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function AnalyticsPanel({ data }: { data: Array<{ condition: string; count: number }> }) {
  return (
    <div className="card p-5">
      <p className="section-title">Population Disease Trends</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="condition" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#0C8D86" radius={6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
