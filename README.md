# eslint-plugin-ko-react

Eslint plugin for ko-react package

## Installation

You'll first need to install [ESLint](http://eslint.org):

```
$ npm i eslint --save-dev
```

Next, install `eslint-plugin-ko-react`:

```
$ npm install eslint-plugin-ko-react --save-dev
```

**Note:** If you installed ESLint globally (using the `-g` flag) then you must also install `eslint-plugin-ko-react` globally.

## Usage

Add `ko-react` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
    "plugins": ["ko-react"]
}
```

Then configure the rules you want to use under the rules section.

```json
{
    "rules": {
        "ko-react/rule-name": 2
    }
}
```

## Supported Rules

-   Fill in provided rules here
