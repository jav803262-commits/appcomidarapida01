import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_NAME, businessInitials } from "@/lib/business-name";

describe("businessInitials", () => {
  it.each([
    ["Tacos El Güero", "TE"],
    ["Negocio de Prueba", "ND"],
    ["Pizzas", "PI"],
    ["A", "A"],
    ["ñandú express", "ÑE"],
    ["  Burgers   del Norte ", "BD"],
    ["🍕 Pizza Roma", "PR"],
  ])("«%s» → %s", (name, expected) => {
    expect(businessInitials(name)).toBe(expected);
  });

  it("sin nombre utilizable usa las iniciales del nombre por defecto", () => {
    expect(businessInitials("")).toBe(businessInitials(DEFAULT_BUSINESS_NAME));
    expect(businessInitials("   ")).toBe("MN");
    expect(businessInitials("🍕🍔")).toBe("MN");
  });
});
