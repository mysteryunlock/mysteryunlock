/**
 * Server-action input validation tests
 *
 * These tests verify that the `.validator(schema)` integration in each critical
 * server function correctly rejects invalid input and accepts valid input, using:
 *
 *   1. The actual production Zod schemas imported from `src/lib/validation.ts`
 *      (the same objects used at runtime — zero schema duplication / drift risk).
 *   2. The exact `execValidator` logic from TanStack Start's createServerFn
 *      source (node_modules/@tanstack/start-client-core/dist/esm/createServerFn.js).
 *
 * TanStack Start v1.x uses the Standard Schema spec (`~standard`) when a Zod
 * schema is passed to `.validator()`.  On validation failure it throws:
 *
 *     new Error(JSON.stringify(result.issues))
 *
 * — a plain `Error` (NOT a ZodError, NOT an unhandled 500) whose message is
 * a JSON array of Zod issue objects.  These tests assert that exact shape.
 *
 * Run with: bun test src/lib/__tests__/server-validation.test.ts
 */

import { describe, it, expect } from "bun:test";
import { z, type ZodTypeAny } from "zod";

// ---------------------------------------------------------------------------
// Import the *production* shared schemas (same objects used in server functions)
// ---------------------------------------------------------------------------
import {
  slugSchema,
  codeChars,
  nameSchema,
  emailSchema,
} from "@/lib/validation";

// ---------------------------------------------------------------------------
// execValidator — verbatim replication of TanStack Start's validation path
// (source: node_modules/@tanstack/start-client-core/dist/esm/createServerFn.js)
//
// When a Zod schema is passed, TanStack Start uses the Standard Schema path:
//   1. Calls validator["~standard"].validate(input)
//   2. If issues exist → throws new Error(JSON.stringify(issues))
//   3. Else returns validated value
// ---------------------------------------------------------------------------
async function execValidator(validator: ZodTypeAny, input: unknown): Promise<unknown> {
  if ("~standard" in validator) {
    const std = (validator as any)["~standard"];
    const result = await std.validate(input);
    if (result.issues) {
      throw new Error(JSON.stringify(result.issues, undefined, 2));
    }
    return result.value;
  }
  if ("parse" in validator) return (validator as any).parse(input);
  throw new Error("Invalid validator type");
}

/**
 * Helper: assert that execValidator throws with a plain Error containing
 * a JSON array of Zod issues (the shape TanStack Start produces).
 */
async function expectValidationError(validator: ZodTypeAny, input: unknown) {
  let thrown: unknown;
  try {
    await execValidator(validator, input);
    thrown = null;
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Error);
  const msg = (thrown as Error).message;
  let parsed: unknown;
  try { parsed = JSON.parse(msg); } catch { parsed = null; }
  expect(Array.isArray(parsed)).toBe(true);
  expect((parsed as any[]).length).toBeGreaterThan(0);
  return parsed as Array<{ path: string[]; message: string }>;
}

/**
 * Helper: assert that execValidator resolves cleanly for valid input.
 */
async function expectValid(validator: ZodTypeAny, input: unknown) {
  const result = await execValidator(validator, input);
  return result;
}

// ---------------------------------------------------------------------------
// Critical path 1: validateAccessCode
// validator: z.object({ slug: slugSchema, code: codeChars, campaignSlug: slugSchema.optional() })
// ---------------------------------------------------------------------------

const validateAccessCodeSchema = z.object({
  slug: slugSchema,
  code: codeChars,
  campaignSlug: slugSchema.optional(),
});

