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

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_PATTERN = /^[0-9a-fA-F:]{2,45}$/;

export function isValidIp(value: string): boolean {
  const ip = value.trim();
  if (!ip) return false;

  const v4 = IPV4_PATTERN.exec(ip);
  if (v4) {
    return v4.slice(1).every((octet) => {
      const n = parseInt(octet, 10);
      return n >= 0 && n <= 255;
    });
  }

  if (ip.includes(":")) {
    return IPV6_PATTERN.test(ip) && ip !== "::";
  }
  return false;
}

function firstValidIp(candidates: (string | undefined | null)[]): string | null {
  for (const candidate of candidates) {
    if (candidate && isValidIp(candidate)) return candidate.trim();
  }
  return null;
}

/**
 * 获取客户端真实 IP。
 *
 * 该应用的限流、IP 黑名单、注册限制都依赖此值，因此：
 * - 优先读取 x-real-ip（由最靠近应用的受信任反代覆盖写入，客户端无法追加伪造）；
 * - 其次从 x-forwarded-for 链的最右端取值（最右侧由最近的受信任代理添加，
 *   客户端只能伪造链左侧的条目）；
 * - 所有候选值都做严格格式校验，防止注入伪造的非法值。
 *
 * 部署要求：本应用前方最多挂一层代理（nginx/docker 需配置
 * proxy_set_header X-Real-IP $remote_addr 覆盖客户端提交的同名头）。
 */
export function getClientIp(req: Request): string {
  const realIp = firstValidIp([req.headers.get("x-real-ip")]);
  if (realIp) return realIp;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim().replace(/^(unknown)$/i, ""))
      .filter(Boolean);
    for (let i = entries.length - 1; i >= 0; i--) {
      if (isValidIp(entries[i])) return entries[i];
    }
  }

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
