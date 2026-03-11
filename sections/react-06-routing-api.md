# Part 9: React Routing

## 9.1 Introduction to Client-Side Routing

### What Is Client-Side Routing?

In a traditional Multi-Page Application (MPA), navigating to a new URL causes the browser to request an entire new HTML document from the server.

In a React Single-Page Application (SPA), the browser only loads HTML once natively. **Client-side routing** intercepts URL changes (using the HTML5 History API), prevents the browser reload, and simply maps the new URL to a specific React component that renders the new "page" instantly.

### Why Use Client-Side Routing?

- **Instant Navigation**: No full-page reloads, resulting in an app-like feel.
- **State Preservation**: The application state (like a shopping cart or user session) is preserved during navigation.
- **Dynamic Routing**: Easy to handle parameters (e.g., `/user/:id`) and render specific data.
- **Lazy Loading**: Route-based code splitting loads components only when their route is accessed.

### React Router Architecture

React Router (v6+) is the industry standard for routing in React applications.

```
+--------------------------------------------------------------+
|                    REACT ROUTER V6 FLOW                       |
+--------------------------------------------------------------+
|                                                              |
|  URL Changes (e.g., /products/123)                           |
|       |                                                      |
|       v                                                      |
|  <BrowserRouter> intercepts the change                       |
|       |                                                      |
|       v                                                      |
|  Matches route definition: path="/products/:id"              |
|       |                                                      |
|       v                                                      |
|  Extracts params: { id: "123" }                              |
|       |                                                      |
|       v                                                      |
|  Renders mapped component: <ProductDetail />                 |
+--------------------------------------------------------------+
```

---

## 9.2 Route Configuration

Modern React Router uses a configuration-based approach with `createBrowserRouter`.

### Basic Routing Setup (TypeScript)

```tsx
// router.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import NotFound from './pages/NotFound';

// Define the route configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />, // Rendered at "/"
    errorElement: <NotFound /> // Renders if matching fails or an error is thrown
  },
  {
    path: '/about',
    element: <About />
  }
]);

// App.tsx
function App() {
  return <RouterProvider router={router} />;
}
```

### Navigating Between Routes

Always use the `<Link>` or `<NavLink>` components, never `<a>` tags. An `<a>` tag causes a full page reload.

```tsx
import { Link, NavLink, useNavigate } from 'react-router-dom';

function Navigation() {
  const navigate = useNavigate();

  return (
    <nav>
      {/* Basic navigation */}
      <Link to="/">Home</Link>

      {/* NavLink automatically adds an "active" class when the route matches */}
      <NavLink
        to="/about"
        className={({ isActive }) => (isActive ? 'active-link' : '')}
      >
        About
      </NavLink>

      {/* Programmatic navigation */}
      <button onClick={() => navigate('/products')}>
        Go to Products
      </button>
      
      {/* Navigate back */}
      <button onClick={() => navigate(-1)}>Back</button>
    </nav>
  );
}
```

---

## 9.3 Nested Routes

### What Are Nested Routes?

Nested routes allow you to render child components within a parent component based on a nested URL path. This is extremely useful for layouts (e.g., a dashboard with a sidebar and a changing main content area).

### Implementation

1. Define children in the route config.
2. Use `<Outlet />` in the parent component where the child component should render.

```tsx
// router.tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,      // Parent component
    children: [
      {
        index: true,              // Default child when URL is "/"
        element: <DashboardHome />
      },
      {
        path: 'settings',         // URL will be "/settings"
        element: <SettingsPage />
      },
      {
        path: 'profile',          // URL will be "/profile"
        element: <ProfilePage />
      }
    ]
  }
]);

// MainLayout.tsx
import { Outlet, Link } from 'react-router-dom';

function MainLayout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </aside>
      <main className="content">
        {/* The child component (DashboardHome, SettingsPage, or ProfilePage) renders here! */}
        <Outlet />
      </main>
    </div>
  );
}
```

---

