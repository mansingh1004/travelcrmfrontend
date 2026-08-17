// src/features/hotels/pages/HotelAmenities.jsx
// Amenity master — the catalogue of facilities a hotel can offer, toggleable.
import { useEffect, useState } from "react";
import {
  Sparkles, Plus, Wifi, Waves, UtensilsCrossed, Dumbbell, Flower2, CircleParking,
  Plane, BellRing, Shirt, Wine, Snowflake, Coffee, Check,
} from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, GlassCard, Button, cn,
  LoadingState, useToast, errMsg,
} from "../components/hotelUi";

const ICONS = {
  wifi: Wifi, pool: Waves, restaurant: UtensilsCrossed, gym: Dumbbell, spa: Flower2,
  parking: CircleParking, airport: Plane, roomservice: BellRing, laundry: Shirt, bar: Wine,
  ac: Snowflake, breakfast: Coffee,
};

export default function HotelAmenities() {
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState(null);
  const [enabled, setEnabled] = useState({});

  useEffect(() => {
    let alive = true;
    hotelService.amenityCatalog()
      .then((c) => {
        if (!alive) return;
        setCatalog(c);
        setEnabled(Object.fromEntries(c.map((a) => [a.key, true])));
      })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load amenities."), "error"));
    return () => { alive = false; };
  }, [showToast]);

  const toggle = (key) => setEnabled((e) => ({ ...e, [key]: !e[key] }));
  const activeCount = Object.values(enabled).filter(Boolean).length;

  if (!catalog) return <PageShell><LoadingState label="Loading amenities…" /></PageShell>;

  return (
    <PageShell>
      <PageHeader title="Amenities" subtitle={`${activeCount} of ${catalog.length} facilities enabled`} icon={Sparkles}>
        <Button size="sm"><Plus className="h-4 w-4" /> Add Amenity</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {catalog.map((a) => {
          const Icon = ICONS[a.key] || Sparkles;
          const on = enabled[a.key];
          return (
            <GlassCard key={a.key} className={cn("p-5 transition-all hover:shadow-md", on ? "" : "opacity-70")}>
              <div className="flex items-start justify-between">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", on ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-slate-100 text-slate-400")}>
                  <Icon className="h-6 w-6" />
                </div>
                <button onClick={() => toggle(a.key)}
                  className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-blue-600" : "bg-slate-200")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
              <p className="mt-3 font-extrabold text-slate-800">{a.label}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-400">
                {on ? <><Check className="h-3.5 w-3.5 text-green-500" /> Enabled</> : "Disabled"}
              </p>
            </GlassCard>
          );
        })}
      </div>
    </PageShell>
  );
}
