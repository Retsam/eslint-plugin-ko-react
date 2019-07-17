import typescriptPlugin from 'rollup-plugin-typescript2';
import typescript from "typescript";

export default {
    input: 'src/index.ts',
    output: {
      file: 'dist/runner.js',
      format: 'cjs'
    },
    plugins: [ typescriptPlugin({
        typescript: typescript
    }) ],
};
