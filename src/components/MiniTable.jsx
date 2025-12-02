// src/components/MiniTable.jsx
import React from "react"

export default function MiniTable({ items = [] }) {
  const rows = items.length ? items : [
    { id: 1, name: "Green Cardamom", qty: "120 kg", status: "Shipped" },
    { id: 2, name: "Napier Grass", qty: "55 TPD", status: "Pending" },
  ]

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="text-sm text-sprada3 font-medium mb-3">Recent shipments</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-sprada2/70">
            <tr>
              <th className="pb-2">Product</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t last:border-b">
                <td className="py-3">{r.name}</td>
                <td className="py-3">{r.qty}</td>
                <td className="py-3"><span className="px-2 py-1 rounded-full bg-sprada1/20 text-sprada2 text-xs">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