## 9.4 Dynamic Routes and URL Parameters

### Implementing Dynamic Routes

Often, URLs carry data, such as an ID to fetch specific details. You define these using a colon (e.g., `:id`).

```tsx
// router.tsx
const router = createBrowserRouter([
  {
    path: '/products',
    element: <ProductList />
  },
  {
    path: '/products/:productId', // Dynamic parameter named "productId"
    element: <ProductDetail />
  }
]);

// ProductDetail.tsx
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

function ProductDetail() {
  // Extract the parameter matching the route definition
  // Extracting carefully using TS type
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    // productId is typed as string | undefined
    if (productId) {
      fetch(`/api/products/${productId}`)
        .then(res => res.json())
        .then(data => setProduct(data));
    }
  }, [productId]);

  if (!product) return <div>Loading...</div>;
  return <h1>{product.name}</h1>;
}
```

### Query Parameters

Data appended after a `?` in the URL (e.g., `/search?q=react&sort=asc`).

```tsx
import { useSearchParams } from 'react-router-dom';

function SearchResults() {
  // Returns state value and generic setter
  const [searchParams, setSearchParams] = useSearchParams();
  
  const query = searchParams.get('q');
  const sort = searchParams.get('sort') || 'desc';

  const updateSort = (newSort: string) => {
    // Update the URL without losing existing parameters
    setSearchParams(prev => {
      prev.set('sort', newSort);
      return prev;
    });
  };

  return (
    <div>
      <h1>Search Results for: {query}</h1>
      <button onClick={() => updateSort('asc')}>Sort Ascending</button>
    </div>
  );
}
```

---

## 9.5 Protected Routes

### What Is a Protected Route?

A route that should only be accessible if certain conditions are met (e.g., the user is logged in, or the user is an admin). If the condition fails, the user is redirected.

### Implementing a Protected Route Wrapper

A standard pattern is a wrapper component that checks authentication state using context.

```tsx
// ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'user';
}

function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Verifying session...</div>;
  }

  // Not logged in -> Redirect to login page
  // Save the intended destination to return them there after login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in, but checks for specific role
  if (requiredRole && user?.role !== requiredRole) {
    // Return unauthorized view, or redirect to home
    return <Navigate to="/unauthorized" replace />;
  }

  // Authorized -> Render child routes
  return <Outlet />;
}

// router.tsx usage
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    // Wrap protected area
    element: <ProtectedRoute />, 
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/profile', element: <Profile /> },
    ]
  },
  {
    // Wrap admin area
    element: <ProtectedRoute requiredRole="admin" />,
    children: [
      { path: '/admin/users', element: <UserManagement /> }
    ]
  }
]);
```

---

# Part 10: API Integration

## 10.1 Communicating with Backend APIs

React components need data to render. They get that data by communicating with backend services via HTTP requests (typically REST or GraphQL).

### The Fetching Lifecycle

```
+--------------------------------------------------------------+
|                     API INTEGRATION LIFECYCLE                 |
+--------------------------------------------------------------+
|                                                              |
|  1. Initialization                                           |
|     Component Mounts -> Sets Loading State: TRUE            |
|                                                              |
|  2. Execution                                                |
|     Sends HTTP Request (fetch/axios)                        |
|                                                              |
|  3. Resolution                                               |
|     +--> SUCCESS: Set Data State, Set Loading: FALSE         |
|     +--> FAILURE: Set Error State, Set Loading: FALSE        |
|                                                              |
|  4. Reactivity                                               |
|     Component re-renders to display Data or Error            |
+--------------------------------------------------------------+
```

---

## 10.2 Native Fetch vs Axios

### Native `fetch`

Built into modern browsers. Returns a Promise. Note: `fetch` only rejects a promise on network failures, NOT on HTTP errors (like 404 or 500).

```javascript
// fetch pattern
fetch('/api/data')
  // Must manually check response.ok and parse JSON
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

### Axios

A popular third-party library that simplifies HTTP requests.

```javascript
// axios pattern
import axios from 'axios';

