import typescriptPlugin from 'rollup-plugin-typescript2';
import typescript from "typescript";

export default {
    input: 'lib/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs'
    },
    plugins: [ typescriptPlugin({
      typescript: typescript
    }) ],
    external: ["tsutils", "@typescript-eslint/typescript-estree"],
};
