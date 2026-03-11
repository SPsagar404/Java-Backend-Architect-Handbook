# Part 5: React Hooks Deep Dive

## 5.1 Introduction to Hooks

### What Are Hooks?

Hooks are special functions introduced in React 16.8 that let you use state, lifecycle, and other React features in functional components — without writing classes.

### Why Hooks Were Introduced

| Problem with Classes | How Hooks Solve It |
|---------------------|-------------------|
| Complex lifecycle methods mixing unrelated logic | Each hook handles one concern |
| Hard to reuse stateful logic between components | Custom hooks enable logic sharing |
| `this` keyword confusion and binding issues | No `this` — just plain functions |
| Verbose boilerplate (constructor, bind, render) | Concise, focused code |
| Difficult to optimize (class instances) | Pure functions, easier tree shaking |

### Rules of Hooks

```
+--------------------------------------------------------------+
|                      RULES OF HOOKS                           |
+--------------------------------------------------------------+
|                                                              |
|  1. Only call hooks at the TOP LEVEL                         |
|     - Never inside loops, conditions, or nested functions    |
|     - React relies on call ORDER to track state              |
|                                                              |
|  2. Only call hooks from REACT FUNCTIONS                     |
|     - Functional components                                  |
|     - Custom hooks (functions starting with "use")           |
|     - Never from regular JavaScript functions                |
|                                                              |
|  WHY? React tracks hooks by their call order:                |
|                                                              |
|  First render:    hook1 -> hook2 -> hook3                    |
|  Second render:   hook1 -> hook2 -> hook3  (same order!)     |
|                                                              |
|  If order changes, React cannot match state correctly!       |
+--------------------------------------------------------------+
```

### Hook Lifecycle Overview

```
+--------------------------------------------------------------+
|                    HOOK LIFECYCLE                              |
+--------------------------------------------------------------+
|                                                              |
|  INITIAL RENDER                                              |
|  +--------------------------------------------------------+ |
|  | 1. useState(initialValue) -> creates state              | |
|  | 2. Component renders (returns JSX)                      | |
|  | 3. React updates DOM                                    | |
|  | 4. useEffect callbacks run (after paint)                | |
|  +--------------------------------------------------------+ |
|                          |                                   |
|                   State Changes                              |
|                          |                                   |
|  RE-RENDER                                                   |
|  +--------------------------------------------------------+ |
|  | 1. useState returns current state (not initial)         | |
|  | 2. Component re-renders with new state                  | |
|  | 3. React diffs and updates DOM                          | |
|  | 4. useEffect cleanup runs (if deps changed)            | |
|  | 5. useEffect callbacks run (if deps changed)           | |
|  +--------------------------------------------------------+ |
|                          |                                   |
|                   Component Removed                          |
|                          |                                   |
|  UNMOUNT                                                     |
|  +--------------------------------------------------------+ |
|  | 1. useEffect cleanup functions run                      | |
|  | 2. State is discarded                                   | |
|  +--------------------------------------------------------+ |
+--------------------------------------------------------------+
```

---

## 5.2 useState

### What It Does

`useState` declares a state variable in a functional component. It returns a pair: the current state value and a function to update it.

### Syntax

```typescript
const [state, setState] = useState<Type>(initialValue);
```

### How It Works Internally

1. On first render, React stores the initial value in an internal array at a specific index
2. On re-renders, React returns the stored value (not the initial value)
3. When `setState` is called, React schedules a re-render with the new value
4. React batches multiple `setState` calls for performance

### When to Use

- Tracking user input (form values)
- Toggle visibility (modals, dropdowns)
- Counters and numerical values
- Any data that changes over time and affects rendering

### JavaScript Example

```jsx
import React, { useState } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos(prev => [...prev, { id: Date.now(), text: input, done: false }]);
    setInput('');
  };

  const toggleTodo = (id) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  return (
    <div className="todo-app">
      <h2>Todo List</h2>
      <div className="input-group">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul>
        {todos.map(todo => (
          <li key={todo.id} className={todo.done ? 'completed' : ''}>
            <span onClick={() => toggleTodo(todo.id)}>{todo.text}</span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <p>{todos.filter(t => !t.done).length} items remaining</p>
    </div>
  );
}
```

