import { describe, expect, it } from "vitest";
import { parseDeviceIntent } from "../src/core/devices/deviceIntentParser.js";

describe("device intent parser", () => {
  it("understands common Spanish smart-home commands", () => {
    expect(parseDeviceIntent("enciende la luz").action).toBe("ON");
    expect(parseDeviceIntent("apaga el televisor").family).toBe("TV");
    expect(parseDeviceIntent("pon el brillo de la lámpara al 80%").value).toBe(80);
    expect(parseDeviceIntent("silencia la tele").action).toBe("MUTE");
  });

  it("does not guess a family when none is mentioned", () => {
    expect(() => parseDeviceIntent("haz algo")).toThrow();
  });
});
