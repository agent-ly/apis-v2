import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IPinfoWrapper } from "node-ipinfo";

@Injectable()
export class LocatorService {
  private readonly ipinfo: IPinfoWrapper;

  constructor(private readonly configService: ConfigService) {
    this.ipinfo = new IPinfoWrapper(this.configService.get("IPINFO_TOKEN", ""));
  }

  async locate(ip: string) {
    const ipInfo = await this.ipinfo.lookupIp(ip);
    if (ipInfo.bogon) {
      throw new BadRequestException("Invalid IP.");
    }
    const [lat, long] = ipInfo.loc.split(",").map((s: string) => parseFloat(s));
    const server = getClosestServerFromCoordinate({ lat, long });
    if (!server) {
      throw new BadRequestException(
        "Something went wrong while trying to locate a server."
      );
    }
    server.countryCode = server.countryCode.toLowerCase();
    if (server.stateOrRegion) {
      server.stateOrRegion = server.stateOrRegion.toLowerCase();
    }
    if (server.cityOrProvince) {
      server.cityOrProvince = server.cityOrProvince
        .toLowerCase()
        .replaceAll(" ", "");
    }
    return server;
  }
}

interface Coordinates {
  lat: number;
  long: number;
}

interface Server {
  countryCode: string;
  stateOrRegion?: string;
  cityOrProvince?: string;
  coordinates: Coordinates;
}

const Servers: Server[] = [
  {
    countryCode: "US",
    stateOrRegion: "New Jersey",
    cityOrProvince: "Secaucus",
    coordinates: { lat: 40.7895, long: -74.0565 },
  },
  {
    countryCode: "US",
    stateOrRegion: "New York",
    cityOrProvince: "New York",
    coordinates: { lat: 40.7143, long: -74.006 },
  },
  {
    countryCode: "US",
    stateOrRegion: "Washington",
    cityOrProvince: "Seattle",
    coordinates: { lat: 47.6062, long: -122.3321 },
  },
  {
    countryCode: "US",
    stateOrRegion: "Illinois",
    cityOrProvince: "Chicago",
    coordinates: { lat: 41.85, long: -87.65 },
  },
  {
    countryCode: "US",
    stateOrRegion: "Virginia",
    cityOrProvince: "Ashburn",
    coordinates: { lat: 39.0437, long: -77.4875 },
  },
  {
    countryCode: "US",
    stateOrRegion: "California",
    cityOrProvince: "San Francisco",
    coordinates: { lat: 37.7749, long: -122.4194 },
  },
  {
    countryCode: "US",
    stateOrRegion: "California",
    cityOrProvince: "Los Angeles",
    coordinates: { lat: 34.0522, long: -118.2437 },
  },
  /*{
    countryCode: "US",
    stateOrRegion: "California",
    cityOrProvince: "San Mateo",
    coordinates: { lat: 37.5395, long: -122.2998 },
  },*/
  {
    countryCode: "US",
    stateOrRegion: "Texas",
    cityOrProvince: "Austin",
    coordinates: { lat: 30.2672, long: -97.7431 },
  },
  {
    countryCode: "US",
    stateOrRegion: "Texas",
    cityOrProvince: "Dallas",
    coordinates: { lat: 32.7831, long: -96.8067 },
  },
  {
    countryCode: "US",
    stateOrRegion: "Georgia",
    cityOrProvince: "Atlanta",
    coordinates: { lat: 33.749, long: -84.388 },
  },
  {
    countryCode: "US",
    stateOrRegion: "Florida",
    cityOrProvince: "Miami",
    coordinates: { lat: 25.7743, long: -80.1937 },
  },
  {
    countryCode: "US",
    stateOrRegion: "Virginia",
    cityOrProvince: "Reston",
    coordinates: { lat: 38.9687, long: -77.3411 },
  },
  { countryCode: "DE", coordinates: { lat: 50.1155, long: 8.6842 } },
  { countryCode: "GB", coordinates: { lat: 51.5095, long: -0.5954 } },
  { countryCode: "FR", coordinates: { lat: 48.9356, long: 2.3539 } },
  { countryCode: "PL", coordinates: { lat: 52.2298, long: 21.0118 } },
  { countryCode: "HK", coordinates: { lat: 22.2783, long: 114.1747 } },
  { countryCode: "JP", coordinates: { lat: 35.6895, long: 139.6917 } },
  { countryCode: "SG", coordinates: { lat: 1.2897, long: 103.8501 } },
  { countryCode: "IN", coordinates: { lat: 19.0728, long: 72.8826 } },
  { countryCode: "AU", coordinates: { lat: -33.8678, long: 151.2073 } },
];

function getDistanceBetweenCoordinates(a: Coordinates, b: Coordinates) {
  const R = 6371e3; // metres
  const φ1 = (a.lat * Math.PI) / 180; // φ, λ in radians
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.long - a.long) * Math.PI) / 180;
  const angle =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      )
    );
  return R * angle;
}

function getClosestServerFromCoordinate(coordinate: Coordinates) {
  let closestServer: Server | undefined;
  let closestDistance = Infinity;
  for (const server of Servers) {
    const distance = getDistanceBetweenCoordinates(
      coordinate,
      server.coordinates
    );
    if (distance < closestDistance) {
      closestServer = server;
      closestDistance = distance;
    }
  }
  return closestServer;
}
