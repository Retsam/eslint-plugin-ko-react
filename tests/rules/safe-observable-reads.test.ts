import path from "path";
import rule from "../../lib/rules/safe-observable-reads";
import { TSESLint } from "@typescript-eslint/utils";

const RuleTester = TSESLint.RuleTester;

const rootPath = path.join(process.cwd(), "tests/fixtures/");

const ruleTester = new RuleTester({
    parser: require.resolve("@typescript-eslint/parser"),
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
}`),
        validTSX(`
const observable = ${fakeObservable};
it("doesn't flag observable reads outside of components, e.g. tests", () => {
  const el = render(<MyComponent value={observable()} />);
})`),
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
        },
        {
            //JSX fragment
            code: `
const observable = ${fakeObservable};
function Component() {
  const value = observable();
  return <></>
}`,
            errors: [ruleError(4, 17)],
        },
        {
            // arrow function with expression body
            code: `
const observable = ${fakeObservable};
const Component = () => (
  <div>{observable()}</div>
);`,
            errors: [ruleError(4, 9)],
        },
        {
            // arrow function with JSX fragment expression body
            code: `
const observable = ${fakeObservable};
  const Component = () => (
  <>{observable()}</>
);`,
            errors: [ruleError(4, 6)],
        },
        {
            // ternary with JSX
            code: `
const observable = ${fakeObservable};
const Component = () => {
  return true ? (<div>{observable()}</div>) : (<></>);
}
`,
            errors: [ruleError(4, 24)],
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
        },
        // TODO: Maybe fix, someday.  Until then it's not too big of a hole.
        //         {
        //             // JSX only in nested function
        //             code: `
        // const observable = ${fakeObservable};
        // function Component() {
        //   function returnsJSX() {
        //     return <div>Test</div>;
        //   }
        //   if(observable()) {
        //     return returnsJSX();
        //   }
        // }`,
        //             errors: [ruleError(7, 6)],
        //         },
        {
            // Object property
            code: `
const obj = {prop: ${fakeObservable}};
function Component() {
  const value = obj.prop();
  return <div>Test</div>;
}`,
            errors: [ruleError(4, 17)],
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
        },
    ],
});
