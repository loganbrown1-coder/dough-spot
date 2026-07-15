// Seeds a freshly created Supabase project with demo data across TWO
// separate organisations, so you can see multi-tenant isolation working:
// Fireaway (the original customer, one brand, three sites) and Wildfire
// Grill (a second organisation with its own brand/site/admin) which a
// Fireaway user should never be able to see any data from.
//
// Run once, after applying supabase/schema.sql in the Supabase SQL editor
// AND enabling email/password sign-in in Authentication > Providers:
//   npm run seed

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Copy .env.local.example to .env.local, fill in your Supabase project's values, and try again."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const BUCKET = "captures";
const PASSWORD = "Password123!";

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const PLACEHOLDER_COLORS = ["#dc7a3c", "#c9482f", "#e2a23a", "#8b3a2b", "#b5651d"];

async function uploadPlaceholderImage(objectPath, label, colorSeed) {
  const color = PLACEHOLDER_COLORS[colorSeed % PLACEHOLDER_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
  <rect width="640" height="480" fill="${color}"/>
  <circle cx="320" cy="220" r="150" fill="#f2c14e" opacity="0.85"/>
  <circle cx="260" cy="180" r="14" fill="#7a2e12"/>
  <circle cx="380" cy="200" r="12" fill="#7a2e12"/>
  <circle cx="330" cy="270" r="16" fill="#7a2e12"/>
  <circle cx="230" cy="260" r="10" fill="#7a2e12"/>
  <text x="320" y="430" font-family="Arial, sans-serif" font-size="26" fill="white" text-anchor="middle">${label}</text>
  <text x="320" y="460" font-family="Arial, sans-serif" font-size="14" fill="white" text-anchor="middle" opacity="0.8">sample photo</text>
</svg>`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, new Blob([svg], { type: "image/svg+xml" }), {
      contentType: "image/svg+xml",
      upsert: true,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function seedCapturesForDayPart(site, date, dayPartId, seedOffset) {
  const rows = [];
  for (let sequence = 1; sequence <= 3; sequence++) {
    const label = `${site.name} - ${dayPartId}${sequence} - ${date}`;
    const objectPath = `seed/${site.id}/${date}/${dayPartId}/${sequence}.svg`;
    const imageUrl = await uploadPlaceholderImage(objectPath, label, seedOffset + sequence);
    rows.push({
      site_id: site.id,
      date,
      day_part_id: dayPartId,
      sequence,
      image_url: imageUrl,
      captured_at: new Date().toISOString(),
      source: "manual",
    });
  }
  const { error } = await supabase.from("captures").insert(rows);
  if (error) throw error;
}

async function createUser(email, role, scope) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    role,
    organisation_id: scope.organisationId ?? null,
    brand_id: scope.brandId ?? null,
    site_id: scope.siteId ?? null,
  });
  if (profileError) throw profileError;
}

async function main() {
  const { count, error: countError } = await supabase
    .from("organisations")
    .select("*", { count: "exact", head: true });
  if (countError) throw countError;
  if (count && count > 0) {
    console.log("Database already has data - skipping seed.");
    return;
  }

  console.log("Seeding day parts...");
  const { error: dayPartError } = await supabase.from("day_parts").insert([
    { id: "A", label: "Day Part A", start_time: "11:00", end_time: "16:00" },
    { id: "B", label: "Day Part B", start_time: "16:00", end_time: "21:00" },
    { id: "C", label: "Day Part C", start_time: "21:00", end_time: "23:00" },
  ]);
  if (dayPartError) throw dayPartError;

  // --- Organisation 1: Fireaway -------------------------------------
  console.log("Seeding Fireaway organisation...");
  const { data: fireawayOrg, error: fireawayOrgError } = await supabase
    .from("organisations")
    .insert({ name: "Fireaway" })
    .select("*")
    .single();
  if (fireawayOrgError) throw fireawayOrgError;

  const { data: fireawayBrand, error: fireawayBrandError } = await supabase
    .from("brands")
    .insert({ organisation_id: fireawayOrg.id, name: "Fireaway" })
    .select("*")
    .single();
  if (fireawayBrandError) throw fireawayBrandError;

  const { data: fireawaySites, error: fireawaySitesError } = await supabase
    .from("sites")
    .insert([
      { brand_id: fireawayBrand.id, name: "Fireaway Camden" },
      { brand_id: fireawayBrand.id, name: "Fireaway Shoreditch" },
      { brand_id: fireawayBrand.id, name: "Fireaway Brighton" },
    ])
    .select("*");
  if (fireawaySitesError) throw fireawaySitesError;

  const camden = fireawaySites.find((s) => s.name === "Fireaway Camden");
  const shoreditch = fireawaySites.find((s) => s.name === "Fireaway Shoreditch");

  console.log("Seeding Fireaway test users...");
  await createUser("ops@fireaway.test", "ops", { brandId: fireawayBrand.id });
  await createUser("manager@fireaway.test", "site_manager", { siteId: camden.id });

  console.log("Seeding Fireaway sample captures...");
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(yesterday);

  await seedCapturesForDayPart(camden, todayStr, "A", 0);
  await seedCapturesForDayPart(camden, todayStr, "B", 3);
  await seedCapturesForDayPart(camden, yesterdayStr, "A", 6);
  await seedCapturesForDayPart(camden, yesterdayStr, "B", 9);
  await seedCapturesForDayPart(camden, yesterdayStr, "C", 12);
  await seedCapturesForDayPart(shoreditch, todayStr, "A", 15);

  // --- Organisation 2: Wildfire Grill (proves tenant isolation) -----
  console.log("Seeding Wildfire Grill organisation...");
  const { data: wildfireOrg, error: wildfireOrgError } = await supabase
    .from("organisations")
    .insert({ name: "Wildfire Grill" })
    .select("*")
    .single();
  if (wildfireOrgError) throw wildfireOrgError;

  const { data: wildfireBrand, error: wildfireBrandError } = await supabase
    .from("brands")
    .insert({ organisation_id: wildfireOrg.id, name: "Wildfire Grill" })
    .select("*")
    .single();
  if (wildfireBrandError) throw wildfireBrandError;

  const { data: wildfireSite, error: wildfireSiteError } = await supabase
    .from("sites")
    .insert({ brand_id: wildfireBrand.id, name: "Wildfire Grill Leeds" })
    .select("*")
    .single();
  if (wildfireSiteError) throw wildfireSiteError;

  console.log("Seeding Wildfire Grill test user...");
  await createUser("manager@wildfiregrill.test", "site_manager", {
    siteId: wildfireSite.id,
  });

  console.log("Seeding Wildfire Grill sample captures...");
  await seedCapturesForDayPart(wildfireSite, todayStr, "A", 18);

  // --- OpSpot's own accounts (unrestricted across every organisation) --
  console.log("Seeding OpSpot team accounts...");
  await createUser("super@opspot.test", "super_admin", {});
  await createUser("agent@opspot.test", "agent", {});

  console.log("\nDone. Test accounts (password: Password123!):");
  console.log("  super@opspot.test - OpSpot admin, manages every organisation");
  console.log("  agent@opspot.test - OpSpot agent, uploads/rates for any organisation");
  console.log("  ops@fireaway.test - customer, sees every Fireaway site (view-only, can flag)");
  console.log("  manager@fireaway.test - customer, Fireaway Camden only (view-only, can flag)");
  console.log(
    "  manager@wildfiregrill.test - customer in a separate organisation - log in as this user to confirm you see none of Fireaway's data"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
