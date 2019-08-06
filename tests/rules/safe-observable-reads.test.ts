import path from "path";
import rule from "../../lib/rules/safe-observable-reads";
import { TSESLint } from "@typescript-eslint/experimental-utils";

const RuleTester = TSESLint.RuleTester;

const rootPath = path.join(process.cwd(), "tests/fixtures/");

const ruleTester = new RuleTester({
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        tsconfigRootDir: rootPath,
        project: "./tsconfig.json",
    },
});

const ruleError = (line: number, column: number) => ({
    messageId: "rawObservable" as const,
    line,
    column,
});

const validTSX = (test: string) => ({
    // https://github.com/typescript-eslint/typescript-eslint/issues/160
    filename: "test.tsx",
    code: test,
});

const fakeObservable = `{ subscribe: () => 'newVal' }`;

ruleTester.run("unwrap-knockout", rule, {
    valid: [
        validTSX(`
const observable = ${fakeObservable};
function Component() {
  const value = useComputed(() => observable(), [observable])
  return <div>Test</div>;
}`),
        validTSX(`
const notObservable = function() { return 5; };
function Component() {
  const value = notObservable();
  return <div>Test</div>;
}
`),
        validTSX(`
const observable = ${fakeObservable};
class MyComponent {
  render() {
    const value = observable();
    return <div>Test</div>;
  }
}
    `),
        `
const observable = ${fakeObservable};
function notAComponent() {
  const value = observable();
  return 5;
}`,
        {
            code: `
const observable = ${fakeObservable};
const MyComponent = () => {
  const customHookValue = useMyCustomHook(foo, {
    test: () => observable(),
  });
  return <div>Test</div>;
}`,
            options: [{ additionalHooks: ["useMyCustomHook"] }],
            filename: "test.tsx",
        },
    ],
    invalid: [
        {
            //(un)happy path
            code: `
const observable = ${fakeObservable};
function Component() {
  const value = observable();
  return <div></div>
}`,
            errors: [ruleError(4, 17)],
            filename: "test.tsx",
        },
        {
            // Nested callback
            code: `
const observable = ${fakeObservable};
function Component() {
  function callback() {
    const value = observable();
  }
  return <div>Test</div>;
}`,
            errors: [ruleError(5, 19)],
            filename: "test.tsx",
        },
        {
            // Object property
            code: `
const obj = {prop: ${fakeObservable}};
function Component() {
  const value = obj.prop();
  return <div>Test</div>;
}`,
            errors: [ruleError(4, 17)],
            filename: "test.tsx",
        },
        {
            // Unconfigured custom hook
            code: `
const observable = ${fakeObservable};
const MyComponent = () => {
  const customHookValue = useMyCustomHook(foo, {
    test: () => observable(),
  });
  return <div>Test</div>;
}`,
            errors: [ruleError(5, 17)],
            filename: "test.tsx",
        },
    ],
});
