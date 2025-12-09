// URL is available as a global in modern environments (Browsers and Node.js 10+)

// Precompiled regular expressions to avoid re-creating RegExp objects on every call
const DATE_RE = /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
  DURATION_RE = /^P(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/,
  EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  HOSTNAME_RE =
    /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/,
  IPV4_RE =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  IPV6_RE =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(([0-9a-fA-F]{1,4}:){1,7}:)|(([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2})|(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3})|(([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4})|(([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5})|([0-9a-fA-F]{1,4}:)((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9]))$/,
  RFC3339_RE =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
  UUID_RE =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// String format validator - extract format logic outside of Validator
export interface StringFormatValidatorInterface {
  validate(format: string, value: string): boolean;
}

export class StringFormatValidator implements StringFormatValidatorInterface {
  validate(format: string, value: string): boolean {
    switch (format) {
      case "date-time":
        return this.isDateTime(value);
      case "date":
        return this.isDate(value);
      case "email":
        return this.isEmail(value);
      case "hostname":
        return this.isHostname(value);
      case "ipv4":
        return this.isIPv4(value);
      case "ipv6":
        return this.isIPv6(value);
      case "uri":
        return this.isUri(value);
      case "uuid":
        return this.isUuid(value);
      case "duration":
        return this.isDuration(value);
      default:
        return true;
    }
  }

  private isDateTime(value: string): boolean {
    if (!RFC3339_RE.test(value)) return false;
    return !isNaN(Date.parse(value));
  }

  private isDate(value: string): boolean {
    const m = DATE_RE.exec(value);
    if (!m) return false;
    const year = Number(m[1]),
      month = Number(m[2]),
      day = Number(m[3]),
      daysInMonth = [
        31,
        year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
      ];
    return day <= daysInMonth[month - 1];
  }

  private isEmail(value: string): boolean {
    return EMAIL_RE.test(value);
  }

  private isHostname(value: string): boolean {
    return HOSTNAME_RE.test(value);
  }

  private isIPv4(value: string): boolean {
    return IPV4_RE.test(value);
  }

  private isIPv6(value: string): boolean {
    return IPV6_RE.test(value);
  }

  private isUri(value: string): boolean {
    try {
      const u = new URL(value);
      return typeof u.protocol === "string" && u.protocol.length > 0;
    } catch {
      return false;
    }
  }

  private isUuid(value: string): boolean {
    return UUID_RE.test(value);
  }

  private isDuration(value: string): boolean {
    return DURATION_RE.test(value) && value !== "P";
  }
}

export const stringFormatValidator = new StringFormatValidator();