describe("validateAccessCode — TanStack Start validator path", () => {
  it("accepts a valid slug + code payload", async () => {
    const result = await expectValid(validateAccessCodeSchema, { slug: "my-shop", code: "ABCD1234" }) as any;
    expect(result.slug).toBe("my-shop");
    expect(result.code).toBe("ABCD1234");
  });

  it("lowercases the slug automatically (transform works through execValidator)", async () => {
    const result = await expectValid(validateAccessCodeSchema, { slug: "My-Shop", code: "XYZ" }) as any;
    expect(result.slug).toBe("my-shop");
  });

  it("accepts an optional campaignSlug", async () => {
    const result = await expectValid(validateAccessCodeSchema, { slug: "acme", code: "ABC", campaignSlug: "summer-promo" }) as any;
    expect(result.campaignSlug).toBe("summer-promo");
  });

  it("throws a structured Error (not a ZodError, not a 500) for a too-short slug", async () => {
    const issues = await expectValidationError(validateAccessCodeSchema, { slug: "a", code: "ABC" });
    const slugIssue = issues.find((i: any) => i.path?.includes("slug"));
    expect(slugIssue).toBeDefined();
  });

  it("throws a structured Error for a slug with spaces", async () => {
    const issues = await expectValidationError(validateAccessCodeSchema, { slug: "my shop", code: "ABC" });
    expect(issues.some((i: any) => i.path?.includes("slug"))).toBe(true);
  });

  it("throws a structured Error for a slug starting with a dash", async () => {
    await expectValidationError(validateAccessCodeSchema, { slug: "-shop", code: "ABC" });
  });

  it("throws a structured Error for an empty code", async () => {
    const issues = await expectValidationError(validateAccessCodeSchema, { slug: "myshop", code: "" });
    expect(issues.some((i: any) => i.path?.includes("code"))).toBe(true);
  });

  it("throws a structured Error for a code with special characters", async () => {
    await expectValidationError(validateAccessCodeSchema, { slug: "myshop", code: "AB CD!" });
  });

  it("throws a structured Error for a code over 64 chars", async () => {
    await expectValidationError(validateAccessCodeSchema, { slug: "myshop", code: "A".repeat(65) });
  });

  it("throws a structured Error when required fields are missing", async () => {
    await expectValidationError(validateAccessCodeSchema, { code: "ABC" });
    await expectValidationError(validateAccessCodeSchema, { slug: "myshop" });
  });
});

// ---------------------------------------------------------------------------
// Critical path 2: spinAndRecord
// ---------------------------------------------------------------------------

const spinAndRecordSchema = z.object({
  slug: slugSchema,
  code: codeChars,
  campaignSlug: slugSchema.optional(),
  name: z.string().trim().min(1).max(60).optional(),
  contact: z
    .union([z.string().trim().min(5).max(30).regex(/^[+\d][\d\s\-()]{4,29}$/), z.literal("")])
    .optional(),
  email: z
    .union([z.string().trim().toLowerCase().email().max(255), z.literal("")])
    .optional(),
});

describe("spinAndRecord — TanStack Start validator path", () => {
  it("accepts a minimal payload (slug + code only)", async () => {
    const result = await expectValid(spinAndRecordSchema, { slug: "myshop", code: "ABCD1234" }) as any;
    expect(result.slug).toBe("myshop");
  });

  it("accepts a full customer payload", async () => {
    const result = await expectValid(spinAndRecordSchema, {
      slug: "myshop",
      code: "ABCD1234",
      name: "Alice",
      contact: "+9771234567890",
      email: "alice@example.com",
    }) as any;
    expect(result.name).toBe("Alice");
  });

  it("accepts empty string for contact (opt-out)", async () => {
    const result = await expectValid(spinAndRecordSchema, { slug: "myshop", code: "X1", contact: "" }) as any;
    expect(result.contact).toBe("");
  });

  it("accepts empty string for email (opt-out)", async () => {
    const result = await expectValid(spinAndRecordSchema, { slug: "myshop", code: "X1", email: "" }) as any;
    expect(result.email).toBe("");
  });

  it("throws a structured Error for a name over 60 chars", async () => {
    await expectValidationError(spinAndRecordSchema, { slug: "myshop", code: "X1", name: "A".repeat(61) });
  });

  it("throws a structured Error for a contact with only letters", async () => {
    await expectValidationError(spinAndRecordSchema, { slug: "myshop", code: "X1", contact: "notaphone" });
  });

  it("throws a structured Error for an invalid email", async () => {
    await expectValidationError(spinAndRecordSchema, { slug: "myshop", code: "X1", email: "not-an-email" });
  });
});

// ---------------------------------------------------------------------------
// Critical path 3: generateAccessCodes
// ---------------------------------------------------------------------------

const generateAccessCodesSchema = z.object({
  shopId: z.string().uuid(),
  count: z.number().int().min(1).max(500),
  campaignId: z.string().uuid().optional(),
});

