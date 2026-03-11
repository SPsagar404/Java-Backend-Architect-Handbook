# Part 3: React Project Architecture

## 3.1 Why Project Architecture Matters

A well-organized project structure is critical for production-grade React applications. Without a clear architecture, codebases become tangled, onboarding new developers becomes painful, and maintaining the application becomes exponentially harder as it grows.

### Goals of Good Architecture

| Goal | Description |
|------|-------------|
| Scalability | Easy to add new features without restructuring |
| Maintainability | Easy to find, understand, and modify code |
| Reusability | Components and utilities shared across features |
| Testability | Each layer can be tested independently |
| Team Collaboration | Multiple developers can work without conflicts |

---

## 3.2 Recommended Project Structure

### Production-Grade Folder Structure

```
src/
|-- assets/              # Static files: images, fonts, icons
|   |-- images/
|   |-- fonts/
|   +-- icons/
|
|-- components/           # Shared/reusable UI components
|   |-- Button/
|   |   |-- Button.tsx
|   |   |-- Button.styles.css
|   |   +-- Button.test.tsx
|   |-- Modal/
|   |-- Input/
|   +-- Card/
|
|-- pages/                # Page-level components (route targets)
|   |-- HomePage/
|   |   |-- HomePage.tsx
|   |   +-- HomePage.styles.css
|   |-- DashboardPage/
|   |-- LoginPage/
|   +-- ProfilePage/
|
|-- hooks/                # Custom React hooks
|   |-- useAuth.ts
|   |-- useFetch.ts
|   |-- useDebounce.ts
|   +-- useLocalStorage.ts
|
|-- services/             # API calls and external service integrations
|   |-- api.ts            # Axios/fetch instance configuration
|   |-- authService.ts
|   |-- userService.ts
|   +-- productService.ts
|
|-- context/              # React Context providers
|   |-- AuthContext.tsx
|   |-- ThemeContext.tsx
|   +-- CartContext.tsx
|
|-- utils/                # Pure utility functions
|   |-- formatDate.ts
|   |-- validators.ts
|   |-- constants.ts
|   +-- helpers.ts
|
|-- types/                # TypeScript type definitions
|   |-- user.ts
|   |-- product.ts
|   +-- api.ts
|
|-- layouts/              # Layout wrapper components
|   |-- MainLayout.tsx
|   |-- AuthLayout.tsx
|   +-- DashboardLayout.tsx
|
|-- routes/               # Route configuration
|   |-- AppRoutes.tsx
|   +-- ProtectedRoute.tsx
|
|-- store/                # State management (Redux/Zustand)
|   |-- slices/
|   |-- store.ts
|   +-- hooks.ts
|
|-- App.tsx               # Root application component
|-- index.tsx             # Entry point
+-- index.css             # Global styles
```

### Why Each Folder Exists

| Folder | Purpose | Example Contents |
|--------|---------|-----------------|
| `components/` | Shared, reusable UI building blocks | Button, Modal, Card, Input |
| `pages/` | Top-level views mapped to routes | HomePage, LoginPage, Dashboard |
| `hooks/` | Custom hooks encapsulating reusable logic | useAuth, useFetch, useDebounce |
| `services/` | API communication layer | authService, userService |
| `context/` | React Context for cross-cutting state | AuthContext, ThemeContext |
| `utils/` | Pure helper functions (no React dependency) | formatDate, validators |
| `types/` | TypeScript interfaces and type definitions | User, Product, ApiResponse |
| `layouts/` | Page layout wrappers (header, sidebar, footer) | MainLayout, DashboardLayout |
| `routes/` | Route definitions and guards | AppRoutes, ProtectedRoute |
| `store/` | Global state management | Redux slices, Zustand stores |
| `assets/` | Static resources | Images, fonts, SVG icons |

---

## 3.3 Architecture Diagram

### Layered Architecture

