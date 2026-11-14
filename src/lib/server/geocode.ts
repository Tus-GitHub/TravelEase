/** Profile and booking searches share one distributed, cached free-service budget. */
import { routePoint } from '../booking-route';
import { searchMapPlaces, reverseMapPlace, type MapPlace } from './map-services';
export interface GeoPoint { lat: number; lng: number }
export type GeoResult = MapPlace;
export async function geocodeForward(query: string): Promise<GeoResult[]> { return searchMapPlaces(query); }
export async function geocodeReverse(lat: number, lng: number): Promise<GeoResult | null> {
  const point = routePoint({ lat, lng });
  return point ? reverseMapPlace(point) : null;
}