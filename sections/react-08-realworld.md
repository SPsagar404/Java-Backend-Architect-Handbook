# Part 13: Real-World Application Examples

This section provides complete, functioning examples of common real-world features you will build in production React applications.

## 13.1 User Authentication System

A complete authentication flow using Context API, simulating an API login, storing a token, and managing the user session.

```tsx
// 1. types/auth.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

// 2. context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Simulate API verification
      setTimeout(() => {
        setUser({ id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin' });
        setIsLoading(false);
      }, 500);
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (email === 'admin@demo.com' && password === 'admin123') {
          localStorage.setItem('token', 'fake-jwt-token-123');
          setUser({ id: '1', name: 'Alice Admin', email, role: 'admin' });
          resolve();
        } else {
          reject(new Error('Invalid credentials'));
        }
        setIsLoading(false);
      }, 1000);
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
};

// 3. components/Login.tsx
import React, { useState } from 'react';

export function Login() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <div>You are already logged in!</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Please Sign In</h2>
      {error && <div className="error-alert">{error}</div>}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="admin@demo.com"
        required
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="admin123"
        required
      />
      <button type="submit">Log In</button>
    </form>
  );
}

// 4. components/Dashboard.tsx
import React from 'react';

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard">
      <header>
        <h1>Welcome, {user?.name}</h1>
        <button onClick={logout}>Sign Out</button>
      </header>
      <div className="content">
        <p>Your role is: <strong>{user?.role}</strong></p>
        {user?.role === 'admin' && (
          <div className="admin-panel">
            <h3>Admin Controls</h3>
            <button>Manage Users</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 13.2 Data Table with Filtering and Sorting

A common enterprise requirement: displaying data, searching, and sorting columns.

```tsx
import React, { useState, useMemo } from 'react';

interface Employee {
  id: number;
  name: string;
  department: string;
  role: string;
  salary: number;
}

const MOCK_DATA: Employee[] = [
  { id: 1, name: 'John Doe', department: 'Engineering', role: 'Frontend Dev', salary: 90000 },
  { id: 2, name: 'Jane Smith', department: 'Design', role: 'UX UI', salary: 85000 },
  { id: 3, name: 'Sam Johnson', department: 'Engineering', role: 'Backend Dev', salary: 110000 },
  { id: 4, name: 'Anna Lee', department: 'HR', role: 'Manager', salary: 75000 },
];

type SortKey = keyof Employee;
type SortDirection = 'asc' | 'desc';

export function EmployeeTable() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  // Derive all options for the select dropdown dynamically
  const departments = ['All', ...Array.from(new Set(MOCK_DATA.map(emp => emp.department)))];

  // Expensive filtering and sorting is memoized
  const processedData = useMemo(() => {
    let result = [...MOCK_DATA];

    // 1. Search filter
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(emp =>
        emp.name.toLowerCase().includes(lowerSearch) ||
        emp.role.toLowerCase().includes(lowerSearch)
      );
    }

    // 2. Department filter
    if (deptFilter !== 'All') {
      result = result.filter(emp => emp.department === deptFilter);
    }

    // 3. Sorting
    if (sortConfig !== null) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [search, deptFilter, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="table-container">
      <div className="controls">
        <input
          placeholder="Search name or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <span>Showing {processedData.length} employees</span>
      </div>

      <table>
        <thead>
          <tr>
            <th onClick={() => requestSort('name')}>Name ↕</th>
            <th onClick={() => requestSort('department')}>Department ↕</th>
            <th onClick={() => requestSort('role')}>Role ↕</th>
            <th onClick={() => requestSort('salary')}>Salary ↕</th>
          </tr>
        </thead>
        <tbody>
          {processedData.length > 0 ? (
            processedData.map(emp => (
              <tr key={emp.id}>
                <td>{emp.name}</td>
                <td>{emp.department}</td>
                <td>{emp.role}</td>
                <td>${emp.salary.toLocaleString()}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={4}>No results found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

---

# Part 14: React JS vs React TypeScript

## 14.1 Why Choose One Over the Other?

Building a React application is fundamentally different depending on whether you use plain JavaScript (`.jsx`) or TypeScript (`.tsx`). 

**JavaScript** offers speed, flexibility, and a lower barrier to entry.
**TypeScript** offers robust architecture, compiler safety, self-documenting APIs, and scale.

Today, **TypeScript is the industry standard** for new React enterprise applications.

## 14.2 Feature Comparison

| Feature | React + JavaScript | React + TypeScript |
|---------|--------------------|--------------------|
| **Type Safety** | None (unless using PropTypes) | Strict compile-time checks |
| **Error Detection** | Runtime (found in the browser) | Compile-time (found in the IDE) |
| **Refactoring** | Dangerous (rely on global search) | Safe (compiler flags missing fields) |
| **Component API** | Unclear (must read component implementation) | Explicit (Interfaces define exact props) |
| **Learning Curve** | Shorter | Steeper (requires understanding TS concepts) |
| **Setup Time** | Instant (CRA, Vite) | Slightly longer (TSConfig, strictness) |
| **Team Size** | Best for small teams / solo | Essential for large teams (5+ devs) |
| **Maintainability**| Harder linearly as app grows | Easier linearly as app grows |
| **Build Speed** | Faster | Slower (type checking phase) |

## 14.3 Side-by-Side Code Examples

### 1. Defining Component Props

**JavaScript (with PropTypes):**
```jsx
import React from 'react';
import PropTypes from 'prop-types';

function Button({ label, onClick, disabled, variant }) {
  const className = `btn btn-${variant} ${disabled ? 'disabled' : ''}`;
  return (
    <button className={className} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

Button.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger'])
};

Button.defaultProps = {
  disabled: false,
  variant: 'primary'
};
```

**TypeScript:**
```tsx
import React from 'react';

// The interface acts as PropTypes AND documentation
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

// Defaults defined directly in parameters
export function Button({ 
  label, 
  onClick, 
  disabled = false, 
  variant = 'primary' 
}: ButtonProps) {
  const className = `btn btn-${variant} ${disabled ? 'disabled' : ''}`;
  return (
    <button className={className} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### 2. State Formatting & Auto-completion

**JavaScript:**
```jsx
// JS doesn't know what 'user' contains until assigned
const [user, setUser] = useState(null);

// Later in code... no auto-complete available here
// Might accidentally type user.first_name instead of user.firstName
const name = user ? user.name : 'Guest';
```

**TypeScript:**
```tsx
interface User {
  id: string;
  name: string;
  email: string;
}

// TS knows user is either null OR a User object
const [user, setUser] = useState<User | null>(null);

// IDE gives auto-complete: user.id, user.name, user.email
// TS throws error if you type user.first_name
const name = user ? user.name : 'Guest';
```

### 3. API Responses

**JavaScript:**
```jsx
const fetchProduct = async () => {
  const res = await fetch('/api/product/1');
  const data = await res.json();
  // 'data' is ANY type. You don't know what it contains.
  console.log(data.pice); // Typo! Undefined at runtime.
};
```

**TypeScript:**
```tsx
interface ProductResponse {
  id: number;
  title: string;
  price: number;
}

const fetchProduct = async () => {
  const res = await fetch('/api/product/1');
  const data: ProductResponse = await res.json();
  
  // TS ERROR: Property 'pice' does not exist on type 'ProductResponse'
  // Did you mean 'price'?
  console.log(data.pice); 
};
```

### Conclusion

While JavaScript is fine for quick prototypes or small, short-lived projects, the **investment in TypeScript pays off exponentially** in any project that will be maintained for more than a few months or worked on by more than one person. 