### TypeScript Example

```tsx
import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

function TodoApp(): React.ReactElement {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState<string>('');

  const addTodo = (): void => {
    if (!input.trim()) return;
    setTodos(prev => [...prev, { id: Date.now(), text: input, done: false }]);
    setInput('');
  };

  const toggleTodo = (id: number): void => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  const deleteTodo = (id: number): void => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  return (
    <div className="todo-app">
      <h2>Todo List</h2>
      <div className="input-group">
        <input
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && addTodo()}
          placeholder="Add a todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul>
        {todos.map(todo => (
          <li key={todo.id} className={todo.done ? 'completed' : ''}>
            <span onClick={() => toggleTodo(todo.id)}>{todo.text}</span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <p>{todos.filter(t => !t.done).length} items remaining</p>
    </div>
  );
}
```

### Lazy Initialization

When the initial value is expensive to compute, pass a function:

```tsx
// Expensive computation runs on EVERY render
const [data, setData] = useState(expensiveComputation()); // BAD

// Function runs ONLY on first render
const [data, setData] = useState(() => expensiveComputation()); // GOOD

// Real-world example: reading from localStorage
const [theme, setTheme] = useState<string>(() => {
  return localStorage.getItem('theme') || 'light';
});
```

---

## 5.3 useEffect

### What It Does

`useEffect` lets you perform side effects in functional components. Side effects include data fetching, subscriptions, timers, DOM manipulation, and logging.

### Why It Exists

Functional components are pure rendering functions — they should only compute JSX based on props and state. Side effects need a dedicated mechanism, which `useEffect` provides.

### How It Works Internally

1. After React renders the component and updates the DOM, it runs the effect
2. Effects run asynchronously (after browser paint), so they don't block rendering
3. Before running the next effect (on re-render), React runs the cleanup function from the previous effect
4. On unmount, React runs the final cleanup

### When to Use

| Use Case | Example |
|----------|---------|
| Data fetching | Fetch data from API on mount or when dependencies change |
| Subscriptions | WebSocket connections, event listeners |
| Timers | setInterval, setTimeout |
| DOM manipulation | Focus input, scroll to element |
| Synchronizing | Sync state with external systems (localStorage, URL) |

### Three Forms of useEffect

```
+--------------------------------------------------------------+
|              THREE FORMS OF useEffect                         |
+--------------------------------------------------------------+
|                                                              |
|  FORM 1: Run on EVERY render                                |
|  useEffect(() => {                                           |
|    // runs after every render                                |
|  });                                                         |
|  Use case: Logging, debugging                                |
|                                                              |
|  FORM 2: Run ONCE on mount                                  |
|  useEffect(() => {                                           |
|    // runs only once after initial render                    |
|    return () => { /* cleanup on unmount */ };                |
|  }, []);                                                     |
|  Use case: Initial data fetch, event listeners               |
|                                                              |
|  FORM 3: Run when DEPENDENCIES change                        |
|  useEffect(() => {                                           |
|    // runs when dep1 or dep2 change                          |
|    return () => { /* cleanup before re-run */ };             |
|  }, [dep1, dep2]);                                           |
|  Use case: Re-fetch when ID changes, re-subscribe           |
+--------------------------------------------------------------+
```

### useEffect Execution Flow

```
Component Renders
       |
       v
React updates DOM
       |
       v
Browser paints screen
       |
       v
Run useEffect cleanup (from previous render, if deps changed)
       |
       v
Run useEffect callback (if deps changed or first render)
       |
       v
Component re-renders (if state updated inside effect)
```

### Real-World Example: Data Fetching with Cleanup

