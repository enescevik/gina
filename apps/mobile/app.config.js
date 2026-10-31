const { existsSync } = require("node:fs");
const { resolve } = require("node:path");


/** iOS builds do not need Firebase. Android FCM uses a real local/EAS file when configured. */
/** @param {import("expo/config").ConfigContext} context */
module.exports = function appConfig({ config }) {
  const googleServices = process.env.GOOGLE_SERVICES_JSON || "./google-services.json";
  if (process.env.GOOGLE_SERVICES_JSON && !existsSync(resolve(__dirname, googleServices))) {
    throw new Error("GOOGLE_SERVICES_JSON points to a missing file.");
  }
  return {
    ...config,
    name: config.name ?? "Gina Aile",
    slug: config.slug ?? "gina-aile",
    android: {
      ...config.android,
      ...(existsSync(resolve(__dirname, googleServices)) ? { googleServicesFile: googleServices } : {}),
    },
  };
};
