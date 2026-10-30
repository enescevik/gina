/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "../../packages/core/src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Web'de "media" modu colorScheme.set çağrısında hata veriyor (react-native-css-interop); class modu güvenli.
  darkMode: "class",
  theme: {
    extend: {
      // Gina paleti (tasarım brief'i ile aynı)
      colors: {
        teal: { DEFAULT: "#0FA3A3", dark: "#0B7F7F", light: "#D9F4F2" },
        star: "#F5B301",
        coral: { DEFAULT: "#FF6B6B", light: "#FFE9E9" },
        blue: { DEFAULT: "#4D7CFE", light: "#E3EAFF" },
        green: { DEFAULT: "#2FB47C", light: "#E6F7EF" },
        purple: { DEFAULT: "#8B5CF6", light: "#EFE9FE" },
        orange: { DEFAULT: "#FF9F43", light: "#FFF1E3" },
        sky: { DEFAULT: "#38BDF8", light: "#E4F5FE" },
        cream: "#FFF8EF",
        ink: "#1F2937",
        mist: "#E5E7EB",
        night: { DEFAULT: "#0F172A", surface: "#1E293B", text: "#F1F5F9" },
        danger: "#E5484D",
      },
      borderRadius: {
        child: "24px",
        parent: "12px",
        button: "14px",
      },
      fontFamily: {
        display: ["Baloo2_700Bold"],
        "display-semi": ["Baloo2_600SemiBold"],
        body: ["Nunito_600SemiBold"],
        "body-bold": ["Nunito_700Bold"],
      },
    },
  },
  plugins: [],
};