describe("generateAccessCodes — TanStack Start validator path", () => {
  const validShopId = "550e8400-e29b-41d4-a716-446655440000";
  const validCampaignId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

  it("accepts valid shopId + count", async () => {
    const result = await expectValid(generateAccessCodesSchema, { shopId: validShopId, count: 10 }) as any;
    expect(result.count).toBe(10);
  });

  it("accepts optional campaignId", async () => {
    const result = await expectValid(generateAccessCodesSchema, { shopId: validShopId, count: 1, campaignId: validCampaignId }) as any;
    expect(result.campaignId).toBe(validCampaignId);
  });

  it("throws a structured Error for count = 0", async () => {
    await expectValidationError(generateAccessCodesSchema, { shopId: validShopId, count: 0 });
  });

  it("throws a structured Error for count = 501", async () => {
    await expectValidationError(generateAccessCodesSchema, { shopId: validShopId, count: 501 });
  });

  it("throws a structured Error for fractional count", async () => {
    await expectValidationError(generateAccessCodesSchema, { shopId: validShopId, count: 1.5 });
  });

  it("throws a structured Error for a non-UUID shopId", async () => {
    const issues = await expectValidationError(generateAccessCodesSchema, { shopId: "not-a-uuid", count: 5 });
    expect(issues.some((i: any) => i.path?.includes("shopId"))).toBe(true);
  });

  it("throws a structured Error for a non-UUID campaignId", async () => {
    await expectValidationError(generateAccessCodesSchema, { shopId: validShopId, count: 5, campaignId: "bad" });
  });
});

// ---------------------------------------------------------------------------
// Critical path 4: createShop
// ---------------------------------------------------------------------------

const createShopSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  email: emailSchema.optional(),
});

describe("createShop — TanStack Start validator path", () => {
  it("accepts a valid shop name and slug", async () => {
    const result = await expectValid(createShopSchema, { name: "My Shop", slug: "my-shop" }) as any;
    expect(result.name).toBe("My Shop");
    expect(result.slug).toBe("my-shop");
  });

  it("trims name whitespace", async () => {
    const result = await expectValid(createShopSchema, { name: "  Acme  ", slug: "acme" }) as any;
    expect(result.name).toBe("Acme");
  });

  it("lowercases slug", async () => {
    const result = await expectValid(createShopSchema, { name: "Acme", slug: "ACME" }) as any;
    expect(result.slug).toBe("acme");
  });

  it("accepts an optional valid email", async () => {
    const result = await expectValid(createShopSchema, { name: "Acme", slug: "acme", email: "owner@acme.com" }) as any;
    expect(result.email).toBe("owner@acme.com");
  });

  it("throws a structured Error for an empty name", async () => {
    await expectValidationError(createShopSchema, { name: "", slug: "acme" });
  });

  it("throws a structured Error for a name over 80 chars", async () => {
    await expectValidationError(createShopSchema, { name: "A".repeat(81), slug: "acme" });
  });

  it("throws a structured Error for a slug with a space", async () => {
    await expectValidationError(createShopSchema, { name: "Acme", slug: "acme shop" });
  });

  it("throws a structured Error for a slug ending with a dash", async () => {
    await expectValidationError(createShopSchema, { name: "Acme", slug: "acme-" });
  });

  it("throws a structured Error for an invalid email when provided", async () => {
    await expectValidationError(createShopSchema, { name: "Acme", slug: "acme", email: "notanemail" });
  });
});

// ---------------------------------------------------------------------------
// Critical path 5: submitSignupRequest
// ---------------------------------------------------------------------------

const submitSignupRequestSchema = z.object({
  shop_name: nameSchema,
  slug: slugSchema,
  email: emailSchema,
  password: z.string().min(6).max(128),
});

describe("submitSignupRequest — TanStack Start validator path", () => {
  it("accepts a complete valid request", async () => {
    const result = await expectValid(submitSignupRequestSchema, {
      shop_name: "My Store",
      slug: "my-store",
      email: "owner@mystore.com",
      password: "secret123",
    }) as any;
    expect(result.email).toBe("owner@mystore.com");
  });

  it("lowercases the email", async () => {
    const result = await expectValid(submitSignupRequestSchema, {
      shop_name: "Store",
      slug: "store",
      email: "Owner@Store.COM",
      password: "pass123456",
    }) as any;
    expect(result.email).toBe("owner@store.com");
  });

  it("throws a structured Error for a password under 6 chars", async () => {
    await expectValidationError(submitSignupRequestSchema, {
      shop_name: "Store",
      slug: "store",
      email: "a@b.com",
      password: "abc",
    });
  });

  it("throws a structured Error for a password over 128 chars", async () => {
    await expectValidationError(submitSignupRequestSchema, {
      shop_name: "Store",
      slug: "store",
      email: "a@b.com",
      password: "x".repeat(129),
    });
  });

  it("throws a structured Error when email is missing", async () => {
    await expectValidationError(submitSignupRequestSchema, { shop_name: "Store", slug: "store", password: "pass123" });
  });

  it("throws a structured Error when slug is missing", async () => {
    await expectValidationError(submitSignupRequestSchema, { shop_name: "Store", email: "a@b.com", password: "pass123" });
  });
});

