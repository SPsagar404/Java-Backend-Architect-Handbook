# Part 16: Common Interview Questions

This section contains 50 essential React interview questions categorized by difficulty and topic.

## Core Concepts

**1. What is React?**
React is an open-source JavaScript library for building user interfaces, mostly used for single-page applications. It focuses on the view layer and handles UI rendering through reusable components.

**2. What are the key features of React?**
- Virtual DOM for fast performance.
- Component-based architecture.
- Declarative UI.
- JSX syntax.
- Unidirectional data flow.

**3. What is JSX?**
JSX stands for JavaScript XML. It is a syntax extension for JavaScript that allows you to write HTML-like code inside JavaScript files. Browsers cannot read it natively; it must be transpiled by Babel into `React.createElement()` calls.

**4. What is the Virtual DOM?**
The Virtual DOM is a lightweight, in-memory representation of the real DOM. When state changes, React creates a new VDOM, compares it with the previous VDOM (diffing), and calculates the minimal set of changes (reconciliation) needed to update the real DOM.

**5. Why can't browsers read JSX?**
Browsers only understand plain JavaScript objects. JSX must be converted to standard JavaScript objects using tools like Babel before it can be executed.

**6. What is the difference between Real DOM and Virtual DOM?**
Real DOM manipulation is slow, updates the entire tree, and directly affects the HTML document. Virtual DOM manipulation is fast, operates in memory, and calculates minimal diffs before applying changes to the Real DOM.

**7. Define "Declarative Programming" in React.**
In declarative programming, you tell React *what* the UI should look like for a given state, and React figures out *how* to update the DOM correctly. This contrasts with imperative programming, where you write step-by-step instructions.

**8. What is Reconciliation?**
Reconciliation is React's algorithm (currently called Fiber) for comparing two Virtual DOM trees and applying the minimal necessary operations to the real DOM.

**9. Why do we need keys in React lists?**
Keys help React uniquely identify items in a list. During reconciliation, React uses keys to determine which items were added, removed, or reordered, avoiding unnecessary re-renders of the entire list.

**10. What happens if you use the array index as a key?**
Using the index as a key is an anti-pattern if the list order can change (e.g., sorting, adding/removing items). It can cause severe rendering bugs where state gets attached to the wrong list item.

## Components & Props

**11. What is the difference between Functional and Class components?**
Class components require extending `React.Component`, have lifecycle methods, and use `this.state`. Functional components are plain JS functions that accept props, return JSX, and manage state using Hooks. Functional components are the modern standard.

**12. What are props in React?**
Props (properties) are read-only objects passed from a parent component to a child component to configure its rendering or behavior.

**13. Can a child component modify its own props?**
No. Props are strictly read-only. Modifying them violates React's unidirectional data flow.

**14. What is `children` prop?**
`children` is a special prop that allows components to pass unconfigured React elements directly inside the opening and closing tags of a component (e.g., `<Card><p>Hello</p></Card>`).

**15. What are defaultProps?**
Default props define fallback values for props if the parent component does not provide them. In modern functional components, default parameters are preferred over the `defaultProps` property.

**16. What is Prop Drilling?**
Prop drilling is the process of passing props through multiple levels of intermediate components that don't need the data, simply to reach a deeply nested child that does.

**17. How do you solve Prop Drilling?**
By using the Context API, state management libraries like Redux or Zustand, or by restructuring the component hierarchy using component composition (passing rendered elements as props).

**18. What is a Higher-Order Component (HOC)?**
An HOC is a function that takes a component and returns a new component, typically to add shared logic or inject props. Example: `withRouter` or `connect` in older Redux.

## State & Lifecycle

**19. What is state in React?**
State is a built-in object that stores data or information about the component. Unlike props, state is fully managed by the component itself and can be mutated (via setter functions).

**20. Why should you never update state directly?**
If you mutate state directly (`this.state.count = 2`), React will not be notified of the change, and the component will not re-render. Always use the setter function (e.g., `setCount`).