```
+------------------------------------------------------------------+
|                    REACT APPLICATION LAYERS                       |
+------------------------------------------------------------------+
|                                                                  |
|   PRESENTATION LAYER                                             |
|   +------------------------------------------------------------+ |
|   |  Pages         Components       Layouts                    | |
|   |  (Route Views) (Reusable UI)    (Page Wrappers)            | |
|   +------------------------------------------------------------+ |
|                          |                                       |
|   LOGIC LAYER                                                    |
|   +------------------------------------------------------------+ |
|   |  Hooks          Context         Store (Redux/Zustand)      | |
|   |  (Custom Logic) (Shared State)  (Global State)             | |
|   +------------------------------------------------------------+ |
|                          |                                       |
|   DATA LAYER                                                     |
|   +------------------------------------------------------------+ |
|   |  Services        Utils           Types                     | |
|   |  (API Calls)     (Helpers)       (TypeScript Definitions)  | |
|   +------------------------------------------------------------+ |
|                          |                                       |
|   EXTERNAL                                                       |
|   +------------------------------------------------------------+ |
|   |  REST APIs       GraphQL        Third-Party Services       | |
|   +------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### Data Flow Architecture

```
+------------------------------------------------------------------+
|                    DATA FLOW IN REACT APP                         |
+------------------------------------------------------------------+
|                                                                  |
|  User Event (click, type, submit)                                |
|       |                                                          |
|       v                                                          |
|  Component Handler (onClick, onChange)                            |
|       |                                                          |
|       +--> Local State? --> useState/useReducer --> Re-render    |
|       |                                                          |
|       +--> Global State? --> dispatch(action) --> Store Update   |
|       |                          |                               |
|       |                          v                               |
|       |                   All subscribed components re-render    |
|       |                                                          |
|       +--> API Call? --> Service Layer --> fetch/axios            |
|                              |                                   |
|                              v                                   |
|                        Backend API                               |
|                              |                                   |
|                              v                                   |
|                        Response -> Update State -> Re-render     |
+------------------------------------------------------------------+
```

### Feature-Based Alternative Structure

For larger applications, some teams prefer organizing by feature instead of by type:

```
src/
|-- features/
|   |-- auth/
|   |   |-- components/
|   |   |   |-- LoginForm.tsx
|   |   |   +-- RegisterForm.tsx
|   |   |-- hooks/
|   |   |   +-- useAuth.ts
|   |   |-- services/
|   |   |   +-- authService.ts
|   |   |-- context/
|   |   |   +-- AuthContext.tsx
|   |   |-- pages/
|   |   |   |-- LoginPage.tsx
|   |   |   +-- RegisterPage.tsx
|   |   +-- types.ts
|   |
|   |-- products/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- services/
|   |   +-- pages/
|   |
|   +-- cart/
|       |-- components/
|       |-- hooks/
|       +-- services/
|
|-- shared/                # Shared across all features
|   |-- components/
|   |-- hooks/
|   |-- utils/
|   +-- types/
|
|-- App.tsx
+-- index.tsx
```

| Structure | Best For | Trade-off |
|-----------|---------|-----------|
| Type-based (components/, hooks/, etc.) | Small to medium apps, teams new to React | Harder to find all files for a feature |
| Feature-based (features/auth/, etc.) | Large apps, multiple teams | Some duplication, more folders |

---

# Part 4: React Components

## 4.1 Functional Components

### What Are Functional Components?

Functional components are JavaScript functions that accept `props` as an argument and return JSX (React elements). They are the modern standard for writing React components.

### Why Use Functional Components?

- Simpler syntax — just a function
- Hooks enable full state and lifecycle capabilities
- Easier to test and reason about
- Better performance (no class instantiation overhead)
- The recommended approach by the React team since React 16.8

### JavaScript Example

```jsx
// JavaScript Functional Component
import React from 'react';

function Greeting({ name, age }) {
  return (
    <div className="greeting">
      <h2>Hello, {name}!</h2>
      <p>You are {age} years old.</p>
    </div>
  );
}

// Arrow function variant
const Greeting = ({ name, age }) => (
  <div className="greeting">
    <h2>Hello, {name}!</h2>
    <p>You are {age} years old.</p>
  </div>
);

// Usage
<Greeting name="Alice" age={28} />
```

### TypeScript Example

```tsx
// TypeScript Functional Component
import React from 'react';

// Define props interface
interface GreetingProps {
  name: string;
  age: number;
  isActive?: boolean; // optional prop
}

const Greeting: React.FC<GreetingProps> = ({ name, age, isActive = true }) => {
  return (
    <div className={`greeting ${isActive ? 'active' : ''}`}>
      <h2>Hello, {name}!</h2>
      <p>You are {age} years old.</p>
    </div>
  );
};

// Alternative: Typing props directly (preferred by many teams)
function Greeting({ name, age, isActive = true }: GreetingProps) {
  return (
    <div className={`greeting ${isActive ? 'active' : ''}`}>
      <h2>Hello, {name}!</h2>
      <p>You are {age} years old.</p>
    </div>
  );
}

