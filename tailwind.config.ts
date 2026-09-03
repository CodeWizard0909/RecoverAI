import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-lowest": "#ffffff",
        "secondary-container": "#645efb",
        "on-secondary-container": "#fffbff",
        "on-secondary": "#ffffff",
        "on-secondary-fixed": "#0f0069",
        "inverse-surface": "#2f3130",
        "outline": "#77767b",
        "surface-container": "#efeeec",
        "surface-container-low": "#f4f3f1",
        "on-primary-fixed": "#1b1b1e",
        "on-secondary-fixed-variant": "#3323cc",
        "on-tertiary-container": "#069669",
        "surface": "#faf9f7",
        "secondary-fixed": "#e2dfff",
        "error-container": "#ffdad6",
        "outline-variant": "#c8c5cb",
        "surface-container-high": "#e9e8e6",
        "primary-container": "#1b1b1e",
        "inverse-on-surface": "#f1f1ef",
        "on-error": "#ffffff",
        "on-background": "#1a1c1b",
        "tertiary-fixed-dim": "#68dba9",
        "on-primary": "#ffffff",
        "inverse-primary": "#c8c5ca",
        "surface-variant": "#e3e2e0",
        "on-error-container": "#93000a",
        "surface-tint": "#5f5e61",
        "secondary-fixed-dim": "#c3c0ff",
        "background": "#faf9f7",
        "primary": "#000000",
        "primary-fixed": "#e4e1e6",
        "on-primary-container": "#858387",
        "tertiary-container": "#002114",
        "on-tertiary": "#ffffff",
        "primary-fixed-dim": "#c8c5ca",
        "on-tertiary-fixed": "#002114",
        "secondary": "#4b41e1",
        "tertiary": "#000000",
        "on-surface-variant": "#47464b",
        "surface-container-highest": "#e3e2e0",
        "on-primary-fixed-variant": "#47464a",
        "error": "#ba1a1a",
        "on-surface": "#1a1c1b",
        "surface-bright": "#faf9f7",
        "tertiary-fixed": "#85f8c4",
        "on-tertiary-fixed-variant": "#005137",
        "surface-dim": "#dadad8"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      spacing: {
        "space-md": "1rem",
        "space-xs": "0.5rem",
        "space-sm": "0.75rem"
      },
      fontFamily: {
        "headline-sm": ["Epilogue"],
        "headline-lg-mobile": ["Epilogue"],
        "body-sm": ["Hanken Grotesk"],
        "body-strong": ["Hanken Grotesk"],
        "body-default": ["Hanken Grotesk"],
        "label-code": ["JetBrains Mono"],
        "label-caps": ["Hanken Grotesk"],
        "data-tabular-lg": ["JetBrains Mono"],
        "data-tabular-md": ["JetBrains Mono"]
      },
      fontSize: {
        "headline-sm": ["20px", { "lineHeight": "28px", "fontWeight": "500" }],
        "headline-lg-mobile": ["28px", { "lineHeight": "36px", "fontWeight": "600" }],
        "body-sm": ["13px", { "lineHeight": "18px", "fontWeight": "400" }],
        "body-strong": ["15px", { "lineHeight": "22px", "fontWeight": "600" }],
        "body-default": ["15px", { "lineHeight": "22px", "fontWeight": "400" }],
        "label-code": ["11px", { "lineHeight": "14px", "fontWeight": "500" }],
        "label-caps": ["11px", { "lineHeight": "14px", "fontWeight": "700" }],
        "data-tabular-lg": ["32px", { "lineHeight": "38px", "fontWeight": "500" }],
        "data-tabular-md": ["18px", { "lineHeight": "24px", "fontWeight": "500" }]
      }
    },
  },
  plugins: [],
};
export default config;
