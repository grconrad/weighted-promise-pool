const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const promise = require("eslint-plugin-promise");
const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    plugins: {
        "@typescript-eslint": typescriptEslint,
        promise,
    },

    extends: compat.extends(
        "plugin:@typescript-eslint/recommended",
        "plugin:promise/recommended",
        "prettier",
    ),

    languageOptions: {
        parserOptions: {
            project: "tsconfig.json",
        },

        globals: {
            ...globals.node,
        },
    },

    rules: {
        "no-prototype-builtins": "off",
        "import/prefer-default-export": "off",

        "no-use-before-define": ["error", {
            functions: false,
            classes: true,
            variables: true,
        }],

        "@typescript-eslint/explicit-function-return-type": ["error", {
            allowExpressions: true,
            allowTypedFunctionExpressions: true,
        }],

        "@typescript-eslint/no-use-before-define": ["error", {
            functions: false,
            classes: true,
            variables: true,
            typedefs: true,
        }],
    },
}, globalIgnores(["**/dist/", "**/coverage/", "**/.eslintrc.js"])]);