**21. Are state updates synchronous or asynchronous?**
State updates in React are asynchronous. React batches multiple state updates together into a single re-render for performance optimization.

**22. How do you update state based on previous state?**
You should pass an updater function to the `setState` hook instead of the value directly: `setCount(prevCount => prevCount + 1)`.

**23. Name the main lifecycle phases of a component.**
Mounting (insertion into DOM), Updating (re-rendering due to state/prop changes), and Unmounting (removal from DOM).

**24. What is `componentDidMount` equivalent in Hooks?**
`useEffect(() => { ... }, [])` (with an empty dependency array).

**25. What is `componentWillUnmount` equivalent in Hooks?**
The cleanup function returned inside `useEffect`: `useEffect(() => { return () => { ...cleanup logic... } }, [])`.

## Hooks

**26. What are Hooks?**
Hooks are functions introduced in React 16.8 that allow you to use state and lifecycle features inside functional components without writing a class.

**27. What are the Rules of Hooks?**
1. Only call Hooks at the top level of a functional component.
2. Never call Hooks inside loops, conditions, or nested functions.
3. Only call Hooks from React Function Components or Custom Hooks.

**28. Explain `useState`.**
It is a Hook that lets you add React state to function components. It returns an array with two values: the current state and a function to update it.

**29. Explain `useEffect`.**
It is a Hook used to manage side effects (fetching data, subscribing to events, manual DOM manipulation) in function components. It runs after the render phase.

**30. What is the dependency array in `useEffect`?**
It is an array of variables that the effect depends on. If any variable in the array changes between renders, the effect re-runs. If omitted, the effect runs on *every* render. Provide an empty array `[]` to run only once on mount.

**31. Explain `useContext`.**
It is a Hook that accepts a context object (created by `React.createContext`) and returns the current context value. It prevents prop drilling.

**32. Explain `useReducer`.**
An alternative to `useState` for managing complex state objects or state transitions that depend on previous state. It follows the Redux pattern: `(state, action) => newState`.

**33. What is the difference between `useMemo` and `useCallback`?**
`useMemo` memoizes the *result* of an expensive calculation. `useCallback` memoizes a *function definition* so that its reference remains consistent across renders.

**34. Explain `useRef`.**
It returns a mutable ref object whose `.current` property holds a value. It is used to access DOM elements directly or to store mutable values that should *not* cause re-renders when changed.

**35. What is a Custom Hook?**
A JavaScript function whose name starts with "use" and that may call other Hooks. It is used to extract and reuse stateful logic across multiple components.

## Routing & APIs

**36. Explain React Router.**
React Router is the standard routing library for React. It keeps the UI in sync with the URL and enables navigation without full page reloads.

**37. What is the `<Outlet />` component?**
Used in nested routing (React Router v6+), it tells the parent route component exactly where to render its child route components.

**38. How do you implement a Protected Route?**
By creating a wrapper component that checks an authentication token (via Context or State). If valid, it renders the `<Outlet />` or children; if invalid, it returns a `<Navigate to="/login" />` component.

**39. How do you fetch data in React?**
Usually within a `useEffect` hook (running on mount or when specific IDs change) using `fetch` or `axios`, storing the result in a local `useState` variable.

**40. Why are libraries like React Query preferred over standard `useEffect`?**
They automatically handle caching, background refetching, dedpulication, loading states, error states, and pagination without requiring verbose boilerplate code.

## Advanced & Performance

**41. What is React.memo?**
A Higher-Order Component that prevents a functional component from re-rendering if its props have not changed (shallow comparison).

**42. What is Code Splitting?**
Code splitting divides the final Javascript bundle into smaller chunks that can be loaded lazily on demand. This significantly reduces the initial load time of the application.

**43. How do you implement Lazy Loading in React?**
Using `React.lazy()` for dynamic imports combined with the `<Suspense>` component to show a fallback UI while the chunk downloads.

**44. What is a portal in React?**
React Portals provide a way to render children into a DOM node that exists outside the DOM hierarchy of the parent component. Widely used for Modals, Tooltips, and Dropdowns to escape `z-index` trapping.

