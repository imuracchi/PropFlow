type Point = { lat: number; lng: number };
type Route = {
  path?: Point[];
  localizedValues?: { duration?: string; distance?: string };
  warnings?: string[];
  legs?: { steps?: { instructions?: string; localizedValues?: { distance?: string } }[] }[];
};
type MapsLoader = { importLibrary(name: string): Promise<unknown> };
type RoutesLibrary = {
  Route: { computeRoutes(request: {
    origin: string; destination: string; travelMode: string; language: string;
    region: string; fields: string[];
  }): Promise<{ routes?: Route[] }> };
};
type GeometryLibrary = { encoding: { encodePath(path: Point[]): string } };

export async function getWalkingRoute(maps: MapsLoader, origin: string, destination: string) {
  const { Route } = await maps.importLibrary("routes") as RoutesLibrary;
  const { routes } = await Route.computeRoutes({
    origin, destination, travelMode: "WALKING", language: "ja", region: "jp",
    fields: ["path", "legs", "localizedValues", "warnings"],
  });
  const route = routes?.[0];
  if (!route?.path || route.path.length < 2) return null;
  const path = route.path.map(({ lat, lng }) => ({ lat, lng }));
  if (path.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lng))) return null;
  const { encoding } = await maps.importLibrary("geometry") as GeometryLibrary;
  const first = path[0];
  const last = path[path.length - 1];
  return {
    polyline: encoding.encodePath(path),
    duration: route.localizedValues?.duration ?? "",
    distance: route.localizedValues?.distance ?? "",
    startLat: first.lat, startLng: first.lng, endLat: last.lat, endLng: last.lng,
    steps: (route.legs ?? []).flatMap(leg => (leg.steps ?? []).map(step => ({
      instruction: step.instructions ?? "", distance: step.localizedValues?.distance ?? "",
    }))),
    warnings: route.warnings ?? [],
  };
}

export function escapeRouteText(value: string) {
  return value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
