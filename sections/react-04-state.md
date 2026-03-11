# Part 6: State Management

## 6.1 Understanding State in React Applications

### State Categories

React applications deal with multiple categories of state:

```
+--------------------------------------------------------------+
|                    TYPES OF STATE                              |
+--------------------------------------------------------------+
|                                                              |
|  LOCAL STATE                                                 |
|  +--------------------------------------------------------+ |
|  | Managed within a single component                       | |
|  | Examples: form input, toggle, counter                   | |
|  | Tool: useState, useReducer                              | |
|  +--------------------------------------------------------+ |
|                                                              |
|  SHARED STATE                                                |
|  +--------------------------------------------------------+ |
|  | Shared between a few related components                 | |
|  | Examples: selected tab, filter criteria                 | |
|  | Tool: Lift state up to common parent                    | |
|  +--------------------------------------------------------+ |
|                                                              |
|  GLOBAL STATE                                                |
|  +--------------------------------------------------------+ |
|  | Needed across many components at different depths       | |
|  | Examples: auth user, theme, language                    | |
|  | Tool: Context API, Redux, Zustand                       | |
|  +--------------------------------------------------------+ |
|                                                              |
|  SERVER STATE                                                |
|  +--------------------------------------------------------+ |
|  | Data from external APIs (async, cached, stale)          | |
|  | Examples: user list, product catalog                    | |
|  | Tool: React Query, SWR, RTK Query                       | |
|  +--------------------------------------------------------+ |
|                                                              |
|  URL STATE                                                   |
|  +--------------------------------------------------------+ |
|  | State stored in the URL (path, query params)            | |
|  | Examples: search query, page number, selected tab       | |
|  | Tool: React Router, useSearchParams                      | |
|  +--------------------------------------------------------+ |
+--------------------------------------------------------------+
```

---

## 6.2 Local State

Local state is the simplest form of state management. It belongs to a single component and is managed using `useState` or `useReducer`.

### When to Use Local State

- The data is only relevant to one component
- No other component needs to read or update it
- Examples: form inputs, toggle states, local counters

```tsx
function LoginForm() {
  // All state is local to this component
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit logic
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
      />
      {errors.email && <span className="error">{errors.email}</span>}

      <div className="password-group">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="button" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
      {errors.password && <span className="error">{errors.password}</span>}

      <button type="submit">Login</button>
    </form>
  );
}
```

---

## 6.3 The Prop Drilling Problem

### What Is Prop Drilling?

Prop drilling occurs when data must be passed through multiple intermediate components that don't use the data themselves — they just pass it along.

### Prop Drilling Visualization

```
+--------------------------------------------------------------+
|                    PROP DRILLING PROBLEM                       |
+--------------------------------------------------------------+
|                                                              |
|  App (has user state)                                        |
|    |                                                         |
|    +-- user={user} --------------------------------+         |
|    |                                               |         |
|    v                                               v         |
|  Layout (doesn't use user, just passes it)      Sidebar     |
|    |                                                         |
|    +-- user={user} --+                                       |
|    |                 |                                        |
|    v                 v                                        |
|  Header           Content (doesn't use user)                 |
|    |                 |                                        |
|    +-- user={user}   +-- user={user}                         |
|    |                 |                                        |
|    v                 v                                        |
|  UserMenu         Dashboard                                  |
|  (finally uses     |                                         |
|   user!)           +-- user={user}                           |
|                    |                                          |
|                    v                                          |
|                  WelcomeBanner                                |
|                  (finally uses user!)                         |
+--------------------------------------------------------------+
     Problem: Layout, Content, Dashboard don't need user
              but MUST pass it through anyway
```

### Why Prop Drilling Is Problematic

| Problem | Impact |
|---------|--------|
| Verbose code | Every intermediate component must declare and pass the prop |
| Tight coupling | Intermediate components depend on data they don't use |
| Refactoring difficulty | Adding/removing a prop requires changes in many files |
| Maintenance burden | Hard to trace where data flows through the tree |

---

## 6.4 Context API

### What Is Context?

React Context API provides a way to share state across the component tree without passing props manually through every level. It creates a "tunnel" that allows any descendant to access the value directly.

### How Context Solves Prop Drilling

```
+--------------------------------------------------------------+
|                 CONTEXT API SOLUTION                          |
+--------------------------------------------------------------+
|                                                              |
|  AuthProvider (wraps the tree with user context)             |
|    |                                                         |
|    v                                                         |
|  App                                                         |
|    |                                                         |
|    +-------------------+                                     |
|    |                   |                                     |
|    v                   v                                     |
|  Layout              Sidebar                                 |
|    |                                                         |
|    +----------+                                              |
|    |          |                                              |
|    v          v                                              |
|  Header    Content                                           |
|    |          |                                              |
|    v          v                                              |
|  UserMenu  Dashboard                                         |
|  useAuth()     |                                             |
|  (direct       v                                             |
|   access!)   WelcomeBanner                                   |
|              useAuth()                                       |
|              (direct access!)                                |
|                                                              |
|  No intermediate components need to know about user!         |
+--------------------------------------------------------------+
```