// Usage
<Greeting name="Alice" age={28} />
<Greeting name="Bob" age={32} isActive={false} />
```

---

## 4.2 Class Components

### What Are Class Components?

Class components are ES6 classes that extend `React.Component`. They were the primary way to create stateful components before React 16.8 introduced hooks. While still supported, they are considered legacy for new code.

### When to Use Class Components

- Maintaining legacy codebases that already use them
- Using `Error Boundaries` (which still require class components as of React 18)
- Understanding them for interviews and older code

### JavaScript Example

```jsx
// JavaScript Class Component
import React, { Component } from 'react';

class UserProfile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isEditing: false,
      bio: props.initialBio || ''
    };
  }

  toggleEdit = () => {
    this.setState(prevState => ({ isEditing: !prevState.isEditing }));
  };

  handleBioChange = (e) => {
    this.setState({ bio: e.target.value });
  };

  render() {
    const { name, email } = this.props;
    const { isEditing, bio } = this.state;

    return (
      <div className="profile">
        <h2>{name}</h2>
        <p>{email}</p>
        {isEditing ? (
          <textarea value={bio} onChange={this.handleBioChange} />
        ) : (
          <p>{bio}</p>
        )}
        <button onClick={this.toggleEdit}>
          {isEditing ? 'Save' : 'Edit'}
        </button>
      </div>
    );
  }
}
```

### TypeScript Example

```tsx
// TypeScript Class Component
import React, { Component } from 'react';

interface UserProfileProps {
  name: string;
  email: string;
  initialBio?: string;
}

interface UserProfileState {
  isEditing: boolean;
  bio: string;
}

class UserProfile extends Component<UserProfileProps, UserProfileState> {
  constructor(props: UserProfileProps) {
    super(props);
    this.state = {
      isEditing: false,
      bio: props.initialBio || ''
    };
  }

  toggleEdit = (): void => {
    this.setState(prevState => ({ isEditing: !prevState.isEditing }));
  };

  handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    this.setState({ bio: e.target.value });
  };

  render(): React.ReactNode {
    const { name, email } = this.props;
    const { isEditing, bio } = this.state;

    return (
      <div className="profile">
        <h2>{name}</h2>
        <p>{email}</p>
        {isEditing ? (
          <textarea value={bio} onChange={this.handleBioChange} />
        ) : (
          <p>{bio}</p>
        )}
        <button onClick={this.toggleEdit}>
          {isEditing ? 'Save' : 'Edit'}
        </button>
      </div>
    );
  }
}
```

---

## 4.3 Functional vs Class Components — Comparison

| Feature | Functional Component | Class Component |
|---------|---------------------|----------------|
| Syntax | Plain function | ES6 class extending React.Component |
| State Management | `useState` hook | `this.state` + `this.setState()` |
| Side Effects | `useEffect` hook | Lifecycle methods (componentDidMount, etc.) |
| Performance | Slightly better (no class overhead) | Slightly heavier |
| `this` keyword | Not needed | Required (binding issues) |
| Error Boundaries | Not supported directly | Supported via componentDidCatch |
| Code Length | Shorter, more concise | Longer, more boilerplate |
| Testing | Easier (pure function) | Harder (class instance) |
| React Team Recommendation | Preferred for new code | Legacy, still supported |

---

## 4.4 Props (Properties)

### What Are Props?

Props are read-only data passed from a parent component to a child component. They are the primary mechanism for component communication in React's unidirectional data flow.

### Key Characteristics of Props

- **Read-only** — A child component must never modify its own props
- **Passed from parent** — Data flows downward
- **Can be any type** — Strings, numbers, objects, arrays, functions, even other components
- **Trigger re-renders** — When props change, the child re-renders

### Props Flow Diagram

```
+---------------------+
|   ParentComponent   |
|                     |
|  state: {           |
|    user: "Alice",   |
|    role: "Admin"    |
|  }                  |
+--------+------------+
         |
    props: { name="Alice", role="Admin", onLogout={fn} }
         |
         v
+--------+------------+
|   ChildComponent    |
|                     |
|  Receives:          |
|    props.name       |
|    props.role       |
|    props.onLogout   |
+---------------------+
```

### JavaScript Example

```jsx
// Parent Component
function App() {
  const [user, setUser] = useState({ name: 'Alice', role: 'admin' });

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div>
      <UserCard
        name={user.name}
        role={user.role}
        onLogout={handleLogout}
      />
    </div>
  );
}

// Child Component
function UserCard({ name, role, onLogout }) {
  return (
    <div className="user-card">
      <h3>{name}</h3>
      <span className="badge">{role}</span>
      <button onClick={onLogout}>Logout</button>
    </div>
  );
}
```

### TypeScript Example

```tsx
// Define types for props
interface UserCardProps {
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  onLogout: () => void;
  avatar?: string; // optional prop
}

