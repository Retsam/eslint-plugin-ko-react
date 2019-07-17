# Ensures that observables are read safely (e.g. useObservable, useComputed) inside React components (safe-observable-reads)

When using knockout observables to render React components, the component needs to know to rerender when an observable changes.  This is done by wrapping the observable in `useObservable` or `useComputed` (or some other hook built on them).

## Rule Details

This rule aims to enforce that observables are properly wrapped in `useObserve` and `useComputed` and not directly read.

Examples of **incorrect** code for this rule:

```tsx
type GreeterProps = { name: KnockoutObservable<string> };

const Greeter = ({name}: GreeterProps) => (
    <div>Hello {name()}</div>
);
```

Examples of **correct** code for this rule:

```tsx
type GreeterProps = { name: KnockoutObservable<string> };

const Greeter1 = (props: GreeterProps) => {
    const name = useObservable(props.name);
    return <div>Hello {name()}</div>
};

const Greeter2 = ({name}: GreeterProps) => useComputed(() => (
    <div>Hello {name()}</div>
), [name]);
```

### Options

* additionalHooks - any direct observable reads inside `useComputed` callbacks are considered safe. Any custom hooks that wrap `useComputed` can be added to this list and they'll be considered safe as well.
