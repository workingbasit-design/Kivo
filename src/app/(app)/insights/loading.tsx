import React from "react";
import { Card } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading insights">
      <div className="h-9 w-56 bg-line rounded-xl animate-pulse" />
      <div className="h-4 w-80 bg-surface-2 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-5">
            <div className="h-3 w-24 bg-line rounded animate-pulse" />
            <div className="h-8 w-20 bg-line rounded mt-3 animate-pulse" />
            <div className="h-3 w-32 bg-surface-2 rounded mt-2 animate-pulse" />
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="h-4 w-40 bg-line rounded animate-pulse" />
            {[...Array(4)].map((_, j) => (
              <div key={j}>
                <div className="h-3 w-full bg-surface-2 rounded animate-pulse" />
                <div className="h-2.5 w-full bg-surface-2 rounded-full mt-2 animate-pulse" />
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