### Complete Context API Example: Authentication

```tsx
// context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

// Create context with undefined default
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const userData: User = await response.json();
          setUser(userData);
        } else {
          localStorage.removeItem('token');
        }
      } catch {
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const { user: userData, token } = await response.json();
      localStorage.setItem('token', token);
      setUser(userData);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      error
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook with safety check
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

```tsx
// Usage in components

// App.tsx
function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

// components/Header.tsx
function Header() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header>
      <h1>My App</h1>
      {isAuthenticated ? (
        <div>
          <span>Welcome, {user?.name}</span>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <a href="/login">Login</a>
      )}
    </header>
  );
}
```

### Context API Limitations

| Limitation | Description |
|-----------|-------------|
| Performance | ALL consumers re-render when context value changes |
| No selector | Cannot subscribe to only part of the context |
| Single responsibility | Should not hold too much unrelated data |
| Not for high-frequency updates | Every keystroke re-renders all consumers |

### When to Use Context vs State Management Libraries

| Scenario | Recommendation |
|----------|---------------|
| Theme, locale, auth user | Context API (changes rarely) |
| Simple shared state (< 5 components) | Context API |
| Complex state with many actions | Redux / Zustand |
| High-frequency updates | Zustand / Jotai |
| Server data caching | React Query / SWR |

---

# Part 7: Advanced State Management

## 7.1 Redux

### What Is Redux?

Redux is a predictable state container for JavaScript applications. It centralizes the application state into a single store and enforces unidirectional data flow through actions and reducers.

### Why Redux Exists

While Context API works for simple global state, large applications need:
- Predictable state transitions
- Time-travel debugging
- Middleware for side effects
- DevTools for state inspection
- State persistence and hydration

### Redux Core Principles

```
+--------------------------------------------------------------+
|                   REDUX CORE PRINCIPLES                       |
+--------------------------------------------------------------+
|                                                              |
|  1. SINGLE SOURCE OF TRUTH                                   |
|     The entire application state is stored in one store      |
|                                                              |
|  2. STATE IS READ-ONLY                                       |
|     The only way to change state is by dispatching actions   |
|                                                              |
|  3. CHANGES BY PURE FUNCTIONS                                |
|     Reducers are pure functions: (state, action) => newState |
+--------------------------------------------------------------+
```

### Redux Architecture

```
+--------------------------------------------------------------+
|                    REDUX DATA FLOW                            |
+--------------------------------------------------------------+
|                                                              |
|  UI Component                                                |
|       |                                                      |
|     dispatches                                               |
|       |                                                      |
|       v                                                      |
|  ACTION  { type: 'ADD_TODO', payload: 'Learn Redux' }       |
|       |                                                      |
|       v                                                      |
|  MIDDLEWARE (optional: thunk, saga, logging)                  |
|       |                                                      |
|       v                                                      |
|  REDUCER  (state, action) => newState                        |
|       |                                                      |
|       v                                                      |
|  STORE  (holds the new state)                                |
|       |                                                      |
|     notifies                                                 |
|       |                                                      |
|       v                                                      |
|  UI Component (re-renders with new state)                    |
+--------------------------------------------------------------+
```

### Redux Toolkit Example (Modern Redux)

Redux Toolkit (RTK) is the official, recommended way to write Redux logic. It simplifies store setup, reducer creation, and includes utilities like `createSlice` and `createAsyncThunk`.

```tsx
// store/slices/todosSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface TodosState {
  items: Todo[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: TodosState = {
  items: [],
  status: 'idle',
  error: null
};

// Async thunk for API calls
export const fetchTodos = createAsyncThunk('todos/fetchTodos', async () => {
  const response = await fetch('/api/todos');
  const data: Todo[] = await response.json();
  return data;
});

// Create slice (combines actions + reducer)
const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    addTodo: (state, action: PayloadAction<string>) => {
      // RTK uses Immer internally, so "mutation" is safe
      state.items.push({
        id: Date.now(),
        text: action.payload,
        completed: false
      });
    },
    toggleTodo: (state, action: PayloadAction<number>) => {
      const todo = state.items.find(t => t.id === action.payload);
      if (todo) {
        todo.completed = !todo.completed;
      }
    },
    removeTodo: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter(t => t.id !== action.payload);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchTodos.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch';
      });
  }
});

export const { addTodo, toggleTodo, removeTodo } = todosSlice.actions;
export default todosSlice.reducer;
```

```tsx
// store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import todosReducer from './slices/todosSlice';