```tsx
import React, { useState, useEffect } from 'react';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
}

function ProductList({ categoryId }: { categoryId: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController(); // For cleanup

    async function fetchProducts(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/categories/${categoryId}/products`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error('Failed to fetch');

        const data: Product[] = await response.json();
        setProducts(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();

    // Cleanup: abort fetch if component unmounts or categoryId changes
    return () => controller.abort();
  }, [categoryId]); // Re-fetch when category changes

  if (loading) return <div>Loading products...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="product-grid">
      {products.map(product => (
        <div key={product.id} className="product-card">
          <img src={product.image} alt={product.name} />
          <h3>{product.name}</h3>
          <p>${product.price.toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}
```

### Real-World Example: WebSocket Subscription

```tsx
useEffect(() => {
  const ws = new WebSocket('wss://api.example.com/notifications');

  ws.onmessage = (event: MessageEvent) => {
    const notification = JSON.parse(event.data);
    setNotifications(prev => [notification, ...prev]);
  };

  ws.onerror = (error: Event) => {
    console.error('WebSocket error:', error);
  };

  // Cleanup: close connection on unmount
  return () => {
    ws.close();
  };
}, []);
```

---

## 5.4 useContext

### What It Does

`useContext` provides access to React Context values without nesting Consumer components. It allows sharing data across the component tree without prop drilling.

### Why It Exists

Passing data through many layers of props (prop drilling) makes code verbose and hard to maintain. `useContext` provides a cleaner alternative for data that many components need (e.g., theme, user, locale).

### How It Works Internally

1. A Context is created with `createContext`
2. A Provider component wraps the tree, supplying the value
3. Any descendant component can call `useContext` to read the value
4. When the Provider's value changes, all consumers re-render

### When to Use

- Theme (dark/light mode)
- Authenticated user data
- Locale/language preferences
- Configuration settings

### When NOT to Use

- For frequently changing data (every keystroke) — use state management instead
- When only one or two levels of nesting exist — just pass props

### Real-World Example: Theme Context

```tsx
// ThemeContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: {
    background: string;
    text: string;
    primary: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  const toggleTheme = (): void => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const colors = {
    background: theme === 'light' ? '#ffffff' : '#1a1a2e',
    text: theme === 'light' ? '#333333' : '#e0e0e0',
    primary: theme === 'light' ? '#3f51b5' : '#7c4dff',
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook for consuming the context
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

```tsx
// Usage in components
function Header() {
  const { theme, toggleTheme, colors } = useTheme();

  return (
    <header style={{ background: colors.background, color: colors.text }}>
      <h1>My App</h1>
      <button onClick={toggleTheme}>
        Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
      </button>
    </header>
  );
}

// App.tsx
function App() {
  return (
    <ThemeProvider>
      <Header />
      <MainContent />
      <Footer />
    </ThemeProvider>
  );
}
```

---

## 5.5 useReducer

### What It Does

`useReducer` is an alternative to `useState` for managing complex state logic. It accepts a reducer function and an initial state, returning the current state and a dispatch function.

### Why It Exists

When state logic involves multiple sub-values, depends on previous state, or follows complex transitions, `useReducer` is more predictable than multiple `useState` calls.

### When to Use

| Scenario | Use useState | Use useReducer |
|----------|-------------|---------------|
| Simple values (toggle, counter) | Yes | Overkill |
| Related state fields that update together | Possible | Preferred |
| Complex state transitions | Messy | Clean |
| State logic shared between components | Difficult | Easy (extract reducer) |
| Predictable state machine behavior | No | Yes |

### How It Works Internally

```
+--------------------------------------------------------------+
|                    useReducer FLOW                             |
+--------------------------------------------------------------+
|                                                              |
|  Component dispatches an ACTION                              |
|       |                                                      |
|       v                                                      |
|  REDUCER FUNCTION receives (currentState, action)            |
|       |                                                      |
|       v                                                      |
|  Reducer computes and returns NEW STATE                      |
|       |                                                      |
|       v                                                      |
|  React compares new state with old state                     |
|       |                                                      |
|       +--> Same? -> No re-render                             |
|       |                                                      |
|       +--> Different? -> Component re-renders                |
+--------------------------------------------------------------+
```

### Real-World Example: Shopping Cart

```tsx
import React, { useReducer } from 'react';

// Types
interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  total: number;
}

// Action types
type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE_ITEM'; payload: { id: number } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
  | { type: 'CLEAR_CART' };

// Initial state
const initialState: CartState = { items: [], total: 0 };

// Helper function
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Reducer function — pure function, no side effects
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(item => item.id === action.payload.id);
      let newItems: CartItem[];

      if (existing) {
        newItems = state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newItems = [...state.items, { ...action.payload, quantity: 1 }];
      }

      return { items: newItems, total: calculateTotal(newItems) };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(item => item.id !== action.payload.id);
      return { items: newItems, total: calculateTotal(newItems) };
    }

    case 'UPDATE_QUANTITY': {
      const newItems = state.items.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      ).filter(item => item.quantity > 0);
      return { items: newItems, total: calculateTotal(newItems) };
    }

    case 'CLEAR_CART':
      return initialState;

    default:
      return state;
  }
}

// Component
function ShoppingCart(): React.ReactElement {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  return (
    <div className="cart">
      <h2>Shopping Cart ({state.items.length} items)</h2>
      {state.items.map(item => (
        <div key={item.id} className="cart-item">
          <span>{item.name}</span>
          <span>${item.price.toFixed(2)}</span>
          <input
            type="number"
            value={item.quantity}
            min={0}
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_QUANTITY',
                payload: { id: item.id, quantity: Number(e.target.value) }
              })
            }
          />
          <button onClick={() => dispatch({ type: 'REMOVE_ITEM', payload: { id: item.id } })}>
            Remove
          </button>
        </div>
      ))}
      <div className="cart-total">
        <strong>Total: ${state.total.toFixed(2)}</strong>
      </div>
      <button onClick={() => dispatch({ type: 'CLEAR_CART' })}>
        Clear Cart
      </button>
    </div>
  );
}
```

---

## 5.6 useMemo

### What It Does

`useMemo` caches the result of an expensive computation and only recomputes it when its dependencies change.

### Why It Exists

Without `useMemo`, expensive calculations re-run on every render, even when their inputs haven't changed. This can cause performance issues in large applications.

### When to Use

- Expensive computations (sorting, filtering large arrays)
- Deriving data from state/props
- Preventing unnecessary re-creation of objects/arrays passed as props

### When NOT to Use

- Simple calculations (addition, string concatenation)
- When the dependency changes on every render anyway
- Premature optimization — measure first, then optimize

### How It Works Internally

```
Render 1: deps = [a, b]
  -> Compute result
  -> Cache: { deps: [a, b], result: value1 }

Render 2: deps = [a, b]  (same)
  -> Return cached value1 (no recomputation)

Render 3: deps = [a, c]  (changed!)
  -> Recompute result
  -> Cache: { deps: [a, c], result: value2 }
```

### Real-World Example

```tsx
import React, { useState, useMemo } from 'react';

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
}

function EmployeeTable({ employees }: { employees: Employee[] }) {
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<keyof Employee>('name');
  const [filterDept, setFilterDept] = useState<string>('all');

  // EXPENSIVE: filtering and sorting a large list
  // useMemo ensures this only recomputes when search, sortBy, or filterDept change
  const processedEmployees = useMemo(() => {
    console.log('Recomputing employee list...'); // For debugging

    let result = [...employees];

    // Filter by department
    if (filterDept !== 'all') {
      result = result.filter(emp => emp.department === filterDept);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(emp =>
        emp.name.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (a[sortBy] < b[sortBy]) return -1;
      if (a[sortBy] > b[sortBy]) return 1;
      return 0;
    });

    return result;
  }, [employees, search, sortBy, filterDept]);

  // Memoize statistics
  const stats = useMemo(() => ({
    total: processedEmployees.length,
    avgSalary: processedEmployees.length > 0
      ? processedEmployees.reduce((sum, e) => sum + e.salary, 0) / processedEmployees.length
      : 0,
    maxSalary: Math.max(...processedEmployees.map(e => e.salary), 0)
  }), [processedEmployees]);

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search employees..."
      />
      <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
        <option value="all">All Departments</option>
        <option value="engineering">Engineering</option>
        <option value="sales">Sales</option>
      </select>
      <div>
        <p>Showing {stats.total} employees | Avg Salary: ${stats.avgSalary.toFixed(0)}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th onClick={() => setSortBy('name')}>Name</th>
            <th onClick={() => setSortBy('department')}>Department</th>
            <th onClick={() => setSortBy('salary')}>Salary</th>
          </tr>
        </thead>
        <tbody>
          {processedEmployees.map(emp => (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>{emp.department}</td>
              <td>${emp.salary.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 5.7 useCallback

### What It Does

`useCallback` caches a function definition so that it maintains referential equality between renders unless its dependencies change.

### Why It Exists

In JavaScript, functions created inside a component are new objects on every render. When passed as props to child components wrapped in `React.memo`, new function references cause unnecessary re-renders. `useCallback` preserves the same function reference.

### useMemo vs useCallback

| Feature | useMemo | useCallback |
|---------|---------|-------------|
| Caches | Computed value | Function definition |
| Returns | The result of calling the function | The function itself |
| Syntax | `useMemo(() => computeValue(), [deps])` | `useCallback((args) => doSomething(args), [deps])` |
| Use Case | Expensive calculations | Functions passed as props |

```typescript
// These are equivalent:
const memoizedFn = useCallback((a, b) => a + b, []);
const memoizedFn = useMemo(() => (a, b) => a + b, []);
```

### Real-World Example

```tsx
import React, { useState, useCallback, memo } from 'react';

// Child component wrapped in React.memo
// Only re-renders when its props actually change
const TodoItem = memo(function TodoItem({
  todo,
  onToggle,
  onDelete
}: {
  todo: { id: number; text: string; done: boolean };
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  console.log(`Rendering TodoItem: ${todo.text}`); // Debug

  return (
    <li className={todo.done ? 'completed' : ''}>
      <span onClick={() => onToggle(todo.id)}>{todo.text}</span>
      <button onClick={() => onDelete(todo.id)}>Delete</button>
    </li>
  );
});

function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Learn React', done: false },
    { id: 2, text: 'Build project', done: false }
  ]);
  const [input, setInput] = useState('');

  // Without useCallback: new function on every render
  // -> TodoItem re-renders even when its todo hasn't changed
  // With useCallback: same function reference between renders
  // -> TodoItem skips re-render if its todo hasn't changed

  const handleToggle = useCallback((id: number): void => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  }, []);

  const handleDelete = useCallback((id: number): void => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <ul>
        {todos.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}
      </ul>
    </div>
  );
}
```

---

## 5.8 useRef

### What It Does

`useRef` creates a mutable reference object that persists for the entire lifetime of the component. It does NOT cause re-renders when its value changes.

### Why It Exists

Sometimes you need to:
- Access DOM elements directly (focus, scroll, measure)
- Store mutable values that shouldn't trigger re-renders (timers, previous values)
- Keep a reference across renders without re-rendering

### When to Use

| Use Case | Example |
|----------|---------|
| DOM access | Focus input, scroll into view, measure size |
| Previous value | Track previous state for comparisons |
| Mutable instance variable | Timer IDs, counters, flags |
| Storing external library instances | Chart.js, D3, map libraries |

### How It Works

```
+--------------------------------------------------------------+
|                       useRef BEHAVIOR                         |
+--------------------------------------------------------------+
|                                                              |
|  const ref = useRef(initialValue);                           |
|                                                              |
|  ref.current = initialValue  (mutable, persists)             |
|                                                              |
|  Render 1: ref.current = 'A'                                 |
|  Render 2: ref.current = 'A'  (still 'A', not reset)        |
|  Update:   ref.current = 'B'  (no re-render triggered!)     |
|  Render 3: ref.current = 'B'  (value persisted)             |
|                                                              |
|  KEY DIFFERENCE from useState:                               |
|  - useState: value change -> re-render                       |
|  - useRef: value change -> NO re-render                      |
+--------------------------------------------------------------+
```

### Real-World Examples

```tsx
import React, { useRef, useState, useEffect } from 'react';

// Example 1: DOM Access — Auto-focus input
function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus(); // Focus on mount
  }, []);

  return <input ref={inputRef} placeholder="Search..." />;
}

