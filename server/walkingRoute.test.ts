import { describe, expect, it, vi } from "vitest";
import { escapeRouteText, getWalkingRoute } from "../client/src/lib/walkingRoute";

function setup(routes: unknown[]) {
  const computeRoutes = vi.fn().mockResolvedValue({ routes });
  const encodePath = vi.fn().mockReturnValue("encoded-path");
  const importLibrary = vi.fn(async (name: string) => name === "routes"
    ? { Route: { computeRoutes } } : { encoding: { encodePath } });
  return { computeRoutes, encodePath, importLibrary };
}

describe("walking route for property documents", () => {
  it("converts Routes API geometry and Japanese instructions for the existing document", async () => {
    const sdk = setup([{
      path: [{ lat: 35.7, lng: 139.6, altitude: 0 }, { lat: 35.71, lng: 139.61 }],
      localizedValues: { duration: "3分", distance: "200 m" },
      legs: [{ steps: [{ instructions: "右折する", localizedValues: { distance: "200 m" } }] }],
      warnings: ["歩道がない場合があります"],
    }]);
    const result = await getWalkingRoute(sdk, "椎名町駅", "東京都豊島区南長崎");
    expect(sdk.computeRoutes).toHaveBeenCalledWith(expect.objectContaining({
      origin: "椎名町駅", destination: "東京都豊島区南長崎", travelMode: "WALKING", language: "ja",
      fields: ["path", "legs", "localizedValues", "warnings"],
    }));
    expect(sdk.encodePath).toHaveBeenCalledWith([{ lat: 35.7, lng: 139.6 }, { lat: 35.71, lng: 139.61 }]);
    expect(result).toEqual({ polyline: "encoded-path", duration: "3分", distance: "200 m",
      startLat: 35.7, startLng: 139.6, endLat: 35.71, endLng: 139.61,
      steps: [{ instruction: "右折する", distance: "200 m" }], warnings: ["歩道がない場合があります"] });
  });
  it.each([[], [{}], [{ path: [] }], [{ path: [{ lat: 35, lng: 139 }] }],
    [{ path: [{ lat: NaN, lng: 139 }, { lat: 35, lng: 139 }] }]])("falls back when no usable path is returned: %j", async (...args) => {
    const sdk = setup(args);
    expect(await getWalkingRoute(sdk, "駅", "住所")).toBeNull();
    expect(sdk.encodePath).not.toHaveBeenCalled();
  });
  it("propagates authorization failures to the document's existing fallback", async () => {
    const sdk = setup([]);
    sdk.computeRoutes.mockRejectedValue(new Error("REQUEST_DENIED"));
    await expect(getWalkingRoute(sdk, "駅", "住所")).rejects.toThrow("REQUEST_DENIED");
  });
  it("renders navigation text as text rather than HTML", () => {
    expect(escapeRouteText('<img src=x onerror="alert(1)">&')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;');
  });
});
