import { describe, expect, it } from "vitest";
import { StringFormatValidator } from "./stringformat";

const fmt = new StringFormatValidator(); // Test format validator directly

describe("validateFormat", () => {
  it("date-time valid", () => {
    expect(fmt.validate("date-time", "2022-01-01T12:34:56Z")).toBe(true);
    expect(fmt.validate("date-time", "2022-01-01T12:34:56+08:00")).toBe(true);
    expect(fmt.validate("date-time", "2022-01-01 12:34:56")).toBe(false);
    expect(fmt.validate("date-time", "not-a-date")).toBe(false);
  });

  it("date valid", () => {
    expect(fmt.validate("date", "2022-01-01")).toBe(true);
    expect(fmt.validate("date", "2000-02-29")).toBe(true); // Leap year
    expect(fmt.validate("date", "1900-02-29")).toBe(false); // 1900 not leap
    expect(fmt.validate("date", "2022-13-01")).toBe(false);
  });

  it("email valid", () => {
    expect(fmt.validate("email", "foo@bar.com")).toBe(true);
    expect(fmt.validate("email", "user+tag@example.co.uk")).toBe(true);
    expect(fmt.validate("email", "foo@bar")).toBe(false);
    expect(fmt.validate("email", "@no-local-part.com")).toBe(false);
  });

  it("hostname valid", () => {
    expect(fmt.validate("hostname", "example.com")).toBe(true);
    expect(fmt.validate("hostname", "sub.domain.example")).toBe(true);
    expect(fmt.validate("hostname", "exa-mple.com")).toBe(true);
    expect(fmt.validate("hostname", "-badhost")).toBe(false);
    expect(fmt.validate("hostname", "underscore_name")).toBe(false);
  });

  it("ipv4 valid", () => {
    expect(fmt.validate("ipv4", "192.168.1.1")).toBe(true);
    expect(fmt.validate("ipv4", "0.0.0.0")).toBe(true);
    expect(fmt.validate("ipv4", "255.255.255.255")).toBe(true);
    expect(fmt.validate("ipv4", "256.0.0.1")).toBe(false);
    expect(fmt.validate("ipv4", "999.999.999.999")).toBe(false);
  });

  it("ipv6 valid", () => {
    expect(
      fmt.validate("ipv6", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"),
    ).toBe(true);
    expect(fmt.validate("ipv6", "2001:db8:85a3::8a2e:370:7334")).toBe(true);
    expect(fmt.validate("ipv6", "::1")).toBe(true);
    expect(fmt.validate("ipv6", "::ffff:192.0.2.128")).toBe(true);
    expect(fmt.validate("ipv6", "2001::85a3::7334")).toBe(false);
    expect(fmt.validate("ipv6", "not-an-ipv6")).toBe(false);
  });

  it("uri valid", () => {
    expect(fmt.validate("uri", "http://example.com")).toBe(true);
    expect(fmt.validate("uri", "https://example.com/path?x=1#frag")).toBe(true);
    expect(fmt.validate("uri", "mailto:user@example.com")).toBe(true);
    expect(fmt.validate("uri", "//relative.com/path")).toBe(false);
    expect(fmt.validate("uri", "not-a-uri")).toBe(false);
  });

  it("uuid valid", () => {
    expect(fmt.validate("uuid", "123e4567-e89b-12d3-a456-426614174000")).toBe(
      true,
    );
    expect(fmt.validate("uuid", "123E4567-E89B-12D3-A456-426614174000")).toBe(
      true,
    );
    expect(fmt.validate("uuid", "123e4567-e89b-12d3-a456-42661417400")).toBe(
      false,
    );
    expect(fmt.validate("uuid", "not-a-uuid")).toBe(false);
  });

  it("duration valid", () => {
    expect(fmt.validate("duration", "P1Y2M10DT2H30M")).toBe(true);
    expect(fmt.validate("duration", "P3Y6M4DT12H30M5S")).toBe(true);
    expect(fmt.validate("duration", "PT20M")).toBe(true);
    expect(fmt.validate("duration", "P")).toBe(false);
    expect(fmt.validate("duration", "not-duration")).toBe(false);
  });

  it("default always true", () => {
    expect(fmt.validate("unknown-format", "anything")).toBe(true);
  });
});