**45. What are Error Boundaries?**
Components that catch Javascript errors anywhere in their child component tree, log those errors, and display a fallback UI instead of crashing the whole component tree. They currently must be Class components.

## TypeScript in React

**46. Why use TypeScript with React?**
It provides static typing, which catches bugs at compile time (like missing props or typos), improves IDE autocompletion, and makes component contracts safer and self-documenting.

**47. What is the difference between `interface` and `type`?**
Both define shapes of objects. `interface` is restricted to object shapes and can be extended (`extends`). `type` can define aliases for primitives, unions, and tuples. In modern TS, they are mostly interchangeable for typing React props.

**48. How do you type a standard functional component?**
You type the props object itself: `function Button(props: ButtonProps) {}`. Alternatively, `const Button: React.FC<ButtonProps> = (props) => {}`.

**49. How do you type `useState` for a complex object?**
Provide the interface as a generic type argument: `const [user, setUser] = useState<User | null>(null)`.

**50. How do you type an event handler?**
By importing React utility types. E.g., `(e: React.ChangeEvent<HTMLInputElement>)` for input changes, or `(e: React.FormEvent<HTMLFormElement>)` for form submissions.

---

# Part 17: Coding Interview Problems

Real-world coding exercises commonly asked in frontend interviews. Solutions are written in React + TypeScript.

## Exercise 1: Create a Counter Hook

**Problem:** Create a custom hook `useCounter` that takes an initial value and a step. It should return the current count, and functions to increment, decrement, and reset.

**Solution:**
```tsx
import { useState } from 'react';

interface UseCounterOutput {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export function useCounter(initialValue: number = 0, step: number = 1): UseCounterOutput {
  const [count, setCount] = useState<number>(initialValue);

  const increment = () => setCount((prev) => prev + step);
  const decrement = () => setCount((prev) => prev - step);
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
}
```

## Exercise 2: Debounced Search Input

**Problem:** Build an input field that fetches a list of users based on the search term. Ensure the API is not called on every single keystroke, but only when the user stops typing for 500ms.

**Solution:**
```tsx
import React, { useState, useEffect } from 'react';

// Reusable hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Component
export function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    if (debouncedQuery) {
      // Simulate API call
      console.log(`Fetching data for: ${debouncedQuery}`);
      setResults([`${debouncedQuery} result 1`, `${debouncedQuery} result 2`]);
    } else {
      setResults([]);
    }
  }, [debouncedQuery]);

  return (
    <div>
      <input 
        type="text" 
        value={query} 
        onChange={(e) => setQuery(e.target.value)} 
        placeholder="Search..." 
      />
      <ul>
        {results.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </div>
  );
}
```

## Exercise 3: Modal Component with Portal and Click Outside

**Problem:** Create a reusable Modal component that renders outside the main DOM tree, trapping focus, and closes when the user clicks the overlay mask or presses the Escape key.

**Solution:**
```tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', justifyContent: 'center', alignItems: 'center'
      }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} // Prevent bubbling to overlay
        style={{
          background: 'white', padding: '20px', borderRadius: '8px', minWidth: '300px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2>{title}</h2>
          <button onClick={onClose}>X</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );

  // Render into document.body instead of deeply nested DOM
  return createPortal(modalContent, document.body);
}
```

## Exercise 4: Simple Pagination

**Problem:** Create a component that accepts a large array of strings and displays them 5 at a time with "Next" and "Previous" buttons.

**Solution:**
```tsx
import React, { useState } from 'react';

interface PaginationProps {
  data: string[];
  itemsPerPage?: number;
}

export function PaginatedList({ data, itemsPerPage = 5 }: PaginationProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  
  // Calculate bounds
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = data.slice(startIndex, startIndex + itemsPerPage);

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePrev = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div>
      <ul>
        {currentItems.map((item, id) => (
          <li key={id}>{item}</li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={handlePrev} disabled={currentPage === 1}>
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button onClick={handleNext} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}
```
