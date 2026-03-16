import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        rules: {
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/immutability": "off",
            "react-hooks/purity": "off",
            "react-hooks/incompatible-library": "off",
        },
    },
]);