# Part 8: React with TypeScript

## 8.1 Why TypeScript in React?

### What Is TypeScript?

TypeScript is a statically-typed superset of JavaScript developed by Microsoft. It adds type annotations, interfaces, generics, and compile-time type checking to JavaScript. All valid JavaScript is valid TypeScript, but TypeScript adds an additional layer of safety.

### Why Use TypeScript in React Projects?

| Benefit | Description |
|---------|-------------|
| Catch errors at compile time | Type mismatches, missing props, wrong function signatures |
| Better IDE support | Autocomplete, inline documentation, refactoring |
| Self-documenting code | Types serve as documentation for components and APIs |
| Safer refactoring | Rename a prop and TypeScript shows every place it's used |
| Team scalability | Clear contracts between components, easier onboarding |
| Reduced runtime bugs | Many categories of bugs become impossible |

### TypeScript Adoption in Production

```
+--------------------------------------------------------------+
|          WHY PRODUCTION TEAMS CHOOSE TYPESCRIPT               |
+--------------------------------------------------------------+
|                                                              |
|  Without TypeScript (JavaScript):                            |
|  +--------------------------------------------------------+ |
|  | <UserCard name={42} />     // No error until runtime    | |
|  | user.naem                  // Typo undetected           | |
|  | props.onClick()            // Missing prop, crashes     | |
|  +--------------------------------------------------------+ |
|                                                              |
|  With TypeScript:                                            |
|  +--------------------------------------------------------+ |
|  | <UserCard name={42} />     // ERROR: string expected    | |
|  | user.naem                  // ERROR: no 'naem' property | |
|  | props.onClick()            // ERROR: prop not provided  | |
|  +--------------------------------------------------------+ |
|                                                              |
|  Errors caught BEFORE code reaches production!               |
+--------------------------------------------------------------+
```

---

## 8.2 TypeScript Fundamentals for React

### Basic Types

```typescript
// Primitive types
let name: string = 'Alice';
let age: number = 28;
let isActive: boolean = true;
let data: null = null;
let value: undefined = undefined;

// Arrays
let names: string[] = ['Alice', 'Bob'];
let ids: Array<number> = [1, 2, 3];

// Tuple
let pair: [string, number] = ['Alice', 28];

// Enum
enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Pending = 'PENDING'
}

// Union types
let id: string | number = 'abc';
id = 123; // also valid

// Literal types
let direction: 'up' | 'down' | 'left' | 'right' = 'up';
```

### Interfaces vs Types

```typescript
// Interface — describes object shape, extendable
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  avatar?: string; // optional
}

// Extending interfaces
interface AdminUser extends User {
  permissions: string[];
  lastLogin: Date;
}

// Type — more flexible, can describe any type
type ID = string | number;
type Status = 'active' | 'inactive' | 'pending';
type UserOrNull = User | null;

// Type for function signatures
type EventHandler = (event: React.MouseEvent) => void;

// Type for complex objects
type ApiResponse<T> = {
  data: T;
  status: number;
  message: string;
  timestamp: Date;
};
```

| Feature | Interface | Type |
|---------|-----------|------|
| Object shape | Yes | Yes |
| Extend/Inherit | `extends` keyword | Intersection (`&`) |
| Union types | No | Yes (`string \| number`) |
| Declaration merging | Yes (auto-merge same name) | No |
| Primitives/Tuples/Unions | No | Yes |
| Computed properties | No | Yes |
| Best for | Object shapes, class contracts | Any type definition |

### Generics

```typescript
// Generic function — works with any type
function getFirst<T>(arr: T[]): T | undefined {
  return arr[0];
}

const firstNum = getFirst<number>([1, 2, 3]); // number
const firstStr = getFirst(['a', 'b']); // string (inferred)

// Generic interface
interface ApiResponse<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// Usage
const userResponse: ApiResponse<User> = {
  data: { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  loading: false,
  error: null
};

// Generic with constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const userName = getProperty({ name: 'Alice', age: 28 }, 'name'); // string
```