// Child Component with typed props
function UserCard({ name, role, onLogout, avatar }: UserCardProps) {
  return (
    <div className="user-card">
      {avatar && <img src={avatar} alt={name} />}
      <h3>{name}</h3>
      <span className="badge">{role}</span>
      <button onClick={onLogout}>Logout</button>
    </div>
  );
}
```

### Children Props

React components can receive child elements through the special `children` prop:

```tsx
// TypeScript
interface CardProps {
  title: string;
  children: React.ReactNode;
}

function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}

// Usage
<Card title="User Info">
  <p>Name: Alice</p>
  <p>Email: alice@example.com</p>
</Card>
```

### Default Props

```tsx
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

function Button({
  label,
  variant = 'primary',
  size = 'md',
  disabled = false
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

// Usage — defaults applied automatically
<Button label="Submit" />
<Button label="Cancel" variant="secondary" size="sm" />
```

---

## 4.5 State

### What Is State?

State is mutable data managed within a component that determines the component's behavior and rendering. When state changes, React re-renders the component to reflect the new state.

### Props vs State

| Feature | Props | State |
|---------|-------|-------|
| Owned by | Parent component | The component itself |
| Mutable? | No (read-only) | Yes (via setState / useState) |
| Passed down? | Yes, parent to child | No, local to component |
| Triggers re-render? | Yes, when changed by parent | Yes, when updated |
| Purpose | Configure a component | Track dynamic data |

### State in Functional Components (useState)

**JavaScript:**

```jsx
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  const [step, setStep] = useState(1);

  const increment = () => setCount(prev => prev + step);
  const decrement = () => setCount(prev => prev - step);
  const reset = () => setCount(0);

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <div className="controls">
        <button onClick={decrement}>-</button>
        <button onClick={increment}>+</button>
        <button onClick={reset}>Reset</button>
      </div>
      <label>
        Step:
        <input
          type="number"
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
```

**TypeScript:**

```tsx
import React, { useState } from 'react';

interface CounterState {
  count: number;
  step: number;
}

function Counter(): React.ReactElement {
  const [count, setCount] = useState<number>(0);
  const [step, setStep] = useState<number>(1);

  const increment = (): void => setCount(prev => prev + step);
  const decrement = (): void => setCount(prev => prev - step);
  const reset = (): void => setCount(0);

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <div className="controls">
        <button onClick={decrement}>-</button>
        <button onClick={increment}>+</button>
        <button onClick={reset}>Reset</button>
      </div>
      <label>
        Step:
        <input
          type="number"
          value={step}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setStep(Number(e.target.value))
          }
        />
      </label>
    </div>
  );
}
```

### State with Objects

```tsx
interface User {
  name: string;
  email: string;
  age: number;
}