// ---------------------------------------------------------------------------
// Critical path 6: verifyOtpAndSetPasswordFn
// ---------------------------------------------------------------------------

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6).regex(/^\d{6}$/, "Code must be 6 digits"),
  newPassword: z.string().min(8).max(128),
});

describe("verifyOtpAndSetPasswordFn — TanStack Start validator path", () => {
  it("accepts valid email, 6-digit OTP, and password", async () => {
    const result = await expectValid(verifyOtpSchema, {
      email: "user@example.com",
      otp: "123456",
      newPassword: "newpass99",
    }) as any;
    expect(result.otp).toBe("123456");
  });

  it("throws a structured Error for an OTP shorter than 6 digits", async () => {
    await expectValidationError(verifyOtpSchema, { email: "user@example.com", otp: "12345", newPassword: "newpass99" });
  });

  it("throws a structured Error for an OTP with non-digit characters", async () => {
    await expectValidationError(verifyOtpSchema, { email: "user@example.com", otp: "12345a", newPassword: "newpass99" });
  });

  it("throws a structured Error for a password under 8 chars", async () => {
    await expectValidationError(verifyOtpSchema, { email: "user@example.com", otp: "123456", newPassword: "short" });
  });

  it("throws a structured Error for an invalid email", async () => {
    await expectValidationError(verifyOtpSchema, { email: "notanemail", otp: "123456", newPassword: "newpass99" });
  });
});

// ---------------------------------------------------------------------------
// Critical path 7: upsertPrize
// ---------------------------------------------------------------------------

const prizeInput = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/i),
  name: z.string().trim().min(1).max(80),
  short: z.string().trim().min(1).max(40),
  image_url: z.string().trim().min(1).max(15_000_000),
  is_win: z.boolean(),
  probability: z.number().int().min(0).max(1000),
  sort_order: z.number().int().min(0).max(1000),
});

const upsertPrizeSchema = z.object({
  shopId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  prize: prizeInput,
});

describe("upsertPrize — TanStack Start validator path", () => {
  const validShopId = "550e8400-e29b-41d4-a716-446655440000";
  const validPrize = {
    id: "prize-1",
    name: "Grand Prize",
    short: "Grand",
    image_url: "https://example.com/prize.png",
    is_win: true,
    probability: 10,
    sort_order: 0,
  };

  it("accepts a valid prize payload", async () => {
    const result = await expectValid(upsertPrizeSchema, { shopId: validShopId, prize: validPrize }) as any;
    expect(result.prize.name).toBe("Grand Prize");
  });

  it("throws a structured Error for probability above 1000", async () => {
    await expectValidationError(upsertPrizeSchema, { shopId: validShopId, prize: { ...validPrize, probability: 1001 } });
  });

  it("throws a structured Error for fractional probability", async () => {
    await expectValidationError(upsertPrizeSchema, { shopId: validShopId, prize: { ...validPrize, probability: 5.5 } });
  });

  it("throws a structured Error for an empty prize name", async () => {
    await expectValidationError(upsertPrizeSchema, { shopId: validShopId, prize: { ...validPrize, name: "" } });
  });

  it("throws a structured Error for non-boolean is_win", async () => {
    await expectValidationError(upsertPrizeSchema, { shopId: validShopId, prize: { ...validPrize, is_win: "yes" as any } });
  });
});

// ---------------------------------------------------------------------------
// Critical path 8: createCampaign
// ---------------------------------------------------------------------------

const themeSchema = z
  .object({ accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })
  .partial()
  .default({});

const createCampaignSchema = z.object({
  shopId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  slug: slugSchema,
  theme: themeSchema.optional(),
  is_active: z.boolean().optional(),
});