---

## 8.3 Typing React Components

### Props Typing

```tsx
// Method 1: Inline type annotation
function Greeting({ name, age }: { name: string; age: number }) {
  return <h1>Hello, {name}! Age: {age}</h1>;
}

// Method 2: Separate interface (recommended for complex props)
interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  onAddToCart: (id: number) => void;
  variant?: 'compact' | 'detailed';
}

function ProductCard({
  id,
  name,
  price,
  image,
  description,
  onAddToCart,
  variant = 'compact'
}: ProductCardProps) {
  return (
    <div className={`product-card ${variant}`}>
      <img src={image} alt={name} />
      <h3>{name}</h3>
      <p className="price">${price.toFixed(2)}</p>
      {variant === 'detailed' && description && <p>{description}</p>}
      <button onClick={() => onAddToCart(id)}>Add to Cart</button>
    </div>
  );
}
```

### Children Props

```tsx
// Typing children
interface LayoutProps {
  children: React.ReactNode; // Most flexible — accepts anything renderable
}

interface CardProps {
  title: string;
  children: React.ReactElement; // Only accepts JSX elements
}

interface RenderProps {
  children: (data: User) => React.ReactNode; // Render prop pattern
}

// Example with children
function PageLayout({ children }: LayoutProps) {
  return (
    <div className="page-layout">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
```

### Event Handler Types

```tsx
interface FormProps {
  onSubmit: (data: FormData) => void;
}

function ContactForm({ onSubmit }: FormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    // ...
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    console.log(e.target.value);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    console.log('clicked');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      // ...
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} onKeyDown={handleKeyDown} />
      <button onClick={handleClick}>Submit</button>
    </form>
  );
}
```

### Common React Event Types

| Event | Type |
|-------|------|
| `onChange` (input) | `React.ChangeEvent<HTMLInputElement>` |
| `onChange` (select) | `React.ChangeEvent<HTMLSelectElement>` |
| `onChange` (textarea) | `React.ChangeEvent<HTMLTextAreaElement>` |
| `onClick` | `React.MouseEvent<HTMLButtonElement>` |
| `onSubmit` | `React.FormEvent<HTMLFormElement>` |
| `onKeyDown` | `React.KeyboardEvent<HTMLInputElement>` |
| `onFocus` | `React.FocusEvent<HTMLInputElement>` |
| `onDrag` | `React.DragEvent<HTMLDivElement>` |

---

## 8.4 Typing Hooks

### useState with TypeScript

```tsx
// Simple types — inferred automatically
const [count, setCount] = useState(0); // number
const [name, setName] = useState(''); // string

// Complex types — explicit annotation needed
const [user, setUser] = useState<User | null>(null);

interface FormState {
  name: string;
  email: string;
  age: number;
  errors: Record<string, string>;
}

const [form, setForm] = useState<FormState>({
  name: '',
  email: '',
  age: 0,
  errors: {}
});
```

### useReducer with TypeScript

```tsx
// Define state and action types
interface CounterState {
  count: number;
  min: number;
  max: number;
}

type CounterAction =
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' }
  | { type: 'SET'; payload: number }
  | { type: 'RESET' };

function counterReducer(state: CounterState, action: CounterAction): CounterState {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: Math.min(state.count + 1, state.max) };
    case 'DECREMENT':
      return { ...state, count: Math.max(state.count - 1, state.min) };
    case 'SET':
      return { ...state, count: Math.max(state.min, Math.min(action.payload, state.max)) };
    case 'RESET':
      return { ...state, count: 0 };
    default:
      return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(counterReducer, {
    count: 0,
    min: -10,
    max: 10
  });

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'DECREMENT' })}>-</button>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
      <button onClick={() => dispatch({ type: 'RESET' })}>Reset</button>
    </div>
  );
}
```

### useRef with TypeScript