function UserForm() {
  const [user, setUser] = useState<User>({
    name: '',
    email: '',
    age: 0
  });

  // IMPORTANT: Always create a new object, never mutate state directly
  const updateField = (field: keyof User, value: string | number): void => {
    setUser(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form>
      <input
        value={user.name}
        onChange={(e) => updateField('name', e.target.value)}
        placeholder="Name"
      />
      <input
        value={user.email}
        onChange={(e) => updateField('email', e.target.value)}
        placeholder="Email"
      />
      <input
        type="number"
        value={user.age}
        onChange={(e) => updateField('age', Number(e.target.value))}
        placeholder="Age"
      />
    </form>
  );
}
```

### State Update Rules

```
+--------------------------------------------------------------+
|                    STATE UPDATE RULES                          |
+--------------------------------------------------------------+
|                                                              |
|  1. NEVER mutate state directly                              |
|     BAD:  state.count = 5                                    |
|     GOOD: setState({ count: 5 })                             |
|                                                              |
|  2. State updates may be BATCHED (asynchronous)              |
|     React may batch multiple setState calls into one render  |
|                                                              |
|  3. Use FUNCTIONAL updates when new state depends on old     |
|     BAD:  setCount(count + 1)  // stale closure risk         |
|     GOOD: setCount(prev => prev + 1)                         |
|                                                              |
|  4. State updates trigger RE-RENDERS                         |
|     The component and its children re-render                 |
|                                                              |
|  5. State is PRESERVED between renders                       |
|     React keeps state tied to the component's position       |
|     in the tree                                              |
+--------------------------------------------------------------+
```

---

## 4.6 Component Lifecycle

### What Is the Component Lifecycle?

Every React component goes through a lifecycle: it is created (mounted), updated (when state or props change), and eventually removed (unmounted). Understanding the lifecycle is essential for managing side effects, data fetching, and cleanup.

### Lifecycle Phases

```
+--------------------------------------------------------------+
|                  COMPONENT LIFECYCLE PHASES                    |
+--------------------------------------------------------------+
|                                                              |
|  MOUNTING (Component is created and inserted into DOM)       |
|  +--------------------------------------------------------+ |
|  | constructor() -> render() -> componentDidMount()        | |
|  | [Hooks: useState initializer, useEffect(fn, [])]       | |
|  +--------------------------------------------------------+ |
|                          |                                   |
|                          v                                   |
|  UPDATING (State or props change)                            |
|  +--------------------------------------------------------+ |
|  | render() -> componentDidUpdate()                        | |
|  | [Hooks: useEffect(fn, [deps])]                         | |
|  +--------------------------------------------------------+ |
|                          |                                   |
|                          v                                   |
|  UNMOUNTING (Component is removed from DOM)                  |
|  +--------------------------------------------------------+ |
|  | componentWillUnmount()                                  | |
|  | [Hooks: useEffect cleanup function]                    | |
|  +--------------------------------------------------------+ |
+--------------------------------------------------------------+
```

### Class Component Lifecycle Methods

```
+--------------------------------------------------------------+
|              CLASS COMPONENT LIFECYCLE METHODS                 |
+--------------------------------------------------------------+
|                                                              |
|  MOUNTING:                                                   |
|    constructor(props)          Initialize state               |
|    static getDerivedStateFromProps(props, state)             |
|    render()                    Return JSX                     |
|    componentDidMount()         API calls, subscriptions      |
|                                                              |
|  UPDATING:                                                   |
|    static getDerivedStateFromProps(props, state)             |
|    shouldComponentUpdate(nextProps, nextState)                |
|    render()                    Return updated JSX             |
|    getSnapshotBeforeUpdate(prevProps, prevState)              |
|    componentDidUpdate(prevProps, prevState, snapshot)         |
|                                                              |
|  UNMOUNTING:                                                 |
|    componentWillUnmount()      Cleanup timers, listeners     |
|                                                              |
|  ERROR HANDLING:                                             |
|    static getDerivedStateFromError(error)                    |
|    componentDidCatch(error, info)                            |
+--------------------------------------------------------------+
```

### Lifecycle with Hooks (Functional Components)

Hooks map to lifecycle methods as follows:

| Class Lifecycle Method | Hook Equivalent |
|----------------------|----------------|
| `constructor` | `useState` (initialization) |
| `componentDidMount` | `useEffect(() => { ... }, [])` |
| `componentDidUpdate` | `useEffect(() => { ... }, [deps])` |
| `componentWillUnmount` | `useEffect(() => { return () => cleanup }, [])` |
| `shouldComponentUpdate` | `React.memo()` |

### Real-World Lifecycle Example

**JavaScript — Functional Component with Hooks:**

```jsx
import React, { useState, useEffect } from 'react';

function UserDashboard({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // componentDidMount + componentDidUpdate (when userId changes)
  useEffect(() => {
    let isCancelled = false;

    async function fetchUser() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();

        if (!isCancelled) {
          setUser(data);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchUser();

    // Cleanup — componentWillUnmount / before next effect run
    return () => {
      isCancelled = true;
    };
  }, [userId]); // Re-run when userId changes

  // componentDidMount — set up event listener
  useEffect(() => {
    const handleResize = () => {
      console.log('Window resized');
    };

    window.addEventListener('resize', handleResize);

    // Cleanup — componentWillUnmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty deps = run once on mount

  if (loading) return <div className="spinner">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!user) return null;

  return (
    <div className="dashboard">
      <h1>Welcome, {user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
    </div>
  );
}
```

**TypeScript — Same Component:**

```tsx
import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface UserDashboardProps {
  userId: number;
}

function UserDashboard({ userId }: UserDashboardProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchUser(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}`);
        const data: User = await response.json();

        if (!isCancelled) {
          setUser(data);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    }

    fetchUser();

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const handleResize = (): void => {
      console.log('Window resized');
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (loading) return <div className="spinner">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!user) return <></>;

  return (
    <div className="dashboard">
      <h1>Welcome, {user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
    </div>
  );
}
```

### Error Boundaries (Class Components Only)

Error boundaries catch JavaScript errors in child components and display a fallback UI. They must be class components.

```tsx
// TypeScript Error Boundary
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error Boundary caught:', error, errorInfo);
    // Log to error reporting service (e.g., Sentry)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<div>Oops! Something broke.</div>}>
  <UserDashboard userId={1} />
</ErrorBoundary>
```

