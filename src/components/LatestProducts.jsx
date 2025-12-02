import React from "react";

export default function LatestProducts({ items = [] }) {
  
  // Only take the latest 5 products
  const latest = items.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm text-sprada3">Latest Products</div>
          <div className="text-lg font-bold text-sprada2">Recent uploads</div>
        </div>
      </div>

      <div className="space-y-3">
        {latest.map(p => (
          <div key={p.id} className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md bg-gray-100 overflow-hidden">
              {p.primary_image ? (
                <img
                  src={p.primary_image}
                  alt={p.title}
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>

            <div className="flex-1">
              <div className="font-medium text-sprada2">{p.title}</div>
              <div className="text-xs text-sprada2/60">
                {p.short_description || p.slug}
              </div>
            </div>

            <div className="text-sm text-sprada2 font-semibold">
              {p.price ? `${p.currency || "₹"} ${p.price}` : "-"}
            </div>
          </div>
        ))}

        {latest.length === 0 && (
          <div className="text-sm text-sprada2/60">No recent products</div>
        )}
      </div>
    </div>
  );
}