export const store = configureStore({
  reducer: {
    todos: todosReducer,
    // Add more slices here
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```tsx
// store/hooks.ts — Typed hooks
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

```tsx
// Component usage
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addTodo, toggleTodo, removeTodo, fetchTodos } from '../store/slices/todosSlice';

function TodoList() {
  const dispatch = useAppDispatch();
  const { items: todos, status, error } = useAppSelector(state => state.todos);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchTodos());
    }
  }, [status, dispatch]);

  const handleAdd = (): void => {
    if (input.trim()) {
      dispatch(addTodo(input));
      setInput('');
    }
  };

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'failed') return <div>Error: {error}</div>;

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={handleAdd}>Add Todo</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <span
              onClick={() => dispatch(toggleTodo(todo.id))}
              style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}
            >
              {todo.text}
            </span>
            <button onClick={() => dispatch(removeTodo(todo.id))}>X</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 7.2 Zustand

### What Is Zustand?

Zustand is a small, fast, and scalable state management library. It provides a simpler API than Redux with less boilerplate while still supporting middleware, persistence, and devtools.

### Why Use Zustand?

| Feature | Redux Toolkit | Zustand |
|---------|--------------|---------|
| Bundle Size | ~11kb | ~1kb |
| Boilerplate | Moderate (slices, store, hooks) | Minimal (single create call) |
| Learning Curve | Steeper | Very gentle |
| DevTools | Yes | Yes (middleware) |
| Middleware | Yes | Yes |
| TypeScript | Good | Excellent |
| Provider Required | Yes | No |
| Selector Support | Yes | Yes (built-in) |

### Zustand Store Architecture

```
+--------------------------------------------------------------+
|                    ZUSTAND ARCHITECTURE                       |
+--------------------------------------------------------------+
|                                                              |
|  create() --> STORE (state + actions in one place)           |
|                  |                                           |
|                  |--- state values                           |
|                  |--- action functions                       |
|                  |--- computed values                        |
|                  |                                           |
|                  v                                           |
|  Components subscribe with useStore()                        |
|  Only re-render when SELECTED state changes                  |
|                                                              |
|  No Provider needed!                                         |
|  No dispatch/action creators!                                |
|  No reducers!                                                |
+--------------------------------------------------------------+
```

### Zustand Example

```tsx
// store/useCartStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  total: number;

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;

  // Computed
  itemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],
        total: 0,

        addItem: (item) => set((state) => {
          const existing = state.items.find(i => i.id === item.id);
          let newItems: CartItem[];

          if (existing) {
            newItems = state.items.map(i =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
            );
          } else {
            newItems = [...state.items, { ...item, quantity: 1 }];
          }

          return {
            items: newItems,
            total: newItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
          };
        }),

        removeItem: (id) => set((state) => {
          const newItems = state.items.filter(i => i.id !== id);
          return {
            items: newItems,
            total: newItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
          };
        }),

        updateQuantity: (id, quantity) => set((state) => {
          const newItems = state.items.map(i =>
            i.id === id ? { ...i, quantity: Math.max(0, quantity) } : i
          ).filter(i => i.quantity > 0);
          return {
            items: newItems,
            total: newItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
          };
        }),

        clearCart: () => set({ items: [], total: 0 }),

        itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0)
      }),
      { name: 'cart-storage' } // localStorage key
    )
  )
);
```

```tsx
// Component usage — no Provider wrapping needed!

function CartIcon() {
  // Only subscribes to items.length — won't re-render on other changes
  const itemCount = useCartStore(state => state.items.length);

  return (
    <div className="cart-icon">
      Cart ({itemCount})
    </div>
  );
}

function CartPage() {
  const { items, total, removeItem, updateQuantity, clearCart } = useCartStore();

  return (
    <div className="cart-page">
      <h2>Shopping Cart</h2>
      {items.map(item => (
        <div key={item.id} className="cart-item">
          <span>{item.name}</span>
          <span>${item.price}</span>
          <input
            type="number"
            value={item.quantity}
            onChange={e => updateQuantity(item.id, Number(e.target.value))}
          />
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}
      <div className="total">Total: ${total.toFixed(2)}</div>
      <button onClick={clearCart}>Clear Cart</button>
    </div>
  );
}
```

### State Management Decision Tree

```
+--------------------------------------------------------------+
|           STATE MANAGEMENT DECISION TREE                      |
+--------------------------------------------------------------+
|                                                              |
|  Is state used by only ONE component?                        |
|    YES --> useState / useReducer                             |
|    NO  |                                                     |
|        v                                                     |
|  Is it shared by a PARENT and 1-2 CHILDREN?                  |
|    YES --> Lift state up (pass via props)                     |
|    NO  |                                                     |
|        v                                                     |
|  Does state change INFREQUENTLY (theme, auth)?               |
|    YES --> Context API                                        |
|    NO  |                                                     |
|        v                                                     |
|  Is state from a SERVER (API data)?                          |
|    YES --> React Query / SWR                                  |
|    NO  |                                                     |
|        v                                                     |
|  Do you need simple global state with selectors?             |
|    YES --> Zustand                                            |
|    NO  |                                                     |
|        v                                                     |
|  Do you need complex state, middleware, devtools?            |
|    YES --> Redux Toolkit                                      |
+--------------------------------------------------------------+
```

