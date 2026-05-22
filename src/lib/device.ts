export function getDeviceFingerprint(
  req: Request
): string | null {
  const userAgent = req.headers.get("user-agent") || "";
  const acceptLanguage = req.headers.get("accept-language") || "";
  const secChUa = req.headers.get("sec-ch-ua") || "";

  return Buffer.from(`${userAgent}|${acceptLanguage}|${secChUa}`)
    .toString("base64")
    .substring(0, 64);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}

export function getUserAgent(req: Request): string {
  return req.headers.get("user-agent") || "unknown";
}

export function isRequestFromDifferentDevice(
  currentDeviceId: string | null,
  storedDeviceId: string | null,
  currentIp: string,
  storedIp: string | null
): boolean {
  if (!currentDeviceId || !storedDeviceId) return true;

  const deviceDiff = currentDeviceId !== storedDeviceId;
  const ipDiff = currentIp !== storedIp;

  return deviceDiff || ipDiff;
}