// Example 2: Timer management
function Stopwatch() {
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = (): void => {
    if (isRunning) return;
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTime(prev => prev + 10);
    }, 10);
  };

  const stop = (): void => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
  };

  const reset = (): void => {
    stop();
    setTime(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="stopwatch">
      <h1>{formatTime(time)}</h1>
      <button onClick={start} disabled={isRunning}>Start</button>
      <button onClick={stop} disabled={!isRunning}>Stop</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

// Example 3: Tracking previous value
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

function PriceDisplay({ price }: { price: number }) {
  const previousPrice = usePrevious(price);

  return (
    <div>
      <p>Current: ${price}</p>
      <p>Previous: ${previousPrice ?? 'N/A'}</p>
      {previousPrice !== undefined && (
        <span className={price > previousPrice ? 'up' : 'down'}>
          {price > previousPrice ? 'UP' : 'DOWN'}
        </span>
      )}
    </div>
  );
}
```

---

## 5.9 Custom Hooks

### What Are Custom Hooks?

Custom hooks are JavaScript/TypeScript functions whose names start with `use` and that can call other hooks. They let you extract reusable stateful logic from components.

### Why Create Custom Hooks?

- **Reuse logic** across multiple components without duplication
- **Separation of concerns** — keep components focused on rendering
- **Testable** — hook logic can be tested independently
- **Composition** — combine multiple hooks into one

### Real-World Custom Hooks

**1. useFetch — Generic data fetching hook:**

```tsx
import { useState, useEffect } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useFetch<T>(url: string): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<number>(0);

  const refetch = (): void => setTrigger(prev => prev + 1);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result: T = await response.json();
        setData(result);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [url, trigger]);

  return { data, loading, error, refetch };
}

