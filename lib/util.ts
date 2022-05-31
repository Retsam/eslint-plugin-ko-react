import { TSESLint } from "@typescript-eslint/utils";

export function getParserServices(context: TSESLint.RuleContext<any, any>) {
    const { parserServices } = context;
    if (
        !parserServices ||
        !parserServices.program ||
        !parserServices.esTreeNodeToTSNodeMap
    ) {
        /**
         * The user needs to have configured "project" in their parserOptions
         * for @typescript-eslint/parser
         */
        throw new Error(
            'You have used a rule which requires parserServices to be generated. You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser.',
        );
    }
    return {
        program: parserServices.program,
        esTreeNodeToTSNodeMap: parserServices.esTreeNodeToTSNodeMap,
    };
}