```tsx
// DOM element reference — initialized with null
const inputRef = useRef<HTMLInputElement>(null);
const divRef = useRef<HTMLDivElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);

// Mutable value reference
const timerRef = useRef<NodeJS.Timeout | null>(null);
const countRef = useRef<number>(0);
```

### useContext with TypeScript

```tsx
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
```

---

## 8.5 Generics in React Components

### Generic Component Pattern

Generics allow you to create components that work with any data type while maintaining type safety.

```tsx
// Generic list component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
}

function List<T>({
  items,
  renderItem,
  keyExtractor,
  emptyMessage = 'No items found'
}: ListProps<T>) {
  if (items.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  return (
    <ul className="list">
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>{renderItem(item, index)}</li>
      ))}
    </ul>
  );
}

// Usage with different types
interface User { id: number; name: string }
interface Product { sku: string; title: string; price: number }

// User list
<List<User>
  items={users}
  keyExtractor={u => u.id}
  renderItem={u => <span>{u.name}</span>}
/>

// Product list
<List<Product>
  items={products}
  keyExtractor={p => p.sku}
  renderItem={p => <span>{p.title} - ${p.price}</span>}
/>
```

### Generic Select Component

```tsx
interface SelectProps<T> {
  options: T[];
  value: T | null;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
  getValue: (option: T) => string | number;
  placeholder?: string;
}

function Select<T>({
  options,
  value,
  onChange,
  getLabel,
  getValue,
  placeholder = 'Select an option'
}: SelectProps<T>) {
  return (
    <select
      value={value ? String(getValue(value)) : ''}
      onChange={(e) => {
        const selected = options.find(o => String(getValue(o)) === e.target.value);
        if (selected) onChange(selected);
      }}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(option => (
        <option key={getValue(option)} value={getValue(option)}>
          {getLabel(option)}
        </option>
      ))}
    </select>
  );
}

// Usage
<Select<User>
  options={users}
  value={selectedUser}
  onChange={setSelectedUser}
  getLabel={u => u.name}
  getValue={u => u.id}
  placeholder="Choose a user"
/>
```

---

## 8.6 Converting React JS to React TS

### Step-by-Step Conversion

**JavaScript Version:**

```jsx
import React, { useState, useEffect } from 'react';

function UserList({ role, onSelect }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`/api/users?role=${role}`)
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [role]);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search users..."
      />
      <ul>
        {filteredUsers.map(user => (
          <li key={user.id} onClick={() => onSelect(user)}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserList;
```

**TypeScript Version:**

```tsx
import React, { useState, useEffect } from 'react';

// Step 1: Define data types
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
}

// Step 2: Define props interface
interface UserListProps {
  role: User['role'];
  onSelect: (user: User) => void;
}

// Step 3: Type the component and all internal state
function UserList({ role, onSelect }: UserListProps): React.ReactElement {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();

    async function fetchUsers(): Promise<void> {
      try {
        const res = await fetch(`/api/users?role=${role}`, {
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: User[] = await res.json();
        setUsers(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
    return () => controller.abort();
  }, [role]);

  // Step 4: Utility functions are also typed
  const filteredUsers: User[] = users.filter((user: User) =>
    user.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <input
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        placeholder="Search users..."
      />
      <ul>
        {filteredUsers.map((user: User) => (
          <li key={user.id} onClick={() => onSelect(user)}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserList;
```

### Conversion Checklist

| Step | Action |
|------|--------|
| 1 | Rename `.jsx` files to `.tsx` (or `.js` to `.ts` for non-JSX) |
| 2 | Define interfaces for all data models (`User`, `Product`, etc.) |
| 3 | Define interface for component props |
| 4 | Add type annotations to `useState` (especially `null` unions) |
| 5 | Type event handlers (`React.ChangeEvent`, `React.FormEvent`, etc.) |
| 6 | Type `useRef` with the correct HTML element type |
| 7 | Add return type annotations to functions |
| 8 | Replace `any` with proper types (never use `any` in production) |
| 9 | Configure `tsconfig.json` with strict mode |

