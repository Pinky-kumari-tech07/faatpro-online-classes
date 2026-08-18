import { describe, it, expect } from "vitest";

const ROLE_PRIORITY = [
  "super_admin","organization_admin","instructor","staff","parent","student",
] as const;

function computePrimaryRole(memberships: Array<{ roles: string[] }>) {
  const all = memberships.flatMap((m) => m.roles);
  return ROLE_PRIORITY.find((r) => all.includes(r)) ?? null;
}

describe("BUG-001 primaryRole computation", () => {
  it("returns null when no memberships", () => {
    expect(computePrimaryRole([])).toBeNull();
  });
  it("returns instructor for a plain instructor", () => {
    expect(computePrimaryRole([{ roles: ["instructor"] }])).toBe("instructor");
  });
  it("keeps instructor when also enrolled as student in another workspace", () => {
    expect(
      computePrimaryRole([{ roles: ["instructor"] }, { roles: ["student"] }]),
    ).toBe("instructor");
  });
  it("returns super_admin over instructor over student", () => {
    expect(
      computePrimaryRole([
        { roles: ["student"] },
        { roles: ["instructor"] },
        { roles: ["super_admin"] },
      ]),
    ).toBe("super_admin");
  });
  it("returns organization_admin over instructor when combined", () => {
    expect(computePrimaryRole([{ roles: ["instructor","organization_admin"] }]))
      .toBe("organization_admin");
  });
});

describe("BUG-001 dashboard routing (mirror of DashboardContainer)", () => {
  function routeFor(primaryRole: string | null) {
    switch (primaryRole) {
      case "super_admin":
      case "organization_admin":
      case "staff": return "admin";
      case "instructor": return "instructor";
      case "parent": return "parent";
      case "student": return "student";
      default: return "guest";
    }
  }
  it("instructor → instructor dashboard", () => expect(routeFor("instructor")).toBe("instructor"));
  it("student → student dashboard", () => expect(routeFor("student")).toBe("student"));
  it("null → guest", () => expect(routeFor(null)).toBe("guest"));
  it("staff → admin dashboard", () => expect(routeFor("staff")).toBe("admin"));
});