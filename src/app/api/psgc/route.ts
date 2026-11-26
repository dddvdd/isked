import { connection, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security";

const PSGC_BASE = "https://psgc.gitlab.io/api";
const NCR_REGION_CODE = "130000000";

interface RawPsgcItem {
  code: string;
  name: string;
  psgc10DigitCode?: string;
}

export interface PsgcOption {
  code: string;
  name: string;
  psgc10DigitCode?: string;
}

function sortByName(items: PsgcOption[]): PsgcOption[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(request: Request) {
  await connection();

  const allowed = await checkRateLimit({
    namespace: "psgc-api",
    limit: 60,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    if (type === "provinces") {
      const res = await fetch(`${PSGC_BASE}/provinces/`, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Failed to fetch PSGC provinces" },
          { status: 502 }
        );
      }
      const data = (await res.json()) as RawPsgcItem[];
      const mapped: PsgcOption[] = data.map((p) => ({
        code: p.code,
        name: p.name,
        psgc10DigitCode: p.psgc10DigitCode,
      }));
      mapped.push({
        code: NCR_REGION_CODE,
        name: "Metro Manila (NCR)",
        psgc10DigitCode: "1300000000",
      });

      return NextResponse.json(
        { items: sortByName(mapped) },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=86400, stale-while-revalidate=604800",
          },
        }
      );
    }

    if (type === "municipalities") {
      const provinceCode = searchParams.get("provinceCode") ?? "";
      if (!/^\d{9,10}$/.test(provinceCode)) {
        return NextResponse.json(
          { error: "Invalid provinceCode" },
          { status: 400 }
        );
      }

      const endpoint =
        provinceCode === NCR_REGION_CODE
          ? `${PSGC_BASE}/regions/${NCR_REGION_CODE}/cities-municipalities/`
          : `${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities/`;

      const res = await fetch(endpoint, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Failed to fetch PSGC municipalities" },
          { status: 502 }
        );
      }
      const data = (await res.json()) as RawPsgcItem[];
      const mapped: PsgcOption[] = data.map((m) => ({
        code: m.code,
        name: m.name,
        psgc10DigitCode: m.psgc10DigitCode,
      }));

      return NextResponse.json(
        { items: sortByName(mapped) },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=86400, stale-while-revalidate=604800",
          },
        }
      );
    }

    if (type === "barangays") {
      const municipalityCode = searchParams.get("municipalityCode") ?? "";
      if (!/^\d{9,10}$/.test(municipalityCode)) {
        return NextResponse.json(
          { error: "Invalid municipalityCode" },
          { status: 400 }
        );
      }

      const res = await fetch(
        `${PSGC_BASE}/cities-municipalities/${municipalityCode}/barangays/`,
        {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: "Failed to fetch PSGC barangays" },
          { status: 502 }
        );
      }
      const data = (await res.json()) as RawPsgcItem[];
      const mapped: PsgcOption[] = data.map((b) => ({
        code: b.code,
        name: b.name,
        psgc10DigitCode: b.psgc10DigitCode,
      }));

      return NextResponse.json(
        { items: sortByName(mapped) },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=86400, stale-while-revalidate=604800",
          },
        }
      );
    }

    return NextResponse.json(
      { error: "Invalid PSGC query type" },
      { status: 400 }
    );
  } catch (err) {
    console.error("PSGC proxy error:", err);
    return NextResponse.json(
      { error: "Unable to reach PSGC service" },
      { status: 502 }
    );
  }
}