// Usage
function UserList() {
  const { data: users, loading, error, refetch } = useFetch<User[]>('/api/users');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error} <button onClick={refetch}>Retry</button></div>;

  return (
    <ul>
      {users?.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
```

**2. useDebounce — Debounce rapidly changing values:**

```tsx
import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage: Search with debounce
function SearchPage() {
  const [query, setQuery] = useState<string>('');
  const debouncedQuery = useDebounce(query, 300);

  const { data: results } = useFetch<SearchResult[]>(
    debouncedQuery ? `/api/search?q=${debouncedQuery}` : ''
  );

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {results?.map(r => <div key={r.id}>{r.title}</div>)}
    </div>
  );
}
```

**3. useLocalStorage — Persist state in localStorage:**

```tsx
import { useState, useEffect } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

// Usage
function Settings() {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
  const [fontSize, setFontSize] = useLocalStorage<number>('fontSize', 14);

  return (
    <div>
      <select value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark')}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <input
        type="range"
        min={12}
        max={24}
        value={fontSize}
        onChange={e => setFontSize(Number(e.target.value))}
      />
    </div>
  );
}
```

**4. useOnClickOutside — Detect clicks outside an element:**

```tsx
import { useEffect, RefObject } from 'react';

function useOnClickOutside(ref: RefObject<HTMLElement>, handler: () => void): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent): void => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// Usage: Close dropdown on outside click
function Dropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(dropdownRef, () => setIsOpen(false));

  return (
    <div ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)}>Menu</button>
      {isOpen && (
        <ul className="dropdown-menu">
          <li>Profile</li>
          <li>Settings</li>
          <li>Logout</li>
        </ul>
      )}
    </div>
  );
}
```

### Custom Hooks Summary

| Hook | Purpose | Key Dependencies |
|------|---------|-----------------|
| `useFetch` | Data fetching with loading/error states | URL |
| `useDebounce` | Delay rapidly changing values | Value, delay |
| `useLocalStorage` | Persist state in localStorage | Key, initial value |
| `useOnClickOutside` | Detect clicks outside element | Ref, handler |
| `usePrevious` | Track the previous render's value | Value |
| `useMediaQuery` | Respond to CSS media query matches | Query string |
| `useToggle` | Boolean toggle state | Initial value |

