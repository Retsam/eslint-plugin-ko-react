import { TSESTree, TSESLint } from "@typescript-eslint/experimental-utils";
import * as ts from "typescript";
import { unionTypeParts } from "tsutils";
import { getParserServices } from "../util";

type Options = [
    { additionalHooks?: string[]; mode?: "normal" | "paranoia" } | undefined
];

const module: TSESLint.RuleModule<"rawObservable", Options> = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Ensure that knockout observables and computeds are properly unwrapped inside react components",
            category: "Best Practices",
            recommended: "error",
            url: "TODO",
        },
        schema: [
            {
                type: "object",
                properties: {
                    additionalHooks: {
                        type: "array",
                        description:
                            "Any additional hooks that can safely unwrap observables",
                        items: {
                            type: "string",
                        },
                    },
                    mode: {
                        enum: ["normal", "paranoia"],
                        description:
                            "Specifies the mechanism by which potential observables are identified,\n" +
                            '"normal" uses types to identify observables\n' +
                            '"paranoia" assumes anything that might be an observable is one',
                    },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            rawObservable:
                "Observables in react components should use useObservable, useComputed, or .peek()",
        },
    },
    create(context) {
        const opts = context.options[0] || {};
        const additionalHooks = opts.additionalHooks || [];
        const paranoiaMode = opts.mode === "paranoia";

        function isKnockoutObservableRead(node: TSESTree.CallExpression) {
            if (node.arguments.length) {
                return false;
            }
            if (node.parent!.type === "ExpressionStatement") {
                return false;
            }

            // If paranoid, assume that anything that might be an observable is.
            if (paranoiaMode) {
                // Assume that properties called peek, toString, or dispose aren't observables
                if (
                    node.callee.type === "MemberExpression" &&
                    node.callee.property.type === "Identifier" &&
                    (node.callee.property.name === "peek" ||
                        node.callee.property.name === "toString" ||
                        node.callee.property.name === "dispose")
                ) {
                    return false;
                }

                // TODO: check if it's a locally defined function?

                return true;
            }

            const service = getParserServices(context);
            const checker = service.program.getTypeChecker();

            // Otherwise check if the thing being called as a function has a subscribe function
            //  according to the types
            const tsNode = service.esTreeNodeToTSNodeMap.get<ts.CallExpression>(
                node,
            );
            const calleeNode = tsNode.expression;
            const calleeType = checker.getTypeAtLocation(calleeNode);
            for (const ty of unionTypeParts(calleeType)) {
                const subscribe = ty.getProperty("subscribe");
                if (subscribe) {
                    return true;
                }
            }

            return false;
        }

        // List of functions that can safely wrap observables
        const safeWrappers = ["observe", "useComputed"].concat(additionalHooks);
        function isUseComputedFunctionName(funcName: string) {
            return safeWrappers.indexOf(funcName) >= 0;
        }

        function isInsideUseComputed(node: TSESTree.Node) {
            while (node.parent) {
                node = node.parent;
                if (
                    node.type === "CallExpression" &&
                    node.callee.type === "Identifier" &&
                    isUseComputedFunctionName(node.callee.name)
                ) {
                    return true;
                }
            }
            return false;
        }
        function validateFunctionCall(node: TSESTree.CallExpression) {
            if (isKnockoutObservableRead(node) && !isInsideUseComputed(node)) {
                context.report({ messageId: "rawObservable", node: node });
            }
        }

        function validateFunctionCallsInsideCodePath(path: CodePathData) {
            path.functionCalls.forEach(validateFunctionCall);
            path.functionCalls = []; // Clear these, so a parent doesn't attempt to revalidate them
            path.childCodePaths.forEach(validateFunctionCallsInsideCodePath);
        }

        interface CodePathData {
            /** Does the function return JSX?  (To identify React components) */
            isJSXFunction: boolean;
            /**
             * Function calls that may be unsafe observable reads; tracked so they can be validated
             * if the function is determined to return JSX.
             */
            functionCalls: TSESTree.CallExpression[];
            /**
             * Tracks functions defined in the current function, their functionCalls will also be validated
             * if this function returns JSX.
             */
            childCodePaths: CodePathData[];
            /**
             * State that tracks whether we're inside an expression that's being returned from the
             * current function.  Used to identify JSX functions.
             */
            isReturning: boolean;
        }
        // Reverse stack (shift/unshift), newest element at front
        const pathsStack = [] as CodePathData[];

        return {
            // When we first enter a function, begin tracking CallExpressions and whether or not the
            //  function returns JSX
            onCodePathStart: () => {
                const newPathData: CodePathData = {
                    isReturning: false,
                    isJSXFunction: false,
                    childCodePaths: [],
                    functionCalls: [],
                };
                const parentPathData = pathsStack[0];
                if (parentPathData) {
                    parentPathData.childCodePaths.push(newPathData);
                }
                pathsStack.unshift(newPathData);
            },

            // Track the CallExpression in the current function
            CallExpression: node => {
                pathsStack[0].functionCalls.push(node);
            },

            // Track when we're inside a return expression
            ReturnStatement: () => {
                pathsStack[0].isReturning = true;
            },
            "ReturnStatement:exit": () => {
                pathsStack[0].isReturning = false;
            },
            // special case for () => /* expression */ variant, treat like a return statement
            ArrowFunctionExpression: node => {
                if (node.body.type !== "BlockStatement") {
                    pathsStack[0].isReturning = true;
                }
            },
            "ArrowFunctionExpression:exit": () => {
                pathsStack[0].isReturning = false;
            },

            JSXElement: () => {
                if (pathsStack[0].isReturning) {
                    pathsStack[0].isJSXFunction = true;
                }
            },
            JSXFragment: () => {
                if (pathsStack[0].isReturning) {
                    pathsStack[0].isJSXFunction = true;
                }
            },

            // If the function returned JSX, validate all the tracked CallExpressions in current function
            // and all children
            onCodePathEnd: (((_path: any, codePathNode: TSESTree.Node) => {
                const currentPathData = pathsStack.shift()!;
                if (
                    /* is class method */
                    codePathNode.parent &&
                    (codePathNode.parent.type === "MethodDefinition" ||
                        codePathNode.parent.type === "ClassProperty") &&
                    codePathNode.parent.value === codePathNode
                ) {
                    // Ignore class methods
                    return;
                }
                if (currentPathData.isJSXFunction) {
                    validateFunctionCallsInsideCodePath(currentPathData);
                }
            }) as any) as never, // Create rule types aren't aware of these methods
        };
    },
};
export default module;
