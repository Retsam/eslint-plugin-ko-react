import { TSESTree, TSESLint } from "@typescript-eslint/experimental-utils";
import * as ts from "typescript";
import { unionTypeParts } from "tsutils";
import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
import { getParserServices } from "../util";

function returnsJSX(node: TSESTree.ReturnStatement) {
    if (!node.argument) {
        return false;
    }
    const returnType = node.argument.type;
    return returnType === AST_NODE_TYPES.JSXElement;
}

type Options = [{ additionalHooks?: string[] } | undefined];

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
        const service = getParserServices(context);
        const checker = service.program.getTypeChecker();

        const opts = context.options[0] || {};
        const additionalHooks = opts.additionalHooks || [];

        /** Anything with a subscribe function (according to the types) */
        function isKnockoutObservableRead(node: TSESTree.CallExpression) {
            if (node.arguments.length) {
                return false;
            }
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
            if (
                isKnockoutObservableRead(node) &&
                true &&
                // isInsideReactComponent(node) &&
                !isInsideUseComputed(node)
            ) {
                context.report({ messageId: "rawObservable", node: node });
            }
        }

        function validateFunctionCallsInsideCodePath(path: CodePathData) {
            path.functionCalls.forEach(validateFunctionCall);
            path.functionCalls = []; // Clear these, so a parent doesn't attempt to revalidate them
            path.childCodePaths.forEach(validateFunctionCallsInsideCodePath);
        }

        interface CodePathData {
            isJSXFunction: boolean;
            childCodePaths: CodePathData[];
            functionCalls: TSESTree.CallExpression[];
        }
        // Reverse stack (shift/unshift), newest element at front
        const pathsStack = [] as CodePathData[];

        return {
            // When we first enter a function, begin tracking CallExpressions and whether or not the
            //  function returns JSX
            onCodePathStart: () => {
                const newPathData: CodePathData = {
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

            // If JSX is returned, mark current function as a JSX function
            ReturnStatement: node => {
                if (returnsJSX(node)) {
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
