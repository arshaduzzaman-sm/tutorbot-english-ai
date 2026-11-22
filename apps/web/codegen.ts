import type { CodegenConfig } from "@graphql-codegen/cli";

// The schema file is exported from the FastAPI app: `make codegen`.
const config: CodegenConfig = {
  schema: "src/graphql/schema.graphql",
  documents: ["src/**/*.{ts,tsx}", "!src/graphql/generated/**"],
  ignoreNoDocuments: true,
  generates: {
    "src/graphql/generated/": {
      preset: "client",
      config: { useTypeImports: true, enumsAsTypes: true, scalars: { Date: "string", DateTime: "string" } },
    },
  },
};

export default config;