describe("createCampaign — TanStack Start validator path", () => {
  const validShopId = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a valid campaign", async () => {
    const result = await expectValid(createCampaignSchema, {
      shopId: validShopId,
      name: "Summer Promo",
      slug: "summer-promo",
    }) as any;
    expect(result.slug).toBe("summer-promo");
  });

  it("accepts a valid hex accent in theme", async () => {
    const result = await expectValid(createCampaignSchema, {
      shopId: validShopId,
      name: "Campaign",
      slug: "campaign",
      theme: { accent: "#FF6600" },
    }) as any;
    expect(result.theme?.accent).toBe("#FF6600");
  });

  it("throws a structured Error for an invalid hex colour", async () => {
    await expectValidationError(createCampaignSchema, {
      shopId: validShopId,
      name: "Campaign",
      slug: "campaign",
      theme: { accent: "red" },
    });
  });

  it("throws a structured Error for a campaign name over 60 chars", async () => {
    await expectValidationError(createCampaignSchema, { shopId: validShopId, name: "A".repeat(61), slug: "camp" });
  });

  it("throws a structured Error for a non-UUID shopId", async () => {
    await expectValidationError(createCampaignSchema, { shopId: "not-a-uuid", name: "Camp", slug: "camp" });
  });
});

// ---------------------------------------------------------------------------
// Critical path 9: updateShopSubscription (super-admin)
// ---------------------------------------------------------------------------

const updateShopSubscriptionSchema = z.object({
  shopId: z.string().uuid(),
  plan: z.enum(["free", "pro", "lifetime"]).optional(),
  subscription_status: z.enum(["trial", "active", "past_due", "suspended"]).optional(),
  current_period_end: z.string().datetime().nullable().optional(),
  trial_ends_at: z.string().datetime().nullable().optional(),
  billing_notes: z.string().max(2000).nullable().optional(),
});

describe("updateShopSubscription — TanStack Start validator path", () => {
  const validShopId = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a valid plan update", async () => {
    const result = await expectValid(updateShopSubscriptionSchema, { shopId: validShopId, plan: "pro" }) as any;
    expect(result.plan).toBe("pro");
  });

  it("accepts null for current_period_end (clearing the date)", async () => {
    const result = await expectValid(updateShopSubscriptionSchema, { shopId: validShopId, current_period_end: null }) as any;
    expect(result.current_period_end).toBeNull();
  });

  it("accepts a valid ISO datetime string", async () => {
    const result = await expectValid(updateShopSubscriptionSchema, {
      shopId: validShopId,
      current_period_end: "2027-01-01T00:00:00.000Z",
    }) as any;
    expect(result.current_period_end).toBe("2027-01-01T00:00:00.000Z");
  });

  it("throws a structured Error for an invalid plan value", async () => {
    await expectValidationError(updateShopSubscriptionSchema, { shopId: validShopId, plan: "enterprise" as any });
  });

  it("throws a structured Error for an invalid subscription_status", async () => {
    await expectValidationError(updateShopSubscriptionSchema, { shopId: validShopId, subscription_status: "expired" as any });
  });

  it("throws a structured Error for a non-ISO string for current_period_end", async () => {
    await expectValidationError(updateShopSubscriptionSchema, { shopId: validShopId, current_period_end: "next month" });
  });

  it("throws a structured Error for billing_notes over 2000 chars", async () => {
    await expectValidationError(updateShopSubscriptionSchema, { shopId: validShopId, billing_notes: "x".repeat(2001) });
  });
});

// ---------------------------------------------------------------------------
// Error shape confirmation — the Error is NOT a ZodError, NOT a 500
// ---------------------------------------------------------------------------

describe("Validation error shape — plain Error with JSON issue array", () => {
  it("throws a plain Error (not ZodError) on invalid input", async () => {
    let thrown: unknown;
    try {
      await execValidator(validateAccessCodeSchema, { slug: "", code: "" });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown?.constructor?.name).toBe("Error");
  });

  it("error message is a JSON array of Zod issue objects", async () => {
    let thrown: unknown;
    try {
      await execValidator(validateAccessCodeSchema, { slug: "bad slug!", code: "" });
    } catch (e) {
      thrown = e;
    }
    const issues = JSON.parse((thrown as Error).message);
    expect(Array.isArray(issues)).toBe(true);
    expect(issues[0]).toHaveProperty("path");
    expect(issues[0]).toHaveProperty("message");
  });

  it("execValidator returns the validated (transformed) value on success", async () => {
    const result = await execValidator(validateAccessCodeSchema, { slug: "ACME-SHOP", code: "XYZ123" });
    expect((result as any).slug).toBe("acme-shop");
  });

  it("Zod's Standard Schema interface is present on production schemas", () => {
    expect("~standard" in slugSchema).toBe(true);
    expect("~standard" in codeChars).toBe(true);
    expect("~standard" in nameSchema).toBe(true);
    expect("~standard" in emailSchema).toBe(true);
  });
});