axios.get('/api/data')
  // Throws automatically on 4xx/5xx, auto-parses JSON
  .then(res => console.log(res.data))
  .catch(err => console.error(err));
```

### Axios Instance Configuration (Enterprise Pattern)

In production, you should create a centralized axios instance with interceptors for auth tokens and error handling.

```typescript
// services/api.ts
import axios from 'axios';

// Define the shape of typical API responses
export interface ApiResponse<T> {
  data: T;
  message: string;
}

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://api.example.com/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request Interceptor (attaches token)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor (handles global errors)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired -> redirect to login or clear session
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 10.3 Core API Patterns in React

### 1. The Standard `useEffect` Pattern

This is the baseline way to fetch data inside a component.

```tsx
import { useState, useEffect } from 'react';
import api from '../services/api';

// 1. Define specific interfaces for your data
interface User {
  id: number;
  name: string;
  email: string;
}

function UserList() {
  // 2. Define the exact state variables needed
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 3. Optional but recommended: AbortController for cleanup
    const controller = new AbortController();

    const fetchUsers = async () => {
      try {
        // Reset states
        setIsLoading(true);
        setError(null);

        // API call
        const response = await api.get<User[]>('/users', {
          signal: controller.signal
        });
        
        // 4. Data transformation & storage
        setUsers(response.data);
      } catch (err: any) {
        // Only set error if it wasn't an intentional abort
        if (err.name !== 'CanceledError') {
          setError(err.response?.data?.message || err.message || 'An error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();

    // 5. Cleanup function
    return () => controller.abort();
  }, []); // Run once on mount

  // 6. Handle loading and error UI states
  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div className="error-alert">{error}</div>;

  // 7. Render data
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name} - {user.email}</li>
      ))}
    </ul>
  );
}
```

### 2. Service Layer Pattern

Don't write raw `fetch` or `axios` calls in components. Extract them into a service layer.

```typescript
// services/userService.ts
import api from './api';
import { User, CreateUserDto } from '../types/user';

export const userService = {
  // Get all users
  getAll: async (): Promise<User[]> => {
    const { data } = await api.get<User[]>('/users');
    return data;
  },
  
  // Get by ID
  getById: async (id: number): Promise<User> => {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },
  
  // Create
  create: async (userData: CreateUserDto): Promise<User> => {
    const { data } = await api.post<User>('/users', userData);
    return data;
  }
};
```

```tsx
// Component using the service
useEffect(() => {
  userService.getAll()
    .then(setUsers)
    .catch(err => setError(err.message))
    .finally(() => setIsLoading(false));
}, []);
```

### 3. Modern Data Fetching Libraries (React Query)

In modern enterprise applications, standard `useEffect` fetching is replaced by tools like **React Query** or **SWR**, which automatically handle caching, deduplication, background updates, and state management.

```tsx
// Using React Query (TanStack Query)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';

function UserList() {
  const queryClient = useQueryClient();

  // 1. Data fetching is simplified to one hook call
  // Automatically handles loading state, error state, and caching!
  const { 
    data: users, 
    isLoading, 
    isError, 
    error 
  } = useQuery({
    queryKey: ['users'], // Cache key
    queryFn: userService.getAll
  });

  // 2. Mutations (POST/PUT/DELETE) are also simplified
  const deleteMutation = useMutation({
    mutationFn: userService.delete,
    // When successful, invalidate the 'users' cache to trigger an auto-refetch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {(error as Error).message}</div>;

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>
          {user.name} 
          <button onClick={() => deleteMutation.mutate(user.id)}>
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

| React Query Benefit | Raw useEffect implementation |
|--------------------|----------------------------|
| Code Amount | 2 lines code | ~30 lines code |
| Auto Caching | Built in | Requires Redux/Zustand |
| Auto Retry on fail | Built in | Must write custom logic |
| Request Deduplication| Built in | Very difficult |
| Stale-while-revalidate | Built in | Very difficult |
