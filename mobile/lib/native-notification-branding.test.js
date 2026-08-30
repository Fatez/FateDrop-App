const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const appConfig = JSON.parse(fs.readFileSync(path.join(mobileRoot, "app.json"), "utf8"));
const pluginSource = fs.readFileSync(path.join(mobileRoot, "plugins", "with-fatedrop-notification-icons.cjs"), "utf8");

function expoNotificationsConfig() {
  const entry = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-notifications");
  return entry?.[1] ?? null;
}

test("FateDrop keeps the canonical app icon for iOS notification identity", () => {
  assert.equal(appConfig.expo.icon, "./assets/images/fatedrop-app-icon-final.png");
  assert.equal(appConfig.expo.ios.icon, "./assets/images/fatedrop-app-icon-final.png");
});

test("Android notifications have a deterministic FateDrop default icon", () => {
  const config = expoNotificationsConfig();
  assert.ok(config, "expo-notifications config is missing");
  assert.equal(config.icon, "./assets/images/android-icon-monochrome.png");
  assert.equal(config.defaultChannel, "stock-alerts");
  assert.equal(config.color, "#A855F7");
});

test("native build packages one monochrome glyph for every FateDrop alert identity", () => {
  assert.ok(appConfig.expo.plugins.includes("./plugins/with-fatedrop-notification-icons.cjs"));
  for (const drawable of ["fatedrop_oru", "fatedrop_fenn", "fatedrop_koru", "fatedrop_nyxen", "fatedrop_radar"]) {
    assert.match(pluginSource, new RegExp(`${drawable}:`));
    assert.match(pluginSource, new RegExp(`\\$\\{name\\}\\.xml`));
  }
  assert.match(pluginSource, /android:fillColor="#FFFFFFFF"/);
  assert.doesNotMatch(pluginSource, /fatedrop_product_identities|fatedrop_signals|fetch\(/);
});
